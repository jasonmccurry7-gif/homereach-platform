import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { aiOutputs } from "./aiAssets.js";
import { aiWorkforceTasks } from "./aiWorkforce.js";
import { profiles } from "./users.js";

export const executiveVoiceProfiles = pgTable(
  "executive_voice_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileKey: text("profile_key").notNull().unique(),
    providerKey: text("provider_key").notNull().default("openai_realtime"),
    displayName: text("display_name").notNull(),
    voiceLabel: text("voice_label").notNull().default("Realtime executive voice"),
    speakingStyle: text("speaking_style").notNull().default(""),
    ttsSettingsJson: jsonb("tts_settings_json").$type<Record<string, unknown>>().notNull().default({}),
    liveModeSettingsJson: jsonb("live_mode_settings_json").$type<Record<string, unknown>>().notNull().default({}),
    enabled: boolean("enabled").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const executiveAgents = pgTable(
  "executive_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentKey: text("agent_key").notNull().unique(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    mission: text("mission").notNull(),
    dailyResponsibilities: jsonb("daily_responsibilities").$type<string[]>().notNull().default([]),
    kpiOwnership: jsonb("kpi_ownership").$type<string[]>().notNull().default([]),
    morningReportFormat: jsonb("morning_report_format").$type<Record<string, unknown>>().notNull().default({}),
    afternoonReportFormat: jsonb("afternoon_report_format").$type<Record<string, unknown>>().notNull().default({}),
    permissionsLevel: text("permissions_level").notNull().default("recommend_only"),
    assignedDomains: text("assigned_domains").array().notNull().default([]),
    enabled: boolean("enabled").notNull().default(true),
    voiceProfileId: uuid("voice_profile_id").references(() => executiveVoiceProfiles.id, { onDelete: "set null" }),
    systemPrompt: text("system_prompt").notNull(),
    displayOrder: integer("display_order").notNull().default(100),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => ({
    enabledIdx: index("executive_agents_enabled_idx").on(t.enabled, t.displayOrder, t.role),
  }),
);

export const executiveMeetingSettings = pgTable(
  "executive_meeting_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    settingsKey: text("settings_key").notNull().unique().default("default"),
    timezone: text("timezone").notNull().default("America/New_York"),
    morningTime: time("morning_time").notNull().default("08:00"),
    afternoonTime: time("afternoon_time").notNull().default("16:30"),
    autoGenerateEnabled: boolean("auto_generate_enabled").notNull().default(true),
    notificationBadgeEnabled: boolean("notification_badge_enabled").notNull().default(true),
    emailSummaryEnabled: boolean("email_summary_enabled").notNull().default(false),
    smsSummaryEnabled: boolean("sms_summary_enabled").notNull().default(false),
    voiceModeEnabled: boolean("voice_mode_enabled").notNull().default(false),
    defaultDomains: text("default_domains").array().notNull().default([]),
    providerPlanJson: jsonb("provider_plan_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const executiveMeetings = pgTable(
  "executive_meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingDate: date("meeting_date").notNull(),
    meetingType: text("meeting_type").notNull(),
    status: text("status").notNull().default("ready"),
    title: text("title").notNull(),
    idempotencyKey: text("idempotency_key").unique(),
    timezone: text("timezone").notNull().default("America/New_York"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    generatedBy: uuid("generated_by").references(() => profiles.id, { onDelete: "set null" }),
    generatedByType: text("generated_by_type").notNull().default("human"),
    ceoSummary: text("ceo_summary").notNull().default(""),
    decisionsNeededJson: jsonb("decisions_needed_json").$type<Record<string, unknown>[]>().notNull().default([]),
    blockersJson: jsonb("blockers_json").$type<Record<string, unknown>[]>().notNull().default([]),
    revenueImpactJson: jsonb("revenue_impact_json").$type<Record<string, unknown>>().notNull().default({}),
    tomorrowPrioritiesJson: jsonb("tomorrow_priorities_json").$type<Record<string, unknown>[]>().notNull().default([]),
    sourceSnapshotJson: jsonb("source_snapshot_json").$type<Record<string, unknown>>().notNull().default({}),
    voiceReadyJson: jsonb("voice_ready_json").$type<Record<string, unknown>>().notNull().default({}),
    aiWorkforceTaskId: uuid("ai_workforce_task_id").references(() => aiWorkforceTasks.id, { onDelete: "set null" }),
    aiOutputId: uuid("ai_output_id").references(() => aiOutputs.id, { onDelete: "set null" }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    recordingUrl: text("recording_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    latestIdx: index("executive_meetings_latest_idx").on(t.meetingDate, t.meetingType, t.generatedAt),
    statusIdx: index("executive_meetings_status_idx").on(t.status, t.generatedAt),
  }),
);

export const executiveMeetingReports = pgTable(
  "executive_meeting_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id").notNull().references(() => executiveMeetings.id, { onDelete: "cascade" }),
    reportType: text("report_type").notNull().default("ceo_summary"),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    decisionsNeededJson: jsonb("decisions_needed_json").$type<Record<string, unknown>[]>().notNull().default([]),
    blockersJson: jsonb("blockers_json").$type<Record<string, unknown>[]>().notNull().default([]),
    revenueImpactJson: jsonb("revenue_impact_json").$type<Record<string, unknown>>().notNull().default({}),
    tomorrowPrioritiesJson: jsonb("tomorrow_priorities_json").$type<Record<string, unknown>[]>().notNull().default([]),
    reportMarkdown: text("report_markdown").notNull().default(""),
    sourceSnapshotJson: jsonb("source_snapshot_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    meetingIdx: index("executive_meeting_reports_meeting_idx").on(t.meetingId, t.createdAt),
  }),
);

export const executiveAgentReports = pgTable(
  "executive_agent_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id").notNull().references(() => executiveMeetings.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => executiveAgents.id, { onDelete: "set null" }),
    agentKey: text("agent_key").notNull(),
    agentName: text("agent_name").notNull(),
    role: text("role").notNull(),
    reportType: text("report_type").notNull(),
    summary: text("summary").notNull().default(""),
    plannedWorkJson: jsonb("planned_work_json").$type<Record<string, unknown>[]>().notNull().default([]),
    completedWorkJson: jsonb("completed_work_json").$type<Record<string, unknown>[]>().notNull().default([]),
    prioritiesJson: jsonb("priorities_json").$type<Record<string, unknown>[]>().notNull().default([]),
    risksJson: jsonb("risks_json").$type<Record<string, unknown>[]>().notNull().default([]),
    blockersJson: jsonb("blockers_json").$type<Record<string, unknown>[]>().notNull().default([]),
    decisionsNeededJson: jsonb("decisions_needed_json").$type<Record<string, unknown>[]>().notNull().default([]),
    revenueImpactJson: jsonb("revenue_impact_json").$type<Record<string, unknown>>().notNull().default({}),
    kpiSnapshotJson: jsonb("kpi_snapshot_json").$type<Record<string, unknown>[]>().notNull().default([]),
    dataSourcesJson: jsonb("data_sources_json").$type<Record<string, unknown>[]>().notNull().default([]),
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }).notNull().default("80"),
    approvalRequired: boolean("approval_required").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    meetingIdx: index("executive_agent_reports_meeting_idx").on(t.meetingId, t.agentKey),
    agentIdx: index("executive_agent_reports_agent_idx").on(t.agentKey, t.createdAt),
  }),
);

