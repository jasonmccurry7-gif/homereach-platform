import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCanonicalAvailability } from "@/lib/spots/canonical-availability";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/spots/availability
//
// Returns whether a city+category slot is available for purchase.
// A slot is unavailable if a pending or active spot_assignment exists for it.
//
// Query params:
//   cityId      (required) — UUID of the city
//   categoryId  (required) — UUID of the category
//
// Response:
//   { available: true }
//   { available: false, message: "This spot is already taken." }
// ─────────────────────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  cityId:     z.string().uuid("cityId must be a valid UUID"),
  categoryId: z.string().uuid("categoryId must be a valid UUID"),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    cityId:     searchParams.get("cityId"),
    categoryId: searchParams.get("categoryId"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { cityId, categoryId } = parsed.data;

  try {
    const availability = await checkCanonicalAvailability({ cityId, categoryId });
    return NextResponse.json(availability, { status: 200 });
  } catch (err) {
    console.error("[api/spots/availability] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
