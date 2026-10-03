import { beforeEach, describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";

// ───────────── Mocks : base de données et dossier ─────────────

const dbMock = vi.hoisted(() => ({
  aiAnalysis: { findFirst: vi.fn(), create: vi.fn() },
  contact: { update: vi.fn() },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/lib/ai/dossier", () => ({
  buildContactDossier: vi.fn(async () => ({ identite: { prenom: "Philippe", age: 62 }, notes_libres: "Rêve d'Argentine" })),
  buildActiveCatalog: vi.fn(async () => [
    { trip_id: "trip_ruta40", nom: "Argentine : Ruta 40 & Patagonie", departs: [] },
    { trip_id: "trip_salta", nom: "Argentine : Nord-Ouest andin", departs: [] },
  ]),
}));

import { modelCapabilities, runContactAnalysis } from "@/lib/ai/analyze";
import { AnalysisError, parseAnalysisMessage } from "@/lib/ai/parse";
import { analysisSchema } from "@/lib/ai/schema";

// ───────────── Fixtures ─────────────

const validInput = {
  score: 82,
  level: "Prêt à réserver",
  score_breakdown: [
    { dimension: "Engagement récent", points: 22, max: 25, reason: "Appel entrant il y a 20 jours, relance il y a 5 jours" },
    { dimension: "Précision du projet", points: 23, max: 25, reason: "Ruta 40, printemps 2027, duo, budget 13 k€" },
    { dimension: "Signaux d'intention", points: 18, max: 20, reason: "Option posée" },
    { dimension: "Historique & fidélité", points: 14, max: 15, reason: "3 voyages soldés" },
    { dimension: "Adéquation profil / séjour", points: 13, max: 15, reason: "Pilote confirmé, permis A depuis 1985" },
    { dimension: "Malus", points: -8, max: 0, reason: "Dates de Nathalie non confirmées" },
  ],
  summary: "Client fidèle, option posée sur la Ruta 40 de février.",
  traveler_profile: { motivations: ["Grands espaces"], style: "Confort, hôtels", budget_estimate: "13 000 € pour deux" },
  recommended_trips: [{ trip_id: "trip_ruta40", name: "Ruta 40", reason: "Projet exprimé" }],
  next_actions: [{ action: "Rappeler pour confirmer l'option", channel: "telephone", deadline: "2026-10-06", priority: "haute" }],
  risks: ["Dates de retraite de Nathalie"],
  missing_info: ["Assurance annulation souhaitée ?"],
  call_pitch: ["Philippe, la Patagonie vous attend en février !"],
};

function message(input: unknown, overrides: Partial<Anthropic.Beta.BetaMessage> = {}): Anthropic.Beta.BetaMessage {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    stop_reason: "tool_use",
    stop_sequence: null,
    content: [{ type: "tool_use", id: "toolu_1", name: "save_analysis", input } as Anthropic.Beta.BetaToolUseBlock],
    usage: {
      input_tokens: 1200,
      output_tokens: 900,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 3000,
    } as Anthropic.Beta.BetaUsage,
    ...overrides,
  } as Anthropic.Beta.BetaMessage;
}

const catalog = new Map([
  ["trip_ruta40", "Argentine : Ruta 40 & Patagonie"],
  ["trip_salta", "Argentine : Nord-Ouest andin"],
]);

// ───────────── Validation du JSON (parseAnalysisMessage) ─────────────

