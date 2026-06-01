// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Postmark Email Provider
//
// Additive provider alongside the existing Mailgun-based sendEmail() in
// ./index.ts. Coexists behind the EMAIL_PROVIDER env var (default 'mailgun').
//
// Owner: Agent 2 — outreach-visibility branch.
// Migration:  supabase/migrations/074_email_observability.sql
// Webhook:    apps/web/app/api/webhooks/postmark/route.ts
//
// To switch sending: set EMAIL_PROVIDER=postmark in production env. The
// existing /api/admin/sales/event and other callers don't need to change —
// they call sendEmail() from ./index.ts. A future PR can add a thin router
// in ./index.ts that delegates to this provider when the flag is set; for
// now this file is standalone and importable directly when ready.
// ─────────────────────────────────────────────────────────────────────────────

import { getOwnerIdentity } from "./identity";

export interface PostmarkSendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  fromEmail?: string;
  fromName?: string;
  /** Optional Postmark message stream — defaults to 'outbound' (transactional). */
  messageStream?: string;
  /** Optional tags — useful for filtering events later. */
  tags?: string[];
  /** Optional metadata — round-tripped via Postmark webhook payloads. */
  metadata?: Record<string, string>;
  /** Optional inline or regular attachments. Content must be base64 encoded. */
  attachments?: PostmarkAttachment[];
}

export interface PostmarkSendResult {
  success: boolean;
  externalId?: string;        // Postmark MessageID
  errorCode?: number;
  error?: string;
}

export interface PostmarkAttachment {
  name: string;
  content: string;
  contentType: string;
  contentId?: string;
}

const POSTMARK_API_URL = "https://api.postmarkapp.com/email";

function resolvePublicAppUrl() {
  const candidates = [
    process.env.OUTBOUND_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") continue;
      return parsed.origin.replace(/\/+$/, "");
    } catch {
      continue;
    }
  }

  return "https://www.home-reach.com";
}

const HOMEREACH_APP_URL = resolvePublicAppUrl();

function getPostmarkConfig() {
  const token = process.env.POSTMARK_API_TOKEN;
  const owner = getOwnerIdentity();
  const fromEmail = process.env.POSTMARK_FROM_EMAIL ?? owner.defaultFromEmail ?? owner.domainEmail;
  const fromName = process.env.POSTMARK_FROM_NAME ?? "HomeReach";
  const messageStream = process.env.POSTMARK_MESSAGE_STREAM ?? "outbound";

  if (!token) {
    throw new Error("POSTMARK_API_TOKEN is required");
  }
  return { token, fromEmail, fromName, messageStream };
}

/**
 * Send a single email via Postmark.
 *
 * Returns { success, externalId, errorCode, error }. Does NOT throw on
 * Postmark API errors — returns success=false with details so callers can
 * branch without try/catch.
 *
 * Postmark error codes worth knowing:
 *   406 — inactive recipient (hard bounce / spam complaint history)
 *   422 — invalid email address
 *   401 — bad API token
 *   300 — invalid email request
 */
export async function sendEmailViaPostmark(
  options: PostmarkSendOptions,
): Promise<PostmarkSendResult> {
  try {
    const cfg = getPostmarkConfig();
    const fromEmail = options.fromEmail ?? cfg.fromEmail;
    const fromName = options.fromName ?? cfg.fromName;

    const body: Record<string, unknown> = {
      From: `${fromName} <${fromEmail}>`,
      To: options.to,
      Subject: options.subject,
      HtmlBody: options.html,
      MessageStream: options.messageStream ?? cfg.messageStream,
      TrackOpens: true,
      TrackLinks: "HtmlAndText",
      Headers: buildListUnsubscribeHeaders(options.to),
    };
    if (options.text) body.TextBody = options.text;
    if (options.replyTo) body.ReplyTo = options.replyTo;
    if (options.tags && options.tags.length > 0) body.Tag = options.tags[0];
    if (options.metadata) body.Metadata = options.metadata;
    if (options.attachments?.length) {
      body.Attachments = options.attachments.map((attachment) => ({
        Name: attachment.name,
        Content: attachment.content,
        ContentType: attachment.contentType,
        ...(attachment.contentId
          ? { ContentID: attachment.contentId.startsWith("cid:") ? attachment.contentId : `cid:${attachment.contentId}` }
          : {}),
      }));
    }

    const response = await fetch(POSTMARK_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": cfg.token,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as {
      MessageID?: string;
      ErrorCode?: number;
      Message?: string;
    };

    if (!response.ok || (data.ErrorCode && data.ErrorCode !== 0)) {
      return {
        success: false,
        errorCode: data.ErrorCode,
        error: data.Message ?? `Postmark error ${response.status}`,
      };
    }

    return { success: true, externalId: data.MessageID };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown Postmark error";
    console.error("[outreach/postmark] send failed:", error);
    return { success: false, error };
  }
}

function buildListUnsubscribeHeaders(recipient: string) {
  const email = encodeURIComponent(recipient.trim().toLowerCase());
  const owner = getOwnerIdentity();
  const unsubscribeReplyTo = encodeURIComponent(owner.defaultReplyToEmail || owner.domainEmail);
  const unsubscribeUrl = `${HOMEREACH_APP_URL}/unsubscribe?email=${email}`;
  return [
    {
      Name: "List-Unsubscribe",
      Value: `<${unsubscribeUrl}>, <mailto:${unsubscribeReplyTo}?subject=unsubscribe>`,
    },
    {
      Name: "List-Unsubscribe-Post",
      Value: "List-Unsubscribe=One-Click",
    },
  ];
}

/**
 * Read the active email provider from env. 'mailgun' (default) routes through
 * the existing sendEmail() in ./index.ts; 'postmark' routes through this file.
 *
 * Used by the future router in ./index.ts (not yet wired). For now, callers
 * who explicitly want Postmark can import sendEmailViaPostmark() directly.
 */
export function getActiveEmailProvider(): "resend" | "mailgun" | "postmark" {
  const v = (process.env.EMAIL_PROVIDER ?? "resend").toLowerCase();
  if (v === "postmark") return "postmark";
  if (v === "mailgun") return "mailgun";
  return "resend";
}
