import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/system/agents/kaizen
// Kaizen = system-wide continuous improvement engine
// Runs daily: analyze metrics, identify improvements, auto-apply safe fixes
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // ─── STEP 1: Create kaizen_insights table if not exists ────────────────────
    await supabase.rpc("exec", {
      sql: `
        CREATE TABLE IF NOT EXISTS kaizen_insights (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          run_at TIMESTAMPTZ DEFAULT NOW(),
          cycle_date DATE DEFAULT CURRENT_DATE,
          findings JSONB NOT NULL DEFAULT '{}',
          auto_fixes_applied INTEGER DEFAULT 0,
          flagged_for_approval JSONB DEFAULT '[]',
          email_sent BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `,
    }).catch(() => {
      // If rpc doesn't work, use regular query via raw SQL
      return supabase
        .from("kaizen_insights" as never)
        .select("id")
        .limit(1)
        .then(() => ({ data: null }))
        .catch(() => ({ data: null }));
    });

    // Ensure table exists by checking
    const tableCheckResult = await supabase
      .from("kaizen_insights" as never)
      .select("id", { count: "exact", head: true })
      .then(() => ({ exists: true }))
      .catch(() => ({ exists: false }));

    if (!tableCheckResult.exists) {
      // Try direct SQL insert which will auto-create or verify table exists
      console.log("[kaizen] Creating kaizen_insights table...");
    }

    const findings: any = {
      analyzed_at: now,
      template_analysis: null,
      pipeline_velocity: null,
      agent_performance: null,
      dead_leads: null,
      system_health: null,
    };

    let autoFixesApplied = 0;
    const flaggedForApproval: any[] = [];

    // ─── STEP 2: Analyze reply rates by template ────────────────────────────────
    const { data: templateStats } = await supabase
      .from("sales_events")
      .select("message")
      .gte("created_at", sevenDaysAgo)
      .eq("action_type", "email_sent");

    if (templateStats && templateStats.length > 0) {
      const templateGroups: Record<string, { sends: number; replies: number }> = {};

      for (const event of templateStats) {
        const template = event.message
          ? event.message.substring(0, 50)
          : "unknown";
        if (!templateGroups[template]) {
          templateGroups[template] = { sends: 0, replies: 0 };
        }
        templateGroups[template].sends++;
      }

      // Get replies in same period
      const { data: replyEvents } = await supabase
        .from("sales_events")
        .select("message")
        .gte("created_at", sevenDaysAgo)
        .eq("action_type", "reply_received");

      if (replyEvents) {
        for (const event of replyEvents) {
          const template = event.message
            ? event.message.substring(0, 50)
            : "unknown";
          if (templateGroups[template]) {
            templateGroups[template].replies++;
          }
        }
      }

      const templateAnalysis = Object.entries(templateGroups).map(
        ([template, stats]) => ({
          template: template.substring(0, 50),
          sends: stats.sends,
          replies: stats.replies,
          reply_rate: stats.sends > 0 ? (stats.replies / stats.sends) * 100 : 0,
          status:
            stats.sends > 0 && (stats.replies / stats.sends) * 100 > 0.2
              ? "top_performer"
              : stats.sends > 0 && (stats.replies / stats.sends) * 100 < 0.08
                ? "underperforming"
                : "normal",
        })
      );

      findings.template_analysis = {
        total_templates: templateAnalysis.length,
        top_performers: templateAnalysis.filter(
          (t) => t.status === "top_performer"
        ).length,
        underperforming: templateAnalysis.filter(
          (t) => t.status === "underperforming"
        ).length,
        templates: templateAnalysis,
      };
    }

    // ─── STEP 3: Analyze lead pipeline velocity ──────────────────────────────────
    const { data: pipelineMetrics } = await supabase
      .from("sales_leads")
      .select("status, created_at, last_contacted_at");

    if (pipelineMetrics && pipelineMetrics.length > 0) {
      const now_ms = Date.now();
      const queuedHours: number[] = [];
      const contactedHours: number[] = [];

      for (const lead of pipelineMetrics) {
        if (lead.status === "queued" && lead.created_at) {
          const hours =
            (now_ms - new Date(lead.created_at).getTime()) / (1000 * 60 * 60);
          queuedHours.push(hours);
        }
        if (lead.status === "contacted" && lead.last_contacted_at) {
          const hours =
            (now_ms - new Date(lead.last_contacted_at).getTime()) /
            (1000 * 60 * 60);
          contactedHours.push(hours);
        }
      }

      findings.pipeline_velocity = {
        avg_queued_hours:
          queuedHours.length > 0
            ? Math.round(
                (queuedHours.reduce((a, b) => a + b) / queuedHours.length) * 10
              ) / 10
            : 0,
        avg_contacted_hours:
          contactedHours.length > 0
            ? Math.round(
                (contactedHours.reduce((a, b) => a + b) /
                  contactedHours.length) *
                  10
              ) / 10
            : 0,
        stalled_queued:
          queuedHours.filter((h) => h > 24).length,
        stalled_contacted:
          contactedHours.filter((h) => h > 72).length,
      };

      if (
        findings.pipeline_velocity.avg_contacted_hours > 72 &&
        findings.pipeline_velocity.stalled_contacted > 0
      ) {
        flaggedForApproval.push({
          type: "pipeline_velocity_alert",
          reason: "Leads stalled in contacted status > 72 hours",
          count: findings.pipeline_velocity.stalled_contacted,
        });
      }
    }

    // ─── STEP 4: Analyze agent performance ───────────────────────────────────────
    const { data: agentStats } = await supabase
      .from("sales_events")
      .select("agent_id, action_type, city")
      .gte("created_at", sevenDaysAgo);

    if (agentStats && agentStats.length > 0) {
      const agentMetrics: Record<string, any> = {};

      for (const event of agentStats) {
        if (!agentMetrics[event.agent_id]) {
          agentMetrics[event.agent_id] = {
            agent_id: event.agent_id,
            emails_sent: 0,
            sms_sent: 0,
            replies: 0,
          };
        }
        if (event.action_type === "email_sent")
          agentMetrics[event.agent_id].emails_sent++;
        if (event.action_type === "sms_sent")
          agentMetrics[event.agent_id].sms_sent++;
        if (event.action_type === "reply_received")
          agentMetrics[event.agent_id].replies++;
      }

      const agentPerformance = Object.values(agentMetrics)
        .map((m: any) => ({
          ...m,
          reply_rate:
            m.emails_sent + m.sms_sent > 0
              ? (m.replies / (m.emails_sent + m.sms_sent)) * 100
              : 0,
        }))
        .sort((a: any, b: any) => b.reply_rate - a.reply_rate)
        .slice(0, 5);

      findings.agent_performance = {
        top_5_agents: agentPerformance,
        total_agents: Object.keys(agentMetrics).length,
      };
    }

    // ─── STEP 5: Identify dead leads ─────────────────────────────────────────────
    const sevenDaysAgoDate = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data: deadLeads } = await supabase
      .from("sales_leads")
      .select("id, business_name, status, last_contacted_at")
      .eq("status", "contacted")
      .lt("last_contacted_at", sevenDaysAgoDate);

    if (deadLeads && deadLeads.length > 0) {
      findings.dead_leads = {
        count: deadLeads.length,
        sample: deadLeads.slice(0, 5),
      };

      // Auto-fix: re-queue dead leads
      const deadLeadIds = deadLeads.map((l) => l.id);
      const { error: requeueError } = await supabase
        .from("sales_leads")
        .update({ status: "queued", last_contacted_at: null })
        .in("id", deadLeadIds);

      if (!requeueError) {
        autoFixesApplied += deadLeads.length;
      }
    }

    // ─── STEP 6: Check system health ─────────────────────────────────────────────
    const oneDayAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    const [
      { data: erroredEvents },
      { count: stuckQueued },
      { count: totalLeads },
    ] = await Promise.all([
      supabase
        .from("sales_events")
        .select("id, lead_id, action_type")
        .eq("status", "error")
        .gte("created_at", oneDayAgo),
      supabase
        .from("sales_leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "queued")
        .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from("sales_leads")
        .select("id", { count: "exact", head: true }),
    ]);

    findings.system_health = {
      errored_events_24h: erroredEvents?.length ?? 0,
      stuck_queued_24h: stuckQueued ?? 0,
      total_leads: totalLeads ?? 0,
      health_status:
        (erroredEvents?.length ?? 0) > 10
          ? "degraded"
          : (stuckQueued ?? 0) > 50
            ? "degraded"
            : "healthy",
    };

    // ─── STEP 7: Insert findings into kaizen_insights ────────────────────────────
    const { data: insightRecord, error: insertError } = await supabase
      .from("kaizen_insights")
      .insert({
        cycle_date: new Date(now).toISOString().split("T")[0],
        findings,
        auto_fixes_applied: autoFixesApplied,
        flagged_for_approval: flaggedForApproval,
        email_sent: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[kaizen] Insert error:", insertError);
    }

    // ─── STEP 8: Email Apex with summary ────────────────────────────────────────
    // TODO: Integrate with Resend or Mailgun to email jason@home-reach.com
    // For now, just mark as flagged
    if (flaggedForApproval.length > 0 || autoFixesApplied > 0) {
      // Would send email here
      console.log("[kaizen] Findings ready for apex review:", findings);
    }

    return NextResponse.json({
      success: true,
      data: {
        insights: insightRecord ?? findings,
        auto_fixes_applied: autoFixesApplied,
        flagged_for_approval: flaggedForApproval,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[kaizen] error:`, msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
