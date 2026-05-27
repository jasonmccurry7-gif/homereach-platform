export type SalesOutboundChannel = "sms" | "email" | "facebook";

export type SalesSendGuardResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status: number };

const SUPPRESSED_EMAIL_STATUSES = new Set([
  "bounced_permanent",
  "complained",
  "unsubscribed",
]);

function normalizeChannel(channel: unknown): SalesOutboundChannel | "call" | null {
  if (channel === "sms" || channel === "email" || channel === "facebook" || channel === "call") {
    return channel;
  }
  if (channel === "phone") return "call";
  return null;
}

export function resolveSalesOutboundChannel(
  actionType: string,
  requestedChannel: unknown,
): SalesSendGuardResult<SalesOutboundChannel> {
  const normalizedChannel = normalizeChannel(requestedChannel);
  let actionChannel: SalesOutboundChannel | null = null;

  if (actionType === "text_sent" || actionType === "sms_sent") {
    actionChannel = "sms";
  } else if (actionType === "email_sent") {
    actionChannel = "email";
  } else if (actionType === "facebook_sent" || actionType === "fb_message_sent") {
    actionChannel = "facebook";
  } else if (actionType === "follow_up_sent") {
    actionChannel = normalizedChannel === "sms" || normalizedChannel === "email" || normalizedChannel === "facebook"
      ? normalizedChannel
      : null;
  }

  if (!actionChannel) {
    return {
      ok: false,
      error: "Send action requires channel sms, email, or facebook.",
      status: 400,
    };
  }

  if (normalizedChannel && normalizedChannel !== actionChannel) {
    return {
      ok: false,
      error: `Action ${actionType} cannot send on channel ${requestedChannel}.`,
      status: 400,
    };
  }

  return { ok: true, value: actionChannel };
}

export function resolveStoredLeadDestination(input: {
  channel: SalesOutboundChannel;
  leadPhone?: string | null;
  leadEmail?: string | null;
  requestedToAddress?: string | null;
}): SalesSendGuardResult<string> {
  const destination = input.channel === "sms" ? input.leadPhone : input.leadEmail;

  if (input.requestedToAddress && input.requestedToAddress !== destination) {
    return {
      ok: false,
      error: "Outbound destination must match the lead's stored contact.",
      status: 400,
    };
  }

  if (!destination) {
    return {
      ok: false,
      error: `No ${input.channel} contact info for this lead.`,
      status: 400,
    };
  }

  return { ok: true, value: destination };
}

export function assertLeadCanReceiveSalesSend(input: {
  channel: SalesOutboundChannel;
  doNotContact?: boolean | null;
  smsOptOut?: boolean | null;
  isQuarantined?: boolean | null;
  emailStatus?: string | null;
}): SalesSendGuardResult<true> {
  if (input.doNotContact) {
    return { ok: false, error: "Lead is DNC. Cannot send.", status: 403 };
  }

  if (input.isQuarantined) {
    return { ok: false, error: "Lead is quarantined. Cannot send.", status: 403 };
  }

  if (input.channel === "sms" && input.smsOptOut) {
    return { ok: false, error: "Lead has opted out of SMS.", status: 403 };
  }

  if (
    input.channel === "email" &&
    SUPPRESSED_EMAIL_STATUSES.has(String(input.emailStatus ?? ""))
  ) {
    return { ok: false, error: "Lead email is suppressed.", status: 403 };
  }

  return { ok: true, value: true };
}
