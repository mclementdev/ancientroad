"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { canAssign, canEditLead } from "@/lib/permissions";
import { assertUser, AuthorizationError } from "@/lib/session";
import { formToObject, runAction, UserFacingError, zOptText, type ActionState } from "@/lib/action";
import { findMatchingContact } from "@/lib/domain/lead-dedup";
import { prismaContactLookup } from "@/server/queries/lookup";

const LEAD_STATUSES = ["nouveau", "qualification", "devis_envoye", "gagne", "perdu", "injoignable"] as const;

async function loadEditableLead(leadId: string) {
  const user = await assertUser();
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (!canEditLead(user, lead)) throw new AuthorizationError("Ce lead est suivi par un autre conseiller");
  return { user, lead };
}

function revalidateLeads(contactId?: string | null) {
  revalidatePath("/leads");
  revalidatePath("/");
  if (contactId) revalidatePath(`/contacts/${contactId}`);
}

export async function assignLeadAction(leadId: string, userId: string | null): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertUser();
    const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
    // Un conseiller peut prendre un lead libre ; seul un manager réaffecte
    const selfClaim = userId === user.id && lead.assignedUserId === null;
    if (!canAssign(user) && !selfClaim) throw new AuthorizationError("Seuls les managers affectent les leads");
    await db.$transaction([
      db.lead.update({ where: { id: leadId }, data: { assignedUserId: userId } }),
      // Les rappels du lead suivent son affectation
      db.task.updateMany({ where: { leadId, doneAt: null }, data: { assignedUserId: userId } }),
    ]);
    revalidateLeads(lead.contactId);
    return { ok: true, message: userId ? "Lead affecté" : "Lead désaffecté" };
  });
}

const statusSchema = z
  .object({
    status: z.enum(LEAD_STATUSES),
    lostReason: zOptText,
  })
  .refine((d) => d.status !== "perdu" || d.lostReason, { path: ["lostReason"], message: "Motif de perte requis" });

export async function updateLeadStatusAction(leadId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { lead } = await loadEditableLead(leadId);
    const data = statusSchema.parse(formToObject(formData));
    await db.lead.update({
      where: { id: leadId },
      data: { status: data.status, lostReason: data.status === "perdu" ? data.lostReason : null },
    });
    revalidateLeads(lead.contactId);
    return { ok: true, message: "Statut mis à jour" };
  });
}

const convertSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  email: zOptText,
  phone: zOptText,
});

/**
 * Convertit un lead en contact. Dédoublonnage : email d'abord, puis téléphone.
 * Si un contact existe, le lead y est rattaché (et ses coordonnées manquantes complétées) ;
 * sinon un contact prospect est créé. Le message du lead devient une interaction.
 */
export async function convertLeadAction(leadId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, lead } = await loadEditableLead(leadId);
    if (lead.contactId) throw new UserFacingError("Ce lead est déjà rattaché à un contact");
    const data = convertSchema.parse(formToObject(formData));
    const email = normalizeEmail(data.email);
    const phone = data.phone ? normalizePhone(data.phone) : null;
    if (data.phone && !phone) throw new UserFacingError("Numéro de téléphone invalide");

    const match = await findMatchingContact(prismaContactLookup(), { email, phone });
    const ownerUserId = lead.assignedUserId ?? user.id;

    const result = await db.$transaction(async (tx) => {
      let contactId: string;
      let created = false;
      if (match) {
        contactId = match.contactId;
        const existing = await tx.contact.findUniqueOrThrow({ where: { id: contactId } });
        // On complète sans écraser
        const emailFree = email && !existing.email && !(await tx.contact.findUnique({ where: { email } }));
        await tx.contact.update({
          where: { id: contactId },
          data: {
            email: emailFree ? email : undefined,
            phoneMobile: !existing.phoneMobile && phone ? phone : undefined,
            ownerUserId: existing.ownerUserId ?? ownerUserId,
          },
        });
      } else {
        const contact = await tx.contact.create({
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            email,
            phoneMobile: phone,
            status: "prospect",
            ownerUserId,
          },
        });
        contactId = contact.id;
        created = true;
      }

      const occurredAt = lead.createdAt;
      await tx.interaction.create({
        data: {
          contactId,
          leadId: lead.id,
          type: lead.channel === "callback" ? "callback" : lead.channel === "inbound_call" ? "call_in" : "email_in",
          direction: "entrant",
          subject: lead.channel === "callback" ? "Demande de rappel" : "Demande entrante",
          summary: [lead.message, lead.callbackSlot && `Créneau souhaité : ${lead.callbackSlot}`].filter(Boolean).join("\n") || null,
          occurredAt,
          metadata: { utm_source: lead.utmSource, utm_campaign: lead.utmCampaign, converted_by: user.name },
        },
      });
      await tx.contact.updateMany({
        where: { id: contactId, OR: [{ lastInteractionAt: null }, { lastInteractionAt: { lt: occurredAt } }] },
        data: { lastInteractionAt: occurredAt },
      });
      if (lead.tripId) {
        await tx.tripInterest.create({ data: { contactId, tripId: lead.tripId, source: "formulaire", level: "moyen" } });
      }
      await tx.task.updateMany({ where: { leadId: lead.id }, data: { contactId } });
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          contactId,
          assignedUserId: lead.assignedUserId ?? user.id,
          status: lead.status === "nouveau" ? "qualification" : lead.status,
        },
      });
      return { contactId, created };
    });

    revalidateLeads(result.contactId);
    revalidatePath("/contacts");
    return {
      ok: true,
      id: result.contactId,
      message: result.created
        ? "Contact créé à partir du lead"
        : `Lead rattaché au contact existant (doublon détecté par ${match!.matchedOn === "email" ? "email" : "téléphone"})`,
    };
  });
}

/** Aperçu du dédoublonnage avant conversion. */
export async function previewLeadMatchAction(email: string | null, phone: string | null) {
  await assertUser();
  const match = await findMatchingContact(prismaContactLookup(), { email, phone });
  if (!match) return null;
  const c = await db.contact.findUniqueOrThrow({
    where: { id: match.contactId },
    select: { id: true, firstName: true, lastName: true, city: true, status: true },
  });
  return { ...c, matchedOn: match.matchedOn };
}
