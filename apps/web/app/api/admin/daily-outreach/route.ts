import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { fetchDailyOutreach, generateDailyOutreach, logTaskAction, todayKey } from "@/lib/daily-outreach/server";

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

    return NextResponse.json({ error: "Unsupported daily outreach action" }, { status: 400 });
  } catch (error) {
    console.error("[daily-outreach] POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Daily outreach action failed" },
      { status: 500 }
    );
  }
}
