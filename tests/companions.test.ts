import { describe, expect, it } from "vitest";
import { listCompanions, type BookingWithParticipants } from "@/lib/domain/companions";

const person = (id: string, firstName: string, lastName: string) => ({
  id,
  firstName,
  lastName,
  birthDate: null,
  gender: null,
});

const philippe = person("philippe", "Philippe", "Garnier");
const nathalie = person("nathalie", "Nathalie", "Garnier");
const laurent = person("laurent", "Laurent", "Petit");
const marc = person("marc", "Marc", "Rousseau");

function booking(id: string, tripName: string, start: string, people: (typeof philippe)[], status: BookingWithParticipants["status"] = "solde"): BookingWithParticipants {
  return {
    bookingId: id,
    status,
    tripName,
    startDate: new Date(start),
    participants: people.map((contact, i) => ({ role: i === 1 && contact === nathalie ? "passager" : "pilote", contact })),
  };
}

describe("listCompanions", () => {
  const bookings = [
    booking("maroc", "Maroc", "2025-03-22", [philippe, nathalie]),
    booking("rajasthan", "Rajasthan", "2025-11-07", [philippe, nathalie, laurent]),
    booking("alpes", "Alpes", "2026-07-10", [philippe, nathalie]),
  ];

  it("liste les autres participants des réservations, sans le contact lui-même", () => {
    const ids = listCompanions("philippe", bookings).map((c) => c.id);
    expect(ids).toEqual(["nathalie", "laurent"]);
  });

  it("agrège les séjours partagés, du plus récent au plus ancien", () => {
    const [nat, lau] = listCompanions("philippe", bookings);
    expect(nat.sharedTrips.map((t) => t.tripName)).toEqual(["Alpes", "Rajasthan", "Maroc"]);
    expect(nat.sharedTrips[0].role).toBe("passager");
    expect(lau.sharedTrips.map((t) => t.tripName)).toEqual(["Rajasthan"]);
  });

  it("trie par nombre de séjours partagés puis par nom", () => {
    const list = listCompanions("philippe", [
      booking("b1", "A", "2025-01-01", [philippe, marc]),
      booking("b2", "B", "2025-02-01", [philippe, laurent]),
      booking("b3", "C", "2025-03-01", [philippe, laurent]),
    ]);
    expect(list.map((c) => c.id)).toEqual(["laurent", "marc"]);
  });

  it("ignore les réservations annulées", () => {
    const list = listCompanions("philippe", [booking("x", "Ladakh", "2025-06-01", [philippe, marc], "annule")]);
    expect(list).toEqual([]);
  });

  it("ignore les réservations auxquelles le contact ne participe pas", () => {
    const list = listCompanions("philippe", [booking("x", "Mongolie", "2025-07-01", [marc, laurent])]);
    expect(list).toEqual([]);
  });

  it("reporte le lien de parenté / amitié", () => {
    const list = listCompanions("philippe", bookings, [
      { otherContactId: "nathalie", relation: "conjoint" },
      { otherContactId: "laurent", relation: "ami" },
    ]);
    expect(list.map((c) => [c.id, c.relation])).toEqual([
      ["nathalie", "conjoint"],
      ["laurent", "ami"],
    ]);
  });

  it("met un lien null quand aucune relation n'est connue", () => {
    expect(listCompanions("philippe", bookings).every((c) => c.relation === null)).toBe(true);
  });

  it("fonctionne depuis la fiche d'un compagnon (symétrie)", () => {
    const list = listCompanions("laurent", bookings);
    expect(list.map((c) => c.id).sort()).toEqual(["nathalie", "philippe"]);
    expect(list.every((c) => c.sharedTrips.length === 1)).toBe(true);
  });
});
