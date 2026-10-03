"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isManager } from "@/lib/permissions";
import { assertUser, AuthorizationError } from "@/lib/session";
import { runAction, type ActionState } from "@/lib/action";

export async function toggleTaskDoneAction(taskId: string, done: boolean): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertUser();
    const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
    if (task.assignedUserId && task.assignedUserId !== user.id && !isManager(user)) {
      throw new AuthorizationError("Cette tâche est affectée à un autre conseiller");
    }
    await db.task.update({ where: { id: taskId }, data: { doneAt: done ? new Date() : null } });
    revalidatePath("/");
    if (task.contactId) revalidatePath(`/contacts/${task.contactId}`);
    return { ok: true, message: done ? "Tâche terminée" : "Tâche rouverte" };
  });
}
