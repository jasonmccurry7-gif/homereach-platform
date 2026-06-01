import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { generateDailyContent, getDailyContentSummary } from "@/lib/daily-content/repository";
import { getContentDate } from "@/lib/daily-content/generator";

export async function GET(req: NextRequest) {
  return handleGenerate(req);
}

export async function POST(req: NextRequest) {
  return handleGenerate(req);
}

async function handleGenerate(req: NextRequest) {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const contentDate = req.nextUrl.searchParams.get("date") ?? getContentDate();
  const forceFresh = req.nextUrl.searchParams.get("fresh") === "1";
  const variationSeed = req.nextUrl.searchParams.get("variation") ?? undefined;

  try {
    const videos = await generateDailyContent(contentDate, { forceFresh, variationSeed });
    const summary = await getDailyContentSummary(contentDate);
    return NextResponse.json({
      ok: true,
      content_date: contentDate,
      fresh: forceFresh,
      generated: videos.length,
      videos,
      summary,
      auto_publish_enabled: false,
      human_approval_required: true,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to generate daily content" },
      { status: 500 },
    );
  }
}
