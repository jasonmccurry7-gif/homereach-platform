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
    body: "Hi {{firstName}}, quick follow-up on the {{city}} {{category}} visibility option. Want me to send the simple coverage and pricing breakdown?",
  },
  {
    attemptNumber: 2,
    delayHours:    48,
    body: "Hi {{firstName}}, one more check-in. If staying visible in {{city}} is still on your list, I can make the next step very simple.",
  },
  {
    attemptNumber: 3,
    delayHours:    72,
    body: "Last note from me for now. If the timing is not right for {{businessName}}, I understand. I can close the loop or send the details for later.",
  },
];

// Category-specific follow-up variants for higher relevance
const CATEGORY_FOLLOW_UPS: Record<string, string[]> = {
  roofing: [
    "Hi {{firstName}}, storm season makes local trust matter. Want me to send the {{city}} roofing visibility option before the category changes?",
    "Quick follow-up: homeowners in {{city}} are making roofing decisions with real urgency. I can send a clean local coverage view.",
  ],
  hvac: [
    "Hi {{firstName}}, HVAC demand gets stressful fast for homeowners. Want the {{city}} visibility option so they remember a local name?",
    "Quick check-in: seasonal HVAC demand is rising in {{city}}. I can send the simple coverage and cost view.",
  ],
  landscaping: [
    "Hi {{firstName}}, homeowners in {{city}} are planning outdoor work. Want the landscaping visibility breakdown?",
    "Quick follow-up: this is a good window for {{city}} landscaping visibility. I can send the simple plan.",
  ],
  plumbing: [
    "Hi {{firstName}}, plumbing is one of those services people need to remember before there is a problem. Want the {{city}} visibility option?",
  ],
  painting: [
    "Hi {{firstName}}, painting decisions are picking up in {{city}}. Want me to send the local visibility plan?",
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

  if (categoryVariants?.length && lead.followUpCount === 0) {
    const idx = lead.id.charCodeAt(0) % categoryVariants.length;
    template = categoryVariants[idx] ?? attempt.body;
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
