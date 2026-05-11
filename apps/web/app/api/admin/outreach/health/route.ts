import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getEmailRotationPool,
  getOutreachSafetyConfig,
  getOwnerIdentity,
} from "@homereach/services/outreach";

export const dynamic = "force-dynamic";

type GenericRow = Record<string, unknown>;

type SafeResult<T> = {
  data: T | null;
  count?: number | null;
  error?: string;
};

type QueryResponse<T> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

const OWNER_ACTION_ITEMS = [
  {
    id: "twilio-a2p",
    status: "required_before_live_sms",
    task: "Confirm Twilio/A2P approval for +13302069639 or keep SMS live sending disabled.",
  },
  {
    id: "twilio-webhooks",
    status: "required",
    task: "Point Twilio inbound SMS and status callbacks at the production webhook URLs.",
  },
  {
    id: "email-dns",
    status: "required_before_rotation",
    task: "Verify SPF, DKIM, and DMARC for home-reach.com before enabling domain email volume.",
  },
  {
    id: "provider-identities",
    status: "required_before_rotation",
    task: "Verify Jason@home-reach.com, Jasonmccurry7@gmail.com, and Livetogivemarketing@gmail.com in the chosen email provider.",
  },
  {
    id: "supabase-migration",
    status: "required",
    task: "Apply supabase/migrations/086_outreach_owner_controls.sql to production before enabling the new controls.",
  },
  {
    id: "production-env",
    status: "required",
    task: "Set the owner identity and outreach safety environment variables in Vercel or the production host.",
  },
  {
    id: "legal-review",
    status: "recommended",
    task: "Confirm outreach, opt-out, and one-to-one prospecting rules with counsel before scaling volume.",
  },
];

async function safeQuery<T>(
  query: () => PromiseLike<QueryResponse<T>>,
): Promise<SafeResult<T>> {
  try {
    const result = await query();
    if (result.error) {
      return { data: null, count: result.count, error: result.error.message };
    }
    return { data: result.data, count: result.count };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function arrayData(result: SafeResult<GenericRow[]>): GenericRow[] {
  return Array.isArray(result.data) ? result.data : [];
}

function countBy(rows: GenericRow[], key: string): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = String(row[key] ?? "unknown");
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function countMatching(rows: GenericRow[], key: string, values: string[]): number {
  const allowed = new Set(values);
  return rows.filter((row) => allowed.has(String(row[key] ?? ""))).length;
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const db = createServiceClient();
  const owner = getOwnerIdentity();
  const safety = getOutreachSafetyConfig();
  const today = new Date().toISOString().slice(0, 10);
  const sinceSevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    controls,
    ownerSettings,
    senderHealth,
    todayCounts,
    autoSendsToday,
    emailEvents,
    twilioEvents,
    salesEventsToday,
    twilioA2p,
  ] = await Promise.all([
    safeQuery<GenericRow>(() =>
      db.from("system_controls").select("*").eq("id", 1).maybeSingle(),
    ),
    safeQuery<GenericRow>(() =>
      db.from("outreach_owner_settings").select("*").eq("id", 1).maybeSingle(),
    ),
    safeQuery<GenericRow[]>(() =>
      db.from("v_sender_health" as never).select("*").limit(100),
    ),
    safeQuery<GenericRow[]>(() =>
      db
        .from("agent_daily_send_counts")
        .select("agent_id, send_date, channel, sent_count, count")
        .eq("send_date", today),
    ),
    safeQuery<GenericRow[]>(() =>
      db
        .from("auto_send_log")
        .select("status, channel, created_at")
        .gte("created_at", `${today}T00:00:00.000Z`)
        .limit(1000),
    ),
    safeQuery<GenericRow[]>(() =>
      db
        .from("email_events")
        .select("provider, event_type, recipient, received_at")
        .gte("received_at", sinceSevenDays)
        .limit(1000),
    ),
    safeQuery<GenericRow[]>(() =>
      db
        .from("twilio_message_status")
        .select("message_status, error_code, to_number, from_number, received_at")
        .gte("received_at", sinceSevenDays)
        .limit(1000),
    ),
    safeQuery<GenericRow[]>(() =>
      db
        .from("sales_events")
        .select("action_type, channel, created_at, metadata")
        .gte("created_at", `${today}T00:00:00.000Z`)
        .limit(1000),
    ),
    safeQuery<GenericRow[]>(() =>
      db.from("twilio_a2p_status").select("*").limit(5),
    ),
  ]);

  const emailRows = arrayData(emailEvents);
  const twilioRows = arrayData(twilioEvents);
  const autoSendRows = arrayData(autoSendsToday);
  const salesRows = arrayData(salesEventsToday);

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    identity: {
      owner,
      rotation_pool: getEmailRotationPool(owner),
      safety,
      database_settings: ownerSettings.data,
    },
    controls: controls.data,
    sender_health: senderHealth.data ?? [],
    today_counts: todayCounts.data ?? [],
    metrics: {
      auto_sends_today: {
        total_sampled: autoSendRows.length,
        by_status: countBy(autoSendRows, "status"),
        by_channel: countBy(autoSendRows, "channel"),
      },
      sales_events_today: {
        total_sampled: salesRows.length,
        by_action_type: countBy(salesRows, "action_type"),
        by_channel: countBy(salesRows, "channel"),
      },
      email_deliverability_7d: {
        total_sampled: emailRows.length,
        by_provider: countBy(emailRows, "provider"),
        by_event_type: countBy(emailRows, "event_type"),
        risk_events: countMatching(emailRows, "event_type", [
          "bounce",
          "spam_complaint",
          "unsubscribe",
          "subscription_change",
        ]),
      },
      sms_deliverability_7d: {
        total_sampled: twilioRows.length,
        by_status: countBy(twilioRows, "message_status"),
        failed_or_blocked: countMatching(twilioRows, "message_status", [
          "failed",
          "undelivered",
        ]),
      },
      twilio_a2p_status: twilioA2p.data ?? [],
    },
    owner_action_items: OWNER_ACTION_ITEMS,
    source_errors: {
      controls: controls.error,
      owner_settings: ownerSettings.error,
      sender_health: senderHealth.error,
      today_counts: todayCounts.error,
      auto_send_log: autoSendsToday.error,
      email_events: emailEvents.error,
      twilio_message_status: twilioEvents.error,
      sales_events: salesEventsToday.error,
      twilio_a2p_status: twilioA2p.error,
    },
  });
}
