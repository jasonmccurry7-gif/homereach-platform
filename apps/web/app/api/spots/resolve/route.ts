import { NextResponse } from "next/server";
import { db, cities, categories } from "@homereach/db";
import { eq } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/spots/resolve
//
// Resolves city and category slugs to their UUIDs.
// Used by the spot selection page to convert URL slugs to IDs for the
// availability check and checkout calls.
//
// Query params:
//   citySlug      e.g. "denver-co"
//   categorySlug  e.g. "plumbing"
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
  const { searchParams } = new URL(req.url);
  const citySlug     = searchParams.get("citySlug");
  const categorySlug = searchParams.get("categorySlug");

  if (!citySlug || !categorySlug) {
    return NextResponse.json(
      { error: "citySlug and categorySlug are required" },
      { status: 400 }
    );
  }

  const [city] = await db
    .select({ id: cities.id, name: cities.name, isActive: cities.isActive })
    .from(cities)
    .where(eq(cities.slug, citySlug))
    .limit(1);

  if (!city || !city.isActive) {
    return NextResponse.json({ error: "City not found or not active" }, { status: 404 });
  }

  const [category] = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.slug, categorySlug))
    .limit(1);

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  return NextResponse.json({
    cityId:       city.id,
    cityName:     city.name,
    categoryId:   category.id,
    categoryName: category.name,
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}
