import type { SalesLead } from "./types";

export type GrowthPriority = "critical" | "high" | "medium";

export interface GrowthQuickAction {
  label: string;
  href?: string;
  kind: "call" | "email" | "view" | "copy";
}

export interface GrowthOpportunity {
  id: string;
  leadId: string;
  businessName: string;
  contactName?: string;
  city: string;
  category: string;
  source: string;
  priority: GrowthPriority;
  score: number;
  estimatedValue: number;
  urgency: string;
  reason: string;
  recommendedAction: string;
  safeActions: GrowthQuickAction[];
}

export interface SourceGrowthSummary {
  source: string;
  leads: number;
  hot: number;
  warm: number;
  replies: number;
  actionNeeded: number;
  estimatedPipeline: number;
}

export interface SalesGrowthPlan {
  generatedAt: string;
  topOpportunities: GrowthOpportunity[];
  sourceSummaries: SourceGrowthSummary[];
  immediateCount: number;
  followUpDueCount: number;
  staleLeadCount: number;
  estimatedPipeline: number;
  estimatedRevenueAtRisk: number;
  ownerFocus: string;
}

const CLOSED_STAGES = new Set(["closed_won", "closed_lost", "do_not_contact"]);

export function buildSalesGrowthPlan(leads: SalesLead[], now = new Date()): SalesGrowthPlan {
  const openLeads = leads.filter((lead) => !CLOSED_STAGES.has(lead.stage));
  const opportunities = openLeads
    .map((lead) => buildGrowthOpportunity(lead, now))
    .filter((item): item is GrowthOpportunity => Boolean(item))
    .sort((a, b) => b.score - a.score || b.estimatedValue - a.estimatedValue)
    .slice(0, 12);

  const sourceSummaries = buildSourceSummaries(openLeads);
  const immediateCount = opportunities.filter((item) => item.priority === "critical").length;
  const followUpDueCount = openLeads.filter((lead) => isFollowUpDue(lead, now)).length;
  const staleLeadCount = openLeads.filter((lead) => isStaleOpportunity(lead, now)).length;
  const estimatedPipeline = openLeads.reduce((sum, lead) => sum + estimateLeadValue(lead), 0);
  const estimatedRevenueAtRisk = openLeads
    .filter((lead) => lead.lastMessageRole === "lead" || isStaleOpportunity(lead, now))
    .reduce((sum, lead) => sum + estimateLeadValue(lead), 0);

  return {
    generatedAt: now.toISOString(),
    topOpportunities: opportunities,
    sourceSummaries,
    immediateCount,
    followUpDueCount,
    staleLeadCount,
    estimatedPipeline,
    estimatedRevenueAtRisk,
    ownerFocus: buildOwnerFocus(opportunities, followUpDueCount, staleLeadCount),
  };
}

function buildGrowthOpportunity(lead: SalesLead, now: Date): GrowthOpportunity | null {
  const ageHours = hoursSince(lead.lastMessageAt, now);
  const replied = lead.lastMessageRole === "lead";
  const hot = lead.classification.temperature === "hot";
  const warm = lead.classification.temperature === "warm";
  const paymentReady = lead.stage === "intake_sent" || lead.stage === "qualifying" || lead.stage === "warm_engaged";
  const followUpDue = isFollowUpDue(lead, now);
  const stale = isStaleOpportunity(lead, now);

  if (!replied && !hot && !warm && !paymentReady && !followUpDue && !stale) {
    return null;
  }

  const estimatedValue = estimateLeadValue(lead);
  let score = lead.classification.score + Math.min(25, Math.round(estimatedValue / 100));
  if (replied) score += 40;
  if (hot) score += 35;
  if (paymentReady) score += 25;
  if (followUpDue) score += 18;
  if (stale) score += 12;
  if (lead.control === "human") score -= 10;

  const priority: GrowthPriority =
    replied || hot ? "critical" :
    paymentReady || followUpDue ? "high" :
    "medium";

  const reason = replied
    ? "The latest message is from the lead. Fast human response protects momentum."
    : hot
    ? "High-intent signals are present. Move this toward a quote, call, or payment step."
    : paymentReady
    ? "This lead is in a decision stage. Remove friction and make the next step obvious."
    : followUpDue
    ? "Follow-up is due. Re-open the conversation with one clear next step."
    : "This opportunity is cooling off and needs a simple, human check-in.";

  return {
    id: lead.id,
    leadId: lead.id,
    businessName: lead.businessName,
    contactName: lead.contactName,
    city: lead.city || "Unknown city",
    category: lead.category || "Unknown category",
    source: normalizeSource(lead.source),
    priority,
    score,
    estimatedValue,
    urgency: buildUrgencyLabel(ageHours, replied, followUpDue),
    reason,
    recommendedAction: buildRecommendedAction(lead, replied, paymentReady, followUpDue),
    safeActions: buildSafeActions(lead),
  };
}

