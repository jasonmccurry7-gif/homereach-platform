import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { loadExecutiveSourceSnapshot } from "./data-adapters";
import {
  emptyExecutiveSourceSnapshot,
  seedExecutiveAgents,
  seedExecutiveSettings,
  seedVoiceProfiles,
} from "./seed";
import type {
  ExecutiveActionApproval,
  ExecutiveAgent,
  ExecutiveAgentCommitment,
  ExecutiveAgentKpi,
  ExecutiveAgentReport,
  ExecutiveApprovalStatus,
  ExecutiveChatData,
  ExecutiveChatSummary,
  ExecutiveCommitmentStatus,
  ExecutiveMeeting,
  ExecutiveMeetingReport,
  ExecutiveMeetingSettings,
  ExecutiveMeetingStatus,
  ExecutiveMeetingType,
  ExecutiveMeetingOutcome,
  ExecutiveMeetingParticipant,
  ExecutiveMeetingParticipantType,
  ExecutiveMeetingTranscriptEntry,
  ExecutivePermissionLevel,
  ExecutiveRiskLevel,
  ExecutiveSourceSnapshot,
  ExecutiveVoiceProfile,
} from "./types";

type Db = ReturnType<typeof createServiceClient>;
type GenericRow = Record<string, unknown>;

export const EXECUTIVE_MEETINGS_MIGRATION_HINT =
  "Apply the Executive Daily Meetings and Executive Boardroom migrations to persist meetings, prompts, accountability, approvals, transcript, participants, and outcomes.";

export async function loadExecutiveChatData(): Promise<ExecutiveChatData> {
  const generatedAt = new Date().toISOString();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fallbackData({
      generatedAt,
      warnings: ["Supabase service credentials are unavailable. Showing seed executive agents only."],
      sourceSnapshot: emptyExecutiveSourceSnapshot,
    });
  }

  const db = createServiceClient();
  const sourceSnapshot = await loadExecutiveSourceSnapshot(db);

  const [agentsResult, settingsResult, voiceResult, meetingsResult, meetingReportsResult, agentReportsResult, commitmentsResult, kpisResult, approvalsResult, participantsResult, transcriptResult, outcomesResult] =
    await Promise.all([
      safeList(db, "executive_agents", "display_order", 100, true),
      safeList(db, "executive_meeting_settings", "updated_at", 1),
      safeList(db, "executive_voice_profiles", "updated_at", 50),
      safeList(db, "executive_meetings", "generated_at", 24),
      safeList(db, "executive_meeting_reports", "created_at", 50),
      safeList(db, "executive_agent_reports", "created_at", 240),
      safeList(db, "executive_agent_commitments", "commitment_date", 200),
      safeList(db, "executive_agent_kpis", "kpi_date", 300),
      safeList(db, "executive_action_approvals", "created_at", 100),
      optionalList(db, "executive_meeting_participants", "seat_index", 500, true),
      optionalList(db, "executive_meeting_transcript_entries", "sequence", 1000, true),
      optionalList(db, "executive_meeting_outcomes", "created_at", 500),
    ]);

  const schemaErrors = [
    agentsResult.error,
    settingsResult.error,
    voiceResult.error,
    meetingsResult.error,
    meetingReportsResult.error,
    agentReportsResult.error,
    commitmentsResult.error,
    kpisResult.error,
    approvalsResult.error,
  ].filter(Boolean);

  if (schemaErrors.length > 0) {
    return fallbackData({
      generatedAt,
      warnings: [
        ...schemaErrors.map((error) => String(error)),
        "Executive meeting system fell back to seed data after a live schema load failure.",
        ...sourceSnapshot.warnings,
      ],
      sourceSnapshot,
    });
  }

  const agents = (agentsResult.data ?? []).map(mapExecutiveAgentRow).sort((a, b) => a.displayOrder - b.displayOrder);
  const settings = (settingsResult.data ?? []).map(mapExecutiveSettingsRow)[0] ?? seedExecutiveSettings;
  const voiceProfiles = (voiceResult.data ?? []).map(mapExecutiveVoiceProfileRow);
  const meetings = (meetingsResult.data ?? []).map(mapExecutiveMeetingRow).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  const meetingReports = (meetingReportsResult.data ?? []).map(mapExecutiveMeetingReportRow);
  const agentReports = (agentReportsResult.data ?? []).map(mapExecutiveAgentReportRow);
  const commitments = (commitmentsResult.data ?? []).map(mapExecutiveCommitmentRow);
  const kpis = (kpisResult.data ?? []).map(mapExecutiveKpiRow);
  const approvals = (approvalsResult.data ?? []).map(mapExecutiveApprovalRow);
  const participants = (participantsResult.data ?? []).map(mapExecutiveMeetingParticipantRow);
  const transcriptEntries = (transcriptResult.data ?? []).map(mapExecutiveMeetingTranscriptEntryRow);
  const outcomes = (outcomesResult.data ?? []).map(mapExecutiveMeetingOutcomeRow);

  return buildData({
    generatedAt,
    schemaReady: true,
    warnings: sourceSnapshot.warnings,
    settings,
    agents,
    voiceProfiles,
    meetings,
    meetingReports,
    agentReports,
    commitments,
    kpis,
    approvals,
    participants,
    transcriptEntries,
    outcomes,
    sourceSnapshot,
  });
}

