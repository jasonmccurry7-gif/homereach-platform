import { NextResponse }       from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/operator/summary
//
// Single aggregator route for the Operator Dashboard.
// Calls existing routes and runs DB queries in parallel.
// Each failure is isolated — partial data is returned, never a crash.
// Timeout: 8 seconds per sub-fetch; dashboard renders with whatever succeeds.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime  = "nodejs";
export const maxDuration = 30;

async function safeFetch(url: string, opts?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: Request) {
  const { origin } = new URL(req.url);
  const supabase   = createServiceClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso  = todayStart.toISOString();
  const h24Ago    = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const h48Ago    = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const h4Ago     = new Date(Date.now() -  4 * 60 * 60 * 1000).toISOString();
  const h2Ago     = new Date(Date.now() -  2 * 60 * 60 * 1000).toISOString();
  const h6Ago     = new Date(Date.now() -  6 * 60 * 60 * 1000).toISOString();

  // ── Parallel fetches & queries ────────────────────────────────────────────
  const [
    funnelData,
    leaderboardData,
    healthData,
    priorityData,
    atRiskData,
    alertsData,
    hotLeads,
    paymentSentLeads,
    fulfillmentRows,
    apexLastRun,
    newOrdersUnfulfilled,
  ] = await Promise.all([

    // Revenue funnel (today)
    safeFetch(`${origin}/api/admin/sales/funnel?since=today`),

    // Agent leaderboard (today)
    safeFetch(`${origin}/api/admin/sales/leaderboard?since=today`),

    // System health
    safeFetch(`${origin}/api/admin/health`),

    // Priority actions
    safeFetch(`${origin}/api/admin/sales/priority-actions`),

    // At-risk leads
    safeFetch(`${origin}/api/admin/sales/at-risk`),

    // Recent internal alerts (last 24h, for System Intelligence panel)
    safeFetch(`${origin}/api/admin/alerts/log?since=${h24Ago}&limit=20`),

    // Hot leads: replied or interested in last 4h
    supabase
      .from("sales_leads")
      .select("id, business_name, city, category, status, last_reply_at, assigned_agent_id, phone, email")
      .in("status", ["replied", "interested"])
      .gte("last_reply_at", h4Ago)
      .order("last_reply_at", { ascending: false })
      .limit(20)
      .then(r => r.data ?? []),

    // Payment sent leads with no follow-up in 6h (closing pipeline: at-risk)
    supabase
      .from("sales_leads")
      .select("id, business_name, city, category, status, last_contacted_at, assigned_agent_id")
      .eq("status", "payment_sent")
      .lt("last_contacted_at", h6Ago)
      .order("last_contacted_at", { ascending: true })
      .limit(20)
      .then(r => r.data ?? []),

    // Fulfillment: active spot assignments with intake pending / not yet mailed
    // INFERRED STATE — labeled as such in the UI. No automation triggered.
    supabase
      .from("spot_assignments")
      .select(`
        id,
        status,
        created_at,
        activated_at,
        businesses ( name, email ),
        cities ( name ),
        categories ( name ),
        intake_submissions ( id, status, submitted_at )
      `)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(50)
      .then(r => r.data ?? []),

    // Last Apex run
    supabase
      .from("apex_command_log")
      .select("id, created_at, duration_ms, summary")
      .order("created_at", { ascending: false })
      .limit(1)
      .then(r => r.data?.[0] ?? null),

    // New orders (paid) with no active marketing campaign yet
    supabase
      .from("orders")
      .select("id, status, created_at, businesses ( name, email ), business_id")
      .in("status", ["paid", "processing"])
      .gte("created_at", h48Ago)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(r => r.data ?? []),
  ]);

  // ── Build closing pipeline stages ─────────────────────────────────────────
  const pipelineStages = await Promise.all(
    ["queued", "contacted", "replied", "payment_sent", "closed"].map(async (status) => {
      const { data, count } = await supabase
        .from("sales_leads")
        .select("id, business_name, city, category, last_reply_at, last_contacted_at, assigned_agent_id", { count: "exact" })
        .eq("status", status)
        .order("last_reply_at", { ascending: false })
        .limit(10);
      return { status, count: count ?? 0, leads: data ?? [] };
    })
  );

  // ── Build command center items ────────────────────────────────────────────
  const commandItems: Array<{
    type: string;
    label: string;
    severity: "red" | "amber" | "green";
    count: number;
    action?: string;
  }> = [];

  // Unanswered replies (> 2h)
  const repliesWaiting = (hotLeads as Array<{ last_reply_at: string }>)
    .filter(l => l.last_reply_at && new Date(l.last_reply_at) < new Date(Date.now() - 2 * 60 * 60 * 1000));
  if (repliesWaiting.length > 0) {
    commandItems.push({ type: "reply_waiting", label: `${repliesWaiting.length} lead${repliesWaiting.length > 1 ? "s" : ""} replied — no response > 2h`, severity: "red", count: repliesWaiting.length, action: "/agent/replies" });
  }

  // Payment sent > 6h
  const paymentStale = (paymentSentLeads as unknown[]).length;
  if (paymentStale > 0) {
    commandItems.push({ type: "payment_stale", label: `${paymentStale} payment link${paymentStale > 1 ? "s" : ""} sent > 6h — close needed`, severity: "red", count: paymentStale, action: "/agent/queue" });
  }

  // New unfulfilled orders
  const newOrders = (newOrdersUnfulfilled as unknown[]).length;
  if (newOrders > 0) {
    commandItems.push({ type: "new_order", label: `${newOrders} paid order${newOrders > 1 ? "s" : ""} — fulfillment pending`, severity: "amber", count: newOrders, action: "/admin/intake" });
  }

  // Health failures
  const healthChecks = (healthData as { checks?: Array<{ name: string; status: string }> } | null)?.checks ?? [];
  const failedChecks = healthChecks.filter((c: { status: string }) => c.status === "red");
  if (failedChecks.length > 0) {
    commandItems.push({ type: "system_failure", label: `${failedChecks.length} system check${failedChecks.length > 1 ? "s" : ""} failing`, severity: "red", count: failedChecks.length, action: "/admin/operator#system" });
  }

  // Sort: red first, then amber
  commandItems.sort((a, b) => {
    const order = { red: 0, amber: 1, green: 2 };
    return order[a.severity] - order[b.severity];
  });

  return NextResponse.json({
    timestamp:       new Date().toISOString(),
    command_center:  commandItems,
    funnel:          funnelData,
    leaderboard:     leaderboardData,
    health:          healthData,
    priority_actions: priorityData,
    at_risk:         atRiskData,
    alerts_recent:   alertsData,
    hot_leads:       hotLeads,
    payment_sent_stale: paymentSentLeads,
    // INFERRED STATE: fulfillment_items are inferred from spot_assignments + intake_submissions.
    // No automation is triggered. Labels are manual-action-needed.
    fulfillment_items: fulfillmentRows,
    pipeline_stages: pipelineStages,
    apex_last_run:   apexLastRun,
  });
}
