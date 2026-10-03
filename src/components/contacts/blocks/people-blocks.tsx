"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  CalendarDays,
  Mail,
  MailOpen,
  MessageSquare,
  MousePointerClick,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Plus,
  Send,
  Store,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, NativeSelect } from "@/components/common/form";
import { FormDialog } from "@/components/common/form-dialog";
import { EmptyState } from "@/components/common/page-header";
import { BlockCard } from "@/components/contacts/editable-card";
import { ContactPicker, type PickedContact } from "@/components/contacts/contact-picker";
import { formatDate, formatDateTime, toDateTimeInput } from "@/lib/format";
import { genderLabels, interactionTypeLabels, options, relationLabels } from "@/lib/labels";
import type { Gender, InteractionType, RelationType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import {
  addInteractionAction,
  deleteInteractionAction,
  deleteRelationAction,
  saveRelationAction,
} from "@/server/actions/contacts";

export type CompanionRow = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  gender: Gender | null;
  relation: RelationType | null;
  sharedTrips: { bookingId: string; tripName: string; startDate: string }[];
};

export function CompanionsBlock({
  contactId,
  companions,
  canEdit,
}: {
  contactId: string;
  companions: CompanionRow[];
  canEdit: boolean;
}) {
  return (
    <BlockCard
      title="Compagnons de voyage"
      icon={<Users className="size-4" />}
      actions={canEdit && <RelationDialog contactId={contactId} excludeIds={[contactId, ...companions.map((c) => c.id)]} />}
    >
      {companions.length === 0 ? (
        <EmptyState>Aucun compagnon : ce contact n&apos;a pas encore voyagé avec d&apos;autres clients</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Naissance</TableHead>
              <TableHead>Sexe</TableHead>
              <TableHead>Lien</TableHead>
              <TableHead>Séjours partagés</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companions.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">{formatDate(c.birthDate)}</TableCell>
                <TableCell className="text-sm">{c.gender ? genderLabels[c.gender] : "—"}</TableCell>
                <TableCell>
                  {canEdit ? (
                    <RelationSelect contactId={contactId} otherId={c.id} relation={c.relation} />
                  ) : (
                    <span className="text-sm">{c.relation ? relationLabels[c.relation] : "—"}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {c.sharedTrips.length === 0 ? (
                    <span className="text-muted-foreground">Aucun</span>
                  ) : (
                    <ul>
                      {c.sharedTrips.map((t) => (
                        <li key={t.bookingId}>
                          <Link href={`/reservations/${t.bookingId}`} className="hover:underline">
                            {t.tripName}
                          </Link>{" "}
                          <span className="text-muted-foreground">({new Date(t.startDate).getFullYear()})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </BlockCard>
  );
}

function RelationSelect({ contactId, otherId, relation }: { contactId: string; otherId: string; relation: RelationType | null }) {
  const [pending, start] = useTransition();
  return (
    <NativeSelect
      className="h-8 min-w-32"
      aria-label="Lien"
      options={options(relationLabels)}
      placeholder="—"
      defaultValue={relation ?? ""}
      disabled={pending}
      onChange={(e) => {
        const value = e.target.value;
        start(async () => {
          const res = value
            ? await saveRelationAction(contactId, null, toFormData({ relatedContactId: otherId, relation: value }))
            : await deleteRelationAction(contactId, otherId);
          if (res?.ok) toast.success(res.message);
          else toast.error(res?.message);
        });
      }}
    />
  );
}

function toFormData(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

function RelationDialog({ contactId, excludeIds }: { contactId: string; excludeIds: string[] }) {
  const [picked, setPicked] = useState<PickedContact | null>(null);
  return (
    <FormDialog
      title="Lier un proche"
      description="Conjoint, enfant, ami… même s'ils n'ont pas encore voyagé ensemble."
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Lier un proche">
          <Plus />
        </Button>
      }
      action={saveRelationAction.bind(null, contactId)}
      onSuccess={() => setPicked(null)}
    >
      {(state) => (
        <div className="grid gap-4">
          <Field label="Contact" name="relatedContactId" state={state}>
            <ContactPicker name="relatedContactId" value={picked} onChange={setPicked} excludeIds={excludeIds} />
          </Field>
          <Field label="Ce contact est son / sa…" name="relation" state={state}>
            <NativeSelect id="relation" name="relation" options={options(relationLabels)} defaultValue="ami" />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

// ───────────── Timeline ─────────────

export type InteractionRow = {
  id: string;
  type: InteractionType;
  subject: string | null;
  summary: string | null;
  occurredAt: string;
  userName: string | null;
  metadata: Record<string, unknown> | null;
};

const typeIcons: Record<InteractionType, React.ComponentType<{ className?: string }>> = {
  call_in: PhoneIncoming,
  call_out: PhoneOutgoing,
  email_in: Mail,
  email_out: Send,
  newsletter_sent: Send,
  newsletter_open: MailOpen,
  newsletter_click: MousePointerClick,
  callback: Phone,
  meeting: CalendarDays,
  fair: Store,
};

const FILTERS: { key: string; label: string; types: InteractionType[] }[] = [
  { key: "all", label: "Tout", types: [] },
  { key: "calls", label: "Appels", types: ["call_in", "call_out", "callback"] },
  { key: "emails", label: "Emails", types: ["email_in", "email_out"] },
  { key: "newsletter", label: "Newsletter", types: ["newsletter_sent", "newsletter_open", "newsletter_click"] },
  { key: "meetings", label: "RDV & salons", types: ["meeting", "fair"] },
];

export function TimelineBlock({
  contactId,
  interactions,
  canDelete,
}: {
  contactId: string;
  interactions: InteractionRow[];
  canDelete: boolean;
}) {
  const [filter, setFilter] = useState("all");
  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    return f.types.length ? interactions.filter((i) => f.types.includes(i.type)) : interactions;
  }, [filter, interactions]);

  return (
    <BlockCard title="Derniers contacts" icon={<MessageSquare className="size-4" />} actions={<InteractionDialog contactId={contactId} />}>
      <div className="mb-3 flex flex-wrap gap-1">
        {FILTERS.map((f) => {
          const count = f.types.length ? interactions.filter((i) => f.types.includes(i.type)).length : interactions.length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                filter === f.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {f.label} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
      {visible.length === 0 ? (
        <EmptyState>Aucune interaction</EmptyState>
      ) : (
        <ol className="relative grid gap-4 border-l pl-5">
          {visible.map((i) => {
            const Icon = typeIcons[i.type];
            return (
              <li key={i.id} className="group relative">
                <span className="absolute top-0.5 -left-[31px] flex size-5 items-center justify-center rounded-full border bg-card">
                  <Icon className="size-3 text-muted-foreground" />
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{interactionTypeLabels[i.type]}</span>
                  <span>{formatDateTime(i.occurredAt)}</span>
                  {i.userName && <span>· {i.userName}</span>}
                  {canDelete && <DeleteInteraction contactId={contactId} interactionId={i.id} />}
                </div>
                {i.subject && <div className="text-sm font-medium">{i.subject}</div>}
                {i.summary && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{i.summary}</p>}
                {i.metadata && Object.keys(i.metadata).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(i.metadata).map(([k, v]) => (
                      <span key={k} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </BlockCard>
  );
}

function DeleteInteraction({ contactId, interactionId }: { contactId: string; interactionId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label="Supprimer l'interaction"
      disabled={pending}
      className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
      onClick={() => {
        if (!confirm("Supprimer cette interaction ?")) return;
        start(async () => {
          const res = await deleteInteractionAction(contactId, interactionId);
          if (res?.ok) toast.success(res.message);
          else toast.error(res?.message);
        });
      }}
    >
      <Trash2 className="size-3.5 hover:text-destructive" />
    </button>
  );
}

export function InteractionFields({ state, defaultType = "call_out" }: { state: Parameters<typeof Field>[0]["state"]; defaultType?: InteractionType }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Type" name="type" state={state}>
        <NativeSelect id="type" name="type" options={options(interactionTypeLabels)} defaultValue={defaultType} />
      </Field>
      <Field label="Date" name="occurredAt" state={state}>
        <Input id="occurredAt" name="occurredAt" type="datetime-local" defaultValue={toDateTimeInput(new Date())} />
      </Field>
      <Field label="Objet" name="subject" state={state} className="sm:col-span-2">
        <Input id="subject" name="subject" />
      </Field>
      <Field label="Résumé" name="summary" state={state} className="sm:col-span-2">
        <Textarea id="summary" name="summary" rows={4} />
      </Field>
    </div>
  );
}

function InteractionDialog({ contactId }: { contactId: string }) {
  return (
    <FormDialog
      title="Nouvelle interaction"
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Ajouter une interaction">
          <Plus />
        </Button>
      }
      action={addInteractionAction.bind(null, contactId)}
    >
      {(state) => <InteractionFields state={state} />}
    </FormDialog>
  );
}
