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

export const APP_TIMEZONE = "Europe/Paris";

/** Décalage (minutes) entre UTC et le fuseau donné à l'instant `date`. */
function tzOffsetMinutes(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** Minuit (heure de Paris) du jour de `now`, indépendamment du fuseau du serveur. */
export function startOfDayInAppTz(now: Date = new Date()): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const utcMidnight = new Date(`${ymd}T00:00:00Z`);
  return new Date(utcMidnight.getTime() - tzOffsetMinutes(utcMidnight, APP_TIMEZONE) * 60_000);
}
