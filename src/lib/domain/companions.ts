import type { BookingStatus, Gender, RelationType, RiderRole } from "@/generated/prisma/enums";

/** Une réservation du contact, avec tous ses participants. */
export type BookingWithParticipants = {
  bookingId: string;
  status: BookingStatus;
  tripName: string;
  startDate: Date;
  participants: {
    role: RiderRole;
    contact: {
      id: string;
      firstName: string;
      lastName: string;
      birthDate: Date | null;
      gender: Gender | null;
    };
  }[];
};

export type Relationship = { otherContactId: string; relation: RelationType };

export type Companion = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  gender: Gender | null;
  relation: RelationType | null;
  sharedTrips: { bookingId: string; tripName: string; startDate: Date; role: RiderRole }[];
};

/**
 * Compagnons de voyage = les autres participants des réservations (non annulées)
 * auxquelles le contact a participé. Le lien vient de contact_relationships,
 * lu dans les deux sens. Triés par nombre de séjours partagés puis par nom.
 */
export function listCompanions(
  contactId: string,
  bookings: BookingWithParticipants[],
  relationships: Relationship[] = [],
): Companion[] {
  const relationByContact = new Map(relationships.map((r) => [r.otherContactId, r.relation]));
  const byId = new Map<string, Companion>();

  for (const booking of bookings) {
    if (booking.status === "annule") continue;
    if (!booking.participants.some((p) => p.contact.id === contactId)) continue;
    for (const p of booking.participants) {
      if (p.contact.id === contactId) continue;
      let companion = byId.get(p.contact.id);
      if (!companion) {
        companion = {
          ...p.contact,
          relation: relationByContact.get(p.contact.id) ?? null,
          sharedTrips: [],
        };
        byId.set(p.contact.id, companion);
      }
      if (!companion.sharedTrips.some((t) => t.bookingId === booking.bookingId)) {
        companion.sharedTrips.push({
          bookingId: booking.bookingId,
          tripName: booking.tripName,
          startDate: booking.startDate,
          role: p.role,
        });
      }
    }
  }

  for (const c of byId.values()) c.sharedTrips.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  return [...byId.values()].sort(
    (a, b) =>
      b.sharedTrips.length - a.sharedTrips.length ||
      a.lastName.localeCompare(b.lastName, "fr") ||
      a.firstName.localeCompare(b.firstName, "fr"),
  );
}