export async function fetchExecutiveAgents(db: Db): Promise<{
  agents: ExecutiveAgent[];
  schemaReady: boolean;
  warnings: string[];
}> {
  const result = await safeList(db, "executive_agents", "display_order", 100, true);
  if (result.error || !result.data?.length) {
    return {
      schemaReady: false,
      warnings: result.error ? [String(result.error)] : ["Executive agent table is empty; using seed agents."],
      agents: seedExecutiveAgents,
    };
  }

  return {
    schemaReady: true,
    warnings: [],
    agents: result.data.map(mapExecutiveAgentRow).sort((a, b) => a.displayOrder - b.displayOrder),
  };
}

export async function fetchLatestCommitments(db: Db, limit = 100): Promise<ExecutiveAgentCommitment[]> {
  const result = await safeList(db, "executive_agent_commitments", "commitment_date", limit);
  return (result.data ?? []).map(mapExecutiveCommitmentRow);
}

export async function fetchExecutiveSettings(db: Db): Promise<ExecutiveMeetingSettings> {
  const result = await safeList(db, "executive_meeting_settings", "updated_at", 1);
  return (result.data ?? []).map(mapExecutiveSettingsRow)[0] ?? seedExecutiveSettings;
}

function fallbackData(input: {
  generatedAt: string;
  warnings: string[];
  sourceSnapshot: ExecutiveSourceSnapshot;
}): ExecutiveChatData {
  return buildData({
    generatedAt: input.generatedAt,
    schemaReady: false,
    warnings: input.warnings,
    settings: seedExecutiveSettings,
    agents: seedExecutiveAgents,
    voiceProfiles: seedVoiceProfiles,
    meetings: [],
    meetingReports: [],
    agentReports: [],
    commitments: [],
    kpis: [],
    approvals: [],
    participants: [],
    transcriptEntries: [],
    outcomes: [],
    sourceSnapshot: input.sourceSnapshot,
  });
}

