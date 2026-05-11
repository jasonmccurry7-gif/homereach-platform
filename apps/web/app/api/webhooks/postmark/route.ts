import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/postmark
//
// Postmark webhook receiver. One row per event into public.email_events.
// Auto-flags permanent bounces / spam complaints / unsubscribes on
// public.sales_leads.email_status so the send path can skip them later.
//
// Postmark RecordTypes handled:
//   • Delivery          — successful delivery to recipient MTA
//   • Bounce            — hard or soft bounce
//   • SpamComplaint     — recipient marked as spam
//   • Open              — pixel opened (TrackOpens=true)
//   • Click             — link clicked (TrackLinks=HtmlAndText)
//   • SubscriptionChange — list-unsubscribe / re-subscribe
//
// Security
//   Validates HTTP Basic Auth against POSTMARK_WEBHOOK_USER /
//   POSTMARK_WEBHOOK_PASSWORD env vars. Postmark sends Basic Auth when the
//   webhook URL embeds credentials, e.g.:
//     https://USER:PASSWORD@home-reach.com/api/webhooks/postmark
//   Configure the webhook URL with credentials in Postmark console.
//
//   In production, missing credentials → 403. In development, missing creds
//   log a warning but accept the request (so local ngrok works).
//
// Mutation contract
//   • INSERT into public.email_events  (always)
//   • UPDATE public.sales_leads SET email_status = ... WHERE email = ...
//     (only on terminal events: HardBounce, SpamComplaint, Unsubscribe)
//   • Never updates outreach_messages or any send-side table.
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDER = "postmark";

function isAuthorized(req: Request): { ok: boolean; reason?: string } {
  const expectedUser = process.env.POSTMARK_WEBHOOK_USER;
  const expectedPass = process.env.POSTMARK_WEBHOOK_PASSWORD;
  const isProduction = process.env.NODE_ENV === "production";

  if (!expectedUser || !expectedPass) {
    if (isProduction) {
      return {
        ok: false,
        reason: "POSTMARK_WEBHOOK_USER/PASSWORD not configured in production",
      };
    }
    return { ok: true }; // dev: allow without creds
  }

  const auth = req.headers.get("authorization") ?? "";
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

interface PostmarkPayload {
  RecordType?: string;
  MessageID?: string;
  Recipient?: string;
  Email?: string;
  Subject?: string;
  Type?: string;            // Bounce: HardBounce / SoftBounce / Transient / etc.
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
  ChangeType?: string;       // SubscriptionChange: Unsubscribed / Subscribed
  SuppressionReason?: string;
  Metadata?: Record<string, string>;
}

function classifyEvent(p: PostmarkPayload): {
  eventType: string;
  bounceType: string | null;
  terminalLeadStatus: string | null;
} {
  const r = (p.RecordType ?? "").toLowerCase();

  if (r === "delivery") {
    return { eventType: "delivered", bounceType: null, terminalLeadStatus: "valid" };
  }
  if (r === "bounce") {
    const isHard =
      p.Type === "HardBounce" ||
      p.Type === "SpamNotification" ||
      p.Type === "BadEmailAddress" ||
      p.Type === "ManuallyDeactivated";
    return {
      eventType: "bounce",
      bounceType: isHard ? "permanent" : "transient",
      terminalLeadStatus: isHard ? "bounced_permanent" : null, // soft bounce: don't mark
    };
  }
  if (r === "spamcomplaint") {
    return { eventType: "spam_complaint", bounceType: null, terminalLeadStatus: "complained" };
  }
  if (r === "open") {
    return { eventType: "open", bounceType: null, terminalLeadStatus: null };
  }
  if (r === "click") {
    return { eventType: "click", bounceType: null, terminalLeadStatus: null };
  }
  if (r === "subscriptionchange") {
    const unsubscribed = p.ChangeType === "Unsubscribed";
    return {
      eventType: "subscription_change",
      bounceType: null,
      terminalLeadStatus: unsubscribed ? "unsubscribed" : null,
    };
  }
  return { eventType: r || "unknown", bounceType: null, terminalLeadStatus: null };
}

export async function POST(req: Request) {
  // Feature flag — not strictly necessary, but consistent with twilio webhook
  if (process.env.ENABLE_POSTMARK_WEBHOOK === "false") {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const auth = isAuthorized(req);
  if (!auth.ok) {
    console.error("[postmark/webhook] REJECTED:", auth.reason);
    return new Response("Forbidden", { status: 403 });
  }

  let payload: PostmarkPayload;
  try {
    payload = (await req.json()) as PostmarkPayload;
  } catch (err) {
    console.error("[postmark/webhook] invalid JSON:", err);
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const { eventType, bounceType, terminalLeadStatus } = classifyEvent(payload);
  const recipient = (payload.Recipient ?? payload.Email ?? "").toLowerCase() || null;

  try {
    const supabase = await createClient();

    // 1. Always log the event
    const { error: logErr } = await supabase.from("email_events").insert({
      provider: PROVIDER,
      event_type: eventType,
      message_id: payload.MessageID ?? null,
      recipient,
      subject: payload.Subject ?? null,
      bounce_type: bounceType,
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
    });

    if (logErr) {
      console.error("[postmark/webhook] insert email_events failed:", logErr.message);
      // still 200 — we don't want Postmark retrying on our DB issue
    }

    // 2. On terminal events, update sales_leads.email_status (additive write)
    if (terminalLeadStatus && recipient) {
      const { error: updErr } = await supabase
        .from("sales_leads")
        .update({ email_status: terminalLeadStatus })
        .eq("email", recipient);
      if (updErr) {
        console.warn(
          "[postmark/webhook] sales_leads update failed:",
          updErr.message,
        );
      }
    }

    return NextResponse.json({ ok: true, event: eventType });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[postmark/webhook] handler error:", msg);
    // 200 anyway — Postmark retries don't help here
    return NextResponse.json({ ok: true });
  }
}

// Health probe — Postmark webhook console hits POST, but operators may curl GET
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/webhooks/postmark",
    method: "POST",
    enabled: process.env.ENABLE_POSTMARK_WEBHOOK !== "false",
    auth_configured: Boolean(
      process.env.POSTMARK_WEBHOOK_USER && process.env.POSTMARK_WEBHOOK_PASSWORD,
    ),
  });
}
