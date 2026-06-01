import "server-only";

export const OUTREACH_SENT_ACTIONS = new Set([
  "message_sent",
  "email_sent",
  "text_sent",
  "sms_sent",
  "facebook_sent",
  "fb_message_sent",
  "follow_up_sent",
]);

export const OUTREACH_REPLY_ACTIONS = new Set([
  "reply_received",
  "fb_reply_received",
]);

export const OUTREACH_MEETING_ACTIONS = new Set([
  "conversation_started",
  "meeting_booked",
  "demo_booked",
]);

export const OUTREACH_PAYMENT_ACTIONS = new Set([
  "payment_link_created",
  "payment_link_sent",
]);

export const OUTREACH_DEAL_ACTIONS = new Set(["deal_closed"]);

export type OutreachEventInput = {
  id?: string | null;
  action_type?: string | null;
  actionType?: string | null;
  channel?: string | null;
  city?: string | null;
  category?: string | null;
  revenue_cents?: number | null;
  revenueCents?: number | null;
  lead_id?: string | null;
  leadId?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  createdAt?: string | Date | null;
};

export type SalesLeadSnapshot = {
  id?: string | null;
  business_name?: string | null;
  businessName?: string | null;
  contact_name?: string | null;
  contactName?: string | null;
  city?: string | null;
  category?: string | null;
  status?: string | null;
  priority?: string | null;
  score?: number | null;
  rating?: number | string | null;
  reviews_count?: number | null;
  reviewsCount?: number | null;
  last_reply_at?: string | null;
  lastReplyAt?: string | Date | null;
  updated_at?: string | null;
  updatedAt?: string | Date | null;
};

export type OutreachPerformanceTotals = {
  touches: number;
  replies: number;
  conversations: number;
  paymentLinks: number;
  deals: number;
  revenueCents: number;
  replyRate: number;
  conversationRate: number;
  closeRate: number;
  revenuePerTouchCents: number;
};

export type OutreachDimensionPerformance = OutreachPerformanceTotals & {
  key: string;
  label: string;
  dimension: "channel" | "category" | "city" | "source";
  performanceLabel: "Winner" | "Average" | "Underperforming" | "Learning";
  score: number;
  recommendation: string;
};

export type OutreachPatternMemory = {
  patternType: "opener" | "cta" | "subject" | "message_shape";
  pattern: string;
  channel: string;
  category: string;
  wins: number;
  replies: number;
  deals: number;
  revenueCents: number;
  confidence: "High" | "Medium" | "Learning";
  guidance: string;
};

export type TestimonialOpportunity = {
  leadId: string;
  businessName: string;
  contactName: string | null;
  city: string | null;
  category: string | null;
  score: number;
  reason: string;
  recommendedAsk: "testimonial" | "video_review" | "case_study" | "referral";
  nextAction: string;
};

export type RevenueAttributionSignal = OutreachDimensionPerformance & {
  sourceHint: string;
  directionalConfidence: "High" | "Medium" | "Learning";
};

export type OutreachMarketingIntelligence = {
  generatedAt: string;
  totals: OutreachPerformanceTotals;
  winners: OutreachDimensionPerformance[];
  underperformers: OutreachDimensionPerformance[];
  patternMemory: OutreachPatternMemory[];
  testimonialOpportunities: TestimonialOpportunity[];
  revenueAttribution: RevenueAttributionSignal[];
  recommendations: {
    priority: "high" | "medium" | "low";
    title: string;
    detail: string;
    nextAction: string;
  }[];
};

type LeadOutcome = {
  leadId: string;
  replies: number;
  conversations: number;
  deals: number;
  revenueCents: number;
};

export function buildOutreachMarketingIntelligence(
  events: OutreachEventInput[],
  leads: SalesLeadSnapshot[] = [],
): OutreachMarketingIntelligence {
  const normalizedEvents = events.map(normalizeEvent).filter((event) => event.actionType);
  const totals = summarizeEvents(normalizedEvents);
  const leadOutcomes = buildLeadOutcomes(normalizedEvents);
  const channelStats = summarizeByDimension(normalizedEvents, "channel", totals);
  const categoryStats = summarizeByDimension(normalizedEvents, "category", totals);
  const cityStats = summarizeByDimension(normalizedEvents, "city", totals);
  const revenueAttribution = summarizeAttribution(normalizedEvents, totals);
  const allDimensions = [...channelStats, ...categoryStats, ...cityStats, ...revenueAttribution];

  const winners = allDimensions
    .filter((item) => item.performanceLabel === "Winner")
    .sort(sortByPerformance)
    .slice(0, 8);

  const underperformers = allDimensions
    .filter((item) => item.performanceLabel === "Underperforming")
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  const patternMemory = buildPatternMemory(normalizedEvents, leadOutcomes);
  const testimonialOpportunities = buildTestimonialOpportunities(leads, leadOutcomes);
  const recommendations = buildRecommendations({
    totals,
    winners,
    underperformers,
    patternMemory,
    testimonialOpportunities,
    revenueAttribution,
  });

  return {
    generatedAt: new Date().toISOString(),
    totals,
    winners,
    underperformers,
    patternMemory,
    testimonialOpportunities,
    revenueAttribution,
    recommendations,
  };
}

