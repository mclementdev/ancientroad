import "server-only";
import { db } from "@/lib/db";
import { computeContactStats } from "@/lib/domain/contact-stats";
import { listCompanions } from "@/lib/domain/companions";
import { toNumber } from "@/lib/format";

const participantContact = {
  select: { id: true, firstName: true, lastName: true, birthDate: true, gender: true },
} as const;

/** Tout ce qu'affiche la fiche client, en une passe. */
export async function getContactFile(id: string) {
  const contact = await db.contact.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      participations: {
        include: {
          booking: {
            include: {
              departure: { include: { trip: { select: { id: true, name: true, destination: true } } } },
              participants: { include: { contact: participantContact } },
              payer: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
      bookingsPaid: { select: { status: true, totalAmount: true } },
      relationships: { include: { relatedContact: participantContact } },
      relatedTo: { include: { contact: participantContact } },
      interests: {
        orderBy: { createdAt: "desc" },
        include: { trip: { select: { id: true, name: true, destination: true } } },
      },
      interactions: {
        orderBy: { occurredAt: "desc" },
        take: 100,
        include: { user: { select: { name: true } } },
      },
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { createdBy: { select: { name: true } } },
      },
      tasks: {
        where: { doneAt: null },
        orderBy: { dueAt: "asc" },
        include: { assignedUser: { select: { name: true } } },
      },
    },
  });
  if (!contact) return null;

  const bookings = contact.participations
    .map((p) => p.booking)
    .sort((a, b) => b.departure.startDate.getTime() - a.departure.startDate.getTime());

  const stats = computeContactStats({
    birthDate: contact.birthDate,
    paidBookings: contact.bookingsPaid,
    participations: contact.participations.map((p) => ({
      bookingId: p.bookingId,
      status: p.booking.status,
      startDate: p.booking.departure.startDate,
      tripName: p.booking.departure.trip.name,
    })),
    lastContactAt: contact.lastInteractionAt,
  });

  // Un lien (A → B, « enfant ») se lit « B est l'enfant de A ».
  // Vu depuis la fiche de B, il est inversé : « A est le parent de B ».
  const relations = [
    ...contact.relationships.map((r) => ({ other: r.relatedContact, relation: r.relation })),
    ...contact.relatedTo.map((r) => ({
      other: r.contact,
      relation: r.relation === "parent" ? ("enfant" as const) : r.relation === "enfant" ? ("parent" as const) : r.relation,
    })),
  ];
  const companions = listCompanions(
    contact.id,
    bookings.map((b) => ({
      bookingId: b.id,
      status: b.status,
      tripName: b.departure.trip.name,
      startDate: b.departure.startDate,
      participants: b.participants.map((p) => ({ role: p.role, contact: p.contact })),
    })),
    relations.map((r) => ({ otherContactId: r.other.id, relation: r.relation })),
  );
  // Proches liés sans voyage commun : affichés aussi dans le bloc Compagnons
  const companionIds = new Set(companions.map((c) => c.id));
  const relativesWithoutTrips = relations
    .filter((r) => !companionIds.has(r.other.id))
    .map((r) => ({ ...r.other, relation: r.relation, sharedTrips: [] }));

  return {
    contact,
    stats,
    bookings: bookings.map((b) => ({
      id: b.id,
      status: b.status,
      totalAmount: toNumber(b.totalAmount),
      currency: b.currency,
      bookedAt: b.bookedAt,
      isPayer: b.payerContactId === contact.id,
      payer: b.payer,
      tripId: b.departure.trip.id,
      tripName: b.departure.trip.name,
      destination: b.departure.trip.destination,
      startDate: b.departure.startDate,
      endDate: b.departure.endDate,
      role: b.participants.find((p) => p.contactId === contact.id)?.role ?? null,
      participantCount: b.participants.length,
    })),
    companions: [...companions, ...relativesWithoutTrips],
  };
}

export type ContactFile = NonNullable<Awaited<ReturnType<typeof getContactFile>>>;
