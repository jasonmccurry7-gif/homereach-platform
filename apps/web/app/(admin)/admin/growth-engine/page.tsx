import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isGrowthEngineEnabled } from "@/lib/growth-engine/env";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { GrowthEngineClient, type ApprovedSocialSource } from "./growth-engine-client";

export const metadata: Metadata = {
  title: "Growth Engine - HomeReach Admin",
  description:
    "Internal HomeReach Growth Engine for SEO, content, social, postcard, political, and revenue workflow orchestration.",
};

export default async function GrowthEnginePage() {
  if (!isGrowthEngineEnabled()) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/admin/growth-engine");
  }

  const approvedSocialSources = await loadApprovedSocialSources();

  return <GrowthEngineClient userEmail={user.email ?? "admin"} approvedSocialSources={approvedSocialSources} />;
}

async function loadApprovedSocialSources(): Promise<ApprovedSocialSource[]> {
  const db = createServiceClient();
  const [dailyPosts, aiOutputs] = await Promise.all([
    queryMaybe("daily platform posts", () =>
      db
        .from("daily_video_platform_posts")
        .select("id,video_id,platform,status,caption,recommended_posting_time,daily_video_content!inner(id,title,approval_status,status,content_date)")
        .in("status", ["approved", "manual_publish_ready", "scheduled"])
        .order("created_at", { ascending: false })
        .limit(20),
    ),
    queryMaybe("approved AI outputs", () =>
      db
        .from("ai_outputs")
        .select("id,title,content,workflow,output_type,created_at")
        .eq("approval_status", "approved")
        .eq("verification_status", "verified")
        .order("created_at", { ascending: false })
        .limit(20),
    ),
  ]);

  const postSources = dailyPosts.data.flatMap((row) => {
    const video = row.daily_video_content as { title?: string; approval_status?: string; content_date?: string } | null;
    if (video?.approval_status !== "approved") return [];
    return [{
      id: `daily:${String(row.id)}`,
      type: "daily_video_platform_post" as const,
      label: `${video.title ?? "Daily video"} - ${String(row.platform ?? "social")}`,
      detail: `${String(row.status ?? "approved")} - ${String(row.recommended_posting_time ?? "no time set")}`,
      dailyVideoId: String(row.video_id),
      platformPostId: String(row.id),
      platform: String(row.platform ?? "linkedin"),
      text: String(row.caption ?? ""),
    }];
  });

  const aiSources = aiOutputs.data.map((row) => ({
    id: `ai:${String(row.id)}`,
    type: "ai_output" as const,
    label: String(row.title ?? "Approved AI output"),
    detail: `${String(row.workflow ?? "AI Assets")} - ${String(row.output_type ?? "draft")}`,
    aiOutputId: String(row.id),
    platform: "linkedin",
    text: String(row.content ?? ""),
  }));

  return [...postSources, ...aiSources].slice(0, 30);
}

async function queryMaybe<T extends Record<string, unknown>[]>(
  label: string,
  run: () => PromiseLike<{ data: T | null; error: { message?: string; code?: string } | null }>,
): Promise<{ data: T; error: string | null }> {
  try {
    const result = await run();
    if (result.error) return { data: [] as unknown as T, error: `${label}: ${result.error.message ?? result.error.code}` };
    return { data: (result.data ?? []) as T, error: null };
  } catch (error) {
    return { data: [] as unknown as T, error: `${label}: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}
