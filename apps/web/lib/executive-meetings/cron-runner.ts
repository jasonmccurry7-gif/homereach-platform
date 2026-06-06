import "server-only";

import { NextResponse } from "next/server";
import { requireCron } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";
import {
  autoIdempotencyKey,
  dueMeetingTypesForNow,
  generateExecutiveMeeting,
} from "./generator";
import { fetchExecutiveSettings } from "./repository";
import type { ExecutiveMeetingType } from "./types";

export async function runExecutiveMeetingCron(
  request: Request,
  options: { meetingType?: ExecutiveMeetingType } = {},
) {
  const guard = requireCron(request);
  if (!guard.ok) return guard.response;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase service credentials are not configured." }, { status: 503 });
  }

  const db = createServiceClient();
  const settings = await fetchExecutiveSettings(db);
  const dueTypes = options.meetingType
    ? (settings.autoGenerateEnabled ? [options.meetingType] : [])
    : dueMeetingTypesForNow(settings);

  if (dueTypes.length === 0) {
    return NextResponse.json({
      ok: true,
      generated: [],
      skipped: options.meetingType
        ? "Executive meeting auto-generation is disabled."
        : "No executive meeting is due in America/New_York for this cron tick.",
      timezone: settings.timezone,
      scheduledMeetingType: options.meetingType ?? null,
    });
  }

  const generated = [];
  for (const meetingType of dueTypes) {
    const result = await generateExecutiveMeeting({
      meetingType,
      actorType: "cron",
      actorUserId: null,
      idempotencyKey: autoIdempotencyKey(meetingType, settings),
    });
    generated.push({
      meetingType,
      ok: result.ok,
      meetingId: result.meetingId ?? null,
      reused: result.reused === true,
      error: result.error ?? null,
      activationStatus: result.meeting?.voiceReadyJson?.activationStatus ?? null,
      joinedAgentCount: result.meeting?.voiceReadyJson?.joinedAgentCount ?? null,
      expectedAgentCount: result.meeting?.voiceReadyJson?.expectedAgentCount ?? null,
    });
  }

  const failed = generated.filter((item) => !item.ok);
  return NextResponse.json(
    {
      ok: failed.length === 0,
      generated,
      timezone: settings.timezone,
      scheduledMeetingType: options.meetingType ?? null,
    },
    { status: failed.length === 0 ? 200 : 500 },
  );
}
