"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { canAssign, canEditContact } from "@/lib/permissions";
import { assertUser, AuthorizationError, type CurrentUser } from "@/lib/session";
import {
  formToObject,
  runAction,
  UserFacingError,
  zCheckbox,
  zOptDate,
  zOptInt,
  zOptMoney,
  zOptText,
  type ActionState,
} from "@/lib/action";
import { prismaContactLookup } from "@/server/queries/lookup";
import { findMatchingContact } from "@/lib/domain/lead-dedup";
import { contactSearchWhere } from "@/server/queries/contacts";

async function assertCanEdit(user: CurrentUser, contactId: string) {
  const contact = await db.contact.findUniqueOrThrow({ where: { id: contactId }, select: { ownerUserId: true } });
  if (!canEditContact(user, contact)) {
    throw new AuthorizationError("Ce contact est suivi par un autre conseiller");
  }
  return contact;
}

function revalidateContact(contactId: string) {
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
}

const zEmail = z
  .string()
  .optional()
  .transform((v, ctx) => {
    const email = normalizeEmail(v);
    if (email && !z.email().safeParse(email).success) {
      ctx.addIssue({ code: "custom", message: "Email invalide" });
      return z.NEVER;
    }
    return email;
  });

const zPhone = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Numéro invalide" });
      return z.NEVER;
    }
    return phone;
  });

const identitySchema = z.object({
  gender: z.enum(["femme", "homme", "non_precise"]).optional().transform((v) => v ?? null),
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  birthDate: zOptDate,
  email: zEmail,
  phoneMobile: zPhone,
  phoneHome: zPhone,
  addressLine: zOptText,
  postalCode: zOptText,
  city: zOptText,
  country: z.string().length(2).optional().transform((v) => v?.toUpperCase() ?? null),
  language: z.string().min(2).default("fr"),
  status: z.enum(["prospect", "client", "fidele", "inactif"]),
  ownerUserId: zOptText,
});

/** Traduit les violations d'unicité Prisma en message lisible. */
function rethrowUnique(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw new UserFacingError("Un autre contact utilise déjà cet email");
  }
  throw err;
}

export async function createContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertUser();
    const data = identitySchema.parse(formToObject(formData));
    const duplicate = await findMatchingContact(prismaContactLookup(), { email: data.email, phone: data.phoneMobile ?? data.phoneHome });
    if (duplicate) {
      const existing = await db.contact.findUniqueOrThrow({ where: { id: duplicate.contactId } });
      throw new UserFacingError(
        `Doublon : ${existing.firstName} ${existing.lastName} a déjà ce${duplicate.matchedOn === "email" ? "t email" : " téléphone"}`,
      );
    }
    const ownerUserId = canAssign(user) ? (data.ownerUserId ?? user.id) : user.id;
    const contact = await db.contact.create({ data: { ...data, ownerUserId } }).catch(rethrowUnique);
    revalidatePath("/contacts");
    return { ok: true, message: "Contact créé", id: contact.id };
  });
}

export async function updateIdentityAction(contactId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertUser();
    const current = await assertCanEdit(user, contactId);
    const data = identitySchema.parse(formToObject(formData));
    // Seuls les managers réaffectent un contact
    const ownerUserId = canAssign(user) ? data.ownerUserId : current.ownerUserId;
    await db.contact.update({ where: { id: contactId }, data: { ...data, ownerUserId } }).catch(rethrowUnique);
    revalidateContact(contactId);
    return { ok: true, message: "Identité mise à jour" };
  });
}

const riderSchema = z.object({
  riderRole: z.enum(["pilote", "passager"]).optional().transform((v) => v ?? null),
  licenseType: z.enum(["A", "A2", "A1", "B_125", "aucun"]).optional().transform((v) => v ?? null),
  licenseDate: zOptDate,
  ridingLevel: z.enum(["debutant", "intermediaire", "confirme", "expert"]).optional().transform((v) => v ?? null),
  heightCm: zOptInt,
  diet: zOptText,
});

export async function updateRiderAction(contactId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertUser();
    await assertCanEdit(user, contactId);
    const data = riderSchema.parse(formToObject(formData));
    await db.contact.update({ where: { id: contactId }, data });
    revalidateContact(contactId);
    return { ok: true, message: "Profil rider mis à jour" };
  });
}

export async function updateNotesAction(contactId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertUser();
    await assertCanEdit(user, contactId);
    const freeNotes = z.string().max(20_000).optional().parse(formData.get("freeNotes") ?? undefined);
    await db.contact.update({ where: { id: contactId }, data: { freeNotes: freeNotes?.trim() || null } });
    revalidateContact(contactId);
    return { ok: true, message: "Notes enregistrées" };
  });
}

const consentSchema = z.object({
  newsletterOptin: zCheckbox,
  smsOptin: zCheckbox,
  consentDate: zOptDate,
});

export async function updateConsentsAction(contactId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertUser();
    await assertCanEdit(user, contactId);
    const data = consentSchema.parse(formToObject(formData));
    const anyOptin = data.newsletterOptin || data.smsOptin;
    await db.contact.update({
      where: { id: contactId },
      data: { ...data, consentDate: anyOptin ? (data.consentDate ?? new Date()) : data.consentDate },
    });
    revalidateContact(contactId);
    return { ok: true, message: "Consentements mis à jour" };
  });
}

// ───────────── Séjours d'intérêt ─────────────

