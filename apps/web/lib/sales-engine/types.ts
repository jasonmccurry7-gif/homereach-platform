// ─────────────────────────────────────────────────────────────────────────────
// Hybrid Sales Engine — Type Definitions
//
// AI = qualification at scale
// Human = trust + closing
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Lead Classification
// ─────────────────────────────────────────────────────────────────────────────

export type LeadTemperature = "cold" | "warm" | "hot";

export type HotSignalType =
  | "asked_pricing"
  | "said_interested"
  | "asked_how_it_works"
  | "asked_how_to_start"
  | "asked_availability"
  | "mentioned_city_category"
  | "expressed_urgency"
  | "asked_next_steps"
  | "mentioned_budget"
  | "mentioned_readiness"
  | "positive_sentiment"
  | "asked_specific_question";

export interface HotSignal {
  type:       HotSignalType;
  triggeredBy: string;    // the message text that triggered it
  confidence: number;     // 0–1
  detectedAt: string;     // ISO timestamp
}

export interface LeadClassification {
  temperature:     LeadTemperature;
  score:           number;          // 0–100
  signals:         HotSignal[];
  lastUpdated:     string;
  reasoning:       string;          // human-readable explanation
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation State
// ─────────────────────────────────────────────────────────────────────────────

export type ConversationControl = "ai" | "human" | "ai_assist";
// ai       = AI fully in control
// human    = human has taken over, AI silent
// ai_assist = AI warming seat, about to hand off

export type EscalationStatus =
  | "none"           // not escalated
  | "alert_sent"     // SMS fired to human
  | "human_alerted"  // human seen the alert
  | "human_active"   // human has replied
  | "resolved";      // deal closed or conversation ended

export type ConversationStage =
  | "initial_contact"    // first outreach sent
  | "awaiting_response"  // sent, no reply yet
  | "qualifying"         // exchange underway, gathering info
  | "warm_engaged"       // interested, exploring
  | "hot_escalated"      // HOT — surfaced to human
  | "intake_sent"        // intake form dispatched
  | "follow_up"          // re-engagement after silence
  | "closed_won"
  | "closed_lost"
  | "do_not_contact";

export interface QualificationData {
  city?:          string;
  category?:      string;
  businessName?:  string;
  interestLevel?: "none" | "curious" | "interested" | "ready";
  timeline?:      "now" | "soon" | "later" | "unknown";
  hasReplied:     boolean;
  messageCount:   number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Message
// ─────────────────────────────────────────────────────────────────────────────

export type MessageRole = "ai" | "human_agent" | "lead";
export type MessageChannel = "sms" | "email";

export interface SalesMessage {
  id:          string;
  role:        MessageRole;
  channel:     MessageChannel;
  body:        string;
  sentAt:      string;
  isRead:      boolean;
  intentScore: number;          // 0–100 — how much buying intent this message shows
  signals?:    HotSignalType[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sales Lead (enriched conversation record)
// ─────────────────────────────────────────────────────────────────────────────

export interface SalesLead {
  id:              string;
  businessName:    string;
  contactName?:    string;
  phone?:          string;
  email?:          string;
  city:            string;
  state?:          string;
  category:        string;
  source:          string;   // "outbound_sms" | "inbound" | "referral" | etc.

  classification:  LeadClassification;
  stage:           ConversationStage;
  control:         ConversationControl;
  escalation:      EscalationStatus;
  qualification:   QualificationData;

  messages:        SalesMessage[];
  summary:         string;           // 1-sentence AI-generated summary of convo
  lastMessageAt:   string;
  lastMessageBody: string;           // cached for dashboard quick-view
  lastMessageRole: MessageRole;

  agentId?:        string;
  followUpCount:   number;
  followUpNextAt?: string;
  maxFollowUps:    number;           // default 3

  monthlyValue?:   number;           // estimated deal size
  alertSentAt?:    string;           // when the hot lead SMS was fired
  alertCount:      number;           // # of alerts sent (dedupe guard)

  createdAt:       string;
  updatedAt:       string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SMS Alert
// ─────────────────────────────────────────────────────────────────────────────

export interface HotLeadAlert {
  id:           string;
  leadId:       string;
  businessName: string;
  city:         string;
  category:     string;
  summary:      string;           // 1-sentence AI summary
  lastMessage:  string;           // the triggering message from the lead
  sentTo:       string;           // phone number (Jason's)
  formattedMessage: string;       // the full SMS body
  sentAt:       string;
  status:       "sent" | "delivered" | "failed";
}

// ─────────────────────────────────────────────────────────────────────────────
// Follow-Up Sequence
// ─────────────────────────────────────────────────────────────────────────────

export interface FollowUpVariant {
  attemptNumber: number;   // 1, 2, 3
  delayHours:    number;   // how long after last message to wait
  body:          string;   // message template ({{firstName}}, {{businessName}}, {{city}})
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Stats
// ─────────────────────────────────────────────────────────────────────────────

export interface SalesEngineStats {
  totalLeads:         number;
  hot:                number;
  warm:               number;
  cold:               number;
  escalated:          number;
  humanActive:        number;
  alertsSentToday:    number;
  avgResponseTimeMin: number;
  conversionRate:     number;
  totalMRR:           number;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Response Context (fed to conversation engine)
// ─────────────────────────────────────────────────────────────────────────────

export type AIResponseIntent =
  | "initial_outreach"     // cold first touch
  | "acknowledge_reply"    // they replied — engage
  | "qualify"              // gather city / category / intent
  | "surface_value"        // lightly reinforce what we do
  | "progress_forward"     // nudge toward next step
  | "hold_for_human"       // HOT — keep warm until agent arrives
  | "objection_surface"    // acknowledge concern, don't push
  | "follow_up_1"
  | "follow_up_2"
  | "follow_up_3";

export interface AIResponseContext {
  lead:     SalesLead;
  intent:   AIResponseIntent;
  inboundMessage?: string;     // what the lead just said
}

export interface AIResponseResult {
  body:         string;
  intent:       AIResponseIntent;
  shouldEscalate: boolean;
  escalateReason?: string;
  newClassification?: LeadClassification;
}
