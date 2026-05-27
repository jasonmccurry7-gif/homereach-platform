export interface PostmarkPayload {
  RecordType?: string;
  MessageID?: string;
  Recipient?: string;
  Email?: string;
  Subject?: string;
  Type?: string;
  TypeCode?: number;
  Description?: string;
  Details?: string;
  Tag?: string;
  ReceivedAt?: string;
  BouncedAt?: string;
  DeliveredAt?: string;
  ClickedAt?: string;
  Origin?: string;
  IP?: string;
  ClientIP?: string;
  UserAgent?: string;
  OriginalLink?: string;
  Geo?: { Country?: string; Region?: string; City?: string };
  ChangeType?: string;
  SuppressionReason?: string;
  Metadata?: Record<string, string>;
}

export type LeadEmailStatus =
  | "valid"
  | "bounced_permanent"
  | "bounced_temporary"
  | "complained"
  | "unsubscribed";

export type PostmarkEventClassification = {
  eventType: string;
  bounceType: string | null;
  leadEmailStatus: LeadEmailStatus | null;
};

export type PostmarkAuthCheckInput = {
  authorization: string | null;
  expectedUser?: string;
  expectedPass?: string;
  isProduction: boolean;
};

export type PostmarkEmailEventInsert = {
  provider: "postmark";
  event_type: string;
  message_id: string | null;
  recipient: string | null;
  subject: string | null;
  bounce_type: string | null;
  error_code: string | null;
  error_message: string | null;
  click_url: string | null;
  ip: string | null;
  user_agent: string | null;
  geo_country: string | null;
  geo_region: string | null;
  geo_city: string | null;
  tags: string[] | null;
  raw_payload: Record<string, unknown>;
};

const HARD_BOUNCE_TYPES = new Set([
  "HardBounce",
  "SpamNotification",
  "BadEmailAddress",
  "ManuallyDeactivated",
]);

const VALID_DELIVERY_WRITE_FILTER =
  "email_status.is.null,email_status.eq.unknown,email_status.eq.bounced_temporary";

const TEMPORARY_BOUNCE_WRITE_FILTER =
  "email_status.is.null,email_status.eq.unknown,email_status.eq.valid,email_status.eq.bounced_temporary";

export function normalizePostmarkRecipient(payload: PostmarkPayload): string | null {
  const recipient = (payload.Recipient ?? payload.Email ?? "").trim().toLowerCase();
  return recipient || null;
}

export function classifyPostmarkEvent(
  payload: PostmarkPayload,
): PostmarkEventClassification {
  const recordType = (payload.RecordType ?? "").toLowerCase();

  if (recordType === "delivery") {
    return {
      eventType: "delivered",
      bounceType: null,
      leadEmailStatus: "valid",
    };
  }

  if (recordType === "bounce") {
    const isHard = HARD_BOUNCE_TYPES.has(payload.Type ?? "");
    return {
      eventType: "bounce",
      bounceType: isHard ? "permanent" : "transient",
      leadEmailStatus: isHard ? "bounced_permanent" : "bounced_temporary",
    };
  }

  if (recordType === "spamcomplaint") {
    return {
      eventType: "spam_complaint",
      bounceType: null,
      leadEmailStatus: "complained",
    };
  }

  if (recordType === "open") {
    return { eventType: "open", bounceType: null, leadEmailStatus: null };
  }

  if (recordType === "click") {
    return { eventType: "click", bounceType: null, leadEmailStatus: null };
  }

  if (recordType === "subscriptionchange") {
    const unsubscribed = (payload.ChangeType ?? "").toLowerCase() === "unsubscribed";
    return {
      eventType: "subscription_change",
      bounceType: null,
      leadEmailStatus: unsubscribed ? "unsubscribed" : null,
    };
  }

  return {
    eventType: recordType || "unknown",
    bounceType: null,
    leadEmailStatus: null,
  };
}

export function getLeadEmailStatusWriteFilter(
  nextStatus: LeadEmailStatus,
): string | null {
  if (nextStatus === "valid") {
    return VALID_DELIVERY_WRITE_FILTER;
  }

  if (nextStatus === "bounced_temporary") {
    return TEMPORARY_BOUNCE_WRITE_FILTER;
  }

  return null;
}

export function checkPostmarkWebhookAuth({
  authorization,
  expectedUser,
  expectedPass,
  isProduction,
}: PostmarkAuthCheckInput): { ok: boolean; reason?: string } {
  if (!expectedUser || !expectedPass) {
    if (isProduction) {
      return {
        ok: false,
        reason: "POSTMARK_WEBHOOK_USER/PASSWORD not configured in production",
      };
    }
    return { ok: true };
  }

  const auth = authorization ?? "";
  if (!auth.toLowerCase().startsWith("basic ")) {
    return { ok: false, reason: "missing Basic Auth header" };
  }

  try {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep === -1) return { ok: false, reason: "malformed Basic Auth" };
    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);
    if (user !== expectedUser || pass !== expectedPass) {
      return { ok: false, reason: "Basic Auth mismatch" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "Basic Auth decode failed" };
  }
}

export function buildPostmarkEmailEventInsert(
  payload: PostmarkPayload,
  classification = classifyPostmarkEvent(payload),
  recipient = normalizePostmarkRecipient(payload),
): PostmarkEmailEventInsert {
  return {
    provider: "postmark",
    event_type: classification.eventType,
    message_id: payload.MessageID ?? null,
    recipient,
    subject: payload.Subject ?? null,
    bounce_type: classification.bounceType,
    error_code: payload.TypeCode ? String(payload.TypeCode) : null,
    error_message: payload.Description ?? payload.Details ?? null,
    click_url: payload.OriginalLink ?? null,
    ip: payload.ClientIP ?? payload.IP ?? null,
    user_agent: payload.UserAgent ?? null,
    geo_country: payload.Geo?.Country ?? null,
    geo_region: payload.Geo?.Region ?? null,
    geo_city: payload.Geo?.City ?? null,
    tags: payload.Tag ? [payload.Tag] : null,
    raw_payload: payload as unknown as Record<string, unknown>,
  };
}
