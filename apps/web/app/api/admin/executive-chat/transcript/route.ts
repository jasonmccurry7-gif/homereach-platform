import { NextResponse } from "next/server";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { requireAdmin } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type JsonRecord = Record<string, unknown>;

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase service credentials are not configured." }, { status: 503 });
  }

  let body: JsonRecord;
  let meetingId: string;
  let statement: string;
  let speakerKey: string;
  let speakerName: string;
  let speakerTitle: string;
  let speakerType: ReturnType<typeof speakerTypeValue>;
  let statementType: ReturnType<typeof statementTypeValue>;
  let source: ReturnType<typeof sourceValue>;

  try {
    body = (await request.json().catch(() => ({}))) as JsonRecord;
    meetingId = requiredString(body.meetingId, "meetingId is required.");
    statement = boundedString(body.statement, "statement is required.", 6000);
    speakerKey = stringValue(body.speakerKey, "human_admin");
    speakerName = stringValue(body.speakerName, "Administrator");
    speakerTitle = stringValue(body.speakerTitle, "Administrator");
    speakerType = speakerTypeValue(body.speakerType);
    statementType = statementTypeValue(body.statementType);
    source = sourceValue(body.source);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Invalid transcript payload." },
      { status: 400 },
    );
  }

  const db = createServiceClient();
  const { data: maxRows, error: maxError } = await db
    .from("executive_meeting_transcript_entries")
    .select("sequence")
    .eq("meeting_id", meetingId)
    .order("sequence", { ascending: false })
    .limit(1);
  if (maxError) {
    return NextResponse.json({ ok: false, error: maxError.message }, { status: 500 });
  }

  const nextSequence = Number(maxRows?.[0]?.sequence ?? 0) + 1;
  const { data, error } = await db
    .from("executive_meeting_transcript_entries")
    .insert({
      meeting_id: meetingId,
      speaker_key: speakerKey,
      speaker_name: speakerName,
      speaker_title: speakerTitle,
      speaker_type: speakerType,
      sequence: nextSequence,
      statement,
      statement_type: statementType,
      source,
      metadata_json: {
        source: "executive_boardroom_live_voice",
        externalActionAuthorized: false,
      },
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await logPlatformAuditEvent({
    actorType: "human",
    actorId: guard.user?.id ?? null,
    module: "executive_meetings",
    actionType: "executive_boardroom_transcript_entry_created",
    entityType: "executive_meeting",
    entityId: meetingId,
    resultStatus: "success",
    approvalState: "needs_review",
    severity: "info",
    message: "Executive Boardroom live transcript entry saved.",
    metadata: {
      speakerKey,
      speakerType,
      statementType,
      source,
      externalActionAuthorized: false,
    },
  });

  return NextResponse.json({ ok: true, id: data.id, sequence: nextSequence });
}

function requiredString(value: unknown, message: string) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(message);
  return value.trim();
}

function boundedString(value: unknown, message: string, maxLength: number) {
  const text = requiredString(value, message);
  if (text.length > maxLength) throw new Error(`${message} Keep it under ${maxLength} characters.`);
  return text;
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function speakerTypeValue(value: unknown) {
  if (value === "ai_executive" || value === "facilitator" || value === "observer" || value === "system") return value;
  return "human_admin";
}

function statementTypeValue(value: unknown) {
  if (
    value === "opening" ||
    value === "agent_report" ||
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
  return "user";
}

function sourceValue(value: unknown) {
  if (value === "generated_report" || value === "manual" || value === "system") return value;
  return "live_voice";
}
