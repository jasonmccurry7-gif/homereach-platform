// GET /api/admin/lead-intel/stats
// Returns tier distribution + last scoring run info. Admin-only.

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
    .select("signal_tier, signal_score_computed_at")
    .not("signal_tier", "is", null)
    .limit(50000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const tierCounts = { high: 0, medium: 0, low: 0 };
  let lastComputed: string | null = null;
  for (const r of (data ?? []) as any[]) {
    const t = r.signal_tier as "high" | "medium" | "low";
    if (t && tierCounts[t] !== undefined) tierCounts[t]++;
    if (r.signal_score_computed_at && (!lastComputed || r.signal_score_computed_at > lastComputed)) {
      lastComputed = r.signal_score_computed_at;
    }
  }

  return NextResponse.json({ ok: true, tierCounts, lastComputed, total: (data ?? []).length });
}
