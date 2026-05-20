// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/content-intel/cron/run
//
// Triggered by the Cowork scheduled-tasks MCP on a daily cadence.
// Requires Bearer token = CONTENT_INTEL_CRON_SECRET.
// Returns a pipeline summary JSON.
//
// Safe when ENABLE_CONTENT_INTEL is off: returns 404.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { ciFlagGate, requireCronSecret } from "@/lib/content-intel/guards";
import { runPipeline } from "@/lib/content-intel/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5-minute budget (Vercel Pro default is 300s)

export async function POST(req: NextRequest) {
  const gate = ciFlagGate();
  if (gate) return gate;
  const auth = requireCronSecret(req);
  if (auth) return auth;

  try {
    const summary = await runPipeline();
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
