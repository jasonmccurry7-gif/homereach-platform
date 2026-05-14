import { describe, expect, it } from "vitest";
import { generateCampaignStrategy } from "../strategy-engine";
import { MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS } from "../pricing-config";

const base = {
  budgetCents: 25_000_00,
  state: "OH",
  geographyType: "county" as const,
  geographyValue: "Franklin",
  districtType: "local" as const,
  daysUntilElection: 60,
  dropCount: 2,
  campaignListAddresses: 7_500,
};

describe("generateCampaignStrategy", () => {
  it("recommends Coverage Strategy for awareness", () => {
    const result = generateCampaignStrategy({ ...base, goal: "awareness" });
    expect(result.recommendedStrategy).toBe("coverage");
    expect(result.coverageLayer.households).toBeGreaterThan(100_000);
    expect(result.combined.totalCostCents).toBeGreaterThan(0);
  });

  it("recommends Precision Strategy for persuasion", () => {
    const result = generateCampaignStrategy({ ...base, goal: "persuasion" });
    expect(result.recommendedStrategy).toBe("precision");
    expect(result.precisionLayer.available).toBe(true);
    expect(result.combined.totalReach).toBe(base.campaignListAddresses);
    expect(result.precisionLayer.costCents / result.precisionLayer.totalPieces).toBeLessThanOrEqual(
      MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS,
    );
  });

  it("recommends Hybrid Strategy for GOTV", () => {
    const result = generateCampaignStrategy({ ...base, goal: "gotv" });
    expect(result.recommendedStrategy).toBe("hybrid");
    expect(result.coverageLayer.available).toBe(true);
    expect(result.precisionLayer.available).toBe(true);
  });

  it("recommends Hybrid Strategy for high-budget short timeline", () => {
    const result = generateCampaignStrategy({
      ...base,
      goal: "awareness",
      budgetCents: 125_000_00,
      daysUntilElection: 20,
    });
    expect(result.recommendedStrategy).toBe("hybrid");
  });

  it("builds budget optimizer scenarios", () => {
    const result = generateCampaignStrategy({ ...base, goal: "awareness" });
    expect(result.scenarios.map((s) => s.kind)).toEqual([
      "full_coverage",
      "optimized",
      "budget_constrained",
      "hybrid",
      "targeted_only",
    ]);
  });

  it("returns delivery confidence and coverage strength", () => {
    const result = generateCampaignStrategy({ ...base, goal: "gotv" });
    expect(["high", "medium", "risk"]).toContain(result.deliveryConfidence);
    expect(result.coverageStrengthScore).toBeGreaterThanOrEqual(0);
    expect(result.coverageStrengthScore).toBeLessThanOrEqual(100);
  });

  it("uses selected route households against the available coverage universe", () => {
    const result = generateCampaignStrategy({
      ...base,
      goal: "awareness",
      householdCountOverride: 2_000,
      coverageUniverseHouseholds: 5_000,
      routes: [
        { id: "r1", label: "43085-C001", households: 1_000, densityScore: 100 },
        { id: "r2", label: "43085-C002", households: 1_000, densityScore: 95 },
      ],
    });

    expect(result.coverageLayer.households).toBe(2_000);
    expect(result.coverageLayer.routeCount).toBe(2);
    expect(result.coverageLayer.coveragePct).toBe(40);
    expect(result.scenarios.map((s) => s.kind)).toContain("custom");
    expect(result.scenarios.find((s) => s.kind === "custom")?.households).toBe(2_000);
    expect(result.scenarios.find((s) => s.kind === "full_coverage")?.households).toBe(5_000);
  });

  it("adds a hybrid scenario with combined coverage and list pieces", () => {
    const result = generateCampaignStrategy({ ...base, goal: "gotv" });
    const hybrid = result.scenarios.find((s) => s.kind === "hybrid");

    expect(hybrid).toBeDefined();
    expect(hybrid?.strategy).toBe("hybrid");
    expect(hybrid?.totalCostCents).toBeGreaterThan(result.coverageLayer.costCents);
    expect(hybrid?.totalPieces).toBe(result.coverageLayer.totalPieces + result.precisionLayer.totalPieces);
  });
});
