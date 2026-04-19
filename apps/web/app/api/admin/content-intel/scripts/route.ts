// GET /api/admin/content-intel/scripts — pending scripts for agents

import { NextResponse } from "next/server";
import { ciFlagGate, requireAgent } from "@/lib/content-intel/guards";
import { HOME_SERVICE_CATEGORIES } from "@/lib/content-intel/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = ciFlagGate();
  if (gate) return gate;
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  // Agent-visible scripts only. Dan Martell / scaling content is admin-only.
  const { data, error } = await auth.supa
    .from("ci_scripts")
    .select("id, category, channel, title, body, status, created_at")
    .eq("status", "pending")
    .in("category", [...HOME_SERVICE_CATEGORIES])
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
