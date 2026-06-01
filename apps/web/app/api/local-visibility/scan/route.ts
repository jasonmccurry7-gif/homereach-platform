import { NextResponse } from "next/server";
import { buildLocalVisibilityScorecard, type LocalVisibilityScanInput } from "@/lib/local-visibility/scoring";
import { createServiceClient } from "@/lib/supabase/service";

function text(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}

function hasSupabaseServiceEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input: LocalVisibilityScanInput = {
    businessName: text(body.businessName),
    website: text(body.website),
    phone: text(body.phone),
    city: text(body.city),
    state: text(body.state) || "OH",
    category: text(body.category),
    googleBusinessProfileUrl: text(body.googleBusinessProfileUrl),
  };

  if (!input.businessName || !input.city || !input.state || !input.category) {
    return NextResponse.json(
      { ok: false, error: "Business name, city, state, and category are required." },
      { status: 400 },
    );
  }

  const scorecard = buildLocalVisibilityScorecard(input);
  let persisted = false;
  let persistenceWarning: string | null = null;

  if (hasSupabaseServiceEnv()) {
    const supabase = createServiceClient();
    const { error } = await supabase.from("local_visibility_scans").insert({
      business_name: input.businessName,
      website: input.website || null,
      phone: input.phone || null,
      city: input.city,
      state: input.state,
      category: input.category,
      google_business_profile_url: input.googleBusinessProfileUrl || null,
      overall_visibility_score: scorecard.overallVisibilityScore,
      trust_score: scorecard.trustScore,
      listings_score: scorecard.listingsScore,
      review_momentum_score: scorecard.reviewMomentumScore,
      google_profile_completeness: scorecard.googleProfileCompleteness,
      estimated_revenue_opportunity: scorecard.estimatedRevenueOpportunity,
      scorecard,
      status: "new_scan",
      source: "public_free_visibility_scan",
    });

    if (error) {
      persistenceWarning = "Scan completed, but the database table is not available yet. Apply the Local Visibility migration.";
    } else {
      persisted = true;
    }
  }

  return NextResponse.json({
    ok: true,
    scorecard,
    persisted,
    persistenceWarning,
  });
}

