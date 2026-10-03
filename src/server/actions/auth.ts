"use server";

import { randomBytes } from "node:crypto";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword, signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/normalize";
import { canManageUsers } from "@/lib/permissions";
import { assertUser, AuthorizationError } from "@/lib/session";
import { formToObject, runAction, UserFacingError, type ActionState } from "@/lib/action";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: (formData.get("callbackUrl") as string) || "/",
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, message: "Email ou mot de passe incorrect" };
    throw err; // redirection Next.js
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

const INVITATION_DAYS = 7;

const inviteSchema = z.object({
  email: z.email("Email invalide"),
  role: z.enum(["conseiller", "manager", "admin"]),
});

export async function inviteUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertUser();
    if (!canManageUsers(user)) throw new AuthorizationError();
    const data = inviteSchema.parse(formToObject(formData));
    const email = normalizeEmail(data.email)!;
    if (await db.user.findUnique({ where: { email } })) {
      throw new UserFacingError("Un compte existe déjà pour cette adresse");
    }
    const token = randomBytes(24).toString("base64url");
    await db.invitation.create({
      data: {
        email,
        role: data.role,
        token,
        invitedById: user.id,
        expiresAt: new Date(Date.now() + INVITATION_DAYS * 86_400_000),
      },
    });
    revalidatePath("/admin/utilisateurs");
    return { ok: true, message: "Invitation créée : copiez le lien et envoyez-le à la personne invitée" };
  });
}

export async function revokeInvitationAction(invitationId: string) {
  const user = await assertUser();
  if (!canManageUsers(user)) throw new AuthorizationError();
  await db.invitation.delete({ where: { id: invitationId } });
  revalidatePath("/admin/utilisateurs");
}

const updateRoleSchema = z.enum(["conseiller", "manager", "admin"]);

export async function updateUserRoleAction(userId: string, role: string) {
  const user = await assertUser();
  if (!canManageUsers(user)) throw new AuthorizationError();
  if (userId === user.id) throw new AuthorizationError("Vous ne pouvez pas modifier votre propre rôle");
  await db.user.update({ where: { id: userId }, data: { role: updateRoleSchema.parse(role) } });
  revalidatePath("/admin/utilisateurs");
}

const acceptSchema = z
  .object({
    token: z.string().min(1),
    name: z.string().trim().min(2, "Nom requis"),
    password: z.string().min(10, "10 caractères minimum"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas" });

export async function acceptInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const data = acceptSchema.parse(formToObject(formData));
    const invitation = await db.invitation.findUnique({ where: { token: data.token } });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new UserFacingError("Invitation invalide ou expirée");
    }
    if (await db.user.findUnique({ where: { email: invitation.email } })) {
      throw new UserFacingError("Un compte existe déjà pour cette adresse");
    }
    await db.$transaction([
      db.user.create({
        data: {
          email: invitation.email,
          name: data.name,
          role: invitation.role,
          passwordHash: await hashPassword(data.password),
        },
      }),
      db.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    ]);
    return { ok: true, message: invitation.email };
  });
  if (!result?.ok) return result;
  await signIn("credentials", {
    email: result.message,
    password: formData.get("password"),
    redirectTo: "/",
  });
  return result;
}
