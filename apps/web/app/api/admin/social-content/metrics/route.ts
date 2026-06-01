import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { upsertSocialContentMetrics } from "@/lib/social-content/metrics";

export async function POST(req: NextRequest) {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const platform = asString(body.platform);
  if (!platform) {
    return NextResponse.json({ ok: false, error: "platform is required" }, { status: 400 });
  }

  try {
    const result = await upsertSocialContentMetrics({
      publicationId: asString(body.publicationId),
      videoId: asString(body.videoId),
      platformPostId: asString(body.platformPostId),
      platform,
      metricDate: asString(body.metricDate),
      views: asNumber(body.views),
      reach: asNumber(body.reach),
      impressions: asNumber(body.impressions),
      likes: asNumber(body.likes),
      comments: asNumber(body.comments),
      shares: asNumber(body.shares),
      saves: asNumber(body.saves),
      watchTimeSeconds: asNumber(body.watchTimeSeconds),
      averageWatchTimeSeconds: asNumber(body.averageWatchTimeSeconds),
      retentionRate: asNumber(body.retentionRate),
      completionRate: asNumber(body.completionRate),
      clicks: asNumber(body.clicks),
      dmsGenerated: asNumber(body.dmsGenerated),
      leadsGenerated: asNumber(body.leadsGenerated),
      conversionsGenerated: asNumber(body.conversionsGenerated),
      estimatedRevenue: asNumber(body.estimatedRevenue),
      externalUrl: asString(body.externalUrl),
      externalPostId: asString(body.externalPostId),
      rawMetrics: asRecord(body.rawMetrics),
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to import social content metrics" },
      { status: 500 },
    );
  }
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
