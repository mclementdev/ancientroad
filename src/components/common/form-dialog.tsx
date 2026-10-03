"use client";

import * as React from "react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormMessage, SubmitButton } from "@/components/common/form";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/action";

type Props = {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  submitLabel?: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: (state: ActionState) => React.ReactNode;
  onSuccess?: (state: NonNullable<ActionState>) => void;
  className?: string;
};

/** Dialogue contenant un formulaire branché sur une Server Action ; se ferme en cas de succès. */
export function FormDialog({ trigger, title, description, submitLabel = "Enregistrer", action, children, onSuccess, className }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto sm:max-w-lg", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {open && (
          <DialogForm
            action={action}
            submitLabel={submitLabel}
            onDone={(state) => {
              setOpen(false);
              if (state.message) toast.success(state.message);
              onSuccess?.(state);
            }}
            onCancel={() => setOpen(false)}
          >
            {children}
          </DialogForm>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogForm({
  action,
  submitLabel,
  children,
  onDone,
  onCancel,
}: {
  action: Props["action"];
  submitLabel: string;
  children: Props["children"];
  onDone: (state: NonNullable<ActionState>) => void;
  onCancel: () => void;
}) {
  const [state, formAction] = useActionState(action, null);
  useEffect(() => {
    if (state?.ok) onDone(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form action={formAction} className="grid gap-4">
      {children(state)}
      <FormMessage state={state} />
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <SubmitButton>{submitLabel}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
