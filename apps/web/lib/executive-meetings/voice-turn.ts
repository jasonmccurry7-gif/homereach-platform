import "server-only";

import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { createServiceClient } from "@/lib/supabase/service";
import { loadExecutiveChatData } from "./repository";
import type {
  ExecutiveAgent,
  ExecutiveAgentReport,
  ExecutiveBoardroomMode,
  ExecutiveChatData,
  ExecutiveMeeting,
  ExecutiveMeetingOutcome,
} from "./types";

type VoiceTurnInput = {
  actorUserId: string | null;
  meetingId?: string | null;
  utterance: string;
  preferredAgentKey?: string | null;
  contextSource?: "executive_boardroom" | "voice_command_center";
  meetingMode?: ExecutiveBoardroomMode | string | null;
};

export type ExecutiveVoiceTurnResult = {
  ok: boolean;
  reply: string;
  speakerKey: string;
  speakerName: string;
  speakerTitle: string;
  provider: "openai_responses" | "deterministic_fallback";
  persisted: boolean;
  error?: string | null;
};

type PersistedEntry = {
  id: string | null;
  sequence: number | null;
  ok: boolean;
  error: string | null;
};

export async function handleExecutiveVoiceTurn(input: VoiceTurnInput): Promise<ExecutiveVoiceTurnResult> {
  const utterance = input.utterance.trim();
  if (!utterance) {
    return {
      ok: false,
      reply: "I did not catch a question yet. Try again and ask for the specific executive feedback you want.",
      speakerKey: "executive_secretary",
      speakerName: "Executive Secretary",
      speakerTitle: "Executive Secretary",
      provider: "deterministic_fallback",
      persisted: false,
      error: "utterance_required",
    };
  }

  const data = await loadExecutiveChatData();
  const meeting = findMeeting(data, input.meetingId);
  const reports = meeting ? data.agentReports.filter((report) => report.meetingId === meeting.id) : [];
  const outcomes = meeting ? data.outcomes.filter((outcome) => outcome.meetingId === meeting.id) : [];
  const speaker = selectSpeaker({
    agents: data.agents,
    reports,
    preferredAgentKey: input.preferredAgentKey ?? null,
    utterance,
  });

  const openAiReply = await generateOpenAiReply({
    data,
    meeting,
    outcomes,
    reports,
    speaker,
    utterance,
  });
  const provider = openAiReply ? "openai_responses" : "deterministic_fallback";
  const reply = openAiReply ?? deterministicReply({ data, meeting, reports, outcomes, speaker, utterance });
  const persisted = meeting
    ? await persistVoiceTurn({
        actorUserId: input.actorUserId,
        meeting,
        utterance,
        reply,
        speaker,
        contextSource: input.contextSource ?? "executive_boardroom",
        provider,
      })
    : { ok: false, id: null, sequence: null, error: "No meeting selected; voice turn returned without transcript persistence." };

  await logVoiceTurnAudit({
    actorType: "human",
    actorId: input.actorUserId,
    module: "executive_meetings",
    actionType: "executive_voice_turn_completed",
    entityType: meeting ? "executive_meeting" : "admin_voice_command_center",
    entityId: meeting?.id ?? null,
    resultStatus: "success",
    approvalState: "needs_review",
    severity: "info",
    message: `${speaker.role} responded to a live admin voice turn.`,
    metadata: {
      contextSource: input.contextSource ?? "executive_boardroom",
      speakerKey: speaker.agentKey,
      provider,
      persisted: persisted.ok,
      persistenceError: persisted.error,
      externalActionAuthorized: false,
      meetingMode: input.meetingMode ?? null,
    },
  });

  return {
    ok: true,
    reply,
    speakerKey: speaker.agentKey,
    speakerName: speaker.name,
    speakerTitle: cleanTitle(speaker.role),
    provider,
    persisted: persisted.ok,
    error: persisted.error,
  };
}

async function logVoiceTurnAudit(input: Parameters<typeof logPlatformAuditEvent>[0]) {
  try {
    await logPlatformAuditEvent(input);
  } catch (error) {
    console.warn(
      "[executive-voice-turn] audit log skipped:",
      error instanceof Error ? error.message : "unknown audit error",
    );
  }
}

function findMeeting(data: ExecutiveChatData, requestedId?: string | null) {
  if (requestedId) {
    const match = data.meetings.find((meeting) => meeting.id === requestedId);
    if (match) return match;
  }
  return data.selectedMeeting;
}

