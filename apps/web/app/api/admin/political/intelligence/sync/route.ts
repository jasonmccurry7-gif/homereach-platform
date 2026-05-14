import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getPoliticalCronSecret, isPoliticalEnabled } from "@/lib/political/env";
import { runCandidateIntelligenceSync } from "@/lib/political/candidate-intelligence/sync";
import { CANDIDATE_INTEL_SOURCES } from "@/lib/political/candidate-intelligence/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const expected = getPoliticalCronSecret();
  if (!expected) return false;
  const bearer = req.headers.get("authorization");
  const cron = req.headers.get("x-cron-secret");
  return bearer === `Bearer ${expected}` || cron === expected;
}

function parseSources(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

async function handleSync(req: NextRequest) {
  if (!isPoliticalEnabled()) {
    return NextResponse.json({ ok: false, error: "Political Command Center is disabled." }, { status: 404 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Cron/admin secret required." }, { status: 401 });
  }

  const url = new URL(req.url);
  const body = req.method === "POST"
    ? await req.json().catch(() => ({} as Record<string, unknown>))
    : {};

  const state = String(body.state ?? url.searchParams.get("state") ?? "").trim().toUpperCase() || undefined;
  const cycleRaw = body.cycle ?? url.searchParams.get("cycle");
  const maxRecordsRaw = body.maxRecords ?? url.searchParams.get("maxRecords");
  const query = String(body.query ?? url.searchParams.get("query") ?? "").trim() || undefined;
  const candidateName = String(body.candidateName ?? url.searchParams.get("candidateName") ?? "").trim() || undefined;
  const officeName = String(body.officeName ?? url.searchParams.get("officeName") ?? "").trim() || undefined;
  const sourceKeys = Array.isArray(body.sourceKeys)
    ? body.sourceKeys.map(String)
    : parseSources(url.searchParams.get("sources"));

  const supabase = createServiceClient();
  const summary = await runCandidateIntelligenceSync(supabase, {
    sourceKeys,
    state,
    cycle: cycleRaw ? Number(cycleRaw) : undefined,
    maxRecords: maxRecordsRaw ? Number(maxRecordsRaw) : undefined,
    query,
    candidateName,
    officeName,
    triggerType: req.method === "GET" ? "nightly" : "manual",
  });

  return NextResponse.json(summary, { status: summary.ok ? 200 : 207 });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("status") === "sources") {
    return NextResponse.json({
      ok: true,
      sources: CANDIDATE_INTEL_SOURCES,
      enabled: isPoliticalEnabled(),
    });
  }
  return handleSync(req);
}

export async function POST(req: NextRequest) {
  return handleSync(req);
}
