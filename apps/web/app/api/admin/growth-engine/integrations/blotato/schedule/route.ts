import { NextRequest, NextResponse } from "next/server";
import { isGrowthEngineEnabled } from "@/lib/growth-engine/env";
import { scheduleBlotatoPost } from "@/lib/growth-engine/integrations";
import type { SocialPublishSource } from "@/lib/social-content/publish-guard";
import { requireAdmin } from "@/lib/seo/guards";

export async function POST(request: NextRequest) {
  if (!isGrowthEngineEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin.response;
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const source = resolveSocialPublishSource(input);
  const result = await scheduleBlotatoPost({
    accountId: typeof input.accountId === "string" ? input.accountId : undefined,
    pageId: typeof input.pageId === "string" ? input.pageId : undefined,
    platform: typeof input.platform === "string" ? input.platform : undefined,
    text: typeof input.text === "string" ? input.text : undefined,
    mediaUrls: Array.isArray(input.mediaUrls) ? input.mediaUrls.filter((item): item is string => typeof item === "string") : undefined,
    scheduledTime: typeof input.scheduledTime === "string" ? input.scheduledTime : undefined,
    useNextFreeSlot: typeof input.useNextFreeSlot === "boolean" ? input.useNextFreeSlot : undefined,
    approved: input.approved === true,
    dryRun: input.dryRun !== false,
    actorId: admin.adminId,
    source,
  });

  return NextResponse.json(result, {
    status: result.ok ? 200 : 409,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function resolveSocialPublishSource(input: Record<string, unknown>): SocialPublishSource | undefined {
  const dailyVideoId = typeof input.dailyVideoId === "string" ? input.dailyVideoId : undefined;
  const platformPostId = typeof input.platformPostId === "string" ? input.platformPostId : undefined;
  if (dailyVideoId && platformPostId) {
    return { type: "daily_video_platform_post", videoId: dailyVideoId, postId: platformPostId };
  }

  const aiOutputId = typeof input.aiOutputId === "string" ? input.aiOutputId : undefined;
  if (aiOutputId) return { type: "ai_output", outputId: aiOutputId };

  return undefined;
}
