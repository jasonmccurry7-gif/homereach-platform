import { NextResponse }       from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  requireAdminOrSalesAgent,
  resolveAgentScope,
} from "@/lib/auth/api-guards";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/leads/[leadId]
// Returns full lead detail + conversation history.
// SECURITY: Only returns lead if assigned_agent_id === user.id (or admin).
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;

  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;
  const user = guard.user!;

  const scope = resolveAgentScope(user);
  if (!scope.ok) return scope.response;

  const supabase = createServiceClient();

  // Fetch lead
  let leadQuery = supabase
    .from("sales_leads")
    .select("*")
    .eq("id", leadId);

  if (!scope.isAdmin) {
    leadQuery = leadQuery.eq("assigned_agent_id", scope.agentId);
  }

  const { data: lead, error } = await leadQuery.single();

  if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

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
