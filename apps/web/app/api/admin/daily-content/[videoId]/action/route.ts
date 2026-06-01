import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { updateDailyVideoStatus } from "@/lib/daily-content/repository";

const allowedActions = new Set(["approve", "reject", "needs_revision", "schedule", "mark_published", "reset"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { videoId } = await params;
  let body: { action?: string; reason?: string; scheduled_at?: string };
  try {
    body = (await req.json()) as { action?: string; reason?: string; scheduled_at?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action ?? "";
  if (!allowedActions.has(action)) {
    return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
  }

  try {
    const video = await updateDailyVideoStatus({
      videoId,
      action: action as "approve" | "reject" | "needs_revision" | "schedule" | "mark_published" | "reset",
      reason: body.reason,
      scheduledAt: body.scheduled_at,
      actorId: guard.user?.id,
    });
    return NextResponse.json({ ok: true, video });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to update daily video" },
      { status: 500 },
    );
  }
}
