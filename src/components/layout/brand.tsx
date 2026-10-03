import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path
        d="M6 25 C 11 19, 13 15, 16 7 C 19 15, 21 19, 26 25"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M16 13 v 2.5 M16 18.5 v 2.5" stroke="var(--primary-foreground)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-wide">Ancient Roads</div>
        <div className="text-[11px] opacity-70">CRM voyages moto</div>
      </div>
    </div>
  );
}
