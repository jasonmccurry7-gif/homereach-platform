// ─────────────────────────────────────────────────────────────────────────────
// Review System — Mock Data
// Simulates a realistic review request pipeline across all statuses.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReviewRequest, ReviewStats } from "./types";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function hoursAgo(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

export const MOCK_REVIEW_REQUESTS: ReviewRequest[] = [

  // ── COMPLETED (review left) ───────────────────────────────────────────────

  {
    id: "rr-1",
    businessId: "biz-1", businessName: "Townsend HVAC", contactName: "Greg Townsend",
    phone: "(330) 555-0101", email: "greg@townsend-hvac.com",
    leadId: "lead-3", campaignId: "tc-1",
    triggerEvent: "first_lead_recorded",
    channel: "sms", status: "completed",
    satisfactionResponse: "positive", reviewPlatform: "google",
    sentAt: daysAgo(14), reviewRequestSentAt: daysAgo(14), completedAt: daysAgo(12),
    reminderCount: 0, agentId: "agent-1",
    createdAt: daysAgo(15),
  },
  {
    id: "rr-2",
    businessId: "biz-2", businessName: "Frost Realty Group", contactName: "Dana Frost",
    phone: "(330) 555-0202", email: "dana@frostrealty.com",
    leadId: "lead-5",
    triggerEvent: "campaign_sent",
    channel: "email", status: "completed",
    satisfactionResponse: "positive", reviewPlatform: "google",
    sentAt: daysAgo(21), reviewRequestSentAt: daysAgo(20), completedAt: daysAgo(18),
    reminderCount: 1, agentId: "agent-2",
    createdAt: daysAgo(22),
  },
  {
    id: "rr-3",
    businessId: "biz-6", businessName: "Stow Family Dental", contactName: "Dr. Anita Mehta",
    phone: "(330) 555-0303",
    triggerEvent: "design_approved",
    channel: "sms", status: "completed",
    satisfactionResponse: "positive", reviewPlatform: "google",
    sentAt: daysAgo(30), reviewRequestSentAt: daysAgo(30), completedAt: daysAgo(28),
    reminderCount: 0, agentId: "agent-1",
    createdAt: daysAgo(31),
  },
  {
    id: "rr-4",
    businessId: "biz-7", businessName: "Vega Landscaping", contactName: "Carlos Vega",
    phone: "(330) 555-0404",
    triggerEvent: "campaign_delivered",
    channel: "sms", status: "completed",
    satisfactionResponse: "positive", reviewPlatform: "google",
    sentAt: daysAgo(10), reviewRequestSentAt: daysAgo(10), completedAt: daysAgo(8),
    reminderCount: 0, agentId: "agent-3",
    createdAt: daysAgo(11),
  },
  {
    id: "rr-5",
    businessId: "biz-8", businessName: "Hudson Roofing Pros", contactName: "Mike Sullivan",
    phone: "(330) 555-0505",
    triggerEvent: "first_lead_recorded",
    channel: "sms", status: "completed",
    satisfactionResponse: "positive", reviewPlatform: "facebook",
    sentAt: daysAgo(7), reviewRequestSentAt: daysAgo(7), completedAt: daysAgo(5),
    reminderCount: 1, agentId: "agent-2",
    createdAt: daysAgo(8),
  },
  {
    id: "rr-6",
    businessId: "biz-9", businessName: "Medina Chiropractic", contactName: "Dr. Lisa Park",
    phone: "(330) 555-0606", email: "lisa@medinachiro.com",
    triggerEvent: "campaign_sent",
    channel: "both", status: "completed",
    satisfactionResponse: "positive", reviewPlatform: "google",
    sentAt: daysAgo(45), reviewRequestSentAt: daysAgo(44), completedAt: daysAgo(42),
    reminderCount: 0, agentId: "agent-1",
    createdAt: daysAgo(46),
  },

  // ── REVIEW REQUEST SENT (waiting for action) ──────────────────────────────

  {
    id: "rr-7",
    businessId: "biz-10", businessName: "Akron Med Spa", contactName: "Jennifer Walsh",
    phone: "(330) 555-0707", email: "jen@akronmedspa.com",
    triggerEvent: "first_lead_recorded",
    channel: "both", status: "review_request_sent",
    satisfactionResponse: "positive", reviewPlatform: "google",
    sentAt: daysAgo(3), reviewRequestSentAt: daysAgo(3),
    reminderCount: 0, agentId: "agent-2",
    scheduledFor: daysAgo(-4), // next reminder in 4 days
    createdAt: daysAgo(4),
  },
  {
    id: "rr-8",
    businessId: "biz-11", businessName: "Stow Auto & Tire", contactName: "Kevin Brady",
    phone: "(330) 555-0808",
    triggerEvent: "campaign_delivered",
    channel: "sms", status: "review_request_sent",
    satisfactionResponse: "positive", reviewPlatform: "google",
    sentAt: daysAgo(5), reviewRequestSentAt: daysAgo(5),
    reminderCount: 0, agentId: "agent-3",
    createdAt: daysAgo(6),
  },

  // ── SATISFACTION CHECK SENT (awaiting response) ───────────────────────────

  {
    id: "rr-9",
    businessId: "biz-12", businessName: "North Hill Insurance", contactName: "Patricia Reed",
    phone: "(330) 555-0909",
    triggerEvent: "campaign_sent",
    channel: "sms", status: "satisfaction_check_sent",
    reviewPlatform: "google",
    sentAt: hoursAgo(6),
    reminderCount: 0, agentId: "agent-1",
    createdAt: hoursAgo(30),
  },
  {
    id: "rr-10",
    businessId: "biz-13", businessName: "Medina Plumbing Co.", contactName: "Tom Medina",
    phone: "(330) 555-1010", email: "tom@medinaplumbing.com",
    triggerEvent: "design_approved",
    channel: "email", status: "satisfaction_check_sent",
    reviewPlatform: "google",
    sentAt: hoursAgo(18),
    reminderCount: 0, agentId: "agent-2",
    createdAt: hoursAgo(42),
  },
  {
    id: "rr-11",
    businessId: "biz-14", businessName: "Hudson Fitness Studio", contactName: "Ryan Carr",
    phone: "(330) 555-1111",
    triggerEvent: "first_lead_recorded",
    channel: "sms", status: "satisfaction_check_sent",
    reviewPlatform: "google",
    sentAt: hoursAgo(2),
    reminderCount: 0, agentId: "agent-3",
    createdAt: hoursAgo(3),
  },

  // ── SCHEDULED / PENDING ───────────────────────────────────────────────────

  {
    id: "rr-12",
    businessId: "biz-15", businessName: "Akron Window & Door", contactName: "Rachel Kim",
    phone: "(330) 555-1212",
    triggerEvent: "campaign_sent",
    channel: "sms", status: "satisfaction_check_pending",
    reviewPlatform: "google",
    scheduledFor: daysAgo(-1), // sends in 1 day
    reminderCount: 0, agentId: "agent-1",
    createdAt: hoursAgo(4),
  },

  // ── DECLINED (got link, no action after max reminders) ────────────────────

  {
    id: "rr-13",
    businessId: "biz-16", businessName: "Stow Gutters & Roofing", contactName: "Bob Stanton",
    phone: "(330) 555-1313",
    triggerEvent: "campaign_sent",
    channel: "sms", status: "declined",
    satisfactionResponse: "positive", reviewPlatform: "google",
    sentAt: daysAgo(35), reviewRequestSentAt: daysAgo(34),
    declinedAt: daysAgo(20),
    reminderCount: 2, agentId: "agent-2",
    createdAt: daysAgo(36),
  },
  {
    id: "rr-14",
    businessId: "biz-17", businessName: "Hudson Tax Services", contactName: "Claire Nguyen",
    email: "claire@hudsontax.com",
    triggerEvent: "design_approved",
    channel: "email", status: "declined",
    satisfactionResponse: "positive", reviewPlatform: "google",
    sentAt: daysAgo(28), reviewRequestSentAt: daysAgo(27),
    declinedAt: daysAgo(14),
    reminderCount: 2, agentId: "agent-3",
    createdAt: daysAgo(29),
  },

  // ── FILTERED NEGATIVE (said NO to satisfaction check) ────────────────────

  {
    id: "rr-15",
    businessId: "biz-18", businessName: "Akron Budget Plumbing", contactName: "Steve Novak",
    phone: "(330) 555-1515",
    triggerEvent: "campaign_delivered",
    channel: "sms", status: "filtered_negative",
    satisfactionResponse: "negative", reviewPlatform: "google",
    sentAt: daysAgo(16), reminderCount: 0, agentId: "agent-1",
    internalFeedback: "Said postcards weren't reaching the right neighborhoods",
    createdAt: daysAgo(17),
  },
  {
    id: "rr-16",
    businessId: "biz-19", businessName: "Medina Nail Studio", contactName: "Amy Chen",
    phone: "(330) 555-1616",
    triggerEvent: "campaign_sent",
    channel: "sms", status: "feedback_submitted",
    satisfactionResponse: "negative", reviewPlatform: "google",
    sentAt: daysAgo(22), reminderCount: 0, agentId: "agent-2",
    internalFeedback: "Expected more call volume in first two weeks",
    createdAt: daysAgo(23),
  },
];

