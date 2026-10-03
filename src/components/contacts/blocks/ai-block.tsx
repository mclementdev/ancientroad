"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BlockCard } from "@/components/contacts/editable-card";
import { ScorePill } from "@/components/common/score";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/page-header";
import { analysisSchema, type AnalysisResult } from "@/lib/ai/schema";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// ───────────── État partagé bandeau ↔ bloc ─────────────

type AnalysisState =
  | { status: "idle" }
  | { status: "running"; startedAt: number }
  | { status: "error"; message: string; retryable: boolean };

const AnalysisContext = React.createContext<{ state: AnalysisState; run: () => void } | null>(null);

/** 65 s côté navigateur : le serveur coupe à 60 s et renvoie une erreur lisible. */
const CLIENT_TIMEOUT_MS = 65_000;

export function AnalysisProvider({ contactId, children }: { contactId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = React.useState<AnalysisState>({ status: "idle" });

  const run = React.useCallback(async () => {
    setState({ status: "running", startedAt: Date.now() });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch(`/api/contacts/${contactId}/analyze`, { method: "POST", signal: controller.signal });
      const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string; score?: number };
      if (!res.ok) {
        setState({
          status: "error",
          message: body.error ?? `Erreur ${res.status}`,
          retryable: body.code !== "rate_limited" && body.code !== "config",
        });
        return;
      }
      setState({ status: "idle" });
      toast.success(`Analyse terminée : score ${body.score}`);
      router.refresh();
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      setState({
        status: "error",
        message: aborted ? "Délai de 60 secondes dépassé" : "Connexion au serveur impossible",
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
    }
  }, [contactId, router]);

  return <AnalysisContext.Provider value={{ state, run }}>{children}</AnalysisContext.Provider>;
}

function useAnalysis() {
  const ctx = React.useContext(AnalysisContext);
  if (!ctx) throw new Error("AnalysisProvider manquant");
  return ctx;
}

export function AnalyzeButton() {
  const { state, run } = useAnalysis();
  const running = state.status === "running";
  return (
    <Button onClick={run} disabled={running}>
      {running ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {running ? "Analyse en cours…" : "Analyser avec Claude"}
    </Button>
  );
}

function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{Math.floor((now - startedAt) / 1000)} s</span>;
}

// ───────────── Bloc Analyse IA ─────────────

export type AnalysisRow = {
  id: string;
  score: number;
  summary: string;
  result: unknown;
  model: string;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
  createdByName: string | null;
};

const priorityTone = { haute: "danger", moyenne: "warning", basse: "muted" } as const;
const channelLabel = { telephone: "Téléphone", email: "Email", sms: "SMS", rendez_vous: "Rendez-vous" } as const;

export function AiAnalysisBlock({ analyses }: { analyses: AnalysisRow[] }) {
  const { state, run } = useAnalysis();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = analyses.find((a) => a.id === selectedId) ?? analyses[0] ?? null;

  return (
    <BlockCard title="Analyse IA" icon={<Sparkles className="size-4" />}>
      {state.status === "running" && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span className="flex-1">Claude analyse le dossier (60 s maximum)…</span>
          <Elapsed startedAt={state.startedAt} />
        </div>
      )}
      {state.status === "error" && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          <span className="flex-1">{state.message}</span>
          {state.retryable && (
            <Button size="sm" variant="outline" onClick={run}>
              <RotateCcw /> Réessayer
            </Button>
          )}
        </div>
      )}

      {!selected ? (
        <EmptyState>Aucune analyse pour ce contact. Lancez « Analyser avec Claude ».</EmptyState>
      ) : (
        <AnalysisView analysis={selected} isLatest={selected.id === analyses[0]?.id} />
      )}

      {analyses.length > 1 && (
        <div className="mt-6 border-t pt-4">
          <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Historique</div>
          <ul className="grid gap-1">
            {analyses.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                    selected?.id === a.id && "bg-accent",
                  )}
                >
                  <span className="w-36 shrink-0 text-muted-foreground">{formatDateTime(a.createdAt)}</span>
                  <ScorePill score={a.score} />
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {a.model === "seed-demo" ? "démo" : a.model}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BlockCard>
  );
}

