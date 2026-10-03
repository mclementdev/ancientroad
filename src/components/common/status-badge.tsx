import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-secondary text-secondary-foreground",
  info: "bg-sky-100 text-sky-800",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-800",
  primary: "bg-primary/12 text-primary",
  muted: "bg-muted text-muted-foreground",
} as const;

export type Tone = keyof typeof tones;

const toneByValue: Record<string, Tone> = {
  // Contacts
  prospect: "info",
  client: "success",
  fidele: "primary",
  inactif: "muted",
  // Leads
  nouveau: "info",
  qualification: "warning",
  devis_envoye: "primary",
  gagne: "success",
  perdu: "muted",
  injoignable: "danger",
  // Départs
  ouvert: "info",
  garanti: "success",
  complet: "warning",
  termine: "muted",
  // Réservations
  option: "warning",
  confirme: "info",
  solde: "success",
  annule: "danger",
  // IA
  froid: "info",
  tiede: "warning",
  chaud: "primary",
  pret_a_reserver: "success",
  // Intérêt
  faible: "muted",
  moyen: "warning",
  fort: "success",
};

export function StatusBadge({ value, label, tone, className }: { value?: string; label: string; tone?: Tone; className?: string }) {
  const t = tone ?? (value ? toneByValue[value] : undefined) ?? "neutral";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[t], className)}>
      {label}
    </span>
  );
}
