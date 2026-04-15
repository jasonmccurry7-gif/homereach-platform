import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/intelligence/pricing?city=Austin,TX&category=Roofing
// Returns: Array of tiers with pricing and slot availability
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const category = searchParams.get("category") || "all";

  if (!city) {
    return NextResponse.json(
      { error: "city parameter is required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  try {
    // Fetch all active property intelligence tiers
    const { data: tiers, error: tiersError } = await supabase
      .from("property_intelligence_tiers")
      .select("*")
      .eq("is_active", true);

    if (tiersError) throw tiersError;

    // Fetch founding slots for this city + category across all tiers
    const { data: slots, error: slotsError } = await supabase
      .from("founding_slots")
      .select("*")
      .eq("city", city)
      .in("product", ["intelligence_t1", "intelligence_t2", "intelligence_t3"]);

    if (slotsError) throw slotsError;

    // Map tiers to response with slot info
    const tiersWithSlots = tiers.map((tier) => {
      let slot = slots.find(
        (s) =>
          s.tier === tier.tier &&
          (s.category === category || s.category === null)
      );

      // If no exact match, fall back to 'all' category
      if (!slot) {
        slot = slots.find(
          (s) => s.tier === tier.tier && s.category === null
        );
      }

      // If still no match, provide sensible defaults
      if (!slot) {
        return {
          ...tier,
          slots_remaining: 0,
          founding_open: false,
          city_available: false,
        };
      }

      return {
        ...tier,
        slots_remaining: slot.slots_remaining,
        founding_open: slot.founding_open,
        city_available: true,
      };
    });

    return NextResponse.json({
      city,
      category,
      tiers: tiersWithSlots,
    });
  } catch (error) {
    console.error("Error fetching intelligence pricing:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing data" },
      { status: 500 }
    );
  }
}
