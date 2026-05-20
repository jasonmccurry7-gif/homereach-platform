import { NextResponse }       from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies }            from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";

// GET /api/agent/actions — priority actions scoped to authenticated agent
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role    = user.app_metadata?.user_role as string;
  const { searchParams } = new URL(req.url);
  const preview = searchParams.get("preview_agent_id");
  const agentId = (role === "admin" && preview) ? preview : user.id;

  const supabase = createServiceClient();
  const h6Ago   = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const h2Ago   = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const [replied, paymentStale, contactedStale] = await Promise.all([
    supabase.from("sales_leads")
      .select("id, business_name, city, category, last_reply_at")
      .eq("assigned_agent_id", agentId).eq("status", "replied")
      .order("last_reply_at", { ascending: false }).limit(10),

    supabase.from("sales_leads")
      .select("id, business_name, city, category, last_contacted_at")
      .eq("assigned_agent_id", agentId).eq("status", "payment_sent")
      .lt("last_contacted_at", h6Ago).limit(10),

    supabase.from("sales_leads")
      .select("id, business_name, city, category, last_contacted_at")
      .eq("assigned_agent_id", agentId).eq("status", "contacted")
      .lt("last_contacted_at", h6Ago).limit(10),
  ]);

  const actions: Array<{ id: string; label: string; urgency: string; lead_id: string; deep_link: string }> = [];

  for (const lead of (replied.data ?? [])) {
    const hrs = lead.last_reply_at ? (Date.now() - new Date(lead.last_reply_at).getTime()) / 3600000 : 0;
    actions.push({
      id:        `reply_${lead.id}`,
      label:     `💬 ${lead.business_name} (${lead.city}) replied ${hrs < 1 ? "< 1h" : `${Math.floor(hrs)}h`} ago`,
      urgency:   hrs < 2 ? "critical" : "high",
      lead_id:   lead.id,
      deep_link: `/agent/replies/${lead.id}`,
    });
  }
  for (const lead of (paymentStale.data ?? [])) {
    actions.push({
      id:        `payment_${lead.id}`,
      label:     `💰 ${lead.business_name} — payment link sent, follow up now`,
      urgency:   "high",
      lead_id:   lead.id,
      deep_link: `/agent/payment-follow-up/${lead.id}`,
    });
  }
  for (const lead of (contactedStale.data ?? [])) {
    actions.push({
      id:        `followup_${lead.id}`,
      label:     `📞 ${lead.business_name} (${lead.city}) — no reply in 6h`,
      urgency:   "medium",
      lead_id:   lead.id,
      deep_link: `/agent/leads/${lead.id}`,
    });
  }

  // Sort: critical first
  actions.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.urgency as keyof typeof order] ?? 4) - (order[b.urgency as keyof typeof order] ?? 4);
  });

  return NextResponse.json({ actions, count: actions.length });
}
