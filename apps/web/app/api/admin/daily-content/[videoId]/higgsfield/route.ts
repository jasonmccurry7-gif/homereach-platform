import { NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { renderDailyVideoWithHiggsfield } from "@/lib/daily-content/higgsfield";
import { saveHiggsfieldRenderResult } from "@/lib/daily-content/repository";
import { createServiceClient } from "@/lib/supabase/service";
import type { DailyVideoContentRow } from "@/lib/daily-content/types";

export const maxDuration = 300;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const { videoId } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("daily_video_content")
    .select("*")
    .eq("id", videoId)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
  }

  const video = data as DailyVideoContentRow;
  const result = await renderDailyVideoWithHiggsfield(video);
  await saveHiggsfieldRenderResult(video.id, result);

  if (!result.ok && !result.dryRun) {
    return NextResponse.json({ ok: false, error: result.error ?? "Higgsfield render failed", result }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result });
}
