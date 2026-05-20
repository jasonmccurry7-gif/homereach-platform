// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Lead Intelligence Scorer
//
// Pure-function scoring. No external API calls, no database writes.
// Compute a 4-signal score (4-20) from data available on a Lead row plus
// an optional list of active market signals (from ci_market_signals).
//
// Signals (each 1-5):
//   • RECENCY       — freshness of lead / last contact
//   • ENGAGEMENT    — buying_signal + reply recency
//   • STORM_FIT     — active NOAA storm signal in lead's state, if category
//                     is storm-sensitive (roofing, gutter_cleaning)
//   • CATEGORY_FIT  — does the lead's category match a HomeReach vertical
// ─────────────────────────────────────────────────────────────────────────────

export type LeadRow = {
  id: string;
  state: string | null;
  category: string | null;
  buying_signal: boolean | null;
  last_contacted_at: string | null;
  last_reply_at: string | null;
  created_at?: string | null;
  status?: string | null;
};

export type ActiveSignal = {
  category: string;       // 'roofing' | 'gutter_cleaning' | etc.
  location: string | null; // NOAA areaDesc + state — we match on state substring
  intensity_score: number; // 1-5
  expires_at: string | null;
};

// Categories where active weather signals materially change purchase likelihood
const STORM_SENSITIVE = new Set(["roofing", "gutter_cleaning"]);

const HOMEREACH_VERTICALS = new Set([
  "pressure_washing", "lawn_care", "window_cleaning",
  "gutter_cleaning", "pest_control", "roofing",
]);

export type ScoreResult = {
  recency: number;
  engagement: number;
  stormFit: number;
  categoryFit: number;
  total: number;           // 4..20
  tier: "high" | "medium" | "low";
};

export function scoreLead(lead: LeadRow, signals: ActiveSignal[], nowMs: number = Date.now()): ScoreResult {
  const recency     = recencyScore(lead, nowMs);
  const engagement  = engagementScore(lead, nowMs);
  const stormFit    = stormFitScore(lead, signals);
  const categoryFit = categoryFitScore(lead);

  const total = recency + engagement + stormFit + categoryFit;
  const tier: "high" | "medium" | "low" =
    total >= 15 ? "high" : total >= 10 ? "medium" : "low";

  return { recency, engagement, stormFit, categoryFit, total, tier };
}

function recencyScore(lead: LeadRow, nowMs: number): number {
  const ref = lead.last_contacted_at ?? lead.created_at ?? null;
  if (!ref) return 2;
  const days = (nowMs - Date.parse(ref)) / 86_400_000;
  if (!Number.isFinite(days) || days < 0) return 2;
  if (days <= 3)   return 5;
  if (days <= 14)  return 4;
  if (days <= 45)  return 3;
  if (days <= 120) return 2;
  return 1;
}

function engagementScore(lead: LeadRow, nowMs: number): number {
  const reply = lead.last_reply_at ? (nowMs - Date.parse(lead.last_reply_at)) / 86_400_000 : Infinity;
  if (lead.buying_signal && Number.isFinite(reply) && reply <= 7)   return 5;
  if (lead.buying_signal)                                            return 4;
  if (Number.isFinite(reply) && reply <= 30)                         return 3;
  if (Number.isFinite(reply) && reply <= 90)                         return 2;
  return 1;
}

function stormFitScore(lead: LeadRow, signals: ActiveSignal[]): number {
  const cat = lead.category ?? "";
  if (!STORM_SENSITIVE.has(cat)) return 2; // neutral for non-storm categories

  const leadState = (lead.state ?? "").trim().toUpperCase();
  if (!leadState) return 2;

  // Find the strongest active signal that matches both category and state
  let best = 0;
  for (const s of signals) {
    if (s.category !== cat) continue;
    if (s.expires_at && Date.parse(s.expires_at) < Date.now()) continue;
    // NOAA location often looks like "Wayne County, OH" — substring match on state code
    const loc = (s.location ?? "").toUpperCase();
    if (!loc.includes(leadState) && !loc.endsWith(`, ${leadState}`) && loc !== leadState) continue;
    best = Math.max(best, s.intensity_score);
  }
  // No active signal but storm-sensitive category gets a mild baseline (2)
  if (best === 0) return 2;
  return Math.max(3, Math.min(5, best)); // floor at 3 if a storm is actually hitting
}

function categoryFitScore(lead: LeadRow): number {
  const c = lead.category ?? "";
  if (!c) return 1;
  if (HOMEREACH_VERTICALS.has(c)) return 4;
  return 2; // known but not one of the active verticals
}