function buildData(input: {
  generatedAt: string;
  schemaReady: boolean;
  warnings: string[];
  settings: ExecutiveMeetingSettings;
  agents: ExecutiveAgent[];
  voiceProfiles: ExecutiveVoiceProfile[];
  meetings: ExecutiveMeeting[];
  meetingReports: ExecutiveMeetingReport[];
  agentReports: ExecutiveAgentReport[];
  commitments: ExecutiveAgentCommitment[];
  kpis: ExecutiveAgentKpi[];
  approvals: ExecutiveActionApproval[];
  participants: ExecutiveMeetingParticipant[];
  transcriptEntries: ExecutiveMeetingTranscriptEntry[];
  outcomes: ExecutiveMeetingOutcome[];
  sourceSnapshot: ExecutiveSourceSnapshot;
}): ExecutiveChatData {
  const latestMorning = latestByType(input.meetings, "morning");
  const latestAfternoon = latestByType(input.meetings, "afternoon");
  const selectedMeeting = input.meetings[0] ?? null;
  const summary = buildSummary({
    agents: input.agents,
    meetings: input.meetings,
    commitments: input.commitments,
    approvals: input.approvals,
    sourceSnapshot: input.sourceSnapshot,
    selectedMeeting,
  });

  return {
    schemaReady: input.schemaReady,
    migrationHint: input.schemaReady ? null : EXECUTIVE_MEETINGS_MIGRATION_HINT,
    warnings: input.warnings,
    generatedAt: input.generatedAt,
    settings: input.settings,
    agents: input.agents,
    voiceProfiles: input.voiceProfiles,
    meetings: input.meetings,
    meetingReports: input.meetingReports,
    agentReports: input.agentReports,
    commitments: input.commitments,
    kpis: input.kpis,
    approvals: input.approvals,
    participants: input.participants,
    transcriptEntries: input.transcriptEntries,
    outcomes: input.outcomes,
    latestMorning,
    latestAfternoon,
    selectedMeeting,
    sourceSnapshot: input.sourceSnapshot,
    summary,
  };
}

function buildSummary(input: {
  agents: ExecutiveAgent[];
  meetings: ExecutiveMeeting[];
  commitments: ExecutiveAgentCommitment[];
  approvals: ExecutiveActionApproval[];
  sourceSnapshot: ExecutiveSourceSnapshot;
  selectedMeeting: ExecutiveMeeting | null;
}): ExecutiveChatSummary {
  const enabledAgents = input.agents.filter((agent) => agent.enabled && !agent.archivedAt).length;
  const latestMorning = latestByType(input.meetings, "morning");
  const latestAfternoon = latestByType(input.meetings, "afternoon");
  const selected = input.selectedMeeting;

  return {
    enabledAgents,
    disabledAgents: input.agents.length - enabledAgents,
    latestMorningAt: latestMorning?.generatedAt ?? null,
    latestAfternoonAt: latestAfternoon?.generatedAt ?? null,
    pendingApprovals: input.approvals.filter((approval) => approval.approvalStatus === "pending").length,
    decisionsNeeded: selected?.decisionsNeededJson.length ?? input.approvals.filter((approval) => approval.approvalStatus === "pending").length,
    blockers: selected?.blockersJson.length ?? input.commitments.filter((commitment) => commitment.status === "blocked").length,
    missedCommitments: input.commitments.filter((commitment) => commitment.status === "missed").length,
    completedCommitments: input.commitments.filter((commitment) => commitment.status === "completed").length,
    estimatedRevenue: input.sourceSnapshot.totals.estimatedRevenueAwaitingApproval,
    estimatedSavings: input.sourceSnapshot.totals.estimatedSavingsAwaitingApproval,
    adaptersOnline: input.sourceSnapshot.adapters.filter((adapter) => adapter.status === "online").length,
    sourceWarnings: input.sourceSnapshot.warnings.length,
  };
}

async function safeList(
  db: Db,
  table: string,
  orderColumn: string,
  limit: number,
  ascending = false,
): Promise<{ data: GenericRow[] | null; error: string | null }> {
  try {
    const { data, error } = await db
      .from(table)
      .select("*")
      .order(orderColumn, { ascending })
      .limit(limit);
    return {
      data: (data ?? null) as GenericRow[] | null,
      error: error ? error.message : null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Live query failed.",
    };
  }
}

async function optionalList(
  db: Db,
  table: string,
  orderColumn: string,
  limit: number,
  ascending = false,
): Promise<{ data: GenericRow[] | null; error: string | null }> {
  const result = await safeList(db, table, orderColumn, limit, ascending);
  if (result.error && /does not exist|schema cache|relation .* not found/i.test(result.error)) {
    return { data: [], error: null };
  }
  return result;
}

