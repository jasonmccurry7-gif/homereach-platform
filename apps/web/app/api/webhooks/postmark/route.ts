import { NextResponse } from "next/server";
import {
  buildPostmarkEmailEventInsert,
  checkPostmarkWebhookAuth,
  classifyPostmarkEvent,
  getLeadEmailStatusWriteFilter,
  normalizePostmarkRecipient,
  type PostmarkPayload,
} from "@/lib/email/postmark-webhook";
import { createServiceClient } from "@/lib/supabase/service";

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
//     (only deliverability state; delivery events cannot clear suppression)
//   • Never updates outreach_messages or any send-side table.
// ─────────────────────────────────────────────────────────────────────────────

function isAuthorized(req: Request): { ok: boolean; reason?: string } {
  return checkPostmarkWebhookAuth({
    authorization: req.headers.get("authorization"),
    expectedUser: process.env.POSTMARK_WEBHOOK_USER,
    expectedPass: process.env.POSTMARK_WEBHOOK_PASSWORD,
    isProduction: process.env.NODE_ENV === "production",
  });
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

  const { eventType, bounceType, leadEmailStatus } = classifyPostmarkEvent(payload);
  const recipient = normalizePostmarkRecipient(payload);

  try {
    const supabase = createServiceClient();

    // 1. Always log the event
    const { error: logErr } = await supabase
      .from("email_events")
      .insert(
        buildPostmarkEmailEventInsert(
          payload,
          { eventType, bounceType, leadEmailStatus },
          recipient,
        ),
      );

    if (logErr) {
      console.error("[postmark/webhook] insert email_events failed:", logErr.message);
      return NextResponse.json(
        { ok: false, error: "email event persistence failed" },
        { status: 503 },
      );
    }

    // 2. Update sales_leads.email_status without letting provider noise clear suppressions.
    if (leadEmailStatus && recipient) {
      let update = supabase
        .from("sales_leads")
        .update({ email_status: leadEmailStatus })
        .eq("email", recipient);

      const writeFilter = getLeadEmailStatusWriteFilter(leadEmailStatus);
      if (writeFilter) {
        update = update.or(writeFilter);
      }

      const { error: updErr } = await update;
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
    return NextResponse.json(
      { ok: false, error: "postmark webhook processing failed" },
      { status: 503 },
    );
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
