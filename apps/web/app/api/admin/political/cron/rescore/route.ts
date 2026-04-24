// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/political/cron/rescore
//
// Scheduled batch rescorer for the Political Command Center. Mirrors the
// lead-intel cron pattern:
//   - Bearer-authed via POLITICAL_CRON_SECRET (or CONTENT_INTEL_CRON_SECRET
//     as fallback — see lib/political/env.ts).
//   - Flag-gated at runtime: returns 404 when ENABLE_POLITICAL is unset.
//   - Invokes rescoreAllPoliticalCandidates() which handles batching, the
//     political_priority_runs audit write, and idempotent updates.
//
// Scheduling is external to this file. Two supported setups:
//
//   (a) Vercel Cron — add an entry to apps/web/vercel.json and set the
//       standard `CRON_SECRET` env var in Vercel; Vercel Cron sends
//       `Authorization: Bearer <CRON_SECRET>`. Either keep CRON_SECRET
//       and CONTENT_INTEL_CRON_SECRET pointing at the same value or set
//       POLITICAL_CRON_SECRET to match what Vercel sends.
//
//   (b) External scheduler (pg_cron / GitHub Actions / Cloudflare
//       Workers / cron-job.org) — call this endpoint with
//       `Authorization: Bearer <CONTENT_INTEL_CRON_SECRET>` on whatever
//       cadence you prefer. Suggested: daily at 05:45 (after the 05:32
//       lead-intel rescore so resources don't overlap).
//
// runtime: nodejs (postgres-js + supabase-js need Node APIs)
// maxDuration: 240 seconds — well over the 5000-candidate BATCH_CAP.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import {
  politicalFlagGate,
  requirePoliticalCronSecret,
} from "@/lib/political/guards";
import { rescoreAllPoliticalCandidates } from "@/lib/political/priority-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;

async function handle(req: NextRequest): Promise<NextResponse> {
  const gate = politicalFlagGate();
  if (gate) return gate;

  const auth = requirePoliticalCronSecret(req);
  if (auth) return auth;

  try {
    const summary = await rescoreAllPoliticalCandidates({
      ranByUserId: null, // scheduled run — no human owner
      source: "cron",
    });
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// Support both verbs so we work with Vercel Cron (GET) and external
// schedulers that prefer POST. Behavior is identical either way.
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
