import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import {
  fetchTargetedOutreachPlan,
  generateTargetedOutreachPlan,
  updateTargetedOutreachTask,
  type TargetedOutcomeStatus,
} from "@/lib/daily-outreach/targeted-plan";
import { todayKey } from "@/lib/daily-outreach/server";

const OUTCOMES = new Set([
  "New",
  "Contacted",
  "Follow-Up Due",
  "Interested",
  "Needs Quote",
  "Proposal Sent",
  "Won",
  "Lost",
  "Not a Fit",
]);

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? todayKey();
    return NextResponse.json(await fetchTargetedOutreachPlan(date));
  } catch (error) {
    console.error("[daily-targeted-outreach] GET failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Daily targeted outreach load failed" },
      { status: 500 },
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
      return NextResponse.json(await generateTargetedOutreachPlan(date, guard.user?.id ?? null));
    }

    if (action === "update_task" && typeof body.task_id === "string") {
      const outcome = typeof body.outcome_status === "string" && OUTCOMES.has(body.outcome_status)
        ? body.outcome_status as TargetedOutcomeStatus
        : undefined;
      const patch: Parameters<typeof updateTargetedOutreachTask>[1] = {
        completed: body.completed === true,
      };
      if (outcome) patch.outcome_status = outcome;
      if (typeof body.notes === "string") patch.notes = body.notes;
      if ("follow_up_date" in body) patch.follow_up_date = typeof body.follow_up_date === "string" ? body.follow_up_date : null;
      if (typeof body.activity_type === "string") patch.activity_type = body.activity_type;
      if (typeof body.channel === "string") patch.channel = body.channel;
      const task = await updateTargetedOutreachTask(
        body.task_id,
        patch,
        guard.user?.id ?? null,
      );
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
      return NextResponse.json({ ok: true, task, payload: await fetchTargetedOutreachPlan(date) });
    }

    return NextResponse.json({ error: "Unsupported daily targeted outreach action" }, { status: 400 });
  } catch (error) {
    console.error("[daily-targeted-outreach] POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Daily targeted outreach action failed" },
      { status: 500 },
    );
  }
}