export function mapExecutiveVoiceProfileRow(row: GenericRow): ExecutiveVoiceProfile {
  return {
    id: stringValue(row.id),
    profileKey: stringValue(row.profile_key),
    providerKey: stringValue(row.provider_key, "openai_realtime"),
    displayName: stringValue(row.display_name, "Realtime executive voice"),
    voiceLabel: stringValue(row.voice_label, "Realtime executive voice"),
    speakingStyle: stringValue(row.speaking_style),
    ttsSettingsJson: asRecord(row.tts_settings_json),
    liveModeSettingsJson: asRecord(row.live_mode_settings_json),
    enabled: Boolean(row.enabled),
    notes: nullableString(row.notes),
    createdAt: stringValue(row.created_at, new Date().toISOString()),
    updatedAt: stringValue(row.updated_at, new Date().toISOString()),
  };
}

export function mapExecutiveAgentRow(row: GenericRow): ExecutiveAgent {
  return {
    id: stringValue(row.id),
    agentKey: stringValue(row.agent_key),
    name: stringValue(row.name, "Executive Agent"),
    role: stringValue(row.role, "Executive Agent"),
    mission: stringValue(row.mission),
    dailyResponsibilities: asStringArray(row.daily_responsibilities),
    kpiOwnership: asStringArray(row.kpi_ownership),
    morningReportFormat: asRecord(row.morning_report_format),
    afternoonReportFormat: asRecord(row.afternoon_report_format),
    permissionsLevel: asPermission(row.permissions_level),
    assignedDomains: asStringArray(row.assigned_domains),
    enabled: row.enabled !== false,
    voiceProfileId: nullableString(row.voice_profile_id),
    systemPrompt: stringValue(row.system_prompt),
    displayOrder: numberValue(row.display_order, 100),
    metadataJson: asRecord(row.metadata_json),
    createdAt: stringValue(row.created_at, new Date().toISOString()),
    updatedAt: stringValue(row.updated_at, new Date().toISOString()),
    archivedAt: nullableString(row.archived_at),
  };
}

export function mapExecutiveSettingsRow(row: GenericRow): ExecutiveMeetingSettings {
  return {
    id: stringValue(row.id),
    settingsKey: stringValue(row.settings_key, "default"),
    timezone: stringValue(row.timezone, "America/New_York"),
    morningTime: stringValue(row.morning_time, "08:00:00"),
    afternoonTime: stringValue(row.afternoon_time, "16:30:00"),
    autoGenerateEnabled: row.auto_generate_enabled !== false,
    notificationBadgeEnabled: row.notification_badge_enabled !== false,
    emailSummaryEnabled: Boolean(row.email_summary_enabled),
    smsSummaryEnabled: Boolean(row.sms_summary_enabled),
    voiceModeEnabled: Boolean(row.voice_mode_enabled),
    defaultDomains: asStringArray(row.default_domains),
    providerPlanJson: asRecord(row.provider_plan_json),
    createdAt: stringValue(row.created_at, new Date().toISOString()),
    updatedAt: stringValue(row.updated_at, new Date().toISOString()),
  };
}

export function mapExecutiveMeetingRow(row: GenericRow): ExecutiveMeeting {
  return {
    id: stringValue(row.id),
    meetingDate: stringValue(row.meeting_date),
    meetingType: asMeetingType(row.meeting_type),
    status: asMeetingStatus(row.status),
    title: stringValue(row.title, "Executive Meeting"),
    idempotencyKey: nullableString(row.idempotency_key),
    timezone: stringValue(row.timezone, "America/New_York"),
    generatedAt: stringValue(row.generated_at, new Date().toISOString()),
    generatedBy: nullableString(row.generated_by),
    generatedByType: asGeneratedByType(row.generated_by_type),
    ceoSummary: stringValue(row.ceo_summary),
    decisionsNeededJson: asRecordArray(row.decisions_needed_json),
    blockersJson: asRecordArray(row.blockers_json),
    revenueImpactJson: asRevenueImpact(row.revenue_impact_json),
    tomorrowPrioritiesJson: asRecordArray(row.tomorrow_priorities_json),
    sourceSnapshotJson: asRecord(row.source_snapshot_json),
    voiceReadyJson: asRecord(row.voice_ready_json),
    aiWorkforceTaskId: nullableString(row.ai_workforce_task_id),
    aiOutputId: nullableString(row.ai_output_id),
    endedAt: nullableString(row.ended_at),
    durationSeconds: row.duration_seconds === null || row.duration_seconds === undefined ? null : numberValue(row.duration_seconds),
    recordingUrl: nullableString(row.recording_url),
    createdAt: stringValue(row.created_at, new Date().toISOString()),
    updatedAt: stringValue(row.updated_at, new Date().toISOString()),
  };
}

