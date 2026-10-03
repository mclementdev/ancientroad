import { normalizeEmail, normalizePhone } from "@/lib/normalize";

export type DedupMatch = { contactId: string; matchedOn: "email" | "phone" };

/** Accès aux données nécessaire au dédoublonnage (injectable pour les tests). */
export interface ContactLookup {
  findIdByEmail(email: string): Promise<string | null>;
  findIdByPhone(phoneE164: string): Promise<string | null>;
}

/**
 * Cherche un contact existant : d'abord par email normalisé, puis par téléphone E.164
 * (mobile ou fixe). Renvoie null si aucun ne correspond.
 */
export async function findMatchingContact(
  lookup: ContactLookup,
  input: { email?: string | null; phone?: string | null },
): Promise<DedupMatch | null> {
  const email = normalizeEmail(input.email);
  if (email) {
    const id = await lookup.findIdByEmail(email);
    if (id) return { contactId: id, matchedOn: "email" };
  }
  const phone = normalizePhone(input.phone);
  if (phone) {
    const id = await lookup.findIdByPhone(phone);
    if (id) return { contactId: id, matchedOn: "phone" };
  }
  return null;
}
