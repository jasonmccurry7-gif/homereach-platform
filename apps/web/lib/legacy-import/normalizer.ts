// ─────────────────────────────────────────────────────────────────────────────
// Normalizer
//
// Maps raw Replit export records → clean internal models.
// Handles: field name aliases, status normalization, phone/email cleaning,
// type coercions (string booleans, string numbers), and timestamp parsing.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  LegacyBusiness, LegacyOutreach, LegacyConversation,
  LegacyMessage, LegacyCustomer,
  NormalizedBusiness, NormalizedOutreachEvent, NormalizedConversation,
  NormalizedMessage, NormalizedStatus, OutreachFlags,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// ID Generation
// ─────────────────────────────────────────────────────────────────────────────

let _seq = 1000;
function genId(prefix: string): string {
  return `${prefix}-${++_seq}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// String Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Normalize phone: strip formatting, ensure consistent "(NXX) NXX-XXXX" shape */
export function normalizePhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  }
  return raw.trim() || undefined;
}

/** Normalize email: lowercase + trim */
export function normalizeEmail(raw?: string): string | undefined {
  if (!raw) return undefined;
  const clean = raw.toLowerCase().trim();
  return clean.includes("@") ? clean : undefined;
}

/** Normalize website: strip trailing slash, ensure it has a value */
export function normalizeWebsite(raw?: string): string | undefined {
  if (!raw) return undefined;
  let url = raw.trim();
  if (!url) return undefined;
  if (!url.startsWith("http")) url = `https://${url}`;
  return url.replace(/\/$/, "");
}

/** Parse boolean-ish values from Replit ("yes", 1, "true", true) */
export function parseBool(val?: boolean | string | number | null): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "boolean") return val;
  if (typeof val === "number")  return val !== 0;
  const lower = String(val).toLowerCase().trim();
  return lower === "true" || lower === "yes" || lower === "1";
}

/** Parse number from Replit (may arrive as string) */
export function parseNumber(val?: number | string | null): number | undefined {
  if (val === null || val === undefined) return undefined;
  const n = typeof val === "number" ? val : parseFloat(String(val));
  return isNaN(n) ? undefined : n;
}

