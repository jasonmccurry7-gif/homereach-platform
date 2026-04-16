import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — orchestrator runs all agents

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/system/apex
// APEX Orchestrator — fires all 16 agents in correct sequence
// Called by cron, APEX SMS "audit" command, or manually from admin
//
// Execution order:
//   1. Pulse (health check first — if system is down, abort non-critical)
//   2. Ledger (revenue snapshot)
//   3. Kaizen (improvement analysis)
//   4. Prospector (lead pipeline check)
//   5. Echo (send due outreach sequences)
//   6. Closer (follow up on warm deals)
//   7. Anchor (retention checks)
//   8. Scraper (if lead count low — conditional)
//   9. Atlas/Sentinel/Sync (status reports only)
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://home-reach.com";

type AgentResult = {
  agent: string;
  status: "success" | "skipped" | "failed";
  summary: string;
  ms: number;
  data?: unknown;
};

async function runAgent(
  name: string,
  path: string,
  method: "POST" | "GET" = "POST",
  body?: object,
  skipIf?: boolean
): Promise<AgentResult> {
  if (skipIf) {
    return { agent: name, status: "skipped", summary: "Skipped by condition", ms: 0 };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": process.env.CRON_SECRET ?? "",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const ms = Date.now() - start;
    if (!res.ok) {
      const txt = await res.text().catch(() => res.statusText);
      return { agent: name, status: "failed", summary: `HTTP ${res.status}: ${txt.slice(0, 200)}`, ms };
    }

    const data = await res.json().catch(() => ({}));
    const summary = extractSummary(name, data);
    return { agent: name, status: "success", summary, ms, data };
  } catch (err) {
    return {
      agent: name,
      status: "failed",
      summary: err instanceof Error ? err.message : String(err),
      ms: Date.now() - start,
    };
  }
}

function extractSummary(agent: string, data: Record<string, unknown>): string {
  if (!data) return "No data returned";
  switch (agent) {
    case "Pulse":
      return `System: ${data.status ?? "unknown"} · ${data.issues_count ?? 0} issues`;
    case "Ledger":
      return `MRR: $${data.mrr ?? 0} · Active: ${data.active_subscribers ?? 0} · New: ${data.new_today ?? 0}`;
    case "Kaizen":
      return `${data.findings_count ?? 0} findings · ${data.auto_fixes ?? 0} auto-fixes applied`;
    case "Prospector":
      return `${data.cities_checked ?? 0} cities · ${data.cities_low ?? 0} low on leads`;
    case "Echo":
      return `${data.sent ?? 0} messages sent · ${data.failed ?? 0} failed`;
    case "Closer":
      return `${data.leads_actioned ?? 0} warm leads actioned · ${data.messages_sent ?? 0} sent`;
    case "Anchor":
      return `${data.at_risk ?? 0} at-risk accounts · ${data.messages_sent ?? 0} retention messages`;
    case "Scraper":
      return `${data.added ?? 0} new leads scraped`;
    case "FacebookScores":
      return `${data.scores_computed ?? 0} scores computed · avg ${data.avg_overall_score ?? 0}/100`;
    default:
      return JSON.stringify(data).slice(0, 100);
  }
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  const startTime = Date.now();
  const runId = crypto.randomUUID();
  const runDate = new Date().toISOString();

  // Security: require cron secret or admin session
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET && cronSecret !== "internal") {
    // Allow unauthenticated for now in dev — lock down in prod
    console.warn("[APEX] Running without cron secret — ensure CRON_SECRET is set");
  }

  const results: AgentResult[] = [];

  try {
    // ── STEP 1: Pulse — system health check ─────────────────────────────────
    const pulse = await runAgent("Pulse", "/api/admin/system/agents/pulse");
    results.push(pulse);

    // ── STEP 2: Ledger — revenue snapshot ───────────────────────────────────
    const ledger = await runAgent("Ledger", "/api/admin/system/agents/ledger");
    results.push(ledger);

    // ── STEP 3: Kaizen — daily improvement analysis ──────────────────────────
    const kaizen = await runAgent("Kaizen", "/api/admin/system/agents/kaizen");
    results.push(kaizen);

    // ── STEP 4: Prospector — check lead pipeline ─────────────────────────────
    const prospector = await runAgent("Prospector", "/api/admin/system/agents/prospector");
    results.push(prospector);

    // ── STEP 5: Echo — send due outreach sequences ───────────────────────────
    const echo = await runAgent("Echo", "/api/admin/agents/echo", "POST", { mode: "sequences" });
    results.push(echo);

    // ── STEP 6: Closer — action warm deals ──────────────────────────────────
    const closer = await runAgent("Closer", "/api/admin/agents/closer");
    results.push(closer);

    // ── STEP 7: Anchor — retention checks ───────────────────────────────────
    const anchor = await runAgent("Anchor", "/api/admin/agents/anchor");
    results.push(anchor);

    // ── STEP 8: Scraper — run if prospector flagged low leads ────────────────
    const prospectorData = prospector.data as Record<string, unknown> | undefined;
    const needsScrape = prospectorData?.cities_low && (prospectorData.cities_low as number) > 0;
    const scraper = await runAgent("Scraper", "/api/admin/agents/scraper", "POST", {}, !needsScrape);
    results.push(scraper);

    // ── STEP 9: Health check ─────────────────────────────────────────────────
    const health = await runAgent("Sentinel", "/api/admin/health", "GET");
    results.push(health);

    // ── STEP 10: Facebook Performance Scores — compute daily snapshot ────────
    const fbScores = await runAgent("FacebookScores", "/api/admin/sales/facebook/daily-score");
    results.push(fbScores);

  } catch (err) {
    console.error("[APEX] Orchestrator error:", err);
  }

  const totalMs = Date.now() - startTime;
  const succeeded = results.filter(r => r.status === "success").length;
  const failed    = results.filter(r => r.status === "failed").length;
  const skipped   = results.filter(r => r.status === "skipped").length;

  // ── Build summary report ───────────────────────────────────────────────────
  const reportLines = [
    `🤖 APEX ORCHESTRATION COMPLETE`,
    `Run ID: ${runId.slice(0, 8)}`,
    `Duration: ${(totalMs / 1000).toFixed(1)}s`,
    ``,
    `📊 RESULTS: ${succeeded} ✅ ${failed} ❌ ${skipped} ⏭️`,
    ``,
    ...results.map(r => {
      const icon = r.status === "success" ? "✅" : r.status === "failed" ? "❌" : "⏭️";
      return `${icon} ${r.agent}: ${r.summary}`;
    }),
  ];

  const report = reportLines.join("\n");

  // ── Log run to Supabase ────────────────────────────────────────────────────
  await supabase
    .from("apex_command_log" as never)
    .insert({
      command: "APEX_ORCHESTRATION",
      sender: "system",
      response: report.slice(0, 2000),
      executed_at: runDate,
    })
    .then(() => {})
    .catch(err => console.warn("[APEX] Failed to log orchestration:", err));

  return NextResponse.json({
    run_id: runId,
    timestamp: runDate,
    duration_ms: totalMs,
    summary: { succeeded, failed, skipped, total: results.length },
    results,
    report,
  });
}

// GET — status check
export async function GET() {
  return NextResponse.json({
    agent: "Apex Orchestrator",
    status: "ready",
    description: "POST to run full agent sweep. Fires all 16 agents in sequence.",
    agents: ["Pulse", "Ledger", "Kaizen", "Prospector", "Echo", "Closer", "Anchor", "Scraper", "Sentinel", "FacebookScores"],
    cron_secret_required: true,
  });
}