export function mapExecutiveMeetingReportRow(row: GenericRow): ExecutiveMeetingReport {
  return {
    id: stringValue(row.id),
    meetingId: stringValue(row.meeting_id),
    reportType: stringValue(row.report_type, "ceo_summary"),
    title: stringValue(row.title, "Executive meeting report"),
    summary: stringValue(row.summary),
    decisionsNeededJson: asRecordArray(row.decisions_needed_json),
    blockersJson: asRecordArray(row.blockers_json),
    revenueImpactJson: asRevenueImpact(row.revenue_impact_json),
    tomorrowPrioritiesJson: asRecordArray(row.tomorrow_priorities_json),
    reportMarkdown: stringValue(row.report_markdown),
    sourceSnapshotJson: asRecord(row.source_snapshot_json),
    createdAt: stringValue(row.created_at, new Date().toISOString()),
  };
}

export function mapExecutiveAgentReportRow(row: GenericRow): ExecutiveAgentReport {
  return {
    id: stringValue(row.id),
    meetingId: stringValue(row.meeting_id),
    agentId: nullableString(row.agent_id),
    agentKey: stringValue(row.agent_key),
    agentName: stringValue(row.agent_name),
    role: stringValue(row.role),
    reportType: asMeetingType(row.report_type),
    summary: stringValue(row.summary),
    plannedWorkJson: asRecordArray(row.planned_work_json),
    completedWorkJson: asRecordArray(row.completed_work_json),
    prioritiesJson: asRecordArray(row.priorities_json),
    risksJson: asRecordArray(row.risks_json),
    blockersJson: asRecordArray(row.blockers_json),
    decisionsNeededJson: asRecordArray(row.decisions_needed_json),
    revenueImpactJson: asRevenueImpact(row.revenue_impact_json),
    kpiSnapshotJson: asRecordArray(row.kpi_snapshot_json),
    dataSourcesJson: asRecordArray(row.data_sources_json),
    confidenceScore: numberValue(row.confidence_score, 80),
    approvalRequired: row.approval_required !== false,
    createdAt: stringValue(row.created_at, new Date().toISOString()),
    updatedAt: stringValue(row.updated_at, new Date().toISOString()),
  };
}

export function mapExecutiveCommitmentRow(row: GenericRow): ExecutiveAgentCommitment {
  return {
    id: stringValue(row.id),
    agentId: nullableString(row.agent_id),
    meetingId: nullableString(row.meeting_id),
    commitmentDate: stringValue(row.commitment_date),
    commitmentText: stringValue(row.commitment_text),
    domain: stringValue(row.domain, "HomeReach"),
    status: asCommitmentStatus(row.status),
    evidenceJson: asRecord(row.evidence_json),
    revenueImpact: numberValue(row.revenue_impact),
    riskLevel: asRisk(row.risk_level),
    followUpDate: nullableString(row.follow_up_date),
    createdAt: stringValue(row.created_at, new Date().toISOString()),
    updatedAt: stringValue(row.updated_at, new Date().toISOString()),
  };
}

export function mapExecutiveKpiRow(row: GenericRow): ExecutiveAgentKpi {
  return {
    id: stringValue(row.id),
    agentId: nullableString(row.agent_id),
    kpiDate: stringValue(row.kpi_date),
    kpiKey: stringValue(row.kpi_key),
    kpiLabel: stringValue(row.kpi_label),
    valueNumeric: row.value_numeric === null || row.value_numeric === undefined ? null : numberValue(row.value_numeric),
    valueText: nullableString(row.value_text),
    trend: asTrend(row.trend),
    source: stringValue(row.source, "executive_meeting_snapshot"),
    metadataJson: asRecord(row.metadata_json),
    createdAt: stringValue(row.created_at, new Date().toISOString()),
  };
}

