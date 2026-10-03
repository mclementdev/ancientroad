import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { buildActiveCatalog, buildContactDossier } from "@/lib/ai/dossier";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisUserMessage, buildCatalogBlock } from "@/lib/ai/prompts";
import { saveAnalysisInputSchema } from "@/lib/ai/schema";
import { AnalysisError, parseAnalysisMessage, type ParsedAnalysis } from "@/lib/ai/parse";

export { AnalysisError };

export const ANALYSIS_TIMEOUT_MS = 60_000;
export const ANALYSIS_COOLDOWN_MS = 5 * 60_000;
export const DEFAULT_MODEL = "claude-opus-5-5";

/**
 * Adapte la requête au modèle configuré.
 * - Forcer l'outil (tool_choice "tool") n'est possible que sur les modèles qui l'acceptent
 *   et ne réfléchissent pas par défaut ; sur la famille 5.x on passe en "auto" + strict,
 *   avec une consigne explicite et une vérification de l'appel.
 * - Les modèles 5.x récents reçoivent les fallbacks serveur en cas de refus de sécurité.
 */
export function modelCapabilities(model: string) {
  const forcedToolChoice = /^claude-(opus-4-[678]|sonnet-4-[56]|haiku-4-5)/.test(model);
  const effort = !/^claude-(haiku|sonnet-4-5|3)/.test(model);
  const serverFallback = /^claude-(fable-5-1|opus-5-5|opus-5|sonnet-5-5)$/.test(model);
  return { forcedToolChoice, effort, serverFallback };
}

type MessagesClient = Pick<Anthropic, "beta">;

let defaultClient: Anthropic | null = null;
function getClient(): Anthropic {
  // maxRetries 0 : le délai de 60 s s'applique à l'analyse entière, pas à chaque tentative
  defaultClient ??= new Anthropic({ timeout: ANALYSIS_TIMEOUT_MS, maxRetries: 0 });
  return defaultClient;
}

/** Appels en cours, pour ignorer un double clic pendant l'analyse. */
const inFlight = new Set<string>();

export type AnalysisDeps = { client?: MessagesClient; model?: string; now?: () => Date };

