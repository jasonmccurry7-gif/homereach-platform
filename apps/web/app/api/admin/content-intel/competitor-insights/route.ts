// GET /api/admin/content-intel/competitor-insights
// Returns recent competitor insights ordered by APEX score. Admin-only.

import { NextResponse } from "next/server";
import { ciFlagGate, requireAdmin } from "@/lib/content-intel/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = ciFlagGate();
  if (gate) return gate;
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.supa
    .from("ci_competitor_insights")
    .select("id, competitor_name, category, insight_type, insight_text, rationale, source_url, apex_score, status, created_at")
    .order("apex_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
