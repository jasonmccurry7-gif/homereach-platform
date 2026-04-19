// GET /api/admin/content-intel/actions — today's actions for Sales Dashboard
//
// Visible to any authenticated agent; filters to pending items only.

import { NextResponse } from "next/server";
import { ciFlagGate, requireAgent } from "@/lib/content-intel/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = ciFlagGate();
  if (gate) return gate;
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supa
    .from("ci_actions")
    .select("id, category, title, steps, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
