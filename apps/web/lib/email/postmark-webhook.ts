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
