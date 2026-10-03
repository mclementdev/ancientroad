const currencyFormatters = new Map<string, Intl.NumberFormat>();

type Numeric = number | string | { toString(): string } | null | undefined;

export function toNumber(value: Numeric): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

export function formatCurrency(value: Numeric, currency = "EUR"): string {
  let fmt = currencyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 });
    currencyFormatters.set(currency, fmt);
  }
  return fmt.format(toNumber(value));
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Paris" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export function formatDate(value: Date | string | null | undefined): string {
  return value ? dateFmt.format(new Date(value)) : "—";
}

export function formatDateTime(value: Date | string | null | undefined): string {
  return value ? dateTimeFmt.format(new Date(value)) : "—";
}

export function formatTime(value: Date | string | null | undefined): string {
  return value ? timeFmt.format(new Date(value)) : "";
}

/** Valeur pour un <input type="date"> (YYYY-MM-DD, UTC car les colonnes sont @db.Date). */
export function toDateInput(value: Date | string | null | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

/** Valeur pour un <input type="datetime-local"> en heure locale. */
export function toDateTimeInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fullName(c: { firstName: string; lastName: string }): string {
  return `${c.firstName} ${c.lastName}`;
}
