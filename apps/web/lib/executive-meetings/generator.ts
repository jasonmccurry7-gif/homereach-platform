import "server-only";

import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { createServiceClient } from "@/lib/supabase/service";
import { loadExecutiveSourceSnapshot } from "./data-adapters";
import {
  fetchExecutiveAgents,
  fetchExecutiveSettings,
  fetchLatestCommitments,
  mapExecutiveAgentReportRow,
  mapExecutiveMeetingRow,
} from "./repository";
import type {
  ExecutiveActionResult,
  ExecutiveAgent,
  ExecutiveAgentCommitment,
  ExecutiveAgentReport,
  ExecutiveBlocker,
  ExecutiveDataSourceNote,
  ExecutiveDecision,
  ExecutiveKpiSnapshot,
  ExecutiveMeeting,
  ExecutiveMeetingSettings,
  ExecutiveMeetingType,
  ExecutivePriority,
  ExecutiveRevenueImpact,
  ExecutiveRisk,
  ExecutiveSourceSnapshot,
  ExecutiveWorkItem,
} from "./types";

type Db = ReturnType<typeof createServiceClient>;
type GenericRow = Record<string, unknown>;
type AgentActivationStatus = "joining" | "joined" | "missing_report" | "failed" | "skipped_disabled";

export async function generateExecutiveMeeting(input: {
  meetingType: ExecutiveMeetingType;
  actorUserId?: string | null;
  actorType?: "human" | "cron" | "system";
  idempotencyKey?: string | null;
  forceNew?: boolean;
}): Promise<ExecutiveActionResult & { meeting?: ExecutiveMeeting | null }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, status: 503, error: "Supabase service credentials are not configured.", meeting: null };
  }

  const db = createServiceClient();
  const settings = await fetchExecutiveSettings(db);
  const local = getNewYorkLocalParts(new Date(), settings.timezone);
  const idempotencyKey = input.idempotencyKey ?? (input.forceNew ? null : manualIdempotencyKey(input.meetingType, settings));

  if (idempotencyKey) {
    const existing = await findMeetingByIdempotencyKey(db, idempotencyKey);
    if (existing) {
      const activatedExisting = await ensureExistingMeetingActivation(db, existing, settings, input);
      return { ok: true, id: activatedExisting.id, meetingId: activatedExisting.id, meeting: activatedExisting, reused: true };
    }
  }

  const [agentsResult, commitments, sourceSnapshot] = await Promise.all([
    fetchExecutiveAgents(db),
    fetchLatestCommitments(db),
    loadExecutiveSourceSnapshot(db),
  ]);
  const availableAgents = agentsResult.agents.filter((agent) => !agent.archivedAt);
  const enabledAgents = availableAgents.filter((agent) => agent.enabled);
  if (enabledAgents.length === 0) {
    return { ok: false, status: 409, error: "No executive agents are enabled.", meeting: null };
  }

  const generatedAt = new Date().toISOString();
  const reports = enabledAgents.map((agent) =>
    buildAgentReport({
      agent,
      meetingType: input.meetingType,
      sourceSnapshot,
      commitments,
    }),
  );
  const aggregate = buildMeetingAggregate(input.meetingType, reports, sourceSnapshot);
  const title = titleForMeeting(input.meetingType, local.dateKey);

  const initialVoiceReady = buildVoiceReadyState({
    agents: availableAgents,
    reports,
    settings,
    meetingType: input.meetingType,
    generatedAt,
    activationStatus: "joining",
    error: null,
  });

  const meetingInsert = {
    meeting_date: local.dateKey,
    meeting_type: input.meetingType,
    status: "ready",
    title,
    idempotency_key: idempotencyKey,
    timezone: settings.timezone,
    generated_at: new Date().toISOString(),
    generated_by: input.actorUserId ?? null,
    generated_by_type: input.actorType ?? "human",
    ceo_summary: aggregate.ceoSummary,
    decisions_needed_json: aggregate.decisions,
    blockers_json: aggregate.blockers,
    revenue_impact_json: aggregate.revenueImpact,
    tomorrow_priorities_json: aggregate.tomorrowPriorities,
    source_snapshot_json: sourceSnapshot,
    voice_ready_json: initialVoiceReady,
  };

  const { data: meetingRow, error: meetingError } = await db
    .from("executive_meetings")
    .insert(meetingInsert)
    .select("*")
    .single();
  if (meetingError || !meetingRow) {
    await auditMeeting("failure", input, null, meetingError?.message ?? "Meeting insert failed.");
    return { ok: false, status: 500, error: meetingError?.message ?? "Meeting insert failed.", meeting: null };
  }

  const meeting = mapExecutiveMeetingRow(meetingRow as GenericRow);

  try {
    await Promise.all([
      persistMeetingReport(db, meeting, aggregate, sourceSnapshot),
      persistAgentReports(db, meeting, reports),
      persistApprovals(db, meeting, reports),
      persistKpis(db, meeting, reports, local.dateKey),
      persistCommitments(db, meeting, reports, input.meetingType, local.dateKey),
      persistBoardroomMemory(db, meeting, availableAgents, reports, aggregate, input.meetingType, generatedAt),
    ]);
  } catch (error) {
    const message = errorMessage(error);
    const failedVoiceReady = buildVoiceReadyState({
      agents: availableAgents,
      reports,
      settings,
      meetingType: input.meetingType,
      generatedAt,
      activationStatus: "failed",
      error: message,
    });
    await db
      .from("executive_meetings")
      .update({ status: "failed", voice_ready_json: failedVoiceReady, updated_at: new Date().toISOString() })
      .eq("id", meeting.id);
    await auditAgentActivations("failure", input, meeting, failedVoiceReady, message);
    await auditMeeting("failure", input, meeting.id, message);
    return { ok: false, status: 500, error: message, meetingId: meeting.id, meeting: null };
  }

  const finalVoiceReady = buildVoiceReadyState({
    agents: availableAgents,
    reports,
    settings,
    meetingType: input.meetingType,
    generatedAt,
    activationStatus: "joined",
    error: null,
  });
  const activatedMeetingForOutput = { ...meeting, voiceReadyJson: finalVoiceReady };

  const outputId = await mirrorMeetingToAiAssets(db, activatedMeetingForOutput, reports, aggregate, sourceSnapshot, input.actorUserId ?? null);
  const agentTaskIds = await mirrorAgentReportsToAiWorkforce(db, activatedMeetingForOutput, reports, outputId, input.actorUserId ?? null);
  const taskId = await mirrorMeetingToAiWorkforce(db, activatedMeetingForOutput, outputId, input.actorUserId ?? null, reports, agentTaskIds);
  const voiceReadyWithTasks = withDailyAgentTaskTelemetry(finalVoiceReady, agentTaskIds, taskId, reports);
  const activatedMeeting = { ...activatedMeetingForOutput, voiceReadyJson: voiceReadyWithTasks };
  await db
    .from("executive_meetings")
    .update({
      voice_ready_json: voiceReadyWithTasks,
      ai_output_id: outputId,
      ai_workforce_task_id: taskId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", meeting.id);

  await auditAgentActivations("success", input, activatedMeeting, finalVoiceReady, null);
  await auditMeeting("success", input, meeting.id, null);

  return {
    ok: true,
    id: meeting.id,
    meetingId: meeting.id,
    meeting: {
      ...activatedMeeting,
      aiOutputId: outputId,
      aiWorkforceTaskId: taskId,
    },
  };
}

export function getNewYorkLocalParts(now = new Date(), timezone = "America/New_York") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = value("hour") === "24" ? "00" : value("hour");
  return {
    dateKey: `${value("year")}-${value("month")}-${value("day")}`,
    timeKey: `${hour}:${value("minute")}`,
    weekday: value("weekday"),
  };
}

export function dueMeetingTypesForNow(settings: ExecutiveMeetingSettings, now = new Date()): ExecutiveMeetingType[] {
  if (!settings.autoGenerateEnabled) return [];
  const local = getNewYorkLocalParts(now, settings.timezone);
  const currentMinute = minuteOfDay(local.timeKey);
  const morning = minuteOfDay(settings.morningTime.slice(0, 5));
  const afternoon = minuteOfDay(settings.afternoonTime.slice(0, 5));
  const due: ExecutiveMeetingType[] = [];
  if (isDueMinute(currentMinute, morning)) due.push("morning");
  if (isDueMinute(currentMinute, afternoon)) due.push("afternoon");
  return due;
}

export function autoIdempotencyKey(meetingType: ExecutiveMeetingType, settings: ExecutiveMeetingSettings, now = new Date()) {
  const local = getNewYorkLocalParts(now, settings.timezone);
  return `executive-${local.dateKey}-${meetingType}-auto`;
}

export function manualIdempotencyKey(meetingType: ExecutiveMeetingType, settings: ExecutiveMeetingSettings, now = new Date()) {
  const local = getNewYorkLocalParts(now, settings.timezone);
  return `executive-${local.dateKey}-${meetingType}-manual`;
}

async function findMeetingByIdempotencyKey(db: Db, idempotencyKey: string): Promise<ExecutiveMeeting | null> {
  const { data, error } = await db
    .from("executive_meetings")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error || !data) return null;
  return mapExecutiveMeetingRow(data as GenericRow);
}

