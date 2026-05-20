import { NextResponse } from "next/server";
import twilio from "twilio";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/twilio/status
//
// Twilio status callback webhook. Receives delivery status updates for SMS
// messages sent via /api/admin/sales/event or any other Twilio send path.
//
// Twilio fires this webhook at every status transition:
//   queued → sent → delivered           (success path)
//   queued → sent → undelivered         (carrier rejected after acceptance)
//   queued → failed                     (network / config error)
//   queued → sent → undelivered → failed
//
// Each callback is logged as a row in public.twilio_message_status.
// Append-only: multiple rows per message_sid are expected.
//
// Security
//   Validates X-Twilio-Signature using the Twilio SDK's validateRequest.
//   In production: invalid signatures return 403.
//   In development: invalid signatures log a warning but continue (allows
//   local ngrok testing where the URL may not match).
//
// Feature flag
//   ENABLE_TWILIO_STATUS_WEBHOOK (default: enabled).
//   Set to "false" to make the route a no-op without removing it.
//
// Activation (after deploy)
//   In Twilio console, set the StatusCallback URL on each messaging service
//   (and/or single phone number) to:
//     https://<your-domain>/api/webhooks/twilio/status
//
// Mutation contract
//   This route ONLY inserts into public.twilio_message_status. It NEVER
//   updates outreach_messages, sales_events, or any send-side table.
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_TWIML = new Response("<Response/>", {
  headers: { "Content-Type": "text/xml" },
});

export async function POST(req: Request) {
  // ── Feature flag — allow disabling without removing the route ─────────────
  if (process.env.ENABLE_TWILIO_STATUS_WEBHOOK === "false") {
    return EMPTY_TWIML;
  }

  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const isProduction = process.env.NODE_ENV === "production";

    // Read body once for both signature validation and parsing.
    const rawText = await req.text();
    const params: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(rawText)) {
      params[k] = v;
    }

    // ── Twilio signature validation ──────────────────────────────────────
    if (authToken) {
      const twilioSignature = req.headers.get("X-Twilio-Signature") ?? "";
      const url = process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/status`
        : req.url;

      const isValid = twilio.validateRequest(
        authToken,
        twilioSignature,
        url,
        params,
      );

      if (!isValid) {
        if (isProduction) {
          console.error(
            "[twilio/status] REJECTED — invalid Twilio signature",
          );
          return new Response("Forbidden", { status: 403 });
        }
        console.warn(
          "[twilio/status] WARNING — invalid Twilio signature (ignored in dev)",
        );
      }
    } else if (isProduction) {
      // No auth token in production: fail closed for safety.
      console.error(
        "[twilio/status] REJECTED — TWILIO_AUTH_TOKEN not set in production",
      );
      return new Response("Forbidden", { status: 403 });
    }

    // ── Extract status fields ────────────────────────────────────────────
    const messageSid = params["MessageSid"] ?? params["SmsSid"] ?? null;
    const messageStatus =
      params["MessageStatus"] ?? params["SmsStatus"] ?? null;

    if (!messageSid || !messageStatus) {
      // Not a status callback shape — ack with 200 so Twilio doesn't retry.
      return EMPTY_TWIML;
    }

    // ── Insert into twilio_message_status (additive — never updates sends) ──
    const supabase = await createClient();
    const { error } = await supabase.from("twilio_message_status").insert({
      message_sid:           messageSid,
      message_status:        messageStatus,
      error_code:            params["ErrorCode"] ?? null,
      error_message:         params["ErrorMessage"] ?? null,
      to_number:             params["To"] ?? null,
      from_number:           params["From"] ?? null,
      messaging_service_sid: params["MessagingServiceSid"] ?? null,
      sms_sid:               params["SmsSid"] ?? null,
      account_sid:           params["AccountSid"] ?? null,
      api_version:           params["ApiVersion"] ?? null,
      raw_payload:           params,
    });

    if (error) {
      // Log but still 200 — Twilio retries don't help on a DB issue.
      console.error("[twilio/status] insert failed:", error.message);
    }

    return EMPTY_TWIML;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[twilio/status] handler error:", msg);
    // Return 200 anyway — Twilio retries are not helpful here.
    return EMPTY_TWIML;
  }
}

// Also expose GET so health checks / manual probes don't 405.
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/webhooks/twilio/status",
    method: "POST",
    enabled: process.env.ENABLE_TWILIO_STATUS_WEBHOOK !== "false",
  });
}