function buildSourceSummaries(leads: SalesLead[]): SourceGrowthSummary[] {
  const bySource = new Map<string, SourceGrowthSummary>();

  for (const lead of leads) {
    const source = normalizeSource(lead.source);
    const summary = bySource.get(source) ?? {
      source,
      leads: 0,
      hot: 0,
      warm: 0,
      replies: 0,
      actionNeeded: 0,
      estimatedPipeline: 0,
    };

    summary.leads += 1;
    summary.hot += lead.classification.temperature === "hot" ? 1 : 0;
    summary.warm += lead.classification.temperature === "warm" ? 1 : 0;
    summary.replies += lead.qualification.hasReplied ? 1 : 0;
    summary.actionNeeded += lead.lastMessageRole === "lead" || lead.stage === "intake_sent" ? 1 : 0;
    summary.estimatedPipeline += estimateLeadValue(lead);
    bySource.set(source, summary);
  }

  return Array.from(bySource.values())
    .sort((a, b) => b.actionNeeded - a.actionNeeded || b.estimatedPipeline - a.estimatedPipeline)
    .slice(0, 6);
}

function estimateLeadValue(lead: SalesLead): number {
  if (lead.monthlyValue && lead.monthlyValue > 0) return lead.monthlyValue;

  const text = `${lead.source} ${lead.category} ${lead.summary}`.toLowerCase();
  if (text.includes("political")) return 3500;
  if (text.includes("targeted")) return 1500;
  if (text.includes("procurement") || text.includes("inventory")) return 997;
  if (text.includes("seo") || text.includes("reputation")) return 750;
  if (text.includes("government") || text.includes("sam")) return 2500;
  return 299;
}

function buildRecommendedAction(
  lead: SalesLead,
  replied: boolean,
  paymentReady: boolean,
  followUpDue: boolean
): string {
  const firstName = lead.contactName?.split(" ")[0] ?? "there";
  if (replied) {
    return `Reply to ${firstName} now, answer the question directly, then offer the simplest next step: quote link, quick call, or intake form.`;
  }
  if (paymentReady) {
    return `Send a clear next-step note to ${firstName}: confirm fit, remove objections, and offer the payment or proposal path.`;
  }
  if (followUpDue) {
    return `Send one low-pressure follow-up to ${firstName} with a simple choice: see pricing, review coverage, or close the loop.`;
  }
  return `Check this lead manually and decide whether to follow up, qualify, or pause the opportunity.`;
}

function buildSafeActions(lead: SalesLead): GrowthQuickAction[] {
  const actions: GrowthQuickAction[] = [
    { label: "View CRM", href: `/admin/crm?q=${encodeURIComponent(lead.businessName)}`, kind: "view" },
    { label: "Copy next step", kind: "copy" },
  ];

  if (lead.phone) actions.unshift({ label: "Call", href: `tel:${lead.phone}`, kind: "call" });
  if (lead.email) {
    const subject = encodeURIComponent("HomeReach next steps");
    const body = encodeURIComponent(`Hi ${lead.contactName?.split(" ")[0] ?? "there"},\n\nI wanted to follow up with the simplest next step for ${lead.businessName}.\n\n`);
    actions.unshift({ label: "Email", href: `mailto:${lead.email}?subject=${subject}&body=${body}`, kind: "email" });
  }

  return actions;
}

function buildOwnerFocus(opportunities: GrowthOpportunity[], followUpDueCount: number, staleLeadCount: number): string {
  const top = opportunities[0];
  if (top) {
    return `${top.businessName}: ${top.recommendedAction}`;
  }
  if (followUpDueCount > 0) {
    return `${followUpDueCount} follow-up${followUpDueCount === 1 ? "" : "s"} due. Clear those before starting new outreach.`;
  }
  if (staleLeadCount > 0) {
    return `${staleLeadCount} lead${staleLeadCount === 1 ? "" : "s"} cooling off. Decide whether to revive or pause.`;
  }
  return "No urgent revenue action. Keep capture paths live and review source quality.";
}

function buildUrgencyLabel(ageHours: number, replied: boolean, followUpDue: boolean): string {
  if (replied && ageHours < 1) return "Reply now";
  if (replied && ageHours < 4) return `${Math.max(1, Math.round(ageHours))}h since reply`;
  if (replied) return "Reply overdue";
  if (followUpDue) return "Follow-up due";
  if (ageHours > 72) return "Cooling off";
  return "Watch";
}

function isFollowUpDue(lead: SalesLead, now: Date): boolean {
  if (lead.followUpCount >= lead.maxFollowUps) return false;
  if (lead.followUpNextAt) return new Date(lead.followUpNextAt).getTime() <= now.getTime();
  if (lead.qualification.hasReplied) return false;
  return hoursSince(lead.lastMessageAt, now) >= 24;
}

function isStaleOpportunity(lead: SalesLead, now: Date): boolean {
  if (lead.classification.temperature === "cold") return false;
  if (lead.control === "human") return false;
  return hoursSince(lead.lastMessageAt, now) >= 48;
}

function hoursSince(iso: string | undefined, now: Date): number {
  if (!iso) return 999;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return 999;
  return Math.max(0, (now.getTime() - time) / 36e5);
}

function normalizeSource(source: string | undefined): string {
  if (!source) return "Unknown";
  return source.replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
