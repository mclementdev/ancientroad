"use client";

import { Bike, IdCard, NotebookPen, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/common/form";
import { EditableCard, Facts } from "@/components/contacts/editable-card";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/normalize";
import {
  contactStatusLabels,
  genderLabels,
  licenseTypeLabels,
  options,
  riderRoleLabels,
  ridingLevelLabels,
} from "@/lib/labels";
import type { ContactStatus, Gender, LicenseType, RiderRole, RidingLevel } from "@/generated/prisma/enums";
import {
  updateConsentsAction,
  updateIdentityAction,
  updateNotesAction,
  updateRiderAction,
} from "@/server/actions/contacts";

export type IdentityData = {
  id: string;
  gender: Gender | null;
  firstName: string;
  lastName: string;
  birthDate: string; // YYYY-MM-DD ou ""
  email: string | null;
  phoneMobile: string | null;
  phoneHome: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  language: string;
  status: ContactStatus;
  ownerUserId: string | null;
  ownerName: string | null;
  age: number | null;
};

export function IdentityBlock({
  data,
  canEdit,
  canAssign,
  users,
}: {
  data: IdentityData;
  canEdit: boolean;
  canAssign: boolean;
  users: [string, string][];
}) {
  const address = [data.addressLine, [data.postalCode, data.city].filter(Boolean).join(" "), data.country]
    .filter(Boolean)
    .join(", ");
  return (
    <EditableCard
      title="Identité"
      icon={<IdCard className="size-4" />}
      canEdit={canEdit}
      action={updateIdentityAction.bind(null, data.id)}
      view={
        <Facts
          items={[
            ["Civilité", data.gender && genderLabels[data.gender]],
            ["Naissance", data.birthDate && `${formatDate(data.birthDate)}${data.age !== null ? ` (${data.age} ans)` : ""}`],
            ["Email", data.email && <a className="hover:underline" href={`mailto:${data.email}`}>{data.email}</a>],
            ["Mobile", data.phoneMobile && <a className="hover:underline" href={`tel:${data.phoneMobile}`}>{formatPhone(data.phoneMobile)}</a>],
            ["Fixe", data.phoneHome && formatPhone(data.phoneHome)],
            ["Adresse", address],
            ["Langue", data.language.toUpperCase()],
            ["Statut", contactStatusLabels[data.status]],
            ["Conseiller", data.ownerName],
          ]}
        />
      }
    >
      {(state) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Civilité" name="gender" state={state}>
            <NativeSelect id="gender" name="gender" options={options(genderLabels)} placeholder="—" defaultValue={data.gender ?? ""} />
          </Field>
          <Field label="Date de naissance" name="birthDate" state={state}>
            <Input id="birthDate" name="birthDate" type="date" defaultValue={data.birthDate} />
          </Field>
          <Field label="Prénom" name="firstName" state={state}>
            <Input id="firstName" name="firstName" defaultValue={data.firstName} required />
          </Field>
          <Field label="Nom" name="lastName" state={state}>
            <Input id="lastName" name="lastName" defaultValue={data.lastName} required />
          </Field>
          <Field label="Email" name="email" state={state} className="sm:col-span-2">
            <Input id="email" name="email" type="email" defaultValue={data.email ?? ""} />
          </Field>
          <Field label="Mobile" name="phoneMobile" state={state}>
            <Input id="phoneMobile" name="phoneMobile" type="tel" defaultValue={data.phoneMobile ?? ""} />
          </Field>
          <Field label="Fixe" name="phoneHome" state={state}>
            <Input id="phoneHome" name="phoneHome" type="tel" defaultValue={data.phoneHome ?? ""} />
          </Field>
          <Field label="Adresse" name="addressLine" state={state} className="sm:col-span-2">
            <Input id="addressLine" name="addressLine" defaultValue={data.addressLine ?? ""} />
          </Field>
          <Field label="Code postal" name="postalCode" state={state}>
            <Input id="postalCode" name="postalCode" defaultValue={data.postalCode ?? ""} />
          </Field>
          <Field label="Ville" name="city" state={state}>
            <Input id="city" name="city" defaultValue={data.city ?? ""} />
          </Field>
          <Field label="Pays (ISO)" name="country" state={state}>
            <Input id="country" name="country" maxLength={2} defaultValue={data.country ?? ""} />
          </Field>
          <Field label="Langue" name="language" state={state}>
            <NativeSelect id="language" name="language" options={[["fr", "Français"], ["en", "Anglais"], ["de", "Allemand"], ["es", "Espagnol"], ["it", "Italien"], ["nl", "Néerlandais"]]} defaultValue={data.language} />
          </Field>
          <Field label="Statut" name="status" state={state}>
            <NativeSelect id="status" name="status" options={options(contactStatusLabels)} defaultValue={data.status} />
          </Field>
          <Field label="Conseiller" name="ownerUserId" state={state} hint={canAssign ? undefined : "Réservé aux managers"}>
            <NativeSelect id="ownerUserId" name="ownerUserId" options={users} placeholder="Aucun" defaultValue={data.ownerUserId ?? ""} disabled={!canAssign} />
          </Field>
        </div>
      )}
    </EditableCard>
  );
}

