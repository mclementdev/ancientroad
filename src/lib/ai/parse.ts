import type Anthropic from "@anthropic-ai/sdk";
import type { AiLevel } from "@/generated/prisma/enums";
import { analysisSchema, levelForScore, levelToEnum, type AnalysisResult } from "@/lib/ai/schema";

export type AnalysisErrorCode =
  | "timeout"
  | "rate_limited"
  | "busy"
  | "api"
  | "config"
  | "refusal"
  | "no_tool_call"
  | "invalid_output";

export class AnalysisError extends Error {
  constructor(
    message: string,
    public code: AnalysisErrorCode,
    public retryAfterSec?: number,
  ) {
    super(message);
  }
}

export type ParsedAnalysis = { result: AnalysisResult; level: AiLevel; warnings: string[] };

/**
 * Extrait et valide l'appel à save_analysis d'une réponse Messages.
 * Corrige ce qui peut l'être sans inventer (niveau recalculé depuis le score,
 * séjours hors catalogue écartés) et le signale dans `warnings`.
 */
export function parseAnalysisMessage(
  message: Pick<Anthropic.Beta.BetaMessage, "stop_reason" | "content">,
  catalog: Map<string, string>,
): ParsedAnalysis {
  if (message.stop_reason === "refusal") {
    throw new AnalysisError("Claude a refusé de traiter ce dossier", "refusal");
  }
  if (message.stop_reason === "max_tokens") {
    throw new AnalysisError("Réponse de Claude tronquée (limite de tokens atteinte)", "invalid_output");
  }
  const call = message.content.find(
    (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "save_analysis",
  );
  if (!call) throw new AnalysisError("Claude n'a pas appelé l'outil save_analysis", "no_tool_call");

  const input = typeof call.input === "string" ? safeJson(call.input) : call.input;
  const parsed = analysisSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AnalysisError(
      `Analyse invalide : ${first?.path.join(".") || "racine"} — ${first?.message ?? "format inattendu"}`,
      "invalid_output",
    );
  }

  const result = { ...parsed.data };
  const warnings: string[] = [];

  const expected = levelForScore(result.score);
  if (result.level !== expected) {
    warnings.push(`Niveau « ${result.level} » corrigé en « ${expected} » d'après le score ${result.score}`);
    result.level = expected;
  }

  const kept = result.recommended_trips.filter((t) => catalog.has(t.trip_id));
  if (kept.length !== result.recommended_trips.length) {
    warnings.push(`${result.recommended_trips.length - kept.length} séjour(s) hors catalogue écarté(s)`);
  }
  result.recommended_trips = kept.map((t) => ({ ...t, name: catalog.get(t.trip_id)! }));

  return { result, level: levelToEnum[result.level], warnings };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
