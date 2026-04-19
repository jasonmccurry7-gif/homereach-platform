// POST /api/admin/lead-intel/cron/rescore
// Daily batch rescoring. Bearer-authed via CONTENT_INTEL_CRON_SECRET.

import { NextResponse, type NextRequest } from "next/server";
import { liFlagGate, requireCronSecret } from "@/lib/lead-intel/guards";
import { rescoreAllLeads } from "@/lib/lead-intel/rescorer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;

export async function POST(req: NextRequest) {
  const gate = liFlagGate();
  if (gate) return gate;
  const auth = requireCronSecret(req);
  if (auth) return auth;

  try {
    const summary = await rescoreAllLeads();
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
