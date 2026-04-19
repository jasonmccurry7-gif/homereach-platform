// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Content Intelligence Pipeline Orchestrator
//
// Runs once per scheduled trigger.
//
// Two ingestion rounds:
//   ROUND A — Source channels: rotated verticals from ci_category_topics +
//             forced-include trusted channels (Dan Martell). Produces
//             insights → execution artifacts.
//   ROUND B — Competitor channels: each active ci_competitor_sources row
//             with content_source containing 'youtube'. Produces
//             ci_competitor_insights (no artifacts; admin review only).
//
// Critical design:
//   • Artifacts (actions/scripts/offers/automations/enhancements) are
//     generated ONCE per run at the end, from the pooled + ranked insights.
//     Strict cap: 3/2/1/1/1 per run (matches spec).
//   • Competitor insights are filtered by APEX but do NOT produce artifacts.
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
  competitors: {
    sourcesProcessed: number;
    videosFetched: number;
    insightsExtracted: number;
    insightsAfterApex: number;
  };
  skippedReasons: Record<string, number>;
  errors: string[];
};

const VERTICAL_ROTATION: Record<number, string[]> = {
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
  const [rulesResp, topicsResp, channelsResp, competitorsResp] = await Promise.all([
    supa.from("ci_ingestion_rules").select("*").eq("id", "default").maybeSingle(),
    supa.from("ci_category_topics").select("*").eq("active_flag", true),
    supa.from("ci_trusted_channels").select("*").eq("active_flag", true),
    supa.from("ci_competitor_sources").select("*").eq("active_flag", true),
  ]);
  const rules = rulesResp.data ?? {
    min_recency_days: 60, max_videos_per_cat: 3, min_relevance_score: 3.5,
    require_transcript: true, daily_video_cap: 15, exclude_keywords: [] as string[],
  };
  const topics = topicsResp.data ?? [];
  const channels = channelsResp.data ?? [];
  const competitors = competitorsResp.data ?? [];
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
  type SourceCandidate = YTVideoCandidate & { category: string; isForced: boolean; score: number };
  const sourceCandidates: SourceCandidate[] = [];
  let searched = 0;

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
          sourceCandidates.push({ ...r, category, isForced: false, score: score.total });
        }
      } catch (err: any) {
        errors.push(`search(${category}/${topic.search_term}): ${err?.message ?? String(err)}`);
      }
    }
  }

  for (const ch of channels.filter((c: any) => c.force_include)) {
    try {
      const results = await searchYouTube({
        query: ch.channel_id ? "" : ch.channel_name,
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
        if (score.total < Number(rules.min_relevance_score ?? 3.5) && !ch.force_include) {
          bump(skippedReasons, "score_too_low_forced"); continue;
        }
        sourceCandidates.push({
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
  const byId = new Map<string, SourceCandidate>();
  for (const c of sourceCandidates) {
    const existing = byId.get(c.videoId);
    if (!existing || c.score > existing.score || (!existing.isForced && c.isForced)) {
      byId.set(c.videoId, c);
    }
  }
  const unique = Array.from(byId.values());

  const ids = unique.map((u) => u.videoId);
  let alreadySeen = new Set<string>();
  if (ids.length) {
    const { data: seen } = await supa.from("ci_ingestion_queue").select("video_id").in("video_id", ids);
    alreadySeen = new Set((seen ?? []).map((r: any) => r.video_id));
  }
  const fresh = unique.filter((u) => !alreadySeen.has(u.videoId));

  fresh.sort((a, b) => (Number(b.isForced) - Number(a.isForced)) || (b.score - a.score));
  const picked = fresh.slice(0, dailyCap);

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

  // ── 5-7) Per-video: transcribe → extract → translate → APEX filter ─────────
  // ── but POOL insights for later single artifact generation ────────────────
  let transcriptsFetched = 0;
  let insightsExtracted = 0;
  let insightsAfterApex = 0;
  const aiOff = isContentIntelAiDisabled();

  // Global pool of filtered insights (with DB ids) across ALL videos this run
  const allRankedInsights: Array<FilteredInsight & { id: string }> = [];

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

    if (aiOff) continue;

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

    // Insert insights (still per-video, because apex_score is GENERATED ALWAYS
    // and requires persisted rows to get ids back)
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
      .select("id");

    // Collect into the GLOBAL pool (not yet turned into artifacts)
    (insertedIns ?? []).forEach((row: any, idx: number) => {
      allRankedInsights.push({ ...surviving[idx], id: row.id as string });
    });

    await supa.from("ci_ingestion_queue")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("video_id", p.videoId);
  }

  // ── 8) SINGLE pooled artifact generation — strict per-run cap (3/2/1/1/1) ──
  allRankedInsights.sort((a, b) => b.apex_score - a.apex_score);
  const artifacts = { actions: 0, scripts: 0, offers: 0, automations: 0, enhancements: 0 };
  if (allRankedInsights.length > 0) {
    const gen = generateArtifacts(allRankedInsights);
    if (gen.actions.length)      await supa.from("ci_actions").insert(gen.actions);
    if (gen.scripts.length)      await supa.from("ci_scripts").insert(gen.scripts);
    if (gen.offers.length)       await supa.from("ci_offers").insert(gen.offers);
    if (gen.automations.length)  await supa.from("ci_automations").insert(gen.automations);
    if (gen.enhancements.length) await supa.from("ci_enhancements").insert(gen.enhancements);
    artifacts.actions      = gen.actions.length;
    artifacts.scripts      = gen.scripts.length;
    artifacts.offers       = gen.offers.length;
    artifacts.automations  = gen.automations.length;
    artifacts.enhancements = gen.enhancements.length;
  }

  // ── 9) ROUND B — competitor ingestion (YouTube-only in V1) ────────────────
  const compStats = await runCompetitorRound({
    supa, competitors, rules, sinceIso,
    trustedChannelIds, trustedChannelNames, channelTrustMap,
    aiOff, errors, skippedReasons,
  });

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
    competitors: compStats,
    skippedReasons,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Competitor round
// ─────────────────────────────────────────────────────────────────────────────
async function runCompetitorRound(args: {
  supa: Supa;
  competitors: any[];
  rules: any;
  sinceIso: string;
  trustedChannelIds: Set<string>;
  trustedChannelNames: Set<string>;
  channelTrustMap: Map<string, number>;
  aiOff: boolean;
  errors: string[];
  skippedReasons: Record<string, number>;
}): Promise<{ sourcesProcessed: number; videosFetched: number; insightsExtracted: number; insightsAfterApex: number }> {
  const { supa, competitors, sinceIso, aiOff, errors, skippedReasons } = args;
  let sourcesProcessed = 0;
  let videosFetched = 0;
  let insightsExtracted = 0;
  let insightsAfterApex = 0;

  // Include any competitor marked for youtube. Cap at 5 per run, rotate by
  // oldest-processed-first so all 20 cycle through over ~4 days. Keeps a run
  // comfortably under Vercel's 300s serverless cap.
  const COMPETITORS_PER_RUN = 5;
  const ytCompetitors = competitors
    .filter((c: any) => Array.isArray(c.content_source) && c.content_source.includes("youtube"))
    .sort((a: any, b: any) => {
      // priority desc, then oldest last_ingested_at first (nulls first = never-processed wins)
      const p = Number(b.priority_score) - Number(a.priority_score);
      if (p !== 0) return p;
      const ai = a.last_ingested_at ? Date.parse(a.last_ingested_at) : 0;
      const bi = b.last_ingested_at ? Date.parse(b.last_ingested_at) : 0;
      return ai - bi;
    })
    .slice(0, COMPETITORS_PER_RUN);

  for (const c of ytCompetitors) {
    sourcesProcessed++;
    try {
      const results = await searchYouTube({
        query: c.youtube_channel_id ? "" : (c.youtube_handle || c.name),
        channelId: c.youtube_channel_id || undefined,
        publishedAfter: sinceIso,
        maxResults: 3,
      });
      videosFetched += results.length;

      // Process this competitor's videos in parallel — each video is ~10-15s
      // sequentially (transcript + Claude); parallel cuts that to a single
      // video's worth of latency per competitor.
      const processVideo = async (v: (typeof results)[number]) => {
        const { data: seen } = await supa.from("ci_ingestion_queue").select("video_id").eq("video_id", v.videoId).maybeSingle();
        if (seen) return;

        const t = await fetchTranscript(v.videoId);
        if (!t) { bump(skippedReasons, "competitor_no_transcript"); return; }
        if (aiOff) return;

        const ext = await extractCompetitorInsights({
          category: c.category === "*" ? "competitor" : c.category,
          videoTitle: v.title,
          transcript: t.text,
          competitorName: c.name,
          competitorType: c.competitor_type,
        });
        if (!ext.ok) {
          errors.push(`competitor_extract(${v.videoId}): ${ext.error}`);
          bump(skippedReasons, "competitor_extract_failed");
          return;
        }
        insightsExtracted += ext.insights.length;

        const kept = ext.insights.filter(
          (i) => i.revenue_score + i.speed_score + i.ease_score + i.advantage_score >= 15,
        );
        insightsAfterApex += kept.length;

        if (kept.length) {
          await supa.from("ci_competitor_insights").insert(
            kept.map((i) => ({
              competitor_id: c.id,
              competitor_name: c.name,
              category: c.category === "*" ? "competitor" : c.category,
              insight_type: i.insight_type,
              insight_text: i.insight_text,
              rationale: i.rationale,
              source_url: `https://www.youtube.com/watch?v=${v.videoId}`,
              source_video_id: null,
              revenue_score: i.revenue_score,
              speed_score: i.speed_score,
              ease_score: i.ease_score,
              advantage_score: i.advantage_score,
              status: "pending",
            })),
          );
        }
      };

      // Run all of this competitor's videos concurrently
      await Promise.all(results.map(processVideo));

      // Update last_ingested_at
      await supa.from("ci_competitor_sources")
        .update({ last_ingested_at: new Date().toISOString() })
        .eq("id", c.id);
    } catch (err: any) {
      errors.push(`competitor(${c.name}): ${err?.message ?? String(err)}`);
    }
  }

  return { sourcesProcessed, videosFetched, insightsExtracted, insightsAfterApex };
}

// ── Competitor insight extractor (separate from regular extractor to tag type)
type CompetitorInsight = {
  insight_type: "offer" | "messaging" | "funnel" | "pricing" | "positioning" | "tactic";
  insight_text: string;
  rationale: string;
  revenue_score: number;
  speed_score: number;
  ease_score: number;
  advantage_score: number;
};

async function extractCompetitorInsights(args: {
  category: string;
  videoTitle: string;
  transcript: string;
  competitorName: string;
  competitorType: string | null;
}): Promise<{ ok: true; insights: CompetitorInsight[] } | { ok: false; error: string }> {
  const { getAnthropicKey, getExtractorModel } = await import("./env");
  const SYSTEM = `You are HomeReach's competitor intelligence extractor.
You read a YouTube transcript from a competitor (${args.competitorName}, type: ${args.competitorType ?? "unknown"}).
Extract 3-8 tactical insights HomeReach can adapt. Focus on:
  - offers they're running (free quote, guarantees, bundles, discounts)
  - messaging angles (pain points they target, hooks they use)
  - funnel steps (lead magnet → call → close)
  - pricing structures (flat, tiered, subscription)
  - positioning (what they claim makes them different)
  - tactics (specific moves: door knocking, paid ads, referral, retention)

STRICT RULES:
- NO fluff, NO brand worship, NO generic advice.
- Each insight must be concrete and TRANSFERABLE to HomeReach.
- Classify each insight as one of: offer, messaging, funnel, pricing, positioning, tactic.
- Score each 1-5 on: revenue, speed, ease, advantage. Be strict.

Respond with ONLY valid JSON:
{"insights":[{"insight_type":"offer|messaging|funnel|pricing|positioning|tactic","insight_text":"...","rationale":"...","revenue_score":1-5,"speed_score":1-5,"ease_score":1-5,"advantage_score":1-5}]}`;

  const transcript = args.transcript.length > 40_000 ? args.transcript.slice(0, 40_000) : args.transcript;
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": getAnthropicKey(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: getExtractorModel(),
        // 2500 tokens ≈ 8000 chars — enough room for 8 insights without truncation.
        max_tokens: 2500,
        system: SYSTEM,
        messages: [{ role: "user", content: `Video title: ${args.videoTitle}\n\nTranscript:\n${transcript}\n\nReturn JSON only.` }],
      }),
    });
  } catch (err: any) {
    return { ok: false, error: `network: ${err?.message ?? String(err)}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `http ${res.status}: ${text.slice(0, 200)}` };
  }

  const json = (await res.json().catch(() => null)) as any;
  if (!json) return { ok: false, error: "non-json response" };
  const text = (json.content || [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join("")
    .trim();

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, error: "no JSON in response" };
    try { parsed = JSON.parse(m[0]); }
    catch (e: any) { return { ok: false, error: `parse: ${e?.message ?? "bad json"}` }; }
  }
  if (!parsed || !Array.isArray(parsed.insights)) return { ok: false, error: "missing insights array" };

  const valid = new Set(["offer", "messaging", "funnel", "pricing", "positioning", "tactic"]);
  const insights: CompetitorInsight[] = parsed.insights
    .filter((i: any) =>
      typeof i?.insight_text === "string" &&
      valid.has(i?.insight_type) &&
      Number.isFinite(i?.revenue_score) && Number.isFinite(i?.speed_score) &&
      Number.isFinite(i?.ease_score) && Number.isFinite(i?.advantage_score),
    )
    .slice(0, 8)
    .map((i: any) => ({
      insight_type: i.insight_type,
      insight_text: String(i.insight_text).slice(0, 800),
      rationale: String(i.rationale ?? "").slice(0, 500),
      revenue_score: clamp(i.revenue_score),
      speed_score: clamp(i.speed_score),
      ease_score: clamp(i.ease_score),
      advantage_score: clamp(i.advantage_score),
    }));

  return { ok: true, insights };
}

function clamp(n: any): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.min(5, Math.round(v)));
}

function bump(rec: Record<string, number>, key: string) {
  rec[key] = (rec[key] ?? 0) + 1;
}
