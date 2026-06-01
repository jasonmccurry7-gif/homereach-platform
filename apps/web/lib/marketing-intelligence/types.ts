export type MarketingPerformanceLabel =
  | "Winner"
  | "Average"
  | "Underperforming"
  | "Learning";

export type MarketingPerformanceConfidence = "low" | "medium" | "high";

export type MarketingMetricSnapshot = {
  views?: number | null;
  reach?: number | null;
  impressions?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  clicks?: number | null;
  dms_generated?: number | null;
  leads_generated?: number | null;
  conversions_generated?: number | null;
  estimated_revenue?: number | string | null;
};

export type MarketingMetricTotals = {
  views: number;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  dms_generated: number;
  leads_generated: number;
  conversions_generated: number;
  estimated_revenue: number;
};

export type MarketingContentIntelligence = {
  contentId: string;
  label: MarketingPerformanceLabel;
  confidence: MarketingPerformanceConfidence;
  score: number;
  baselineScore: number;
  paidAdCandidate: boolean;
  paidAdReason: string | null;
  recommendedAction: string;
  signals: string[];
  reusableHooks: string[];
  reusableCtas: string[];
  painPoints: string[];
  totals: MarketingMetricTotals;
};
