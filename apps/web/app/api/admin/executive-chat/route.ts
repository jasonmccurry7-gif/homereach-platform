import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";
import {
  toggleExecutiveAgent,
  updateExecutiveAgent,
  updateExecutiveApproval,
  updateExecutiveSettings,
} from "@/lib/executive-meetings/actions";
import { generateExecutiveMeeting } from "@/lib/executive-meetings/generator";
import { loadExecutiveChatData } from "@/lib/executive-meetings/repository";
import type { ExecutiveMeetingType } from "@/lib/executive-meetings/types";

type JsonRecord = Record<string, unknown>;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const data = await loadExecutiveChatData();
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase service credentials are not configured." }, { status: 503 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as JsonRecord;
    const action = stringValue(body.action);
    const db = createServiceClient();

    if (action === "generate_meeting") {
      const meetingType = meetingTypeValue(body.meetingType);
      const result = await generateExecutiveMeeting({
        meetingType,
        actorUserId: guard.user?.id ?? null,
        actorType: "human",
        idempotencyKey: null,
        forceNew: Boolean(body.forceNew),
      });
      return NextResponse.json(result, { status: result.ok ? 200 : result.status ?? 400 });
    }

    if (action === "update_agent" || action === "update_prompt") {
      const result = await updateExecutiveAgent({
        db,
        actorUserId: guard.user?.id ?? null,
        body,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : result.status ?? 400 });
    }

    if (action === "toggle_agent") {
      const result = await toggleExecutiveAgent({
        db,
        actorUserId: guard.user?.id ?? null,
        body,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : result.status ?? 400 });
    }

    if (action === "update_approval") {
      const result = await updateExecutiveApproval({
        db,
        actorUserId: guard.user?.id ?? null,
        body,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : result.status ?? 400 });
    }

    if (action === "update_settings") {
      const result = await updateExecutiveSettings({
        db,
        actorUserId: guard.user?.id ?? null,
        body,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : result.status ?? 400 });
    }

    return NextResponse.json({ ok: false, error: "Unknown executive chat action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

function meetingTypeValue(value: unknown): ExecutiveMeetingType {
  if (value === "afternoon" || value === "strategic" || value === "emergency") return value;
  return "morning";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Executive chat request failed.";
}