export function mapExecutiveApprovalRow(row: GenericRow): ExecutiveActionApproval {
  return {
    id: stringValue(row.id),
    meetingId: nullableString(row.meeting_id),
    agentId: nullableString(row.agent_id),
    pendingAction: stringValue(row.pending_action),
    businessReason: stringValue(row.business_reason),
    riskLevel: asRisk(row.risk_level),
    approvalStatus: asApprovalStatus(row.approval_status),
    editedAction: nullableString(row.edited_action),
    decisionReason: nullableString(row.decision_reason),
    decidedBy: nullableString(row.decided_by),
    decidedAt: nullableString(row.decided_at),
    auditPayloadJson: asRecord(row.audit_payload_json),
    createdAt: stringValue(row.created_at, new Date().toISOString()),
    updatedAt: stringValue(row.updated_at, new Date().toISOString()),
  };
}

export function mapExecutiveMeetingParticipantRow(row: GenericRow): ExecutiveMeetingParticipant {
  return {
    id: stringValue(row.id),
    meetingId: stringValue(row.meeting_id),
    participantType: asParticipantType(row.participant_type),
    agentId: nullableString(row.agent_id),
    participantKey: stringValue(row.participant_key),
    displayName: stringValue(row.display_name, "Executive Participant"),
    title: stringValue(row.title, "Executive Participant"),
    roleInMeeting: asRoleInMeeting(row.role_in_meeting),
    seatIndex: numberValue(row.seat_index, 100),
    attendanceStatus: asAttendanceStatus(row.attendance_status),
    voiceProfileKey: nullableString(row.voice_profile_key),
    currentAssignment: stringValue(row.current_assignment),
    performanceJson: asRecord(row.performance_json),
    joinedAt: nullableString(row.joined_at),
    leftAt: nullableString(row.left_at),
    createdAt: stringValue(row.created_at, new Date().toISOString()),
  };
}

export function mapExecutiveMeetingTranscriptEntryRow(row: GenericRow): ExecutiveMeetingTranscriptEntry {
  return {
    id: stringValue(row.id),
    meetingId: stringValue(row.meeting_id),
    participantId: nullableString(row.participant_id),
    speakerKey: stringValue(row.speaker_key),
    speakerName: stringValue(row.speaker_name, "Executive Participant"),
    speakerTitle: stringValue(row.speaker_title, "Executive Participant"),
    speakerType: asSpeakerType(row.speaker_type),
    sequence: numberValue(row.sequence),
    startedAt: stringValue(row.started_at, new Date().toISOString()),
    endedAt: nullableString(row.ended_at),
    statement: stringValue(row.statement),
    statementType: asStatementType(row.statement_type),
    source: asTranscriptSource(row.source),
    metadataJson: asRecord(row.metadata_json),
    createdAt: stringValue(row.created_at, new Date().toISOString()),
  };
}

export function mapExecutiveMeetingOutcomeRow(row: GenericRow): ExecutiveMeetingOutcome {
  return {
    id: stringValue(row.id),
    meetingId: stringValue(row.meeting_id),
    outcomeType: asOutcomeType(row.outcome_type),
    ownerAgentId: nullableString(row.owner_agent_id),
    ownerKey: nullableString(row.owner_key),
    ownerName: nullableString(row.owner_name),
    title: stringValue(row.title),
    detail: stringValue(row.detail),
    priority: asPriority(row.priority),
    dueAt: nullableString(row.due_at),
    status: asOutcomeStatus(row.status),
    sourceTranscriptEntryId: nullableString(row.source_transcript_entry_id),
    metadataJson: asRecord(row.metadata_json),
    createdAt: stringValue(row.created_at, new Date().toISOString()),
    updatedAt: stringValue(row.updated_at, new Date().toISOString()),
  };
}

