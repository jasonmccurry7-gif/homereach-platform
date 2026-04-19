// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Content Intelligence Pipeline Orchestrator
//
// Runs once per scheduled trigger:
//   1. Load active topics + trusted channels + ingestion rules
//   2. For today's rotated category subset + every forced-include channel:
//        search YouTube → score → dedup against ci_ingestion_queue
//   3. Cap total candidates at CONTENT_INTEL_DAILY_CAP (default 15)
//   4. Fetch transcripts; skip videos without transcripts
//   5. Extract insights (Claude Haiku). For translate_saas channels, translate.
//   6. APEX filter (>=15), persist surviving insights
//   7. Generate capped artifacts (3 actions / 2 scripts / 1 offer / 1 auto / 1 enh)
//   8. Write everything; mark queue rows processed
//
// Returns a run summary the cron endpoint forwards as JSON.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/service";
import { getDailyVideoCap, isContentIntelAiDisabled } from "./env";
import { fetchTranscript } from "./transcripts";
import { extractInsights } from "./extractor";
import { translateInsight } from "./translator";
import { filterByApex, generateArtifacts, type FilteredInsight } from "./apex-filter";
import { scoreVideo } from "./scorer";
import { searchYouTube, type YTVideoCandidate } from "./youtube";
import { resolveChannelCategory } from "./categories";

type Supa = ReturnType<typeof createServiceClient>;

export type PipelineSummary = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  categoriesProcessed: string[];
  candidatesSearched: number;
  candidatesScored: number;
  candidatesQueued: number;
  transcriptsFetched: number;
  insightsExtracted: number;
  insightsAfterApex: number;
  artifacts: { actions: number; scripts: number; offers: number; automations: number; enhancements: number };
  skippedReasons: Record<string, number>;
  errors: string[];
};

/** 6 verticals rotated so we don't exceed the daily cap (6*3=18 > 15). */
const VERTICAL_ROTATION: Record<number, string[]> = {
  // day-of-week (0=Sun…6=Sat) → categories to search (Dan Martell always added)
  0: ["pressure_washing", "lawn_care", "window_cleaning"],
  1: ["pressure_washing", "lawn_care", "gutter_cleaning"],
  2: ["pressure_washing", "pest_control",  "roofing"],
  3: ["lawn_care",        "window_cleaning","gutter_cleaning"],
  4: ["pressure_washing", "gutter_cleaning","pest_control"],
  5: ["lawn_care",        "window_cleaning","roofing"],
  6: ["pest_control",     "roofing",       "gutter_cleaning"],
};

