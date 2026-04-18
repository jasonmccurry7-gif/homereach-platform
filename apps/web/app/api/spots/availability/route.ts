import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCanonicalAvailability } from "@/lib/spots/canonical-availability";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/spots/availability
//
// Returns whether a city+category slot is available for purchase.
//
// Unified source of truth: delegates to checkCanonicalAvailability, which
// checks (in order) the deny-list, spot_assignments, orders, and legacy
// migration metadata. Fail-closed on any query error.
//
// Query params:
//   cityId      (required) — UUID of the city
//   categoryId  (required) — UUID of the category
//
// Response:
//   200 { available: true, source: "ok" }
//   200 { available: false, source, message, takenBy? }
//   400 invalid query
//   503 query error (returned as 200 { available: false } to consumers;
//       the 503 variant is reserved for hard failures we want the UI to
//       retry rather than surface as "sold out")
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  cityId: z.string().uuid("cityId must be a valid UUID"),
  categoryId: z.string().uuid("categoryId must be a valid UUID"),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    cityId: searchParams.get("cityId"),
    categoryId: searchParams.get("categoryId"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { cityId, categoryId } = parsed.data;

  try {
    const result = await checkCanonicalAvailability({ cityId, categoryId });

    if (result.available) {
      return NextResponse.json({ available: true, source: "ok" }, { status: 200 });
    }

    // Log the server-side detail (never surface to client)
    if (result.source === "query_error") {
      console.error(
        "[api/spots/availability] fail-closed on query error:",
        result.detail,
        result.errorDetail,
      );
    }

    return NextResponse.json(
      {
        available: false,
        source: result.source,
        message:
          result.message ??
          "This spot is currently taken. Join the waitlist to be notified when it opens.",
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[api/spots/availability] unexpected error:", err);
    // Fail-closed: tell the UI it's not available rather than let a
    // checkout slip through because of a transient server error.
    return NextResponse.json(
      {
        available: false,
        source: "query_error",
        message:
          "We could not confirm availability right now. Please try again in a moment.",
      },
      { status: 200 },
    );
  }
}
