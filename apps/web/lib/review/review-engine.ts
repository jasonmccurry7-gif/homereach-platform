// ─────────────────────────────────────────────────────────────────────────────
// ReviewEngine — Core Review Generation Logic
//
// Handles: trigger detection, smart timing, satisfaction filtering,
// review link delivery, reminder logic, and status transitions.
// All I/O stubs are marked with TODO for real Twilio/Resend integration.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ReviewRequest, ReviewStatus, ReviewTriggerEvent,
  ReviewChannel, SatisfactionResponse, AgentReviewPrompt,
  ReviewStats,
} from "./types";
import { getReviewConfig, getReviewLink, REVIEW_TIMING_RULES } from "./review-config";
import { renderMessage } from "./message-templates";
import { MOCK_REVIEW_REQUESTS, computeReviewStats } from "./mock-review-data";

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Store (replace with repository pattern when DB is wired)
// ─────────────────────────────────────────────────────────────────────────────

let _requests: ReviewRequest[] = [...MOCK_REVIEW_REQUESTS];
let _idCounter = MOCK_REVIEW_REQUESTS.length + 1;

function generateId(): string {
  return `rr-${++_idCounter}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ReviewEngine
// ─────────────────────────────────────────────────────────────────────────────

export class ReviewEngine {

  // ── Trigger Entry Points ────────────────────────────────────────────────────

  /**
   * Call this when a trigger event occurs (design approved, campaign sent, etc.).
   * Creates a ReviewRequest and schedules the satisfaction check.
   *
   * @returns The created ReviewRequest, or null if review already exists
   */
  static triggerReview(params: {
    businessId:   string;
    businessName: string;
    contactName:  string;
    triggerEvent: ReviewTriggerEvent;
    phone?:       string;
    email?:       string;
    leadId?:      string;
    campaignId?:  string;
    agentId?:     string;
  }): ReviewRequest | null {
    const cfg = getReviewConfig();

    // Prevent duplicate requests for the same business + trigger event
    const existing = _requests.find(
      (r) =>
        r.businessId    === params.businessId &&
        r.triggerEvent  === params.triggerEvent &&
        !["completed", "declined", "filtered_negative", "feedback_submitted"].includes(r.status)
    );
    if (existing) return null;

    // Find timing rule for this event
    const timingRule = REVIEW_TIMING_RULES.find(
      (r) => r.triggerEvent === params.triggerEvent
    );
    const delayHours = timingRule?.delayHours ?? cfg.satisfactionCheckDelayHours;

    const scheduledFor = new Date();
    scheduledFor.setHours(scheduledFor.getHours() + delayHours);

    const request: ReviewRequest = {
      id:             generateId(),
      businessId:     params.businessId,
      businessName:   params.businessName,
      contactName:    params.contactName,
      phone:          params.phone,
      email:          params.email,
      leadId:         params.leadId,
      campaignId:     params.campaignId,
      triggerEvent:   params.triggerEvent,
      channel:        params.phone
        ? (params.email ? "both" : "sms")
        : "email",
      status:         "satisfaction_check_pending",
      reviewPlatform: cfg.primaryPlatform,
      scheduledFor:   scheduledFor.toISOString(),
      reminderCount:  0,
      agentId:        params.agentId,
      createdAt:      new Date().toISOString(),
    };

    _requests.push(request);
    return request;
  }

  // ── Satisfaction Check ──────────────────────────────────────────────────────

  /**
   * Send the satisfaction check for a pending request.
   * In production: calls Twilio (SMS) or Resend (email).
   */
  static sendSatisfactionCheck(requestId: string): boolean {
    const req = this._findRequest(requestId);
    if (!req || req.status !== "satisfaction_check_pending") return false;

    const cfg = getReviewConfig();
    const vars = this._buildMessageVars(req);
    const channel = req.channel === "both" ? "sms" : req.channel;
    const message = renderMessage("satisfaction_check", channel, vars);
    if (!message) return false;

    // TODO: Send via Twilio (SMS) or Resend (email)
    // if (channel === "sms") await twilio.messages.create({ to: req.phone, body: message.body })
    // if (channel === "email") await resend.emails.send({ to: req.email, subject: message.subject, html: message.body })
    console.log(`[ReviewEngine] Satisfaction check sent (${channel}):`, message.body.slice(0, 80));

    this._updateRequest(requestId, {
      status: "satisfaction_check_sent",
      sentAt: new Date().toISOString(),
    });
    return true;
  }

  // ── Process Satisfaction Response ──────────────────────────────────────────

  /**
   * Handle the client's YES/NO response to the satisfaction check.
   * YES → send review link. NO → route to internal feedback.
   */
  static processSatisfactionResponse(
    requestId: string,
    response: SatisfactionResponse
  ): void {
    const req = this._findRequest(requestId);
    if (!req) return;

    this._updateRequest(requestId, { satisfactionResponse: response });

    if (response === "positive") {
      this._sendReviewRequest(requestId);
    } else if (response === "negative") {
      this._routeToFeedback(requestId);
    }
    // "no_response" — handled by reminder logic
  }

  // ── Send Review Link ────────────────────────────────────────────────────────

  private static _sendReviewRequest(requestId: string): void {
    const req = this._findRequest(requestId);
    if (!req) return;

    const cfg  = getReviewConfig();
    const link = getReviewLink(req.reviewPlatform);
    const vars = { ...this._buildMessageVars(req), reviewLink: link };

    const channel = req.channel === "both" ? "sms" : req.channel;
    const message = renderMessage("review_request", channel, vars, req.reminderCount);
    if (!message) return;

    // TODO: Send via Twilio / Resend
    console.log(`[ReviewEngine] Review request sent (${channel}):`, message.body.slice(0, 80));

    this._updateRequest(requestId, {
      status:               "review_request_sent",
      reviewRequestSentAt:  new Date().toISOString(),
    });
  }

  // ── Send Reminder ───────────────────────────────────────────────────────────

  /**
   * Send a follow-up reminder for requests that haven't been completed.
   * Enforces max reminder count before marking as declined.
   */
  static sendReminder(requestId: string): boolean {
    const req = this._findRequest(requestId);
    if (!req || req.status !== "review_request_sent") return false;

    const cfg = getReviewConfig();
    if (req.reminderCount >= cfg.maxReminders) {
      this._updateRequest(requestId, {
        status:     "declined",
        declinedAt: new Date().toISOString(),
      });
      return false;
    }

    const link = getReviewLink(req.reviewPlatform);
    const vars = { ...this._buildMessageVars(req), reviewLink: link };
    const channel = req.channel === "both" ? "sms" : req.channel;
    const message = renderMessage("review_reminder", channel, vars, req.reminderCount);
    if (!message) return false;

    // TODO: Send via Twilio / Resend
    console.log(`[ReviewEngine] Reminder sent (${channel}):`, message.body.slice(0, 80));

    this._updateRequest(requestId, {
      reminderCount: req.reminderCount + 1,
    });
    return true;
  }

  // ── Route to Internal Feedback ──────────────────────────────────────────────

  private static _routeToFeedback(requestId: string): void {
    const req = this._findRequest(requestId);
    if (!req) return;

    const cfg  = getReviewConfig();
    const vars = this._buildMessageVars(req);
    const channel = req.channel === "both" ? "sms" : req.channel;
    const message = renderMessage("negative_feedback_route", channel, vars);
    if (!message) return;

    // TODO: Send via Twilio / Resend + create internal support ticket
    console.log(`[ReviewEngine] Routing to feedback (${channel}):`, message.body.slice(0, 80));

    this._updateRequest(requestId, { status: "filtered_negative" });
  }

  // ── Mark Completed ──────────────────────────────────────────────────────────

  /**
   * Call when admin confirms a review was left (manual check or webhook).
   */
  static markCompleted(requestId: string): void {
    this._updateRequest(requestId, {
      status:      "completed",
      completedAt: new Date().toISOString(),
    });
  }

  /**
   * Store text feedback received from the negative feedback route.
   */
  static recordFeedback(requestId: string, feedbackText: string): void {
    this._updateRequest(requestId, {
      status:           "feedback_submitted",
      internalFeedback: feedbackText,
    });
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  static getAllRequests(): ReviewRequest[] {
    return [..._requests];
  }

  static getByStatus(status: ReviewStatus): ReviewRequest[] {
    return _requests.filter((r) => r.status === status);
  }

  static getByLead(leadId: string): ReviewRequest[] {
    return _requests.filter((r) => r.leadId === leadId);
  }

  static getByBusiness(businessId: string): ReviewRequest[] {
    return _requests.filter((r) => r.businessId === businessId);
  }

  static getPendingSend(): ReviewRequest[] {
    const now = new Date();
    return _requests.filter((r) => {
      if (r.status !== "satisfaction_check_pending") return false;
      if (!r.scheduledFor) return true;
      return new Date(r.scheduledFor) <= now;
    });
  }

  static getStats(): ReviewStats {
    return computeReviewStats(_requests);
  }

  // ── Agent Review Prompts ─────────────────────────────────────────────────────

  /**
   * Generate agent prompts for which closed/active leads should be asked for a review.
   * Used in the Sales Agent Dashboard to surface "ask for review" reminders.
   */
  static getAgentReviewPrompts(
    leads: Array<{ id: string; name: string; businessName: string; status: string }>,
    agentId: string
  ): AgentReviewPrompt[] {
    return leads
      .filter((l) => l.status === "sold" || l.status === "closed_won" || l.status === "interested")
      .map((l): AgentReviewPrompt => {
        const existingReview = _requests.find(
          (r) => r.leadId === l.id && r.agentId === agentId
        );

        if (existingReview?.status === "completed") {
          return {
            leadId: l.id, leadName: l.name, businessName: l.businessName,
            status: l.status === "interested" ? "active_results" : "closed",
            reviewStatus: "completed",
            suggestedAction: "completed",
            suggestedMessage: "✅ Review received",
          };
        }
        if (existingReview?.status === "review_request_sent") {
          return {
            leadId: l.id, leadName: l.name, businessName: l.businessName,
            status: l.status === "interested" ? "active_results" : "closed",
            reviewStatus: "review_request_sent",
            suggestedAction: "follow_up",
            suggestedMessage: "💬 Review link sent — follow up if no action",
          };
        }
        if (existingReview?.status === "filtered_negative") {
          return {
            leadId: l.id, leadName: l.name, businessName: l.businessName,
            status: l.status === "interested" ? "active_results" : "closed",
            reviewStatus: "filtered_negative",
            suggestedAction: "none",
            suggestedMessage: "⚠ Routed to internal feedback",
          };
        }
        // No review request yet
        return {
          leadId: l.id, leadName: l.name, businessName: l.businessName,
          status: l.status === "interested" ? "active_results" : "closed",
          reviewStatus: undefined,
          suggestedAction: "request_now",
          suggestedMessage:
            l.status === "sold" || l.status === "closed_won"
              ? "⭐ Ask for a review — deal is closed!"
              : "⭐ Campaign is active — good time to ask",
        };
      });
  }

  // ── Display Helpers ─────────────────────────────────────────────────────────

  static getStatusMeta(status: ReviewStatus): { label: string; color: string; bg: string } {
    const map: Record<ReviewStatus, { label: string; color: string; bg: string }> = {
      satisfaction_check_pending: { label: "Scheduled",       color: "text-gray-400",   bg: "bg-gray-800" },
      satisfaction_check_sent:    { label: "Check Sent",      color: "text-blue-400",   bg: "bg-blue-900/30" },
      review_request_sent:        { label: "Link Sent",       color: "text-amber-400",  bg: "bg-amber-900/30" },
      completed:                  { label: "Completed ✓",     color: "text-green-400",  bg: "bg-green-900/30" },
      declined:                   { label: "Declined",        color: "text-gray-500",   bg: "bg-gray-800" },
      filtered_negative:          { label: "Feedback Routed", color: "text-orange-400", bg: "bg-orange-900/30" },
      feedback_submitted:         { label: "Feedback In",     color: "text-purple-400", bg: "bg-purple-900/30" },
    };
    return map[status] ?? { label: status, color: "text-gray-400", bg: "bg-gray-800" };
  }

  static getTriggerMeta(event: ReviewTriggerEvent): { label: string; icon: string } {
    const map: Record<ReviewTriggerEvent, { label: string; icon: string }> = {
      design_approved:       { label: "Design Approved",      icon: "🎨" },
      campaign_sent:         { label: "Campaign Sent",        icon: "📬" },
      campaign_delivered:    { label: "Campaign Delivered",   icon: "✅" },
      first_lead_recorded:   { label: "First Lead In",        icon: "🎯" },
    };
    return map[event];
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  private static _findRequest(id: string): ReviewRequest | undefined {
    return _requests.find((r) => r.id === id);
  }

  private static _updateRequest(id: string, patch: Partial<ReviewRequest>): void {
    _requests = _requests.map((r) => r.id === id ? { ...r, ...patch } : r);
  }

  private static _buildMessageVars(req: ReviewRequest) {
    const cfg = getReviewConfig();
    const firstName = req.contactName.split(" ")[0];
    return {
      firstName,
      businessName: req.businessName,
      agentName:    cfg.agentSignatureName,
      companyPhone: cfg.companyPhone,
    };
  }
}
