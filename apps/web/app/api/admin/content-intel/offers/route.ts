// GET /api/admin/content-intel/offers — pending offers

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
    .from("ci_offers")
    .select("id, category, title, improvement, supporting_script, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
