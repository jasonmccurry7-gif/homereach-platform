// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Political Command Center: Quote Engine Tests
//
// Pure tests — no DB, no mocks needed. Exercises every boundary, error path,
// and invariant.
//
// Run: vitest run apps/web/lib/political/__tests__/
// (apps/web may need vitest added as a devDep — see Phase 3 report.)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  generatePoliticalQuote,
  InvalidQuoteInputError,
  NoHouseholdEstimateError,
  BelowMinimumVolumeError,
  type PoliticalQuoteInput,
} from "../quote";
import {
  MINIMUM_TOTAL_PIECES,
  resolveVolumeBand,
  recommendDrops,
  DEFAULT_COST_PER_PIECE_CENTS,
  DEFAULT_PRICE_PER_PIECE_CENTS,
} from "../pricing-config";
import {
  estimateHouseholds,
  hasEstimate,
  listSeededGeographies,
} from "../household-estimator";

// ── Test fixtures ────────────────────────────────────────────────────────────

/** Minimal valid input targeting a seeded Ohio county. */
function fixture(overrides: Partial<PoliticalQuoteInput> = {}): PoliticalQuoteInput {
  return {
    state: "OH",
    geographyType: "county",
    geographyValue: "Franklin",
    districtType: "local",
    ...overrides,
  };
}

// ── Household estimator ──────────────────────────────────────────────────────

describe("estimateHouseholds", () => {
  it("returns a seeded Ohio county estimate", () => {
    const n = estimateHouseholds("OH", "county", "Franklin");
    expect(typeof n).toBe("number");
    expect(n).toBeGreaterThan(100_000);
  });

  it("is case-insensitive on state and value", () => {
    expect(estimateHouseholds("oh", "county", "franklin")).toBe(
      estimateHouseholds("OH", "county", "FRANKLIN"),
    );
  });

  it("returns null for unknown state", () => {
    expect(estimateHouseholds("ZZ", "county", "Nowhere")).toBeNull();
  });

  it("returns null for unknown geography value in a known state", () => {
    expect(estimateHouseholds("OH", "county", "Atlantis")).toBeNull();
  });

  it("returns null for empty inputs", () => {
    expect(estimateHouseholds("", "county", "Franklin")).toBeNull();
    expect(estimateHouseholds("OH", "county", "")).toBeNull();
  });

  it("hasEstimate agrees with estimateHouseholds", () => {
    expect(hasEstimate("OH", "county", "Franklin")).toBe(true);
    expect(hasEstimate("OH", "county", "Atlantis")).toBe(false);
  });

  it("listSeededGeographies returns sorted keys", () => {
    const counties = listSeededGeographies("OH", "county");
    expect(counties.length).toBeGreaterThan(5);
    const sorted = [...counties].sort();
    expect(counties).toEqual(sorted);
  });
});

// ── Volume band boundaries ───────────────────────────────────────────────────

describe("resolveVolumeBand", () => {
  it("throws below minimum", () => {
    expect(() => resolveVolumeBand(MINIMUM_TOTAL_PIECES - 1)).toThrow();
    expect(() => resolveVolumeBand(0)).toThrow();
  });

  it("picks the right band at each boundary", () => {
    expect(resolveVolumeBand(2_500)).toBe("2500_to_5000");
    expect(resolveVolumeBand(4_999)).toBe("2500_to_5000");
    expect(resolveVolumeBand(5_000)).toBe("5000_to_15000");
    expect(resolveVolumeBand(14_999)).toBe("5000_to_15000");
    expect(resolveVolumeBand(15_000)).toBe("15000_to_50000");
    expect(resolveVolumeBand(49_999)).toBe("15000_to_50000");
    expect(resolveVolumeBand(50_000)).toBe("50000_plus");
    expect(resolveVolumeBand(1_000_000)).toBe("50000_plus");
  });
});

// ── Quote generation — happy path ────────────────────────────────────────────