function AnalysisView({ analysis, isLatest }: { analysis: AnalysisRow; isLatest: boolean }) {
  const parsed = analysisSchema.safeParse(analysis.result);
  const r: AnalysisResult | null = parsed.success ? parsed.data : null;
  const meta = (analysis.result as { _meta?: { warnings?: string[] } } | null)?._meta;

  return (
    <div className="grid gap-5 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {!isLatest && <StatusBadge label="Analyse antérieure" tone="muted" />}
        {analysis.model === "seed-demo" && <StatusBadge label="Données de démo" tone="warning" />}
        <span>{formatDateTime(analysis.createdAt)}</span>
        {analysis.createdByName && <span>par {analysis.createdByName}</span>}
        <span>{analysis.model}</span>
        {analysis.inputTokens > 0 && (
          <span className="tabular-nums">
            {analysis.inputTokens.toLocaleString("fr-FR")} tokens entrée · {analysis.outputTokens.toLocaleString("fr-FR")} sortie
          </span>
        )}
      </div>

      <p className="leading-relaxed">{analysis.summary}</p>
      {meta?.warnings && meta.warnings.length > 0 && (
        <p className="text-xs text-amber-700">⚠ {meta.warnings.join(" · ")}</p>
      )}

      {r && (
        <>
          <section>
            <h4 className="mb-2 font-medium">Détail du score</h4>
            <div className="grid gap-2">
              {r.score_breakdown.map((d) => {
                const negative = d.points < 0;
                const pct = d.max > 0 ? Math.max(0, Math.min(100, (d.points / d.max) * 100)) : 0;
                return (
                  <div key={d.dimension} className="grid gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{d.dimension}</span>
                      <span className={cn("tabular-nums", negative && "text-destructive")}>
                        {d.points}
                        {d.max > 0 && ` / ${d.max}`}
                      </span>
                    </div>
                    {d.max > 0 && (
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{d.reason}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {r.next_actions.length > 0 && (
            <section>
              <h4 className="mb-2 font-medium">Prochaines actions</h4>
              <ul className="grid gap-2">
                {r.next_actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-md border p-2.5">
                    <StatusBadge label={a.priority} tone={priorityTone[a.priority]} className="mt-0.5 capitalize" />
                    <div className="min-w-0 flex-1">
                      <div>{a.action}</div>
                      <div className="text-xs text-muted-foreground">
                        {channelLabel[a.channel]} · avant le {formatDate(a.deadline)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {r.call_pitch.length > 0 && (
            <section>
              <h4 className="mb-2 font-medium">Pitch d&apos;appel</h4>
              <ul className="grid gap-1.5 border-l-2 border-primary/40 pl-3 italic">
                {r.call_pitch.map((p, i) => (
                  <li key={i}>« {p} »</li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <section>
              <h4 className="mb-2 font-medium">Profil voyageur</h4>
              <p>{r.traveler_profile.style}</p>
              {r.traveler_profile.motivations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.traveler_profile.motivations.map((m) => (
                    <StatusBadge key={m} label={m} tone="neutral" />
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Budget estimé : {r.traveler_profile.budget_estimate}</p>
            </section>
            <section>
              <h4 className="mb-2 font-medium">Séjours recommandés</h4>
              {r.recommended_trips.length === 0 ? (
                <p className="text-muted-foreground">Aucun</p>
              ) : (
                <ul className="grid gap-2">
                  {r.recommended_trips.map((t) => (
                    <li key={t.trip_id}>
                      <a href={`/catalogue/${t.trip_id}`} className="font-medium hover:underline">
                        {t.name}
                      </a>
                      <p className="text-xs text-muted-foreground">{t.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <ListSection title="Risques" items={r.risks} />
            <ListSection title="Informations manquantes" items={r.missing_info} />
          </div>
        </>
      )}
    </div>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h4 className="mb-2 font-medium">{title}</h4>
      {items.length === 0 ? (
        <p className="text-muted-foreground">Aucun</p>
      ) : (
        <ul className="list-disc space-y-1 pl-4">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
