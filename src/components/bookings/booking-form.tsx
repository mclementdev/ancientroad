"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/common/form";
import { ContactPicker, type PickedContact } from "@/components/contacts/contact-picker";
import { bookingStatusLabels, options, riderRoleLabels } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/format";
import type { BookingStatus, RiderRole } from "@/generated/prisma/enums";
import { saveBookingAction } from "@/server/actions/bookings";

/** Tarif passager par défaut, en part du prix pilote (modifiable ligne par ligne). */
const PASSENGER_RATIO = 0.65;

export type DepartureOption = {
  id: string;
  tripName: string;
  startDate: string;
  price: number;
  seatsLeft: number;
  status: string;
};

type Row = { key: number; contact: PickedContact | null; role: RiderRole; amount: string };

export type BookingFormInitial = {
  departureId: string;
  payer: PickedContact | null;
  status: BookingStatus;
  participants: { contact: PickedContact; role: RiderRole; amount: number }[];
};

let keySeq = 0;

export function BookingForm({
  bookingId,
  departures,
  initial,
}: {
  bookingId?: string;
  departures: DepartureOption[];
  initial?: Partial<BookingFormInitial>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [departureId, setDepartureId] = useState(initial?.departureId ?? "");
  const [status, setStatus] = useState<BookingStatus>(initial?.status ?? "option");
  const [payer, setPayer] = useState<PickedContact | null>(initial?.payer ?? null);
  const [rows, setRows] = useState<Row[]>(() =>
    initial?.participants?.length
      ? initial.participants.map((p) => ({ key: keySeq++, contact: p.contact, role: p.role, amount: String(p.amount) }))
      : initial?.payer
        ? [
            {
              key: keySeq++,
              contact: initial.payer,
              role: "pilote",
              amount: String(departures.find((d) => d.id === initial.departureId)?.price ?? ""),
            },
          ]
        : [],
  );

  const departure = departures.find((d) => d.id === departureId);
  const priceFor = (role: RiderRole) => (departure ? String(role === "passager" ? Math.round(departure.price * PASSENGER_RATIO) : departure.price) : "");

  const byTrip = useMemo(() => {
    const groups = new Map<string, DepartureOption[]>();
    for (const d of departures) groups.set(d.tripName, [...(groups.get(d.tripName) ?? []), d]);
    return [...groups.entries()];
  }, [departures]);

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const pilots = rows.filter((r) => r.role === "pilote").length;
  const passengers = rows.length - pilots;

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function changeDeparture(id: string) {
    setDepartureId(id);
    const d = departures.find((x) => x.id === id);
    // Pré-remplit les montants vides avec le tarif du départ
    if (d) setRows((rs) => rs.map((r) => (r.amount ? r : { ...r, amount: String(r.role === "passager" ? Math.round(d.price * PASSENGER_RATIO) : d.price) })));
  }

  function changePayer(c: PickedContact | null) {
    setPayer(c);
    if (c && rows.length === 0) setRows([{ key: keySeq++, contact: c, role: "pilote", amount: priceFor("pilote") }]);
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await saveBookingAction(bookingId ?? null, {
        departureId,
        payerContactId: payer?.id ?? "",
        status,
        participants: rows.map((r) => ({ contactId: r.contact?.id ?? "", role: r.role, amount: r.amount || "0" })),
      });
      if (res?.ok) {
        toast.success(res.message);
        router.push(`/reservations/${res.id}`);
      } else {
        const fieldMsg = res?.fieldErrors && Object.values(res.fieldErrors).flat().filter(Boolean)[0];
        setError(fieldMsg ? `${res?.message} : ${fieldMsg}` : (res?.message ?? "Erreur"));
      }
    });
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="grid gap-1.5">
          <Label htmlFor="departure" className="text-xs text-muted-foreground">Départ</Label>
          <select
            id="departure"
            value={departureId}
            onChange={(e) => changeDeparture(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">— Choisir un départ —</option>
            {byTrip.map(([trip, deps]) => (
              <optgroup key={trip} label={trip}>
                {deps.map((d) => (
                  <option key={d.id} value={d.id} disabled={d.seatsLeft <= 0 && d.id !== initial?.departureId}>
                    {formatDate(d.startDate)} · {formatCurrency(d.price)} · {d.seatsLeft} place(s)
                    {d.status === "garanti" ? " · garanti" : d.status === "complet" ? " · complet" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="status" className="text-xs text-muted-foreground">Statut</Label>
          <NativeSelect id="status" options={options(bookingStatusLabels)} value={status} onChange={(e) => setStatus(e.target.value as BookingStatus)} />
        </div>
      </div>

      <div className="grid gap-1.5 md:max-w-md">
        <Label className="text-xs text-muted-foreground">Payeur</Label>
        <ContactPicker value={payer} onChange={changePayer} placeholder="Qui règle la réservation ?" />
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Participants{" "}
            <span className="font-normal text-muted-foreground">
              · {pilots} pilote(s), {passengers} passager(s)
            </span>
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRows((rs) => [...rs, { key: keySeq++, contact: null, role: "pilote", amount: priceFor("pilote") }])}
          >
            <Plus /> Ajouter
          </Button>
        </div>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Ajoutez au moins un participant (le payeur peut en faire partie).</p>}
        {rows.map((r) => (
          <div key={r.key} className="grid items-center gap-2 rounded-md border p-2 sm:grid-cols-[minmax(0,2fr)_140px_140px_auto]">
            <ContactPicker
              value={r.contact}
              onChange={(c) => update(r.key, { contact: c })}
              excludeIds={rows.filter((x) => x.key !== r.key && x.contact).map((x) => x.contact!.id)}
            />
            <NativeSelect
              aria-label="Rôle"
              options={options(riderRoleLabels)}
              value={r.role}
              onChange={(e) => {
                const role = e.target.value as RiderRole;
                update(r.key, { role, amount: priceFor(role) || r.amount });
              }}
            />
            <div className="relative">
              <Input
                aria-label="Montant"
                type="number"
                min={0}
                value={r.amount}
                onChange={(e) => update(r.key, { amount: e.target.value })}
                className="pr-6"
              />
              <span className="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Retirer" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Tarif passager proposé par défaut : {Math.round(PASSENGER_RATIO * 100)} % du prix pilote.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
        <div className="text-sm">
          Total : <span className="text-lg font-semibold tabular-nums">{formatCurrency(total)}</span>
          {departure && rows.length > departure.seatsLeft && !bookingId && (
            <span className="ml-3 text-destructive">Seulement {departure.seatsLeft} place(s) restante(s)</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-destructive">{error}</span>}
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {bookingId ? "Enregistrer" : "Créer la réservation"}
          </Button>
        </div>
      </div>
    </div>
  );
}
