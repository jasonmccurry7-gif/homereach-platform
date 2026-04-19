// GET /api/admin/content-intel/patterns
// Returns promoted recurring patterns across competitors. Admin-only.

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
    .from("ci_patterns")
    .select("id, category, pattern, source_count, win_count, weight, last_win_at, created_at")
    .order("weight", { ascending: false })
    .order("source_count", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
