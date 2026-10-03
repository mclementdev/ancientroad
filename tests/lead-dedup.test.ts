import { describe, expect, it, vi } from "vitest";
import { findMatchingContact, type ContactLookup } from "@/lib/domain/lead-dedup";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";

/** Annuaire en mémoire : emails normalisés et téléphones E.164 (mobile ou fixe). */
function fakeLookup(contacts: { id: string; email?: string; phones?: string[] }[]): ContactLookup {
  return {
    findIdByEmail: vi.fn(async (email: string) => contacts.find((c) => c.email === email)?.id ?? null),
    findIdByPhone: vi.fn(async (phone: string) => contacts.find((c) => c.phones?.includes(phone))?.id ?? null),
  };
}

const directory = [
  { id: "philippe", email: "philippe.garnier@example.com", phones: ["+33612345611"] },
  { id: "nathalie", email: "nathalie.garnier@example.com", phones: ["+33612345612", "+33450123412"] },
  { id: "sans-email", phones: ["+33698765432"] },
];

describe("normalisation", () => {
  it("normalise l'email (trim + minuscules)", () => {
    expect(normalizeEmail("  Philippe.GARNIER@Example.com ")).toBe("philippe.garnier@example.com");
    expect(normalizeEmail("   ")).toBeNull();
  });

  it("convertit les numéros français en E.164", () => {
    expect(normalizePhone("06 12 34 56 11")).toBe("+33612345611");
    expect(normalizePhone("06.12.34.56.11")).toBe("+33612345611");
    expect(normalizePhone("0033 6 12 34 56 11")).toBe("+33612345611");
    expect(normalizePhone("+41 79 123 45 11")).toBe("+41791234511");
  });

  it("rejette les numéros invalides", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("findMatchingContact", () => {
  it("trouve par email, quelle que soit la casse", async () => {
    const lookup = fakeLookup(directory);
    await expect(findMatchingContact(lookup, { email: "PHILIPPE.Garnier@example.com" })).resolves.toEqual({
      contactId: "philippe",
      matchedOn: "email",
    });
  });

  it("donne la priorité à l'email sur le téléphone", async () => {
    const lookup = fakeLookup(directory);
    // email de Philippe, téléphone de Nathalie : l'email l'emporte
    const match = await findMatchingContact(lookup, { email: "philippe.garnier@example.com", phone: "06 12 34 56 12" });
    expect(match).toEqual({ contactId: "philippe", matchedOn: "email" });
    expect(lookup.findIdByPhone).not.toHaveBeenCalled();
  });

  it("se rabat sur le téléphone si l'email est inconnu", async () => {
    const lookup = fakeLookup(directory);
    const match = await findMatchingContact(lookup, { email: "nouvelle.adresse@example.com", phone: "06 12 34 56 12" });
    expect(match).toEqual({ contactId: "nathalie", matchedOn: "phone" });
  });

  it("reconnaît un numéro fixe", async () => {
    const lookup = fakeLookup(directory);
    await expect(findMatchingContact(lookup, { phone: "04 50 12 34 12" })).resolves.toEqual({
      contactId: "nathalie",
      matchedOn: "phone",
    });
  });

  it("interroge l'annuaire avec les valeurs normalisées", async () => {
    const lookup = fakeLookup(directory);
    await findMatchingContact(lookup, { email: " Inconnu@Example.com", phone: "06 98 76 54 32" });
    expect(lookup.findIdByEmail).toHaveBeenCalledWith("inconnu@example.com");
    expect(lookup.findIdByPhone).toHaveBeenCalledWith("+33698765432");
  });

  it("renvoie null si rien ne correspond", async () => {
    const lookup = fakeLookup(directory);
    await expect(findMatchingContact(lookup, { email: "x@example.com", phone: "07 11 22 33 44" })).resolves.toBeNull();
  });

  it("ignore un téléphone invalide sans interroger l'annuaire", async () => {
    const lookup = fakeLookup(directory);
    await expect(findMatchingContact(lookup, { phone: "12" })).resolves.toBeNull();
    expect(lookup.findIdByPhone).not.toHaveBeenCalled();
  });

  it("renvoie null sans email ni téléphone", async () => {
    const lookup = fakeLookup(directory);
    await expect(findMatchingContact(lookup, {})).resolves.toBeNull();
  });
});