export type RiderData = {
  id: string;
  riderRole: RiderRole | null;
  licenseType: LicenseType | null;
  licenseDate: string;
  ridingLevel: RidingLevel | null;
  heightCm: number | null;
  diet: string | null;
};

export function RiderBlock({ data, canEdit }: { data: RiderData; canEdit: boolean }) {
  const licenseYears = data.licenseDate
    ? Math.floor((Date.now() - new Date(data.licenseDate).getTime()) / (365.25 * 86_400_000))
    : null;
  return (
    <EditableCard
      title="Profil rider"
      icon={<Bike className="size-4" />}
      canEdit={canEdit}
      action={updateRiderAction.bind(null, data.id)}
      view={
        <Facts
          items={[
            ["Rôle", data.riderRole && riderRoleLabels[data.riderRole]],
            ["Permis", data.licenseType && licenseTypeLabels[data.licenseType]],
            ["Depuis", data.licenseDate && `${formatDate(data.licenseDate)} (${licenseYears} ans)`],
            ["Niveau", data.ridingLevel && ridingLevelLabels[data.ridingLevel]],
            ["Taille", data.heightCm && `${data.heightCm} cm`],
            ["Régime", data.diet],
          ]}
        />
      }
    >
      {(state) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rôle" name="riderRole" state={state}>
            <NativeSelect id="riderRole" name="riderRole" options={options(riderRoleLabels)} placeholder="—" defaultValue={data.riderRole ?? ""} />
          </Field>
          <Field label="Niveau" name="ridingLevel" state={state}>
            <NativeSelect id="ridingLevel" name="ridingLevel" options={options(ridingLevelLabels)} placeholder="—" defaultValue={data.ridingLevel ?? ""} />
          </Field>
          <Field label="Permis" name="licenseType" state={state}>
            <NativeSelect id="licenseType" name="licenseType" options={options(licenseTypeLabels)} placeholder="—" defaultValue={data.licenseType ?? ""} />
          </Field>
          <Field label="Date du permis" name="licenseDate" state={state}>
            <Input id="licenseDate" name="licenseDate" type="date" defaultValue={data.licenseDate} />
          </Field>
          <Field label="Taille (cm)" name="heightCm" state={state}>
            <Input id="heightCm" name="heightCm" type="number" min={100} max={230} defaultValue={data.heightCm ?? ""} />
          </Field>
          <Field label="Régime alimentaire" name="diet" state={state}>
            <Input id="diet" name="diet" defaultValue={data.diet ?? ""} />
          </Field>
        </div>
      )}
    </EditableCard>
  );
}

export function NotesBlock({ id, notes, canEdit }: { id: string; notes: string | null; canEdit: boolean }) {
  return (
    <EditableCard
      title="Notes libres"
      icon={<NotebookPen className="size-4" />}
      canEdit={canEdit}
      action={updateNotesAction.bind(null, id)}
      view={
        notes ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune note</p>
        )
      }
    >
      {() => <Textarea name="freeNotes" rows={8} defaultValue={notes ?? ""} autoFocus />}
    </EditableCard>
  );
}

export type ConsentData = { id: string; newsletterOptin: boolean; smsOptin: boolean; consentDate: string | null };

export function ConsentsBlock({ data, canEdit }: { data: ConsentData; canEdit: boolean }) {
  const yesNo = (v: boolean) => (v ? <span className="text-emerald-700">Oui</span> : <span className="text-muted-foreground">Non</span>);
  return (
    <EditableCard
      title="Consentements"
      icon={<ShieldCheck className="size-4" />}
      canEdit={canEdit}
      action={updateConsentsAction.bind(null, data.id)}
      view={
        <Facts
          items={[
            ["Newsletter", yesNo(data.newsletterOptin)],
            ["SMS", yesNo(data.smsOptin)],
            ["Recueilli le", data.consentDate && formatDateTime(data.consentDate)],
          ]}
        />
      }
    >
      {(state) => (
        <div className="grid gap-3">
          <div className="flex items-center gap-2">
            <Checkbox id="newsletterOptin" name="newsletterOptin" defaultChecked={data.newsletterOptin} />
            <Label htmlFor="newsletterOptin">Accepte la newsletter</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="smsOptin" name="smsOptin" defaultChecked={data.smsOptin} />
            <Label htmlFor="smsOptin">Accepte les SMS</Label>
          </div>
          <Field label="Date du consentement" name="consentDate" state={state} hint="Laisser vide : date du jour si un consentement est coché">
            <Input id="consentDate" name="consentDate" type="date" defaultValue={data.consentDate?.slice(0, 10) ?? ""} />
          </Field>
        </div>
      )}
    </EditableCard>
  );
}
