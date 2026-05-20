import { getAiCommandCenterState } from "./command-center";
import { getAiWorkforceSmokeReport } from "./ai-workforce-smoke";
import { getSourceFreshnessReport } from "./source-freshness";
import { getUserActionReadiness } from "./user-action-items";
import { getUnifiedActionCenter } from "./action-center";

export type GoLiveGateStatus = "passed" | "warning" | "blocked";
export type GoLiveGateOwner = "jason" | "admin" | "developer" | "system";

export interface GoLiveGate {
  id: string;
  title: string;
  status: GoLiveGateStatus;
  owner: GoLiveGateOwner;
  detail: string;
  nextStep: string;
  blocksProductionLaunch: boolean;
  blocksAutonomyExpansion: boolean;
}

export interface GoLiveReadinessReport {
  generatedAt: string;
  overallStatus: GoLiveGateStatus;
  summary: {
    total: number;
    passed: number;
    warning: number;
    blocked: number;
    productionBlockers: number;
    autonomyBlockers: number;
    jasonOwned: number;
  };
  gates: GoLiveGate[];
  recommendedLaunchMode: "do_not_launch" | "supervised_review_only" | "safe_to_expand_after_human_review";
}

function nowIso() {
  return new Date().toISOString();
}

function summarize(gates: GoLiveGate[]): GoLiveReadinessReport["summary"] {
  return {
    total: gates.length,
    passed: gates.filter((gate) => gate.status === "passed").length,
    warning: gates.filter((gate) => gate.status === "warning").length,
    blocked: gates.filter((gate) => gate.status === "blocked").length,
    productionBlockers: gates.filter((gate) => gate.blocksProductionLaunch).length,
    autonomyBlockers: gates.filter((gate) => gate.blocksAutonomyExpansion).length,
    jasonOwned: gates.filter((gate) => gate.owner === "jason" && gate.status !== "passed").length,
  };
}

function overallStatus(summary: GoLiveReadinessReport["summary"]): GoLiveGateStatus {
  if (summary.productionBlockers > 0 || summary.blocked > 0) return "blocked";
  if (summary.warning > 0 || summary.autonomyBlockers > 0) return "warning";
  return "passed";
}

function launchMode(status: GoLiveGateStatus, summary: GoLiveReadinessReport["summary"]): GoLiveReadinessReport["recommendedLaunchMode"] {
  if (status === "blocked") return "do_not_launch";
  if (summary.autonomyBlockers > 0 || summary.warning > 0) return "supervised_review_only";
  return "safe_to_expand_after_human_review";
}

