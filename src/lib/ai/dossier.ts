import "server-only";
import { db } from "@/lib/db";
import { computeAge, computeRevenue } from "@/lib/domain/contact-stats";
import { listCompanions } from "@/lib/domain/companions";
import { toNumber } from "@/lib/format";

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * Dossier JSON transmis à Claude. Volontairement minimal sur les données personnelles :
 * ni adresse postale, ni téléphones, ni email (seulement leur présence, utile pour le canal).
 * Compagnons : prénom, âge et lien uniquement.
 */
export async function buildContactDossier(contactId: string, now = new Date()) {
  const c = await db.contact.findUniqueOrThrow({
    where: { id: contactId },
    include: {
      owner: { select: { name: true } },
      bookingsPaid: { select: { status: true, totalAmount: true } },
      participations: {
        include: {
          booking: {
            include: {
              departure: { include: { trip: { select: { id: true, name: true, destination: true, format: true } } } },
              participants: {
                include: { contact: { select: { id: true, firstName: true, lastName: true, birthDate: true, gender: true } } },
              },
            },
          },
        },
      },
      relationships: { include: { relatedContact: { select: { id: true, firstName: true, lastName: true, birthDate: true, gender: true } } } },
      relatedTo: { include: { contact: { select: { id: true, firstName: true, lastName: true, birthDate: true, gender: true } } } },
      interests: { orderBy: { createdAt: "desc" }, include: { trip: { select: { id: true, name: true } } } },
      interactions: { orderBy: { occurredAt: "desc" }, take: 50 },
      leads: { orderBy: { createdAt: "desc" }, take: 5, include: { trip: { select: { name: true } } } },
      tasks: { where: { doneAt: null }, orderBy: { dueAt: "asc" }, take: 5 },
    },
  });

  const relations = [
    ...c.relationships.map((r) => ({ otherContactId: r.relatedContactId, relation: r.relation })),
    ...c.relatedTo.map((r) => ({
      otherContactId: r.contactId,
      relation: r.relation === "parent" ? ("enfant" as const) : r.relation === "enfant" ? ("parent" as const) : r.relation,
    })),
  ];
  const bookings = c.participations.map((p) => p.booking);
  const companions = listCompanions(
    c.id,
    bookings.map((b) => ({
      bookingId: b.id,
      status: b.status,
      tripName: b.departure.trip.name,
      startDate: b.departure.startDate,
      participants: b.participants.map((p) => ({ role: p.role, contact: p.contact })),
    })),
    relations,
  );
  const companionIds = new Set(companions.map((x) => x.id));
  const relatives = [
    ...c.relationships.map((r) => ({ ...r.relatedContact, relation: r.relation })),
    ...c.relatedTo.map((r) => ({ ...r.contact, relation: relations.find((x) => x.otherContactId === r.contactId)!.relation })),
  ].filter((r) => !companionIds.has(r.id));

  const revenue = computeRevenue(c.bookingsPaid);

  return {
    identite: {
      civilite: c.gender,
      prenom: c.firstName,
      nom: c.lastName,
      age: computeAge(c.birthDate, now),
      ville: c.city,
      pays: c.country,
      langue: c.language,
      statut: c.status,
      conseiller: c.owner?.name ?? null,
      client_depuis: day(c.createdAt),
      a_un_email: Boolean(c.email),
      a_un_telephone: Boolean(c.phoneMobile || c.phoneHome),
    },
    consentements: {
      newsletter: c.newsletterOptin,
      sms: c.smsOptin,
      date: day(c.consentDate),
    },
    profil_rider: {
      role: c.riderRole,
      permis: c.licenseType,
      permis_depuis: day(c.licenseDate),
      niveau: c.ridingLevel,
      taille_cm: c.heightCm,
      regime: c.diet,
    },
    chiffres: {
      ca_total_eur: revenue.revenueTotal,
      nombre_reservations_payees: revenue.bookingCount,
      panier_moyen_eur: revenue.averageBasket,
    },
    sejours_achetes: c.participations
      .map((p) => ({
        sejour: p.booking.departure.trip.name,
        trip_id: p.booking.departure.trip.id,
        destination: p.booking.departure.trip.destination,
        depart: day(p.booking.departure.startDate),
        retour: day(p.booking.departure.endDate),
        statut_reservation: p.booking.status,
        role: p.role,
        payeur: p.booking.payerContactId === c.id,
        montant_total_eur: p.booking.payerContactId === c.id ? toNumber(p.booking.totalAmount) : undefined,
        nb_participants: p.booking.participants.length,
        reservee_le: day(p.booking.bookedAt),
      }))
      .sort((a, b) => (a.depart! < b.depart! ? 1 : -1)),
    interets: c.interests.map((i) => ({
      sejour: i.trip?.name ?? null,
      trip_id: i.trip?.id ?? null,
      destination: i.destination,
      niveau: i.level,
      source: i.source,
      periode: i.periodWanted,
      budget_eur: i.budget === null ? null : toNumber(i.budget),
      date: day(i.createdAt),
    })),
    compagnons: [
      ...companions.map((x) => ({
        prenom: x.firstName,
        age: computeAge(x.birthDate, now),
        lien: x.relation,
        sejours_partages: x.sharedTrips.length,
      })),
      ...relatives.map((x) => ({ prenom: x.firstName, age: computeAge(x.birthDate, now), lien: x.relation, sejours_partages: 0 })),
    ],
    leads_recents: c.leads.map((l) => ({
      canal: l.channel,
      statut: l.status,
      sejour: l.trip?.name ?? null,
      motif_perte: l.lostReason,
      message: l.message,
      date: day(l.createdAt),
    })),
    taches_ouvertes: c.tasks.map((t) => ({ type: t.type, titre: t.title, echeance: day(t.dueAt) })),
    interactions_recentes: c.interactions.map((i) => ({
      date: i.occurredAt.toISOString().slice(0, 16),
      type: i.type,
      sens: i.direction,
      objet: i.subject,
      resume: i.summary,
      meta: i.metadata ?? undefined,
    })),
    notes_libres: c.freeNotes,
  };
}

/** Catalogue des séjours actifs avec leurs départs à venir (ordre stable pour le cache). */
export async function buildActiveCatalog(now = new Date()) {
  const trips = await db.trip.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
    include: {
      departures: {
        where: { startDate: { gte: now }, status: { in: ["ouvert", "garanti", "complet"] } },
        orderBy: { startDate: "asc" },
      },
    },
  });
  return trips.map((t) => ({
    trip_id: t.id,
    nom: t.name,
    destination: t.destination,
    region: t.region,
    pays: t.country,
    duree_jours: t.durationDays,
    niveau_requis: t.level,
    format: t.format,
    moto: t.motorcycleModel,
    prix_base_eur: toNumber(t.basePrice),
    description: t.description,
    departs: t.departures.map((d) => ({
      debut: day(d.startDate),
      fin: day(d.endDate),
      prix_eur: toNumber(d.price),
      places_restantes: d.seatsLeft,
      statut: d.status,
    })),
  }));
}
