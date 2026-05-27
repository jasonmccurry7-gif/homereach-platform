import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { updateDailyOutreachTask } from "@/lib/daily-outreach/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const task = await updateDailyOutreachTask(id, body, guard.user?.id ?? null);

    if (!task) {
      return NextResponse.json({ error: "Daily outreach task not found" }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error("[daily-outreach/tasks] PATCH failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Daily outreach task update failed" },
      { status: 500 }
    );
  }
}
