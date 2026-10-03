"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Compass, Pencil, Plane, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, NativeSelect } from "@/components/common/form";
import { FormDialog } from "@/components/common/form-dialog";
import { EmptyState } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { BlockCard } from "@/components/contacts/editable-card";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  bookingStatusLabels,
  interestLevelLabels,
  interestSourceLabels,
  options,
  riderRoleLabels,
} from "@/lib/labels";
import type { BookingStatus, InterestLevel, InterestSource, RiderRole } from "@/generated/prisma/enums";
import { deleteInterestAction, saveInterestAction } from "@/server/actions/contacts";

export type BookingRow = {
  id: string;
  status: BookingStatus;
  totalAmount: number;
  currency: string;
  isPayer: boolean;
  payerName: string;
  tripId: string;
  tripName: string;
  startDate: string;
  endDate: string;
  role: RiderRole | null;
  participantCount: number;
};

export function BookingsBlock({
  contactId,
  bookings,
  stats,
}: {
  contactId: string;
  bookings: BookingRow[];
  stats: { tripCount: number; revenueTotal: number; averageBasket: number | null; bookingCount: number };
}) {
  return (
    <BlockCard
      title="Séjours achetés"
      icon={<Plane className="size-4" />}
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href={`/reservations/nouvelle?contact=${contactId}`}>
            <Plus /> Réservation
          </Link>
        </Button>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Kpi label="Voyages" value={String(stats.tripCount)} />
        <Kpi label="CA total" value={formatCurrency(stats.revenueTotal)} hint={`${stats.bookingCount} résa payée(s)`} />
        <Kpi label="Panier moyen" value={stats.averageBasket === null ? "—" : formatCurrency(stats.averageBasket)} />
      </div>
      {bookings.length === 0 ? (
        <EmptyState>Aucune réservation</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Séjour</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <Link href={`/reservations/${b.id}`} className="font-medium hover:underline">
                    {b.tripName}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {b.participantCount} participant(s){!b.isPayer && ` · payé par ${b.payerName}`}
                  </div>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">{formatDate(b.startDate)}</TableCell>
                <TableCell className="text-sm">{b.role ? riderRoleLabels[b.role] : "—"}</TableCell>
                <TableCell>
                  <StatusBadge value={b.status} label={bookingStatusLabels[b.status]} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {b.isPayer ? formatCurrency(b.totalAmount, b.currency) : <span className="text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </BlockCard>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export type InterestRow = {
  id: string;
  tripId: string | null;
  tripName: string | null;
  destination: string | null;
  source: InterestSource;
  level: InterestLevel;
  periodWanted: string | null;
  budget: number | null;
  createdAt: string;
};

export function InterestsBlock({
  contactId,
  interests,
  trips,
  canEdit,
}: {
  contactId: string;
  interests: InterestRow[];
  trips: [string, string][];
  canEdit: boolean;
}) {
  return (
    <BlockCard
      title="Séjours d'intérêt"
      icon={<Compass className="size-4" />}
      actions={canEdit && <InterestDialog contactId={contactId} trips={trips} />}
    >
      {interests.length === 0 ? (
        <EmptyState>Aucun intérêt enregistré</EmptyState>
      ) : (
        <ul className="divide-y">
          {interests.map((i) => (
            <li key={i.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {i.tripId ? (
                    <Link href={`/catalogue/${i.tripId}`} className="font-medium hover:underline">
                      {i.tripName}
                    </Link>
                  ) : (
                    <span className="font-medium">{i.destination}</span>
                  )}
                  <StatusBadge value={i.level} label={interestLevelLabels[i.level]} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {[
                    i.periodWanted,
                    i.budget !== null && `budget ${formatCurrency(i.budget)}`,
                    `${interestSourceLabels[i.source]}, ${formatDate(i.createdAt)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              {canEdit && (
                <div className="flex shrink-0">
                  <InterestDialog contactId={contactId} trips={trips} interest={i} />
                  <DeleteInterest contactId={contactId} interestId={i.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </BlockCard>
  );
}

function InterestDialog({ contactId, trips, interest }: { contactId: string; trips: [string, string][]; interest?: InterestRow }) {
  return (
    <FormDialog
      title={interest ? "Modifier l'intérêt" : "Nouvel intérêt"}
      trigger={
        interest ? (
          <Button variant="ghost" size="icon-sm" aria-label="Modifier">
            <Pencil />
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label="Ajouter un intérêt">
            <Plus />
          </Button>
        )
      }
      action={saveInterestAction.bind(null, { contactId, interestId: interest?.id ?? null })}
    >
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Séjour du catalogue" name="tripId" state={state} className="sm:col-span-2">
            <NativeSelect id="tripId" name="tripId" options={trips} placeholder="— Aucun (destination libre) —" defaultValue={interest?.tripId ?? ""} />
          </Field>
          <Field label="ou destination libre" name="destination" state={state} className="sm:col-span-2">
            <Input id="destination" name="destination" placeholder="Ex. Islande" defaultValue={interest?.destination ?? ""} />
          </Field>
          <Field label="Niveau d'intérêt" name="level" state={state}>
            <NativeSelect id="level" name="level" options={options(interestLevelLabels)} defaultValue={interest?.level ?? "moyen"} />
          </Field>
          <Field label="Source" name="source" state={state}>
            <NativeSelect id="source" name="source" options={options(interestSourceLabels)} defaultValue={interest?.source ?? "appel"} />
          </Field>
          <Field label="Période souhaitée" name="periodWanted" state={state}>
            <Input id="periodWanted" name="periodWanted" placeholder="Printemps 2027" defaultValue={interest?.periodWanted ?? ""} />
          </Field>
          <Field label="Budget (€)" name="budget" state={state}>
            <Input id="budget" name="budget" type="number" min={0} defaultValue={interest?.budget ?? ""} />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

function DeleteInterest({ contactId, interestId }: { contactId: string; interestId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Supprimer"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await deleteInterestAction(contactId, interestId);
          if (res?.ok) toast.success(res.message);
          else toast.error(res?.message);
        })
      }
    >
      <Trash2 />
    </Button>
  );
}
