"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, SubmitButton } from "@/components/common/form";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action] = useActionState(loginAction, null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <Field label="Email" name="email">
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </Field>
          <Field label="Mot de passe" name="password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <FormMessage state={state} />
          <SubmitButton className="w-full">Se connecter</SubmitButton>
          <p className="text-center text-xs text-muted-foreground">
            Pas de compte ? Demandez une invitation à un administrateur.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
