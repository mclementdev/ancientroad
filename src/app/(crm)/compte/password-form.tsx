"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, SubmitButton } from "@/components/common/form";
import { changePasswordAction } from "@/server/actions/auth";

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state]);
  return (
    <form ref={formRef} action={action} className="grid gap-4">
      <Field label="Mot de passe actuel" name="current" state={state}>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="Nouveau mot de passe" name="password" state={state} hint="10 caractères minimum">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirmation" name="confirm" state={state}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>Enregistrer</SubmitButton>
    </form>
  );
}
