import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  checkPublicRateLimit,
  publicRateLimitHeaders,
} from "@/lib/security/public-rate-limit";

// GET /api/spots/resolve
//
// Resolves city and category slugs to their UUIDs.
// Used by the spot selection page to convert URL slugs to IDs for the
// availability check and checkout calls.
//
// Query params:
//   citySlug      e.g. "denver-co"
//   categorySlug  e.g. "plumbing"

export const dynamic = "force-dynamic";

const SPOTS_RESOLVE_RATE_LIMIT = {
  scope: "spots:resolve",
  limit: 120,
  windowMs: 60_000,
};

export async function GET(req: Request) {
  const rateLimit = checkPublicRateLimit(req, SPOTS_RESOLVE_RATE_LIMIT);
  const headers = publicRateLimitHeaders(rateLimit);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many spot resolution requests. Try again shortly." },
      { status: 429, headers },
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const citySlug = searchParams.get("citySlug");
    const categorySlug = searchParams.get("categorySlug");

    if (!citySlug || !categorySlug) {
      return NextResponse.json(
        { error: "citySlug and categorySlug are required" },
        { status: 400, headers },
      );
    }

    const supabase = createServiceClient();

    const [{ data: city, error: cityError }, { data: category, error: categoryError }] =
      await Promise.all([
        supabase
          .from("cities")
          .select("id, name, is_active")
          .eq("slug", citySlug)
          .maybeSingle(),
        supabase
          .from("categories")
          .select("id, name")
          .eq("slug", categorySlug)
          .maybeSingle(),
      ]);

    if (cityError) throw cityError;
    if (categoryError) throw categoryError;

    if (!city || !city.is_active) {
      return NextResponse.json(
        { error: "City not found or not active" },
        { status: 404, headers },
      );
    }

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404, headers });
    }

    return NextResponse.json({
      cityId: city.id,
      cityName: city.name,
      categoryId: category.id,
      categoryName: category.name,
    }, { headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[route] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500, headers });
  }
}
