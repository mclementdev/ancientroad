import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { intakeLead, leadPayloadSchema } from "@/lib/domain/lead-intake";

function secretMatches(provided: string | null): boolean {
  const expected = process.env.LEADS_WEBHOOK_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Webhook des formulaires du site.
 * Header requis : X-Webhook-Secret. Corps JSON ou formulaire (application/x-www-form-urlencoded).
 */
export async function POST(req: Request) {
  if (!secretMatches(req.headers.get("x-webhook-secret"))) {
    return NextResponse.json({ error: "Secret invalide" }, { status: 401 });
  }

  let body: unknown;
  try {
    const type = req.headers.get("content-type") ?? "";
    body = type.includes("application/json")
      ? await req.json()
      : Object.fromEntries((await req.formData()).entries());
  } catch {
    return NextResponse.json({ error: "Corps de requête illisible" }, { status: 400 });
  }

  const parsed = leadPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: z.flattenError(parsed.error).fieldErrors },
      { status: 422 },
    );
  }

  try {
    const result = await intakeLead(parsed.data);
    return NextResponse.json(
      { ok: true, lead_id: result.leadId, contact_id: result.contactId, matched_on: result.matchedOn },
      { status: 201 },
    );
  } catch (err) {
    console.error("Webhook leads", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