export const executiveAgentCommitments = pgTable(
  "executive_agent_commitments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").references(() => executiveAgents.id, { onDelete: "set null" }),
    meetingId: uuid("meeting_id").references(() => executiveMeetings.id, { onDelete: "set null" }),
    commitmentDate: date("commitment_date").notNull(),
    commitmentText: text("commitment_text").notNull(),
    domain: text("domain").notNull().default("HomeReach"),
    status: text("status").notNull().default("planned"),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
    revenueImpact: numeric("revenue_impact", { precision: 12, scale: 2 }).notNull().default("0"),
    riskLevel: text("risk_level").notNull().default("medium"),
    followUpDate: date("follow_up_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    accountabilityIdx: index("executive_agent_commitments_accountability_idx").on(t.commitmentDate, t.status, t.domain),
    agentIdx: index("executive_agent_commitments_agent_idx").on(t.agentId, t.commitmentDate),
  }),
);

export const executiveAgentKpis = pgTable(
  "executive_agent_kpis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").references(() => executiveAgents.id, { onDelete: "set null" }),
    kpiDate: date("kpi_date").notNull(),
    kpiKey: text("kpi_key").notNull(),
    kpiLabel: text("kpi_label").notNull(),
    valueNumeric: numeric("value_numeric", { precision: 14, scale: 2 }),
    valueText: text("value_text"),
    trend: text("trend").notNull().default("unknown"),
    source: text("source").notNull().default("executive_meeting_snapshot"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    agentIdx: index("executive_agent_kpis_agent_idx").on(t.agentId, t.kpiDate, t.kpiKey),
  }),
);

export const executiveActionApprovals = pgTable(
  "executive_action_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id").references(() => executiveMeetings.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => executiveAgents.id, { onDelete: "set null" }),
    pendingAction: text("pending_action").notNull(),
    businessReason: text("business_reason").notNull().default(""),
    riskLevel: text("risk_level").notNull().default("medium"),
    approvalStatus: text("approval_status").notNull().default("pending"),
    editedAction: text("edited_action"),
    decisionReason: text("decision_reason"),
    decidedBy: uuid("decided_by").references(() => profiles.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    auditPayloadJson: jsonb("audit_payload_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    queueIdx: index("executive_action_approvals_queue_idx").on(t.approvalStatus, t.riskLevel, t.createdAt),
    meetingIdx: index("executive_action_approvals_meeting_idx").on(t.meetingId, t.createdAt),
  }),
);