function selectSpeaker(input: {
  agents: ExecutiveAgent[];
  reports: ExecutiveAgentReport[];
  preferredAgentKey: string | null;
  utterance: string;
}) {
  const normalizedPreferred = normalizeAgentKey(input.preferredAgentKey);
  const inferredKey = normalizedPreferred ?? inferAgentKey(input.utterance);
  const byKey = input.agents.find((agent) => agent.agentKey === inferredKey && agent.enabled && !agent.archivedAt);
  const fallback = input.agents.find((agent) => agent.agentKey === "ceo" && agent.enabled && !agent.archivedAt)
    ?? input.agents.find((agent) => agent.enabled && !agent.archivedAt)
    ?? input.agents[0];
  const agent = byKey ?? fallback ?? {
    agentKey: "executive_secretary",
    name: "Executive Secretary",
    role: "Executive Secretary",
    mission: "Facilitate executive voice conversations safely.",
    dailyResponsibilities: [],
    kpiOwnership: [],
    morningReportFormat: {},
    afternoonReportFormat: {},
    permissionsLevel: "recommend_only",
    assignedDomains: ["HomeReach"],
    enabled: true,
    voiceProfileId: null,
    systemPrompt: "",
    displayOrder: 0,
    metadataJson: {},
    id: "executive-secretary",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
  } satisfies ExecutiveAgent;

  const report = input.reports.find((item) => item.agentKey === agent.agentKey) ?? null;
  return { ...agent, report };
}

function normalizeAgentKey(value: string | null) {
  if (!value) return null;
  if (value === "human_admin" || value === "executive_secretary" || value === "chief_of_staff") return null;
  return value;
}

function inferAgentKey(utterance: string) {
  const text = utterance.toLowerCase();
  if (/\b(tech|technical|code|build|deploy|bug|database|supabase|vercel|architecture|security)\b/.test(text)) return "cto";
  if (/\b(revenue|sales|deal|proposal|quote|pipeline|customer|conversion|money)\b/.test(text)) return "cro";
  if (/\b(procurement|supplyfy|supplier|vendor|savings|margin|invoice|reorder|spend)\b/.test(text)) return "cfo";
  if (/\b(outreach|follow[- ]?up|email|sms|text|dm|facebook|reply|sender)\b/.test(text)) return "chief_outreach_officer";
  if (/\b(risk|qa|compliance|unsafe|approval|legal|policy|guardrail)\b/.test(text)) return "qa_risk";
  if (/\b(marketing|content|creative|campaign|website|seo|positioning|brand)\b/.test(text)) return "cmo";
  if (/\b(operations|fulfillment|handoff|workflow|blocked|process|queue)\b/.test(text)) return "operations";
  return "ceo";
}

async function generateOpenAiReply(input: {
  data: ExecutiveChatData;
  meeting: ExecutiveMeeting | null;
  reports: ExecutiveAgentReport[];
  outcomes: ExecutiveMeetingOutcome[];
  speaker: ExecutiveAgent & { report: ExecutiveAgentReport | null };
  utterance: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_EXECUTIVE_VOICE_TEXT_MODEL || "gpt-4.1-mini";
  const prompt = [
    `Speaker: ${input.speaker.role} / ${input.speaker.name}`,
    `Mission: ${input.speaker.mission}`,
    input.meeting ? `Meeting: ${input.meeting.title}` : "Meeting: no saved meeting selected",
    input.meeting ? `CEO summary: ${input.meeting.ceoSummary}` : null,
    input.speaker.report ? `Speaker report: ${input.speaker.report.summary}` : null,
    `Open approvals: ${input.data.summary.pendingApprovals}`,
    `Revenue waiting: ${input.data.summary.estimatedRevenue}`,
    `Savings waiting: ${input.data.summary.estimatedSavings}`,
    `Open outcomes: ${input.outcomes.slice(0, 6).map((item) => `${item.outcomeType}: ${item.title}`).join(" | ")}`,
    `Admin said: ${input.utterance}`,
  ].filter(Boolean).join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 220,
        input: [
          {
            role: "system",
            content: [
              "You are a HomeReach executive AI agent in a live voice conversation with Jason.",
              "Give direct operational feedback on what is being worked on, outcomes, risk, and the next best action.",
              "Be concise enough to speak out loud in under 30 seconds.",
              "Do not claim that you sent, posted, charged, submitted, purchased, or changed anything.",
              "All external actions require human approval.",
            ].join(" "),
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    return extractResponseText(payload);
  } catch {
    return null;
  }
}

function deterministicReply(input: {
  data: ExecutiveChatData;
  meeting: ExecutiveMeeting | null;
  reports: ExecutiveAgentReport[];
  outcomes: ExecutiveMeetingOutcome[];
  speaker: ExecutiveAgent & { report: ExecutiveAgentReport | null };
  utterance: string;
}) {
  const report = input.speaker.report;
  const priority = report?.prioritiesJson[0];
  const risk = report?.risksJson[0];
  const decision = report?.decisionsNeededJson[0] ?? input.meeting?.decisionsNeededJson[0];
  const outcome = input.outcomes.find((item) => item.status !== "completed");
  const summary = report?.summary || input.meeting?.ceoSummary || "I can give executive feedback once a meeting or live system snapshot is available.";
  const nextMove =
    priority?.detail ||
    decision?.detail ||
    outcome?.detail ||
    `${input.data.summary.pendingApprovals} approvals, ${input.data.summary.decisionsNeeded} decisions, and ${input.data.summary.blockers} blockers need review.`;
  const riskNote = risk
    ? `The main risk is ${risk.title.toLowerCase()}: ${risk.detail}`
    : "I do not see a critical risk in this lane from the current snapshot.";

  return [
    `${cleanTitle(input.speaker.role)} here.`,
    summary,
    `My feedback: ${nextMove}`,
    riskNote,
    "I am treating this as guidance only; no external action is authorized from voice chat.",
  ].join(" ");
}

async function persistVoiceTurn(input: {
  actorUserId: string | null;
  meeting: ExecutiveMeeting;
  utterance: string;
  reply: string;
  speaker: ExecutiveAgent & { report: ExecutiveAgentReport | null };
  contextSource: string;
  provider: ExecutiveVoiceTurnResult["provider"];
}): Promise<PersistedEntry> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, id: null, sequence: null, error: "Supabase service credentials are not configured." };
  }

  const db = createServiceClient();
  const nextSequence = await nextTranscriptSequence(db, input.meeting.id);
  if (!nextSequence.ok || nextSequence.sequence == null) return nextSequence;

  const human = await insertTranscript(db, {
    meetingId: input.meeting.id,
    sequence: nextSequence.sequence,
    speakerKey: "human_admin",
    speakerName: "Administrator",
    speakerTitle: "Administrator",
    speakerType: "human_admin",
    statement: input.utterance,
    statementType: "user",
    source: "live_voice",
    metadataJson: {
      contextSource: input.contextSource,
      externalActionAuthorized: false,
    },
  });
  if (!human.ok) return human;

  return insertTranscript(db, {
    meetingId: input.meeting.id,
    sequence: nextSequence.sequence + 1,
    speakerKey: input.speaker.agentKey,
    speakerName: input.speaker.name,
    speakerTitle: cleanTitle(input.speaker.role),
    speakerType: input.speaker.agentKey === "executive_secretary" ? "facilitator" : "ai_executive",
    statement: input.reply,
    statementType: "summary",
    source: "live_voice",
    metadataJson: {
      contextSource: input.contextSource,
      provider: input.provider,
      externalActionAuthorized: false,
      actorUserId: input.actorUserId,
    },
  });
}

