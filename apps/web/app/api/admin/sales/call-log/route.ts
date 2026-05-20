import { createServiceClient } from "@/lib/supabase/service";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { NextResponse } from "next/server";

// POST /api/admin/sales/call-log
export async function POST(request: Request) {
  try {
    const guard = await requireAdminOrSalesAgent();
    if (!guard.ok) return guard.response;
    const user = guard.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const isSalesAgent = user.app_metadata?.user_role === "sales_agent";

    const supabase = createServiceClient();
    const body = await request.json();

    let {
      agent_id,
      lead_id,
      business_name,
      phone,
      city,
      category,
      contact_name,
      outcome,
      notes,
      script_used,
      duration_seconds,
      follow_up_created,
      follow_up_date,
      info_sent,
      deal_created,
      voicemail_left,
      source,
      call_list_id,
    } = body;

    if (isSalesAgent) {
      agent_id = user.id;
    }

    if (!agent_id || !outcome) {
      return NextResponse.json({ error: "agent_id and outcome required" }, { status: 400 });
    }

    if (isSalesAgent && lead_id) {
      const { data: leadOwner, error: leadOwnerError } = await supabase
        .from("sales_leads")
        .select("assigned_agent_id")
        .eq("id", lead_id)
        .maybeSingle();

      if (leadOwnerError) {
        return NextResponse.json({ error: leadOwnerError.message }, { status: 500 });
      }
      if (!leadOwner) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
      if (leadOwner.assigned_agent_id && leadOwner.assigned_agent_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (isSalesAgent && call_list_id) {
      const { data: listOwner, error: listOwnerError } = await supabase
        .from("daily_call_lists")
        .select("agent_id")
        .eq("id", call_list_id)
        .maybeSingle();

      if (listOwnerError) {
        return NextResponse.json({ error: listOwnerError.message }, { status: 500 });
      }
      if (listOwner?.agent_id && listOwner.agent_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // 1. Insert into call_logs
    const { data: callLog, error: logError } = await supabase
      .from("call_logs")
      .insert({
        agent_id,
        lead_id,
        business_name,
        phone,
        city,
        category,
        contact_name,
        outcome,
        notes,
        script_used,
        duration_seconds,
        follow_up_created,
        follow_up_date,
        info_sent,
        deal_created,
        voicemail_left,
        source,
        call_list_id,
      })
      .select()
      .single();

    if (logError) {
      return NextResponse.json({ error: logError.message }, { status: 500 });
    }

    let updatedLead = null;
    let enrichmentResult = null;

    // 2. Update sales_leads if lead_id provided
    if (lead_id) {
      const leadUpdates: Record<string, unknown> = {};

      // Status mapping based on outcome
      if (["interested", "wants_info", "deal_created"].includes(outcome)) {
        leadUpdates.status = outcome === "deal_created" ? "replied" : "interested";
      } else if (outcome === "bad_number") {
        leadUpdates.sms_opt_out = true;
      } else if (["not_interested", "wrong_fit"].includes(outcome)) {
        leadUpdates.status = "dead";
      } else if (["no_answer", "left_voicemail", "call_back_later"].includes(outcome)) {
        leadUpdates.status = "contacted";
        leadUpdates.last_contacted_at = new Date().toISOString();
      }

      // Always update last_contacted_at for any send
      leadUpdates.last_contacted_at = new Date().toISOString();

      if (Object.keys(leadUpdates).length > 0) {
        const { data: updated } = await supabase
          .from("sales_leads")
          .update(leadUpdates)
          .eq("id", lead_id)
          .select()
          .single();

        updatedLead = updated;
      }
    }

    // 3. Insert into sales_events
    const { data: event } = await supabase
      .from("sales_events")
      .insert({
        agent_id,
        lead_id,
        action_type: "phone_call",
        channel: "phone",
        city,
        category,
        message: notes,
      })
      .select()
      .single();

    // 4. If outcome = 'interested', also insert conversation_started event
    if (outcome === "interested") {
      await supabase
        .from("sales_events")
        .insert({
          agent_id,
          lead_id,
          action_type: "conversation_started",
          channel: "phone",
          city,
          category,
          message: notes,
        });
    }

    // 5. Update daily_call_lists.completed_ids
    if (call_list_id && lead_id) {
      const { data: list } = await supabase
        .from("daily_call_lists")
        .select("completed_ids")
        .eq("id", call_list_id)
        .maybeSingle();

      const completedIds = list?.completed_ids || [];
      if (!completedIds.includes(lead_id)) {
        completedIds.push(lead_id);
        await supabase
          .from("daily_call_lists")
          .update({ completed_ids: completedIds })
          .eq("id", call_list_id);
      }
    }

    // 6. If source = 'manual' AND no lead_id, trigger enrichment
    if (source === "manual" && !lead_id) {
      // Simple fuzzy match
      let searchCondition = null;
      if (business_name && phone) {
        searchCondition = `business_name.ilike.%${business_name}%,phone.eq.${phone}`;
      } else if (business_name) {
        searchCondition = `business_name.ilike.%${business_name}%`;
      } else if (phone) {
        searchCondition = `phone.eq.${phone}`;
      }

      let matches: Record<string, unknown>[] = [];
      if (searchCondition) {
        let leadQuery = supabase
          .from("sales_leads")
          .select("id")
          .or(searchCondition);
        if (isSalesAgent) {
          leadQuery = leadQuery.or(`assigned_agent_id.is.null,assigned_agent_id.eq.${user.id}`);
        }

        const { data: foundLeads } = await leadQuery;

        matches = foundLeads || [];
      }

      const onlyMatch = matches[0];
      if (matches.length === 1 && onlyMatch) {
        // Exact match
        enrichmentResult = {
          matched_lead_id: onlyMatch.id,
          enrichment_confidence: 90,
          enriched: true,
          needs_review: false,
        };

        // Link the lead
        if (callLog.id) {
          await supabase
            .from("call_logs")
            .update({ lead_id: onlyMatch.id })
            .eq("id", callLog.id);
        }
      } else if (matches.length > 1) {
        // Multiple matches
        enrichmentResult = {
          matched_lead_ids: matches.map((m) => m.id),
          enrichment_confidence: 50,
          enriched: false,
          needs_review: true,
        };
      } else {
        // No match
        enrichmentResult = {
          enrichment_confidence: 0,
          enriched: false,
          needs_review: true,
        };
      }
    }

    return NextResponse.json({
      call_log: callLog,
      updated_lead: updatedLead,
      enrichment_result: enrichmentResult,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[call-log POST] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/admin/sales/call-log?agent_id=X&date=today
export async function GET(request: Request) {
  try {
    const guard = await requireAdminOrSalesAgent();
    if (!guard.ok) return guard.response;
    const user = guard.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const isSalesAgent = user.app_metadata?.user_role === "sales_agent";

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const requestedAgentId = searchParams.get("agent_id");
    const agent_id = isSalesAgent ? user.id : requestedAgentId;
    const dateParam = searchParams.get("date") || "today";

    if (!agent_id) {
      return NextResponse.json({ error: "agent_id required" }, { status: 400 });
    }

    // Determine date range
    let startDate = "";
    let endDate = "";

    if (dateParam === "today") {
      const today = new Date();
      startDate = today.toISOString().slice(0, 10);
      endDate = startDate;
    } else {
      startDate = dateParam;
      endDate = dateParam;
    }

    // Query call logs
    const { data: logs, error: logsError } = await supabase
      .from("call_logs")
      .select("*")
      .eq("agent_id", agent_id)
      .gte("created_at", `${startDate}T00:00:00`)
      .lte("created_at", `${endDate}T23:59:59`)
      .order("created_at", { ascending: false });

    if (logsError) {
      return NextResponse.json({ error: logsError.message }, { status: 500 });
    }

    // Calculate stats
    const calls = logs || [];
    const stats = {
      completed: calls.length,
      connected: calls.filter((c) =>
        [
          "interested",
          "wants_info",
          "sent_info",
          "not_interested",
          "wrong_fit",
          "call_back_later",
          "deal_created",
        ].includes(c.outcome)
      ).length,
      no_answer: calls.filter((c) => c.outcome === "no_answer").length,
      voicemail: calls.filter((c) => c.outcome === "left_voicemail").length,
      interested: calls.filter((c) =>
        ["interested", "wants_info"].includes(c.outcome)
      ).length,
      deals: calls.filter((c) => c.deal_created === true || c.outcome === "deal_created").length,
      revenue: 0, // Would need additional query for revenue
    };

    return NextResponse.json({
      logs,
      stats,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[call-log GET] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
