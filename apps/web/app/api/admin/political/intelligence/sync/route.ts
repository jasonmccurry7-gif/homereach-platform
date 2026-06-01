import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getPoliticalCronSecret, isPoliticalEnabled } from "@/lib/political/env";
import { runCandidateIntelligenceSync } from "@/lib/political/candidate-intelligence/sync";
import { CANDIDATE_INTEL_SOURCES } from "@/lib/political/candidate-intelligence/sources";
import type { CandidateIntelSyncSummary } from "@/lib/political/candidate-intelligence/types";

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

function parseStates(raw: string | null | undefined): string[] {
  const states = String(raw ?? "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return states.length ? states : ["OH", "IL", "TN"];
}

function parseMaxRecords(value: unknown, fallback: number): number | undefined {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function combineSummaries(runs: Array<{ state: string; summary: CandidateIntelSyncSummary }>) {
  const startedAt = runs[0]?.summary.startedAt ?? new Date().toISOString();
  const completedAt = new Date().toISOString();
  return {
    ok: runs.every((run) => run.summary.ok),
    mode: "nightly_multi_state",
    states: runs.map((run) => run.state),
    startedAt,
    completedAt,
    durationMs: runs.reduce((total, run) => total + run.summary.durationMs, 0),
    totals: runs.reduce(
      (totals, run) => ({
        seen: totals.seen + run.summary.totals.seen,
        inserted: totals.inserted + run.summary.totals.inserted,
        updated: totals.updated + run.summary.totals.updated,
        merged: totals.merged + run.summary.totals.merged,
        skipped: totals.skipped + run.summary.totals.skipped,
        timelines: totals.timelines + run.summary.totals.timelines,
      }),
      { seen: 0, inserted: 0, updated: 0, merged: 0, skipped: 0, timelines: 0 },
    ),
    warnings: runs.flatMap((run) => run.summary.warnings.map((warning) => `${run.state}: ${warning}`)),
    errors: runs.flatMap((run) => run.summary.errors.map((error) => `${run.state}: ${error}`)),
    runs,
  };
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
  const shouldRunDailyStateRefresh =
    req.method === "GET" && !state && !query && !candidateName && !officeName;

  if (shouldRunDailyStateRefresh) {
    const states = parseStates(process.env.POLITICAL_DAILY_SYNC_STATES);
    const dailySourceKeys =
      sourceKeys ??
      parseSources(process.env.POLITICAL_DAILY_SYNC_SOURCES ?? null);
    const dailyMaxRecords = parseMaxRecords(
      maxRecordsRaw ?? process.env.POLITICAL_DAILY_SYNC_MAX_RECORDS,
      250,
    );
    const runs: Array<{ state: string; summary: CandidateIntelSyncSummary }> = [];

    for (const stateCode of states) {
      const summary = await runCandidateIntelligenceSync(supabase, {
        sourceKeys: dailySourceKeys,
        state: stateCode,
        cycle: cycleRaw ? Number(cycleRaw) : undefined,
        maxRecords: dailyMaxRecords,
        triggerType: "nightly",
      });
      runs.push({ state: stateCode, summary });
    }

    const combined = combineSummaries(runs);
    return NextResponse.json(combined, { status: combined.ok ? 200 : 207 });
  }

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
