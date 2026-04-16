import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

interface FollowUpTask {
  lead_id: string;
  business_name: string;
  city: string;
  category: string;
  phone: string | null;
  email: string | null;
  facebook_url: string | null;
  sequence_day: 1 | 3 | 5 | 7;
  channel: "sms" | "email" | "call" | "dm";
  draft_message: string;
  days_since_contact: number;
}

function getDraftMessage(
  sequenceDay: 1 | 3 | 5 | 7,
  lead: {
    business_name: string;
    contact_name: string | null;
    city: string;
    category: string;
  }
): string {
  const firstName = lead.contact_name?.split(" ")[0] || "there";
  const cityName = lead.city || "your area";
  const categoryName = lead.category || "category";

  const messages: Record<number, string> = {
    1: `Hey ${firstName}, just wanted to make sure you got my message yesterday about the homeowner mailer in ${cityName}. Still have that ${categoryName} spot available — still interested?`,
    3: `Subject: Still open — ${categoryName} in ${cityName}\n\nHi ${firstName},\n\nJust a quick reminder that the ${categoryName} spot in ${cityName} is still available. Here's your pricing link with details.\n\nLet me know if you have questions!\n\nBest`,
    5: `Hey ${firstName}, last check-in — the ${categoryName} spot in ${cityName} is still here. One question: is the timing just off, or is it not a fit? Either way is totally fine.`,
    7: `Final note about the ${categoryName} spot in ${cityName}. Happy to answer any questions before it goes to someone else.`,
  };

  return messages[sequenceDay] || "";
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const agentId = req.nextUrl.searchParams.get("agent_id");
    if (!agentId) {
      return NextResponse.json({ error: "agent_id required" }, { status: 400 });
    }

    const db = createServiceClient();
    const now = new Date();
    const oneDay = now.getTime() - 24 * 60 * 60 * 1000;
    const threeDays = now.getTime() - 3 * 24 * 60 * 60 * 1000;
    const fiveDays = now.getTime() - 5 * 24 * 60 * 60 * 1000;
    const sevenDays = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    // Fetch candidates for each sequence day
    const [day1, day3, day5, day7] = await Promise.all([
      // Day 1: contacted 1 day ago, no reply
      db
        .from("sales_leads")
        .select(
          `id, business_name, contact_name, city, category, phone, email, facebook_url, last_contacted_at`
        )
        .eq("assigned_agent_id", agentId)
        .gte("last_contacted_at", new Date(oneDay).toISOString())
        .lte("last_contacted_at", now.toISOString())
        .is("last_reply_at", null)
        .not("do_not_contact", "is", true)
        .not("sms_opt_out", "is", true),

      // Day 3: first contacted 3 days ago, no reply, have email
      db
        .from("sales_leads")
        .select(
          `id, business_name, contact_name, city, category, phone, email, facebook_url, last_contacted_at`
        )
        .eq("assigned_agent_id", agentId)
        .gte("last_contacted_at", new Date(threeDays).toISOString())
        .lte("last_contacted_at", new Date(threeDays + 24 * 60 * 60 * 1000).toISOString())
        .is("last_reply_at", null)
        .not("email", "is", null)
        .not("do_not_contact", "is", true),

      // Day 5: contacted 5 days ago, no reply
      db
        .from("sales_leads")
        .select(
          `id, business_name, contact_name, city, category, phone, email, facebook_url, last_contacted_at`
        )
        .eq("assigned_agent_id", agentId)
        .gte("last_contacted_at", new Date(fiveDays).toISOString())
        .lte("last_contacted_at", new Date(fiveDays + 24 * 60 * 60 * 1000).toISOString())
        .is("last_reply_at", null)
        .not("do_not_contact", "is", true),

      // Day 7: contacted 7 days ago, no reply, have email or facebook
      db
        .from("sales_leads")
        .select(
          `id, business_name, contact_name, city, category, phone, email, facebook_url, last_contacted_at`
        )
        .eq("assigned_agent_id", agentId)
        .gte("last_contacted_at", new Date(sevenDays).toISOString())
        .lte("last_contacted_at", new Date(sevenDays + 24 * 60 * 60 * 1000).toISOString())
        .is("last_reply_at", null)
        .not("do_not_contact", "is", true),
    ]);

    const tasks: FollowUpTask[] = [];

    // Add day 1 tasks (SMS)
    (day1.data || []).forEach((lead) => {
      const daysSince = Math.floor(
        (now.getTime() - new Date(lead.last_contacted_at || now).getTime()) /
          (24 * 60 * 60 * 1000)
      );
      tasks.push({
        lead_id: lead.id,
        business_name: lead.business_name,
        city: lead.city,
        category: lead.category,
        phone: lead.phone,
        email: lead.email,
        facebook_url: lead.facebook_url,
        sequence_day: 1,
        channel: "sms",
        draft_message: getDraftMessage(1, lead),
        days_since_contact: daysSince,
      });
    });

    // Add day 3 tasks (Email)
    (day3.data || []).forEach((lead) => {
      const daysSince = Math.floor(
        (now.getTime() - new Date(lead.last_contacted_at || now).getTime()) /
          (24 * 60 * 60 * 1000)
      );
      tasks.push({
        lead_id: lead.id,
        business_name: lead.business_name,
        city: lead.city,
        category: lead.category,
        phone: lead.phone,
        email: lead.email,
        facebook_url: lead.facebook_url,
        sequence_day: 3,
        channel: "email",
        draft_message: getDraftMessage(3, lead),
        days_since_contact: daysSince,
      });
    });

    // Add day 5 tasks (Call or SMS)
    (day5.data || []).forEach((lead) => {
      const daysSince = Math.floor(
        (now.getTime() - new Date(lead.last_contacted_at || now).getTime()) /
          (24 * 60 * 60 * 1000)
      );
      tasks.push({
        lead_id: lead.id,
        business_name: lead.business_name,
        city: lead.city,
        category: lead.category,
        phone: lead.phone,
        email: lead.email,
        facebook_url: lead.facebook_url,
        sequence_day: 5,
        channel: "sms",
        draft_message: getDraftMessage(5, lead),
        days_since_contact: daysSince,
      });
    });

    // Add day 7 tasks (Email or DM)
    (day7.data || []).forEach((lead) => {
      const daysSince = Math.floor(
        (now.getTime() - new Date(lead.last_contacted_at || now).getTime()) /
          (24 * 60 * 60 * 1000)
      );
      tasks.push({
        lead_id: lead.id,
        business_name: lead.business_name,
        city: lead.city,
        category: lead.category,
        phone: lead.phone,
        email: lead.email,
        facebook_url: lead.facebook_url,
        sequence_day: 7,
        channel: lead.email ? "email" : lead.facebook_url ? "dm" : "email",
        draft_message: getDraftMessage(7, lead),
        days_since_contact: daysSince,
      });
    });

    return NextResponse.json({ sequence_tasks: tasks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[follow-up-sequence GET] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { agentId, leadId, sequenceDay, channel, message } = await req.json();

    if (!agentId || !leadId || !sequenceDay || !channel || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    // Log the follow-up as a sales_event
    await db.from("sales_events").insert({
      agent_id: agentId,
      lead_id: leadId,
      action_type: "follow_up_sent",
      channel: channel,
      message: message,
      metadata: { sequence_day: sequenceDay },
    });

    // Update lead's last_contacted_at
    await db
      .from("sales_leads")
      .update({ last_contacted_at: new Date().toISOString() })
      .eq("id", leadId);

    return NextResponse.json({
      ok: true,
      message: "Follow-up sent and logged",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[follow-up-sequence POST] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
