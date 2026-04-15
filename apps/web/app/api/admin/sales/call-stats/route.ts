import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/admin/sales/call-stats?agent_id=X&period=today|week|month
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
    const period = searchParams.get("period") || "today";

    if (!agent_id) {
      return NextResponse.json({ error: "agent_id required" }, { status: 400 });
    }

    // Build date range
    const now = new Date();
    let startDate = "";

    switch (period) {
      case "today":
        startDate = now.toISOString().split("T")[0];
        break;
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString().split("T")[0];
        break;
      case "month":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = monthAgo.toISOString().split("T")[0];
        break;
      default:
        startDate = now.toISOString().split("T")[0];
    }

    const endDate = now.toISOString().split("T")[0];

    // Query call logs for date range
    const { data: calls, error } = await supabase
      .from("call_logs")
      .select("outcome, deal_created, follow_up_created, city, category, duration_seconds")
      .eq("agent_id", agent_id)
      .gte("created_at", `${startDate}T00:00:00`)
      .lte("created_at", `${endDate}T23:59:59`);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const callList = calls || [];

    // Aggregate stats
    const completed = callList.length;

    const connected = callList.filter((c) =>
      [
        "interested",
        "wants_info",
        "sent_info",
        "not_interested",
        "wrong_fit",
        "call_back_later",
        "deal_created",
      ].includes(c.outcome)
    ).length;

    const no_answer = callList.filter((c) => c.outcome === "no_answer").length;
    const voicemail = callList.filter((c) => c.outcome === "left_voicemail").length;
    const interested = callList.filter((c) =>
      ["interested", "wants_info"].includes(c.outcome)
    ).length;
    const deals = callList.filter(
      (c) => c.deal_created === true || c.outcome === "deal_created"
    ).length;
    const follow_ups = callList.filter((c) => c.follow_up_created === true).length;

    const connection_rate = completed > 0 ? (connected / completed) * 100 : 0;
    const interest_rate = connected > 0 ? (interested / connected) * 100 : 0;

    // Breakdown by city
    const cityStats: Record<
      string,
      {
        completed: number;
        connected: number;
        deals: number;
        interest_rate: number;
      }
    > = {};

    for (const call of callList) {
      const city = call.city || "Unknown";
      if (!cityStats[city]) {
        cityStats[city] = { completed: 0, connected: 0, deals: 0, interest_rate: 0 };
      }
      cityStats[city].completed++;
      if (
        [
          "interested",
          "wants_info",
          "sent_info",
          "not_interested",
          "wrong_fit",
          "call_back_later",
          "deal_created",
        ].includes(call.outcome)
      ) {
        cityStats[city].connected++;
      }
      if (call.deal_created === true || call.outcome === "deal_created") {
        cityStats[city].deals++;
      }
    }

    // Calculate interest rate for each city
    for (const city in cityStats) {
      const cityConnected = callList
        .filter((c) => c.city === city)
        .filter((c) =>
          ["interested", "wants_info"].includes(c.outcome)
        ).length;
      cityStats[city].interest_rate =
        cityStats[city].connected > 0
          ? (cityConnected / cityStats[city].connected) * 100
          : 0;
    }

    // Breakdown by category
    const categoryStats: Record<
      string,
      {
        completed: number;
        connected: number;
        deals: number;
        interest_rate: number;
      }
    > = {};

    for (const call of callList) {
      const category = call.category || "Unknown";
      if (!categoryStats[category]) {
        categoryStats[category] = { completed: 0, connected: 0, deals: 0, interest_rate: 0 };
      }
      categoryStats[category].completed++;
      if (
        [
          "interested",
          "wants_info",
          "sent_info",
          "not_interested",
          "wrong_fit",
          "call_back_later",
          "deal_created",
        ].includes(call.outcome)
      ) {
        categoryStats[category].connected++;
      }
      if (call.deal_created === true || call.outcome === "deal_created") {
        categoryStats[category].deals++;
      }
    }

    // Calculate interest rate for each category
    for (const category in categoryStats) {
      const catConnected = callList
        .filter((c) => c.category === category)
        .filter((c) =>
          ["interested", "wants_info"].includes(c.outcome)
        ).length;
      categoryStats[category].interest_rate =
        categoryStats[category].connected > 0
          ? (catConnected / categoryStats[category].connected) * 100
          : 0;
    }

    return NextResponse.json({
      period,
      start_date: startDate,
      end_date: endDate,
      agent_id,
      stats: {
        completed,
        connected,
        no_answer,
        voicemail,
        interested,
        deals,
        follow_ups,
        connection_rate: parseFloat(connection_rate.toFixed(2)),
        interest_rate: parseFloat(interest_rate.toFixed(2)),
      },
      by_city: cityStats,
      by_category: categoryStats,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[call-stats GET] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
