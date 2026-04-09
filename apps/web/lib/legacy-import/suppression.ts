// ─────────────────────────────────────────────────────────────────────────────
// Suppression Engine
//
// The single source of truth for "can we contact this business?"
// All future scraping, outreach, SMS, and email modules must call
// isOutreachAllowed() before initiating any action on a business.
//
// Rules:
//   BLOCK if: DNC | active customer | active conversation | intake in progress
//   ALLOW if: scraped/not_contacted with no prior outreach
//   ALLOW WITH CAUTION if: prior outreach sent, no reply (follow-up permitted)
// ─────────────────────────────────────────────────────────────────────────────

import type { NormalizedBusiness, NormalizedStatus, OutreachFlags } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Suppression Decision
// ─────────────────────────────────────────────────────────────────────────────

export type SuppressionDecision =
  | "allow_initial_outreach"   // never contacted — safe to start full funnel
  | "allow_followup_only"      // outreach sent, no reply — follow-up only, no cold intro
  | "block_active_customer"    // paying client — hands off
  | "block_active_conversation"// replied or in intake — preserve thread, no new cold message
  | "block_do_not_contact"     // explicit DNC
  | "block_closed_lost"        // marked lost — do not retry unless admin overrides
  | "manual_review_required";  // flagged duplicate — don't contact until resolved

