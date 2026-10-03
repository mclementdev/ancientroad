import Link from "next/link";
import { AlertTriangle, CalendarClock, Inbox, PhoneCall, Plane, Trophy } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { ScorePill } from "@/components/common/score";
import { TaskCheck } from "@/components/dashboard/task-check";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { formatPhone } from "@/lib/normalize";
import { contactStatusLabels, departureStatusLabels, leadChannelLabels, taskTypeLabels, tripFormatLabels } from "@/lib/labels";
import { isManager } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getDashboard } from "@/server/queries/dashboard";

type DashboardTask = Awaited<ReturnType<typeof getDashboard>>["callbacks"][number];

function TaskRow({ task, showDate, showAssignee }: { task: DashboardTask; showDate?: boolean; showAssignee: boolean }) {
  const who = task.contact
    ? { href: `/contacts/${task.contact.id}`, name: `${task.contact.firstName} ${task.contact.lastName}`, phone: task.contact.phoneMobile }
    : task.lead
      ? { href: "/leads", name: [task.lead.firstName, task.lead.lastName].filter(Boolean).join(" ") || "Lead", phone: task.lead.phone }
      : null;
  const done = Boolean(task.doneAt);
  return (
    <li className={cn("flex items-start gap-3 py-2.5", done && "opacity-50")}>
      <TaskCheck taskId={task.id} done={done} label={`Marquer « ${task.title ?? taskTypeLabels[task.type]} » comme fait`} />
      <div className="w-24 shrink-0 text-sm font-medium tabular-nums">
        {showDate ? formatDate(task.dueAt) : formatTime(task.dueAt)}
        {task.lead?.callbackSlot && <div className="text-[11px] font-normal text-muted-foreground">{task.lead.callbackSlot}</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm", done && "line-through")}>
          {task.title ?? taskTypeLabels[task.type]}
        </div>
        <div className="text-xs text-muted-foreground">
          {who && (
            <Link href={who.href} className="hover:underline">
              {who.name}
            </Link>
          )}
          {who?.phone && (
            <>
              {" · "}
              <a href={`tel:${who.phone}`} className="hover:underline">
                {formatPhone(who.phone)}
              </a>
            </>
          )}
          {showAssignee && task.assignedUser && ` · ${task.assignedUser.name}`}
        </div>
      </div>
      <StatusBadge label={taskTypeLabels[task.type]} tone={task.type === "rappel" ? "primary" : "neutral"} />
    </li>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const sp = await searchParams;
  // Les managers voient l'équipe par défaut, les conseillers leurs propres tâches
  const team = sp.vue === "equipe" || (sp.vue !== "moi" && isManager(user));
  const data = await getDashboard({ userId: user.id, team });
  const now = Date.now();
  const firstName = user.name.split(" ")[0];
  const pending = data.callbacks.filter((t) => !t.doneAt).length;

  const kpis = [
    { label: "Rappels du jour", value: pending, icon: PhoneCall, href: "#rappels" },
    { label: "Tâches en retard", value: data.overdue.length, icon: AlertTriangle, href: "#retard", alert: data.overdue.length > 0 },
    { label: "Leads nouveaux", value: data.counts.newLeads, icon: Inbox, href: "/leads?statut=nouveau" },
    { label: "Options en cours", value: data.counts.options, icon: CalendarClock, href: "/reservations?statut=option&periode=toutes" },
  ];

  return (
    <>
      <PageHeader
        title={`Bonjour ${firstName}`}
        description={new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeZone: "Europe/Paris" }).format(new Date())}
        actions={
          <div className="inline-flex rounded-md border p-0.5 text-sm">
            <Link href="/?vue=moi" className={cn("rounded px-3 py-1", !team ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
              Mes tâches
            </Link>
            <Link href="/?vue=equipe" className={cn("rounded px-3 py-1", team ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
              Équipe
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href}>
            <Card className={cn("gap-1 px-4 py-4 transition-colors hover:bg-accent/40", k.alert && "border-red-200 bg-red-50/50")}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <k.icon className="size-3.5" /> {k.label}
              </div>
              <div className={cn("text-2xl font-semibold tabular-nums", k.alert && "text-red-700")}>{k.value}</div>
            </Card>
          </Link>
        ))}
      </div>

      {data.lateLeads.length > 0 && (
        <Card className="mb-6 gap-3 border-red-200 bg-red-50/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-800">
              <AlertTriangle className="size-4" /> {data.lateLeads.length} lead(s) « nouveau » en attente depuis plus de 24 h
            </CardTitle>
            <CardAction>
              <Link href="/leads?statut=nouveau" className="text-sm text-red-800 underline">
                Traiter la file
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1.5 text-sm">
              {data.lateLeads.map((l) => (
                <li key={l.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{[l.firstName, l.lastName].filter(Boolean).join(" ") || l.email || l.phone}</span>
                  <span className="text-muted-foreground">
                    {leadChannelLabels[l.channel]}
                    {l.trip && ` · ${l.trip.name}`} · reçu {formatDateTime(l.createdAt)} (
                    {Math.floor((now - l.createdAt.getTime()) / 3_600_000)} h)
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6">
          <Card id="rappels" className="gap-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PhoneCall className="size-4" /> Rappels du jour
              </CardTitle>
              <CardAction className="text-sm text-muted-foreground">
                {pending} à faire / {data.callbacks.length}
              </CardAction>
            </CardHeader>
            <CardContent>
              {data.callbacks.length === 0 ? (
                <EmptyState>Aucun rappel prévu aujourd&apos;hui</EmptyState>
              ) : (
                <ul className="divide-y">
                  {data.callbacks.map((t) => (
                    <TaskRow key={t.id} task={t} showAssignee={team} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {data.overdue.length > 0 && (
            <Card id="retard" className="gap-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-red-800">
                  <AlertTriangle className="size-4" /> En retard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {data.overdue.map((t) => (
                    <TaskRow key={t.id} task={t} showDate showAssignee={team} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card className="gap-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plane className="size-4" /> Prochains départs
              </CardTitle>
              <CardAction>
                <Link href="/catalogue" className="text-sm text-muted-foreground hover:underline">
                  Catalogue
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {data.departures.map((d) => {
                  const filled = d.seatsTotal - d.seatsLeft;
                  const pct = Math.round((filled / d.seatsTotal) * 100);
                  return (
                    <li key={d.id} className="flex items-center gap-4 py-2.5">
                      <div className="w-24 shrink-0 text-sm font-medium tabular-nums">{formatDate(d.startDate)}</div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/catalogue/${d.trip.id}`} className="text-sm font-medium hover:underline">
                          {d.trip.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {tripFormatLabels[d.trip.format]} ·{" "}
                          <Link href={`/reservations?depart=${d.id}`} className="hover:underline">
                            {d._count.bookings} réservation(s)
                          </Link>
                        </div>
                      </div>
                      <div className="hidden w-32 sm:block">
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-1 text-right text-[11px] text-muted-foreground tabular-nums">
                          {filled}/{d.seatsTotal} places
                        </div>
                      </div>
                      <StatusBadge value={d.status} label={departureStatusLabels[d.status]} />
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="content-start gap-2 self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4" /> Top 10 par score IA
            </CardTitle>
            <CardAction>
              <Link href="/contacts?tri=score" className="text-sm text-muted-foreground hover:underline">
                Tous
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.topContacts.length === 0 ? (
              <EmptyState>Aucun contact analysé pour l&apos;instant</EmptyState>
            ) : (
              <ol className="divide-y">
                {data.topContacts.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-5 text-right text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/contacts/${c.id}`} className="text-sm font-medium hover:underline">
                        {c.firstName} {c.lastName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {contactStatusLabels[c.status]} · {c.owner?.name ?? "sans conseiller"} · analysé le {formatDate(c.lastAnalyzedAt)}
                      </div>
                    </div>
                    <ScorePill score={c.lastScore} />
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