export async function runPipeline(): Promise<PipelineSummary> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const skippedReasons: Record<string, number> = {};
  const supa: Supa = createServiceClient();

  // ── 1) Load config ─────────────────────────────────────────────────────────
  const [rulesResp, topicsResp, channelsResp] = await Promise.all([
    supa.from("ci_ingestion_rules").select("*").eq("id", "default").maybeSingle(),
    supa.from("ci_category_topics").select("*").eq("active_flag", true),
    supa.from("ci_trusted_channels").select("*"),
  ]);
  const rules = rulesResp.data ?? {
    min_recency_days: 60, max_videos_per_cat: 3, min_relevance_score: 3.5,
    require_transcript: true, daily_video_cap: 15, exclude_keywords: [] as string[],
  };
  const topics = topicsResp.data ?? [];
  const channels = channelsResp.data ?? [];
  const dailyCap = Math.min(getDailyVideoCap(), Number(rules.daily_video_cap ?? 15));

  const trustedChannelIds = new Set<string>(channels.filter((c: any) => c.channel_id).map((c: any) => c.channel_id));
  const trustedChannelNames = new Set<string>(channels.map((c: any) => String(c.channel_name).trim().toLowerCase()));
  const channelTrustMap = new Map<string, number>();
  for (const c of channels) {
    channelTrustMap.set(String(c.channel_name).trim().toLowerCase(), Number(c.trust_score ?? 3));
    if (c.channel_id) channelTrustMap.set(c.channel_id, Number(c.trust_score ?? 3));
  }
  const translateChannelIds = new Set<string>(
    channels.filter((c: any) => c.translate_saas && c.channel_id).map((c: any) => c.channel_id),
  );
  const translateChannelNames = new Set<string>(
    channels.filter((c: any) => c.translate_saas).map((c: any) => String(c.channel_name).trim().toLowerCase()),
  );

  // ── 2) Rotate categories for today ─────────────────────────────────────────
  const today = new Date().getUTCDay();
  const rotation = VERTICAL_ROTATION[today] ?? [];
  const categoriesProcessed = Array.from(new Set(rotation));

  // ── 3) Search YouTube per (category, top topic) + Dan Martell forced ───────
  const sinceIso = new Date(Date.now() - Number(rules.min_recency_days ?? 60) * 86_400_000).toISOString();
  const candidates: Array<YTVideoCandidate & { category: string; isForced: boolean; score: number }> = [];
  let searched = 0;

  // Per-category: pick top 2 topics by priority → search each with maxResults=5
  for (const category of categoriesProcessed) {
    const catTopics = topics
      .filter((t: any) => t.category === category)
      .sort((a: any, b: any) => Number(b.priority_score) - Number(a.priority_score))
      .slice(0, 2);
    for (const topic of catTopics) {
      try {
        const results = await searchYouTube({
          query: topic.search_term,
          publishedAfter: sinceIso,
          maxResults: 5,
        });
        searched += results.length;
        for (const r of results) {
          const score = scoreVideo({
            video: r,
            category,
            categoryKeywords: catTopics.map((t: any) => t.search_term.split(/\s+/)[0]),
            excludeKeywords: (rules.exclude_keywords as string[]) ?? [],
            trustedChannelIds, trustedChannelNames, channelTrustMap,
          });
          if (score.total < Number(rules.min_relevance_score ?? 3.5)) {
            bump(skippedReasons, "score_too_low"); continue;
          }
          candidates.push({ ...r, category, isForced: false, score: score.total });
        }
      } catch (err: any) {
        errors.push(`search(${category}/${topic.search_term}): ${err?.message ?? String(err)}`);
      }
    }
  }

  // Forced-include channels (Dan Martell + guest appearances)
  for (const ch of channels.filter((c: any) => c.force_include)) {
    try {
      const results = await searchYouTube({
        query: ch.channel_id ? "" : ch.channel_name, // if we have a channelId we constrain by it
        channelId: ch.channel_id || undefined,
        publishedAfter: sinceIso,
        maxResults: 5,
      });
      searched += results.length;
      for (const r of results) {
        const score = scoreVideo({
          video: r,
          category: resolveChannelCategory(ch.category),
          categoryKeywords: ["sales", "lead", "pricing", "retention", "scaling"],
          excludeKeywords: (rules.exclude_keywords as string[]) ?? [],
          trustedChannelIds, trustedChannelNames, channelTrustMap,
        });
        if (score.total < Number(rules.min_relevance_score ?? 3.5)) {
          // Forced-include bypasses the min score for Dan Martell
          if (!ch.force_include) { bump(skippedReasons, "score_too_low_forced"); continue; }
        }
        candidates.push({
          ...r,
          category: resolveChannelCategory(ch.category),
          isForced: true,
          score: score.total,
        });
      }
    } catch (err: any) {
      errors.push(`search(forced:${ch.channel_name}): ${err?.message ?? String(err)}`);
    }
  }

  // ── 4) Dedup + cap ─────────────────────────────────────────────────────────
  const byId = new Map<string, (typeof candidates)[number]>();
  for (const c of candidates) {
    const existing = byId.get(c.videoId);
    if (!existing || c.score > existing.score || (!existing.isForced && c.isForced)) {
      byId.set(c.videoId, c);
    }
  }
  const unique = Array.from(byId.values());

  // Dedup against ci_ingestion_queue (never re-ingest)
  const ids = unique.map((u) => u.videoId);
  let alreadySeen = new Set<string>();
  if (ids.length) {
    const { data: seen } = await supa.from("ci_ingestion_queue").select("video_id").in("video_id", ids);
    alreadySeen = new Set((seen ?? []).map((r: any) => r.video_id));
  }
  const fresh = unique.filter((u) => !alreadySeen.has(u.videoId));

  // Take top by score, forced first, then slice to dailyCap
  fresh.sort((a, b) => (Number(b.isForced) - Number(a.isForced)) || (b.score - a.score));
  const picked = fresh.slice(0, dailyCap);

  // ── 5) Persist queue rows (status='scored') ────────────────────────────────
  if (picked.length) {
    await supa.from("ci_ingestion_queue").insert(
      picked.map((p) => ({
        video_id: p.videoId,
        title: p.title,
        description: p.description,
        channel_id: p.channelId,
        channel_name: p.channelName,
        category: p.category,
        published_at: p.publishedAt || null,
        relevance_score: p.score,
        channel_trust: channelTrustMap.get(p.channelId) ?? channelTrustMap.get(p.channelName.toLowerCase()) ?? 2,
        status: "scored",
        is_forced_include: p.isForced,
      })),
    );
  }

  // ── 6) Transcripts + 7) Extract + 8) Filter + 9) Artifacts ────────────────
  let transcriptsFetched = 0;
  let insightsExtracted = 0;
  let insightsAfterApex = 0;
  const artifacts = { actions: 0, scripts: 0, offers: 0, automations: 0, enhancements: 0 };
  const aiOff = isContentIntelAiDisabled();

  for (const p of picked) {
    const t = await fetchTranscript(p.videoId);
    if (!t || (rules.require_transcript && !t.text)) {
      await supa.from("ci_ingestion_queue")
        .update({ status: "skipped", skip_reason: "no_transcript", processed_at: new Date().toISOString() })
        .eq("video_id", p.videoId);
      bump(skippedReasons, "no_transcript");
      continue;
    }
    transcriptsFetched++;
    await supa.from("ci_ingestion_queue")
      .update({ status: "transcribed", transcript: t.text, transcript_source: t.source })
      .eq("video_id", p.videoId);

    if (aiOff) continue; // UI-only mode: stop here

    const ext = await extractInsights({ category: p.category, videoTitle: p.title, transcript: t.text });
    if (!ext.ok) {
      await supa.from("ci_ingestion_queue")
        .update({ status: "failed", skip_reason: ext.error, processed_at: new Date().toISOString() })
        .eq("video_id", p.videoId);
      errors.push(`extract(${p.videoId}): ${ext.error}`);
      bump(skippedReasons, "extract_failed");
      continue;
    }
    insightsExtracted += ext.insights.length;

    const isTranslateChannel =
      translateChannelIds.has(p.channelId) ||
      translateChannelNames.has(p.channelName.trim().toLowerCase());

    const rawInsights = isTranslateChannel
      ? await Promise.all(ext.insights.map(translateInsight))
      : ext.insights;

    const filtered: FilteredInsight[] = rawInsights.map((i) => ({
      ...i,
      apex_score: i.revenue_score + i.speed_score + i.ease_score + i.advantage_score,
      is_translated: isTranslateChannel,
      source_video_id: p.videoId,
      category: p.category,
    }));
    const surviving = filterByApex(filtered);
    insightsAfterApex += surviving.length;

    if (surviving.length === 0) {
      await supa.from("ci_ingestion_queue")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("video_id", p.videoId);
      continue;
    }

    // Insert insights
    const { data: insertedIns } = await supa
      .from("ci_insights")
      .insert(
        surviving.map((i) => ({
          source_video_id: i.source_video_id,
          category: i.category,
          theme: i.theme,
          insight_text: i.insight_text,
          rationale: i.rationale,
          revenue_score: i.revenue_score,
          speed_score: i.speed_score,
          ease_score: i.ease_score,
          advantage_score: i.advantage_score,
          is_translated: i.is_translated,
          status: "pending",
        })),
      )
      .select("id, insight_text");

    const ranked = (insertedIns ?? []).map((row: any, idx: number) => ({
      ...surviving[idx],
      id: row.id as string,
    }));

    const gen = generateArtifacts(ranked);
    if (gen.actions.length)      await supa.from("ci_actions").insert(gen.actions);
    if (gen.scripts.length)      await supa.from("ci_scripts").insert(gen.scripts);
    if (gen.offers.length)       await supa.from("ci_offers").insert(gen.offers);
    if (gen.automations.length)  await supa.from("ci_automations").insert(gen.automations);
    if (gen.enhancements.length) await supa.from("ci_enhancements").insert(gen.enhancements);
    artifacts.actions      += gen.actions.length;
    artifacts.scripts      += gen.scripts.length;
    artifacts.offers       += gen.offers.length;
    artifacts.automations  += gen.automations.length;
    artifacts.enhancements += gen.enhancements.length;

    await supa.from("ci_ingestion_queue")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("video_id", p.videoId);
  }

  return {
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    categoriesProcessed,
    candidatesSearched: searched,
    candidatesScored: unique.length,
    candidatesQueued: picked.length,
    transcriptsFetched,
    insightsExtracted,
    insightsAfterApex,
    artifacts,
    skippedReasons,
    errors,
  };
}

function bump(rec: Record<string, number>, key: string) {
  rec[key] = (rec[key] ?? 0) + 1;
}