const interestSchema = z
  .object({
    tripId: zOptText,
    destination: zOptText,
    source: z.enum(["formulaire", "appel", "email", "salon", "newsletter", "conseiller"]),
    level: z.enum(["faible", "moyen", "fort"]),
    periodWanted: zOptText,
    budget: zOptMoney,
  })
  .refine((d) => d.tripId || d.destination, { path: ["tripId"], message: "Choisissez un séjour ou saisissez une destination" });

export async function saveInterestAction(
  ids: { contactId: string; interestId: string | null },
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertUser();
    await assertCanEdit(user, ids.contactId);
    const data = interestSchema.parse(formToObject(formData));
    if (ids.interestId) {
      await db.tripInterest.update({ where: { id: ids.interestId, contactId: ids.contactId }, data });
    } else {
      await db.tripInterest.create({ data: { ...data, contactId: ids.contactId } });
    }
    revalidateContact(ids.contactId);
    return { ok: true, message: ids.interestId ? "Intérêt mis à jour" : "Intérêt ajouté" };
  });
}

export async function deleteInterestAction(contactId: string, interestId: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertUser();
    await assertCanEdit(user, contactId);
    await db.tripInterest.delete({ where: { id: interestId, contactId } });
    revalidateContact(contactId);
    return { ok: true, message: "Intérêt supprimé" };
  });
}

// ───────────── Relations (lien avec les compagnons) ─────────────

const relationSchema = z.object({
  relatedContactId: z.string().min(1, "Choisissez un contact"),
  relation: z.enum(["conjoint", "enfant", "parent", "frere_soeur", "ami", "collegue", "autre"]),
});

/** Crée ou met à jour le lien entre deux contacts (un seul enregistrement, quel que soit le sens). */
export async function saveRelationAction(contactId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertUser();
    await assertCanEdit(user, contactId);
    const { relatedContactId, relation } = relationSchema.parse(formToObject(formData));
    if (relatedContactId === contactId) throw new UserFacingError("Un contact ne peut pas être lié à lui-même");
    const existing = await db.contactRelationship.findFirst({
      where: {
        OR: [
          { contactId, relatedContactId },
          { contactId: relatedContactId, relatedContactId: contactId },
        ],
      },
    });
    if (existing) {
      // Le lien est stocké dans le sens de sa création : on l'inverse si besoin (parent ↔ enfant)
      const stored = existing.contactId === contactId ? relation : invertRelation(relation);
      await db.contactRelationship.update({ where: { id: existing.id }, data: { relation: stored } });
    } else {
      await db.contactRelationship.create({ data: { contactId, relatedContactId, relation } });
    }
    revalidateContact(contactId);
    revalidateContact(relatedContactId);
    return { ok: true, message: "Lien enregistré" };
  });
}

export async function deleteRelationAction(contactId: string, relatedContactId: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertUser();
    await assertCanEdit(user, contactId);
    await db.contactRelationship.deleteMany({
      where: {
        OR: [
          { contactId, relatedContactId },
          { contactId: relatedContactId, relatedContactId: contactId },
        ],
      },
    });
    revalidateContact(contactId);
    revalidateContact(relatedContactId);
    return { ok: true, message: "Lien supprimé" };
  });
}

function invertRelation<T extends string>(relation: T): T {
  if (relation === "parent") return "enfant" as T;
  if (relation === "enfant") return "parent" as T;
  return relation;
}

// ───────────── Interactions ─────────────

const interactionSchema = z.object({
  type: z.enum([
    "call_in",
    "call_out",
    "email_in",
    "email_out",
    "newsletter_sent",
    "newsletter_open",
    "newsletter_click",
    "callback",
    "meeting",
    "fair",
  ]),
  subject: zOptText,
  summary: zOptText,
  occurredAt: zOptDate,
});

const directionByType: Record<string, "entrant" | "sortant" | null> = {
  call_in: "entrant",
  email_in: "entrant",
  callback: "entrant",
  newsletter_open: "entrant",
  newsletter_click: "entrant",
  call_out: "sortant",
  email_out: "sortant",
  newsletter_sent: "sortant",
  meeting: null,
  fair: null,
};

export async function addInteractionAction(contactId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertUser();
    const data = interactionSchema.parse(formToObject(formData));
    const occurredAt = data.occurredAt ?? new Date();
    await db.$transaction([
      db.interaction.create({
        data: { ...data, occurredAt, contactId, userId: user.id, direction: directionByType[data.type] },
      }),
      db.contact.updateMany({
        where: { id: contactId, OR: [{ lastInteractionAt: null }, { lastInteractionAt: { lt: occurredAt } }] },
        data: { lastInteractionAt: occurredAt },
      }),
    ]);
    revalidateContact(contactId);
    return { ok: true, message: "Interaction ajoutée" };
  });
}

export async function deleteInteractionAction(contactId: string, interactionId: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertUser();
    await assertCanEdit(user, contactId);
    await db.interaction.delete({ where: { id: interactionId, contactId } });
    const last = await db.interaction.findFirst({ where: { contactId }, orderBy: { occurredAt: "desc" } });
    await db.contact.update({ where: { id: contactId }, data: { lastInteractionAt: last?.occurredAt ?? null } });
    revalidateContact(contactId);
    return { ok: true, message: "Interaction supprimée" };
  });
}

// ───────────── Recherche (sélecteurs de contacts) ─────────────

export async function searchContactsAction(query: string) {
  await assertUser();
  const q = query.trim();
  if (q.length < 2) return [];
  const contacts = await db.contact.findMany({
    where: contactSearchWhere(q),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 10,
    select: { id: true, firstName: true, lastName: true, email: true, city: true, riderRole: true },
  });
  return contacts;
}
