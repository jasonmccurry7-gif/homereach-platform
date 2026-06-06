import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { requireAdmin } from "@/lib/auth/api-guards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REALTIME_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
]);

type JsonRecord = Record<string, unknown>;

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "OPENAI_API_KEY is not configured for Executive Boardroom realtime voice.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as JsonRecord;
  const meetingId = stringValue(body.meetingId);
  const requestedVoice = stringValue(body.voice);
  const voice = REALTIME_VOICES.has(requestedVoice) ? requestedVoice : "marin";
  const meetingMode = stringValue(body.meetingMode, "strategic_planning");
  const model = stringValue(process.env.OPENAI_REALTIME_MODEL, "gpt-realtime-2");
  const safetyIdentifier = createHash("sha256")
    .update(`homereach-executive-boardroom:${guard.user?.id ?? "unknown-admin"}`)
    .digest("hex");

  const session = {
    session: {
      type: "realtime",
      model,
      output_modalities: ["audio", "text"],
      audio: {
        input: {
          turn_detection: {
            type: "semantic_vad",
          },
        },
        output: {
          voice,
        },
      },
      instructions: [
        "You are speaking inside the HomeReach AI Executive Boardroom.",
        "Act as an executive meeting participant, not an autonomous executor.",
        "All sends, purchases, bids, account changes, campaign changes, public posts, data exports, and destructive actions require explicit human approval.",
        "Keep responses concise, operational, source-aware, and suitable for a leadership meeting.",
        "If asked to take external action, summarize the draft action and state that it requires human approval.",
      ].join(" "),
      metadata: {
        source: "executive_boardroom",
        meetingId,
        meetingMode,
        externalActionAuthorized: false,
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": safetyIdentifier,
    },
    body: JSON.stringify(session),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    await auditRealtimeSession({
      actorUserId: guard.user?.id ?? null,
      meetingId,
      resultStatus: "failure",
      message: "Executive Boardroom realtime connection credential request failed.",
      errorMessage: stringValue(payload.error?.message, response.statusText),
      metadata: { meetingMode, voice, model },
    });
    return NextResponse.json(
      {
        ok: false,
        error: stringValue(payload.error?.message, "Could not create realtime connection."),
      },
      { status: response.status },
    );
  }

  await auditRealtimeSession({
    actorUserId: guard.user?.id ?? null,
    meetingId,
    resultStatus: "success",
    message: "Executive Boardroom realtime connection credential created.",
    errorMessage: null,
    metadata: { meetingMode, voice, model },
  });

  return NextResponse.json({
    ok: true,
    provider: "openai_realtime",
    model,
    voice,
    clientConnection: payload,
    approvalBoundary: "No external action is authorized by this realtime voice connection.",
  });
}

async function auditRealtimeSession(input: {
  actorUserId: string | null;
  meetingId: string;
  resultStatus: "success" | "failure";
  message: string;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
}) {
  await logPlatformAuditEvent({
    actorType: "human",
    actorId: input.actorUserId,
    module: "executive_meetings",
    actionType: "executive_boardroom_realtime_connect_requested",
    entityType: "executive_meeting",
    entityId: input.meetingId || null,
    resultStatus: input.resultStatus,
    approvalState: "needs_review",
    severity: input.resultStatus === "success" ? "info" : "medium",
    message: input.message,
    errorMessage: input.errorMessage,
    metadata: {
      ...input.metadata,
      sensitiveValueStored: false,
      externalActionAuthorized: false,
    },
  });
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}
