import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCanonicalAvailability } from "@/lib/spots/canonical-availability";
import {
  checkPublicRateLimit,
  publicRateLimitHeaders,
} from "@/lib/security/public-rate-limit";

// GET /api/spots/availability
//
// Returns whether a city+category slot is available for purchase.
//
// Unified source of truth: delegates to checkCanonicalAvailability, which
// checks the deny-list, spot_assignments, orders, and legacy migration metadata.
// Fail-closed on any query error.
//
// Query params:
//   cityId      (required) UUID of the city
//   categoryId  (required) UUID of the category

export const dynamic = "force-dynamic";

const SPOTS_AVAILABILITY_RATE_LIMIT = {
  scope: "spots:availability",
  limit: 120,
  windowMs: 60_000,
};

const QuerySchema = z.object({
  cityId: z.string().uuid("cityId must be a valid UUID"),
  categoryId: z.string().uuid("categoryId must be a valid UUID"),
});

export async function GET(req: Request) {
  const rateLimit = checkPublicRateLimit(req, SPOTS_AVAILABILITY_RATE_LIMIT);
  const headers = publicRateLimitHeaders(rateLimit);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many availability requests. Try again shortly." },
      { status: 429, headers },
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    cityId: searchParams.get("cityId"),
    categoryId: searchParams.get("categoryId"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400, headers },
    );
  }

  const { cityId, categoryId } = parsed.data;

  try {
    const result = await checkCanonicalAvailability({ cityId, categoryId });

    if (result.available) {
      return NextResponse.json({ available: true, source: "ok" }, { status: 200, headers });
    }

    // Log the server-side detail, never the client response.
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
      { status: 200, headers },
    );
  } catch (err) {
    console.error("[api/spots/availability] unexpected error:", err);
    return NextResponse.json(
      {
        available: false,
        source: "query_error",
        message:
          "We could not confirm availability right now. Please try again in a moment.",
      },
      { status: 200, headers },
    );
  }
}
