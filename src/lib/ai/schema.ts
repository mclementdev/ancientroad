import { z } from "zod";
import type { AiLevel } from "@/generated/prisma/enums";

export const AI_LEVELS = ["Froid", "Tiède", "Chaud", "Prêt à réserver"] as const;
export const CHANNELS = ["telephone", "email", "sms", "rendez_vous"] as const;
export const PRIORITIES = ["haute", "moyenne", "basse"] as const;

/** Niveau imposé par la grille : 0-24 Froid, 25-49 Tiède, 50-74 Chaud, 75-100 Prêt à réserver. */
export function levelForScore(score: number): (typeof AI_LEVELS)[number] {
  if (score >= 75) return "Prêt à réserver";
  if (score >= 50) return "Chaud";
  if (score >= 25) return "Tiède";
  return "Froid";
}

export const levelToEnum: Record<(typeof AI_LEVELS)[number], AiLevel> = {
  Froid: "froid",
  Tiède: "tiede",
  Chaud: "chaud",
  "Prêt à réserver": "pret_a_reserver",
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");

/** Schéma de validation de la sortie de l'outil save_analysis. */
export const analysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: z.enum(AI_LEVELS),
  score_breakdown: z
    .array(
      z.object({
        dimension: z.string().min(1),
        points: z.number().int().min(-20).max(25),
        max: z.number().int().min(0).max(25),
        reason: z.string().min(1),
      }),
    )
    .min(1),
  summary: z.string().min(1),
  traveler_profile: z.object({
    motivations: z.array(z.string()),
    style: z.string(),
    budget_estimate: z.string(),
  }),
  recommended_trips: z.array(z.object({ trip_id: z.string(), name: z.string(), reason: z.string() })).max(5),
  next_actions: z
    .array(
      z.object({
        action: z.string().min(1),
        channel: z.enum(CHANNELS),
        deadline: isoDate,
        priority: z.enum(PRIORITIES),
      }),
    )
    .min(1),
  risks: z.array(z.string()),
  missing_info: z.array(z.string()),
  call_pitch: z.array(z.string()),
});

export type AnalysisResult = z.infer<typeof analysisSchema>;

const str = { type: "string" } as const;
const strArray = { type: "array", items: str } as const;

/**
 * input_schema de l'outil save_analysis, en JSON Schema compatible `strict: true`
 * (pas de bornes numériques ni de longueurs : elles sont vérifiées par Zod).
 */
export const saveAnalysisInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "score",
    "level",
    "score_breakdown",
    "summary",
    "traveler_profile",
    "recommended_trips",
    "next_actions",
    "risks",
    "missing_info",
    "call_pitch",
  ],
  properties: {
    score: { type: "integer", description: "Score total de 0 à 100, malus inclus" },
    level: { type: "string", enum: [...AI_LEVELS] },
    score_breakdown: {
      type: "array",
      description: "Une entrée par dimension de la grille, plus une entrée « Malus » (points négatifs) s'il y a lieu",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dimension", "points", "max", "reason"],
        properties: {
          dimension: str,
          points: { type: "integer" },
          max: { type: "integer" },
          reason: { type: "string", description: "Justification factuelle tirée du dossier" },
        },
      },
    },
    summary: { type: "string", description: "Synthèse en 2 à 4 phrases" },
    traveler_profile: {
      type: "object",
      additionalProperties: false,
      required: ["motivations", "style", "budget_estimate"],
      properties: { motivations: strArray, style: str, budget_estimate: str },
    },
    recommended_trips: {
      type: "array",
      description: "Au plus 3 séjours, uniquement des trip_id présents dans le catalogue fourni",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["trip_id", "name", "reason"],
        properties: { trip_id: str, name: str, reason: str },
      },
    },
    next_actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "channel", "deadline", "priority"],
        properties: {
          action: str,
          channel: { type: "string", enum: [...CHANNELS] },
          deadline: { type: "string", format: "date" },
          priority: { type: "string", enum: [...PRIORITIES] },
        },
      },
    },
    risks: strArray,
    missing_info: strArray,
    call_pitch: { ...strArray, description: "Phrases d'accroche pour le prochain appel" },
  },
} as const;
