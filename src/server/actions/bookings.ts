"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { assertUser } from "@/lib/session";
import { runAction, UserFacingError, type ActionState } from "@/lib/action";
import { recomputeSeatsLeft } from "@/server/queries/departures";

const bookingSchema = z
  .object({
    departureId: z.string().min(1, "Choisissez un départ"),
    payerContactId: z.string().min(1, "Choisissez le payeur"),
    status: z.enum(["option", "confirme", "solde", "annule"]),
    participants: z
      .array(
        z.object({
          contactId: z.string().min(1, "Participant à choisir"),
          role: z.enum(["pilote", "passager"]),
          amount: z.coerce.number().nonnegative("Montant invalide"),
        }),
      )
      .min(1, "Au moins un participant"),
  })
  .refine((d) => new Set(d.participants.map((p) => p.contactId)).size === d.participants.length, {
    path: ["participants"],
    message: "Un même contact ne peut figurer deux fois",
  })
  .refine((d) => d.participants.filter((p) => p.role === "passager").length <= d.participants.filter((p) => p.role === "pilote").length, {
    path: ["participants"],
    message: "Chaque passager doit être accompagné d'un pilote",
  });

export type BookingInput = z.input<typeof bookingSchema>;

type Tx = Prisma.TransactionClient;

/** Ajuste le statut « complet » du départ selon les places restantes. */
async function syncDeparture(tx: Tx, departureId: string) {
  const seatsLeft = await recomputeSeatsLeft(tx, departureId);
  if (seatsLeft < 0) throw new UserFacingError(`Plus assez de places sur ce départ : il manque ${-seatsLeft} place(s)`);
  const dep = await tx.departure.findUniqueOrThrow({ where: { id: departureId }, select: { status: true } });
  if (seatsLeft === 0 && (dep.status === "ouvert" || dep.status === "garanti")) {
    await tx.departure.update({ where: { id: departureId }, data: { status: "complet" } });
  } else if (seatsLeft > 0 && dep.status === "complet") {
    await tx.departure.update({ where: { id: departureId }, data: { status: "ouvert" } });
  }
}

/** Un prospect (ou inactif) qui réserve devient client. */
async function promoteContacts(tx: Tx, contactIds: string[]) {
  await tx.contact.updateMany({
    where: { id: { in: contactIds }, status: { in: ["prospect", "inactif"] } },
    data: { status: "client" },
  });
}

function revalidateBooking(contactIds: string[], tripId?: string, bookingId?: string) {
  revalidatePath("/reservations");
  revalidatePath("/");
  if (bookingId) revalidatePath(`/reservations/${bookingId}`);
  if (tripId) revalidatePath(`/catalogue/${tripId}`);
  for (const id of contactIds) revalidatePath(`/contacts/${id}`);
}

export async function saveBookingAction(bookingId: string | null, input: BookingInput): Promise<ActionState> {
  return runAction(async () => {
    await assertUser();
    const data = bookingSchema.parse(input);
    const total = Math.round(data.participants.reduce((s, p) => s + p.amount, 0) * 100) / 100;

    const result = await db.$transaction(async (tx) => {
      const departure = await tx.departure.findUniqueOrThrow({ where: { id: data.departureId }, select: { tripId: true, status: true } });
      const previous = bookingId
        ? await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { participants: true } })
        : null;
      if (!previous && departure.status === "annule") throw new UserFacingError("Ce départ est annulé");

      let id: string;
      if (previous) {
        await tx.bookingParticipant.deleteMany({ where: { bookingId: previous.id } });
        await tx.booking.update({
          where: { id: previous.id },
          data: {
            departureId: data.departureId,
            payerContactId: data.payerContactId,
            status: data.status,
            totalAmount: total,
            participants: { create: data.participants },
          },
        });
        id = previous.id;
        if (previous.departureId !== data.departureId) await syncDeparture(tx, previous.departureId);
      } else {
        const created = await tx.booking.create({
          data: {
            departureId: data.departureId,
            payerContactId: data.payerContactId,
            status: data.status,
            totalAmount: total,
            participants: { create: data.participants },
          },
        });
        id = created.id;
      }
      await syncDeparture(tx, data.departureId);
      if (data.status !== "annule") {
        await promoteContacts(tx, [data.payerContactId, ...data.participants.map((p) => p.contactId)]);
      }
      const touched = new Set([
        data.payerContactId,
        ...data.participants.map((p) => p.contactId),
        ...(previous?.participants.map((p) => p.contactId) ?? []),
        ...(previous ? [previous.payerContactId] : []),
      ]);
      return { id, tripId: departure.tripId, touched: [...touched] };
    });

    revalidateBooking(result.touched, result.tripId, result.id);
    return { ok: true, id: result.id, message: bookingId ? "Réservation mise à jour" : "Réservation créée" };
  });
}
