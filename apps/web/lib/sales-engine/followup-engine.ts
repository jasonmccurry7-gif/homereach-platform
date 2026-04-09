// ─────────────────────────────────────────────────────────────────────────────
// Follow-Up Engine
//
// Manages re-engagement sequences for leads that haven't replied.
// Rules:
//   - Max 3 follow-ups (configurable per lead)
//   - Spacing: 24h → 48h → 72h
//   - Each message is unique — never repeat wording
//   - Stop automatically after max attempts
//   - Never follow up active/hot/customer leads with cold sequences
// ─────────────────────────────────────────────────────────────────────────────

import type { SalesLead, FollowUpVariant } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Follow-Up Timing (hours after last message)
// ─────────────────────────────────────────────────────────────────────────────

export const FOLLOW_UP_SCHEDULE: FollowUpVariant[] = [
  {
    attemptNumber: 1,
    delayHours:    24,
    body: "Hey {{firstName}}, just circling back — the {{city}} spot for {{category}} is still available. Worth a quick look?",
  },
  {
    attemptNumber: 2,
    delayHours:    48,
    body: "Hi {{firstName}}! One more check-in on the {{city}} {{category}} spot. No pressure — just don't want you to miss it if timing's right.",
  },
  {
    attemptNumber: 3,
    delayHours:    72,
    body: "Last one, promise. If the timing's not right for {{businessName}} right now, totally get it. I'll keep you in mind when {{city}} reopens.",
  },
];

// Category-specific follow-up variants for higher relevance
const CATEGORY_FOLLOW_UPS: Record<string, string[]> = {
  roofing: [
    "Hey {{firstName}}, storm season is picking up — homeowners are actively looking for roofers in {{city}}. Spot's still open.",
    "Quick follow-up — homeowners in {{city}} are searching for roofing right now. Still have your category open.",
  ],
  hvac: [
    "Hey {{firstName}}, HVAC demand is high in {{city}} right now — the postcard campaign could drive calls this week.",
    "Quick check-in — seasonal demand for HVAC is peaking. {{city}} spot still available.",
  ],
  landscaping: [
    "Hey {{firstName}}, spring season is here — landscaping inquiries in {{city}} are climbing. Spot still open.",
    "Quick follow-up — homeowners in {{city}} are planning their yards. Your spot's still available.",
  ],
  plumbing: [
    "Hey {{firstName}}, plumbing emergencies happen year-round — homeowners in {{city}} need a reliable local name. Spot's open.",
  ],
  painting: [
    "Hey {{firstName}}, spring and summer are peak painting months. Homeowners in {{city}} are looking right now.",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Get the next follow-up for a lead
// ─────────────────────────────────────────────────────────────────────────────

export function getNextFollowUp(lead: SalesLead): FollowUpVariant | null {
  // Don't follow up if lead has replied, is hot, or max reached
  if (lead.qualification.hasReplied)            return null;
  if (lead.classification.temperature === "hot") return null;
  if (lead.stage === "do_not_contact")          return null;
  if (lead.stage === "closed_won" || lead.stage === "closed_lost") return null;
  if (lead.followUpCount >= lead.maxFollowUps)  return null;
  if (lead.control === "human")                 return null;

  // Check timing
  if (lead.followUpNextAt) {
    const nextAt = new Date(lead.followUpNextAt).getTime();
    if (Date.now() < nextAt) return null;
  }

  const attempt = FOLLOW_UP_SCHEDULE[lead.followUpCount];
  return attempt ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build follow-up message body with template substitution
// ─────────────────────────────────────────────────────────────────────────────

export function buildFollowUpMessage(
  lead:    SalesLead,
  attempt: FollowUpVariant
): string {
  // Try category-specific first
  const categoryVariants = CATEGORY_FOLLOW_UPS[lead.category.toLowerCase()];
  let template: string;

  if (categoryVariants && lead.followUpCount === 0) {
    const idx = lead.id.charCodeAt(0) % categoryVariants.length;
    template = categoryVariants[idx];
  } else {
    template = attempt.body;
  }

  return template
    .replace(/\{\{firstName\}\}/g,    lead.contactName?.split(" ")[0] ?? "there")
    .replace(/\{\{businessName\}\}/g, lead.businessName)
    .replace(/\{\{city\}\}/g,         lead.city)
    .replace(/\{\{category\}\}/g,     lead.category.replace(/_/g, " "));
}

// ─────────────────────────────────────────────────────────────────────────────
// Record a follow-up send (update lead state)
// ─────────────────────────────────────────────────────────────────────────────

export function recordFollowUpSent(
  lead:    SalesLead,
  attempt: FollowUpVariant
): SalesLead {
  const nextAttemptIndex = lead.followUpCount + 1;
  const nextSchedule     = FOLLOW_UP_SCHEDULE[nextAttemptIndex];
  const nextAt = nextSchedule
    ? new Date(Date.now() + nextSchedule.delayHours * 3600000).toISOString()
    : undefined;

  return {
    ...lead,
    followUpCount:  lead.followUpCount + 1,
    followUpNextAt: nextAt,
    stage:          "follow_up",
    updatedAt:      new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Get all leads that are due for follow-up right now
// ─────────────────────────────────────────────────────────────────────────────

export function getLeadsDueForFollowUp(leads: SalesLead[]): SalesLead[] {
  return leads.filter((lead) => getNextFollowUp(lead) !== null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Has this lead exhausted all follow-up attempts?
// ─────────────────────────────────────────────────────────────────────────────

export function isFollowUpExhausted(lead: SalesLead): boolean {
  return (
    lead.followUpCount >= lead.maxFollowUps &&
    !lead.qualification.hasReplied
  );
}
