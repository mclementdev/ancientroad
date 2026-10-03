import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, MapPin, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/status-badge";
import { ScoreGauge } from "@/components/common/score";
import { ConsentsBlock, IdentityBlock, NotesBlock, RiderBlock } from "@/components/contacts/blocks/profile-blocks";
import { BookingsBlock, InterestsBlock } from "@/components/contacts/blocks/trips-blocks";
import { CompanionsBlock, TimelineBlock } from "@/components/contacts/blocks/people-blocks";
import { AiAnalysisBlock, AnalysisProvider, AnalyzeButton } from "@/components/contacts/blocks/ai-block";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, toDateInput, toNumber } from "@/lib/format";
import { contactStatusLabels, riderRoleLabels, taskTypeLabels } from "@/lib/labels";
import { canAssign, canEditContact } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { getContactFile } from "@/server/queries/contact-file";

export async function generateMetadata({ params }: PageProps<"/contacts/[id]">): Promise<Metadata> {
  const { id } = await params;
  const c = await db.contact.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
  return { title: c ? `${c.firstName} ${c.lastName}` : "Contact" };
}

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const [file, users, trips] = await Promise.all([
    getContactFile(id),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.trip.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!file) notFound();
  const { contact: c, stats, bookings, companions } = file;
  const canEdit = canEditContact(user, c);
  const latest = c.analyses[0];

  return (
    <AnalysisProvider contactId={c.id}>
      <Link href="/contacts" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Contacts
      </Link>

      {/* Bandeau */}
      <Card className="mb-6 flex-row flex-wrap items-center gap-6 px-6 py-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {c.firstName} {c.lastName}
            </h1>
            <StatusBadge value={c.status} label={contactStatusLabels[c.status]} />
            {c.riderRole && <StatusBadge label={riderRoleLabels[c.riderRole]} tone="neutral" />}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {stats.age !== null && <span>{stats.age} ans</span>}
            {c.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {c.city}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5" /> {c.owner?.name ?? "Sans conseiller"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" /> Dernier contact : {formatDate(stats.lastContactAt)}
            </span>
            {stats.lastTrip && (
              <span>
                Dernier voyage : {stats.lastTrip.tripName} ({formatDate(stats.lastTrip.startDate)})
              </span>
            )}
          </div>
          {c.tasks.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {c.tasks.slice(0, 3).map((t) => (
                <li key={t.id} className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
                  {taskTypeLabels[t.type]} · {t.title ?? "—"} · {formatDateTime(t.dueAt)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <ScoreGauge score={latest?.score ?? null} />
        <AnalyzeButton />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6">
          <IdentityBlock
            canEdit={canEdit}
            canAssign={canAssign(user)}
            users={users.map((u) => [u.id, u.name])}
            data={{
              id: c.id,
              gender: c.gender,
              firstName: c.firstName,
              lastName: c.lastName,
              birthDate: toDateInput(c.birthDate),
              email: c.email,
              phoneMobile: c.phoneMobile,
              phoneHome: c.phoneHome,
              addressLine: c.addressLine,
              postalCode: c.postalCode,
              city: c.city,
              country: c.country,
              language: c.language,
              status: c.status,
              ownerUserId: c.ownerUserId,
              ownerName: c.owner?.name ?? null,
              age: stats.age,
            }}
          />
          <RiderBlock
            canEdit={canEdit}
            data={{
              id: c.id,
              riderRole: c.riderRole,
              licenseType: c.licenseType,
              licenseDate: toDateInput(c.licenseDate),
              ridingLevel: c.ridingLevel,
              heightCm: c.heightCm,
              diet: c.diet,
            }}
          />
          <NotesBlock id={c.id} notes={c.freeNotes} canEdit={canEdit} />
          <ConsentsBlock
            canEdit={canEdit}
            data={{
              id: c.id,
              newsletterOptin: c.newsletterOptin,
              smsOptin: c.smsOptin,
              consentDate: c.consentDate?.toISOString() ?? null,
            }}
          />
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6">
          <AiAnalysisBlock
            analyses={c.analyses.map((a) => ({
              id: a.id,
              score: a.score,
              summary: a.summary,
              result: a.resultJson,
              model: a.model,
              inputTokens: a.inputTokens,
              outputTokens: a.outputTokens,
              createdAt: a.createdAt.toISOString(),
              createdByName: a.createdBy?.name ?? null,
            }))}
          />
          <BookingsBlock
            contactId={c.id}
            stats={stats}
            bookings={bookings.map((b) => ({
              id: b.id,
              status: b.status,
              totalAmount: b.totalAmount,
              currency: b.currency,
              isPayer: b.isPayer,
              payerName: `${b.payer.firstName} ${b.payer.lastName}`,
              tripId: b.tripId,
              tripName: b.tripName,
              startDate: b.startDate.toISOString(),
              endDate: b.endDate.toISOString(),
              role: b.role,
              participantCount: b.participantCount,
            }))}
          />
          <InterestsBlock
            contactId={c.id}
            canEdit={canEdit}
            trips={trips.map((t) => [t.id, t.name])}
            interests={c.interests.map((i) => ({
              id: i.id,
              tripId: i.tripId,
              tripName: i.trip?.name ?? null,
              destination: i.destination,
              source: i.source,
              level: i.level,
              periodWanted: i.periodWanted,
              budget: i.budget === null ? null : toNumber(i.budget),
              createdAt: i.createdAt.toISOString(),
            }))}
          />
          <CompanionsBlock
            contactId={c.id}
            canEdit={canEdit}
            companions={companions.map((x) => ({
              id: x.id,
              firstName: x.firstName,
              lastName: x.lastName,
              birthDate: x.birthDate?.toISOString() ?? null,
              gender: x.gender,
              relation: x.relation,
              sharedTrips: x.sharedTrips.map((t) => ({
                bookingId: t.bookingId,
                tripName: t.tripName,
                startDate: t.startDate.toISOString(),
              })),
            }))}
          />
          <TimelineBlock
            contactId={c.id}
            canDelete={canEdit}
            interactions={c.interactions.map((i) => ({
              id: i.id,
              type: i.type,
              subject: i.subject,
              summary: i.summary,
              occurredAt: i.occurredAt.toISOString(),
              userName: i.user?.name ?? null,
              metadata: (i.metadata as Record<string, unknown> | null) ?? null,
            }))}
          />
        </div>
      </div>
    </AnalysisProvider>
  );
}
