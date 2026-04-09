// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Review Generation System — Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

// ── Core Enums ────────────────────────────────────────────────────────────────

/** The lifecycle stage of a review request */
export type ReviewStatus =
  | "satisfaction_check_pending"  // waiting to send the "are you happy?" check
  | "satisfaction_check_sent"     // satisfaction check sent, awaiting response
  | "review_request_sent"         // passed check, review link sent
  | "completed"                   // client left a review
  | "declined"                    // received link but didn't leave review (after max reminders)
  | "filtered_negative"           // failed satisfaction check → routed to internal feedback
  | "feedback_submitted";         // internal feedback received (after negative filter)

/** Which event automatically triggered this review request */
export type ReviewTriggerEvent =
  | "design_approved"       // ad design was approved by admin
  | "campaign_sent"         // campaign marked as sent/live
  | "campaign_delivered"    // campaign confirmed delivered (USPS/print confirmed)
  | "first_lead_recorded";  // first inbound call, form, or QR scan recorded

/** How the request was delivered */
export type ReviewChannel = "sms" | "email" | "both";

/** Which review platform to direct the client to */
export type ReviewPlatform = "google" | "facebook" | "generic";

/** How the client responded to the satisfaction check */
export type SatisfactionResponse = "positive" | "negative" | "no_response";

// ── Core Models ───────────────────────────────────────────────────────────────

export interface ReviewRequest {
  id:                     string;
  businessId:             string;
  businessName:           string;
  contactName:            string;
  phone?:                 string;
  email?:                 string;
  leadId?:                string;
  campaignId?:            string;
  triggerEvent:           ReviewTriggerEvent;
  channel:                ReviewChannel;
  status:                 ReviewStatus;
  satisfactionResponse?:  SatisfactionResponse;
  reviewPlatform:         ReviewPlatform;
  scheduledFor?:          string;   // ISO: when to send next message
  sentAt?:                string;   // ISO: when satisfaction check was sent
  reviewRequestSentAt?:   string;   // ISO: when review link was sent
  completedAt?:           string;   // ISO: when review was confirmed
  declinedAt?:            string;   // ISO: when declared declined (max reminders hit)
  reminderCount:          number;   // how many follow-up reminders sent so far
  agentId?:               string;   // sales agent who owns this relationship
  internalFeedback?:      string;   // feedback from negative filter
  createdAt:              string;
}

// ── Configuration ─────────────────────────────────────────────────────────────

export interface ReviewConfig {
  googleReviewLink:             string;
  facebookReviewLink:           string;
  primaryPlatform:              ReviewPlatform;
  satisfactionCheckEnabled:     boolean;
  satisfactionCheckDelayHours:  number;  // delay after trigger before sending check
  reviewLinkDelayMinutes:       number;  // delay after positive check before sending link
  maxReminders:                 number;  // max follow-up attempts before marking declined
  reminderIntervalDays:         number;  // days between reminders
  defaultChannel:               ReviewChannel;
  agentSignatureName:           string;  // e.g. "The HomeReach Team"
  companyPhone:                 string;  // used in negative-filter feedback message
}

// ── Timing Rules (per trigger event) ─────────────────────────────────────────

export interface ReviewTimingRule {
  triggerEvent:        ReviewTriggerEvent;
  label:               string;
  description:         string;
  delayHours:          number;   // hours after event to send satisfaction check
  channels:            ReviewChannel[];
  icon:                string;
}

// ── Message Templates ─────────────────────────────────────────────────────────

export type MessageType =
  | "satisfaction_check"
  | "review_request"
  | "review_reminder"
  | "negative_feedback_route";

export interface MessageTemplate {
  type:        MessageType;
  channel:     "sms" | "email";
  subject?:    string;    // email only
  body:        string;    // use {{firstName}}, {{businessName}}, {{reviewLink}}, {{phone}} placeholders
  variantIdx:  number;    // 0, 1, 2 for A/B rotation
}

export interface RenderedMessage {
  subject?:  string;
  body:      string;
  channel:   "sms" | "email";
}

// ── Dashboard Stats ───────────────────────────────────────────────────────────

export interface ReviewStats {
  totalRequested:          number;
  satisfactionChecksSent:  number;
  passedSatisfactionCheck: number;
  failedSatisfactionCheck: number;
  reviewRequestsSent:      number;
  reviewsCompleted:        number;
  reviewsDeclined:         number;
  conversionRate:          number;   // completions / review_requests_sent × 100
  satisfactionPassRate:    number;   // passed / checks_sent × 100
  byTriggerEvent:          Record<ReviewTriggerEvent, number>;
  byChannel:               Record<ReviewChannel, number>;
  byPlatform:              Record<ReviewPlatform, number>;
}

// ── Agent Review Prompt ───────────────────────────────────────────────────────

export interface AgentReviewPrompt {
  leadId:        string;
  leadName:      string;
  businessName:  string;
  status:        "closed" | "active_results";
  reviewStatus?: ReviewStatus;  // undefined = not yet requested
  suggestedAction: "request_now" | "follow_up" | "completed" | "none";
  suggestedMessage: string;
}
