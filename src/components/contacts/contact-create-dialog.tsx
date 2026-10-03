"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/common/form";
import { FormDialog } from "@/components/common/form-dialog";
import { contactStatusLabels, genderLabels, options } from "@/lib/labels";
import { createContactAction } from "@/server/actions/contacts";

export function ContactCreateDialog({ users, canAssign }: { users: [string, string][]; canAssign: boolean }) {
  const router = useRouter();
  return (
    <FormDialog
      title="Nouveau contact"
      description="Les doublons sont détectés par email puis par téléphone."
      trigger={
        <Button>
          <Plus /> Nouveau contact
        </Button>
      }
      submitLabel="Créer"
      action={createContactAction}
      onSuccess={(s) => s.id && router.push(`/contacts/${s.id}`)}
    >
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Civilité" name="gender" state={state}>
            <NativeSelect id="gender" name="gender" options={options(genderLabels)} placeholder="—" />
          </Field>
          <Field label="Statut" name="status" state={state}>
            <NativeSelect id="status" name="status" options={options(contactStatusLabels)} defaultValue="prospect" />
          </Field>
          <Field label="Prénom" name="firstName" state={state}>
            <Input id="firstName" name="firstName" required autoFocus />
          </Field>
          <Field label="Nom" name="lastName" state={state}>
            <Input id="lastName" name="lastName" required />
          </Field>
          <Field label="Email" name="email" state={state}>
            <Input id="email" name="email" type="email" />
          </Field>
          <Field label="Mobile" name="phoneMobile" state={state}>
            <Input id="phoneMobile" name="phoneMobile" type="tel" placeholder="06 12 34 56 78" />
          </Field>
          <Field label="Ville" name="city" state={state}>
            <Input id="city" name="city" />
          </Field>
          {canAssign && (
            <Field label="Conseiller" name="ownerUserId" state={state}>
              <NativeSelect id="ownerUserId" name="ownerUserId" options={users} placeholder="Moi" />
            </Field>
          )}
        </div>
      )}
    </FormDialog>
  );
}
