import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

export type CurrentUser = { id: string; name: string; email: string; role: Role };

/**
 * Utilisateur connecté, relu en base à chaque requête (le rôle peut avoir
 * changé depuis l'émission du JWT). null si non connecté.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });
});

/** Pour les pages : redirige vers /login si non connecté. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export class AuthorizationError extends Error {
  constructor(message = "Action non autorisée") {
    super(message);
  }
}

/** Pour les Server Actions / routes : lève une erreur si non connecté. */
export async function assertUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Session expirée, reconnectez-vous");
  return user;
}