export interface SuppressionResult {
  businessId:         string;
  businessName:       string;
  decision:           SuppressionDecision;
  allowed:            boolean;
  reason:             string;
  canScrapeAgain:     boolean;
  canSendEmail:       boolean;
  canSendSms:         boolean;
  canSendIntake:      boolean;
  requiresAdminOk:    boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Function
// ─────────────────────────────────────────────────────────────────────────────

export function evaluateSuppression(biz: NormalizedBusiness): SuppressionResult {
  const f = biz.outreachFlags;
  const s = biz.status;

  // ── 1. DNC — absolute block ────────────────────────────────────────────────
  if (f.do_not_contact || s === "do_not_contact") {
    return block(biz, "block_do_not_contact",
      "Marked do_not_contact — outreach permanently blocked until admin removes flag.",
      { canScrape: false, canEmail: false, canSms: false, canIntake: false, adminOk: true });
  }

  // ── 2. Active customer — hands off ────────────────────────────────────────
  if (f.customer_active || s === "active_customer") {
    return block(biz, "block_active_customer",
      "Already an active customer. Treat as client, not lead. All sales outreach blocked.",
      { canScrape: false, canEmail: false, canSms: false, canIntake: false, adminOk: false });
  }

  // ── 3. Active conversation (replied / interested / intake sent) ────────────
  if (s === "replied" || s === "interested" || s === "intake_sent" || s === "booked") {
    return block(biz, "block_active_conversation",
      `Active thread (status: ${s}). Do not restart funnel. Continue from current conversation.`,
      { canScrape: false, canEmail: false, canSms: false, canIntake: s !== "intake_sent", adminOk: false });
  }

  // ── 4. Closed lost — admin override required ───────────────────────────────
  if (s === "closed_lost") {
    return block(biz, "block_closed_lost",
      "Marked closed_lost. Outreach blocked — admin must explicitly re-activate this lead.",
      { canScrape: false, canEmail: false, canSms: false, canIntake: false, adminOk: true });
  }

  // ── 5. Contacted / outreach sent — follow-up only ─────────────────────────
  if (f.outreach_sent_email || f.outreach_sent_sms || s === "contacted") {
    return {
      businessId:         biz.id,
      businessName:       biz.name,
      decision:           "allow_followup_only",
      allowed:            true,
      reason:             "Prior outreach sent. Initial cold message blocked. Follow-up / re-engagement only.",
      canScrapeAgain:     false,  // already have their data
      canSendEmail:       !f.outreach_sent_email, // don't double-send same channel
      canSendSms:         !f.outreach_sent_sms,
      canSendIntake:      false,  // intake should only go after engagement
      requiresAdminOk:    false,
    };
  }

  // ── 6. Scraped / not contacted — allow initial outreach ───────────────────
  if (s === "scraped" || s === "not_contacted") {
    return {
      businessId:         biz.id,
      businessName:       biz.name,
      decision:           "allow_initial_outreach",
      allowed:            true,
      reason:             "Never contacted. Safe to initiate full outreach sequence.",
      canScrapeAgain:     false,  // already scraped
      canSendEmail:       true,
      canSendSms:         true,
      canSendIntake:      false,  // intake comes after engagement
      requiresAdminOk:    false,
    };
  }

  // ── Fallback: unknown status — require admin review ────────────────────────
  return block(biz, "manual_review_required",
    `Unknown/ambiguous status "${s}". Manual review required before any outreach.`,
    { canScrape: false, canEmail: false, canSms: false, canIntake: false, adminOk: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch Evaluation
// ─────────────────────────────────────────────────────────────────────────────

export interface SuppressionSummary {
  total:                  number;
  allowInitialOutreach:   number;
  allowFollowupOnly:      number;
  blockedCustomer:        number;
  blockedActiveConvo:     number;
  blockedDnc:             number;
  blockedClosedLost:      number;
  requiresManualReview:   number;
  results:                SuppressionResult[];
}

export function evaluateSuppressionBatch(
  businesses: NormalizedBusiness[]
): SuppressionSummary {
  const results = businesses.map(evaluateSuppression);

  return {
    total:                  results.length,
    allowInitialOutreach:   results.filter((r) => r.decision === "allow_initial_outreach").length,
    allowFollowupOnly:      results.filter((r) => r.decision === "allow_followup_only").length,
    blockedCustomer:        results.filter((r) => r.decision === "block_active_customer").length,
    blockedActiveConvo:     results.filter((r) => r.decision === "block_active_conversation").length,
    blockedDnc:             results.filter((r) => r.decision === "block_do_not_contact").length,
    blockedClosedLost:      results.filter((r) => r.decision === "block_closed_lost").length,
    requiresManualReview:   results.filter((r) => r.decision === "manual_review_required").length,
    results,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Guard Function — call this before any outreach action
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-flight check before initiating outreach on a business.
 * Returns { ok, reason } — if ok is false, outreach MUST NOT proceed.
 *
 * Usage:
 *   const guard = outreachGuard(biz, "sms");
 *   if (!guard.ok) throw new Error(guard.reason);
 */
export function outreachGuard(
  biz: NormalizedBusiness,
  action: "scrape" | "email" | "sms" | "intake"
): { ok: boolean; reason?: string } {
  const result = evaluateSuppression(biz);

  if (!result.allowed) {
    return { ok: false, reason: result.reason };
  }

  if (action === "scrape" && !result.canScrapeAgain) {
    return { ok: false, reason: "Business already scraped. Skip re-scrape." };
  }
  if (action === "email" && !result.canSendEmail) {
    return { ok: false, reason: "Email outreach blocked for this business." };
  }
  if (action === "sms" && !result.canSendSms) {
    return { ok: false, reason: "SMS outreach blocked for this business." };
  }
  if (action === "intake" && !result.canSendIntake) {
    return { ok: false, reason: "Intake form blocked — business not yet engaged." };
  }

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Display Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getDecisionMeta(decision: SuppressionDecision): {
  label:   string;
  color:   string;
  bg:      string;
  icon:    string;
} {
  const map: Record<SuppressionDecision, ReturnType<typeof getDecisionMeta>> = {
    allow_initial_outreach:    { label: "Clear to Contact",   color: "text-green-400",  bg: "bg-green-900/30",  icon: "✅" },
    allow_followup_only:       { label: "Follow-Up Only",     color: "text-blue-400",   bg: "bg-blue-900/30",   icon: "🔄" },
    block_active_customer:     { label: "Active Customer",    color: "text-purple-400", bg: "bg-purple-900/30", icon: "💼" },
    block_active_conversation: { label: "Active Convo",       color: "text-amber-400",  bg: "bg-amber-900/30",  icon: "💬" },
    block_do_not_contact:      { label: "Do Not Contact",     color: "text-red-400",    bg: "bg-red-900/30",    icon: "🚫" },
    block_closed_lost:         { label: "Closed / Lost",      color: "text-gray-500",   bg: "bg-gray-800",      icon: "❌" },
    manual_review_required:    { label: "Needs Review",       color: "text-orange-400", bg: "bg-orange-900/30", icon: "⚠️" },
  };
  return map[decision];
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helper
// ─────────────────────────────────────────────────────────────────────────────

function block(
  biz: NormalizedBusiness,
  decision: SuppressionDecision,
  reason: string,
  flags: { canScrape: boolean; canEmail: boolean; canSms: boolean; canIntake: boolean; adminOk: boolean }
): SuppressionResult {
  return {
    businessId:         biz.id,
    businessName:       biz.name,
    decision,
    allowed:            false,
    reason,
    canScrapeAgain:     flags.canScrape,
    canSendEmail:       flags.canEmail,
    canSendSms:         flags.canSms,
    canSendIntake:      flags.canIntake,
    requiresAdminOk:    flags.adminOk,
  };
}
