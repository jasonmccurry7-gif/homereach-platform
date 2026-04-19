// GET /api/admin/content-intel/signals
// Returns active (non-expired) market signals. Admin read + agent read.

import { NextResponse } from "next/server";
import { ciFlagGate, requireAgent } from "@/lib/content-intel/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = ciFlagGate();
  if (gate) return gate;
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  const nowIso = new Date().toISOString();
  const { data, error } = await auth.supa
    .from("ci_market_signals")
    .select("id, signal_type, category, location, severity, intensity_score, headline, description, source, effective_at, expires_at, created_at")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
