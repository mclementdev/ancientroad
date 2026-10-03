"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/common/form";
import { FormDialog } from "@/components/common/form-dialog";
import { leadStatusLabels, options } from "@/lib/labels";
import type { LeadStatus } from "@/generated/prisma/enums";
import {
  assignLeadAction,
  convertLeadAction,
  previewLeadMatchAction,
  updateLeadStatusAction,
} from "@/server/actions/leads";

export function LeadAssignSelect({
  leadId,
  assignedUserId,
  users,
  canAssign,
  currentUserId,
}: {
  leadId: string;
  assignedUserId: string | null;
  users: [string, string][];
  canAssign: boolean;
  currentUserId: string;
}) {
  const [pending, start] = useTransition();
  const run = (userId: string | null) =>
    start(async () => {
      const res = await assignLeadAction(leadId, userId);
      if (res?.ok) toast.success(res.message);
      else toast.error(res?.message);
    });

  if (!canAssign) {
    if (assignedUserId) return <span className="text-sm">{users.find(([id]) => id === assignedUserId)?.[1] ?? "—"}</span>;
    return (
      <Button size="xs" variant="outline" disabled={pending} onClick={() => run(currentUserId)}>
        Prendre
      </Button>
    );
  }
  return (
    <NativeSelect
      aria-label="Affecter à"
      className="h-8 min-w-36"
      options={users}
      placeholder="Non affecté"
      defaultValue={assignedUserId ?? ""}
      disabled={pending}
      onChange={(e) => run(e.target.value || null)}
    />
  );
}

export function LeadStatusDialog({ leadId, status, lostReason, label }: { leadId: string; status: LeadStatus; lostReason: string | null; label: React.ReactNode }) {
  const [selected, setSelected] = useState<string>(status);
  return (
    <FormDialog
      title="Statut du lead"
      trigger={
        <button type="button" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Changer le statut">
          {label}
        </button>
      }
      action={updateLeadStatusAction.bind(null, leadId)}
    >
      {(state) => (
        <div className="grid gap-4">
          <Field label="Statut" name="status" state={state}>
            <NativeSelect id="status" name="status" options={options(leadStatusLabels)} value={selected} onChange={(e) => setSelected(e.target.value)} />
          </Field>
          {selected === "perdu" && (
            <Field label="Motif de perte" name="lostReason" state={state}>
              <Input id="lostReason" name="lostReason" defaultValue={lostReason ?? ""} placeholder="Prix, dates, concurrent…" required />
            </Field>
          )}
        </div>
      )}
    </FormDialog>
  );
}

type MatchPreview = Awaited<ReturnType<typeof previewLeadMatchAction>>;

export function ConvertLeadDialog({
  lead,
}: {
  lead: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null };
}) {
  const router = useRouter();
  const [email, setEmail] = useState(lead.email ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [match, setMatch] = useState<MatchPreview>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const m = await previewLeadMatchAction(email || null, phone || null);
      if (!cancelled) setMatch(m);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [email, phone]);

  return (
    <FormDialog
      title="Convertir en contact"
      description="Dédoublonnage par email, puis par téléphone."
      submitLabel={match ? "Rattacher au contact existant" : "Créer le contact"}
      trigger={
        <Button size="xs" variant="outline">
          <UserPlus /> Convertir
        </Button>
      }
      action={convertLeadAction.bind(null, lead.id)}
      onSuccess={(s) => s.id && router.push(`/contacts/${s.id}`)}
    >
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" name="firstName" state={state}>
            <Input id="firstName" name="firstName" defaultValue={lead.firstName ?? ""} required />
          </Field>
          <Field label="Nom" name="lastName" state={state}>
            <Input id="lastName" name="lastName" defaultValue={lead.lastName ?? ""} required />
          </Field>
          <Field label="Email" name="email" state={state}>
            <Input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Téléphone" name="phone" state={state}>
            <Input id="phone" name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          {match && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Doublon détecté par {match.matchedOn === "email" ? "email" : "téléphone"} :{" "}
                <a href={`/contacts/${match.id}`} target="_blank" rel="noreferrer" className="font-medium underline">
                  {match.firstName} {match.lastName}
                </a>
                {match.city && ` (${match.city})`}. Le lead sera rattaché à ce contact.
              </span>
            </div>
          )}
        </div>
      )}
    </FormDialog>
  );
}
