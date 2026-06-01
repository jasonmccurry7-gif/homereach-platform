import type { DailyVideoContentRow } from "@/lib/daily-content/types";
import { painPointProfileForVertical } from "./pain-points";
import type {
  MarketingContentIntelligence,
  MarketingMetricSnapshot,
  MarketingPerformanceConfidence,
  MarketingPerformanceLabel,
} from "./types";

type MetricRow = MarketingMetricSnapshot & {
  video_id?: string | null;
  daily_video_id?: string | null;
  publication_id?: string | null;
};

const EMPTY_TOTALS: MarketingContentIntelligence["totals"] = {
  views: 0,
  reach: 0,
  impressions: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  clicks: 0,
  dms_generated: 0,
  leads_generated: 0,
  conversions_generated: 0,
  estimated_revenue: 0,
};

export function buildDailyContentMarketingIntelligence({
  videos,
  currentMetrics,
  baselineMetrics,
}: {
  videos: DailyVideoContentRow[];
  currentMetrics: MetricRow[];
  baselineMetrics: MetricRow[];
}): Record<string, MarketingContentIntelligence> {
  const baselineScores = groupMetricsByContentId(baselineMetrics)
    .map((rows) => scoreMetricTotals(sumMetricRows(rows)))
    .filter((score) => score > 0);
  const baselineScore = median(baselineScores) || average(baselineScores) || 18;
  const currentByVideo = new Map(groupMetricsByContentId(currentMetrics).map((rows) => [contentIdForMetric(rows[0]!), rows]));

  return Object.fromEntries(
    videos.map((video) => {
      const totals = sumMetricRows(currentByVideo.get(video.id) ?? []);
      return [video.id, evaluateContentPerformance({ video, totals, baselineScore })];
    }),
  );
}

export function evaluateImportedMetricSignal(input: MarketingMetricSnapshot) {
  const totals = sumMetricRows([input]);
  const score = scoreMetricTotals(totals);
  const hasOutcome = totals.leads_generated > 0 || totals.conversions_generated > 0 || totals.dms_generated > 0;
  const hasStrongEngagement = totals.comments + totals.shares + totals.saves >= 5;
  const signal = hasOutcome
    ? "revenue_or_lead_signal"
    : hasStrongEngagement
      ? "strong_engagement_signal"
      : score > 10
        ? "performance_signal"
        : "metric_update";

  return {
    signal,
    score,
    metadata: {
      performanceScore: score,
      paidAdCandidate: hasOutcome || hasStrongEngagement,
      totals,
    },
  };
}

function evaluateContentPerformance({
  video,
  totals,
  baselineScore,
}: {
  video: DailyVideoContentRow;
  totals: MarketingContentIntelligence["totals"];
  baselineScore: number;
}): MarketingContentIntelligence {
  const score = scoreMetricTotals(totals);
  const confidence = confidenceForTotals(totals);
  const label = labelFor({ score, baselineScore, totals, confidence });
  const profile = painPointProfileForVertical(video.vertical);
  const paidAdCandidate = confidence !== "low" && label === "Winner" && (
    totals.leads_generated > 0 ||
    totals.conversions_generated > 0 ||
    totals.dms_generated > 0 ||
    totals.comments + totals.shares + totals.saves >= 8
  );
  const signals = buildSignals({ label, totals, score, baselineScore });

  return {
    contentId: video.id,
    label,
    confidence,
    score,
    baselineScore,
    paidAdCandidate,
    paidAdReason: paidAdCandidate
      ? "Performance is above baseline with enough engagement or lead intent to justify a small human-approved paid test."
      : null,
    recommendedAction: recommendedActionFor({ label, paidAdCandidate, confidence }),
    signals,
    reusableHooks: uniqueNonEmpty([video.video_hook, ...video.alternate_hooks]).slice(0, 5),
    reusableCtas: uniqueNonEmpty([video.primary_cta, ...Object.values(video.platform_posts ?? {})].flatMap(extractCtas)).slice(0, 4),
    painPoints: profile?.painPoints.slice(0, 4) ?? [],
    totals,
  };
}

function labelFor({
  score,
  baselineScore,
  totals,
  confidence,
}: {
  score: number;
  baselineScore: number;
  totals: MarketingContentIntelligence["totals"];
  confidence: MarketingPerformanceConfidence;
}): MarketingPerformanceLabel {
  if (confidence === "low") return "Learning";
  if (totals.conversions_generated > 0 || totals.leads_generated > 0) return "Winner";
  if (score >= Math.max(24, baselineScore * 1.35)) return "Winner";
  if (confidence === "high" && score <= baselineScore * 0.45) return "Underperforming";
  return "Average";
}

