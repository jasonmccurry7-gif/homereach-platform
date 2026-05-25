import { NextResponse } from "next/server";
import { loadPoliticalRouteCoverage } from "@/lib/political/coverage-data";
import type { CoverageGeographyType } from "@/lib/political/coverage-planner";
import {
  checkPublicRateLimit,
  publicRateLimitHeaders,
} from "@/lib/security/public-rate-limit";

export const dynamic = "force-dynamic";

const POLITICAL_ROUTE_COVERAGE_RATE_LIMIT = {
  scope: "political:routes-coverage",
  limit: 120,
  windowMs: 60_000,
};

function geographyType(value: string | null): CoverageGeographyType {
  if (value === "county" || value === "city" || value === "district") return value;
  return "state";
}

export async function GET(req: Request) {
  const rateLimit = checkPublicRateLimit(req, POLITICAL_ROUTE_COVERAGE_RATE_LIMIT);
  const headers = publicRateLimitHeaders(rateLimit);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        routes: [],
        totalRoutes: 0,
        returnedRoutes: 0,
        totalHouseholds: 0,
        capped: false,
        note: "Too many route coverage requests. Please retry shortly.",
      },
      { status: 429, headers }
    );
  }

  const url = new URL(req.url);

  try {
    const result = await loadPoliticalRouteCoverage({
      state: url.searchParams.get("state"),
      geographyType: geographyType(url.searchParams.get("geographyType")),
      geographyValue: url.searchParams.get("geographyValue"),
      limit: Number(url.searchParams.get("limit") ?? 120),
    });

    return NextResponse.json({
      ok: true,
      ...result,
    }, { headers });
  } catch (err) {
    console.error("[api/political/routes/coverage] failed", err);
    return NextResponse.json(
      {
        ok: false,
        routes: [],
        totalRoutes: 0,
        returnedRoutes: 0,
        totalHouseholds: 0,
        capped: false,
        note: "Route coverage is temporarily unavailable. Strategy estimates still work from aggregate geography data.",
      },
      { status: 200, headers }
    );
  }
}
