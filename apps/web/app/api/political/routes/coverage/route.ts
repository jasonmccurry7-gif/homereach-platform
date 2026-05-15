import { NextResponse } from "next/server";
import { loadPoliticalRouteCoverage } from "@/lib/political/coverage-data";
import type { CoverageGeographyType } from "@/lib/political/coverage-planner";

export const dynamic = "force-dynamic";

function geographyType(value: string | null): CoverageGeographyType {
  if (value === "county" || value === "city" || value === "district") return value;
  return "state";
}

export async function GET(req: Request) {
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
    });
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
      { status: 200 }
    );
  }
}
