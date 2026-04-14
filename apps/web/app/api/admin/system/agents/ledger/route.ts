import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/system/agents/ledger
// Ledger = revenue tracking and financial metrics
// Calculates: MRR, ARR, churn, new activations, revenue by city/category
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthStart = new Date(currentYear, currentMonth, 1).toISOString();
    const yearStart = new Date(currentYear, 0, 1).toISOString();

    // ─── Get active subscriptions with monthly values ─────────────────────────────
    const { data: activeSpots } = await supabase
      .from("spot_assignments")
      .select(
        `
        id, monthly_value_cents, city, category,
        created_at, status,
        bundles ( id, name, monthly_price_cents )
      `
      )
      .eq("status", "active");

    // ─── Calculate MRR (Monthly Recurring Revenue) ──────────────────────────────
    let totalMRR_cents = 0;
    let mrrCount = 0;

    if (activeSpots) {
      for (const spot of activeSpots) {
        if (spot.monthly_value_cents) {
          totalMRR_cents += spot.monthly_value_cents;
          mrrCount++;
        }
      }
    }

    const mrr_cents = totalMRR_cents;
    const mrr_usd = mrr_cents / 100;
    const arr_cents = mrr_cents * 12;
    const arr_usd = arr_cents / 100;

    // ─── Count new activations this month ───────────────────────────────────────
    const { count: newActivationsCount } = await supabase
      .from("spot_assignments")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gte("created_at", monthStart);

    // ─── Count churn this month (cancellations) ─────────────────────────────────
    const { count: churnCount } = await supabase
      .from("spot_assignments")
      .select("id", { count: "exact", head: true })
      .eq("status", "cancelled")
      .gte("updated_at", monthStart);

    // ─── Revenue by city ────────────────────────────────────────────────────────
    const revenueByCity: Record<string, number> = {};
    if (activeSpots) {
      for (const spot of activeSpots) {
        const city = spot.city || "unknown";
        if (spot.monthly_value_cents) {
          revenueByCity[city] = (revenueByCity[city] || 0) + spot.monthly_value_cents;
        }
      }
    }

    const revenueByCity_list = Object.entries(revenueByCity)
      .map(([city, cents]) => ({
        city,
        monthly_revenue_cents: cents,
        monthly_revenue_usd: cents / 100,
      }))
      .sort((a, b) => b.monthly_revenue_cents - a.monthly_revenue_cents);

    // ─── Revenue by category ───────────────────────────────────────────────────
    const revenueByCategory: Record<string, number> = {};
    if (activeSpots) {
      for (const spot of activeSpots) {
        const category = spot.category || "unknown";
        if (spot.monthly_value_cents) {
          revenueByCategory[category] =
            (revenueByCategory[category] || 0) + spot.monthly_value_cents;
        }
      }
    }

    const revenueByCategory_list = Object.entries(revenueByCategory)
      .map(([category, cents]) => ({
        category,
        monthly_revenue_cents: cents,
        monthly_revenue_usd: cents / 100,
      }))
      .sort((a, b) => b.monthly_revenue_cents - a.monthly_revenue_cents);

    // ─── Get lifetime metrics ───────────────────────────────────────────────────
    const { count: totalEverActivated } = await supabase
      .from("spot_assignments")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    const { count: totalEverCancelled } = await supabase
      .from("spot_assignments")
      .select("id", { count: "exact", head: true })
      .eq("status", "cancelled");

    // ─── Build revenue summary ──────────────────────────────────────────────────
    const ledger = {
      report_date: new Date().toISOString(),
      metrics: {
        mrr_cents,
        mrr_usd: parseFloat(mrr_usd.toFixed(2)),
        arr_cents,
        arr_usd: parseFloat(arr_usd.toFixed(2)),
        active_subscriptions: mrrCount,
      },
      monthly_activity: {
        new_activations: newActivationsCount ?? 0,
        churn: churnCount ?? 0,
        net_change: (newActivationsCount ?? 0) - (churnCount ?? 0),
      },
      lifetime: {
        total_activated: totalEverActivated ?? 0,
        total_cancelled: totalEverCancelled ?? 0,
      },
      revenue_by_city: revenueByCity_list,
      revenue_by_category: revenueByCategory_list,
      health_indicators: {
        mrr_trend: mrr_usd > 0 ? "growing" : "flat",
        churn_rate:
          (totalEverActivated ?? 0) > 0
            ? (
                (((churnCount ?? 0) / (totalEverActivated ?? 0)) * 100)
              ).toFixed(2) + "%"
            : "0%",
        avg_subscription_value_usd:
          mrrCount > 0
            ? parseFloat((mrr_usd / mrrCount).toFixed(2))
            : 0,
      },
    };

    return NextResponse.json({
      success: true,
      data: ledger,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ledger] error:`, msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
