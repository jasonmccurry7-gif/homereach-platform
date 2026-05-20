import { createServiceClient } from "@/lib/supabase/service";
import { getDashboardAgentMatrix, getDashboardAgentSummary } from "./dashboard-agents";
import { getUserActionReadiness } from "./user-action-items";
import { getUnifiedActionCenter, type UnifiedActionCenter } from "./action-center";

export type AiWorkforceSmokeStatus = "ok" | "warning" | "failed";

export interface AiWorkforceSmokeCheck {
  key: string;
  label: string;
  status: AiWorkforceSmokeStatus;
  summary: string;
  nextStep: string;
}

export interface AiWorkforceSmokeReport {
  generatedAt: string;
  overallStatus: AiWorkforceSmokeStatus;
  summary: {
    total: number;
    ok: number;
    warning: number;
    failed: number;
  };
  checks: AiWorkforceSmokeCheck[];
}

function nowIso() {
  return new Date().toISOString();
}

function envReady(key: string) {
  return Boolean(process.env[key]?.trim());
}

function enabled(key: string) {
  return process.env[key]?.trim().toLowerCase() === "true";
}

function summarize(checks: AiWorkforceSmokeCheck[]): AiWorkforceSmokeReport["summary"] {
  return {
    total: checks.length,
    ok: checks.filter((check) => check.status === "ok").length,
    warning: checks.filter((check) => check.status === "warning").length,
    failed: checks.filter((check) => check.status === "failed").length,
  };
}

function overallStatus(checks: AiWorkforceSmokeCheck[]): AiWorkforceSmokeStatus {
  if (checks.some((check) => check.status === "failed")) return "failed";
  if (checks.some((check) => check.status === "warning")) return "warning";
  return "ok";
}

export async function getAiWorkforceSmokeReport(options: { actionCenter?: UnifiedActionCenter } = {}): Promise<AiWorkforceSmokeReport> {
  const checks: AiWorkforceSmokeCheck[] = [];
  const agents = getDashboardAgentMatrix();
  const agentSummary = getDashboardAgentSummary(agents);
  const userActions = getUserActionReadiness();

  checks.push({
    key: "dashboard_agent_matrix",
    label: "Dashboard Agent Matrix",
    status: agentSummary.blocked > 0 ? "warning" : "ok",
    summary: `${agentSummary.ready}/${agentSummary.total} dashboard agents ready; ${agentSummary.blocked} blocked.`,
    nextStep: agentSummary.blocked > 0
      ? "Open Jason Action Required and clear the highest-impact env or approval blocker."
      : "Continue phased autonomy rollout.",
  });

  checks.push({
    key: "user_action_readiness",
    label: "Jason Action Required",
    status: userActions.summary.blocksGoLive > 0 ? "warning" : "ok",
    summary: `${userActions.summary.total} user-action items; ${userActions.summary.blocksGoLive} block go-live.`,
    nextStep: userActions.summary.blocksGoLive > 0
      ? "Complete go-live blockers before production launch."
      : "No user-action go-live blockers detected by the readiness aggregator.",
  });

  const hasSupabase = envReady("NEXT_PUBLIC_SUPABASE_URL") && envReady("SUPABASE_SERVICE_ROLE_KEY");
  checks.push({
    key: "supabase_env",
    label: "Supabase Service Env",
    status: hasSupabase ? "ok" : "failed",
    summary: hasSupabase
      ? "Supabase URL and service role key are configured."
      : "Supabase URL or service role key is missing.",
    nextStep: hasSupabase ? "Proceed to table availability checks." : "Configure Supabase env before live orchestration.",
  });

  checks.push({
    key: "learning_engine_flags",
    label: "Learning Engine Flags",
    status: enabled("ENABLE_CONTENT_INTEL") ? "ok" : "warning",
    summary: enabled("ENABLE_CONTENT_INTEL")
      ? "Learning Engine feature flag is enabled."
      : "Learning Engine feature flag is currently disabled.",
    nextStep: enabled("ENABLE_CONTENT_INTEL")
      ? "Keep review workflow monitored before enabling AI extraction."
      : "Enable only after credentials and admin review mode are ready.",
  });

  try {
    const actionCenter = options.actionCenter ?? await getUnifiedActionCenter(8);
    const unavailableSources = actionCenter.sourceHealth.filter((source) => source.status === "unavailable");
    checks.push({
      key: "unified_action_center_generation",
      label: "Unified Action Center Generation",
      status: unavailableSources.length > 0 ? "warning" : "ok",
      summary:
        `${actionCenter.summary.total} generated action item(s); ${actionCenter.summary.highRisk} high-risk; ` +
        `${unavailableSources.length} unavailable source(s).`,
      nextStep: unavailableSources[0]?.note ?? "Keep the Action Center visible before expanding AI autonomy.",
    });
  } catch (error) {
    checks.push({
      key: "unified_action_center_generation",
      label: "Unified Action Center Generation",
      status: "failed",
      summary: `Action Center generation failed: ${error instanceof Error ? error.message : String(error)}`,
      nextStep: "Fix Action Center generation before relying on AI Workforce queue visibility.",
    });
  }

  if (!hasSupabase) {
    return {
      generatedAt: nowIso(),
      overallStatus: overallStatus(checks),
      summary: summarize(checks),
      checks,
    };
  }

  const supabase = createServiceClient();
  const tableChecks = [
    { table: "unified_action_items", label: "Durable Action Center" },
    { table: "unified_action_events", label: "Action Center Events" },
    { table: "ai_dashboard_monitor_runs", label: "Monitor Runs" },
    { table: "ai_operational_briefings", label: "Operational Briefings" },
    { table: "ai_autopilot_approval_requests", label: "Autopilot Approval Gates" },
    { table: "ai_autopilot_execution_runs", label: "Autopilot Handoffs" },
    { table: "ci_insights", label: "Learning Engine Insights" },
    { table: "ci_category_topics", label: "Learning Engine Taxonomy" },
    { table: "crm_tasks", label: "Internal Task Handoff" },
  ];

  const tableResults = await Promise.all(
    tableChecks.map(async (check) => {
      const { error, count } = await supabase
        .from(check.table)
        .select("*", { count: "exact", head: true });

      return {
        ...check,
        count: count ?? 0,
        error,
      };
    }),
  );

  for (const result of tableResults) {
    checks.push({
      key: `table_${result.table}`,
      label: result.label,
      status: result.error ? "failed" : "ok",
      summary: result.error
        ? `${result.table} is unavailable: ${result.error.message}`
        : `${result.table} is available with ${result.count} row${result.count === 1 ? "" : "s"}.`,
      nextStep: result.error
        ? "Apply the required Supabase migration or confirm table permissions."
        : "No action required.",
    });
  }

  return {
    generatedAt: nowIso(),
    overallStatus: overallStatus(checks),
    summary: summarize(checks),
    checks,
  };
}
