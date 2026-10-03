import type { AiLevel } from "@/generated/prisma/enums";
import { aiLevelLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function levelFromScore(score: number): AiLevel {
  if (score >= 75) return "pret_a_reserver";
  if (score >= 50) return "chaud";
  if (score >= 25) return "tiede";
  return "froid";
}

const levelColor: Record<AiLevel, string> = {
  froid: "#3b82f6",
  tiede: "#d97706",
  chaud: "#c2410c",
  pret_a_reserver: "#059669",
};

/** Pastille compacte « 72 · Chaud » pour les listes. */
export function ScorePill({ score, className }: { score: number | null; className?: string }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  const level = levelFromScore(score);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", className)}>
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-muted">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${score}%`, background: levelColor[level] }} />
      </span>
      <span className="tabular-nums">{score}</span>
      <span className="text-muted-foreground">{aiLevelLabels[level]}</span>
    </span>
  );
}

/** Jauge semi-circulaire du bandeau de la fiche client. */
export function ScoreGauge({ score, size = 112 }: { score: number | null; size?: number }) {
  const r = 40;
  const arc = Math.PI * r;
  const value = score ?? 0;
  const level = score === null ? null : levelFromScore(score);
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 100 56" width={size} height={size * 0.56} aria-label={score === null ? "Pas encore de score" : `Score ${score} sur 100`}>
        <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="var(--muted)" strokeWidth="9" strokeLinecap="round" />
        {score !== null && (
          <path
            d="M10 50 A40 40 0 0 1 90 50"
            fill="none"
            stroke={levelColor[level!]}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * arc} ${arc}`}
          />
        )}
        <text x="50" y="48" textAnchor="middle" fontSize="20" fontWeight="600" fill="currentColor">
          {score ?? "—"}
        </text>
      </svg>
      <span className="text-xs font-medium" style={{ color: level ? levelColor[level] : undefined }}>
        {level ? aiLevelLabels[level] : "Non analysé"}
      </span>
    </div>
  );
}
