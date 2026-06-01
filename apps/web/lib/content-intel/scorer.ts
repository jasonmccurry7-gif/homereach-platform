// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Video Relevance Scorer
//
// Deterministic, no-LLM 1..5 score to decide which videos are worth the
// transcript-fetch + Claude-extract cost. Scored before transcripts are
// fetched. Fast and free.
//
// Axes (1..5 each): category match, tactical usefulness, revenue relevance,
// recency, channel trust. Average × weights → final score (1..5).
// ─────────────────────────────────────────────────────────────────────────────

import type { YTVideoCandidate } from "./youtube";

export type ScoreInput = {
  video: YTVideoCandidate;
  category: string;
  categoryKeywords: string[];   // from ci_category_topics
  tacticalKeywords?: string[];  // override; defaults below
  revenueKeywords?: string[];
  excludeKeywords: string[];    // from ci_ingestion_rules
  trustedChannelIds: Set<string>;
  trustedChannelNames: Set<string>;
  channelTrustMap: Map<string, number>; // name → 1..5
  nowMs?: number;
};

const DEFAULT_TACTICAL = [
  "how to", "step by step", "script", "playbook", "objection",
  "close", "framework", "checklist", "tactic", "process",
];
const DEFAULT_REVENUE = [
  "revenue", "sales", "lead", "leads", "pricing", "price", "offer",
  "retention", "ltv", "conversion", "close rate", "pipeline", "deal",
  "upsell", "cross-sell", "mrr", "arr", "cac", "roi",
];

export type Score = {
  category: number;
  tactical: number;
  revenue: number;
  recency: number;
  trust: number;
  total: number;       // 1..5, rounded to 1 decimal
  excludeHit: boolean;
};

export function scoreVideo(input: ScoreInput): Score {
  const haystack = (input.video.title + " " + input.video.description).toLowerCase();
  const now = input.nowMs ?? Date.now();

  // Exclusion keywords: instant zero-out
  const excludeHit = input.excludeKeywords.some((k) => k && haystack.includes(k.toLowerCase()));

  const category = scoreKeywords(haystack, input.categoryKeywords);
  const tactical = scoreKeywords(haystack, input.tacticalKeywords ?? DEFAULT_TACTICAL);
  const revenue  = scoreKeywords(haystack, input.revenueKeywords  ?? DEFAULT_REVENUE);

  // Recency: published within min_recency_days (90 default) → 5 → decay
  let recency = 1;
  const published = Date.parse(input.video.publishedAt || "");
  if (Number.isFinite(published)) {
    const days = (now - published) / 86_400_000;
    if (days <= 30)      recency = 5;
    else if (days <= 60) recency = 4;
    else if (days <= 90) recency = 3;
    else if (days <= 180) recency = 2;
    else recency = 1;
  }

  // Trust: match on channelId first, fallback to channelName (case-insensitive)
  let trust = 2;
  const nameKey = input.video.channelName.trim().toLowerCase();
  if (input.trustedChannelIds.has(input.video.channelId)) {
    trust = input.channelTrustMap.get(input.video.channelName) ?? 4;
  } else if (input.trustedChannelNames.has(nameKey)) {
    trust = input.channelTrustMap.get(nameKey) ?? 4;
  }

  const weights = { category: 1.0, tactical: 1.0, revenue: 1.0, recency: 0.8, trust: 0.8 };
  const weighted =
    (category * weights.category) +
    (tactical * weights.tactical) +
    (revenue  * weights.revenue) +
    (recency  * weights.recency) +
    (trust    * weights.trust);
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
  let total = weighted / weightSum;
  if (excludeHit) total = 1;
  total = Math.round(total * 10) / 10;

  return { category, tactical, revenue, recency, trust, total, excludeHit };
}

function scoreKeywords(haystack: string, keywords: string[]): number {
  if (keywords.length === 0) return 3;
  let hits = 0;
  for (const kw of keywords) {
    if (!kw) continue;
    if (haystack.includes(kw.toLowerCase())) hits++;
  }
  // 0 hits → 1, 1 → 2, 2 → 3, 3 → 4, 4+ → 5
  return Math.min(5, 1 + hits);
}
