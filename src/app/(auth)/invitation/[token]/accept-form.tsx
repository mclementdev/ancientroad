"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, SubmitButton } from "@/components/common/form";
import { acceptInvitationAction } from "@/server/actions/auth";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitationAction, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Nom complet" name="name" state={state}>
        <Input id="name" name="name" required autoFocus autoComplete="name" />
      </Field>
      <Field label="Mot de passe" name="password" state={state} hint="10 caractères minimum">
        <Input id="password" name="password" type="password" required autoComplete="new-password" />
      </Field>
      <Field label="Confirmation" name="confirm" state={state}>
        <Input id="confirm" name="confirm" type="password" required autoComplete="new-password" />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full">Créer mon compte</SubmitButton>
    </form>
  );
}
