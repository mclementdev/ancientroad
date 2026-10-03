import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { findMatchingContact } from "@/lib/domain/lead-dedup";
import { prismaContactLookup } from "@/server/queries/lookup";

const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);

/** Charge utile acceptée par POST /api/leads (snake_case ou camelCase). */
export const leadPayloadSchema = z
  .preprocess(
    (raw) => {
      if (!raw || typeof raw !== "object") return raw;
      const r = raw as Record<string, unknown>;
      const pick = (...keys: string[]) => keys.map((k) => r[k]).find((v) => v !== undefined && v !== "");
      return {
        channel: pick("channel", "type"),
        firstName: pick("first_name", "firstName", "prenom"),
        lastName: pick("last_name", "lastName", "nom"),
        email: pick("email"),
        phone: pick("phone", "telephone", "phone_mobile"),
        callbackSlot: pick("callback_slot", "callbackSlot", "creneau"),
        callbackAt: pick("callback_at", "callbackAt"),
        tripId: pick("trip_id", "tripId"),
        message: pick("message"),
        utmSource: pick("utm_source", "utmSource"),
        utmCampaign: pick("utm_campaign", "utmCampaign"),
      };
    },
    z.object({
      channel: z.enum(["email_form", "callback"], { error: "channel doit valoir email_form ou callback" }),
      firstName: optStr(100),
      lastName: optStr(100),
      email: optStr(254),
      phone: optStr(40),
      callbackSlot: optStr(100),
      callbackAt: z.coerce.date({ error: "callback_at doit être une date ISO 8601" }).optional().nullable(),
      tripId: optStr(60),
      message: optStr(5000),
      utmSource: optStr(200),
      utmCampaign: optStr(200),
    }),
  )
  .superRefine((d, ctx) => {
    if (d.email && !normalizeEmail(d.email)?.includes("@")) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Email invalide" });
    }
    if (d.phone && !normalizePhone(d.phone)) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Téléphone invalide" });
    }
    if (!d.email && !d.phone) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Un email ou un téléphone est requis" });
    }
    if (d.channel === "callback" && !d.phone) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Le téléphone est requis pour une demande de rappel" });
    }
  });

export type LeadPayload = z.infer<typeof leadPayloadSchema>;

/**
 * Enregistre un lead venu du site :
 * - rattache au contact existant (email puis téléphone) et ajoute une interaction ;
 * - pour une demande de rappel, crée une tâche au créneau demandé.
 */
export async function intakeLead(payload: LeadPayload, now = new Date()) {
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const match = await findMatchingContact(prismaContactLookup(), { email, phone });

  const [contact, trip] = await Promise.all([
    match
      ? db.contact.findUnique({ where: { id: match.contactId }, select: { id: true, ownerUserId: true } })
      : null,
    payload.tripId ? db.trip.findUnique({ where: { id: payload.tripId }, select: { id: true, name: true } }) : null,
  ]);
  const assignedUserId = contact?.ownerUserId ?? null;
  const callbackAt = payload.channel === "callback" ? (payload.callbackAt ?? now) : null;

  return db.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        channel: payload.channel,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email,
        phone,
        callbackSlot: payload.callbackSlot,
        callbackAt,
        tripId: trip?.id ?? null,
        message: payload.message,
        utmSource: payload.utmSource,
        utmCampaign: payload.utmCampaign,
        contactId: contact?.id ?? null,
        assignedUserId,
        createdAt: now,
      },
    });

    if (contact) {
      await tx.interaction.create({
        data: {
          contactId: contact.id,
          leadId: lead.id,
          type: payload.channel === "callback" ? "callback" : "email_in",
          direction: "entrant",
          subject: payload.channel === "callback" ? "Demande de rappel (site)" : `Formulaire site${trip ? ` : ${trip.name}` : ""}`,
          summary: [payload.message, payload.callbackSlot && `Créneau souhaité : ${payload.callbackSlot}`].filter(Boolean).join("\n") || null,
          occurredAt: now,
          metadata: { source: "site", utm_source: payload.utmSource, utm_campaign: payload.utmCampaign, matched_on: match!.matchedOn },
        },
      });
      await tx.contact.update({ where: { id: contact.id }, data: { lastInteractionAt: now } });
      if (trip) {
        await tx.tripInterest.create({
          data: { contactId: contact.id, tripId: trip.id, source: "formulaire", level: "moyen", createdAt: now },
        });
      }
    }

    if (payload.channel === "callback") {
      const name = [payload.firstName, payload.lastName].filter(Boolean).join(" ") || phone;
      await tx.task.create({
        data: {
          type: "rappel",
          title: `Rappeler ${name}${payload.callbackSlot ? ` (${payload.callbackSlot})` : ""}`,
          dueAt: callbackAt!,
          leadId: lead.id,
          contactId: contact?.id ?? null,
          assignedUserId,
        },
      });
    }

    return { leadId: lead.id, contactId: contact?.id ?? null, matchedOn: match?.matchedOn ?? null };
  });
}