function latestByType(meetings: ExecutiveMeeting[], type: ExecutiveMeetingType) {
  return meetings.filter((meeting) => meeting.meetingType === type).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0] ?? null;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asRecordArray(value: unknown): any[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as any[] : [];
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asMeetingType(value: unknown): ExecutiveMeetingType {
  if (value === "afternoon" || value === "strategic" || value === "emergency") return value;
  return "morning";
}

function asMeetingStatus(value: unknown): ExecutiveMeetingStatus {
  return value === "draft" || value === "archived" || value === "failed" ? value : "ready";
}

function asPermission(value: unknown): ExecutivePermissionLevel {
  if (
    value === "analysis_only" ||
    value === "recommend_only" ||
    value === "draft_only" ||
    value === "approval_required" ||
    value === "admin_review_required"
  ) {
    return value;
  }
  return "recommend_only";
}

function asRisk(value: unknown): ExecutiveRiskLevel {
  return value === "low" || value === "high" || value === "critical" ? value : "medium";
}

function asApprovalStatus(value: unknown): ExecutiveApprovalStatus {
  if (value === "approved" || value === "rejected" || value === "edited" || value === "archived") return value;
  return "pending";
}

function asCommitmentStatus(value: unknown): ExecutiveCommitmentStatus {
  if (value === "completed" || value === "missed" || value === "deferred" || value === "blocked") return value;
  return "planned";
}

function asTrend(value: unknown): "up" | "down" | "flat" | "unknown" {
  if (value === "up" || value === "down" || value === "flat") return value;
  return "unknown";
}

function asGeneratedByType(value: unknown): "human" | "cron" | "system" {
  if (value === "cron" || value === "system") return value;
  return "human";
}

function asParticipantType(value: unknown): ExecutiveMeetingParticipantType {
  if (value === "human_admin" || value === "facilitator" || value === "observer" || value === "external_future") {
    return value;
  }
  return "ai_executive";
}

function asRoleInMeeting(value: unknown): ExecutiveMeetingParticipant["roleInMeeting"] {
  if (value === "facilitator" || value === "silent_note_taker" || value === "guest") return value;
  return "voting_member";
}

function asAttendanceStatus(value: unknown): ExecutiveMeetingParticipant["attendanceStatus"] {
  if (value === "invited" || value === "speaking" || value === "listening" || value === "left" || value === "blocked") return value;
  return "joined";
}

function asSpeakerType(value: unknown): ExecutiveMeetingTranscriptEntry["speakerType"] {
  if (value === "human_admin" || value === "facilitator" || value === "observer" || value === "system") return value;
  return "ai_executive";
}

function asStatementType(value: unknown): ExecutiveMeetingTranscriptEntry["statementType"] {
  if (
    value === "opening" ||
    value === "user" ||
    value === "decision" ||
    value === "action_item" ||
    value === "risk" ||
    value === "commitment" ||
    value === "summary" ||
    value === "closing" ||
    value === "system"
  ) {
    return value;
  }
  return "agent_report";
}

function asTranscriptSource(value: unknown): ExecutiveMeetingTranscriptEntry["source"] {
  if (value === "live_voice" || value === "manual" || value === "system") return value;
  return "generated_report";
}

function asOutcomeType(value: unknown): ExecutiveMeetingOutcome["outcomeType"] {
  if (
    value === "action_item" ||
    value === "decision" ||
    value === "risk" ||
    value === "commitment" ||
    value === "scorecard_update" ||
    value === "opportunity"
  ) {
    return value;
  }
  return "executive_summary";
}

function asPriority(value: unknown): ExecutiveMeetingOutcome["priority"] {
  if (value === "low" || value === "high" || value === "urgent") return value;
  return "normal";
}

function asOutcomeStatus(value: unknown): ExecutiveMeetingOutcome["status"] {
  if (value === "in_progress" || value === "needs_approval" || value === "completed" || value === "blocked" || value === "archived") return value;
  return "open";
}

function asRevenueImpact(value: unknown) {
  const record = asRecord(value);
  return {
    estimatedRevenue: numberValue(record.estimatedRevenue ?? record.estimated_revenue),
    estimatedSavings: numberValue(record.estimatedSavings ?? record.estimated_savings),
    estimatedCostAvoided: numberValue(record.estimatedCostAvoided ?? record.estimated_cost_avoided),
    detail: stringValue(record.detail),
  };
}
