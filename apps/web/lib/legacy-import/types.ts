// ─────────────────────────────────────────────────────────────────────────────
// Legacy Data Import System — Type Definitions
//
// Two layers:
//   1. LegacyRecord* — raw shapes from Replit export (messy, inconsistent)
//   2. Normalized*   — clean internal models after transformation
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1: Raw Legacy Shapes (Replit export as-is)
// ─────────────────────────────────────────────────────────────────────────────

/** Raw business/lead record from Replit — fields may be absent or mismatched */
export interface LegacyBusiness {
  id?:              string | number;
  name?:            string;
  business_name?:   string;   // alternate field name used in some Replit tables
  phone?:           string;
  phone_number?:    string;
  email?:           string;
  email_address?:   string;
  website?:         string;
  website_url?:     string;
  address?:         string;
  city?:            string;
  state?:           string;
  zip?:             string;
  zip_code?:        string;
  category?:        string;
  business_type?:   string;
  vertical?:        string;
  place_id?:        string;
  google_place_id?: string;
  external_id?:     string;
  source?:          string;   // e.g. "gmb_scrape", "manual", "csv_import"
  status?:          string;   // raw Replit status — will be normalized
  notes?:           string;
  created_at?:      string;
  updated_at?:      string;
  scraped_at?:      string;
}

/** Raw outreach record — one row per send attempt */
export interface LegacyOutreach {
  id?:              string | number;
  business_id?:     string | number;
  business_name?:   string;
  phone?:           string;
  email?:           string;
  type?:            string;   // "sms" | "email" | "call"
  channel?:         string;
  status?:          string;   // "sent" | "delivered" | "failed" | "replied" | etc.
  message?:         string;
  body?:            string;
  subject?:         string;
  sent_at?:         string;
  delivered_at?:    string;
  replied_at?:      string;
  from_number?:     string;
  to_number?:       string;
  campaign_id?:     string | number;
  template_id?:     string | number;
  error?:           string;
  created_at?:      string;
}

/** Raw SMS conversation thread from Replit */
export interface LegacyConversation {
  id?:              string | number;
  business_id?:     string | number;
  lead_id?:         string | number;
  phone?:           string;
  business_name?:   string;
  status?:          string;   // "active" | "closed" | "replied" | etc.
  last_message?:    string;
  last_message_at?: string;
  created_at?:      string;
  updated_at?:      string;
}

/** Raw message within a conversation */
export interface LegacyMessage {
  id?:              string | number;
  conversation_id?: string | number;
  business_id?:     string | number;
  direction?:       string;   // "inbound" | "outbound"
  channel?:         string;   // "sms" | "email"
  body?:            string;
  message?:         string;
  status?:          string;
  sent_at?:         string;
  created_at?:      string;
}

/** Raw customer / active subscription record */
export interface LegacyCustomer {
  id?:              string | number;
  business_id?:     string | number;
  business_name?:   string;
  phone?:           string;
  email?:           string;
  city?:            string;
  category?:        string;
  plan?:            string;
  monthly_value?:   number | string;
  mrr?:             number | string;
  start_date?:      string;
  active?:          boolean | string | number;
  status?:          string;   // "active" | "paused" | "cancelled"
  notes?:           string;
  agent_id?:        string | number;
  spot_id?:         string | number;
  campaign_id?:     string | number;
  created_at?:      string;
}

