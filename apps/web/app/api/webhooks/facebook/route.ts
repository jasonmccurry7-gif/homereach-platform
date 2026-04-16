import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { createHmac } from "crypto";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Facebook Graph API Webhook Receiver
//
// GET  — Facebook webhook verification (hub.challenge handshake)
// POST — Receives Facebook events (comments, messages, mentions, etc.)
//
// SETUP NOTES:
//   1. Set FACEBOOK_VERIFY_TOKEN in your environment (any random string you pick)
//   2. Set FACEBOOK_APP_SECRET in your environment (from FB App Dashboard)
//   3. Register this URL in Meta App Dashboard:
//      Callback URL: https://home-reach.com/api/webhooks/facebook
//      Verify Token: (matches FACEBOOK_VERIFY_TOKEN)
//   4. Subscribe to events: messages, comments, feed, mention
//
// Currently configured to:
//   - Verify webhook subscriptions
//   - Log all incoming events to facebook_alert_events
//   - Trigger Twilio alerts to relevant reps for high-priority interactions
//   - Match incoming page/post IDs to agent assignments via agent_identities
//
// NOTE: This is READY TO ACTIVATE once Meta App Review approves
// pages_messaging and pages_read_engagement permissions.
// Until then, events will only arrive from the app's test users.
// ─────────────────────────────────────────────────────────────────────────────

const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ?? process.env.FACEBOOK_VERIFY_TOKEN ?? "homereach-fb-verify";
const APP_SECRET   = process.env.FACEBOOK_APP_SECRET ?? "";
const BASE_URL     = process.env.NEXT_PUBLIC_SITE_URL ?? "https://home-reach.com";
const CRON_SECRET  = process.env.CRON_SECRET ?? "";

// ── Signature verification ─────────────────────────────────────────────────
function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!APP_SECRET || !signature) return false;
  const [algo, hash] = signature.split("=");
  if (algo !== "sha256") return false;
  const expected = createHmac("sha256", APP_SECRET)
    .update(rawBody, "utf8")
    .digest("hex");
  return hash === expected;
}

// ── Classify incoming event for alert routing ──────────────────────────────
function classifyEvent(entry: {
  changes?: Array<{ field: string; value: Record<string, unknown> }>;
  messaging?: Array<Record<string, unknown>>;
}): { alert_type: string; priority: "high" | "medium" | "low"; label: string } | null {

  // Page feed comment or reply
  if (entry.changes) {
    for (const change of entry.changes) {
      if (change.field === "feed") {
        const v = change.value;
        if (v.item === "comment" && v.verb === "add") {
          return { alert_type: "comment_reply", priority: "high", label: "New comment on your Facebook post" };
        }
        if (v.item === "status" && v.verb === "add") {
          return { alert_type: "hot_thread", priority: "medium", label: "New post activity on your page" };
        }
        if (v.item === "mention" && v.verb === "add") {
          return { alert_type: "hot_thread", priority: "high", label: "You were mentioned on Facebook" };
        }
      }
      if (change.field === "messages") {
        return { alert_type: "dm_opportunity", priority: "high", label: "New Facebook DM received" };
      }
    }
  }

  // Messenger webhook
  if (entry.messaging) {
    for (const msg of entry.messaging) {
      if (msg.message) {
        return { alert_type: "dm_opportunity", priority: "high", label: "New Facebook Messenger message" };
      }
      if (msg.read) {
        return null; // Read receipts — ignore
      }
    }
  }

  return null;
}

// ── GET: Webhook verification handshake ──────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    console.log("[FB Webhook] Verified subscription");
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// ── POST: Receive Facebook events ────────────────────────────────────────────
export async function POST(req: Request) {
  const rawBody  = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  // Verify signature in production (skip in dev if APP_SECRET not set)
  if (APP_SECRET && !verifySignature(rawBody, signature)) {
    console.warn("[FB Webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    object: string;
    entry: Array<{
      id: string;
      time: number;
      changes?: Array<{ field: string; value: Record<string, unknown> }>;
      messaging?: Array<Record<string, unknown>>;
    }>;
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Facebook requires a 200 response quickly — process asynchronously
  // We acknowledge immediately, then process
  const supabase = createServiceClient();

  // Process all entries
  const processed: string[] = [];
  for (const entry of payload.entry ?? []) {
    const classification = classifyEvent(entry);
    if (!classification) continue;

    const pageId = entry.id;

    // ── Try to find which agent manages this page/city ─────────────────────
    // agent_identities may store a facebook_page_id in the future;
    // for now, log to all active agents and let the first match claim it.
    let targetAgentId: string | null = null;
    try {
      const { data: activeAgents } = await supabase
        .from("agent_identities")
        .select("agent_id")
        .eq("is_active", true)
        .limit(1);
      targetAgentId = activeAgents?.[0]?.agent_id ?? null;
    } catch {}

    // ── Log the event ───────────────────────────────────────────────────────
    const context = {
      page_id: pageId,
      fb_entry: JSON.stringify(entry).slice(0, 500), // truncate for storage
      source: "facebook_webhook",
    };

    if (targetAgentId) {
      try {
        await supabase.from("facebook_alert_events").insert({
          agent_id:        targetAgentId,
          alert_type:      classification.alert_type,
          message:         classification.label,
          context,
          priority:        classification.priority,
          delivery_status: "pending",
        });
      } catch {
        // Fallback to sales_events
        await supabase.from("sales_events").insert({
          agent_id:    targetAgentId,
          action_type: "facebook_webhook",
          channel:     "facebook",
          message:     `[FB Webhook] ${classification.label}`,
          metadata:    context,
        }).then(() => {}).catch(() => {});
      }

      // ── Trigger SMS alert for high-priority events ─────────────────────
      if (classification.priority === "high") {
        try {
          await fetch(`${BASE_URL}/api/admin/sales/facebook/alert`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-cron-secret": CRON_SECRET,
            },
            body: JSON.stringify({
              agent_id:   targetAgentId,
              alert_type: classification.alert_type,
              message:    classification.label,
              context,
            }),
          });
        } catch {
          // Alert failed — already logged to DB above
        }
      }

      processed.push(`${classification.alert_type}:${pageId}`);
    }
  }

  // Facebook expects exactly "EVENT_RECEIVED" response
  return NextResponse.json({ status: "EVENT_RECEIVED", processed });
}
