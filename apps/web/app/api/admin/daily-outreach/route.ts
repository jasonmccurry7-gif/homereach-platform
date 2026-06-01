import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import {
  fetchDailyOutreach,
  generateDailyOutreach,
  importDailyOutreachRows,
  logTaskAction,
  queueDailyOutreachEmail,
  todayKey,
  addManualOutreachProspect,
  updateDailyOutreachCampaignControl,
  updateDailyOutreachSenderControl,
  updateOutreachEmailTemplate,
} from "@/lib/daily-outreach/server";
import type { DailyOutreachSenderKey } from "@/lib/daily-outreach/types";

const SENDER_KEYS = new Set(["heather", "josh", "chelsi", "jason"]);
const CAMPAIGN_TYPES = new Set(["political", "supplyfy"]);

function isSenderKey(value: string): value is DailyOutreachSenderKey {
  return SENDER_KEYS.has(value);
}

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? todayKey();
    const payload = await fetchDailyOutreach(date);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[daily-outreach] GET failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Daily outreach load failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "generate";
    const date = typeof body.date === "string" ? body.date : todayKey();

    if (action === "generate") {
      const payload = await generateDailyOutreach(date, guard.user?.id ?? null);
      return NextResponse.json(payload);
    }

    if (action === "log_task_action" && typeof body.task_id === "string" && typeof body.activity_type === "string") {
      const task = await logTaskAction(
        body.task_id,
        body.activity_type,
        guard.user?.id ?? null,
        typeof body.channel === "string" ? body.channel : null
      );
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
      return NextResponse.json({ ok: true, task });
    }

    if ((action === "queue_email_review" || action === "approve_email_send") && typeof body.task_id === "string") {
      const result = await queueDailyOutreachEmail(
        body.task_id,
        action === "approve_email_send" ? "approve_send" : "queue_review",
        guard.user?.id ?? null
      );
      if (!result) return NextResponse.json({ error: "Task not found" }, { status: 404 });
      const payload = await fetchDailyOutreach(date);
      return NextResponse.json({ ok: true, ...result, payload });
    }

    if (action === "update_sender_control" && typeof body.sender_key === "string") {
      if (!isSenderKey(body.sender_key)) {
        return NextResponse.json({ error: "Unsupported daily outreach sender" }, { status: 400 });
      }
      const control = await updateDailyOutreachSenderControl(
        body.sender_key,
        body.patch && typeof body.patch === "object" ? body.patch : {},
        guard.user?.id ?? null
      );
      const payload = await fetchDailyOutreach(date);
      return NextResponse.json({ ok: true, control, payload });
    }

    if (action === "update_campaign_control" && typeof body.campaign_type === "string") {
      if (!CAMPAIGN_TYPES.has(body.campaign_type)) {
        return NextResponse.json({ error: "Unsupported outreach campaign type" }, { status: 400 });
      }
      const control = await updateDailyOutreachCampaignControl(
        body.campaign_type,
        body.patch && typeof body.patch === "object" ? body.patch : {},
        guard.user?.id ?? null
      );
      const payload = await fetchDailyOutreach(date);
      return NextResponse.json({ ok: true, control, payload });
    }

    if (action === "update_template" && typeof body.template_id === "string") {
      const template = await updateOutreachEmailTemplate(
        body.template_id,
        body.patch && typeof body.patch === "object" ? body.patch : {},
        guard.user?.id ?? null
      );
      const payload = await fetchDailyOutreach(date);
      return NextResponse.json({ ok: true, template, payload });
    }

    if (action === "add_prospect" && body.prospect && typeof body.prospect === "object") {
      const prospect = await addManualOutreachProspect(body.prospect, guard.user?.id ?? null);
      const payload = await fetchDailyOutreach(date);
      return NextResponse.json({ ok: true, prospect, payload });
    }

    if (action === "import_plan" && Array.isArray(body.rows)) {
      const result = await importDailyOutreachRows(
        body.rows,
        typeof body.date === "string" ? body.date : date,
        guard.user?.id ?? null
      );
      const payload = await fetchDailyOutreach(date);
      return NextResponse.json({ ok: true, import: result, payload });
    }

    return NextResponse.json({ error: "Unsupported daily outreach action" }, { status: 400 });
  } catch (error) {
    console.error("[daily-outreach] POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Daily outreach action failed" },
      { status: 500 }
    );
  }
}
