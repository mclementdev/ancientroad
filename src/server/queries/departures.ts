import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Recalcule seats_left = seats_total − participants des réservations non annulées.
 * À appeler dans la transaction qui modifie une réservation ou la capacité d'un départ.
 */
export async function recomputeSeatsLeft(tx: Tx, departureId: string): Promise<number> {
  const [departure, taken] = await Promise.all([
    tx.departure.findUniqueOrThrow({ where: { id: departureId }, select: { seatsTotal: true } }),
    tx.bookingParticipant.count({
      where: { booking: { departureId, status: { not: "annule" } } },
    }),
  ]);
  const seatsLeft = departure.seatsTotal - taken;
  await tx.departure.update({ where: { id: departureId }, data: { seatsLeft } });
  return seatsLeft;
}
