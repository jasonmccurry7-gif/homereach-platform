import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { handleExecutiveVoiceTurn } from "@/lib/executive-meetings/voice-turn";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type JsonRecord = Record<string, unknown>;

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as JsonRecord;
  const utterance = stringValue(body.utterance);
  if (!utterance) {
    return NextResponse.json({ ok: false, error: "utterance is required." }, { status: 400 });
  }

  const contextSource =
    body.contextSource === "voice_command_center" ? "voice_command_center" : "executive_boardroom";

  const result = await handleExecutiveVoiceTurn({
    actorUserId: guard.user?.id ?? null,
    meetingId: nullableString(body.meetingId),
    utterance,
    preferredAgentKey: nullableString(body.preferredAgentKey),
    contextSource,
    meetingMode: nullableString(body.meetingMode),
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown) {
  const text = stringValue(value);
  return text || null;
}
