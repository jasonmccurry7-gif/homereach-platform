import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/admin/sales/call-list?agent_id=X&date=YYYY-MM-DD
export async function GET(request: Request) {
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const agent_id = searchParams.get("agent_id");
    const date_param = searchParams.get("date") || new Date().toISOString().split("T")[0];

    if (!agent_id) {
      return NextResponse.json({ error: "agent_id required" }, { status: 400 });
    }

    // Check if daily_call_list exists for this agent + date
    const { data: existingList } = await supabase
      .from("daily_call_lists")
      .select("id, agent_id, list_date, lead_ids")
      .eq("agent_id", agent_id)
      .eq("list_date", date_param)
      .maybeSingle();

    let callList = existingList;
    let leadIds: string[] = [];

    if (!existingList) {
      // Generate new list
      // 1. Get agent's assigned cities
      const { data: territories } = await supabase
        .from("agent_territories")
        .select("city")
        .eq("agent_id", agent_id);

      const assignedCities = territories?.map((t) => t.city) || [];

      // 2. Build lead query
      let query = supabase
        .from("sales_leads")
        .select("id", { count: "exact" })
        .eq("do_not_contact", false)
        .eq("sms_opt_out", false)
        .not("phone", "is", null)
        .neq("phone", "");

      // Filter by status: queued OR (contacted AND last_contacted_at < 3 days ago)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoIso = threeDaysAgo.toISOString();

      // Use OR filter for status conditions
      query = query.or(
        `status.eq.queued,and(status.eq.contacted,last_contacted_at.lt.${threeDaysAgoIso})`
      );

      if (assignedCities.length > 0) {
        query = query.in("city", assignedCities);
      }

      query = query
        .order("buying_signal", { ascending: false })
        .order("score", { ascending: false })
        .order("last_contacted_at", { ascending: true, nullsFirst: true })
        .limit(30);

      const { data: potentialLeads, error: leadError } = await query;

      if (leadError) {
        return NextResponse.json({ error: leadError.message }, { status: 500 });
      }

      leadIds = potentialLeads?.map((l) => l.id) || [];

      // Filter out leads already in today's list for ANY agent
      const { data: todaysLists } = await supabase
        .from("daily_call_lists")
        .select("lead_ids")
        .eq("list_date", date_param);

      const usedLeadIds = new Set<string>();
      if (todaysLists) {
        for (const list of todaysLists) {
          if (list.lead_ids && Array.isArray(list.lead_ids)) {
            list.lead_ids.forEach((id: string) => usedLeadIds.add(id));
          }
        }
      }

      leadIds = leadIds.filter((id) => !usedLeadIds.has(id)).slice(0, 30);

      // 3. Insert into daily_call_lists
      const { data: newList, error: insertError } = await supabase
        .from("daily_call_lists")
        .insert({
          agent_id,
          list_date: date_param,
          lead_ids: leadIds,
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      callList = newList;
    } else {
      leadIds = existingList.lead_ids || [];
    }

    // 4. Fetch full lead details
    const { data: leads, error: leadsError } = await supabase
      .from("sales_leads")
      .select(
        "id, business_name, phone, city, category, contact_name, score, buying_signal, status, last_contacted_at, source"
      )
      .in("id", leadIds);

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    // 5. Get call logs from today for these leads
    const { data: todaysCalls } = await supabase
      .from("call_logs")
      .select("lead_id")
      .eq("agent_id", agent_id)
      .gte("created_at", `${date_param}T00:00:00`)
      .lte("created_at", `${date_param}T23:59:59`);

    const alreadyCalledIds = new Set(todaysCalls?.map((c) => c.lead_id) || []);

    // 6. Get today's stats
    const { data: allTodaysCalls } = await supabase
      .from("call_logs")
      .select("outcome, deal_created, follow_up_created")
      .eq("agent_id", agent_id)
      .gte("created_at", `${date_param}T00:00:00`)
      .lte("created_at", `${date_param}T23:59:59`);

    const stats = {
      completed: allTodaysCalls?.length || 0,
      connected: allTodaysCalls?.filter((c) =>
        [
          "interested",
          "wants_info",
          "sent_info",
          "not_interested",
          "wrong_fit",
          "call_back_later",
          "deal_created",
        ].includes(c.outcome)
      ).length || 0,
      no_answer: allTodaysCalls?.filter((c) => c.outcome === "no_answer").length || 0,
      voicemail: allTodaysCalls?.filter((c) => c.outcome === "left_voicemail").length || 0,
      interested: allTodaysCalls?.filter((c) =>
        ["interested", "wants_info"].includes(c.outcome)
      ).length || 0,
      follow_ups: allTodaysCalls?.filter((c) => c.follow_up_created === true).length || 0,
      deals: allTodaysCalls?.filter((c) => c.deal_created === true || c.outcome === "deal_created").length || 0,
    };

    return NextResponse.json({
      list: {
        id: callList.id,
        agent_id: callList.agent_id,
        list_date: callList.list_date,
        target_calls: 15,
        list_size: leadIds.length,
      },
      leads: leads || [],
      today_stats: stats,
      already_called: Array.from(alreadyCalledIds),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[call-list GET] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/sales/call-list
export async function POST(request: Request) {
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const body = await request.json();
    const { agent_id, action, count } = body;

    if (!agent_id || action !== "load_more") {
      return NextResponse.json({ error: "agent_id and action='load_more' required" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];
    const loadCount = count || 10;

    // Get current list
    const { data: currentList } = await supabase
      .from("daily_call_lists")
      .select("id, lead_ids")
      .eq("agent_id", agent_id)
      .eq("list_date", today)
      .maybeSingle();

    if (!currentList) {
      return NextResponse.json({ error: "No list found for today" }, { status: 404 });
    }

    const currentLeadIds = currentList.lead_ids || [];

    // Get agent's territories
    const { data: territories } = await supabase
      .from("agent_territories")
      .select("city")
      .eq("agent_id", agent_id);

    const assignedCities = territories?.map((t) => t.city) || [];

    // Query for more leads
    let query = supabase
      .from("sales_leads")
      .select("id")
      .eq("do_not_contact", false)
      .eq("sms_opt_out", false)
      .not("phone", "is", null)
      .neq("phone", "")
      .not("id", "in", `(${currentLeadIds.join(",")})`) // Exclude already-listed
      .order("buying_signal", { ascending: false })
      .order("score", { ascending: false })
      .order("last_contacted_at", { ascending: true, nullsFirst: true })
      .limit(loadCount);

    if (assignedCities.length > 0) {
      query = query.in("city", assignedCities);
    }

    const { data: moreLeads } = await query;

    const newLeadIds = moreLeads?.map((l) => l.id) || [];

    // Update list
    const { data: updated, error: updateError } = await supabase
      .from("daily_call_lists")
      .update({
        lead_ids: [...currentLeadIds, ...newLeadIds],
      })
      .eq("id", currentList.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      list: updated,
      added_count: newLeadIds.length,
      total_count: (updated.lead_ids || []).length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[call-list POST] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
