import { describe, expect, it } from "vitest";
import {
  normalizeCoverageSearch,
  rankCoverageRoutes,
  summarizeCoverageSelection,
  type PoliticalRouteSummary,
} from "../coverage-planner";

function route(
  id: string,
  households: number,
  zip5 = "43085",
): PoliticalRouteSummary {
  return {
    id,
    state: "OH",
    zip5,
    carrierRouteId: `C00${id}`,
    routeType: "city",
    households,
    county: "Franklin",
    city: "Worthington",
    source: "test",
    importedAt: null,
    densityScore: 0,
    label: "",
  };
}

describe("coverage planner", () => {
  it("normalizes state, geography, zip, and caps the route limit", () => {
    expect(
      normalizeCoverageSearch({
        state: "ohio",
        geographyType: "county",
        geographyValue: "Franklin 43215",
        limit: 999,
      }),
    ).toEqual({
      state: "OH",
      geographyType: "county",
      geographyValue: "Franklin 43215",
      zip5: "43215",
      limit: 250,
    });
  });

  it("ranks routes by household density", () => {
    const ranked = rankCoverageRoutes([route("1", 300), route("2", 900), route("3", 600)]);

    expect(ranked.map((r) => r.id)).toEqual(["2", "3", "1"]);
    expect(ranked[0].densityScore).toBe(100);
    expect(ranked[2].densityScore).toBe(33);
  });

  it("summarizes selected coverage and gaps", () => {
    const summary = summarizeCoverageSelection(
      [route("1", 300, "43085"), route("2", 700, "43085"), route("3", 500, "43215")],
      ["1", "3"],
    );

    expect(summary.availableRouteCount).toBe(3);
    expect(summary.selectedRouteCount).toBe(2);
    expect(summary.availableHouseholds).toBe(1500);
    expect(summary.selectedHouseholds).toBe(800);
    expect(summary.coveragePct).toBe(53.33);
    expect(summary.gapRouteCount).toBe(1);
    expect(summary.gapHouseholds).toBe(700);
    expect(summary.zipCount).toBe(2);
  });
});
