import type { BookingStatus } from "@/generated/prisma/enums";
import { toNumber } from "@/lib/format";

/** Statuts qui comptent dans le chiffre d'affaires (les options et annulations sont exclues). */
export const REVENUE_STATUSES: BookingStatus[] = ["confirme", "solde"];

type Money = number | string | { toString(): string };

export type PaidBooking = { status: BookingStatus; totalAmount: Money };
export type Participation = {
  bookingId: string;
  status: BookingStatus;
  startDate: Date;
  tripName: string;
};

export type ContactStats = {
  age: number | null;
  tripCount: number;
  bookingCount: number;
  revenueTotal: number;
  averageBasket: number | null;
  lastTrip: { tripName: string; startDate: Date } | null;
  lastContactAt: Date | null;
};

export function computeAge(birthDate: Date | null | undefined, now = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  let age = now.getFullYear() - b.getUTCFullYear();
  const m = now.getMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getUTCDate())) age--;
  return age;
}

/**
 * CA total = Σ montant des réservations PAYÉES par le contact, au statut confirmé ou soldé.
 * Panier moyen = CA total / nombre de ces réservations (null s'il n'y en a aucune).
 */
export function computeRevenue(paidBookings: PaidBooking[]): {
  revenueTotal: number;
  bookingCount: number;
  averageBasket: number | null;
} {
  const counted = paidBookings.filter((b) => REVENUE_STATUSES.includes(b.status));
  // Calcul en centimes pour éviter les erreurs d'arrondi flottant
  const cents = counted.reduce((sum, b) => sum + Math.round(toNumber(b.totalAmount) * 100), 0);
  const revenueTotal = cents / 100;
  return {
    revenueTotal,
    bookingCount: counted.length,
    averageBasket: counted.length ? Math.round(cents / counted.length) / 100 : null,
  };
}

/**
 * Nombre de voyages = réservations non annulées où le contact est participant.
 * Dernier voyage = départ le plus récent déjà commencé.
 */
export function computeTrips(participations: Participation[], now = new Date()) {
  const valid = participations.filter((p) => p.status !== "annule");
  const tripCount = new Set(valid.map((p) => p.bookingId)).size;
  const past = valid
    .filter((p) => p.startDate <= now)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  const lastTrip = past[0] ? { tripName: past[0].tripName, startDate: past[0].startDate } : null;
  return { tripCount, lastTrip };
}

export function computeContactStats(input: {
  birthDate: Date | null;
  paidBookings: PaidBooking[];
  participations: Participation[];
  lastContactAt: Date | null;
  now?: Date;
}): ContactStats {
  const now = input.now ?? new Date();
  return {
    age: computeAge(input.birthDate, now),
    ...computeRevenue(input.paidBookings),
    ...computeTrips(input.participations, now),
    lastContactAt: input.lastContactAt,
  };
}
