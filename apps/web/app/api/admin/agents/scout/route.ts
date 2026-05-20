import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Scout Agent — Market Research + Competitive Intelligence
// POST /api/admin/agents/scout
//
// Analyzes lead data to surface market intelligence:
// - Which categories have the most businesses (saturation indicators)
// - Which cities have the most uncontacted leads (opportunity)
// - Response rate by category (what markets are most receptive)
// - Competitor proxy: categories with many leads = competitive markets
// ─────────────────────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = createServiceClient();
  const runAt = new Date().toISOString();

  try {
    // ── Lead distribution by city + category ─────────────────────────────────
    const { data: leads, error } = await supabase
      .from("sales_leads")
      .select("city, category, status, created_at");

    if (error) throw new Error(error.message);

    const allLeads = leads ?? [];

    // ── By city: opportunity score ────────────────────────────────────────────
    const byCityRaw: Record<string, { total: number; fresh: number; replied: number; closed: number }> = {};
    for (const l of allLeads) {
      const city = l.city ?? "unknown";
      if (!byCityRaw[city]) byCityRaw[city] = { total: 0, fresh: 0, replied: 0, closed: 0 };
      byCityRaw[city].total++;
      if (l.status === "fresh" || l.status === "contacted") byCityRaw[city].fresh++;
      if (l.status === "replied" || l.status === "interested") byCityRaw[city].replied++;
      if (l.status === "closed_won") byCityRaw[city].closed++;
    }

    const byCity = Object.entries(byCityRaw)
      .map(([city, stats]) => ({
        city,
        ...stats,
        response_rate: stats.total > 0 ? ((stats.replied + stats.closed) / stats.total * 100).toFixed(1) + "%" : "0%",
        opportunity_score: stats.fresh,
      }))
      .sort((a, b) => b.opportunity_score - a.opportunity_score)
      .slice(0, 15);

    // ── By category: market density ───────────────────────────────────────────
    const byCategoryRaw: Record<string, { total: number; fresh: number; replied: number }> = {};
    for (const l of allLeads) {
      const cat = l.category ?? "unknown";
      if (!byCategoryRaw[cat]) byCategoryRaw[cat] = { total: 0, fresh: 0, replied: 0 };
      byCategoryRaw[cat].total++;
      if (l.status === "fresh") byCategoryRaw[cat].fresh++;
      if (l.status === "replied" || l.status === "interested") byCategoryRaw[cat].replied++;
    }

    const byCategory = Object.entries(byCategoryRaw)
      .map(([category, stats]) => ({
        category,
        ...stats,
        response_rate: stats.total > 0 ? ((stats.replied / stats.total) * 100).toFixed(1) + "%" : "0%",
      }))
      .sort((a, b) => b.replied - a.replied);

    // ── Intelligence insights ─────────────────────────────────────────────────
    const topOpportunityCity = byCity[0];
    const mostResponsiveCategory = byCategory.sort((a, b) =>
      parseFloat(b.response_rate) - parseFloat(a.response_rate)
    )[0];
    const highestVolumeCategory = [...byCategory].sort((a, b) => b.total - a.total)[0];

    const insights: string[] = [];
    if (topOpportunityCity) {
      insights.push(`🎯 Highest opportunity city: ${topOpportunityCity.city} (${topOpportunityCity.fresh} fresh leads)`);
    }
    if (mostResponsiveCategory) {
      insights.push(`📞 Most responsive category: ${mostResponsiveCategory.category} (${mostResponsiveCategory.response_rate} response rate)`);
    }
    if (highestVolumeCategory) {
      insights.push(`📊 Largest category by volume: ${highestVolumeCategory.category} (${highestVolumeCategory.total} leads)`);
    }

    return NextResponse.json({
      agent: "Scout",
      run_at: runAt,
      total_leads_analyzed: allLeads.length,
      by_city: byCity,
      by_category: byCategory.slice(0, 15),
      intelligence_insights: insights,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Scout] Error:", msg);
    return NextResponse.json({ agent: "Scout", error: msg, run_at: runAt }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ agent: "Scout", status: "ready", description: "POST to run market intelligence analysis" });
}
