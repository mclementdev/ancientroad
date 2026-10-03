import type { Role } from "@/generated/prisma/enums";

type Actor = { id: string; role: Role };

/**
 * Règles de droits :
 * - conseiller : lit tout, modifie ses contacts (ou ceux sans conseiller) et ses leads
 * - manager : tout, plus l'affectation des leads et des contacts
 * - admin : idem manager, plus la gestion des utilisateurs
 */
export function isManager(user: Actor): boolean {
  return user.role === "manager" || user.role === "admin";
}

export function canEditContact(user: Actor, contact: { ownerUserId: string | null }): boolean {
  return isManager(user) || contact.ownerUserId === null || contact.ownerUserId === user.id;
}

export function canEditLead(user: Actor, lead: { assignedUserId: string | null }): boolean {
  return isManager(user) || lead.assignedUserId === null || lead.assignedUserId === user.id;
}

export function canAssign(user: Actor): boolean {
  return isManager(user);
}

export function canManageCatalog(user: Actor): boolean {
  return isManager(user);
}

export function canManageUsers(user: Actor): boolean {
  return user.role === "admin";
}
