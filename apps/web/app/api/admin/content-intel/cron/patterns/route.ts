// POST /api/admin/content-intel/cron/patterns
// Weekly pattern detection pass over the last 30 days of competitor insights.
// Triggered by the scheduled task with the shared bearer secret.

import { NextResponse, type NextRequest } from "next/server";
import { ciFlagGate, requireCronSecret } from "@/lib/content-intel/guards";
import { detectPatterns } from "@/lib/content-intel/pattern-detector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const gate = ciFlagGate();
  if (gate) return gate;
  const auth = requireCronSecret(req);
  if (auth) return auth;

  try {
    const summary = await detectPatterns();
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
