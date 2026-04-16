import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Atlas Agent — City Expansion Intelligence
// POST /api/admin/agents/atlas
//
// Monitors city slot fill rates, identifies expansion opportunities,
// flags cities approaching saturation, and surfaces new market candidates.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = createServiceClient();
  const runAt = new Date().toISOString();

  try {
    // ── 1. Get all active cities with spot counts ──────────────────────────
    const { data: cities, error: citiesErr } = await supabase
      .from("cities")
      .select("id, name, is_active, founding_eligible")
      .eq("is_active", true)
      .order("name");

    if (citiesErr) throw new Error(`Cities query failed: ${citiesErr.message}`);

    // ── 2. Get order (spot) counts per city ─────────────────────────────────
    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select("city_id, status")
      .in("status", ["active", "pending"]);

    if (ordersErr) throw new Error(`Orders query failed: ${ordersErr.message}`);

    // ── 3. Get category count (max possible slots per city) ──────────────────
    const { count: totalCategories } = await supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    const maxSlotsPerCity = totalCategories ?? 12;

    // ── 4. Calculate fill rates per city ────────────────────────────────────
    const cityStats = (cities ?? []).map(city => {
      const cityOrders = (orders ?? []).filter(o => o.city_id === city.id);
      const filledSlots = cityOrders.length;
      const fillRate = maxSlotsPerCity > 0 ? Math.round((filledSlots / maxSlotsPerCity) * 100) : 0;
      return {
        city_id: city.id,
        city_name: city.name,
        filled_slots: filledSlots,
        max_slots: maxSlotsPerCity,
        open_slots: maxSlotsPerCity - filledSlots,
        fill_rate_pct: fillRate,
        is_saturated: fillRate >= 90,
        is_high: fillRate >= 60,
        founding_eligible: city.founding_eligible,
      };
    });

    // ── 5. Classify cities ───────────────────────────────────────────────────
    const saturated  = cityStats.filter(c => c.is_saturated);
    const high       = cityStats.filter(c => c.is_high && !c.is_saturated);
    const growing    = cityStats.filter(c => !c.is_high && c.filled_slots > 0);
    const empty      = cityStats.filter(c => c.filled_slots === 0);

    // ── 6. Expansion recommendations ─────────────────────────────────────────
    const expansionSignals: string[] = [];
    if (saturated.length > 0) {
      expansionSignals.push(`⚠️ ${saturated.length} city/cities at saturation (90%+ fill) — recommend adding capacity or new adjacent cities`);
    }
    if (empty.length > 0) {
      expansionSignals.push(`🆕 ${empty.length} cities with 0 spots filled — prioritize sales outreach to activate`);
    }

    // ── 7. Log to sales events ───────────────────────────────────────────────
    await supabase.from("sales_events").insert({
      event_type: "atlas_scan",
      notes: JSON.stringify({
        cities_total: cities?.length ?? 0,
        saturated: saturated.length,
        high: high.length,
        growing: growing.length,
        empty: empty.length,
      }),
      created_at: runAt,
    }).catch(() => {});

    return NextResponse.json({
      agent: "Atlas",
      run_at: runAt,
      cities_analyzed: cities?.length ?? 0,
      max_slots_per_city: maxSlotsPerCity,
      classifications: {
        saturated:  saturated.map(c => ({ name: c.city_name, fill_rate: c.fill_rate_pct })),
        high:       high.map(c => ({ name: c.city_name, fill_rate: c.fill_rate_pct, open: c.open_slots })),
        growing:    growing.map(c => ({ name: c.city_name, fill_rate: c.fill_rate_pct, open: c.open_slots })),
        empty:      empty.map(c => ({ name: c.city_name })),
      },
      expansion_signals: expansionSignals,
      all_cities: cityStats,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Atlas] Error:", msg);
    return NextResponse.json({ agent: "Atlas", error: msg, run_at: runAt }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ agent: "Atlas", status: "ready", description: "POST to run city expansion analysis" });
}