describe("parseAnalysisMessage", () => {
  it("accepte une analyse conforme au schéma", () => {
    const parsed = parseAnalysisMessage(message(validInput), catalog);
    expect(parsed.result.score).toBe(82);
    expect(parsed.level).toBe("pret_a_reserver");
    expect(parsed.warnings).toEqual([]);
    expect(analysisSchema.safeParse(parsed.result).success).toBe(true);
  });

  it("reprend le nom exact du séjour depuis le catalogue", () => {
    const parsed = parseAnalysisMessage(message(validInput), catalog);
    expect(parsed.result.recommended_trips[0].name).toBe("Argentine : Ruta 40 & Patagonie");
  });

  it("écarte les séjours absents du catalogue", () => {
    const input = {
      ...validInput,
      recommended_trips: [...validInput.recommended_trips, { trip_id: "inventé", name: "Islande", reason: "?" }],
    };
    const parsed = parseAnalysisMessage(message(input), catalog);
    expect(parsed.result.recommended_trips.map((t) => t.trip_id)).toEqual(["trip_ruta40"]);
    expect(parsed.warnings[0]).toMatch(/hors catalogue/);
  });

  it("recale le niveau sur la grille quand il ne correspond pas au score", () => {
    const parsed = parseAnalysisMessage(message({ ...validInput, score: 60, level: "Prêt à réserver" }), catalog);
    expect(parsed.result.level).toBe("Chaud");
    expect(parsed.level).toBe("chaud");
    expect(parsed.warnings[0]).toMatch(/corrigé/);
  });

  it.each([
    ["score hors bornes", { ...validInput, score: 140 }],
    ["niveau inconnu", { ...validInput, level: "Brûlant" }],
    ["canal inconnu", { ...validInput, next_actions: [{ ...validInput.next_actions[0], channel: "pigeon" }] }],
    ["échéance non datée", { ...validInput, next_actions: [{ ...validInput.next_actions[0], deadline: "demain" }] }],
    ["aucune action", { ...validInput, next_actions: [] }],
    ["champ manquant", Object.fromEntries(Object.entries(validInput).filter(([key]) => key !== "summary"))],
  ])("rejette une sortie invalide (%s)", (_label, input) => {
    expect(() => parseAnalysisMessage(message(input), catalog)).toThrow(AnalysisError);
    try {
      parseAnalysisMessage(message(input), catalog);
    } catch (e) {
      expect((e as AnalysisError).code).toBe("invalid_output");
    }
  });

  it("signale l'absence d'appel à l'outil", () => {
    const m = message(validInput, { stop_reason: "end_turn", content: [{ type: "text", text: "Voici mon analyse…", citations: null }] as Anthropic.Beta.BetaContentBlock[] });
    expect(() => parseAnalysisMessage(m, catalog)).toThrow(expect.objectContaining({ code: "no_tool_call" }));
  });

  it("gère un refus", () => {
    const m = message(validInput, { stop_reason: "refusal", content: [] });
    expect(() => parseAnalysisMessage(m, catalog)).toThrow(expect.objectContaining({ code: "refusal" }));
  });

  it("gère une réponse tronquée", () => {
    expect(() => parseAnalysisMessage(message(validInput, { stop_reason: "max_tokens" }), catalog)).toThrow(
      expect.objectContaining({ code: "invalid_output" }),
    );
  });
});

// ───────────── Orchestration (client Claude mocké) ─────────────