function normalizeEvent(event: OutreachEventInput) {
  const metadata = isRecord(event.metadata) ? event.metadata : {};
  return {
    id: text(event.id),
    actionType: text(event.action_type ?? event.actionType) ?? "unknown",
    channel: text(event.channel) ?? "unknown",
    city: text(event.city) ?? "unknown",
    category: text(event.category) ?? "unknown",
    revenueCents: numberValue(event.revenue_cents ?? event.revenueCents),
    leadId: text(event.lead_id ?? event.leadId),
    message: text(event.message),
    metadata,
    createdAt: event.created_at ?? event.createdAt ?? null,
  };
}

function summarizeEvents(events: ReturnType<typeof normalizeEvent>[]): OutreachPerformanceTotals {
  const touches = events.filter((event) => OUTREACH_SENT_ACTIONS.has(event.actionType)).length;
  const replies = events.filter((event) => OUTREACH_REPLY_ACTIONS.has(event.actionType)).length;
  const conversations = events.filter((event) => OUTREACH_MEETING_ACTIONS.has(event.actionType)).length;
  const paymentLinks = events.filter((event) => OUTREACH_PAYMENT_ACTIONS.has(event.actionType)).length;
  const deals = events.filter((event) => OUTREACH_DEAL_ACTIONS.has(event.actionType)).length;
  const revenueCents = events.reduce((sum, event) => sum + event.revenueCents, 0);

  return {
    touches,
    replies,
    conversations,
    paymentLinks,
    deals,
    revenueCents,
    replyRate: ratio(replies, touches),
    conversationRate: ratio(conversations, Math.max(replies, 1)),
    closeRate: ratio(deals, touches),
    revenuePerTouchCents: touches > 0 ? Math.round(revenueCents / touches) : 0,
  };
}

