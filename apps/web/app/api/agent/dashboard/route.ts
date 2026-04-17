import { NextResponse }       from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies }            from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/dashboard
//
// Returns the home screen data for the authenticated agent.
// CRITICAL: All data is scoped to user.id — never accepts agent_id from params.
// Admin can preview with ?preview_agent_id= (role check required).
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const sessionClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = user.app_metadata?.user_role as string;

  // Resolve effective agent ID
  const { searchParams } = new URL(req.url);
  const previewId = searchParams.get("preview_agent_id");
  const agentId   = (role === "admin" && previewId) ? previewId : user.id;

  const supabase    = createServiceClient();
  const todayStart  = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayIso    = todayStart.toISOString();
  const h4Ago       = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  const [
    scorecardEvents,
    hotLeads,
    repliesWaiting,
    nextActions,
  ] = await Promise.all([
    // Today's activity counts
    supabase
      .from("sales_events")
      .select("action_type, revenue_cents")
      .eq("agent_id", agentId)
      .gte("created_at", todayIso),

    // Hot leads (replied/interested, last 4h)
    supabase
      .from("sales_leads")
      .select("id, business_name, city, category, status, last_reply_at, phone, email")
      .eq("assigned_agent_id", agentId)
      .in("status", ["replied", "interested"])
      .gte("last_reply_at", h4Ago)
      .order("last_reply_at", { ascending: false })
      .limit(5),

    // Replies waiting (replied status, all time for this agent)
    supabase
      .from("sales_leads")
      .select("id, business_name, city, category, last_reply_at")
      .eq("assigned_agent_id", agentId)
      .eq("status", "replied")
      .order("last_reply_at", { ascending: false })
      .limit(10),

    // Payment in queue
    supabase
      .from("sales_leads")
      .select("id, business_name, city, category, last_contacted_at")
      .eq("assigned_agent_id", agentId)
      .eq("status", "payment_sent")
      .order("last_contacted_at", { ascending: true })
      .limit(5),
  ]);

  const events = scorecardEvents.data ?? [];
  const textsSent   = events.filter(e => ["text_sent",  "sms_sent"].includes(e.action_type)).length;
  const emailsSent  = events.filter(e => ["email_sent", "fb_message_sent"].includes(e.action_type)).length;
  const repliesRec  = events.filter(e => e.action_type === "reply_received").length;
  const dealsClosed = events.filter(e => e.action_type === "deal_closed").length;
  const revCents    = events.reduce((s, e) => s + (e.revenue_cents ?? 0), 0);

  return NextResponse.json({
    agent_id: agentId,
    scorecard: { texts_sent: textsSent, emails_sent: emailsSent, replies: repliesRec, deals_closed: dealsClosed, revenue_cents: revCents },
    hot_leads:      hotLeads.data ?? [],
    replies_waiting: repliesWaiting.data ?? [],
    payment_queue:  nextActions.data ?? [],
    reply_count:    (repliesWaiting.data ?? []).length,
  });
}
