// POST /api/admin/content-intel/cron/signals
// Daily poll of NOAA severe-weather alerts.
// Triggered by the scheduled task with the shared bearer secret.

import { NextResponse, type NextRequest } from "next/server";
import { ciFlagGate, requireCronSecret } from "@/lib/content-intel/guards";
import { refreshMarketSignals } from "@/lib/content-intel/signals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const gate = ciFlagGate();
  if (gate) return gate;
  const auth = requireCronSecret(req);
  if (auth) return auth;

  try {
    const summary = await refreshMarketSignals();
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