describe("runContactAnalysis", () => {
  const now = new Date("2026-10-03T08:00:00Z");
  let create: ReturnType<typeof vi.fn>;
  const client = () => ({ beta: { messages: { create } } }) as unknown as Pick<Anthropic, "beta">;

  beforeEach(() => {
    vi.clearAllMocks();
    create = vi.fn(async () => message(validInput));
    dbMock.aiAnalysis.findFirst.mockResolvedValue(null);
    dbMock.aiAnalysis.create.mockImplementation(async ({ data }) => ({ id: "ana_1", ...data }));
    dbMock.contact.update.mockResolvedValue({});
  });

  it("appelle Claude avec l'outil save_analysis strict et enregistre le résultat avec les tokens", async () => {
    const analysis = await runContactAnalysis(
      { contactId: "c1", userId: "u1" },
      { client: client(), model: "claude-opus-5-5", now: () => now },
    );

    const [params, options] = create.mock.calls[0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.tools[0]).toMatchObject({ name: "save_analysis", strict: true });
    expect(params.tools[0].input_schema.additionalProperties).toBe(false);
    // Opus 5.5 refuse le tool_choice forcé : auto + une seule invocation
    expect(params.tool_choice).toEqual({ type: "auto", disable_parallel_tool_use: true });
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(params.system[1].cache_control).toEqual({ type: "ephemeral" });
    expect(params.messages[0].content).toContain("Date du jour : 2026-10-03");
    expect(options.timeout).toBeLessThanOrEqual(60_000);

    expect(analysis.score).toBe(82);
    expect(dbMock.aiAnalysis.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: "c1",
        score: 82,
        level: "pret_a_reserver",
        model: "claude-opus-5-5",
        inputTokens: 4200, // 1200 + 3000 lus en cache
        outputTokens: 900,
        createdById: "u1",
      }),
    });
    expect(dbMock.contact.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { lastScore: 82, lastScoreLevel: "pret_a_reserver", lastAnalyzedAt: now },
    });
  });

  it("force l'outil sur les modèles qui l'acceptent", async () => {
    await runContactAnalysis({ contactId: "c1", userId: "u1" }, { client: client(), model: "claude-opus-4-8", now: () => now });
    const [params] = create.mock.calls[0];
    expect(params.tool_choice).toEqual({ type: "tool", name: "save_analysis" });
    expect(params.fallbacks).toBeUndefined();
  });

  it("refuse une nouvelle analyse moins de 5 minutes après la précédente", async () => {
    dbMock.aiAnalysis.findFirst.mockResolvedValue({ createdAt: new Date(now.getTime() - 2 * 60_000) });
    await expect(
      runContactAnalysis({ contactId: "c1", userId: "u1" }, { client: client(), now: () => now }),
    ).rejects.toMatchObject({ code: "rate_limited", retryAfterSec: 180 });
    expect(create).not.toHaveBeenCalled();
  });

  it("autorise une analyse après 5 minutes", async () => {
    dbMock.aiAnalysis.findFirst.mockResolvedValue({ createdAt: new Date(now.getTime() - 6 * 60_000) });
    await expect(runContactAnalysis({ contactId: "c1", userId: "u1" }, { client: client(), now: () => now })).resolves.toBeDefined();
  });

  it("retente une fois si Claude n'appelle pas l'outil", async () => {
    create
      .mockResolvedValueOnce(message(null, { stop_reason: "end_turn", content: [{ type: "text", text: "…", citations: null }] as Anthropic.Beta.BetaContentBlock[] }))
      .mockResolvedValueOnce(message(validInput));
    await runContactAnalysis({ contactId: "c1", userId: "u1" }, { client: client(), now: () => now });
    expect(create).toHaveBeenCalledTimes(2);
    expect(dbMock.aiAnalysis.create).toHaveBeenCalledOnce();
  });

  it("n'enregistre rien si la sortie est invalide", async () => {
    create.mockResolvedValue(message({ ...validInput, score: "beaucoup" }));
    await expect(runContactAnalysis({ contactId: "c1", userId: "u1" }, { client: client(), now: () => now })).rejects.toMatchObject({
      code: "invalid_output",
    });
    expect(dbMock.aiAnalysis.create).not.toHaveBeenCalled();
  });

  it("traduit le dépassement du délai en erreur « timeout »", async () => {
    create.mockRejectedValue(new Anthropic.APIConnectionTimeoutError());
    await expect(runContactAnalysis({ contactId: "c1", userId: "u1" }, { client: client(), now: () => now })).rejects.toMatchObject({
      code: "timeout",
    });
  });

  it("libère le verrou après une erreur (le bouton Réessayer fonctionne)", async () => {
    create.mockRejectedValueOnce(new Anthropic.APIConnectionTimeoutError()).mockResolvedValueOnce(message(validInput));
    await expect(runContactAnalysis({ contactId: "c1", userId: "u1" }, { client: client(), now: () => now })).rejects.toBeDefined();
    await expect(runContactAnalysis({ contactId: "c1", userId: "u1" }, { client: client(), now: () => now })).resolves.toBeDefined();
  });
});

describe("modelCapabilities", () => {
  it.each([
    ["claude-opus-5-5", { forcedToolChoice: false, effort: true, serverFallback: true }],
    ["claude-sonnet-5-5", { forcedToolChoice: false, effort: true, serverFallback: true }],
    ["claude-opus-4-8", { forcedToolChoice: true, effort: true, serverFallback: false }],
    ["claude-haiku-4-5", { forcedToolChoice: true, effort: false, serverFallback: false }],
  ])("%s", (model, expected) => {
    expect(modelCapabilities(model)).toEqual(expected);
  });
});