export async function runContactAnalysis(
  { contactId, userId }: { contactId: string; userId: string },
  deps: AnalysisDeps = {},
) {
  const now = deps.now?.() ?? new Date();
  const model = deps.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  if (!deps.client && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN && !process.env.ANTHROPIC_PROFILE) {
    throw new AnalysisError("Clé API Anthropic absente : renseignez ANTHROPIC_API_KEY dans .env", "config");
  }

  const last = await db.aiAnalysis.findFirst({
    where: { contactId, model: { not: "seed-demo" } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && now.getTime() - last.createdAt.getTime() < ANALYSIS_COOLDOWN_MS) {
    const retryAfter = Math.ceil((ANALYSIS_COOLDOWN_MS - (now.getTime() - last.createdAt.getTime())) / 1000);
    throw new AnalysisError(
      `Une analyse a déjà été faite il y a moins de 5 minutes. Réessayez dans ${Math.ceil(retryAfter / 60)} min.`,
      "rate_limited",
      retryAfter,
    );
  }
  if (inFlight.has(contactId)) throw new AnalysisError("Une analyse est déjà en cours pour ce contact", "busy");
  inFlight.add(contactId);

  try {
    const [dossier, catalog] = await Promise.all([buildContactDossier(contactId, now), buildActiveCatalog(now)]);
    const client = deps.client ?? getClient();
    const caps = modelCapabilities(model);
    const today = now.toISOString().slice(0, 10);

    const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: 16000,
      system: [
        { type: "text", text: ANALYSIS_SYSTEM_PROMPT },
        { type: "text", text: buildCatalogBlock(JSON.stringify(catalog)), cache_control: { type: "ephemeral" } },
      ],
      tools: [
        {
          name: "save_analysis",
          description: "Enregistre l'analyse commerciale du contact dans le CRM. À appeler exactement une fois.",
          input_schema: saveAnalysisInputSchema as unknown as Anthropic.Beta.BetaTool.InputSchema,
          strict: true,
        },
      ],
      tool_choice: caps.forcedToolChoice
        ? { type: "tool", name: "save_analysis" }
        : { type: "auto", disable_parallel_tool_use: true },
      messages: [{ role: "user", content: buildAnalysisUserMessage(JSON.stringify(dossier), today) }],
      ...(caps.effort ? { output_config: { effort: "medium" as const } } : {}),
      ...(caps.serverFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    };

    const catalogNames = new Map(catalog.map((t) => [t.trip_id, t.nom]));
    const started = Date.now();
    let parsed: ParsedAnalysis | null = null;
    let message: Anthropic.Beta.BetaMessage | null = null;
    // En mode "auto", Claude peut exceptionnellement répondre sans appeler l'outil :
    // on retente une fois s'il reste assez de temps dans le budget de 60 s.
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      const remaining = ANALYSIS_TIMEOUT_MS - (Date.now() - started);
      if (attempt > 0 && remaining < 25_000) break;
      message = await callClaude(client, params, remaining);
      try {
        parsed = parseAnalysisMessage(message, catalogNames);
      } catch (err) {
        if (!(err instanceof AnalysisError && err.code === "no_tool_call") || attempt === 1) throw err;
      }
    }
    if (!parsed || !message) throw new AnalysisError("Claude n'a pas renvoyé d'analyse exploitable", "invalid_output");

    const usage = message.usage;
    const inputTokens =
      usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);

    const [analysis] = await db.$transaction([
      db.aiAnalysis.create({
        data: {
          contactId,
          score: parsed.result.score,
          level: parsed.level,
          summary: parsed.result.summary,
          resultJson: {
            ...parsed.result,
            _meta: {
              warnings: parsed.warnings,
              served_by: message.model,
              cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
              duration_ms: Date.now() - started,
            },
          },
          model: message.model,
          inputTokens,
          outputTokens: usage.output_tokens,
          createdById: userId,
          createdAt: now,
        },
      }),
      db.contact.update({
        where: { id: contactId },
        data: { lastScore: parsed.result.score, lastScoreLevel: parsed.level, lastAnalyzedAt: now },
      }),
    ]);
    return analysis;
  } finally {
    inFlight.delete(contactId);
  }
}

async function callClaude(
  client: MessagesClient,
  params: Anthropic.Beta.MessageCreateParamsNonStreaming,
  timeoutMs: number,
): Promise<Anthropic.Beta.BetaMessage> {
  try {
    return await client.beta.messages.create(params, { timeout: timeoutMs, maxRetries: 0 });
  } catch (err) {
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      throw new AnalysisError("Claude n'a pas répondu dans le délai de 60 secondes", "timeout");
    }
    if (err instanceof Anthropic.AuthenticationError) {
      throw new AnalysisError("Clé API Anthropic invalide ou absente (ANTHROPIC_API_KEY)", "config");
    }
    if (err instanceof Anthropic.NotFoundError) {
      throw new AnalysisError(`Modèle inconnu : ${params.model} (ANTHROPIC_MODEL)`, "config");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new AnalysisError("Limite de débit de l'API Anthropic atteinte, réessayez dans un instant", "api");
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new AnalysisError("Impossible de joindre l'API Anthropic", "api");
    }
    if (err instanceof Anthropic.APIError) {
      throw new AnalysisError(`Erreur de l'API Anthropic (${err.status ?? "?"})`, "api");
    }
    if (err instanceof Anthropic.AnthropicError) {
      // Ex. aucun identifiant configuré
      throw new AnalysisError("Client Anthropic mal configuré : vérifiez ANTHROPIC_API_KEY", "config");
    }
    throw err;
  }
}