function summarizeByDimension(
  events: ReturnType<typeof normalizeEvent>[],
  dimension: "channel" | "category" | "city",
  baseline: OutreachPerformanceTotals,
): OutreachDimensionPerformance[] {
  const grouped = new Map<string, ReturnType<typeof normalizeEvent>[]>();
  for (const event of events) {
    const key = event[dimension] || "unknown";
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  return Array.from(grouped.entries()).map(([key, rows]) => {
    const totals = summarizeEvents(rows);
    const score = performanceScore(totals, baseline);
    return {
      ...totals,
      key,
      label: formatLabel(key),
      dimension,
      performanceLabel: performanceLabel(totals, baseline, score),
      score,
      recommendation: recommendationForDimension(dimension, key, totals, baseline),
    };
  });
}

function summarizeAttribution(
  events: ReturnType<typeof normalizeEvent>[],
  baseline: OutreachPerformanceTotals,
): RevenueAttributionSignal[] {
  const grouped = new Map<string, ReturnType<typeof normalizeEvent>[]>();
  for (const event of events) {
    const source = attributionSource(event);
    grouped.set(source, [...(grouped.get(source) ?? []), event]);
  }

  return Array.from(grouped.entries()).map(([key, rows]) => {
    const totals = summarizeEvents(rows);
    const score = performanceScore(totals, baseline);
    const label = performanceLabel(totals, baseline, score);
    return {
      ...totals,
      key,
      label: formatLabel(key),
      dimension: "source" as const,
      performanceLabel: label,
      score,
      recommendation:
        totals.deals > 0
          ? `Use ${formatLabel(key)} as proof when planning the next campaign. It is already tied to revenue.`
          : totals.replies > 0
            ? `Treat ${formatLabel(key)} as a lead-source signal and keep follow-up tight.`
            : `Keep tracking ${formatLabel(key)} until enough replies or deals exist.`,
      sourceHint: key,
      directionalConfidence: totals.deals > 0 ? "High" as const : totals.touches >= 10 ? "Medium" as const : "Learning" as const,
    };
  }).sort(sortByPerformance).slice(0, 8);
}

function buildLeadOutcomes(events: ReturnType<typeof normalizeEvent>[]) {
  const outcomes = new Map<string, LeadOutcome>();
  for (const event of events) {
    if (!event.leadId) continue;
    const current = outcomes.get(event.leadId) ?? {
      leadId: event.leadId,
      replies: 0,
      conversations: 0,
      deals: 0,
      revenueCents: 0,
    };
    if (OUTREACH_REPLY_ACTIONS.has(event.actionType)) current.replies += 1;
    if (OUTREACH_MEETING_ACTIONS.has(event.actionType)) current.conversations += 1;
    if (OUTREACH_DEAL_ACTIONS.has(event.actionType)) current.deals += 1;
    current.revenueCents += event.revenueCents;
    outcomes.set(event.leadId, current);
  }
  return outcomes;
}

function buildPatternMemory(
  events: ReturnType<typeof normalizeEvent>[],
  leadOutcomes: Map<string, LeadOutcome>,
): OutreachPatternMemory[] {
  const patterns = new Map<string, OutreachPatternMemory>();

  for (const event of events) {
    if (!OUTREACH_SENT_ACTIONS.has(event.actionType) || !event.message) continue;
    const outcome = event.leadId ? leadOutcomes.get(event.leadId) : null;
    const replies = outcome?.replies ?? 0;
    const deals = outcome?.deals ?? 0;
    const revenueCents = outcome?.revenueCents ?? 0;
    if (replies === 0 && deals === 0 && revenueCents === 0) continue;

    const extracted = [
      { patternType: "opener" as const, pattern: extractOpener(event.message) },
      { patternType: "cta" as const, pattern: extractCta(event.message) },
      { patternType: "subject" as const, pattern: extractSubject(event.metadata, event.message) },
      { patternType: "message_shape" as const, pattern: messageShape(event.message) },
    ].filter((item) => item.pattern);

    for (const item of extracted) {
      const key = `${item.patternType}:${event.channel}:${event.category}:${item.pattern}`;
      const existing = patterns.get(key) ?? {
        patternType: item.patternType,
        pattern: item.pattern,
        channel: event.channel,
        category: event.category,
        wins: 0,
        replies: 0,
        deals: 0,
        revenueCents: 0,
        confidence: "Learning" as const,
        guidance: "",
      };
      existing.wins += replies > 0 || deals > 0 || revenueCents > 0 ? 1 : 0;
      existing.replies += replies;
      existing.deals += deals;
      existing.revenueCents += revenueCents;
      existing.confidence = existing.deals > 0 || existing.wins >= 3 ? "High" : existing.wins >= 2 ? "Medium" : "Learning";
      existing.guidance = patternGuidance(existing);
      patterns.set(key, existing);
    }
  }

  return Array.from(patterns.values())
    .sort((a, b) => b.deals - a.deals || b.replies - a.replies || b.revenueCents - a.revenueCents || b.wins - a.wins)
    .slice(0, 10);
}

function buildTestimonialOpportunities(
  leads: SalesLeadSnapshot[],
  leadOutcomes: Map<string, LeadOutcome>,
): TestimonialOpportunity[] {
  return leads
    .map((lead) => {
      const leadId = text(lead.id);
      if (!leadId) return null;
      const outcome = leadOutcomes.get(leadId);
      const status = text(lead.status);
      const rating = numberValue(lead.rating);
      const score = numberValue(lead.score);
      const reviews = numberValue(lead.reviews_count ?? lead.reviewsCount);
      const closed = status === "closed" || (outcome?.deals ?? 0) > 0;
      const happySignal = rating >= 4 || score >= 75 || (outcome?.revenueCents ?? 0) > 0;
      if (!closed && !happySignal) return null;

      const testimonialScore = clamp(
        (closed ? 35 : 0) +
          Math.min(25, Math.round((outcome?.revenueCents ?? 0) / 10000)) +
          Math.min(20, score / 5) +
          (rating >= 4.5 ? 15 : rating >= 4 ? 10 : 0) +
          (reviews >= 25 ? 5 : 0),
      );

      const recommendedAsk =
        testimonialScore >= 78
          ? "case_study"
          : testimonialScore >= 66
            ? "video_review"
            : reviews >= 20
              ? "referral"
              : "testimonial";

      return {
        leadId,
        businessName: text(lead.business_name ?? lead.businessName) ?? "Customer",
        contactName: text(lead.contact_name ?? lead.contactName),
        city: text(lead.city),
        category: text(lead.category),
        score: testimonialScore,
        reason: testimonialReason({ closed, rating, score, outcome }),
        recommendedAsk,
        nextAction: nextTestimonialAction(recommendedAsk),
      };
    })
    .filter((item): item is TestimonialOpportunity => Boolean(item))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function buildRecommendations(input: {
  totals: OutreachPerformanceTotals;
  winners: OutreachDimensionPerformance[];
  underperformers: OutreachDimensionPerformance[];
  patternMemory: OutreachPatternMemory[];
  testimonialOpportunities: TestimonialOpportunity[];
  revenueAttribution: RevenueAttributionSignal[];
}) {
  const recommendations: OutreachMarketingIntelligence["recommendations"] = [];
  const bestWinner = input.winners[0];
  if (bestWinner) {
    recommendations.push({
      priority: "high",
      title: `Lean into ${bestWinner.label}`,
      detail: `${bestWinner.label} is outperforming the current baseline with ${percent(bestWinner.replyRate)} reply rate and ${bestWinner.deals} closed deal${bestWinner.deals === 1 ? "" : "s"}.`,
      nextAction: bestWinner.dimension === "channel"
        ? `Use ${bestWinner.label} for the next approved outreach batch.`
        : `Prioritize ${bestWinner.label} in the next content and outreach plan.`,
    });
  }

  const bestPattern = input.patternMemory[0];
  if (bestPattern) {
    recommendations.push({
      priority: bestPattern.confidence === "High" ? "high" : "medium",
      title: "Reuse a proven outreach pattern",
      detail: `${bestPattern.patternType} pattern winning in ${bestPattern.channel}: "${bestPattern.pattern}"`,
      nextAction: "Feed this into the next draft set, but keep human approval before sending.",
    });
  }

  if (input.testimonialOpportunities.length > 0) {
    recommendations.push({
      priority: "medium",
      title: "Turn wins into proof",
      detail: `${input.testimonialOpportunities.length} customer win${input.testimonialOpportunities.length === 1 ? "" : "s"} look ready for a testimonial, referral, video review, or case study request.`,
      nextAction: "Queue a short approval-required testimonial ask from the existing review/revenue workflow.",
    });
  }

  if (input.totals.touches >= 20 && input.totals.replyRate < 0.03) {
    recommendations.push({
      priority: "high",
      title: "Refresh the opening line",
      detail: `Reply rate is ${percent(input.totals.replyRate)} across ${input.totals.touches} touches.`,
      nextAction: "Use sharper pain-point hooks and pause low-performing channels until a new draft is reviewed.",
    });
  }

  const weak = input.underperformers[0];
  if (weak) {
    recommendations.push({
      priority: "low",
      title: `Watch ${weak.label}`,
      detail: `${weak.label} is trailing the baseline. This may be sample-size noise, but it should not get more volume yet.`,
      nextAction: "Keep it in learning mode or test a different opener before scaling.",
    });
  }

  return recommendations.slice(0, 6);
}

function attributionSource(event: ReturnType<typeof normalizeEvent>) {
  const sourceAttribution = isRecord(event.metadata.source_attribution)
    ? event.metadata.source_attribution
    : {};
  return (
    text(event.metadata.content_source) ??
    text(event.metadata.source) ??
    text(event.metadata.source_system) ??
    text(sourceAttribution.sourceSystem) ??
    text(sourceAttribution.source_system) ??
    text(event.metadata.workflow) ??
    text(event.metadata.campaign_type) ??
    `${event.channel}_outreach`
  );
}

function performanceScore(
  totals: OutreachPerformanceTotals,
  baseline: OutreachPerformanceTotals,
) {
  const sample = Math.min(20, totals.touches) / 20;
  const replyLift = baseline.replyRate > 0 ? totals.replyRate / baseline.replyRate : totals.replyRate > 0 ? 1.2 : 0;
  const closeLift = baseline.closeRate > 0 ? totals.closeRate / baseline.closeRate : totals.closeRate > 0 ? 1.2 : 0;
  const revenueLift =
    baseline.revenuePerTouchCents > 0
      ? totals.revenuePerTouchCents / baseline.revenuePerTouchCents
      : totals.revenuePerTouchCents > 0
        ? 1.2
        : 0;
  return clamp(
    sample * 20 +
      Math.min(35, replyLift * 18) +
      Math.min(30, closeLift * 18) +
      Math.min(15, revenueLift * 9),
  );
}

function performanceLabel(
  totals: OutreachPerformanceTotals,
  baseline: OutreachPerformanceTotals,
  score: number,
): OutreachDimensionPerformance["performanceLabel"] {
  if (totals.touches < 3 && totals.deals === 0 && totals.replies === 0) return "Learning";
  if (totals.deals > 0 || score >= 70 || (baseline.replyRate > 0 && totals.replyRate >= baseline.replyRate * 1.35 && totals.touches >= 3)) {
    return "Winner";
  }
  if (totals.touches >= 8 && score < 35 && totals.replyRate <= Math.max(0.01, baseline.replyRate * 0.65)) {
    return "Underperforming";
  }
  return "Average";
}

function recommendationForDimension(
  dimension: "channel" | "category" | "city",
  key: string,
  totals: OutreachPerformanceTotals,
  baseline: OutreachPerformanceTotals,
) {
  const label = formatLabel(key);
  if (totals.deals > 0) return `${label} is tied to closed revenue. Reuse the best proof and follow-up pattern.`;
  if (baseline.replyRate > 0 && totals.replyRate >= baseline.replyRate * 1.25 && totals.replies > 0) {
    return `${label} is pulling above-average replies. Give it more approved tests.`;
  }
  if (totals.touches >= 8 && totals.replies === 0) {
    return `${label} has enough touches without replies. Refresh the hook before adding volume.`;
  }
  return `${label} is still learning. Keep tracking replies, meetings, and revenue before scaling.`;
}

function sortByPerformance(a: OutreachDimensionPerformance, b: OutreachDimensionPerformance) {
  return b.score - a.score || b.deals - a.deals || b.replies - a.replies || b.revenueCents - a.revenueCents;
}

function extractOpener(message: string) {
  const compact = normalizeMessage(message);
  const firstSentence = compact.split(/(?<=[.!?])\s+/)[0] ?? compact;
  return truncatePattern(firstSentence);
}

function extractCta(message: string) {
  const lines = normalizeMessage(message).split(/(?:\n|\. |\? |! )/).map((line) => line.trim()).filter(Boolean);
  const cta = [...lines].reverse().find((line) => /\b(reply|call|book|send|open|look|interested|helpful|worth|quick|demo|scan|example)\b/i.test(line));
  return truncatePattern(cta ?? lines.at(-1) ?? "");
}

function extractSubject(metadata: Record<string, unknown>, message: string) {
  const subject = text(metadata.subject ?? metadata.email_subject ?? metadata.message_subject);
  if (subject) return truncatePattern(subject);
  const firstLine = message.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (firstLine && firstLine.length < 90 && !/^hi\b/i.test(firstLine)) return truncatePattern(firstLine);
  return "";
}

function messageShape(message: string) {
  const compact = normalizeMessage(message);
  const words = compact.split(/\s+/).filter(Boolean).length;
  const questions = (compact.match(/\?/g) ?? []).length;
  const paragraphs = message.split(/\n\s*\n/).filter((part) => part.trim()).length;
  const length = words <= 35 ? "short" : words <= 90 ? "medium" : "long";
  return `${length} / ${paragraphs || 1} paragraph${paragraphs === 1 ? "" : "s"} / ${questions} question${questions === 1 ? "" : "s"}`;
}

function patternGuidance(pattern: OutreachPatternMemory) {
  if (pattern.deals > 0) return "Use as a proven closing pattern in similar approved outreach.";
  if (pattern.replies >= 2) return "Use as a reply-generating pattern, then test a stronger conversion CTA.";
  return "Keep in the pattern library until more replies or revenue confirm it.";
}

function testimonialReason(input: {
  closed: boolean;
  rating: number;
  score: number;
  outcome: LeadOutcome | undefined;
}) {
  const parts = [
    input.closed ? "closed customer" : null,
    input.outcome?.revenueCents ? `${formatMoney(input.outcome.revenueCents)} attributed revenue` : null,
    input.rating >= 4 ? `${input.rating.toFixed(1)} rating signal` : null,
    input.score >= 75 ? `high fit score ${input.score}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "positive customer signal";
}

function nextTestimonialAction(kind: TestimonialOpportunity["recommendedAsk"]) {
  if (kind === "case_study") return "Draft a short case-study request for approval.";
  if (kind === "video_review") return "Draft a low-pressure video review ask for approval.";
  if (kind === "referral") return "Draft a referral ask tied to the completed win.";
  return "Draft a simple testimonial request for approval.";
}

function normalizeMessage(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncatePattern(value: string) {
  const compact = normalizeMessage(value);
  return compact.length > 120 ? `${compact.slice(0, 117).trim()}...` : compact;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : 0;
}

function ratio(value: number, total: number) {
  return total > 0 ? value / total : 0;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function percent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