export async function getGoLiveReadinessReport(): Promise<GoLiveReadinessReport> {
  const [commandCenter, smokeReport, sourceFreshness, actionCenter] = await Promise.all([
    getAiCommandCenterState(8),
    getAiWorkforceSmokeReport(),
    getSourceFreshnessReport(),
    getUnifiedActionCenter(12),
  ]);
  const userActions = getUserActionReadiness();

  const migrationAction = userActions.items.find((item) => item.id === "apply-ai-workforce-migrations-097-102");
  const twilioAction = userActions.items.find((item) => item.id.includes("twilio"));
  const contentIntelAction = userActions.items.find((item) => item.id === "enable-content-intel-review-mode");
  const contentAiModeAction = userActions.items.find((item) => item.id === "confirm-content-intel-ai-mode");
  const postmarkAction = userActions.items.find((item) => item.id === "verify-postmark-procurement-sender-list");
  const politicalAction = userActions.items.find((item) => item.id === "confirm-political-outreach-policy");
  const samAction = userActions.items.find((item) => item.id === "confirm-sam-gov-sync-cadence");
  const missingRequiredEnv = userActions.items.filter((item) => item.id.startsWith("missing-required-env-"));
  const unavailableSources = sourceFreshness.items.filter((item) => item.status === "unavailable");
  const staleSources = sourceFreshness.items.filter((item) => item.status === "stale");
  const unavailableActionSources = actionCenter.sourceHealth.filter((source) => source.status === "unavailable");

  const gates: GoLiveGate[] = [
    {
      id: "database-migrations",
      title: "Database migrations applied",
      status: migrationAction ? "blocked" : "passed",
      owner: migrationAction ? "jason" : "system",
      detail: migrationAction?.detail ?? "Required AI Workforce OS tables are not reporting a known migration blocker.",
      nextStep: migrationAction?.nextStep ?? "Continue monitoring migration health through smoke checks.",
      blocksProductionLaunch: Boolean(migrationAction),
      blocksAutonomyExpansion: Boolean(migrationAction),
    },
    {
      id: "required-env",
      title: "Required production environment variables",
      status: missingRequiredEnv.length > 0 ? "blocked" : "passed",
      owner: missingRequiredEnv.length > 0 ? "jason" : "system",
      detail: missingRequiredEnv.length > 0
        ? `${missingRequiredEnv.length} required environment variable(s) are missing.`
        : "No required environment-variable blockers were detected in the readiness matrix.",
      nextStep: missingRequiredEnv[0]?.nextStep ?? "Keep required production secrets synced in Vercel/Supabase.",
      blocksProductionLaunch: false,
      blocksAutonomyExpansion: missingRequiredEnv.length > 0,
    },
    {
      id: "smoke-checks",
      title: "AI Workforce smoke checks",
      status: smokeReport.summary.failed > 0 ? "blocked" : smokeReport.summary.warning > 0 ? "warning" : "passed",
      owner: smokeReport.summary.failed > 0 ? "admin" : "system",
      detail: `${smokeReport.summary.ok}/${smokeReport.summary.total} smoke checks are OK; ${smokeReport.summary.failed} failed.`,
      nextStep: smokeReport.checks.find((check) => check.status === "failed" || check.status === "warning")?.nextStep
        ?? "Keep smoke checks clean before enabling deeper autonomy.",
      blocksProductionLaunch: smokeReport.summary.failed > 0,
      blocksAutonomyExpansion: smokeReport.summary.failed > 0 || smokeReport.summary.warning > 0,
    },
    {
      id: "source-freshness",
      title: "Agent source freshness",
      status: unavailableSources.length > 0 ? "blocked" : staleSources.length > 0 ? "warning" : "passed",
      owner: unavailableSources.length > 0 || staleSources.length > 0 ? "admin" : "system",
      detail: `${sourceFreshness.summary.fresh}/${sourceFreshness.summary.total} sources are fresh; ${unavailableSources.length} unavailable; ${staleSources.length} stale.`,
      nextStep: unavailableSources[0]?.nextStep ?? staleSources[0]?.nextStep ?? "Keep source syncs monitored.",
      blocksProductionLaunch: unavailableSources.length > 0,
      blocksAutonomyExpansion: unavailableSources.length > 0 || staleSources.length > 0,
    },
    {
      id: "learning-engine-review-mode",
      title: "Learning Engine review-only rollout",
      status: contentIntelAction || contentAiModeAction ? "warning" : "passed",
      owner: contentIntelAction || contentAiModeAction ? "jason" : "system",
      detail: contentIntelAction?.detail ?? contentAiModeAction?.detail ?? "Learning Engine mode is not reporting review-mode blockers.",
      nextStep: contentIntelAction?.nextStep ?? contentAiModeAction?.nextStep ?? "Keep recommendations human-reviewed before implementation.",
      blocksProductionLaunch: false,
      blocksAutonomyExpansion: Boolean(contentIntelAction || contentAiModeAction),
    },
    {
      id: "messaging-readiness",
      title: "Postmark and SMS readiness",
      status: twilioAction ? "warning" : postmarkAction ? "warning" : "passed",
      owner: twilioAction || postmarkAction ? "jason" : "system",
      detail: twilioAction?.detail ?? postmarkAction?.detail ?? "Messaging readiness has no current user-owned warnings.",
      nextStep: twilioAction?.nextStep ?? postmarkAction?.nextStep ?? "Keep all outbound messaging behind approval gates.",
      blocksProductionLaunch: false,
      blocksAutonomyExpansion: Boolean(twilioAction),
    },
    {
      id: "political-approval-policy",
      title: "Political outreach policy",
      status: politicalAction ? "warning" : "passed",
      owner: politicalAction ? "jason" : "system",
      detail: politicalAction?.detail ?? "Political outreach policy is not reporting a readiness warning.",
      nextStep: politicalAction?.nextStep ?? "Keep political replies human-owned and audit logged.",
      blocksProductionLaunch: false,
      blocksAutonomyExpansion: Boolean(politicalAction),
    },
    {
      id: "sam-gov-cadence",
      title: "SAM.gov production cadence",
      status: samAction ? "warning" : "passed",
      owner: samAction ? "jason" : "system",
      detail: samAction?.detail ?? "SAM.gov cadence has no current readiness warning.",
      nextStep: samAction?.nextStep ?? "Continue monitoring Gov Contracts sync results.",
      blocksProductionLaunch: false,
      blocksAutonomyExpansion: false,
    },
    {
      id: "command-center-state",
      title: "Unified command state",
      status: commandCenter.status === "critical" ? "blocked" : commandCenter.status === "warning" ? "warning" : "passed",
      owner: commandCenter.status === "critical" ? "admin" : "system",
      detail: commandCenter.headline,
      nextStep: commandCenter.safeNextSteps[0] ?? "Keep command state visible in the admin Agent Command Center.",
      blocksProductionLaunch: commandCenter.status === "critical",
      blocksAutonomyExpansion: commandCenter.status !== "ok",
    },
    {
      id: "action-center-guardrails",
      title: "Action Center guardrails and queue visibility",
      status: unavailableActionSources.length > 0 ? "warning" : actionCenter.summary.total > 0 ? "passed" : "warning",
      owner: unavailableActionSources.length > 0 ? "admin" : "system",
      detail:
        `${actionCenter.summary.total} Action Center item(s), ${actionCenter.summary.highRisk} high-risk, ` +
        `${actionCenter.summary.internalHandoffEligible} internal-handoff eligible, ${unavailableActionSources.length} unavailable source(s).`,
      nextStep: unavailableActionSources[0]?.note ?? "Keep Action Center guardrails visible before expanding AI autonomy.",
      blocksProductionLaunch: false,
      blocksAutonomyExpansion: unavailableActionSources.length > 0,
    },
  ];

  const summary = summarize(gates);
  const status = overallStatus(summary);

  return {
    generatedAt: nowIso(),
    overallStatus: status,
    summary,
    gates,
    recommendedLaunchMode: launchMode(status, summary),
  };
}