function recommendedActionFor({
  label,
  paidAdCandidate,
  confidence,
}: {
  label: MarketingPerformanceLabel;
  paidAdCandidate: boolean;
  confidence: MarketingPerformanceConfidence;
}) {
  if (paidAdCandidate) return "Create a human-approved paid ad test and reuse the hook in one outreach sequence.";
  if (label === "Winner") return "Reuse the hook, CTA, and pain point in the next content batch.";
  if (label === "Underperforming") return "Rewrite the first three seconds and test a sharper pain-point hook.";
  if (confidence === "low") return "Publish proof or import metrics before making a scaling decision.";
  return "Keep measuring and compare against the next published variant.";
}

function buildSignals({
  label,
  totals,
  score,
  baselineScore,
}: {
  label: MarketingPerformanceLabel;
  totals: MarketingContentIntelligence["totals"];
  score: number;
  baselineScore: number;
}) {
  const signals: string[] = [`${label} score ${Math.round(score)} vs baseline ${Math.round(baselineScore)}`];
  if (totals.leads_generated > 0) signals.push(`${totals.leads_generated} lead${totals.leads_generated === 1 ? "" : "s"} generated`);
  if (totals.conversions_generated > 0) signals.push(`${totals.conversions_generated} conversion${totals.conversions_generated === 1 ? "" : "s"} generated`);
  if (totals.dms_generated > 0) signals.push(`${totals.dms_generated} DM${totals.dms_generated === 1 ? "" : "s"} generated`);
  if (totals.comments > 0) signals.push(`${totals.comments} comment${totals.comments === 1 ? "" : "s"}`);
  if (totals.shares > 0 || totals.saves > 0) signals.push(`${totals.shares + totals.saves} share/save action${totals.shares + totals.saves === 1 ? "" : "s"}`);
  return signals.slice(0, 5);
}

function confidenceForTotals(totals: MarketingContentIntelligence["totals"]): MarketingPerformanceConfidence {
  const exposure = totals.views + totals.reach + totals.impressions;
  const intent = totals.comments + totals.shares + totals.saves + totals.clicks + totals.dms_generated + totals.leads_generated + totals.conversions_generated;
  if (exposure >= 500 || intent >= 8 || totals.leads_generated > 0 || totals.conversions_generated > 0) return "high";
  if (exposure >= 100 || intent >= 3) return "medium";
  return "low";
}

function scoreMetricTotals(totals: MarketingContentIntelligence["totals"]) {
  return round1(
    totals.views * 0.01 +
      totals.reach * 0.006 +
      totals.impressions * 0.004 +
      totals.likes * 0.5 +
      totals.comments * 3 +
      totals.shares * 5 +
      totals.saves * 4 +
      totals.clicks * 2.5 +
      totals.dms_generated * 12 +
      totals.leads_generated * 24 +
      totals.conversions_generated * 40 +
      totals.estimated_revenue * 0.05,
  );
}

function sumMetricRows(rows: MarketingMetricSnapshot[]): MarketingContentIntelligence["totals"] {
  return rows.reduce<MarketingContentIntelligence["totals"]>(
    (totals, row) => ({
      views: totals.views + numberValue(row.views),
      reach: totals.reach + numberValue(row.reach),
      impressions: totals.impressions + numberValue(row.impressions),
      likes: totals.likes + numberValue(row.likes),
      comments: totals.comments + numberValue(row.comments),
      shares: totals.shares + numberValue(row.shares),
      saves: totals.saves + numberValue(row.saves),
      clicks: totals.clicks + numberValue(row.clicks),
      dms_generated: totals.dms_generated + numberValue(row.dms_generated),
      leads_generated: totals.leads_generated + numberValue(row.leads_generated),
      conversions_generated: totals.conversions_generated + numberValue(row.conversions_generated),
      estimated_revenue: totals.estimated_revenue + numberValue(row.estimated_revenue),
    }),
    { ...EMPTY_TOTALS },
  );
}

function groupMetricsByContentId(rows: MetricRow[]) {
  const groups = new Map<string, MetricRow[]>();
  for (const row of rows) {
    const id = contentIdForMetric(row);
    if (!id) continue;
    const group = groups.get(id) ?? [];
    group.push(row);
    groups.set(id, group);
  }
  return Array.from(groups.values());
}

function contentIdForMetric(row: MetricRow) {
  return row.video_id ?? row.daily_video_id ?? row.publication_id ?? "";
}

function extractCtas(value: string) {
  const matches = value.match(/(?:comment|dm|send|message|book|claim|get|request)\s+[^.\n!]{2,80}/gi) ?? [];
  return matches.map((item) => item.trim());
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean)));
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : sorted[middle] ?? 0;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
