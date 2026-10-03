import "server-only";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import type { DepartureOption } from "@/components/bookings/booking-form";

/** Départs proposables : à venir et non annulés, plus le départ courant d'une réservation éditée. */
export async function listBookableDepartures(includeId?: string): Promise<DepartureOption[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deps = await db.departure.findMany({
    where: {
      OR: [
        { startDate: { gte: today }, status: { notIn: ["annule", "termine"] }, trip: { active: true } },
        ...(includeId ? [{ id: includeId }] : []),
      ],
    },
    orderBy: [{ trip: { name: "asc" } }, { startDate: "asc" }],
    include: { trip: { select: { name: true } } },
  });
  return deps.map((d) => ({
    id: d.id,
    tripName: d.trip.name,
    startDate: d.startDate.toISOString(),
    price: toNumber(d.price),
    seatsLeft: d.seatsLeft,
    status: d.status,
  }));
}
