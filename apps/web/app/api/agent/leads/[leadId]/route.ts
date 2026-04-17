import { NextResponse }       from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies }            from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/leads/[leadId]
// Returns full lead detail + conversation history.
// SECURITY: Only returns lead if assigned_agent_id === user.id (or admin).
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;

  const cookieStore = await cookies();
  const sessionClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role     = user.app_metadata?.user_role as string;
  const supabase = createServiceClient();

  // Fetch lead
  const { data: lead, error } = await supabase
    .from("sales_leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Access control: agent can only see their own leads
  if (role !== "admin" && lead.assigned_agent_id !== user.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Conversation history from sales_events
  const { data: events } = await supabase
    .from("sales_events")
    .select("id, action_type, channel, message, created_at, agent_id, revenue_cents")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true })
    .limit(100);

  // Recommended next action (simple heuristic)
  let recommendedAction = "Continue outreach";
  if (lead.status === "replied" || lead.status === "interested") {
    recommendedAction = "🔥 Respond now — lead is HOT";
  } else if (lead.status === "payment_sent") {
    recommendedAction = "💰 Follow up on payment link";
  } else if (lead.status === "contacted") {
    recommendedAction = "📞 Follow up — no reply yet";
  }

  return NextResponse.json({
    lead,
    events:               events ?? [],
    recommended_action:   recommendedAction,
    is_hot:               ["replied", "interested"].includes(lead.status),
  });
}
