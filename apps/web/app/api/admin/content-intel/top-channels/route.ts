// GET /api/admin/content-intel/top-channels
// Returns active trusted channels ranked by performance_score desc.
// Admin-only.

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
    .from("ci_trusted_channels")
    .select("id, channel_name, channel_id, channel_url, category, specialty, trust_score, performance_score, force_include, translate_saas, active_flag, last_used, notes")
    .eq("active_flag", true)
    .order("performance_score", { ascending: false })
    .order("trust_score", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
