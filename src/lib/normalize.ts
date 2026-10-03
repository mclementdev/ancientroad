import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/** Email normalisé : trim + minuscules. Renvoie null si vide. */
export function normalizeEmail(input: string | null | undefined): string | null {
  const value = input?.trim().toLowerCase();
  return value ? value : null;
}

/**
 * Téléphone au format E.164 (+33612345678). Les numéros sans indicatif
 * sont interprétés dans le pays par défaut (France).
 * Renvoie null si vide ou invalide.
 */
export function normalizePhone(
  input: string | null | undefined,
  defaultCountry: CountryCode = "FR",
): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw.startsWith("00") ? `+${raw.slice(2)}` : raw, defaultCountry);
  return parsed?.isValid() ? parsed.number : null;
}

/** Affichage lisible d'un numéro E.164. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}
