"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { canManageCatalog } from "@/lib/permissions";
import { assertUser, AuthorizationError } from "@/lib/session";
import {
  formToObject,
  runAction,
  UserFacingError,
  zCheckbox,
  zOptText,
  type ActionState,
} from "@/lib/action";
import { recomputeSeatsLeft } from "@/server/queries/departures";

async function assertCatalogManager() {
  const user = await assertUser();
  if (!canManageCatalog(user)) throw new AuthorizationError("Seuls les managers peuvent modifier le catalogue");
  return user;
}

const money = z.coerce.number({ error: "Montant requis" }).nonnegative("Montant invalide");

const tripSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  destination: z.string().min(2, "Destination requise"),
  country: z.string().length(2, "Code pays ISO à 2 lettres").transform((v) => v.toUpperCase()),
  region: zOptText,
  durationDays: z.coerce.number().int().min(1, "Durée invalide").max(60),
  level: z.enum(["debutant", "intermediaire", "confirme", "expert"]),
  format: z.enum(["guide", "liberte", "sur_mesure"]),
  motorcycleModel: zOptText,
  basePrice: money,
  description: zOptText,
  active: zCheckbox,
});

export async function saveTripAction(tripId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCatalogManager();
    const data = tripSchema.parse(formToObject(formData));
    const trip = tripId
      ? await db.trip.update({ where: { id: tripId }, data })
      : await db.trip.create({ data });
    revalidatePath("/catalogue");
    revalidatePath(`/catalogue/${trip.id}`);
    return { ok: true, message: tripId ? "Séjour mis à jour" : "Séjour créé", id: trip.id };
  });
}

export async function deleteTripAction(tripId: string): Promise<ActionState> {
  return runAction(async () => {
    await assertCatalogManager();
    const bookings = await db.booking.count({ where: { departure: { tripId } } });
    if (bookings > 0) {
      throw new UserFacingError("Ce séjour a des réservations : désactivez-le plutôt que de le supprimer");
    }
    await db.$transaction([
      db.departure.deleteMany({ where: { tripId } }),
      db.trip.delete({ where: { id: tripId } }),
    ]);
    revalidatePath("/catalogue");
    return { ok: true, message: "Séjour supprimé" };
  });
}

const departureSchema = z
  .object({
    startDate: z.coerce.date({ error: "Date de début requise" }),
    endDate: z.coerce.date({ error: "Date de fin requise" }),
    price: money,
    seatsTotal: z.coerce.number().int().min(1, "Au moins 1 place").max(100),
    status: z.enum(["ouvert", "garanti", "complet", "annule", "termine"]),
  })
  .refine((d) => d.endDate >= d.startDate, { path: ["endDate"], message: "La fin doit suivre le début" });

export async function saveDepartureAction(
  ids: { tripId: string; departureId: string | null },
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCatalogManager();
    const data = departureSchema.parse(formToObject(formData));
    await db.$transaction(async (tx) => {
      if (ids.departureId) {
        await tx.departure.update({ where: { id: ids.departureId }, data });
        await recomputeSeatsLeft(tx, ids.departureId);
      } else {
        await tx.departure.create({ data: { ...data, tripId: ids.tripId, seatsLeft: data.seatsTotal } });
      }
    });
    revalidatePath(`/catalogue/${ids.tripId}`);
    revalidatePath("/catalogue");
    return { ok: true, message: ids.departureId ? "Départ mis à jour" : "Départ ajouté" };
  });
}

export async function deleteDepartureAction(departureId: string): Promise<ActionState> {
  return runAction(async () => {
    await assertCatalogManager();
    const dep = await db.departure.findUniqueOrThrow({
      where: { id: departureId },
      include: { _count: { select: { bookings: true } } },
    });
    if (dep._count.bookings > 0) {
      throw new UserFacingError("Ce départ a des réservations : passez-le en « Annulé » plutôt que de le supprimer");
    }
    await db.departure.delete({ where: { id: departureId } });
    revalidatePath(`/catalogue/${dep.tripId}`);
    return { ok: true, message: "Départ supprimé" };
  });
}
