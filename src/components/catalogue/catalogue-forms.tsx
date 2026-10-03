"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/common/form";
import { FormDialog } from "@/components/common/form-dialog";
import { departureStatusLabels, options, ridingLevelLabels, tripFormatLabels } from "@/lib/labels";
import {
  deleteDepartureAction,
  deleteTripAction,
  saveDepartureAction,
  saveTripAction,
} from "@/server/actions/trips";

export type TripFormValues = {
  id: string;
  name: string;
  destination: string;
  country: string;
  region: string | null;
  durationDays: number;
  level: string;
  format: string;
  motorcycleModel: string | null;
  basePrice: number;
  description: string | null;
  active: boolean;
};

export type DepartureFormValues = {
  id: string;
  startDate: string;
  endDate: string;
  price: number;
  seatsTotal: number;
  status: string;
};

export function TripDialog({ trip }: { trip?: TripFormValues }) {
  const router = useRouter();
  return (
    <FormDialog
      title={trip ? "Modifier le séjour" : "Nouveau séjour"}
      trigger={
        trip ? (
          <Button variant="outline" size="sm">
            <Pencil /> Modifier
          </Button>
        ) : (
          <Button>
            <Plus /> Nouveau séjour
          </Button>
        )
      }
      action={saveTripAction.bind(null, trip?.id ?? null)}
      onSuccess={(s) => !trip && s.id && router.push(`/catalogue/${s.id}`)}
      className="sm:max-w-2xl"
    >
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom" name="name" state={state} className="sm:col-span-2">
            <Input id="name" name="name" defaultValue={trip?.name} required />
          </Field>
          <Field label="Destination" name="destination" state={state} hint="Ex. Inde, Népal, Europe">
            <Input id="destination" name="destination" defaultValue={trip?.destination} required />
          </Field>
          <Field label="Pays (ISO)" name="country" state={state} hint="2 lettres : IN, NP, MA…">
            <Input id="country" name="country" defaultValue={trip?.country} maxLength={2} required />
          </Field>
          <Field label="Région" name="region" state={state}>
            <Input id="region" name="region" defaultValue={trip?.region ?? ""} />
          </Field>
          <Field label="Durée (jours)" name="durationDays" state={state}>
            <Input id="durationDays" name="durationDays" type="number" min={1} defaultValue={trip?.durationDays} required />
          </Field>
          <Field label="Niveau requis" name="level" state={state}>
            <NativeSelect id="level" name="level" options={options(ridingLevelLabels)} defaultValue={trip?.level ?? "intermediaire"} />
          </Field>
          <Field label="Format" name="format" state={state}>
            <NativeSelect id="format" name="format" options={options(tripFormatLabels)} defaultValue={trip?.format ?? "guide"} />
          </Field>
          <Field label="Moto fournie" name="motorcycleModel" state={state}>
            <Input id="motorcycleModel" name="motorcycleModel" defaultValue={trip?.motorcycleModel ?? ""} />
          </Field>
          <Field label="Prix de base (€)" name="basePrice" state={state}>
            <Input id="basePrice" name="basePrice" type="number" min={0} step="1" defaultValue={trip?.basePrice} required />
          </Field>
          <Field label="Description" name="description" state={state} className="sm:col-span-2">
            <Textarea id="description" name="description" rows={3} defaultValue={trip?.description ?? ""} />
          </Field>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox id="active" name="active" defaultChecked={trip?.active ?? true} />
            <Label htmlFor="active">Séjour actif (proposé à la vente et à l&apos;IA)</Label>
          </div>
        </div>
      )}
    </FormDialog>
  );
}

export function DeleteTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm("Supprimer définitivement ce séjour et ses départs ?")) return;
        start(async () => {
          const res = await deleteTripAction(tripId);
          if (res?.ok) {
            toast.success(res.message);
            router.push("/catalogue");
          } else toast.error(res?.message);
        });
      }}
    >
      <Trash2 /> Supprimer
    </Button>
  );
}

export function DepartureDialog({
  tripId,
  departure,
  defaults,
}: {
  tripId: string;
  departure?: DepartureFormValues;
  defaults?: { price: number };
}) {
  return (
    <FormDialog
      title={departure ? "Modifier le départ" : "Nouveau départ"}
      trigger={
        departure ? (
          <Button variant="ghost" size="icon-sm" aria-label="Modifier">
            <Pencil />
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> Ajouter un départ
          </Button>
        )
      }
      action={saveDepartureAction.bind(null, { tripId, departureId: departure?.id ?? null })}
    >
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Début" name="startDate" state={state}>
            <Input id="startDate" name="startDate" type="date" defaultValue={departure?.startDate} required />
          </Field>
          <Field label="Fin" name="endDate" state={state}>
            <Input id="endDate" name="endDate" type="date" defaultValue={departure?.endDate} required />
          </Field>
          <Field label="Prix (€)" name="price" state={state}>
            <Input id="price" name="price" type="number" min={0} defaultValue={departure?.price ?? defaults?.price} required />
          </Field>
          <Field label="Places" name="seatsTotal" state={state} hint="Les places restantes sont recalculées">
            <Input id="seatsTotal" name="seatsTotal" type="number" min={1} defaultValue={departure?.seatsTotal ?? 10} required />
          </Field>
          <Field label="Statut" name="status" state={state} className="sm:col-span-2">
            <NativeSelect id="status" name="status" options={options(departureStatusLabels)} defaultValue={departure?.status ?? "ouvert"} />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

export function DeleteDepartureButton({ departureId }: { departureId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Supprimer"
      disabled={pending}
      onClick={() => {
        if (!confirm("Supprimer ce départ ?")) return;
        start(async () => {
          const res = await deleteDepartureAction(departureId);
          if (res?.ok) toast.success(res.message);
          else toast.error(res?.message);
        });
      }}
    >
      <Trash2 />
    </Button>
  );
}

