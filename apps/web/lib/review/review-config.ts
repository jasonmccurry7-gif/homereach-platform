// ─────────────────────────────────────────────────────────────────────────────
// Review System Configuration
//
// All review links, timing rules, and behavioral settings.
// Future: load from Supabase admin config table instead of hardcoding here.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReviewConfig, ReviewTimingRule } from "./types";

// ── Default Config ────────────────────────────────────────────────────────────
// TODO: Move to DB / admin-editable settings when Supabase is wired up.

export const DEFAULT_REVIEW_CONFIG: ReviewConfig = {
  // ── Review links (admin must update these) ──────────────────────────────
  googleReviewLink:             "https://g.page/r/PLACEHOLDER/review",
  facebookReviewLink:           "https://www.facebook.com/homereach/reviews",

  primaryPlatform:              "google",
  satisfactionCheckEnabled:     true,

  // ── Timing ─────────────────────────────────────────────────────────────
  satisfactionCheckDelayHours:  24,   // wait 24h after trigger before asking
  reviewLinkDelayMinutes:       5,    // send review link 5 min after positive check
  maxReminders:                 2,    // send up to 2 follow-up reminders
  reminderIntervalDays:         7,    // wait 7 days between reminders

  // ── Delivery ────────────────────────────────────────────────────────────
  defaultChannel:               "sms",

  // ── Message identity ────────────────────────────────────────────────────
  agentSignatureName:           "The HomeReach Team",
  companyPhone:                 "(330) 867-4200",
};

// Runtime mutable — admin can update without restart in dev
let _config: ReviewConfig = { ...DEFAULT_REVIEW_CONFIG };

export function getReviewConfig(): ReviewConfig {
  return { ..._config };
}

export function updateReviewConfig(patch: Partial<ReviewConfig>): void {
  _config = { ..._config, ...patch };
}

export function resetReviewConfig(): void {
  _config = { ...DEFAULT_REVIEW_CONFIG };
}

// ── Timing Rules per Trigger Event ───────────────────────────────────────────

export const REVIEW_TIMING_RULES: ReviewTimingRule[] = [
  {
    triggerEvent:  "design_approved",
    label:         "After Design Approval",
    description:   "Sent when the admin approves the business's ad design",
    delayHours:    24,
    channels:      ["sms", "email"],
    icon:          "🎨",
  },
  {
    triggerEvent:  "campaign_sent",
    label:         "After Campaign Goes Live",
    description:   "Sent when the postcard campaign is marked as sent/mailed",
    delayHours:    48,
    channels:      ["sms", "email"],
    icon:          "📬",
  },
  {
    triggerEvent:  "campaign_delivered",
    label:         "After Confirmed Delivery",
    description:   "Sent after USPS/print vendor confirms delivery",
    delayHours:    72,
    channels:      ["sms"],
    icon:          "✅",
  },
  {
    triggerEvent:  "first_lead_recorded",
    label:         "After First Lead Comes In",
    description:   "Triggered when the first call, QR scan, or form submission is recorded",
    delayHours:    2,
    channels:      ["sms"],
    icon:          "🎯",
  },
];

/** Look up timing rule for a given trigger event */
export function getTimingRule(event: string): ReviewTimingRule | undefined {
  return REVIEW_TIMING_RULES.find((r) => r.triggerEvent === event);
}

/** Get review link for a platform */
export function getReviewLink(
  platform: "google" | "facebook" | "generic" = "google"
): string {
  const cfg = getReviewConfig();
  if (platform === "facebook") return cfg.facebookReviewLink;
  return cfg.googleReviewLink;
}