describe("generatePoliticalQuote — happy path", () => {
  it("returns a complete quote for a seeded Ohio county, 1 drop", () => {
    const q = generatePoliticalQuote(fixture({ drops: 1 }));
    expect(q.householdSource).toBe("estimate");
    expect(q.estimatedHouseholds).toBeGreaterThan(100_000);
    expect(q.totalPieces).toBe(q.estimatedHouseholds); // drops=1
    expect(q.volumeBand).toBe("50000_plus");
    expect(q.costPerPieceCents).toBe(DEFAULT_COST_PER_PIECE_CENTS["50000_plus"]);
    expect(q.pricePerPieceCents).toBe(DEFAULT_PRICE_PER_PIECE_CENTS.local["50000_plus"]);
    expect(q.subtotalCents).toBe(q.pricePerPieceCents * q.totalPieces);
    expect(q.totalCents).toBe(q.subtotalCents + q.addOnsCents);
    expect(q.internal.totalCostCents).toBe(q.costPerPieceCents * q.totalPieces);
  });

  it("honors householdCountOverride over the estimator", () => {
    const q = generatePoliticalQuote(fixture({ householdCountOverride: 10_000 }));
    expect(q.householdSource).toBe("override");
    expect(q.estimatedHouseholds).toBe(10_000);
    expect(q.totalPieces).toBe(10_000); // drops default 1
    expect(q.volumeBand).toBe("5000_to_15000");
  });

  it("multiplies pieces by drops", () => {
    const q = generatePoliticalQuote(
      fixture({ householdCountOverride: 4_000, drops: 3 }),
    );
    expect(q.totalPieces).toBe(12_000);
    expect(q.volumeBand).toBe("5000_to_15000");
  });

  it("is deterministic for the same input (modulo generatedAt)", () => {
    const a = generatePoliticalQuote(fixture({ householdCountOverride: 5_000 }));
    const b = generatePoliticalQuote(fixture({ householdCountOverride: 5_000 }));
    // Strip generatedAt before compare
    const stripTs = (q: typeof a) => ({ ...q, generatedAt: "" });
    expect(stripTs(a)).toEqual(stripTs(b));
  });
});

// ── Volume boundaries via the engine ─────────────────────────────────────────

describe("generatePoliticalQuote — volume boundaries", () => {
  it.each([
    [2_500, "2500_to_5000"],
    [4_999, "2500_to_5000"],
    [5_000, "5000_to_15000"],
    [14_999, "5000_to_15000"],
    [15_000, "15000_to_50000"],
    [49_999, "15000_to_50000"],
    [50_000, "50000_plus"],
  ] as const)("pieces=%i → band %s", (hh, band) => {
    const q = generatePoliticalQuote(fixture({ householdCountOverride: hh, drops: 1 }));
    expect(q.volumeBand).toBe(band);
  });

  it("throws BelowMinimumVolumeError below the floor", () => {
    expect(() =>
      generatePoliticalQuote(fixture({ householdCountOverride: 2_499 })),
    ).toThrow(BelowMinimumVolumeError);
  });
});

// ── District type price ordering ─────────────────────────────────────────────

describe("generatePoliticalQuote — district_type pricing", () => {
  it("local > state > federal at the same volume", () => {
    const base = fixture({ householdCountOverride: 10_000 });
    const local   = generatePoliticalQuote({ ...base, districtType: "local"   });
    const state   = generatePoliticalQuote({ ...base, districtType: "state"   });
    const federal = generatePoliticalQuote({ ...base, districtType: "federal" });
    expect(local.pricePerPieceCents).toBeGreaterThan(state.pricePerPieceCents);
    expect(state.pricePerPieceCents).toBeGreaterThan(federal.pricePerPieceCents);
  });

  it("per-piece price monotonically non-increasing as volume grows", () => {
    const levels = ["local", "state", "federal"] as const;
    for (const lvl of levels) {
      const prices = [3_000, 10_000, 25_000, 75_000].map(
        (hh) =>
          generatePoliticalQuote(
            fixture({ householdCountOverride: hh, districtType: lvl }),
          ).pricePerPieceCents,
      );
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]!);
      }
    }
  });
});

// ── Invariants ───────────────────────────────────────────────────────────────

