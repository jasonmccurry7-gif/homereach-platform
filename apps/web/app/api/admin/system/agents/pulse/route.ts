import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/system/agents/pulse
// Pulse = system health monitor (every 30 minutes)
// Checks: failed sends, agent daily limits, Supabase health
// Returns: health status + issues list
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const thirtyMinutesAgo = new Date(
      Date.now() - 30 * 60 * 1000
    ).toISOString();
    const issues: string[] = [];

    // ─── Check failed sends in last 30 minutes ──────────────────────────────────
    const { data: failedSends, count: failedCount } = await supabase
      .from("auto_send_log")
      .select("id", { count: "exact" })
      .eq("status", "failed")
      .gte("created_at", thirtyMinutesAgo);

    if ((failedCount ?? 0) > 5) {
      issues.push(`${failedCount} failed sends in last 30 minutes`);
    }

    // Also check sales_events for errors
    const { count: erroredEvents } = await supabase
      .from("sales_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "error")
      .gte("created_at", thirtyMinutesAgo);

    if ((erroredEvents ?? 0) > 5) {
      issues.push(`${erroredEvents} errored events in last 30 minutes`);
    }

    // ─── Check if any agent has hit daily limit ──────────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    const { data: agentLimits } = await supabase
      .from("agent_daily_send_counts")
      .select("agent_id, channel, sent_count")
      .eq("send_date", today);

    const hitLimits: string[] = [];
    if (agentLimits) {
      for (const limit of agentLimits) {
        const maxLimit =
          limit.channel === "email" ? 30 : limit.channel === "sms" ? 30 : 30;
        if (limit.sent_count >= maxLimit * 0.9) {
          // Alert at 90%
          hitLimits.push(
            `${limit.agent_id} approaching ${limit.channel} limit (${limit.sent_count}/${maxLimit})`
          );
        }
      }
    }

    if (hitLimits.length > 0) {
      issues.push(...hitLimits);
    }

    // ─── Check Supabase connectivity ─────────────────────────────────────────────
    let dbHealthy = true;
    try {
      const { data: testQuery } = await supabase
        .from("agent_identities")
        .select("agent_id")
        .limit(1);
      if (!testQuery) {
        dbHealthy = false;
      }
    } catch (err) {
      dbHealthy = false;
      issues.push("Supabase connectivity issue");
    }

    // ─── Check for stuck leads (queued > 24 hours without processing) ────────────
    const oneDayAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();
    const { count: stuckQueued } = await supabase
      .from("sales_leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued")
      .lt("created_at", oneDayAgo);

    if ((stuckQueued ?? 0) > 50) {
      issues.push(`${stuckQueued} leads stuck in queued for > 24 hours`);
    }

    // ─── Determine overall health status ────────────────────────────────────────
    let status: "healthy" | "degraded" | "critical" = "healthy";
    if (issues.length > 5) {
      status = "critical";
    } else if (issues.length > 2) {
      status = "degraded";
    }

    // If DB is down, everything is critical
    if (!dbHealthy) {
      status = "critical";
      issues.unshift("Database unavailable");
    }

    // ── Alert hook (fire-and-forget, never blocks, additive) ─────────────────
    // Fires system_failure personal SMS alert to Jason when status is critical.
    // Always sends to SYSTEM_ALERT_PHONE (+13302069639) regardless of shadow mode.
    // Guarded by ENABLE_INTERNAL_ALERTS flag.
    if (process.env.ENABLE_INTERNAL_ALERTS === "true" && status === "critical") {
      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const JASON_AGENT_ID = process.env.JASON_AGENT_ID || "";
      Promise.resolve().then(() =>
        fetch(`${baseUrl}/api/admin/alerts/send`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id:     JASON_AGENT_ID,
            alert_type:   "system_failure",
            urgency:      "critical",
            custom_body:  `⚠️ SYSTEM CRITICAL: ${issues.slice(0, 3).join(" | ")} — ${new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York" })} EST`,
            shadow_mode:  false, // system_failure ALWAYS goes to Jason, never shadow-routed
          }),
        }).catch(() => {})
      );
    }

    // ─── Return health status ───────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      data: {
        status,
        timestamp: new Date().toISOString(),
        checks: {
          database: dbHealthy ? "ok" : "down",
          failed_sends_30m: failedCount ?? 0,
          errored_events_30m: erroredEvents ?? 0,
          stuck_queued_leads: stuckQueued ?? 0,
          agents_at_limit: hitLimits.length,
        },
        issues,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[pulse] error:`, msg);
    return NextResponse.json(
      {
        success: false,
        status: "critical",
        error: msg,
        issues: ["Pulse check failed"],
      },
      { status: 500 }
    );
  }
}
