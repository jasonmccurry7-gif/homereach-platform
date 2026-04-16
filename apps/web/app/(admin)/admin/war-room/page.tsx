import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import WarRoomClient from "./war-room-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "War Room — HomeReach Admin" };

interface WarRoomData {
  todaysSalesEvents: Array<{
    id: string;
    agentId: string;
    leadId: string;
    actionType: string;
    channel: string;
    city: string;
    category: string;
    message: string;
    revenueCents: number | null;
    createdAt: string;
  }>;
  salesLeadsByStatus: Array<{
    id: string;
    businessName: string;
    city: string;
    category: string;
    status: string;
    lastReplyAt: string | null;
    phone: string | null;
    email: string | null;
    assignedAgentId: string | null;
  }>;
  agentDailyStats: Array<{
    agentId: string;
    fullName: string;
    textsSent: number;
    emailsSent: number;
    callsMade: number;
    hotLeads: number;
    dealsClosed: number;
  }>;
}

async function getWarRoomData(): Promise<WarRoomData> {
  const db = createServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const todayStart = `${today}T00:00:00Z`;
  const todayEnd = `${today}T23:59:59Z`;

  // Fetch today's sales events
  const { data: todaysSalesEvents = [] } = await db
    .from("sales_events")
    .select("*")
    .gte("created_at", todayStart)
    .lte("created_at", todayEnd);

  // Fetch leads by status (hot ones)
  const { data: salesLeadsByStatus = [] } = await db
    .from("sales_leads")
    .select(
      `id, business_name, city, category, status, last_reply_at, phone, email, assigned_agent_id`
    )
    .in("status", ["replied", "interested"])
    .order("last_reply_at", { ascending: false });

  // Build agent daily stats
  const { data: agentProfiles = [] } = await db
    .from("profiles")
    .select("id, full_name")
    .eq("role", "sales_agent");

  const agentDailyStats = await Promise.all(
    agentProfiles.map(async (agent) => {
      // Count texts sent today
      const { count: textsSent = 0 } = await db
        .from("sales_events")
        .select("*", { count: "exact", head: 0 })
        .eq("agent_id", agent.id)
        .eq("channel", "sms")
        .eq("action_type", "text_sent")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);

      // Count emails sent today
      const { count: emailsSent = 0 } = await db
        .from("sales_events")
        .select("*", { count: "exact", head: 0 })
        .eq("agent_id", agent.id)
        .eq("channel", "email")
        .eq("action_type", "email_sent")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);

      // Count calls made today
      const { count: callsMade = 0 } = await db
        .from("sales_events")
        .select("*", { count: "exact", head: 0 })
        .eq("agent_id", agent.id)
        .eq("channel", "call")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);

      // Count hot leads assigned to this agent
      const { count: hotLeads = 0 } = await db
        .from("sales_leads")
        .select("*", { count: "exact", head: 0 })
        .eq("assigned_agent_id", agent.id)
        .in("status", ["replied", "interested"]);

      // Count deals closed today
      const { count: dealsClosed = 0 } = await db
        .from("sales_events")
        .select("*", { count: "exact", head: 0 })
        .eq("agent_id", agent.id)
        .eq("action_type", "deal_closed")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);

      return {
        agentId: agent.id,
        fullName: agent.full_name || "Unknown",
        textsSent: textsSent || 0,
        emailsSent: emailsSent || 0,
        callsMade: callsMade || 0,
        hotLeads: hotLeads || 0,
        dealsClosed: dealsClosed || 0,
      };
    })
  );

  return {
    todaysSalesEvents: (todaysSalesEvents || []) as any,
    salesLeadsByStatus: (salesLeadsByStatus || []) as any,
    agentDailyStats,
  };
}

export default async function WarRoomPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin/war-room");

  const data = await getWarRoomData();

  return <WarRoomClient data={data} />;
}
