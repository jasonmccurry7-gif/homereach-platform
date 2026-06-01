import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { runCanvaAutofill, type HomeReachCanvaJobInput } from "@/lib/canva/orchestrator";
import { saveCanvaJobResult } from "@/lib/daily-content/repository";
import { createServiceClient } from "@/lib/supabase/service";
import type { DailyVideoContentRow } from "@/lib/daily-content/types";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const guard = await requireAdmin();
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
  const input: HomeReachCanvaJobInput = {
    context: "social_video",
    templateKey: "social_reel_video",
    title: video.title,
    fields: {
      ...video.canva_fields,
      hook: video.video_hook,
      cta: video.primary_cta,
      video_title: video.title,
      format: "Vertical 9:16, 15-30 seconds",
      full_prompt: video.canva_prompt,
    },
    exportTypes: ["mp4", "png"],
    source: {
      system: "daily_content_center",
      recordId: video.id,
      route: "/admin/daily-content",
    },
  };

  try {
    const result = await runCanvaAutofill(input);
    await saveCanvaJobResult(video.id, result as Record<string, unknown>);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare Canva job";
    await saveCanvaJobResult(video.id, { ok: false, error: message, input });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
