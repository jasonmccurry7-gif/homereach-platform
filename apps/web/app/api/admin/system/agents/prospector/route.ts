import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/system/agents/prospector
// Prospector = identifies cities needing new leads
// Checks lead counts by city, flags cities with < 30 queued leads
// Optionally re-activates dead leads back to queued
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const MIN_LEADS_PER_CITY = 30;

    // ─── Get lead counts by city (queued status) ────────────────────────────────
    const { data: cityLeads } = await supabase
      .from("sales_leads")
      .select("city, id")
      .eq("status", "queued");

    const leadsByCity: Record<string, number> = {};
    if (cityLeads) {
      for (const lead of cityLeads) {
        const city = lead.city || "unknown";
        leadsByCity[city] = (leadsByCity[city] || 0) + 1;
      }
    }

    // ─── Identify cities needing more leads ──────────────────────────────────────
    const citiesNeedingLeads: Array<{ city: string; current_count: number }> =
      [];

    for (const [city, count] of Object.entries(leadsByCity)) {
      if (count < MIN_LEADS_PER_CITY) {
        citiesNeedingLeads.push({
          city,
          current_count: count,
        });
      }
    }

    // ─── Optional: Re-activate dead leads (status='dead', last_activity > 30 days)
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: deadLeads } = await supabase
      .from("sales_leads")
      .select("id, business_name, city")
      .eq("status", "dead")
      .lt("last_contacted_at", thirtyDaysAgo);

    let reactivatedCount = 0;
    if (deadLeads && deadLeads.length > 0) {
      const deadLeadIds = deadLeads.map((l) => l.id);

      // Re-queue them
      const { error: updateError } = await supabase
        .from("sales_leads")
        .update({
          status: "queued",
          last_contacted_at: null,
          updated_at: new Date().toISOString(),
        })
        .in("id", deadLeadIds);

      if (!updateError) {
        reactivatedCount = deadLeads.length;

        // Log reactivation
        console.log(
          `[prospector] Reactivated ${reactivatedCount} dead leads`
        );
      }
    }

    // ─── Get all cities in system for reference ──────────────────────────────────
    const { data: allCities } = await supabase
      .from("cities")
      .select("name, id");

    const cityNames = allCities?.map((c) => c.name) || [];

    // ─── Build report ───────────────────────────────────────────────────────────
    const report = {
      analysis_date: new Date().toISOString(),
      total_cities_in_system: cityNames.length,
      cities_with_adequate_leads: Object.keys(leadsByCity).filter(
        (c) => (leadsByCity[c] || 0) >= MIN_LEADS_PER_CITY
      ).length,
      cities_needing_leads: citiesNeedingLeads.length,
      cities_needing_leads_list: citiesNeedingLeads,
      dead_leads_reactivated: reactivatedCount,
      lead_distribution: Object.entries(leadsByCity)
        .map(([city, count]) => ({ city, queued_count: count }))
        .sort((a, b) => b.queued_count - a.queued_count),
      recommendation:
        citiesNeedingLeads.length > 0
          ? `Need to source new leads for ${citiesNeedingLeads.length} cities`
          : "Lead distribution healthy",
    };

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[prospector] error:`, msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
