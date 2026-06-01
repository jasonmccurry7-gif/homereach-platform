import { NextResponse, type NextRequest } from "next/server";
import { isPoliticalEnabled } from "@/lib/political/env";
import {
  loadPoliticalRouteCoverage,
  type RouteCoverageResult,
} from "@/lib/political/coverage-data";
import type { CoverageGeographyType } from "@/lib/political/coverage-planner";

export const dynamic = "force-dynamic";

const VALID_GEO_TYPES = new Set<CoverageGeographyType>([
  "state",
  "county",
  "city",
  "district",
]);

function routeCoveragePayload(coverage: RouteCoverageResult) {
  return {
    ok: true,
    query: coverage.query,
    routes: coverage.routes,
    totalRoutes: coverage.totalRoutes,
    returnedRoutes: coverage.returnedRoutes,
    totalHouseholds: coverage.totalHouseholds,
    capped: coverage.capped,
    note: coverage.note,
    dataConfidence: "Estimated",
    sourceStatus: "imported_route_counts_need_operator_verification",
    checkoutEligible: false,
    requiresHumanApproval: true,
  };
}

export async function GET(request: NextRequest) {
  if (!isPoliticalEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const params = request.nextUrl.searchParams;
  const geographyTypeRaw = params.get("geographyType")?.trim() ?? "state";
  const limitRaw = params.get("limit");
  const geographyType = VALID_GEO_TYPES.has(geographyTypeRaw as CoverageGeographyType)
    ? (geographyTypeRaw as CoverageGeographyType)
    : "state";

  try {
    const coverage = await loadPoliticalRouteCoverage({
      state: params.get("state"),
      geographyType,
      geographyValue: params.get("geographyValue"),
      limit: limitRaw ? Number(limitRaw) : null,
    });

    return NextResponse.json(routeCoveragePayload(coverage));
  } catch (error) {
    console.error("[political/routes/coverage] failed", error);
    return NextResponse.json(
      {
        ok: false,
        routes: [],
        note: "Route coverage is unavailable. Continue with a review-only estimate and verify route counts before proposal or checkout.",
      },
      { status: 500 },
    );
  }
}
