import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { logSocialAction, updateDailySocialPost } from "@/lib/daily-outreach/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    if (typeof body.activity_type === "string") {
      const post = await logSocialAction(id, body.activity_type, guard.user?.id ?? null);
      if (!post) return NextResponse.json({ error: "Social post not found" }, { status: 404 });
      return NextResponse.json({ post });
    }

    const post = await updateDailySocialPost(id, body, guard.user?.id ?? null);
    if (!post) {
      return NextResponse.json({ error: "Social post not found" }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error("[daily-outreach/social] PATCH failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Social post update failed" },
      { status: 500 }
    );
  }
}
