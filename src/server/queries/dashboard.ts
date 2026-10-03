import "server-only";
import { db } from "@/lib/db";
import { startOfDayInAppTz } from "@/lib/format";

const DAY = 86_400_000;

export async function getDashboard({ userId, team, now = new Date() }: { userId: string; team: boolean; now?: Date }) {
  const today = startOfDayInAppTz(now);
  const tomorrow = startOfDayInAppTz(new Date(today.getTime() + DAY + 3_600_000));
  const assignee = team ? {} : { assignedUserId: userId };

  const [callbacks, overdue, lateLeads, topContacts, departures, counts] = await Promise.all([
    // Rappels du jour, triés par créneau ; ceux faits aujourd'hui restent visibles, barrés
    db.task.findMany({
      where: { ...assignee, dueAt: { gte: today, lt: tomorrow } },
      orderBy: { dueAt: "asc" },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phoneMobile: true } },
        lead: { select: { id: true, firstName: true, lastName: true, phone: true, callbackSlot: true } },
        assignedUser: { select: { name: true } },
      },
    }),
    db.task.findMany({
      where: { ...assignee, dueAt: { lt: today }, doneAt: null },
      orderBy: { dueAt: "asc" },
      take: 10,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phoneMobile: true } },
        lead: { select: { id: true, firstName: true, lastName: true, phone: true, callbackSlot: true } },
        assignedUser: { select: { name: true } },
      },
    }),
    db.lead.findMany({
      where: { status: "nouveau", createdAt: { lt: new Date(now.getTime() - DAY) } },
      orderBy: { createdAt: "asc" },
      include: { trip: { select: { name: true } }, contact: { select: { id: true } } },
    }),
    db.contact.findMany({
      where: { lastScore: { not: null } },
      orderBy: [{ lastScore: "desc" }, { lastAnalyzedAt: "desc" }],
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        lastScore: true,
        lastAnalyzedAt: true,
        owner: { select: { name: true } },
      },
    }),
    db.departure.findMany({
      where: { startDate: { gte: today }, status: { notIn: ["annule", "termine"] } },
      orderBy: { startDate: "asc" },
      take: 8,
      include: {
        trip: { select: { id: true, name: true, format: true } },
        _count: { select: { bookings: { where: { status: { not: "annule" } } } } },
      },
    }),
    Promise.all([
      db.lead.count({ where: { status: "nouveau" } }),
      db.task.count({ where: { ...assignee, dueAt: { lt: tomorrow }, doneAt: null } }),
      db.booking.count({ where: { status: "option" } }),
    ]),
  ]);

  return {
    callbacks,
    overdue,
    lateLeads,
    topContacts,
    departures,
    counts: { newLeads: counts[0], openTasks: counts[1], options: counts[2] },
  };
}
