import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/founding/members
// Returns all founding_memberships with computed savings
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const db = createServiceClient();

  try {
    const { data: memberships, error } = await db
      .from("founding_memberships")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Compute savings for each membership
    const withSavings = (memberships || []).map((member: any) => ({
      ...member,
      savings_per_month:
        member.standard_price_cents && member.locked_price_cents
          ? (member.standard_price_cents - member.locked_price_cents) / 100
          : 0,
    }));

    return NextResponse.json({
      memberships: withSavings,
      total: withSavings.length,
    });
  } catch (error) {
    console.error("Error fetching founding memberships:", error);
    return NextResponse.json(
      { error: "Failed to fetch founding memberships" },
      { status: 500 }
    );
  }
}