/** Full Replit export payload */
export interface LegacyExport {
  exportedAt?:    string;
  exportVersion?: string;
  source?:        string;   // "replit" | "csv" | "manual"
  businesses?:    LegacyBusiness[];
  outreach?:      LegacyOutreach[];
  conversations?: LegacyConversation[];
  messages?:      LegacyMessage[];
  customers?:     LegacyCustomer[];
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2: Normalized Internal Models (post-import)
// ─────────────────────────────────────────────────────────────────────────────

/** Standardized lifecycle status — maps from all Replit status variants */
export type NormalizedStatus =
  | "scraped"          // seen in scrape, never contacted
  | "not_contacted"    // in system, no outreach yet
  | "contacted"        // outreach sent, no response
  | "replied"          // responded to outreach
  | "interested"       // expressed interest / hot lead
  | "intake_sent"      // intake form sent
  | "booked"           // intake completed, appointment set
  | "active_customer"  // paying client
  | "closed_lost"      // lost deal
  | "do_not_contact";  // DNC flag — never re-contact

/** Per-business outreach safety flags */
export interface OutreachFlags {
  scraped_already:       boolean;
  outreach_sent_email:   boolean;
  outreach_sent_sms:     boolean;
  replied:               boolean;
  intake_sent:           boolean;
  customer_active:       boolean;
  do_not_contact:        boolean;
  // Safety decision: can new outreach be initiated?
  safe_for_new_outreach: boolean;
  suppression_reason?:   string;   // why outreach is blocked if not safe
}

/** Normalized business record */
export interface NormalizedBusiness {
  id:              string;   // generated stable ID
  legacyId?:       string;   // original Replit id
  name:            string;
  phone?:          string;
  email?:          string;
  website?:        string;
  address?:        string;
  city?:           string;
  state?:          string;
  zip?:            string;
  category?:       string;
  placeId?:        string;
  source:          string;
  status:          NormalizedStatus;
  outreachFlags:   OutreachFlags;
  monthlyValue?:   number;
  agentId?:        string;
  spotId?:         string;
  campaignId?:     string;
  notes?:          string;
  // Preserved legacy raw fields
  _raw:            LegacyBusiness;
  // Timestamps (normalized to ISO strings)
  createdAt:       string;
  updatedAt:       string;
  scrapedAt?:      string;
  importedAt:      string;
}

/** Normalized outreach event */
export interface NormalizedOutreachEvent {
  id:           string;
  businessId:   string;
  legacyId?:    string;
  channel:      "sms" | "email" | "call" | "unknown";
  status:       "sent" | "delivered" | "failed" | "replied" | "unknown";
  body?:        string;
  subject?:     string;
  sentAt?:      string;
  repliedAt?:   string;
  _raw:         LegacyOutreach;
  importedAt:   string;
}

/** Normalized conversation thread */
export interface NormalizedConversation {
  id:           string;
  businessId:   string;
  legacyId?:    string;
  phone?:       string;
  status:       "active" | "closed" | "replied" | "unknown";
  lastMessage?: string;
  lastMessageAt?: string;
  messageCount: number;
  messages:     NormalizedMessage[];
  _raw:         LegacyConversation;
  createdAt:    string;
  importedAt:   string;
}

/** Normalized individual message */
export interface NormalizedMessage {
  id:             string;
  conversationId: string;
  businessId?:    string;
  direction:      "inbound" | "outbound" | "unknown";
  channel:        "sms" | "email" | "unknown";
  body:           string;
  status?:        string;
  sentAt?:        string;
  _raw:           LegacyMessage;
  importedAt:     string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dedupe + Identity Matching
// ─────────────────────────────────────────────────────────────────────────────

export type DedupeConfidence = "high" | "medium" | "low";

export interface DedupeMatch {
  incomingId:   string;    // ID of the record being imported
  existingId:   string;    // ID of the record already in system
  confidence:   DedupeConfidence;
  matchedOn:    string[];  // e.g. ["phone", "email"], ["business_name", "city"]
  action:       "merge" | "flag_for_review" | "skip";
  reason:       string;
}

export interface DedupeResult {
  isNew:         boolean;
  match?:        DedupeMatch;
  normalizedId:  string;   // ID to use going forward (new or existing)
}

// ─────────────────────────────────────────────────────────────────────────────
// Import Run Result
// ─────────────────────────────────────────────────────────────────────────────

export type ImportRecordStatus =
  | "imported"        // clean import, no conflicts
  | "merged"          // merged into existing record (high confidence)
  | "flagged"         // possible duplicate, needs human review
  | "skipped"         // exact duplicate, identical record
  | "error";          // failed to parse / normalize

export interface ImportRecord {
  id:           string;
  type:         "business" | "outreach" | "conversation" | "message" | "customer";
  status:       ImportRecordStatus;
  normalizedId: string;
  legacyId?:    string;
  name?:        string;
  reason?:      string;   // why flagged/skipped/errored
  dedupe?:      DedupeMatch;
  importedAt:   string;
}

export interface ImportReport {
  runId:         string;
  startedAt:     string;
  completedAt:   string;
  source:        string;
  // Totals
  totalBusinesses:         number;
  totalOutreach:           number;
  totalConversations:      number;
  totalMessages:           number;
  totalCustomers:          number;
  // Outcomes
  imported:                number;
  merged:                  number;
  flagged:                 number;
  skipped:                 number;
  errors:                  number;
  // Safety summary
  activeCustomers:         number;
  safeForOutreach:         number;
  suppressedFromOutreach:  number;
  doNotContact:            number;
  requiresManualReview:    number;
  // Record log
  records:                 ImportRecord[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Import State (for the dashboard)
// ─────────────────────────────────────────────────────────────────────────────

export type ImportPhase =
  | "idle"
  | "ingesting"
  | "normalizing"
  | "deduping"
  | "applying_suppression"
  | "complete"
  | "error";

export interface ImportState {
  phase:         ImportPhase;
  progress:      number;   // 0–100
  message:       string;
  report?:       ImportReport;
  businesses:    NormalizedBusiness[];
  outreach:      NormalizedOutreachEvent[];
  conversations: NormalizedConversation[];
  error?:        string;
}