async function ensureExistingMeetingActivation(
  db: Db,
  meeting: ExecutiveMeeting,
  settings: ExecutiveMeetingSettings,
  input: {
    meetingType: ExecutiveMeetingType;
    actorUserId?: string | null;
    actorType?: "human" | "cron" | "system";
  },
): Promise<ExecutiveMeeting> {
  if (
    meeting.voiceReadyJson.activationStatus === "joined" &&
    meeting.voiceReadyJson.activationComplete === true &&
    meeting.voiceReadyJson.activationMeetingType === meeting.meetingType
  ) {
    return meeting;
  }

  const [agentsResult, reportsResult] = await Promise.all([
    fetchExecutiveAgents(db),
    db
      .from("executive_agent_reports")
      .select("*")
      .eq("meeting_id", meeting.id),
  ]);
  const reportsError = "error" in reportsResult && reportsResult.error ? reportsResult.error.message : null;
  const reports = ((reportsResult.data ?? []) as GenericRow[]).map(mapExecutiveAgentReportRow);
  const availableAgents = agentsResult.agents.filter((agent) => !agent.archivedAt);
  const enabledAgentCount = availableAgents.filter((agent) => agent.enabled).length;
  const activationError = reportsError || (reports.length < enabledAgentCount ? "Existing meeting is missing one or more enabled agent reports." : null);
  const voiceReady = buildVoiceReadyState({
    agents: availableAgents,
    reports,
    settings,
    meetingType: meeting.meetingType,
    generatedAt: meeting.generatedAt,
    activationStatus: reportsError ? "failed" : "joined",
    error: activationError,
  });

  const { error } = await db
    .from("executive_meetings")
    .update({
      voice_ready_json: voiceReady,
      updated_at: new Date().toISOString(),
    })
    .eq("id", meeting.id);
  if (error) {
    await auditMeeting("failure", input, meeting.id, `Existing meeting activation update failed: ${error.message}`);
    return meeting;
  }

  const activatedMeeting = { ...meeting, voiceReadyJson: voiceReady };
  const agentTaskIds = await mirrorAgentReportsToAiWorkforce(db, activatedMeeting, reports, meeting.aiOutputId, input.actorUserId ?? null);
  const ceoTaskId = await mirrorMeetingToAiWorkforce(db, activatedMeeting, meeting.aiOutputId, input.actorUserId ?? null, reports, agentTaskIds);
  const activatedMeetingWithTasks = {
    ...activatedMeeting,
    voiceReadyJson: withDailyAgentTaskTelemetry(voiceReady, agentTaskIds, ceoTaskId ?? meeting.aiWorkforceTaskId, reports),
  };
  if (agentTaskIds.length > 0 || ceoTaskId) {
    await db
      .from("executive_meetings")
      .update({
        voice_ready_json: activatedMeetingWithTasks.voiceReadyJson,
        ai_workforce_task_id: ceoTaskId ?? meeting.aiWorkforceTaskId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", meeting.id);
  }
  await auditAgentActivations(
    activatedMeetingWithTasks.voiceReadyJson.activationComplete === true ? "success" : "failure",
    input,
    activatedMeetingWithTasks,
    activatedMeetingWithTasks.voiceReadyJson,
    activationError,
  );
  return activatedMeetingWithTasks;
}

function buildAgentReport(input: {
  agent: ExecutiveAgent;
  meetingType: ExecutiveMeetingType;
  sourceSnapshot: ExecutiveSourceSnapshot;
  commitments: ExecutiveAgentCommitment[];
}): Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt"> {
  const sourceNotes = sourcesForAgent(input.agent, input.sourceSnapshot);
  const kpis = kpisForAgent(input.agent, input.sourceSnapshot, input.commitments);
  const priorities = prioritiesForAgent(input.agent, input.sourceSnapshot);
  const risks = risksForAgent(input.agent, input.sourceSnapshot);
  const blockers = blockersForAgent(input.agent, input.sourceSnapshot);
  const decisions = decisionsForAgent(input.agent, input.sourceSnapshot);
  const revenueImpact = revenueForAgent(input.agent, input.sourceSnapshot);
  const planned = input.meetingType === "afternoon" ? [] : plannedWorkForAgent(input.agent, priorities, decisions);
  const completed = input.meetingType === "morning" ? [] : afternoonResultsForAgent(input.agent, input.sourceSnapshot, input.commitments);
  const summary = summaryForAgentReport({
    role: input.agent.role,
    meetingType: input.meetingType,
    priorities,
    decisions,
    completed,
    blockers,
  });

  return {
    agentId: input.agent.id,
    agentKey: input.agent.agentKey,
    agentName: input.agent.name,
    role: input.agent.role,
    reportType: input.meetingType,
    summary,
    plannedWorkJson: planned,
    completedWorkJson: completed,
    prioritiesJson: priorities,
    risksJson: risks,
    blockersJson: blockers,
    decisionsNeededJson: decisions,
    revenueImpactJson: revenueImpact,
    kpiSnapshotJson: kpis,
    dataSourcesJson: sourceNotes,
    confidenceScore: input.sourceSnapshot.warnings.length > 0 ? 76 : 88,
    approvalRequired: decisions.length > 0,
  };
}

function prioritiesForAgent(agent: ExecutiveAgent, snapshot: ExecutiveSourceSnapshot): ExecutivePriority[] {
  const totals = snapshot.totals;
  switch (agent.agentKey) {
    case "ceo":
      return [
        priority("Clear today's highest-value approvals", `${totals.pendingMiniAppApprovals + totals.outreachApprovals} review item(s) need executive attention.`, "HomeReach", "urgent"),
        priority("Protect focus across the AI workforce", `${totals.openAiTasks} open AI task(s) and ${totals.manualTakeovers} manual takeover(s) need sequencing.`, "Operations", "high"),
      ];
    case "cto":
      return [
        priority("Harden production readiness", `${snapshot.warnings.length} source adapter warning(s) need technical triage.`, "HomeReach", snapshot.warnings.length > 0 ? "urgent" : "high"),
        priority("Keep execution safe", `${totals.manualTakeovers} queue item(s) require manual takeover review.`, "Operations", "high"),
      ];
    case "chief_outreach_officer":
      return [
        priority("Clear approval-safe outreach", `${totals.outreachApprovals} outbound review item(s) are waiting.`, "Outreach", totals.outreachApprovals > 0 ? "urgent" : "high"),
        priority("Work follow-ups without spam patterns", `${totals.followUpsDue} follow-up(s) are due or overdue.`, "Outreach", "high"),
      ];
    case "cro":
      return [
        priority("Move revenue approvals", `${money(totals.estimatedRevenueAwaitingApproval)} estimated revenue is waiting on approval-sensitive work.`, "Finance", "urgent"),
        priority("Unstick revenue follow-ups", `${totals.followUpsDue} due follow-up(s) can move pipeline if handled with approval gates.`, "Outreach", "high"),
      ];
    case "cfo":
      return [
        priority("Protect cash and margin", `${money(totals.estimatedSavingsAwaitingApproval)} estimated savings and ${money(totals.estimatedRevenueAwaitingApproval)} estimated revenue are in review lanes.`, "Finance", "high"),
      ];
    case "operations":
      return [
        priority("Reduce manual takeover load", `${totals.manualTakeovers} execution queue item(s) require human intervention.`, "Operations", totals.manualTakeovers > 0 ? "urgent" : "normal"),
        priority("Keep projects moving", `${totals.websiteProjects} website project record(s), ${totals.activeCampaigns} campaign record(s), and ${totals.openAiTasks} AI task(s) need operating rhythm.`, "Operations", "high"),
      ];
    case "qa_risk":
      return [
        priority("Audit risks before action", `${totals.failedOrRiskEvents + snapshot.warnings.length} risk signal(s) are visible in audit/source adapters.`, "Operations", totals.failedOrRiskEvents > 0 ? "urgent" : "high"),
      ];
    case "customer_success":
      return [
        priority("Protect client momentum", `${totals.websiteProjects} website project(s) and ${totals.activeCampaigns} campaign(s) should be checked for missing assets or blockers.`, "Websites", "high"),
      ];
    case "cmo":
      return [
        priority("Turn demand into approval-ready campaigns", `${totals.leadsToday} new lead(s), ${totals.activeCampaigns} campaign record(s), and ${totals.pendingMiniAppApprovals} mini app(s) can shape today's messaging work.`, "HomeReach", "high"),
      ];
    default:
      return [
        priority("Execute assigned leadership lane", `${agent.assignedDomains.join(", ") || "HomeReach"} needs review-ready daily progress.`, agent.assignedDomains[0] ?? "HomeReach", "normal"),
      ];
  }
}

function risksForAgent(agent: ExecutiveAgent, snapshot: ExecutiveSourceSnapshot): ExecutiveRisk[] {
  const risks: ExecutiveRisk[] = [];
  if (snapshot.warnings.length > 0 && ["cto", "qa_risk", "ceo"].includes(agent.agentKey)) {
    risks.push({
      title: "Some source adapters are not fully connected",
      detail: snapshot.warnings.slice(0, 3).join("; "),
      severity: "medium",
      owner: agent.role,
    });
  }
  if (snapshot.totals.manualTakeovers > 0 && ["operations", "cto", "qa_risk", "ceo"].includes(agent.agentKey)) {
    risks.push({
      title: "Manual takeover required",
      detail: `${snapshot.totals.manualTakeovers} execution item(s) require a human before progress can continue.`,
      severity: "high",
      owner: agent.role,
    });
  }
  if (snapshot.totals.outreachApprovals > 0 && agent.assignedDomains.includes("Outreach")) {
    risks.push({
      title: "Outbound work is approval-gated",
      detail: "Drafted outreach must remain unsent until a human approves the exact content and destination.",
      severity: "medium",
      owner: agent.role,
    });
  }
  return risks.length ? risks : [{ title: "No critical risk surfaced", detail: "Continue normal review cadence and preserve approval boundaries.", severity: "low", owner: agent.role }];
}

function blockersForAgent(agent: ExecutiveAgent, snapshot: ExecutiveSourceSnapshot): ExecutiveBlocker[] {
  const blockers: ExecutiveBlocker[] = [];
  if (snapshot.totals.manualTakeovers > 0 && ["operations", "cto", "qa_risk", "ceo"].includes(agent.agentKey)) {
    blockers.push({
      title: "Manual takeover queue",
      detail: "Execution cannot continue until the takeover item is reviewed and resolved by a human.",
      agentKey: agent.agentKey,
      severity: "high",
      needsHuman: true,
    });
  }
  if (snapshot.warnings.length > 0 && agent.agentKey === "cto") {
    blockers.push({
      title: "Data adapter warnings",
      detail: "Some executive source adapters returned missing-table or query warnings. This should be cleaned up as sources mature.",
      agentKey: agent.agentKey,
      severity: "medium",
      needsHuman: false,
    });
  }
  return blockers;
}

function decisionsForAgent(agent: ExecutiveAgent, snapshot: ExecutiveSourceSnapshot): ExecutiveDecision[] {
  const totals = snapshot.totals;
  const decisions: ExecutiveDecision[] = [];
  if (agent.agentKey === "ceo" && totals.pendingMiniAppApprovals + totals.outreachApprovals > 0) {
    decisions.push(decision("Clear approval stack", `${totals.pendingMiniAppApprovals + totals.outreachApprovals} approval-sensitive item(s) should be reviewed today.`, agent.agentKey, "high", "Prevents revenue and operations from stalling behind review queues."));
  }
  if (agent.agentKey === "cro" && totals.estimatedRevenueAwaitingApproval > 0) {
    decisions.push(decision("Prioritize revenue approvals", `${money(totals.estimatedRevenueAwaitingApproval)} estimated revenue is waiting on approval-sensitive work.`, agent.agentKey, "high", "Revenue work cannot safely move forward without owner review."));
  }
  if (agent.agentKey === "cfo" && totals.estimatedSavingsAwaitingApproval > 0) {
    decisions.push(decision("Review savings recommendations", `${money(totals.estimatedSavingsAwaitingApproval)} estimated savings are in review.`, agent.agentKey, "medium", "Savings recommendations should be checked before any vendor or spend action."));
  }
  if (agent.agentKey === "operations" && totals.manualTakeovers > 0) {
    decisions.push(decision("Resolve manual takeover", `${totals.manualTakeovers} execution item(s) need human intervention.`, agent.agentKey, "high", "Future browser/computer-use work must not proceed without a controlled human handoff."));
  }
  if (agent.agentKey === "qa_risk" && totals.failedOrRiskEvents > 0) {
    decisions.push(decision("Review failed/risk events", `${totals.failedOrRiskEvents} audit risk event(s) need triage.`, agent.agentKey, "high", "Prevents approval gaps, provider failures, or unsafe automation from compounding."));
  }
  if (agent.agentKey === "chief_outreach_officer" && totals.outreachApprovals > 0) {
    decisions.push(decision("Approve or revise outbound drafts", `${totals.outreachApprovals} outreach draft(s) are waiting; none should send automatically.`, agent.agentKey, "medium", "Maintains sender reputation and preserves human approval before outbound communication."));
  }
  return decisions;
}

function plannedWorkForAgent(agent: ExecutiveAgent, priorities: ExecutivePriority[], decisions: ExecutiveDecision[]): ExecutiveWorkItem[] {
  return priorities.slice(0, 3).map((item, index) => ({
    title: item.title,
    detail: item.detail,
    domain: item.domain,
    owner: agent.role,
    expectedOutcome: decisions[index]?.title ?? "Review-ready operating progress by afternoon call.",
    status: "planned",
  }));
}

function afternoonResultsForAgent(agent: ExecutiveAgent, snapshot: ExecutiveSourceSnapshot, commitments: ExecutiveAgentCommitment[]): ExecutiveWorkItem[] {
  const activeCommitments = commitments.filter((commitment) => commitment.agentId === agent.id && ["planned", "deferred", "blocked"].includes(commitment.status));
  const results = activeCommitments.slice(0, 2).map((commitment) => ({
    title: commitment.commitmentText,
    detail: "Completion evidence was not automatically asserted; this remains reviewable until source-backed proof or human confirmation is attached.",
    domain: commitment.domain,
    owner: agent.role,
    expectedOutcome: "Confirm complete, defer, or convert into tomorrow priority.",
    status: "needs_verification",
  }));

  if (results.length > 0) return results;
  return [
    {
      title: "Source-backed executive review prepared",
      detail: `${snapshot.adapters.filter((adapter) => adapter.status === "online").length} live adapter(s) were reviewed for this afternoon report.`,
      domain: agent.assignedDomains[0] ?? "HomeReach",
      owner: agent.role,
      expectedOutcome: "Use this report to decide tomorrow priorities.",
      status: "reported",
    },
  ];
}

function kpisForAgent(agent: ExecutiveAgent, snapshot: ExecutiveSourceSnapshot, commitments: ExecutiveAgentCommitment[]): ExecutiveKpiSnapshot[] {
  const totals = snapshot.totals;
  const missed = commitments.filter((commitment) => commitment.agentId === agent.id && commitment.status === "missed").length;
  const base = [
    kpi("source_adapters", "Live data adapters", snapshot.adapters.filter((adapter) => adapter.status === "online").length, snapshot.warnings.length ? "flat" : "up"),
    kpi("missed_commitments", "Missed commitments", missed, missed > 0 ? "down" : "flat"),
  ];

  if (agent.agentKey === "cro") base.push(kpi("revenue_waiting", "Revenue awaiting approval", money(totals.estimatedRevenueAwaitingApproval), totals.estimatedRevenueAwaitingApproval > 0 ? "up" : "flat"));
  if (agent.agentKey === "cfo") base.push(kpi("savings_waiting", "Savings awaiting approval", money(totals.estimatedSavingsAwaitingApproval), totals.estimatedSavingsAwaitingApproval > 0 ? "up" : "flat"));
  if (agent.assignedDomains.includes("Outreach")) base.push(kpi("followups_due", "Follow-ups due", totals.followUpsDue, totals.followUpsDue > 0 ? "up" : "flat"));
  if (agent.agentKey === "operations") base.push(kpi("manual_takeovers", "Manual takeovers", totals.manualTakeovers, totals.manualTakeovers > 0 ? "down" : "flat"));
  if (agent.agentKey === "qa_risk") base.push(kpi("risk_events", "Risk events", totals.failedOrRiskEvents, totals.failedOrRiskEvents > 0 ? "down" : "flat"));
  return base;
}

function sourcesForAgent(agent: ExecutiveAgent, snapshot: ExecutiveSourceSnapshot): ExecutiveDataSourceNote[] {
  const keys = new Set<string>();
  if (agent.agentKey === "ceo") ["mini_app_approvals", "open_ai_tasks", "manual_takeovers", "risk_events"].forEach((key) => keys.add(key));
  if (agent.agentKey === "cto") ["ai_activity_24h", "risk_events", "manual_takeovers"].forEach((key) => keys.add(key));
  if (agent.agentKey === "cro") ["leads_today", "followups_due", "mini_app_approvals", "paid_orders"].forEach((key) => keys.add(key));
  if (agent.agentKey === "cfo") ["paid_orders", "mini_app_approvals"].forEach((key) => keys.add(key));
  if (agent.assignedDomains.includes("Outreach")) ["outreach_approvals", "revenue_messages_24h", "followups_due"].forEach((key) => keys.add(key));
  if (agent.assignedDomains.includes("Websites")) keys.add("website_projects");
  if (agent.assignedDomains.includes("Political Mail")) keys.add("political_campaigns");
  if (agent.agentKey === "operations") ["website_projects", "targeted_campaigns", "political_campaigns", "manual_takeovers"].forEach((key) => keys.add(key));
  if (agent.agentKey === "qa_risk") ["risk_events", "manual_takeovers", "mini_app_approvals"].forEach((key) => keys.add(key));

  return snapshot.adapters
    .filter((adapter) => keys.has(adapter.key))
    .map(({ key, label, status, value, detail, href }) => ({ key, label, status, value, detail, href }));
}

function revenueForAgent(agent: ExecutiveAgent, snapshot: ExecutiveSourceSnapshot): ExecutiveRevenueImpact {
  const totals = snapshot.totals;
  if (["ceo", "cro"].includes(agent.agentKey)) {
    return {
      estimatedRevenue: totals.estimatedRevenueAwaitingApproval,
      estimatedSavings: totals.estimatedSavingsAwaitingApproval,
      estimatedCostAvoided: 0,
      detail: "Aggregated from approval-sensitive mini apps and executive source adapters.",
    };
  }
  if (agent.agentKey === "cfo") {
    return {
      estimatedRevenue: totals.estimatedRevenueAwaitingApproval,
      estimatedSavings: totals.estimatedSavingsAwaitingApproval,
      estimatedCostAvoided: totals.manualTakeovers > 0 ? 250 : 0,
      detail: "Financial review focuses on approval-safe revenue, savings, and avoided operational risk.",
    };
  }
  return {
    estimatedRevenue: agent.assignedDomains.includes("Outreach") ? totals.estimatedRevenueAwaitingApproval : 0,
    estimatedSavings: agent.assignedDomains.includes("Supplyfy") ? totals.estimatedSavingsAwaitingApproval : 0,
    estimatedCostAvoided: 0,
    detail: "Domain-specific impact estimate; no guarantee or external action implied.",
  };
}

function buildMeetingAggregate(
  meetingType: ExecutiveMeetingType,
  reports: Array<Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">>,
  snapshot: ExecutiveSourceSnapshot,
) {
  const decisions = reports.flatMap((report) => report.decisionsNeededJson).slice(0, 16);
  const blockers = reports.flatMap((report) => report.blockersJson).slice(0, 16);
  const tomorrowPriorities = reports.flatMap((report) => report.prioritiesJson).slice(0, 12);
  const revenueImpact: ExecutiveRevenueImpact = {
    estimatedRevenue: snapshot.totals.estimatedRevenueAwaitingApproval,
    estimatedSavings: snapshot.totals.estimatedSavingsAwaitingApproval,
    estimatedCostAvoided: blockers.length > 0 ? blockers.length * 150 : 0,
    detail: "Estimated approval-sensitive revenue/savings from current source adapters and mini app review queues.",
  };
  const ceoSummary = ceoSummaryForMeeting(meetingType, {
    decisions: decisions.length,
    blockers: blockers.length,
    reports: reports.length,
    revenue: revenueImpact.estimatedRevenue,
    savings: revenueImpact.estimatedSavings,
    sourceWarnings: snapshot.warnings.length,
    failedOrRiskEvents: snapshot.totals.failedOrRiskEvents,
  });
  return { ceoSummary, decisions, blockers, tomorrowPriorities, revenueImpact };
}

function titleForMeeting(meetingType: ExecutiveMeetingType, dateKey: string) {
  if (meetingType === "morning") return `Morning Executive Standup - ${dateKey}`;
  if (meetingType === "afternoon") return `Afternoon Executive Review - ${dateKey}`;
  if (meetingType === "emergency") return `Emergency Operations Meeting - ${dateKey}`;
  return `Strategic Planning Session - ${dateKey}`;
}

function summaryForAgentReport(input: {
  role: string;
  meetingType: ExecutiveMeetingType;
  priorities: ExecutivePriority[];
  decisions: ExecutiveDecision[];
  completed: ExecutiveWorkItem[];
  blockers: ExecutiveBlocker[];
}) {
  if (input.meetingType === "morning") {
    return `${input.role} will focus on ${input.priorities[0]?.title.toLowerCase() ?? "the highest-leverage operating priority"} while keeping ${input.decisions.length} approval-sensitive decision${input.decisions.length === 1 ? "" : "s"} visible.`;
  }
  if (input.meetingType === "afternoon") {
    return `${input.role} reports ${input.completed.length} reviewable result${input.completed.length === 1 ? "" : "s"} and ${input.blockers.length} blocker${input.blockers.length === 1 ? "" : "s"} needing attention before tomorrow.`;
  }
  if (input.meetingType === "emergency") {
    return `${input.role} is focused on containment, diagnosis, and approval-safe recovery planning with ${input.blockers.length} blocker${input.blockers.length === 1 ? "" : "s"} requiring review.`;
  }
  return `${input.role} is contributing strategic recommendations, assumption checks, and action-plan options across ${input.priorities.length} priority area${input.priorities.length === 1 ? "" : "s"}.`;
}

function ceoSummaryForMeeting(
  meetingType: ExecutiveMeetingType,
  counts: {
    decisions: number;
    blockers: number;
    reports: number;
    revenue: number;
    savings: number;
    sourceWarnings: number;
    failedOrRiskEvents: number;
  },
) {
  if (meetingType === "morning") {
    return `Today's executive stack has ${counts.decisions} decision(s), ${counts.blockers} blocker(s), ${money(counts.revenue)} revenue awaiting approval, and ${money(counts.savings)} savings awaiting review. Focus should stay on clearing approval queues, preserving safety gates, and moving the highest-value work first.`;
  }
  if (meetingType === "afternoon") {
    return `Afternoon accountability shows ${counts.reports} agent report(s), ${counts.blockers} blocker(s), and ${counts.decisions} decision(s) still needing owner attention. Tomorrow should prioritize unresolved approvals, manual takeovers, and any source-adapter risk that limits executive visibility.`;
  }
  if (meetingType === "emergency") {
    return `Emergency operations assembled ${counts.reports} executive agent(s) around ${counts.failedOrRiskEvents} failed or risk event(s), ${counts.sourceWarnings} source warning(s), and ${counts.blockers} blocker(s). The team should contain risk, protect revenue paths, and produce only approval-safe recovery actions.`;
  }
  return `Strategic planning assembled ${counts.reports} executive agent(s), ${counts.decisions} decision path(s), and ${counts.blockers} strategic blocker(s). The session should challenge assumptions, convert recommendations into owned action items, and keep revenue/savings impact tied to reviewable evidence.`;
}

function buildVoiceReadyState(input: {
  agents: ExecutiveAgent[];
  reports: Array<Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">>;
  settings: ExecutiveMeetingSettings;
  meetingType: ExecutiveMeetingType;
  generatedAt: string;
  activationStatus: "joining" | "joined" | "failed";
  error: string | null;
}) {
  const reportByAgentKey = new Map(input.reports.map((report) => [report.agentKey, report]));
  const activeAgentRoster = input.agents.map((agent, index) => {
    const report = reportByAgentKey.get(agent.agentKey);
    const enabled = agent.enabled && !agent.archivedAt;
    const status: AgentActivationStatus = !enabled
      ? "skipped_disabled"
      : input.activationStatus === "failed"
        ? "failed"
        : input.activationStatus === "joining"
          ? "joining"
          : report
            ? "joined"
            : "missing_report";
    return {
      sequence: index + 1,
      agentId: agent.id,
      agentKey: agent.agentKey,
      agentName: agent.name,
      role: agent.role,
      meetingType: input.meetingType,
      status,
      joinedAt: status === "joined" ? input.generatedAt : null,
      reportExpected: enabled,
      reportCreated: Boolean(report && status === "joined"),
      approvalRequired: report?.approvalRequired ?? false,
      confidenceScore: report?.confidenceScore ?? null,
      permissionsLevel: agent.permissionsLevel,
      assignedDomains: agent.assignedDomains,
      blockedReason: status === "skipped_disabled"
        ? "Agent is disabled."
        : status === "failed"
          ? input.error
          : status === "missing_report"
            ? "Agent report was not created for this meeting."
            : null,
    };
  });
  const joinedAgentCount = activeAgentRoster.filter((item) => item.status === "joined").length;
  const expectedAgentCount = activeAgentRoster.filter((item) => item.reportExpected).length;
  const missingAgentCount = activeAgentRoster.filter((item) => item.status === "missing_report" || item.status === "failed").length;

  return {
    providerInterface: "future_provider_abstraction",
    supportedFutureProviders: ["openai_realtime", "openai_text_to_speech", "other_voice_provider"],
    realtimeVoiceRoute: "/api/admin/executive-chat/realtime/connect",
    voiceModeEnabled: input.settings.voiceModeEnabled,
    turnTaking: "agent_order_then_user_interrupt_future_ready",
    transcriptSaving: true,
    externalActionApprovalRequired: true,
    liveModeExternalExecutionEnabled: false,
    activationRosterVersion: "2026-06-04",
    activationStatus: input.activationStatus,
    activationMeetingType: input.meetingType,
    activationGeneratedAt: input.generatedAt,
    activeAgentRoster,
    expectedAgentCount,
    joinedAgentCount,
    skippedAgentCount: activeAgentRoster.filter((item) => item.status === "skipped_disabled").length,
    missingAgentCount,
    activationComplete: expectedAgentCount > 0 && joinedAgentCount === expectedAgentCount && missingAgentCount === 0,
    activationErrors: input.error ? [input.error] : [],
    schedule: {
      timezone: input.settings.timezone,
      morningTime: input.settings.morningTime,
      afternoonTime: input.settings.afternoonTime,
      selectedTime: input.meetingType === "morning"
        ? input.settings.morningTime
        : input.meetingType === "afternoon"
          ? input.settings.afternoonTime
          : null,
    },
  };
}

async function persistBoardroomMemory(
  db: Db,
  meeting: ExecutiveMeeting,
  agents: ExecutiveAgent[],
  reports: Array<Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">>,
  aggregate: ReturnType<typeof buildMeetingAggregate>,
  meetingType: ExecutiveMeetingType,
  generatedAt: string,
) {
  const enabledAgents = agents.filter((agent) => agent.enabled && !agent.archivedAt);
  const reportByAgentKey = new Map(reports.map((report) => [report.agentKey, report]));
  const participantRows = [
    {
      meeting_id: meeting.id,
      participant_type: "facilitator",
      agent_id: null,
      participant_key: "executive_secretary",
      display_name: "Executive Secretary",
      title: "Executive Secretary",
      role_in_meeting: "facilitator",
      seat_index: 0,
      attendance_status: "joined",
      voice_profile_key: "secretary",
      current_assignment: meetingType === "morning" ? "Open the standup, enforce agenda order, and capture owner decisions." : "Open the review, enforce accountability order, and close with next actions.",
      performance_json: { meetingRole: "moderator", votes: false },
      joined_at: generatedAt,
    },
    ...enabledAgents.map((agent, index) => {
      const report = reportByAgentKey.get(agent.agentKey);
      return {
        meeting_id: meeting.id,
        participant_type: "ai_executive",
        agent_id: agent.id,
        participant_key: agent.agentKey,
        display_name: agent.name,
        title: executiveTitle(agent.role),
        role_in_meeting: "voting_member",
        seat_index: index + 1,
        attendance_status: "joined",
        voice_profile_key: voiceKeyForAgent(agent.agentKey),
        current_assignment: report?.prioritiesJson[0]?.title ?? report?.plannedWorkJson[0]?.title ?? agent.dailyResponsibilities[0] ?? agent.mission,
        performance_json: {
          confidenceScore: report?.confidenceScore ?? null,
          recommendationsOpen: report?.decisionsNeededJson.length ?? 0,
          blockersOpen: report?.blockersJson.length ?? 0,
          revenueImpact: report?.revenueImpactJson.estimatedRevenue ?? 0,
          savingsImpact: report?.revenueImpactJson.estimatedSavings ?? 0,
        },
        joined_at: generatedAt,
      };
    }),
    {
      meeting_id: meeting.id,
      participant_type: "observer",
      agent_id: null,
      participant_key: "chief_of_staff",
      display_name: "Chief of Staff",
      title: "Chief of Staff",
      role_in_meeting: "silent_note_taker",
      seat_index: enabledAgents.length + 1,
      attendance_status: "listening",
      voice_profile_key: "chief_of_staff",
      current_assignment: "Silently capture notes, decisions, action items, risks, commitments, owners, and due dates.",
      performance_json: { meetingRole: "silent_note_taker", speaksOnlyWhenAsked: true },
      joined_at: generatedAt,
    },
  ];

  const { data: participants, error: participantError } = await db
    .from("executive_meeting_participants")
    .upsert(participantRows, { onConflict: "meeting_id,participant_key" })
    .select("id, participant_key");
  if (participantError) {
    if (isMissingRelationError(participantError.message)) return;
    throw new Error(`Executive boardroom participants insert failed: ${participantError.message}`);
  }

  const participantIdByKey = new Map(
    ((participants ?? []) as Array<{ id?: string; participant_key?: string }>).map((item) => [String(item.participant_key ?? ""), String(item.id ?? "")]),
  );
  const transcriptRows = buildBoardroomTranscriptRows({
    meeting,
    reports,
    aggregate,
    generatedAt,
    participantIdByKey,
  });
  const outcomeRows = buildBoardroomOutcomeRows({
    meeting,
    reports,
    aggregate,
    generatedAt,
  });

  const [{ error: transcriptError }, { error: outcomeError }] = await Promise.all([
    db.from("executive_meeting_transcript_entries").upsert(transcriptRows, { onConflict: "meeting_id,sequence" }),
    db.from("executive_meeting_outcomes").insert(outcomeRows),
  ]);
  if (transcriptError && !isMissingRelationError(transcriptError.message)) {
    throw new Error(`Executive boardroom transcript insert failed: ${transcriptError.message}`);
  }
  if (outcomeError && !isMissingRelationError(outcomeError.message)) {
    throw new Error(`Executive boardroom outcomes insert failed: ${outcomeError.message}`);
  }

  const estimatedDuration = Math.max(8, Math.min(45, 4 + reports.length * 3));
  await db
    .from("executive_meetings")
    .update({
      ended_at: new Date(Date.parse(generatedAt) + estimatedDuration * 60_000).toISOString(),
      duration_seconds: estimatedDuration * 60,
      recording_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", meeting.id);
}

function buildBoardroomTranscriptRows(input: {
  meeting: ExecutiveMeeting;
  reports: Array<Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">>;
  aggregate: ReturnType<typeof buildMeetingAggregate>;
  generatedAt: string;
  participantIdByKey: Map<string, string>;
}) {
  let sequence = 1;
  const entry = (args: {
    speakerKey: string;
    speakerName: string;
    speakerTitle: string;
    speakerType: "ai_executive" | "facilitator" | "observer" | "system";
    statement: string;
    statementType: "opening" | "agent_report" | "summary" | "closing";
    source?: "generated_report" | "system";
    metadata?: Record<string, unknown>;
  }) => ({
    meeting_id: input.meeting.id,
    participant_id: input.participantIdByKey.get(args.speakerKey) || null,
    speaker_key: args.speakerKey,
    speaker_name: args.speakerName,
    speaker_title: args.speakerTitle,
    speaker_type: args.speakerType,
    sequence: sequence++,
    started_at: new Date(Date.parse(input.generatedAt) + sequence * 45_000).toISOString(),
    statement: args.statement,
    statement_type: args.statementType,
    source: args.source ?? "generated_report",
    metadata_json: {
      meetingId: input.meeting.id,
      meetingType: input.meeting.meetingType,
      externalActionAuthorized: false,
      ...(args.metadata ?? {}),
    },
  });

  return [
    entry({
      speakerKey: "executive_secretary",
      speakerName: "Executive Secretary",
      speakerTitle: "Executive Secretary",
      speakerType: "facilitator",
      statement: `Opening ${input.meeting.title}. The agenda is structured, source-backed, and approval-gated. We will capture decisions, risks, action items, commitments, and follow-up owners before closing.`,
      statementType: "opening",
      source: "system",
    }),
    ...input.reports.map((report) => entry({
      speakerKey: report.agentKey,
      speakerName: report.agentName,
      speakerTitle: executiveTitle(report.role),
      speakerType: "ai_executive",
      statement: boardroomStatementForReport(report),
      statementType: "agent_report",
      metadata: {
        confidenceScore: report.confidenceScore,
        approvalRequired: report.approvalRequired,
        riskCount: report.risksJson.length,
        blockerCount: report.blockersJson.length,
      },
    })),
    entry({
      speakerKey: "chief_of_staff",
      speakerName: "Chief of Staff",
      speakerTitle: "Chief of Staff",
      speakerType: "observer",
      statement: `Meeting notes captured. Executive summary: ${input.aggregate.ceoSummary}`,
      statementType: "summary",
      source: "system",
      metadata: { silentNoteTaker: true },
    }),
    entry({
      speakerKey: "executive_secretary",
      speakerName: "Executive Secretary",
      speakerTitle: "Executive Secretary",
      speakerType: "facilitator",
      statement: `Closing ${input.meeting.title}. No external action has been authorized. Human review is still required for sends, spend, bids, public posts, account changes, data exports, or production-impacting execution.`,
      statementType: "closing",
      source: "system",
    }),
  ];
}

function buildBoardroomOutcomeRows(input: {
  meeting: ExecutiveMeeting;
  reports: Array<Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">>;
  aggregate: ReturnType<typeof buildMeetingAggregate>;
  generatedAt: string;
}) {
  const rows: GenericRow[] = [
    {
      meeting_id: input.meeting.id,
      outcome_type: "executive_summary",
      title: input.meeting.title,
      detail: input.aggregate.ceoSummary,
      priority: input.aggregate.blockers.some((item) => item.severity === "critical" || item.severity === "high") ? "high" : "normal",
      status: "open",
      metadata_json: {
        revenueImpact: input.aggregate.revenueImpact,
        externalActionAuthorized: false,
      },
    },
  ];

  input.reports.forEach((report) => {
    report.prioritiesJson.slice(0, 2).forEach((item) => rows.push({
      meeting_id: input.meeting.id,
      outcome_type: "action_item",
      owner_agent_id: report.agentId,
      owner_key: report.agentKey,
      owner_name: report.agentName,
      title: item.title,
      detail: item.detail,
      priority: item.priority ?? "normal",
      due_at: new Date(Date.parse(input.generatedAt) + 24 * 60 * 60 * 1000).toISOString(),
      status: "open",
      metadata_json: { domain: item.domain ?? null, externalActionAuthorized: false },
    }));
    report.decisionsNeededJson.forEach((item) => rows.push({
      meeting_id: input.meeting.id,
      outcome_type: "decision",
      owner_agent_id: report.agentId,
      owner_key: report.agentKey,
      owner_name: report.agentName,
      title: item.title,
      detail: item.detail,
      priority: item.riskLevel === "critical" || item.riskLevel === "high" ? "urgent" : "high",
      status: "needs_approval",
      metadata_json: {
        riskLevel: item.riskLevel,
        businessReason: item.businessReason,
        approvalRequired: item.approvalRequired,
        externalActionAuthorized: false,
      },
    }));
    report.blockersJson.forEach((item) => rows.push({
      meeting_id: input.meeting.id,
      outcome_type: "risk",
      owner_agent_id: report.agentId,
      owner_key: report.agentKey,
      owner_name: report.agentName,
      title: item.title,
      detail: item.detail,
      priority: item.severity === "critical" || item.severity === "high" ? "urgent" : "high",
      status: item.needsHuman ? "needs_approval" : "open",
      metadata_json: {
        severity: item.severity,
        needsHuman: item.needsHuman === true,
        resolutionPath: item.needsHuman ? "Human executive decision required before action." : "Agent can draft recommendation for review.",
        externalActionAuthorized: false,
      },
    }));
    report.kpiSnapshotJson.slice(0, 3).forEach((item) => rows.push({
      meeting_id: input.meeting.id,
      outcome_type: "scorecard_update",
      owner_agent_id: report.agentId,
      owner_key: report.agentKey,
      owner_name: report.agentName,
      title: item.label,
      detail: `${item.label}: ${String(item.value)} (${item.trend})`,
      priority: "normal",
      status: "completed",
      metadata_json: { kpiKey: item.key, trend: item.trend },
    }));
  });

  return rows;
}

function boardroomStatementForReport(report: Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">) {
  const primaryPriority = report.prioritiesJson[0];
  const primaryRisk = report.risksJson[0];
  const blocker = report.blockersJson[0];
  const decisionItem = report.decisionsNeededJson[0];
  const parts = [
    report.summary,
    primaryPriority ? `Priority: ${primaryPriority.title}. ${primaryPriority.detail}` : null,
    primaryRisk ? `Risk: ${primaryRisk.title}. ${primaryRisk.detail}` : null,
    blocker ? `Blocker: ${blocker.title}. ${blocker.detail}` : null,
    decisionItem ? `Decision needed: ${decisionItem.title}. ${decisionItem.businessReason}` : null,
  ].filter(Boolean);
  return parts.join(" ");
}

async function persistMeetingReport(
  db: Db,
  meeting: ExecutiveMeeting,
  aggregate: ReturnType<typeof buildMeetingAggregate>,
  snapshot: ExecutiveSourceSnapshot,
) {
  const markdown = buildMeetingMarkdown(meeting, aggregate, []);
  const { error } = await db.from("executive_meeting_reports").insert({
    meeting_id: meeting.id,
    report_type: "ceo_summary",
    title: meeting.title,
    summary: aggregate.ceoSummary,
    decisions_needed_json: aggregate.decisions,
    blockers_json: aggregate.blockers,
    revenue_impact_json: aggregate.revenueImpact,
    tomorrow_priorities_json: aggregate.tomorrowPriorities,
    report_markdown: markdown,
    source_snapshot_json: snapshot,
  });
  if (error) throw new Error(`Executive meeting report insert failed: ${error.message}`);
}

async function persistAgentReports(
  db: Db,
  meeting: ExecutiveMeeting,
  reports: Array<Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">>,
) {
  const rows = reports.map((report) => ({
    meeting_id: meeting.id,
    agent_id: report.agentId,
    agent_key: report.agentKey,
    agent_name: report.agentName,
    role: report.role,
    report_type: report.reportType,
    summary: report.summary,
    planned_work_json: report.plannedWorkJson,
    completed_work_json: report.completedWorkJson,
    priorities_json: report.prioritiesJson,
    risks_json: report.risksJson,
    blockers_json: report.blockersJson,
    decisions_needed_json: report.decisionsNeededJson,
    revenue_impact_json: report.revenueImpactJson,
    kpi_snapshot_json: report.kpiSnapshotJson,
    data_sources_json: report.dataSourcesJson,
    confidence_score: report.confidenceScore,
    approval_required: report.approvalRequired,
  }));
  if (rows.length) {
    const { error } = await db.from("executive_agent_reports").insert(rows);
    if (error) throw new Error(`Executive agent reports insert failed: ${error.message}`);
  }
}

async function persistApprovals(
  db: Db,
  meeting: ExecutiveMeeting,
  reports: Array<Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">>,
) {
  const rows = reports.flatMap((report) =>
    report.decisionsNeededJson
      .filter((item) => item.approvalRequired)
      .map((item) => ({
        meeting_id: meeting.id,
        agent_id: report.agentId,
        pending_action: item.title,
        business_reason: item.businessReason || item.detail,
        risk_level: item.riskLevel,
        approval_status: "pending",
        audit_payload_json: {
          source: "executive_meeting",
          meetingId: meeting.id,
          agentKey: report.agentKey,
          approvalBoundary: "Recommendation only. Does not authorize external execution.",
        },
      })),
  );
  if (rows.length) {
    const { error } = await db.from("executive_action_approvals").insert(rows);
    if (error) throw new Error(`Executive approvals insert failed: ${error.message}`);
  }
}

async function persistKpis(
  db: Db,
  meeting: ExecutiveMeeting,
  reports: Array<Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">>,
  dateKey: string,
) {
  const rows = reports.flatMap((report) =>
    report.kpiSnapshotJson.map((kpiItem) => ({
      agent_id: report.agentId,
      kpi_date: dateKey,
      kpi_key: kpiItem.key,
      kpi_label: kpiItem.label,
      value_numeric: typeof kpiItem.value === "number" ? kpiItem.value : null,
      value_text: typeof kpiItem.value === "string" ? kpiItem.value : null,
      trend: kpiItem.trend,
      source: "executive_meeting_snapshot",
      metadata_json: {
        meetingId: meeting.id,
        agentKey: report.agentKey,
      },
    })),
  );
  if (rows.length) {
    const { error } = await db.from("executive_agent_kpis").insert(rows);
    if (error) throw new Error(`Executive KPI insert failed: ${error.message}`);
  }
}

async function persistCommitments(
  db: Db,
  meeting: ExecutiveMeeting,
  reports: Array<Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">>,
  meetingType: ExecutiveMeetingType,
  dateKey: string,
) {
  if (meetingType === "afternoon") {
    const { error } = await db
      .from("executive_agent_commitments")
      .update({
        status: "deferred",
        evidence_json: {
          source: "afternoon_meeting",
          meetingId: meeting.id,
          note: "Completion was not automatically asserted. Human or source-backed evidence should close this commitment.",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("commitment_date", dateKey)
      .eq("status", "planned");
    if (error) throw new Error(`Executive commitment rollover failed: ${error.message}`);
  }

  const rows = reports
    .map((report) => {
      const first = meetingType === "morning" ? report.plannedWorkJson[0] : report.prioritiesJson[0];
      if (!first) return null;
      return {
        agent_id: report.agentId,
        meeting_id: meeting.id,
        commitment_date: dateKey,
        commitment_text: first.title,
        domain: first.domain ?? "HomeReach",
        status: meetingType === "morning" ? "planned" : "planned",
        evidence_json: {
          source: "executive_meeting",
          meetingId: meeting.id,
          meetingType,
          detail: first.detail,
        },
        revenue_impact: report.revenueImpactJson.estimatedRevenue,
        risk_level: report.risksJson.some((risk) => risk.severity === "critical" || risk.severity === "high") ? "high" : "medium",
        follow_up_date: nextDateKey(dateKey),
      };
    })
    .filter(Boolean);
  if (rows.length) {
    const { error } = await db.from("executive_agent_commitments").insert(rows);
    if (error) throw new Error(`Executive commitments insert failed: ${error.message}`);
  }
}

async function mirrorMeetingToAiAssets(
  db: Db,
  meeting: ExecutiveMeeting,
  reports: Array<Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">>,
  aggregate: ReturnType<typeof buildMeetingAggregate>,
  snapshot: ExecutiveSourceSnapshot,
  actorUserId: string | null,
) {
  const content = buildMeetingMarkdown(meeting, aggregate, reports);
  const { data, error } = await db
    .from("ai_outputs")
    .insert({
      title: meeting.title,
      agent_name: "CEO Agent",
      workflow: "Executive Daily Meeting",
      output_type: `${meeting.meetingType}_executive_meeting`,
      content,
      data_sources: [
        "AGENTS.md",
        "AI Assets Command Center",
        "AI Workforce Task Manifest",
        "Agent Mini Apps",
        "Revenue/Outreach/Operations adapters",
      ],
      prompt_sop_name: "Executive Daily Meeting System",
      approval_status: "needs_review",
      verification_status: "pending",
      status: "active",
      owner_user_id: actorUserId,
      notes: "Executive meeting report. Recommendations only; external actions still require explicit human approval.",
      metadata: {
        source: "executive_meetings",
        meetingId: meeting.id,
        meetingType: meeting.meetingType,
        sourceWarnings: snapshot.warnings,
        approvalBoundary: "Does not authorize sends, posts, payments, bids, campaign changes, data deletion, production edits, or external execution.",
      },
    })
    .select("id")
    .maybeSingle();
  if (error) return null;
  return typeof data?.id === "string" ? data.id : null;
}

async function mirrorMeetingToAiWorkforce(
  db: Db,
  meeting: ExecutiveMeeting,
  outputId: string | null,
  actorUserId: string | null,
  reports: Array<Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">>,
  agentTaskIds: string[],
) {
  const publicTaskId = `EXEC-${meeting.id}`;
  const verificationScope = buildCeoVerificationScope(reports, agentTaskIds);
  const revenueCriticalCount = verificationScope.filter((item) => item.revenueCritical).length;
  const approvalRequiredCount = verificationScope.filter((item) => item.approvalRequired).length;
  const blockerCount = verificationScope.reduce((sum, item) => sum + item.blockerCount, 0);
  const { data, error } = await db
    .from("ai_workforce_tasks")
    .upsert(
      {
        task_id: publicTaskId,
        workflow_name: "CEO Executive Verification",
        requestor: "Executive Meeting System",
        assigned_agent: "CEO Agent",
        priority: blockerCount > 0 || revenueCriticalCount > 0 || approvalRequiredCount > 0 ? "high" : "medium",
        status: "awaiting_approval",
        input_path: `/admin/executive-chat?meetingId=${meeting.id}`,
        input_data: {
          source: "executive_meetings",
          meetingId: meeting.id,
          meetingType: meeting.meetingType,
          ceoVerificationRequired: true,
          agentTaskIds,
          agentVerificationScope: verificationScope,
          revenueAlignment: {
            revenueCriticalAgentCount: revenueCriticalCount,
            estimatedRevenueAwaitingApproval: meeting.revenueImpactJson.estimatedRevenue,
            estimatedSavingsAwaitingApproval: meeting.revenueImpactJson.estimatedSavings,
            mandate: "Verify every agent is moving work toward revenue, savings, risk reduction, customer momentum, or operational throughput.",
          },
          continuousImprovement: {
            required: true,
            cadence: "daily",
            mandate: "Each agent must surface one measurable improvement, simplification, or blocker-removal action tied to its role.",
          },
          approvalBoundary: "CEO verifies, prioritizes, and escalates only. No external execution is authorized.",
          externalActionAuthorized: false,
        },
        expected_output:
          "CEO verification completed across all agent work packages: confirm owner, status, revenue/savings/risk impact, continuous-improvement item, blocker, approval need, and next action. Escalate any agent not driving revenue or operational leverage. No external action is authorized.",
        dependencies: [
          "AGENTS.md approval gates",
          "AI Assets Command Center",
          "AI Workforce activity ledger",
          "Per-agent daily autonomy tasks",
          "Revenue and approval queues",
        ],
        approval_required: true,
        related_campaign: "Executive autonomy governance",
        related_opportunity: "CEO daily verification",
        output_id: outputId,
        owner_user_id: actorUserId,
      },
      { onConflict: "task_id" },
    )
    .select("id")
    .maybeSingle();

  if (!error && data?.id) {
    await db.from("ai_workforce_activity_logs").insert({
      task_id: data.id,
      task_public_id: publicTaskId,
      agent_name: "CEO Agent",
      event_type: "ceo_executive_verification_assigned",
      status: "awaiting_review",
      summary: `CEO verification assigned for ${verificationScope.length} executive agent work package(s) from ${meeting.title}.`,
      details: {
        source: "executive_meetings",
        meetingId: meeting.id,
        meetingType: meeting.meetingType,
        agentTaskIds,
        verificationScope,
        revenueCriticalAgentCount: revenueCriticalCount,
        approvalRequiredCount,
        blockerCount,
        approvalBoundary: "CEO verification only. No external action authorized.",
        externalActionAuthorized: false,
      },
      approval_status: "needs_review",
      related_output_id: outputId,
      created_by: actorUserId,
    });
    return String(data.id);
  }

  return null;
}

async function mirrorAgentReportsToAiWorkforce(
  db: Db,
  meeting: ExecutiveMeeting,
  reports: Array<Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">>,
  outputId: string | null,
  actorUserId: string | null,
) {
  if (reports.length === 0) return [];

  const dueDate = nextDayIso(meeting.generatedAt);
  const updatedAt = new Date().toISOString();
  const rows = reports.map((report) => {
    const needsApproval = agentTaskNeedsApproval(report);
    const primaryWork = primaryAgentWork(report);
    return {
      task_id: `EXEC-AGENT-${meeting.meetingDate}-${meeting.meetingType}-${safeTaskKey(report.agentKey)}`,
      workflow_name: "Executive Daily Agent Autonomy",
      requestor: "Executive Meeting System",
      assigned_agent: report.agentName || report.role,
      priority: agentTaskPriority(report),
      status: needsApproval ? "awaiting_approval" : "assigned",
      input_path: `/admin/executive-chat?meetingId=${meeting.id}`,
      input_data: {
        source: "executive_meetings",
        meetingId: meeting.id,
        meetingType: meeting.meetingType,
        agentKey: report.agentKey,
        role: report.role,
        summary: report.summary,
        primaryWork,
        plannedWork: report.plannedWorkJson,
        priorities: report.prioritiesJson,
        blockers: report.blockersJson,
        decisionsNeeded: report.decisionsNeededJson,
        kpis: report.kpiSnapshotJson,
        continuousImprovementRequirement:
          "Identify one measurable improvement, simplification, blocker-removal action, or revenue acceleration action for this role before the next executive review.",
        autonomousScope: [
          "analyze internal data",
          "draft recommendations",
          "prepare approval-gated outputs",
          "log findings",
          "surface blockers",
        ],
        approvalBoundary:
          "Autonomous work may prepare, score, summarize, draft, and log. It may not send, publish, submit, charge, change pricing, change live campaigns, place orders, or alter customer commitments.",
        externalActionAuthorized: false,
      },
      expected_output: expectedAgentTaskOutput(report, primaryWork),
      dependencies: [
        "AGENTS.md approval gates",
        "Executive daily meeting report",
        "AI Assets Command Center",
        "AI Workforce activity ledger",
      ],
      due_date: dueDate,
      approval_required: needsApproval,
      completion_notes: null,
      error_notes: null,
      related_campaign: primaryWork?.domain ?? meeting.meetingType,
      related_client: null,
      related_opportunity: report.role,
      output_id: outputId,
      owner_user_id: actorUserId,
      updated_at: updatedAt,
    };
  });

  const { data, error } = await db
    .from("ai_workforce_tasks")
    .upsert(rows, { onConflict: "task_id" })
    .select("id,task_id,assigned_agent,status");

  if (error) {
    await logPlatformAuditEvent({
      actorType: "system",
      actorId: actorUserId,
      module: "executive_meetings",
      actionType: "executive_agent_daily_tasks_failed",
      entityType: "executive_meeting",
      entityId: meeting.id,
      resultStatus: "failure",
      approvalState: "needs_review",
      severity: "high",
      message: "Executive meeting generated, but daily agent task materialization failed.",
      errorMessage: error.message,
      metadata: {
        meetingId: meeting.id,
        meetingType: meeting.meetingType,
        externalActionAuthorized: false,
      },
    });
    return [];
  }

  const taskRows = ((data ?? []) as GenericRow[]).filter((row) => typeof row.id === "string");
  if (taskRows.length > 0) {
    const logRows = taskRows.map((row) => ({
      task_id: String(row.id),
      task_public_id: String(row.task_id ?? ""),
      agent_name: String(row.assigned_agent ?? "Executive Agent"),
      event_type: "executive_agent_daily_task_assigned",
      status: String(row.status ?? "assigned"),
      summary: `${String(row.assigned_agent ?? "Executive Agent")} received a daily autonomous work package for ${meeting.title}.`,
      details: {
        source: "executive_meetings",
        meetingId: meeting.id,
        meetingType: meeting.meetingType,
        autonomousScope: "review-gated internal execution",
        externalActionAuthorized: false,
      },
      approval_status: String(row.status) === "awaiting_approval" ? "needs_review" : "not_required",
      related_output_id: outputId,
      created_by: actorUserId,
    }));
    const { error: logError } = await db.from("ai_workforce_activity_logs").insert(logRows);
    if (logError) {
      await logPlatformAuditEvent({
        actorType: "system",
        actorId: actorUserId,
        module: "executive_meetings",
        actionType: "executive_agent_daily_task_log_failed",
        entityType: "executive_meeting",
        entityId: meeting.id,
        resultStatus: "failure",
        approvalState: "needs_review",
        severity: "medium",
        message: "Executive agent tasks were created, but activity log insertion failed.",
        errorMessage: logError.message,
        metadata: {
          meetingId: meeting.id,
          meetingType: meeting.meetingType,
          taskCount: taskRows.length,
          externalActionAuthorized: false,
        },
      });
    }
  }

  return taskRows.map((row) => String(row.id));
}

function buildMeetingMarkdown(
  meeting: ExecutiveMeeting,
  aggregate: ReturnType<typeof buildMeetingAggregate>,
  reports: Array<Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">>,
) {
  const lines = [
    `# ${meeting.title}`,
    "",
    aggregate.ceoSummary,
    "",
    "## Decisions Needed",
    ...(aggregate.decisions.length ? aggregate.decisions.map((item) => `- ${item.title}: ${item.detail}`) : ["- No owner decision is currently required."]),
    "",
    "## Blockers",
    ...(aggregate.blockers.length ? aggregate.blockers.map((item) => `- ${item.title}: ${item.detail}`) : ["- No blocker surfaced in this run."]),
    "",
    "## Revenue / Savings Impact",
    `- Revenue awaiting approval: ${money(aggregate.revenueImpact.estimatedRevenue)}`,
    `- Savings awaiting approval: ${money(aggregate.revenueImpact.estimatedSavings)}`,
    "",
    "## Agent Reports",
    ...(reports.length
      ? reports.flatMap((report) => [
          `### ${report.role} - ${report.agentName}`,
          report.summary,
          ...report.prioritiesJson.slice(0, 3).map((item) => `- Priority: ${item.title} - ${item.detail}`),
          "",
        ])
      : ["- Agent reports are stored separately for this meeting."]),
    "",
    "Approval boundary: this report does not authorize sends, posts, payments, bids, production edits, client campaign changes, data deletion, or external execution.",
  ];
  return lines.join("\n");
}

async function auditAgentActivations(
  result: "success" | "failure",
  input: { meetingType: ExecutiveMeetingType; actorUserId?: string | null; actorType?: "human" | "cron" | "system" },
  meeting: ExecutiveMeeting,
  voiceReady: Record<string, unknown>,
  error: string | null,
) {
  const roster = Array.isArray(voiceReady.activeAgentRoster)
    ? voiceReady.activeAgentRoster.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    : [];
  const actionableRoster = roster.filter((item) => item.status !== "skipped_disabled");
  await Promise.all(actionableRoster.map((item) => {
    const status = typeof item.status === "string" ? item.status : "failed";
    const success = result === "success" && status === "joined";
    const agentKey = typeof item.agentKey === "string" ? item.agentKey : "unknown_agent";
    const role = typeof item.role === "string" ? item.role : "Executive Agent";
    return logPlatformAuditEvent({
      actorType: "ai",
      actorId: null,
      actorLabel: role,
      module: "executive_meetings",
      actionType: success ? "executive_agent_joined_call" : "executive_agent_join_failed",
      entityType: "executive_meeting",
      entityId: meeting.id,
      sourceTable: "executive_agents",
      sourceId: typeof item.agentId === "string" ? item.agentId : null,
      resultStatus: success ? "success" : "failure",
      approvalState: "needs_review",
      severity: success ? "info" : "high",
      message: success
        ? `${role} joined the ${input.meetingType} executive call.`
        : `${role} did not complete the ${input.meetingType} executive call activation.`,
      errorMessage: success ? null : error ?? stringOrNull(item.blockedReason),
      metadata: {
        meetingId: meeting.id,
        meetingType: input.meetingType,
        generatedByType: input.actorType ?? "human",
        triggeringActorId: input.actorUserId ?? null,
        agentKey,
        activationStatus: status,
        reportCreated: item.reportCreated === true,
        confidenceScore: typeof item.confidenceScore === "number" ? item.confidenceScore : null,
        externalActionAuthorized: false,
      },
    });
  }));
}

async function auditMeeting(
  result: "success" | "failure",
  input: { meetingType: ExecutiveMeetingType; actorUserId?: string | null; actorType?: "human" | "cron" | "system" },
  meetingId: string | null,
  error: string | null,
) {
  await logPlatformAuditEvent({
    actorType: input.actorType ?? "human",
    actorId: input.actorUserId ?? null,
    module: "executive_meetings",
    actionType: "executive_meeting_generated",
    entityType: "executive_meeting",
    entityId: meetingId,
    resultStatus: result,
    approvalState: "needs_review",
    severity: result === "success" ? "info" : "high",
    message: result === "success" ? `${input.meetingType} executive meeting generated.` : `${input.meetingType} executive meeting generation failed.`,
    errorMessage: error,
    metadata: {
      meetingType: input.meetingType,
      agentActivationRequired: true,
      externalActionAuthorized: false,
    },
  });
}

function withDailyAgentTaskTelemetry<T extends Record<string, unknown>>(
  voiceReady: T,
  agentTaskIds: string[],
  ceoVerificationTaskId: string | null,
  reports: Array<Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">>,
) {
  const verificationScope = buildCeoVerificationScope(reports, agentTaskIds);
  return {
    ...voiceReady,
    dailyAgentTaskCount: agentTaskIds.length,
    dailyAgentTaskIds: agentTaskIds.slice(0, 100),
    ceoVerificationRequired: true,
    ceoVerificationTaskId,
    ceoVerificationScopeCount: verificationScope.length,
    revenueCriticalAgentCount: verificationScope.filter((item) => item.revenueCritical).length,
    continuousImprovementRequired: true,
    agentAutonomyMode: "review_gated_daily_execution",
    externalActionAuthorized: false,
  };
}

function buildCeoVerificationScope(
  reports: Array<Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">>,
  agentTaskIds: string[],
) {
  return reports.map((report, index) => {
    const primaryWork = primaryAgentWork(report);
    const blockerCount = report.blockersJson.length;
    const decisionCount = report.decisionsNeededJson.length;
    const estimatedRevenue = report.revenueImpactJson.estimatedRevenue;
    const estimatedSavings = report.revenueImpactJson.estimatedSavings;
    const revenueCritical =
      estimatedRevenue > 0 ||
      estimatedSavings > 0 ||
      report.agentKey === "cro" ||
      report.agentKey === "ceo" ||
      report.prioritiesJson.some((item) => /revenue|sales|pipeline|approval|follow-up|customer|proposal|quote|savings/i.test(`${item.title} ${item.detail}`));

    return {
      agentKey: report.agentKey,
      agentName: report.agentName,
      role: report.role,
      taskId: agentTaskIds[index] ?? null,
      primaryWorkTitle: primaryWork?.title ?? "Review assigned executive lane",
      primaryWorkDetail: primaryWork?.detail ?? report.summary,
      statusToVerify: agentTaskNeedsApproval(report) ? "awaiting_approval" : "assigned",
      approvalRequired: agentTaskNeedsApproval(report),
      blockerCount,
      decisionCount,
      estimatedRevenue,
      estimatedSavings,
      revenueCritical,
      continuousImprovementRequired: true,
      ceoVerificationQuestions: [
        "Is this agent working on the highest-value task for its role?",
        "Is the work connected to revenue, savings, retention, risk reduction, or operational throughput?",
        "Is there a blocker, missing source, or approval dependency the owner must clear?",
        "What improvement should this agent make before the next executive review?",
      ],
    };
  });
}

function agentTaskNeedsApproval(
  report: Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">,
) {
  return (
    report.approvalRequired ||
    report.decisionsNeededJson.some((decisionItem) => decisionItem.approvalRequired) ||
    report.blockersJson.some((blocker) => blocker.needsHuman === true) ||
    report.risksJson.some((risk) => risk.severity === "critical" || risk.severity === "high")
  );
}

function agentTaskPriority(
  report: Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">,
) {
  if (report.blockersJson.some((blocker) => blocker.severity === "critical")) return "critical";
  if (report.decisionsNeededJson.some((decisionItem) => decisionItem.riskLevel === "critical")) return "critical";
  if (report.blockersJson.some((blocker) => blocker.severity === "high")) return "high";
  if (report.decisionsNeededJson.some((decisionItem) => decisionItem.riskLevel === "high")) return "high";
  if (report.prioritiesJson.some((priorityItem) => priorityItem.priority === "urgent" || priorityItem.priority === "high")) return "high";
  return "medium";
}

function primaryAgentWork(
  report: Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">,
) {
  const planned = report.plannedWorkJson[0];
  if (planned) return planned;
  const priorityItem = report.prioritiesJson[0];
  if (!priorityItem) return null;
  return {
    title: priorityItem.title,
    detail: priorityItem.detail,
    domain: priorityItem.domain,
    expectedOutcome: "Agent prepares a review-ready recommendation and logs blockers.",
  };
}

function expectedAgentTaskOutput(
  report: Omit<ExecutiveAgentReport, "id" | "meetingId" | "createdAt" | "updatedAt">,
  primaryWork: ExecutiveWorkItem | null,
) {
  const base = primaryWork
    ? `${primaryWork.title}: ${primaryWork.detail}`
    : `${report.role} reviews its assigned lane and logs the next recommended action.`;
  return `${base} Output must include status, evidence used, blockers, approval need, revenue or operational impact, one continuous-improvement action, and next action. No external action is authorized.`;
}

function safeTaskKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent";
}

function nextDayIso(value: string) {
  const baseMs = Date.parse(value);
  const base = Number.isFinite(baseMs) ? new Date(baseMs) : new Date();
  base.setUTCDate(base.getUTCDate() + 1);
  return base.toISOString();
}

function priority(title: string, detail: string, domain: string, priorityValue: ExecutivePriority["priority"]): ExecutivePriority {
  return { title: decodeHtml(title), detail, domain, priority: priorityValue };
}

function decision(title: string, detail: string, agentKey: string, riskLevel: ExecutiveDecision["riskLevel"], businessReason: string): ExecutiveDecision {
  return {
    title,
    detail,
    agentKey,
    riskLevel,
    businessReason,
    approvalRequired: true,
  };
}

function kpi(key: string, label: string, value: string | number, trend: ExecutiveKpiSnapshot["trend"]): ExecutiveKpiSnapshot {
  return { key, label, value, trend };
}

function nextDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function minuteOfDay(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function isDueMinute(currentMinute: number, scheduledMinute: number) {
  return currentMinute >= scheduledMinute && currentMinute < scheduledMinute + 30;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function executiveTitle(role: string) {
  return role.replace(/\s+Agent$/i, "").trim() || "Executive Leader";
}

function voiceKeyForAgent(agentKey: string) {
  const voiceByAgent: Record<string, string> = {
    ceo: "openai_voice_marin",
    cto: "openai_voice_cedar",
    cmo: "openai_voice_coral",
    cro: "openai_voice_verse",
    cfo: "openai_voice_sage",
    operations: "openai_voice_ash",
    chief_outreach_officer: "openai_voice_ballad",
    continuous_improvement: "openai_voice_echo",
    qa_risk: "openai_voice_onyx",
    customer_success: "openai_voice_shimmer",
  };
  return voiceByAgent[agentKey] ?? "openai_voice_marin";
}

function isMissingRelationError(message: string) {
  return /does not exist|schema cache|relation .* not found/i.test(message);
}

function decodeHtml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Executive meeting generation failed.";
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
