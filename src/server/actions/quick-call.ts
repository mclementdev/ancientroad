"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { assertUser } from "@/lib/session";
import { runAction, UserFacingError, type ActionState } from "@/lib/action";
import { findMatchingContact } from "@/lib/domain/lead-dedup";
import { prismaContactLookup } from "@/server/queries/lookup";

const quickCallSchema = z
  .object({
    direction: z.enum(["entrant", "sortant"]),
    contactId: z.string().optional(),
    // Correspondant inconnu
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    email: z.string().trim().optional(),
    subject: z.string().trim().max(200).optional(),
    summary: z.string().trim().max(10_000).optional(),
    tripId: z.string().optional(),
    followUpAt: z.string().optional(),
    reached: z.boolean().default(true),
  })
  .refine((d) => d.contactId || d.phone || d.email, {
    path: ["contactId"],
    message: "Choisissez un contact ou saisissez au moins un téléphone ou un email",
  });

export type QuickCallInput = z.input<typeof quickCallSchema>;

/**
 * Saisie rapide d'un appel :
 * - contact connu → interaction (+ intérêt, + tâche de rappel) ;
 * - correspondant inconnu → dédoublonnage email / téléphone, sinon création d'un lead « appel entrant ».
 */
export async function quickCallAction(input: QuickCallInput): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertUser();
    const data = quickCallSchema.parse(input);
    const now = new Date();
    const phone = data.phone ? normalizePhone(data.phone) : null;
    if (data.phone && !phone) throw new UserFacingError("Numéro de téléphone invalide");
    const email = normalizeEmail(data.email);
    const followUpAt = data.followUpAt ? new Date(data.followUpAt) : null;
    if (followUpAt && Number.isNaN(followUpAt.getTime())) throw new UserFacingError("Date de rappel invalide");

    let contactId = data.contactId ?? null;
    if (!contactId) {
      const match = await findMatchingContact(prismaContactLookup(), { email, phone });
      contactId = match?.contactId ?? null;
    }

    const summary = [data.reached ? null : "Non joint (messagerie / pas de réponse).", data.summary].filter(Boolean).join(" ") || null;
    const subject = data.subject || (data.direction === "entrant" ? "Appel entrant" : "Appel sortant");

    if (!contactId) {
      // Inconnu : on ouvre un lead dans la file, affecté à la personne qui a pris l'appel
      const name = [data.firstName, data.lastName].filter(Boolean).join(" ");
      const lead = await db.$transaction(async (tx) => {
        const lead = await tx.lead.create({
          data: {
            channel: "inbound_call",
            firstName: data.firstName || null,
            lastName: data.lastName || null,
            email,
            phone,
            tripId: data.tripId || null,
            message: [subject, summary].filter(Boolean).join(" — "),
            status: "qualification",
            assignedUserId: user.id,
          },
        });
        if (followUpAt) {
          await tx.task.create({
            data: { type: "rappel", title: `Rappeler ${name || phone || email}`, dueAt: followUpAt, leadId: lead.id, assignedUserId: user.id },
          });
        }
        return lead;
      });
      revalidatePath("/leads");
      revalidatePath("/");
      return { ok: true, message: "Correspondant inconnu : lead créé dans la file", id: `lead:${lead.id}` };
    }

    const id = contactId;
    await db.$transaction(async (tx) => {
      await tx.interaction.create({
        data: {
          contactId: id,
          type: data.direction === "entrant" ? "call_in" : "call_out",
          direction: data.direction,
          subject,
          summary,
          userId: user.id,
          occurredAt: now,
          metadata: data.reached ? undefined : { reached: false },
        },
      });
      await tx.contact.update({ where: { id }, data: { lastInteractionAt: now } });
      if (data.tripId) {
        await tx.tripInterest.create({ data: { contactId: id, tripId: data.tripId, source: "appel", level: "moyen" } });
      }
      if (followUpAt) {
        const contact = await tx.contact.findUniqueOrThrow({ where: { id }, select: { firstName: true, lastName: true, ownerUserId: true } });
        await tx.task.create({
          data: {
            type: "rappel",
            title: `Rappeler ${contact.firstName} ${contact.lastName}`,
            dueAt: followUpAt,
            contactId: id,
            assignedUserId: user.id,
          },
        });
      }
    });
    revalidatePath(`/contacts/${id}`);
    revalidatePath("/");
    return { ok: true, message: "Appel enregistré", id };
  });
}

export async function getContactBriefAction(id: string) {
  await assertUser();
  return db.contact.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true, email: true, city: true },
  });
}