// ── Compute Stats from Mock Data ──────────────────────────────────────────────

export function computeReviewStats(
  requests: ReviewRequest[] = MOCK_REVIEW_REQUESTS
): ReviewStats {
  const checksReceived = requests.filter((r) =>
    r.satisfactionResponse === "positive" || r.satisfactionResponse === "negative"
  );
  const passed   = checksReceived.filter((r) => r.satisfactionResponse === "positive").length;
  const failed   = checksReceived.filter((r) => r.satisfactionResponse === "negative").length;
  const checksSent = requests.filter((r) =>
    r.status !== "satisfaction_check_pending"
  ).length;
  const reviewsSent = requests.filter((r) =>
    ["review_request_sent","completed","declined"].includes(r.status)
  ).length;
  const completed  = requests.filter((r) => r.status === "completed").length;
  const declined   = requests.filter((r) => r.status === "declined").length;

  // By trigger event
  const byTriggerEvent = {} as ReviewStats["byTriggerEvent"];
  for (const r of requests) {
    byTriggerEvent[r.triggerEvent] = (byTriggerEvent[r.triggerEvent] ?? 0) + 1;
  }

  // By channel
  const byChannel = { sms: 0, email: 0, both: 0 } as ReviewStats["byChannel"];
  for (const r of requests) byChannel[r.channel]++;

  // By platform
  const byPlatform = { google: 0, facebook: 0, generic: 0 } as ReviewStats["byPlatform"];
  for (const r of requests) byPlatform[r.reviewPlatform]++;

  return {
    totalRequested:          requests.length,
    satisfactionChecksSent:  checksSent,
    passedSatisfactionCheck: passed,
    failedSatisfactionCheck: failed,
    reviewRequestsSent:      reviewsSent,
    reviewsCompleted:        completed,
    reviewsDeclined:         declined,
    conversionRate:          reviewsSent > 0 ? Math.round((completed / reviewsSent) * 100) : 0,
    satisfactionPassRate:    checksSent > 0  ? Math.round((passed / checksSent) * 100)     : 0,
    byTriggerEvent,
    byChannel,
    byPlatform,
  };
}
