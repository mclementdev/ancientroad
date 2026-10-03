import { z } from "zod";
import { AuthorizationError } from "@/lib/session";

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Identifiant éventuel de l'objet créé (pour redirection côté client). */
  id?: string;
} | null;

/** Convertit un FormData en objet ; les champs vides deviennent undefined. */
export function formToObject(formData: FormData): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const v = typeof value === "string" ? value.trim() : undefined;
    out[key] = v === "" ? undefined : v;
  }
  return out;
}

/** Exécute une action et transforme les erreurs connues en ActionState. */
export async function runAction(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        ok: false,
        message: "Certains champs sont invalides",
        fieldErrors: z.flattenError(err).fieldErrors as Record<string, string[]>,
      };
    }
    if (err instanceof AuthorizationError || err instanceof UserFacingError) {
      return { ok: false, message: err.message };
    }
    console.error(err);
    return { ok: false, message: "Une erreur inattendue est survenue" };
  }
}

/** Erreur dont le message peut être affiché tel quel à l'utilisateur. */
export class UserFacingError extends Error {}

// Helpers Zod pour les champs de formulaire (valeurs déjà « undefined si vide »)
export const zText = z.string().trim().max(5000);
export const zOptText = z.string().trim().max(5000).optional().transform((v) => v ?? null);
export const zOptDate = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Date invalide" });
      return z.NEVER;
    }
    return d;
  });
export const zOptInt = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v);
    if (!Number.isInteger(n)) {
      ctx.addIssue({ code: "custom", message: "Nombre entier attendu" });
      return z.NEVER;
    }
    return n;
  });
export const zOptMoney = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Montant invalide" });
      return z.NEVER;
    }
    return n;
  });
export const zCheckbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");