describe("generatePoliticalQuote — invariants", () => {
  it("subtotal + addOns = total", () => {
    const q = generatePoliticalQuote(
      fixture({
        householdCountOverride: 8_000,
        addOns: {
          setup: true,
          design: true,
          rush: true,
          targeting: true,
          yardSigns: { quantity: 100 },
        },
      }),
    );
    expect(q.subtotalCents + q.addOnsCents).toBe(q.totalCents);
  });

  it("per-piece cost + margin = per-piece price", () => {
    const q = generatePoliticalQuote(
      fixture({ householdCountOverride: 20_000, districtType: "state" }),
    );
    expect(q.costPerPieceCents + q.marginPerPieceCents).toBe(q.pricePerPieceCents);
  });

  it("internal.totalMarginCents = totalCents - totalCostCents", () => {
    const q = generatePoliticalQuote(
      fixture({
        householdCountOverride: 7_500,
        addOns: { setup: true, targeting: true },
      }),
    );
    expect(q.internal.totalMarginCents).toBe(q.totalCents - q.internal.totalCostCents);
  });

  it("every integer field is an integer", () => {
    const q = generatePoliticalQuote(
      fixture({ householdCountOverride: 12_345, drops: 2 }),
    );
    for (const v of [
      q.estimatedHouseholds,
      q.totalPieces,
      q.costPerPieceCents,
      q.pricePerPieceCents,
      q.marginPerPieceCents,
      q.subtotalCents,
      q.addOnsCents,
      q.rushSurchargeCents,
      q.totalCents,
      q.internal.totalCostCents,
      q.internal.totalMarginCents,
      q.addOnBreakdown.setupCents,
      q.addOnBreakdown.designCents,
      q.addOnBreakdown.targetingCents,
      q.addOnBreakdown.yardSignsCents,
      q.addOnBreakdown.doorHangersCents,
    ]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

// ── Add-ons ──────────────────────────────────────────────────────────────────

describe("generatePoliticalQuote — add-ons", () => {
  it("no add-ons by default", () => {
    const q = generatePoliticalQuote(fixture({ householdCountOverride: 10_000 }));
    expect(q.addOnsCents).toBe(0);
    expect(q.rushSurchargeCents).toBe(0);
    expect(q.totalCents).toBe(q.subtotalCents);
  });

  it("setup + design + targeting add their flat fees", () => {
    const q = generatePoliticalQuote(
      fixture({
        householdCountOverride: 10_000,
        addOns: { setup: true, design: true, targeting: true },
      }),
    );
    expect(q.addOnBreakdown.setupCents).toBe(25_000);
    expect(q.addOnBreakdown.designCents).toBe(25_000);
    expect(q.addOnBreakdown.targetingCents).toBe(25_000);
    expect(q.addOnsCents).toBe(75_000); // 3 × $250
  });

  it("rush applies a percentage surcharge on the subtotal only", () => {
    const noRush = generatePoliticalQuote(
      fixture({ householdCountOverride: 10_000 }),
    );
    const rushed = generatePoliticalQuote(
      fixture({ householdCountOverride: 10_000, addOns: { rush: true } }),
    );
    // Default rushRate = 0.15; rushSurcharge should be 15% of subtotal.
    expect(rushed.rushSurchargeCents).toBe(Math.round(noRush.subtotalCents * 0.15));
    // Flat add-ons shouldn't change the rush amount.
    const rushedWithFlats = generatePoliticalQuote(
      fixture({
        householdCountOverride: 10_000,
        addOns: { rush: true, setup: true },
      }),
    );
    expect(rushedWithFlats.rushSurchargeCents).toBe(rushed.rushSurchargeCents);
  });

  it("yard signs add quantity × per-unit, integer-quantized", () => {
    const q = generatePoliticalQuote(
      fixture({
        householdCountOverride: 10_000,
        addOns: { yardSigns: { quantity: 50 } },
      }),
    );
    // Default $12/sign × 50 = $600 = 60,000 cents
    expect(q.addOnBreakdown.yardSignsCents).toBe(60_000);
  });

  it("fractional yard sign quantities floor to integer", () => {
    const q = generatePoliticalQuote(
      fixture({
        householdCountOverride: 10_000,
        addOns: { yardSigns: { quantity: 49.9 } },
      }),
    );
    expect(q.addOnBreakdown.yardSignsCents).toBe(49 * 1_200);
  });

  it("negative yard sign quantities clamp to zero", () => {
    const q = generatePoliticalQuote(
      fixture({
        householdCountOverride: 10_000,
        addOns: { yardSigns: { quantity: -5 } },
      }),
    );
    expect(q.addOnBreakdown.yardSignsCents).toBe(0);
  });
});

// ── Overrides ────────────────────────────────────────────────────────────────

describe("generatePoliticalQuote — overrides", () => {
  it("pricePerPieceCentsOverride takes precedence over the district×band lookup", () => {
    const q = generatePoliticalQuote(
      fixture({
        householdCountOverride: 10_000,
        pricePerPieceCentsOverride: 100, // $1.00/pc
      }),
    );
    expect(q.pricePerPieceCents).toBe(100);
    expect(q.subtotalCents).toBe(100 * 10_000);
  });

  it("costPerPieceCentsOverride takes precedence over the band lookup", () => {
    const q = generatePoliticalQuote(
      fixture({
        householdCountOverride: 10_000,
        costPerPieceCentsOverride: 20,
      }),
    );
    expect(q.costPerPieceCents).toBe(20);
  });

  it("configOverride lets the caller swap the whole pricing table", () => {
    const q = generatePoliticalQuote(
      fixture({
        householdCountOverride: 10_000,
        configOverride: {
          pricePerPieceCents: {
            local:   { "2500_to_5000": 99, "5000_to_15000": 99, "15000_to_50000": 99, "50000_plus": 99 },
            state:   { "2500_to_5000": 99, "5000_to_15000": 99, "15000_to_50000": 99, "50000_plus": 99 },
            federal: { "2500_to_5000": 99, "5000_to_15000": 99, "15000_to_50000": 99, "50000_plus": 99 },
          },
        },
      }),
    );
    expect(q.pricePerPieceCents).toBe(99);
  });

  it("region multiplier applies to price when the state matches", () => {
    const q = generatePoliticalQuote(
      fixture({
        householdCountOverride: 10_000,
        configOverride: {
          regionMultipliers: {
            OH: { priceMultiplier: 2 },
          },
        },
      }),
    );
    const base = DEFAULT_PRICE_PER_PIECE_CENTS.local["5000_to_15000"];
    expect(q.pricePerPieceCents).toBe(base * 2);
  });
});

// ── Timeline + recommendations ───────────────────────────────────────────────

describe("generatePoliticalQuote — timeline + recommendations", () => {
  it("tight=true when election is within threshold", () => {
    const q = generatePoliticalQuote(
      fixture({ householdCountOverride: 10_000, daysUntilElection: 10 }),
    );
    expect(q.estimatedDeliveryWindow.tight).toBe(true);
    expect(q.recommendations.warnings.some((w) => w.includes("Tight window"))).toBe(true);
  });

  it("tight=false when election is far out", () => {
    const q = generatePoliticalQuote(
      fixture({ householdCountOverride: 10_000, daysUntilElection: 200 }),
    );
    expect(q.estimatedDeliveryWindow.tight).toBe(false);
  });

  it("recommendedDrops scales with time", () => {
    expect(recommendDrops(null).recommended).toBe(3);
    expect(recommendDrops(200).recommended).toBe(3);
    expect(recommendDrops(90).recommended).toBe(2);
    expect(recommendDrops(40).recommended).toBe(1);
    expect(recommendDrops(15).recommended).toBe(1);
    expect(recommendDrops(-5).recommended).toBe(1);
  });

  it("warns when selected drops ≠ recommended", () => {
    const q = generatePoliticalQuote(
      fixture({
        householdCountOverride: 10_000,
        drops: 1,
        daysUntilElection: 200, // engine recommends 3
      }),
    );
    expect(q.recommendations.warnings.some((w) => w.includes("recommends 3"))).toBe(true);
  });

  it("warns when election has passed", () => {
    const q = generatePoliticalQuote(
      fixture({ householdCountOverride: 10_000, daysUntilElection: -3 }),
    );
    expect(q.recommendations.warnings.some((w) => w.includes("already passed"))).toBe(true);
  });
});

// ── Errors ───────────────────────────────────────────────────────────────────

describe("generatePoliticalQuote — errors", () => {
  it("NoHouseholdEstimateError when geography unknown and no override", () => {
    expect(() =>
      generatePoliticalQuote(fixture({ geographyValue: "Atlantis" })),
    ).toThrow(NoHouseholdEstimateError);
  });

  it("BelowMinimumVolumeError when total pieces below floor", () => {
    expect(() =>
      generatePoliticalQuote(fixture({ householdCountOverride: 1_000 })),
    ).toThrow(BelowMinimumVolumeError);
  });

  it("InvalidQuoteInputError on bad state code", () => {
    expect(() =>
      generatePoliticalQuote(fixture({ state: "OHIO" })),
    ).toThrow(InvalidQuoteInputError);
  });

  it("InvalidQuoteInputError on drops out of range", () => {
    expect(() =>
      generatePoliticalQuote(
        fixture({ householdCountOverride: 10_000, drops: 0 }),
      ),
    ).toThrow(InvalidQuoteInputError);
    expect(() =>
      generatePoliticalQuote(
        fixture({ householdCountOverride: 10_000, drops: 999 }),
      ),
    ).toThrow(InvalidQuoteInputError);
  });

  it("InvalidQuoteInputError on bad geographyValue", () => {
    expect(() =>
      generatePoliticalQuote(fixture({ geographyValue: "" })),
    ).toThrow(InvalidQuoteInputError);
  });
});

// ── Compliance surface ──────────────────────────────────────────────────────

describe("generatePoliticalQuote — compliance surface", () => {
  it("clientSummary exposes ONLY operational fields, never cost/margin/profit", () => {
    const q = generatePoliticalQuote(
      fixture({
        householdCountOverride: 10_000,
        addOns: { setup: true, rush: true },
      }),
    );
    const clientKeys = Object.keys(q.clientSummary).sort();
    expect(clientKeys).toEqual(
      ["deliveryWindowText", "drops", "households", "totalInvestmentCents", "totalPieces"].sort(),
    );
    // Forbidden keys MUST NOT appear on clientSummary
    for (const forbidden of ["cost", "margin", "profit", "costPerPiece", "marginPerPiece"]) {
      expect(Object.keys(q.clientSummary)).not.toContain(forbidden);
    }
  });

  it("internal block contains cost + margin + profit for backend use", () => {
    const q = generatePoliticalQuote(
      fixture({ householdCountOverride: 10_000 }),
    );
    expect(q.internal.totalCostCents).toBeGreaterThan(0);
    expect(q.internal.totalMarginCents).toBeGreaterThan(0);
    expect(q.internal.profitMarginPct).toBeGreaterThan(0);
  });

  it("no recommendation or warning contains persuasion or voter-scoring language", () => {
    const q = generatePoliticalQuote(
      fixture({ householdCountOverride: 10_000, daysUntilElection: 200 }),
    );
    const allText = [
      q.recommendations.recommendedDropsReason,
      ...q.recommendations.warnings,
    ].join(" ").toLowerCase();
    for (const forbidden of [
      "voter",
      "persuasion",
      "persuade",
      "turnout",
      "ideolog",
      "partisan",
      "swing",
      "gotv",
    ]) {
      expect(allText).not.toContain(forbidden);
    }
  });
});

// ── Performance ──────────────────────────────────────────────────────────────

describe("generatePoliticalQuote — performance", () => {
  it("completes well under 1 second (sanity <1ms for a typical call)", () => {
    const start = performance.now();
    for (let i = 0; i < 1_000; i++) {
      generatePoliticalQuote(fixture({ householdCountOverride: 12_345 + i }));
    }
    const elapsed = performance.now() - start;
    // 1,000 quotes << 1 second = plenty of headroom on real hardware.
    expect(elapsed).toBeLessThan(1_000);
  });
});
