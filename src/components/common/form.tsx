"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/action";

export function SubmitButton({ children, className, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} className={className} {...props}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

export function Field({
  label,
  name,
  state,
  className,
  children,
  hint,
}: {
  label: string;
  name: string;
  state?: ActionState;
  className?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const errors = state?.fieldErrors?.[name];
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={name} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && !errors && <p className="text-xs text-muted-foreground">{hint}</p>}
      {errors?.map((e) => (
        <p key={e} className="text-xs text-destructive">
          {e}
        </p>
      ))}
    </div>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state?.message || state.ok) return null;
  return <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>;
}

/** <select> natif stylé comme les inputs shadcn : fonctionne directement dans les formulaires. */
export function NativeSelect({
  options,
  placeholder,
  className,
  ...props
}: React.ComponentProps<"select"> & { options: [string, string][]; placeholder?: string }) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

/**
 * Champ date + heure en heure locale du navigateur. Le formulaire reçoit, sous `name`,
 * la date convertie en ISO 8601 (UTC) pour que le serveur n'ait pas à deviner le fuseau.
 */
export function DateTimeInput({
  name,
  defaultValue = "",
  className,
  id,
}: {
  name: string;
  defaultValue?: string;
  className?: string;
  id?: string;
}) {
  const [local, setLocal] = React.useState(defaultValue);
  const parsed = local ? new Date(local) : null;
  const iso = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : "";
  return (
    <>
      <input type="hidden" name={name} value={iso} />
      <input
        id={id ?? name}
        type="datetime-local"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className={cn(
          "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          className,
        )}
      />
    </>
  );
}