/** Normalize to ISO timestamp */
export function normalizeTimestamp(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    return new Date(raw).toISOString();
  } catch {
    return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Normalization
// Handles the full mess of Replit status variants → canonical NormalizedStatus
// ─────────────────────────────────────────────────────────────────────────────

/** All known legacy status strings → NormalizedStatus */
const STATUS_MAP: Record<string, NormalizedStatus> = {
  // Customer / active
  "customer":          "active_customer",
  "active_customer":   "active_customer",
  "active":            "active_customer",
  "paying":            "active_customer",
  "paid":              "active_customer",
  "subscribed":        "active_customer",

  // Contacted / outreach sent
  "contacted":         "contacted",
  "outreach_sent":     "contacted",
  "sms_sent":          "contacted",
  "email_sent":        "contacted",
  "messaged":          "contacted",
  "sent":              "contacted",

  // Replied
  "replied":           "replied",
  "responded":         "replied",
  "response":          "replied",

  // Interested
  "interested":        "interested",
  "hot":               "interested",
  "warm":              "interested",
  "qualified":         "interested",
  "prospect":          "interested",

  // Intake sent
  "intake_sent":       "intake_sent",
  "intake":            "intake_sent",
  "intake_delivered":  "intake_sent",
  "form_sent":         "intake_sent",

  // Booked
  "booked":            "booked",
  "appointment_set":   "booked",
  "scheduled":         "booked",

  // Scraped / not yet contacted
  "scraped":           "scraped",
  "found":             "scraped",
  "collected":         "scraped",

  // Not contacted / unworked
  "new":               "not_contacted",
  "new_lead":          "not_contacted",
  "lead":              "not_contacted",
  "pending":           "not_contacted",
  "uncontacted":       "not_contacted",
  "fresh":             "not_contacted",

  // Lost / closed
  "closed_lost":       "closed_lost",
  "lost":              "closed_lost",
  "no":                "closed_lost",
  "declined":          "closed_lost",
  "not_interested":    "closed_lost",

  // DNC
  "dnc":               "do_not_contact",
  "do_not_contact":    "do_not_contact",
  "blacklist":         "do_not_contact",
  "blocked":           "do_not_contact",
  "remove":            "do_not_contact",
};

export function normalizeStatus(raw?: string | null): NormalizedStatus {
  if (!raw) return "scraped";
  const key = raw.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_");
  return STATUS_MAP[key] ?? "not_contacted";
}

// ─────────────────────────────────────────────────────────────────────────────
// Channel / Direction normalization
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeChannel(
  raw?: string
): "sms" | "email" | "call" | "unknown" {
  if (!raw) return "unknown";
  const v = raw.toLowerCase();
  if (v === "sms" || v === "text" || v === "twilio") return "sms";
  if (v === "email" || v === "resend" || v === "sendgrid") return "email";
  if (v === "call" || v === "phone" || v === "voice") return "call";
  return "unknown";
}

export function normalizeDirection(
  raw?: string
): "inbound" | "outbound" | "unknown" {
  if (!raw) return "unknown";
  const v = raw.toLowerCase();
  if (v === "inbound" || v === "in" || v === "received") return "inbound";
  if (v === "outbound" || v === "out" || v === "sent") return "outbound";
  return "unknown";
}

export function normalizeOutreachStatus(
  raw?: string
): "sent" | "delivered" | "failed" | "replied" | "unknown" {
  if (!raw) return "unknown";
  const v = raw.toLowerCase();
  if (v === "sent")             return "sent";
  if (v === "delivered")        return "delivered";
  if (v === "failed" || v === "error" || v === "undelivered") return "failed";
  if (v === "replied" || v === "responded" || v === "received") return "replied";
  return "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// Business Normalizer
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeBusiness(
  raw: LegacyBusiness,
  outreachHistory: LegacyOutreach[] = [],
  customerRecord?: LegacyCustomer
): NormalizedBusiness {
  const now = new Date().toISOString();

  // Resolve field name aliases
  const name     = (raw.name ?? raw.business_name ?? "").trim();
  const phone    = normalizePhone(raw.phone ?? raw.phone_number);
  const email    = normalizeEmail(raw.email ?? raw.email_address);
  const website  = normalizeWebsite(raw.website ?? raw.website_url);
  const zip      = raw.zip ?? raw.zip_code;
  const category = raw.category ?? raw.business_type ?? raw.vertical;

  const status   = normalizeStatus(raw.status);

  // Outreach flags derived from history + status
  const flags = deriveOutreachFlags(
    raw,
    status,
    outreachHistory,
    customerRecord
  );

  const monthlyValue = parseNumber(customerRecord?.monthly_value ?? customerRecord?.mrr);

  return {
    id:          genId("biz"),
    legacyId:    String(raw.id ?? ""),
    name,
    phone,
    email,
    website,
    address:     raw.address,
    city:        raw.city,
    state:       raw.state,
    zip,
    category,
    placeId:     raw.place_id ?? raw.google_place_id,
    source:      raw.source ?? "unknown",
    status,
    outreachFlags: flags,
    monthlyValue,
    agentId:     customerRecord?.agent_id ? String(customerRecord.agent_id) : undefined,
    spotId:      customerRecord?.spot_id  ? String(customerRecord.spot_id)  : undefined,
    campaignId:  customerRecord?.campaign_id ? String(customerRecord.campaign_id) : undefined,
    notes:       raw.notes,
    _raw:        raw,
    createdAt:   normalizeTimestamp(raw.created_at) ?? now,
    updatedAt:   normalizeTimestamp(raw.updated_at) ?? now,
    scrapedAt:   normalizeTimestamp(raw.scraped_at),
    importedAt:  now,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Outreach Flag Derivation
// ─────────────────────────────────────────────────────────────────────────────

function deriveOutreachFlags(
  raw:       LegacyBusiness,
  status:    NormalizedStatus,
  history:   LegacyOutreach[],
  customer?: LegacyCustomer
): OutreachFlags {
  const bizHistory = history.filter((o) => {
    if (raw.id && o.business_id) return String(o.business_id) === String(raw.id);
    if (raw.phone && o.to_number) return normalizePhone(o.to_number) === normalizePhone(raw.phone ?? raw.phone_number);
    return false;
  });

  const sentEmail   = bizHistory.some((o) => normalizeChannel(o.type ?? o.channel) === "email");
  const sentSms     = bizHistory.some((o) => normalizeChannel(o.type ?? o.channel) === "sms");
  const hasReplied  = bizHistory.some((o) => o.replied_at || normalizeOutreachStatus(o.status) === "replied");
  const intakeSent  = bizHistory.some((o) =>
    (o.subject ?? "").toLowerCase().includes("intake") ||
    (o.body    ?? "").toLowerCase().includes("intake form")
  );
  const isCustomer  = status === "active_customer" || parseBool(customer?.active);
  const isDnc       = status === "do_not_contact";
  const hasScraped  = Boolean(raw.scraped_at || raw.source === "gmb_scrape" || raw.source === "csv_import");

  // Safe for NEW outreach if: not DNC, not customer, not currently in active convo
  const activeConvo = status === "replied" || status === "interested" || status === "intake_sent";
  const safe = !isDnc && !isCustomer && !activeConvo;

  let suppressionReason: string | undefined;
  if (isDnc)          suppressionReason = "Marked do_not_contact";
  else if (isCustomer) suppressionReason = "Already an active customer";
  else if (activeConvo) suppressionReason = `Active conversation (status: ${status})`;

  return {
    scraped_already:       hasScraped,
    outreach_sent_email:   sentEmail,
    outreach_sent_sms:     sentSms,
    replied:               hasReplied,
    intake_sent:           intakeSent,
    customer_active:       isCustomer,
    do_not_contact:        isDnc,
    safe_for_new_outreach: safe,
    suppression_reason:    suppressionReason,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Outreach Event Normalizer
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeOutreachEvent(
  raw: LegacyOutreach,
  businessId: string
): NormalizedOutreachEvent {
  const now = new Date().toISOString();
  return {
    id:         genId("out"),
    businessId,
    legacyId:   String(raw.id ?? ""),
    channel:    normalizeChannel(raw.type ?? raw.channel),
    status:     normalizeOutreachStatus(raw.status),
    body:       raw.body ?? raw.message,
    subject:    raw.subject,
    sentAt:     normalizeTimestamp(raw.sent_at),
    repliedAt:  normalizeTimestamp(raw.replied_at),
    _raw:       raw,
    importedAt: now,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation Normalizer
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeConversation(
  raw: LegacyConversation,
  businessId: string,
  messages: LegacyMessage[]
): NormalizedConversation {
  const now  = new Date().toISOString();
  const convMessages = messages.filter((m) =>
    raw.id && m.conversation_id && String(m.conversation_id) === String(raw.id)
  );

  const normalizedMessages: NormalizedMessage[] = convMessages.map((m) =>
    normalizeMessage(m, businessId, String(raw.id ?? ""))
  );

  const rawStatus = (raw.status ?? "").toLowerCase();
  let convStatus: NormalizedConversation["status"] = "unknown";
  if (rawStatus === "active")   convStatus = "active";
  else if (rawStatus === "closed")   convStatus = "closed";
  else if (rawStatus === "replied")  convStatus = "replied";

  return {
    id:             genId("conv"),
    businessId,
    legacyId:       String(raw.id ?? ""),
    phone:          normalizePhone(raw.phone),
    status:         convStatus,
    lastMessage:    raw.last_message,
    lastMessageAt:  normalizeTimestamp(raw.last_message_at),
    messageCount:   normalizedMessages.length,
    messages:       normalizedMessages,
    _raw:           raw,
    createdAt:      normalizeTimestamp(raw.created_at) ?? now,
    importedAt:     now,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Normalizer
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeMessage(
  raw: LegacyMessage,
  businessId?: string,
  conversationId?: string
): NormalizedMessage {
  const now = new Date().toISOString();
  return {
    id:             genId("msg"),
    conversationId: conversationId ?? String(raw.conversation_id ?? ""),
    businessId:     businessId ?? (raw.business_id ? String(raw.business_id) : undefined),
    direction:      normalizeDirection(raw.direction),
    channel:        normalizeChannel(raw.channel),
    body:           (raw.body ?? raw.message ?? "").trim(),
    status:         raw.status,
    sentAt:         normalizeTimestamp(raw.sent_at ?? raw.created_at),
    _raw:           raw,
    importedAt:     now,
  };
}