export const executiveMeetingParticipants = pgTable(
  "executive_meeting_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id").notNull().references(() => executiveMeetings.id, { onDelete: "cascade" }),
    participantType: text("participant_type").notNull().default("ai_executive"),
    agentId: uuid("agent_id").references(() => executiveAgents.id, { onDelete: "set null" }),
    participantKey: text("participant_key").notNull(),
    displayName: text("display_name").notNull(),
    title: text("title").notNull(),
    roleInMeeting: text("role_in_meeting").notNull().default("voting_member"),
    seatIndex: integer("seat_index").notNull().default(100),
    attendanceStatus: text("attendance_status").notNull().default("joined"),
    voiceProfileKey: text("voice_profile_key"),
    currentAssignment: text("current_assignment").notNull().default(""),
    performanceJson: jsonb("performance_json").$type<Record<string, unknown>>().notNull().default({}),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    leftAt: timestamp("left_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    meetingIdx: index("executive_meeting_participants_meeting_idx").on(t.meetingId, t.seatIndex),
  }),
);

export const executiveMeetingTranscriptEntries = pgTable(
  "executive_meeting_transcript_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id").notNull().references(() => executiveMeetings.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id").references(() => executiveMeetingParticipants.id, { onDelete: "set null" }),
    speakerKey: text("speaker_key").notNull(),
    speakerName: text("speaker_name").notNull(),
    speakerTitle: text("speaker_title").notNull(),
    speakerType: text("speaker_type").notNull().default("ai_executive"),
    sequence: integer("sequence").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    statement: text("statement").notNull(),
    statementType: text("statement_type").notNull().default("agent_report"),
    source: text("source").notNull().default("generated_report"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    meetingIdx: index("executive_meeting_transcript_entries_meeting_idx").on(t.meetingId, t.sequence),
  }),
);

export const executiveMeetingOutcomes = pgTable(
  "executive_meeting_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id").notNull().references(() => executiveMeetings.id, { onDelete: "cascade" }),
    outcomeType: text("outcome_type").notNull(),
    ownerAgentId: uuid("owner_agent_id").references(() => executiveAgents.id, { onDelete: "set null" }),
    ownerKey: text("owner_key"),
    ownerName: text("owner_name"),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    priority: text("priority").notNull().default("normal"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: text("status").notNull().default("open"),
    sourceTranscriptEntryId: uuid("source_transcript_entry_id").references(() => executiveMeetingTranscriptEntries.id, { onDelete: "set null" }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    meetingIdx: index("executive_meeting_outcomes_meeting_idx").on(t.meetingId, t.outcomeType, t.status),
    ownerIdx: index("executive_meeting_outcomes_owner_idx").on(t.ownerKey, t.status, t.dueAt),
  }),
);

export type ExecutiveVoiceProfile = typeof executiveVoiceProfiles.$inferSelect;
export type NewExecutiveVoiceProfile = typeof executiveVoiceProfiles.$inferInsert;
export type ExecutiveAgent = typeof executiveAgents.$inferSelect;
export type NewExecutiveAgent = typeof executiveAgents.$inferInsert;
export type ExecutiveMeetingSettings = typeof executiveMeetingSettings.$inferSelect;
export type NewExecutiveMeetingSettings = typeof executiveMeetingSettings.$inferInsert;
export type ExecutiveMeeting = typeof executiveMeetings.$inferSelect;
export type NewExecutiveMeeting = typeof executiveMeetings.$inferInsert;
export type ExecutiveMeetingReport = typeof executiveMeetingReports.$inferSelect;
export type NewExecutiveMeetingReport = typeof executiveMeetingReports.$inferInsert;
export type ExecutiveAgentReport = typeof executiveAgentReports.$inferSelect;
export type NewExecutiveAgentReport = typeof executiveAgentReports.$inferInsert;
export type ExecutiveAgentCommitment = typeof executiveAgentCommitments.$inferSelect;
export type NewExecutiveAgentCommitment = typeof executiveAgentCommitments.$inferInsert;
export type ExecutiveAgentKpi = typeof executiveAgentKpis.$inferSelect;
export type NewExecutiveAgentKpi = typeof executiveAgentKpis.$inferInsert;
export type ExecutiveActionApproval = typeof executiveActionApprovals.$inferSelect;
export type NewExecutiveActionApproval = typeof executiveActionApprovals.$inferInsert;
export type ExecutiveMeetingParticipant = typeof executiveMeetingParticipants.$inferSelect;
export type NewExecutiveMeetingParticipant = typeof executiveMeetingParticipants.$inferInsert;
export type ExecutiveMeetingTranscriptEntry = typeof executiveMeetingTranscriptEntries.$inferSelect;
export type NewExecutiveMeetingTranscriptEntry = typeof executiveMeetingTranscriptEntries.$inferInsert;
export type ExecutiveMeetingOutcome = typeof executiveMeetingOutcomes.$inferSelect;
export type NewExecutiveMeetingOutcome = typeof executiveMeetingOutcomes.$inferInsert;
