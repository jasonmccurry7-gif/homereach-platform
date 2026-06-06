import "server-only";

import { syncApprovalLedgerFromSpine } from "@/lib/approvals/ledger";
import { loadApprovalSpine } from "@/lib/approvals/spine";
import type { ApprovalSpineItem } from "@/lib/approvals/types";
import { createServiceClient } from "@/lib/supabase/service";

export type VoiceActionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "sent"
  | "failed"
  | "paused";

export type VoiceActionRow = {
  id: string;
  action_type: string;
  channel: string;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  business_name: string | null;
  campaign_id: string | null;
  city: string | null;
  vertical: string | null;
  subject: string | null;
  body: string;
  status: VoiceActionStatus;
  risk_level: "low" | "medium" | "high";
  created_by_agent: string | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  failure_reason: string | null;
  source_system: string | null;
  source_table: string | null;
  source_id: string | null;
  source_key: string | null;
  approval_ledger_id: string | null;
  ai_workforce_task_id: string | null;
  ai_output_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type VoiceSessionRow = {
  id: string;
  user_id: string | null;
  started_at: string;
  ended_at: string | null;
  transcript: string;
  summary: string;
  model_used: string;
  status: string;
  metadata: Record<string, unknown>;
};

export type AgentBriefingRow = {
  id: string;
  briefing_type: string;
  agent_name: string;
  agent_role: string;
  summary: string;
  recommendations: Record<string, unknown>[];
  proposed_actions: Record<string, unknown>[];
  created_at: string;
};

export type CommunicationAuditRow = {
  id: string;
  action_queue_id: string | null;
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  actor_type: string;
  actor_name: string | null;
  notes: string | null;
  created_at: string;
};

export type VoiceCommandCenterData = {
  enabled: boolean;
  queueAvailable: boolean;
  queueError: string | null;
  actions: VoiceActionRow[];
  approvalQueue: ApprovalSpineItem[];
  sessions: VoiceSessionRow[];
  briefings: AgentBriefingRow[];
  audits: CommunicationAuditRow[];
  metrics: {
    pendingApproval: number;
    approvedUnsent: number;
    highRisk: number;
    paused: number;
    sentToday: number;
    approvalBacklog: number;
  };
  safety: {
    externalSendingEnabled: boolean;
    emailSendingEnabled: boolean;
    smsSendingEnabled: boolean;
    requireSecondConfirmationForBulk: boolean;
    globalOutboundPaused: boolean;
    mode: "review_only" | "manual_handoff" | "live";
  };
};

type QueueActionInput = {
  actionType: "email" | "sms" | "dm" | "proposal" | "follow_up" | "internal_task";
  channel?: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  businessName?: string | null;
  campaignId?: string | null;
  city?: string | null;
  vertical?: string | null;
  subject?: string | null;
  body: string;
  riskLevel?: "low" | "medium" | "high";
  createdByAgent?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

type VoiceApprovalInput = {
  sessionId?: string | null;
  approvalPhrase?: string;
  transcriptSnippet?: string;
  confidenceScore?: number;
};

function flag(key: string, fallback = false) {
  const value = process.env[key];
  if (value == null || value === "") return fallback;
  return value === "true";
}

function mode(): VoiceCommandCenterData["safety"]["mode"] {
  const value = process.env.VOICE_COMMAND_CENTER_MODE;
  if (value === "live" || value === "manual_handoff" || value === "review_only") return value;
  return "review_only";
}

function todayIsoPrefix() {
  return new Date().toISOString().slice(0, 10);
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || /does not exist|schema cache|relation .* not found/i.test(error?.message ?? "");
}

function safeJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function actionTypeForApproval(item: ApprovalSpineItem): QueueActionInput["actionType"] {
  if (item.source === "Revenue Approval") {
    const channel = item.actionTarget.kind === "revenue_approval" ? item.actionTarget.channel : "";
    if (channel === "sms") return "sms";
    return "email";
  }
  if (item.source === "Facebook Draft") return "dm";
  if (item.source === "Political" && item.approvalKind.includes("proposal")) return "proposal";
  if (item.approvalKind.includes("follow")) return "follow_up";
  return "internal_task";
}

function channelForApproval(item: ApprovalSpineItem) {
  if (item.source === "Facebook Draft") return "facebook_dm";
  if (item.source === "Revenue Approval" && item.actionTarget.kind === "revenue_approval") {
    return item.actionTarget.channel === "sms" ? "sms" : "email";
  }
  if (item.source === "Political" && item.approvalKind.includes("proposal")) return "proposal";
  return "internal";
}

function bodyForApproval(item: ApprovalSpineItem) {
  if (item.actionTarget.kind === "revenue_approval" && item.actionTarget.messageBody) {
    return item.actionTarget.messageBody;
  }
  return [item.detail, item.nextAction].filter(Boolean).join("\n\n");
}

function riskForApproval(item: ApprovalSpineItem): "low" | "medium" | "high" {
  if (item.priority === "critical" || item.priority === "high") return "high";
  if (item.domain === "political" || item.domain === "gov_contracts" || item.domain === "procurement") return "high";
  if (item.lane === "ready_to_send" || item.lane === "ready_to_publish") return "medium";
  return "low";
}

export function getVoiceCommandCenterSafety(): VoiceCommandCenterData["safety"] {
  const currentMode = mode();
  return {
    externalSendingEnabled: currentMode === "live" && flag("ENABLE_VOICE_COMMAND_EXTERNAL_SENDS"),
    emailSendingEnabled: currentMode === "live" && flag("ENABLE_VOICE_COMMAND_EMAIL_SEND"),
    smsSendingEnabled: currentMode === "live" && flag("ENABLE_VOICE_COMMAND_SMS_SEND"),
    requireSecondConfirmationForBulk: process.env.VOICE_COMMAND_REQUIRE_BULK_CONFIRMATION !== "false",
    globalOutboundPaused: flag("VOICE_COMMAND_OUTBOUND_PAUSED"),
    mode: currentMode,
  };
}

export async function summarizePendingQueue(actions?: VoiceActionRow[]) {
  const rows = actions ?? (await loadActionQueue()).rows;
  const pending = rows.filter((row) => row.status === "pending_approval" || row.status === "draft");
  const approved = rows.filter((row) => row.status === "approved");
  const highRisk = rows.filter((row) => row.risk_level === "high" && row.status !== "sent");
  return {
    pendingCount: pending.length,
    approvedUnsentCount: approved.length,
    highRiskCount: highRisk.length,
    summary: [
      `${pending.length} item${pending.length === 1 ? "" : "s"} waiting for review`,
      `${approved.length} approved but unsent`,
      `${highRisk.length} high-risk item${highRisk.length === 1 ? "" : "s"}`,
    ].join(". "),
  };
}

async function loadActionQueue() {
  const db = createServiceClient();
  const { data, error } = await db
    .from("action_queue")
    .select("*")
    .in("status", ["draft", "pending_approval", "approved", "paused", "failed"])
    .order("updated_at", { ascending: false })
    .limit(80);

  if (error) {
    return {
      rows: [] as VoiceActionRow[],
      available: false,
      error: isMissingTable(error) ? "Voice Command Center migration is not applied in this environment yet." : error.message,
    };
  }

  return {
    rows: (data ?? []) as VoiceActionRow[],
    available: true,
    error: null,
  };
}

export async function syncActionQueueFromApprovalSpine(actorId: string | null) {
  const approvalSync = await syncApprovalLedgerFromSpine({
    actorId,
    actorLabel: actorId ? "voice_command_center_admin" : "voice_command_center_system",
    eventType: "voice_command_center_spine_sync",
    syncSource: "voice_command_center",
  });

  const spine = await loadApprovalSpine({ mode: "sync" });
  const items = spine.queue.slice(0, 80);
  const db = createServiceClient();

  const payload = items.map((item) => ({
    action_type: actionTypeForApproval(item),
    channel: channelForApproval(item),
    business_name: item.title,
    subject: item.source === "Revenue Approval" || item.source === "Facebook Draft" ? item.title : null,
    body: bodyForApproval(item),
    status: item.lane === "ready_to_send" ? "approved" : "pending_approval",
    risk_level: riskForApproval(item),
    created_by_agent: item.source,
    source_system: item.sourceSystem,
    source_table: item.sourceTable,
    source_id: item.sourceId,
    source_key: item.sourceKey,
    metadata: {
      source_key: item.sourceKey,
      source_href: item.href,
      domain: item.domain,
      approval_kind: item.approvalKind,
      guardrail: item.guardrail,
      next_action: item.nextAction,
      action_target: item.actionTarget,
      synced_from: "approval_spine",
    },
    created_by: actorId,
  }));

  if (!payload.length) {
    return { ok: true, synced: 0, approvalSync, error: spine.errors.join("; ") || null };
  }

  const { error } = await db
    .from("action_queue")
    .upsert(payload, { onConflict: "source_key" })
    .select("id");

  if (error) {
    return {
      ok: false,
      synced: 0,
      approvalSync,
      error: isMissingTable(error) ? "Voice Command Center migration is not applied in this environment yet." : error.message,
    };
  }

  return { ok: true, synced: payload.length, approvalSync, error: spine.errors.join("; ") || null };
}

export async function loadVoiceCommandCenterData(): Promise<VoiceCommandCenterData> {
  const [queueResult, approvalData] = await Promise.all([
    loadActionQueue(),
    loadApprovalSpine(),
  ]);
  const db = createServiceClient();
  const actions = queueResult.rows;

  const [sessionsResult, briefingsResult, auditsResult] = await Promise.all([
    db
      .from("voice_sessions")
      .select("id,user_id,started_at,ended_at,transcript,summary,model_used,status,metadata")
      .order("started_at", { ascending: false })
      .limit(8),
    db
      .from("agent_briefings")
      .select("id,briefing_type,agent_name,agent_role,summary,recommendations,proposed_actions,created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    db
      .from("communication_audit_log")
      .select("id,action_queue_id,event_type,old_status,new_status,actor_type,actor_name,notes,created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const sessions = sessionsResult.error ? [] : (sessionsResult.data ?? []) as VoiceSessionRow[];
  const briefings = briefingsResult.error ? [] : (briefingsResult.data ?? []) as AgentBriefingRow[];
  const audits = auditsResult.error ? [] : (auditsResult.data ?? []) as CommunicationAuditRow[];
  const safety = getVoiceCommandCenterSafety();
  const tableWarnings = [sessionsResult.error, briefingsResult.error, auditsResult.error]
    .filter((error) => error && isMissingTable(error))
    .map(() => "Voice persistence migration is not applied yet. Browser voice chat still works; session history, briefings, and audit persistence may be limited.")
    .filter(Boolean);

  return {
    enabled: flag("ENABLE_VOICE_COMMAND_CENTER"),
    queueAvailable: queueResult.available,
    queueError: queueResult.error ?? tableWarnings[0] ?? null,
    actions,
    approvalQueue: approvalData.queue.slice(0, 20),
    sessions,
    briefings,
    audits,
    metrics: {
      pendingApproval: actions.filter((row) => row.status === "pending_approval" || row.status === "draft").length,
      approvedUnsent: actions.filter((row) => row.status === "approved").length,
      highRisk: actions.filter((row) => row.risk_level === "high" && row.status !== "sent").length,
      paused: actions.filter((row) => row.status === "paused").length,
      sentToday: actions.filter((row) => row.status === "sent" && row.sent_at?.startsWith(todayIsoPrefix())).length,
      approvalBacklog: approvalData.summary.needsApproval + approvalData.summary.readyToSend,
    },
    safety,
  };
}

export async function queueAction(input: QueueActionInput) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("action_queue")
    .insert({
      action_type: input.actionType,
      channel: input.channel ?? input.actionType,
      recipient_name: input.recipientName ?? null,
      recipient_email: input.recipientEmail ?? null,
      recipient_phone: input.recipientPhone ?? null,
      business_name: input.businessName ?? null,
      campaign_id: input.campaignId ?? null,
      city: input.city ?? null,
      vertical: input.vertical ?? null,
      subject: input.subject ?? null,
      body: input.body,
      status: "pending_approval",
      risk_level: input.riskLevel ?? "medium",
      created_by_agent: input.createdByAgent ?? "Voice Command Center",
      metadata: input.metadata ?? {},
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error) return { ok: false, action: null, error: error.message };
  await logCommunicationEvent({
    actionId: data.id,
    eventType: "action_queued",
    oldStatus: null,
    newStatus: "pending_approval",
    actorType: "system",
    actorName: input.createdByAgent ?? "Voice Command Center",
    actorUserId: input.createdBy ?? null,
    notes: "Action queued for human approval. No outbound communication sent.",
  });

  return { ok: true, action: data as VoiceActionRow, error: null };
}

async function insertVoiceApproval(
  approvalType: "approve" | "reject" | "pause" | "rewrite" | "send_now",
  actionIds: string[],
  input: VoiceApprovalInput = {},
) {
  if (!input.sessionId && !input.approvalPhrase) return null;

  const db = createServiceClient();
  const { data, error } = await db
    .from("voice_approvals")
    .insert({
      voice_session_id: input.sessionId ?? null,
      action_queue_ids: actionIds,
      approval_phrase: input.approvalPhrase ?? `${approvalType} via admin command`,
      approval_type: approvalType,
      transcript_snippet: input.transcriptSnippet ?? "",
      confidence_score: Math.max(0, Math.min(1, input.confidenceScore ?? 1)),
      executed: true,
      executed_at: new Date().toISOString(),
      metadata: {
        source: "voice_command_center",
        external_send_executed: false,
      },
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id as string, error: null };
}

async function updateActionStatus({
  actionId,
  newStatus,
  actorUserId,
  notes,
  metadata,
  voiceApproval,
}: {
  actionId: string;
  newStatus: VoiceActionStatus;
  actorUserId: string;
  notes: string;
  metadata?: Record<string, unknown>;
  voiceApproval?: VoiceApprovalInput;
}) {
  const db = createServiceClient();
  const { data: existing, error: existingError } = await db
    .from("action_queue")
    .select("*")
    .eq("id", actionId)
    .single();

  if (existingError) return { ok: false, action: null, error: existingError.message };
  const now = new Date().toISOString();
  const oldStatus = String(existing.status ?? "draft");
  const nextMetadata = {
    ...safeJsonRecord(existing.metadata),
    ...(metadata ?? {}),
  };

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    metadata: nextMetadata,
  };
  if (newStatus === "approved") {
    updatePayload.approved_by = actorUserId;
    updatePayload.approved_at = now;
  }

  const { data, error } = await db
    .from("action_queue")
    .update(updatePayload)
    .eq("id", actionId)
    .select("*")
    .single();

  if (error) return { ok: false, action: null, error: error.message };

  const approval = await insertVoiceApproval(
    newStatus === "approved" ? "approve" : newStatus === "rejected" ? "reject" : "pause",
    [actionId],
    voiceApproval,
  );

  await logCommunicationEvent({
    actionId,
    eventType: `voice_command_${newStatus}`,
    oldStatus,
    newStatus,
    actorType: "user",
    actorName: "HomeReach Admin",
    actorUserId,
    notes,
    metadata: {
      ...(metadata ?? {}),
      voice_approval_id: approval?.id ?? null,
    },
  });

  return { ok: true, action: data as VoiceActionRow, error: approval?.error ?? null };
}

export async function approveAction(actionId: string, actorUserId: string, voiceApproval?: VoiceApprovalInput) {
  return updateActionStatus({
    actionId,
    actorUserId,
    newStatus: "approved",
    notes: "Action approved by admin. External send still requires explicit send-now request and provider guard checks.",
    voiceApproval,
  });
}

export async function rejectAction(actionId: string, actorUserId: string, voiceApproval?: VoiceApprovalInput) {
  return updateActionStatus({
    actionId,
    actorUserId,
    newStatus: "rejected",
    notes: "Action rejected by admin. No outbound communication sent.",
    voiceApproval,
  });
}

export async function pauseAction(actionId: string, actorUserId: string, voiceApproval?: VoiceApprovalInput) {
  return updateActionStatus({
    actionId,
    actorUserId,
    newStatus: "paused",
    notes: "Action paused by admin. No outbound communication sent.",
    voiceApproval,
  });
}

export async function pauseAllOutbound(actorUserId: string, voiceApproval?: VoiceApprovalInput) {
  const db = createServiceClient();
  const { data: rows, error: loadError } = await db
    .from("action_queue")
    .select("*")
    .in("status", ["draft", "pending_approval", "approved"])
    .in("channel", ["email", "sms", "facebook_dm", "instagram_dm", "linkedin_dm", "proposal"]);

  if (loadError) return { ok: false, paused: 0, error: loadError.message };

  const actionIds = ((rows ?? []) as VoiceActionRow[]).map((row) => row.id);
  if (!actionIds.length) return { ok: true, paused: 0, error: null };

  const { error } = await db
    .from("action_queue")
    .update({
      status: "paused",
      metadata: {
        paused_by: actorUserId,
        paused_at: new Date().toISOString(),
        pause_source: "voice_command_center_emergency_pause",
      },
    })
    .in("id", actionIds);

  if (error) return { ok: false, paused: 0, error: error.message };

  const approval = await insertVoiceApproval("pause", actionIds, voiceApproval);

  await Promise.all(actionIds.map((actionId) =>
    logCommunicationEvent({
      actionId,
      eventType: "voice_command_pause_all_outbound",
      oldStatus: "active_review_state",
      newStatus: "paused",
      actorType: "user",
      actorName: "HomeReach Admin",
      actorUserId,
      notes: "Emergency pause applied to outbound queue. No outbound communication sent.",
      metadata: {
        voice_approval_id: approval?.id ?? null,
      },
    }),
  ));

  return { ok: true, paused: actionIds.length, error: approval?.error ?? null };
}

export async function rewriteAction(
  actionId: string,
  actorUserId: string,
  body: string,
  voiceApproval?: VoiceApprovalInput,
) {
  const db = createServiceClient();
  const { data: existing, error: existingError } = await db
    .from("action_queue")
    .select("*")
    .eq("id", actionId)
    .single();
  if (existingError) return { ok: false, action: null, error: existingError.message };

  const { data, error } = await db
    .from("action_queue")
    .update({
      body,
      status: "pending_approval",
      metadata: {
        ...safeJsonRecord(existing.metadata),
        rewritten_at: new Date().toISOString(),
        rewritten_by: actorUserId,
      },
    })
    .eq("id", actionId)
    .select("*")
    .single();

  if (error) return { ok: false, action: null, error: error.message };
  const approval = await insertVoiceApproval("rewrite", [actionId], voiceApproval);
  await logCommunicationEvent({
    actionId,
    eventType: "voice_command_rewrite",
    oldStatus: String(existing.status ?? "draft"),
    newStatus: "pending_approval",
    actorType: "user",
    actorName: "HomeReach Admin",
    actorUserId,
    notes: "Action body rewritten and returned to pending approval. No outbound communication sent.",
    metadata: { voice_approval_id: approval?.id ?? null },
  });

  return { ok: true, action: data as VoiceActionRow, error: approval?.error ?? null };
}

export async function sendApprovedActions(actionIds: string[], actorUserId: string, voiceApproval?: VoiceApprovalInput) {
  const safety = getVoiceCommandCenterSafety();
  const db = createServiceClient();
  const { data, error } = await db
    .from("action_queue")
    .select("*")
    .in("id", actionIds);

  if (error) return { ok: false, sent: 0, blocked: actionIds.length, error: error.message };

  const rows = (data ?? []) as VoiceActionRow[];
  const approvedRows = rows.filter((row) => row.status === "approved");
  const approval = await insertVoiceApproval("send_now", approvedRows.map((row) => row.id), voiceApproval);

  const blockedReason = safety.externalSendingEnabled
    ? "Phase 1 voice command center records send-now intent only. Provider send execution remains disabled until the dedicated communication sending phase."
    : "External sending is disabled by feature flag or review-only mode.";

  await Promise.all(approvedRows.map((row) =>
    logCommunicationEvent({
      actionId: row.id,
      eventType: "send_now_requested_blocked",
      oldStatus: row.status,
      newStatus: row.status,
      actorType: "user",
      actorName: "HomeReach Admin",
      actorUserId,
      notes: blockedReason,
      metadata: {
        voice_approval_id: approval?.id ?? null,
        safety,
      },
    }),
  ));

  return {
    ok: true,
    sent: 0,
    blocked: approvedRows.length,
    error: blockedReason,
  };
}

export async function startVoiceSession(userId: string, modelUsed = "not_started") {
  const db = createServiceClient();
  const { data, error } = await db
    .from("voice_sessions")
    .insert({
      user_id: userId,
      model_used: modelUsed,
      status: "active",
      metadata: {
        source: "admin_voice_command_center",
        external_sends_enabled: false,
      },
    })
    .select("*")
    .single();

  if (error && isMissingTable(error)) {
    return {
      ok: true,
      session: localVoiceSession(userId, modelUsed),
      error: "Voice session table is not applied yet. Session is running in browser-only mode without DB persistence.",
    };
  }
  if (error) return { ok: false, session: null, error: error.message };
  return { ok: true, session: data as VoiceSessionRow, error: null };
}

export async function endVoiceSession(sessionId: string, userId: string, transcript: string, summary: string) {
  if (sessionId.startsWith("local-")) {
    return {
      ok: true,
      session: {
        ...localVoiceSession(userId, "browser_transcript_fallback"),
        id: sessionId,
        ended_at: new Date().toISOString(),
        transcript,
        summary,
        status: "completed",
      },
      error: "Voice session table is not applied yet. Browser transcript was not persisted.",
    };
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("voice_sessions")
    .update({
      transcript,
      summary,
      status: "completed",
      ended_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error && isMissingTable(error)) {
    return {
      ok: true,
      session: {
        ...localVoiceSession(userId, "browser_transcript_fallback"),
        id: sessionId,
        ended_at: new Date().toISOString(),
        transcript,
        summary,
        status: "completed",
      },
      error: "Voice session table is not applied yet. Browser transcript was not persisted.",
    };
  }
  if (error) return { ok: false, session: null, error: error.message };
  return { ok: true, session: data as VoiceSessionRow, error: null };
}

export async function getDailyBriefing(userId: string, briefingType: "morning" | "afternoon" | "on_demand" = "on_demand") {
  const data = await loadVoiceCommandCenterData();
  const summary = await summarizePendingQueue(data.actions);
  const db = createServiceClient();
  const row = {
    briefing_type: briefingType,
    agent_name: "CEO Agent",
    agent_role: "Executive Prioritization",
    summary: `Voice briefing ready. ${summary.summary}. ${data.metrics.approvalBacklog} broader approval-ledger item${data.metrics.approvalBacklog === 1 ? "" : "s"} need executive attention.`,
    recommendations: [
      {
        title: "Clear high-risk approvals first",
        reason: "High-risk outbound, political, procurement, and proposal actions carry the most downside if rushed.",
      },
      {
        title: "Keep external sending paused until provider checks pass",
        reason: "Phase 1 captures approvals and audit events without live provider sends.",
      },
    ],
    proposed_actions: data.actions.slice(0, 5).map((action) => ({
      id: action.id,
      title: action.subject ?? action.business_name ?? action.action_type,
      status: action.status,
      channel: action.channel,
      riskLevel: action.risk_level,
    })),
    source_snapshot: {
      metrics: data.metrics,
      safety: data.safety,
    },
    created_by: userId,
  };

  const { data: inserted, error } = await db.from("agent_briefings").insert(row).select("*").single();
  if (error && isMissingTable(error)) {
    return {
      ok: true,
      briefing: {
        id: `local-briefing-${Date.now()}`,
        briefing_type: briefingType,
        agent_name: row.agent_name,
        agent_role: row.agent_role,
        summary: row.summary,
        recommendations: row.recommendations,
        proposed_actions: row.proposed_actions,
        created_at: new Date().toISOString(),
      } as AgentBriefingRow,
      error: "Voice briefing table is not applied yet. Briefing generated without DB persistence.",
    };
  }
  if (error) return { ok: false, briefing: null, error: error.message };
  return { ok: true, briefing: inserted as AgentBriefingRow, error: null };
}

export async function auditRecentCommunications(limit = 20) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("communication_audit_log")
    .select("id,action_queue_id,event_type,old_status,new_status,actor_type,actor_name,notes,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { ok: false, rows: [] as CommunicationAuditRow[], error: error.message };
  return { ok: true, rows: (data ?? []) as CommunicationAuditRow[], error: null };
}

async function logCommunicationEvent(input: {
  actionId: string | null;
  eventType: string;
  oldStatus: string | null;
  newStatus: string | null;
  actorType: "user" | "agent" | "system";
  actorName: string;
  actorUserId?: string | null;
  notes: string;
  metadata?: Record<string, unknown>;
}) {
  const db = createServiceClient();
  const { error } = await db.from("communication_audit_log").insert({
    action_queue_id: input.actionId,
    event_type: input.eventType,
    old_status: input.oldStatus,
    new_status: input.newStatus,
    actor_type: input.actorType,
    actor_name: input.actorName,
    actor_user_id: input.actorUserId ?? null,
    notes: input.notes,
    metadata: input.metadata ?? {},
  });
  if (error && !isMissingTable(error)) {
    console.warn("[voice-command-center] communication audit log skipped:", error.message);
  }
}

function localVoiceSession(userId: string, modelUsed: string): VoiceSessionRow {
  const now = new Date().toISOString();
  return {
    id: `local-${Date.now()}`,
    user_id: userId,
    started_at: now,
    ended_at: null,
    transcript: "",
    summary: "",
    model_used: modelUsed,
    status: "active",
    metadata: {
      persistence: "browser_only",
      reason: "voice_sessions table unavailable",
      external_sends_enabled: false,
    },
  };
}
