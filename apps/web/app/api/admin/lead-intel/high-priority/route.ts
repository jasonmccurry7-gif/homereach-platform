// GET /api/admin/lead-intel/high-priority
// Returns top N HIGH-tier leads, ranked by signal_score desc.
// Agent-readable. Flag-gated (404 when off).

import { NextResponse } from "next/server";
import { liFlagGate, requireAgent } from "@/lib/lead-intel/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = liFlagGate();
  if (gate) return gate;
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supa
    .from("sales_leads")
    .select("id, business_name, contact_name, phone, email, address, city, state, category, status, signal_score, signal_tier, last_contacted_at, signal_score_computed_at")
    .eq("signal_tier", "high")
    .eq("do_not_contact", false)
    .order("signal_score", { ascending: false })
    .order("last_contacted_at", { ascending: true, nullsFirst: true })
    .limit(25);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
