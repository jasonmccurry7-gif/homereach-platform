import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { updateDailyPlatformPostStatus } from "@/lib/daily-content/repository";

const allowedActions = new Set(["manual_publish_ready", "schedule", "mark_published", "fail", "reset"]);

type PlatformPostActionBody = {
  action?: string;
  scheduled_at?: string;
  external_url?: string;
  external_post_id?: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string; postId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { videoId, postId } = await params;
  let body: PlatformPostActionBody;
  try {
    body = (await req.json()) as PlatformPostActionBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action ?? "";
  if (!allowedActions.has(action)) {
    return NextResponse.json({ ok: false, error: "Unsupported platform post action" }, { status: 400 });
  }

  try {
    const post = await updateDailyPlatformPostStatus({
      videoId,
      postId,
      action: action as "manual_publish_ready" | "schedule" | "mark_published" | "fail" | "reset",
      scheduledAt: body.scheduled_at,
      externalUrl: body.external_url,
      externalPostId: body.external_post_id,
      actorId: guard.user?.id,
    });
    return NextResponse.json({ ok: true, post });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to update platform post" },
      { status: 400 },
    );
  }
}
