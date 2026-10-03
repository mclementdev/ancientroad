"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput, NativeSelect } from "@/components/common/form";
import { ContactPicker, type PickedContact } from "@/components/contacts/contact-picker";
import { cn } from "@/lib/utils";
import { getContactBriefAction, quickCallAction } from "@/server/actions/quick-call";

/** Bouton + dialogue « Nouvel appel », disponible partout (raccourci : Alt + N). */
export function QuickCall({ trips }: { trips: [string, string][] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey && (e.key === "n" || e.key === "N" || e.code === "KeyN")) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" title="Nouvel appel (Alt + N)">
        <PhoneCall /> Nouvel appel
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nouvel appel</DialogTitle>
            <DialogDescription>Notez l&apos;appel pendant ou juste après la conversation.</DialogDescription>
          </DialogHeader>
          {open && <QuickCallForm trips={trips} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function QuickCallForm({ trips, onDone }: { trips: [string, string][]; onDone: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"entrant" | "sortant">("entrant");
  const [mode, setMode] = useState<"known" | "unknown">("known");
  const [contact, setContact] = useState<PickedContact | null>(null);
  const [reached, setReached] = useState(true);

  // Sur une fiche contact, le contact est pré-sélectionné
  useEffect(() => {
    const m = pathname.match(/^\/contacts\/([^/]+)$/);
    if (!m) return;
    getContactBriefAction(m[1]).then((c) => c && setContact(c));
  }, [pathname]);

  function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const get = (k: string) => (fd.get(k) as string | null)?.trim() || undefined;
    setError(null);
    start(async () => {
      const res = await quickCallAction({
        direction,
        contactId: mode === "known" ? contact?.id : undefined,
        firstName: mode === "unknown" ? get("firstName") : undefined,
        lastName: mode === "unknown" ? get("lastName") : undefined,
        phone: mode === "unknown" ? get("phone") : undefined,
        email: mode === "unknown" ? get("email") : undefined,
        subject: get("subject"),
        summary: get("summary"),
        tripId: get("tripId"),
        followUpAt: get("followUpAt"),
        reached,
      });
      if (!res?.ok) {
        const field = res?.fieldErrors && Object.values(res.fieldErrors).flat().filter(Boolean)[0];
        setError(field ?? res?.message ?? "Erreur");
        return;
      }
      toast.success(res.message);
      onDone();
      if (res.id?.startsWith("lead:")) router.push("/leads");
      else if (res.id && !pathname.startsWith(`/contacts/${res.id}`)) router.push(`/contacts/${res.id}`);
    });
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
    >
      <div className="flex flex-wrap gap-2">
        <Segmented value={direction} onChange={setDirection} options={[["entrant", "Entrant"], ["sortant", "Sortant"]]} />
        <Segmented value={mode} onChange={setMode} options={[["known", "Contact connu"], ["unknown", "Nouveau correspondant"]]} />
      </div>

      {mode === "known" ? (
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Contact</Label>
          <ContactPicker value={contact} onChange={setContact} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="firstName" placeholder="Prénom" aria-label="Prénom" />
          <Input name="lastName" placeholder="Nom" aria-label="Nom" />
          <Input name="phone" type="tel" placeholder="Téléphone" aria-label="Téléphone" />
          <Input name="email" type="email" placeholder="Email" aria-label="Email" />
          <p className="text-xs text-muted-foreground sm:col-span-2">
            S&apos;il correspond à un contact existant (email puis téléphone), l&apos;appel y est rattaché ; sinon un lead est créé.
          </p>
        </div>
      )}

      <div className="grid gap-3">
        <Input name="subject" placeholder="Objet (ex. Projet Mongolie 2027)" aria-label="Objet" />
        <Textarea name="summary" rows={5} placeholder="Ce qui a été dit, questions, objections, prochaines étapes…" aria-label="Résumé" />
        <div className="flex items-center gap-2">
          <Checkbox id="notReached" checked={!reached} onCheckedChange={(v) => setReached(v !== true)} />
          <Label htmlFor="notReached" className="text-sm font-normal">Non joint (messagerie, pas de réponse)</Label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="tripId" className="text-xs text-muted-foreground">Séjour évoqué</Label>
          <NativeSelect id="tripId" name="tripId" options={trips} placeholder="—" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="followUpAt" className="text-xs text-muted-foreground">Rappel à programmer</Label>
          <DateTimeInput name="followUpAt" />
        </div>
      </div>

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Enregistrer l&apos;appel
        </Button>
      </DialogFooter>
    </form>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex rounded-md border p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn("rounded px-3 py-1 text-sm", value === v ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