async function nextTranscriptSequence(db: ReturnType<typeof createServiceClient>, meetingId: string): Promise<PersistedEntry> {
  const { data, error } = await db
    .from("executive_meeting_transcript_entries")
    .select("sequence")
    .eq("meeting_id", meetingId)
    .order("sequence", { ascending: false })
    .limit(1);
  if (error) return { ok: false, id: null, sequence: null, error: missingSchemaMessage(error.message) };
  return { ok: true, id: null, sequence: Number(data?.[0]?.sequence ?? 0) + 1, error: null };
}

async function insertTranscript(
  db: ReturnType<typeof createServiceClient>,
  input: {
    meetingId: string;
    sequence: number;
    speakerKey: string;
    speakerName: string;
    speakerTitle: string;
    speakerType: "ai_executive" | "human_admin" | "facilitator";
    statement: string;
    statementType: "user" | "summary";
    source: "live_voice";
    metadataJson: Record<string, unknown>;
  },
): Promise<PersistedEntry> {
  const { data, error } = await db
    .from("executive_meeting_transcript_entries")
    .insert({
      meeting_id: input.meetingId,
      sequence: input.sequence,
      speaker_key: input.speakerKey,
      speaker_name: input.speakerName,
      speaker_title: input.speakerTitle,
      speaker_type: input.speakerType,
      statement: input.statement,
      statement_type: input.statementType,
      source: input.source,
      metadata_json: input.metadataJson,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, id: null, sequence: null, error: missingSchemaMessage(error.message) };
  return { ok: true, id: typeof data?.id === "string" ? data.id : null, sequence: input.sequence, error: null };
}

function extractResponseText(payload: Record<string, unknown>) {
  const outputText = stringValue(payload.output_text);
  if (outputText) return outputText;
  const output = Array.isArray(payload.output) ? payload.output : [];
  const pieces = output.flatMap((item) => {
    const record = asRecord(item);
    const content = Array.isArray(record.content) ? record.content : [];
    return content.map((contentItem) => {
      const contentRecord = asRecord(contentItem);
      return stringValue(contentRecord.text) || stringValue(contentRecord.transcript);
    });
  }).filter(Boolean);
  return pieces.join(" ").trim() || null;
}

function missingSchemaMessage(message: string) {
  if (/does not exist|schema cache|relation .* not found/i.test(message)) {
    return "Executive Boardroom transcript tables are not applied yet; voice reply still completed without persistence.";
  }
  return message;
}

function cleanTitle(role: string) {
  return role.replace(/\s+Agent$/i, "").trim() || "Executive Leader";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}
