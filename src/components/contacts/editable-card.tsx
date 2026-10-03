"use client";

import * as React from "react";
import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage, SubmitButton } from "@/components/common/form";
import type { ActionState } from "@/lib/action";
import { cn } from "@/lib/utils";

export function BlockCard({
  title,
  icon,
  actions,
  children,
  className,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
        {actions && <CardAction className="flex items-center gap-1">{actions}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Bloc de fiche avec bascule lecture / édition, branché sur une Server Action. */
export function EditableCard({
  title,
  icon,
  canEdit,
  action,
  view,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  canEdit: boolean;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  view: React.ReactNode;
  children: (state: ActionState) => React.ReactNode;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <BlockCard
      title={title}
      icon={icon}
      className={className}
      actions={
        canEdit &&
        !editing && (
          <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${title}`} onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
        )
      }
    >
      {editing ? (
        <EditForm action={action} onDone={() => setEditing(false)}>
          {children}
        </EditForm>
      ) : (
        view
      )}
    </BlockCard>
  );
}

function EditForm({
  action,
  onDone,
  children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  onDone: () => void;
  children: (state: ActionState) => React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  useEffect(() => {
    if (state?.ok) {
      if (state.message) toast.success(state.message);
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form action={formAction} className="grid gap-4">
      {children(state)}
      <FormMessage state={state} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Annuler
        </Button>
        <SubmitButton size="sm">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}

/** Liste de définitions « libellé : valeur » pour la vue lecture des blocs. */
export function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-2.5 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[120px_1fr] gap-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value === null || value === undefined || value === "" ? <span className="text-muted-foreground">—</span> : value}</dd>
        </div>
      ))}
    </dl>
  );
}
