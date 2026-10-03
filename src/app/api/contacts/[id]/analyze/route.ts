import { NextResponse } from "next/server";
import { AnalysisError, runContactAnalysis } from "@/lib/ai/analyze";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// L'appel à Claude peut durer jusqu'à 60 s : on laisse de la marge à la fonction Vercel
export const maxDuration = 90;

const statusByCode: Record<string, number> = {
  rate_limited: 429,
  busy: 409,
  timeout: 504,
  config: 500,
  api: 502,
  refusal: 422,
  no_tool_call: 502,
  invalid_output: 502,
};

export async function POST(_req: Request, ctx: RouteContext<"/api/contacts/[id]/analyze">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await ctx.params;
  const exists = await db.contact.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Contact introuvable" }, { status: 404 });

  try {
    const analysis = await runContactAnalysis({ contactId: id, userId: user.id });
    return NextResponse.json({ ok: true, analysisId: analysis.id, score: analysis.score });
  } catch (err) {
    if (err instanceof AnalysisError) {
      const headers = err.retryAfterSec ? { "Retry-After": String(err.retryAfterSec) } : undefined;
      return NextResponse.json(
        { error: err.message, code: err.code, retryAfter: err.retryAfterSec },
        { status: statusByCode[err.code] ?? 500, headers },
      );
    }
    console.error("Analyse IA", err);
    return NextResponse.json({ error: "Erreur inattendue pendant l'analyse", code: "unknown" }, { status: 500 });
  }
}
