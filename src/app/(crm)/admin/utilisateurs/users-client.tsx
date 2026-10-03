"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, NativeSelect, SubmitButton } from "@/components/common/form";
import { options, roleLabels } from "@/lib/labels";
import { inviteUserAction, revokeInvitationAction, updateUserRoleAction } from "@/server/actions/auth";
import type { Role } from "@/generated/prisma/enums";

export function InviteForm() {
  const [state, action] = useActionState(inviteUserAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state]);
  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <Field label="Email" name="email" state={state}>
        <Input id="email" name="email" type="email" required />
      </Field>
      <Field label="Rôle" name="role" state={state}>
        <NativeSelect id="role" name="role" options={options(roleLabels)} defaultValue="conseiller" />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>Créer l&apos;invitation</SubmitButton>
      <p className="text-xs text-muted-foreground">
        Un lien valable 7 jours est généré : envoyez-le vous-même à la personne invitée.
      </p>
    </form>
  );
}

export function InvitationLink({ url }: { url: string }) {
  return (
    <div className="flex gap-2">
      <Input readOnly value={url} className="h-8 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label="Copier le lien"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          toast.success("Lien copié");
        }}
      >
        <Copy />
      </Button>
    </div>
  );
}

export function RevokeButton({ invitationId }: { invitationId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Révoquer"
      disabled={pending}
      onClick={() => start(() => revokeInvitationAction(invitationId))}
    >
      <Trash2 />
    </Button>
  );
}

export function RoleSelect({ userId, role }: { userId: string; role: Role }) {
  const [pending, start] = useTransition();
  return (
    <NativeSelect
      className="h-8"
      options={options(roleLabels)}
      defaultValue={role}
      disabled={pending}
      onChange={(e) => {
        const value = e.target.value;
        start(async () => {
          await updateUserRoleAction(userId, value);
          toast.success("Rôle mis à jour");
        });
      }}
    />
  );
}
