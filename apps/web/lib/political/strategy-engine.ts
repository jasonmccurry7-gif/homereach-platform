import type { DistrictType, GeographyType } from "./queries";
import { estimateHouseholds } from "./household-estimator";
import {
  DEFAULT_ADD_ON_PRICES,
  MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS,
  DEFAULT_TIMELINE,
  MINIMUM_TOTAL_PIECES,
  recommendDrops,
  resolvePoliticalPostcardPriceCents,
} from "./pricing-config";

export type CampaignGoal = "awareness" | "persuasion" | "gotv";
export type StrategyType = "coverage" | "precision" | "hybrid";
export type ScenarioKind =
  | "custom"
  | "full_coverage"
  | "optimized"
  | "budget_constrained"
  | "hybrid"
  | "targeted_only";
export type DeliveryConfidence = "high" | "medium" | "risk";

export interface StrategyRoute {
  id: string;
  label: string;
  households: number;
  densityScore?: number;
  adjacentRouteIds?: string[];
}

export interface StrategyEngineInput {
  goal: CampaignGoal;
  budgetCents: number;
  state: string;
  geographyType: GeographyType;
  geographyValue: string;
  districtType: DistrictType;
  daysUntilElection?: number | null;
  electionDate?: string | null;
  dropCount?: number;
  campaignListAddresses?: number;
  householdCountOverride?: number;
  coverageUniverseHouseholds?: number;
  routes?: StrategyRoute[];
  includeSetup?: boolean;
  includeDesign?: boolean;
}

export interface StrategyLayer {
  label: string;
  strategy: StrategyType;
  available: boolean;
  routeCount: number;
  households: number;
  totalPieces: number;
  costCents: number;
  costPerHouseholdCents: number;
  coveragePct: number;
  estimatedImpressions: number;
  note: string;
}

export interface StrategyScenario {
  kind: ScenarioKind;
  label: string;
  strategy: StrategyType;
  routeCount: number;
  households: number;
  coveragePct: number;
  drops: number;
  totalPieces: number;
  totalCostCents: number;
  costPerHouseholdCents: number;
  estimatedImpressions: number;
  tradeoff: string;
}

export interface DropScheduleItem {
  wave: number;
  objective: "Intro" | "Reinforcement" | "Closing" | "GOTV";
  daysBeforeElection: number | null;
  volume: number;
}

export interface StrategyRecommendation {
  recommendedStrategy: StrategyType;
  headline: string;
  whyThisPlan: string;
  coverageLayer: StrategyLayer;
  precisionLayer: StrategyLayer;
  combined: {
    totalReach: number;
    totalPieces: number;
    totalCostCents: number;
    costPerHouseholdCents: number;
    estimatedImpressions: number;
  };
  scenarios: StrategyScenario[];
  suggestedDropSchedule: DropScheduleItem[];
  coverageStrengthScore: number;
  deliveryConfidence: DeliveryConfidence;
  timeToImpact: {
    productionDays: number;
    mailWindowDays: string;
    launchWindowDays: number | null;
    printDeadlineText: string;
    nextAvailableDropText: string;
  };
  complianceNote: string;
}

const AVG_ROUTE_HOUSEHOLDS = 650;
const IMPRESSION_FACTOR = 2.1;
const TARGETED_PRICE_PER_ADDRESS_CENTS = MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS;

function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 10_000) / 100;
}

function moneyPerHousehold(costCents: number, households: number): number {
  if (households <= 0) return 0;
  return Math.round(costCents / households);
}

function safeBudget(cents: number): number {
  return clampInt(cents, 0, 100_000_000);
}

function resolveHouseholds(input: StrategyEngineInput): number {
  if (typeof input.householdCountOverride === "number") {
    return clampInt(input.householdCountOverride, 0, 10_000_000);
  }

  if (input.routes && input.routes.length > 0) {
    return input.routes.reduce((sum, route) => sum + Math.max(0, Math.floor(route.households)), 0);
  }

  return (
    estimateHouseholds(input.state, input.geographyType, input.geographyValue) ??
    0
  );
}

function estimateRouteCount(households: number, routes?: StrategyRoute[]): number {
  if (routes && routes.length > 0) return routes.length;
  return households > 0 ? Math.max(1, Math.ceil(households / AVG_ROUTE_HOUSEHOLDS)) : 0;
}

function priceCoverage(input: {
  households: number;
  drops: number;
  districtType: DistrictType;
  includeSetup: boolean;
  includeDesign: boolean;
}): number {
  if (input.households <= 0) return 0;
  const billablePieces = Math.max(MINIMUM_TOTAL_PIECES, input.households * input.drops);
  const perPiece = resolvePoliticalPostcardPriceCents(input.districtType, billablePieces);
  const addOns =
    (input.includeSetup ? DEFAULT_ADD_ON_PRICES.setupCents : 0) +
    (input.includeDesign ? DEFAULT_ADD_ON_PRICES.designCents : 0);
  return billablePieces * perPiece + addOns;
}

function pricePrecision(addresses: number, drops: number, includeSetup: boolean): number {
  if (addresses <= 0) return 0;
  const billablePieces = Math.max(MINIMUM_TOTAL_PIECES, addresses * drops);
  const setup = includeSetup ? DEFAULT_ADD_ON_PRICES.targetingCents : 0;
  return billablePieces * TARGETED_PRICE_PER_ADDRESS_CENTS + setup;
}

function recommendedStrategy(input: StrategyEngineInput): StrategyType {
  const budget = safeBudget(input.budgetCents);
  const days = input.daysUntilElection ?? null;
  const highBudget = budget >= 10_000_000;
  const shortTimeline = days !== null && days < 30;

  if (input.goal === "gotv" || (highBudget && shortTimeline)) return "hybrid";
  if (input.goal === "persuasion") return "precision";
  return "coverage";
}

function buildWhy(strategy: StrategyType, input: StrategyEngineInput): string {
  const geography = input.geographyValue || input.state;
  if (strategy === "hybrid") {
    return `This plan combines broad household visibility across ${geography} with a campaign-provided list layer for reinforcement near the mail window. It maximizes reach while preserving budget control and avoids voter prediction or profiling.`;
  }
  if (strategy === "precision") {
    return `This plan emphasizes a campaign-provided address list so the campaign can focus mail volume where it already has a lawful list source. It keeps cost predictable and avoids voter inference, ideology scoring, or persuasion modeling.`;
  }
  return `This plan prioritizes broad route-level coverage across ${geography}, giving the campaign a clear cost, reach, and delivery window without needing voter-level data.`;
}

function buildCoverageLayer(
  input: StrategyEngineInput,
  selectedHouseholds: number,
  universeHouseholds: number,
  drops: number,
): StrategyLayer {
  const routeCount = estimateRouteCount(selectedHouseholds, input.routes);
  const costCents = priceCoverage({
    households: selectedHouseholds,
    drops,
    districtType: input.districtType,
    includeSetup: input.includeSetup ?? false,
    includeDesign: input.includeDesign ?? false,
  });

  return {
    label: "Coverage Layer (EDDM)",
    strategy: "coverage",
    available: selectedHouseholds > 0,
    routeCount,
    households: selectedHouseholds,
    totalPieces: selectedHouseholds * drops,
    costCents,
    costPerHouseholdCents: moneyPerHousehold(costCents, selectedHouseholds),
    coveragePct: pct(selectedHouseholds, universeHouseholds),
    estimatedImpressions: Math.round(selectedHouseholds * drops * IMPRESSION_FACTOR),
    note: "Route-level household coverage using aggregate counts.",
  };
}

function buildPrecisionLayer(input: StrategyEngineInput, totalHouseholds: number, drops: number): StrategyLayer {
  const listAddresses = clampInt(input.campaignListAddresses ?? 0, 0, 10_000_000);
  const costCents = pricePrecision(listAddresses, drops, input.includeSetup ?? false);

  return {
    label: "Targeted Layer (Campaign-Provided List)",
    strategy: "precision",
    available: listAddresses > 0,
    routeCount: 0,
    households: listAddresses,
    totalPieces: listAddresses * drops,
    costCents,
    costPerHouseholdCents: moneyPerHousehold(costCents, listAddresses),
    coveragePct: pct(listAddresses, totalHouseholds),
    estimatedImpressions: Math.round(listAddresses * drops * IMPRESSION_FACTOR),
    note: listAddresses > 0
      ? "Priced from the campaign-provided address count."
      : "Add a campaign-provided list count to price this layer.",
  };
}

function budgetCoverageHouseholds(input: StrategyEngineInput, budgetCents: number, drops: number, totalHouseholds: number): number {
  if (budgetCents <= 0 || totalHouseholds <= 0) return 0;
  const includeSetup = input.includeSetup ?? false;
  const includeDesign = input.includeDesign ?? false;
  let best = 0;

  // Binary search because volume bands change the per-piece rate.
  let lo = 0;
  let hi = totalHouseholds;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const cost = priceCoverage({
      households: mid,
      drops,
      districtType: input.districtType,
      includeSetup,
      includeDesign,
    });
    if (cost <= budgetCents) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function scenario(args: {
  input: StrategyEngineInput;
  kind: ScenarioKind;
  label: string;
  strategy: StrategyType;
  households: number;
  totalHouseholds: number;
  drops: number;
  costCents: number;
  tradeoff: string;
  routeCount?: number;
  totalPieces?: number;
  estimatedImpressions?: number;
}): StrategyScenario {
  return {
    kind: args.kind,
    label: args.label,
    strategy: args.strategy,
    routeCount: args.routeCount ?? estimateRouteCount(args.households, args.input.routes),
    households: args.households,
    coveragePct: pct(args.households, args.totalHouseholds),
    drops: args.drops,
    totalPieces: args.totalPieces ?? args.households * args.drops,
    totalCostCents: args.costCents,
    costPerHouseholdCents: moneyPerHousehold(args.costCents, args.households),
    estimatedImpressions:
      args.estimatedImpressions ?? Math.round(args.households * args.drops * IMPRESSION_FACTOR),
    tradeoff: args.tradeoff,
  };
}

function buildScenarios(input: StrategyEngineInput, totalHouseholds: number, drops: number): StrategyScenario[] {
  const budget = safeBudget(input.budgetCents);
  const selectedHouseholds = Math.min(resolveHouseholds(input), totalHouseholds);
  const hasCustomSelection = Boolean(input.routes?.length) || (
    typeof input.householdCountOverride === "number" &&
    input.householdCountOverride !== totalHouseholds
  );
  const customCost = priceCoverage({
    households: selectedHouseholds,
    drops,
    districtType: input.districtType,
    includeSetup: input.includeSetup ?? false,
    includeDesign: input.includeDesign ?? false,
  });
  const fullCost = priceCoverage({
    households: totalHouseholds,
    drops,
    districtType: input.districtType,
    includeSetup: input.includeSetup ?? false,
    includeDesign: input.includeDesign ?? false,
  });
  const budgetHouseholds = budgetCoverageHouseholds(input, budget, drops, totalHouseholds);
  const optimizedHouseholds = Math.min(totalHouseholds, Math.max(budgetHouseholds, Math.round(totalHouseholds * 0.5)));
  const optimizedCost = priceCoverage({
    households: optimizedHouseholds,
    drops,
    districtType: input.districtType,
    includeSetup: input.includeSetup ?? false,
    includeDesign: input.includeDesign ?? false,
  });
  const listAddresses = clampInt(input.campaignListAddresses ?? 0, 0, totalHouseholds || 10_000_000);
  const targetedCost = pricePrecision(listAddresses, drops, input.includeSetup ?? false);
  const hybridPieces = totalHouseholds * drops + listAddresses * drops;
  const hybridCost = fullCost + targetedCost;
  const scenarios: StrategyScenario[] = [];

  if (hasCustomSelection) {
    scenarios.push(
      scenario({
        input,
        kind: "custom",
        label: "Custom Selection",
        strategy: "coverage",
        households: selectedHouseholds,
        totalHouseholds,
        drops,
        costCents: customCost,
        tradeoff: "Uses the routes currently selected in the planner.",
      }),
    );
  }

  scenarios.push(
    scenario({
      input,
      kind: "full_coverage",
      label: "Full Coverage",
      strategy: "coverage",
      households: totalHouseholds,
      totalHouseholds,
      drops,
      costCents: fullCost,
      tradeoff: "Maximum household visibility, highest route-level reach.",
    }),
    scenario({
      input,
      kind: "optimized",
      label: "Optimized Coverage",
      strategy: "coverage",
      households: optimizedHouseholds,
      totalHouseholds,
      drops,
      costCents: optimizedCost,
      tradeoff: "Balances coverage and cost by concentrating spend into denser route coverage.",
    }),
    scenario({
      input,
      kind: "budget_constrained",
      label: "Budget-Constrained",
      strategy: "coverage",
      households: budgetHouseholds,
      totalHouseholds,
      drops,
      costCents: budget > 0 ? Math.min(budget, priceCoverage({
        households: budgetHouseholds,
        drops,
        districtType: input.districtType,
        includeSetup: input.includeSetup ?? false,
        includeDesign: input.includeDesign ?? false,
      })) : 0,
      tradeoff: "Keeps the plan inside the entered budget, with less total coverage.",
    }),
    scenario({
      input,
      kind: "hybrid",
      label: "Winning Strategy",
      strategy: "hybrid",
      households: totalHouseholds,
      totalHouseholds,
      drops,
      costCents: hybridCost,
      routeCount: estimateRouteCount(totalHouseholds),
      totalPieces: hybridPieces,
      estimatedImpressions: Math.round(hybridPieces * IMPRESSION_FACTOR),
      tradeoff: "Combines full coverage with a campaign-provided list layer for reinforcement.",
    }),
    scenario({
      input,
      kind: "targeted_only",
      label: "Precision Only",
      strategy: "precision",
      households: listAddresses,
      totalHouseholds,
      drops,
      costCents: targetedCost,
      tradeoff: "Uses only the campaign-provided address list. Add list count for a firm estimate.",
    }),
  );

  return scenarios;
}

function buildDropSchedule(drops: number, daysUntilElection: number | null, households: number): DropScheduleItem[] {
  const objectives: DropScheduleItem["objective"][] =
    drops >= 5
      ? ["Intro", "Reinforcement", "Reinforcement", "Closing", "GOTV"]
      : drops === 3
        ? ["Intro", "Reinforcement", "GOTV"]
        : drops === 2
          ? ["Intro", "GOTV"]
          : ["GOTV"];

  return Array.from({ length: drops }, (_, i) => {
    const spacing = daysUntilElection === null
      ? null
      : Math.max(7, Math.round(daysUntilElection - ((drops - i) * 14)));
    return {
      wave: i + 1,
      objective: objectives[i] ?? "Reinforcement",
      daysBeforeElection: spacing,
      volume: households,
    };
  });
}

function scoreCoverage(coveragePct: number, drops: number, daysUntilElection: number | null): number {
  const coverageScore = Math.min(60, coveragePct * 0.6);
  const dropScore = Math.min(20, drops * 7);
  const timingScore =
    daysUntilElection === null ? 12 :
    daysUntilElection >= 45 ? 20 :
    daysUntilElection >= 21 ? 14 :
    daysUntilElection >= 10 ? 8 :
    3;
  return clampInt(Math.round(coverageScore + dropScore + timingScore), 0, 100);
}

function confidence(daysUntilElection: number | null): DeliveryConfidence {
  const minDays = DEFAULT_TIMELINE.productionDays + DEFAULT_TIMELINE.mailMinDays;
  const maxDays = DEFAULT_TIMELINE.productionDays + DEFAULT_TIMELINE.mailMaxDays;
  if (daysUntilElection === null) return "medium";
  if (daysUntilElection >= maxDays + 7) return "high";
  if (daysUntilElection >= minDays) return "medium";
  return "risk";
}

function timeToImpact(daysUntilElection: number | null): StrategyRecommendation["timeToImpact"] {
  const maxDays = DEFAULT_TIMELINE.productionDays + DEFAULT_TIMELINE.mailMaxDays;
  const launchWindowDays = daysUntilElection === null ? null : daysUntilElection - maxDays;
  const printDeadlineText = launchWindowDays === null
    ? "Add election date to calculate launch deadline."
    : launchWindowDays >= 0
      ? `Approve within ${launchWindowDays} day${launchWindowDays === 1 ? "" : "s"} to preserve the standard in-home window.`
      : "Standard in-home window is at risk. Rush review is required.";

  return {
    productionDays: DEFAULT_TIMELINE.productionDays,
    mailWindowDays: `${DEFAULT_TIMELINE.mailMinDays}-${DEFAULT_TIMELINE.mailMaxDays}`,
    launchWindowDays,
    printDeadlineText,
    nextAvailableDropText: launchWindowDays !== null && launchWindowDays < 7
      ? "Next available drop is limited capacity."
      : "Next available drop window is open.",
  };
}

export function generateCampaignStrategy(input: StrategyEngineInput): StrategyRecommendation {
  const selectedHouseholds = resolveHouseholds(input);
  const universeHouseholds = Math.max(
    selectedHouseholds,
    clampInt(input.coverageUniverseHouseholds ?? selectedHouseholds, 0, 10_000_000),
  );
  const recommendedDrops = recommendDrops(input.daysUntilElection ?? null).recommended;
  const drops = clampInt(input.dropCount ?? recommendedDrops, 1, 5);
  const selectedStrategy = recommendedStrategy(input);
  const coverageLayer = buildCoverageLayer(input, selectedHouseholds, universeHouseholds, drops);
  const precisionLayer = buildPrecisionLayer(input, universeHouseholds, drops);
  const activePrecisionCost = selectedStrategy === "coverage" ? 0 : precisionLayer.costCents;
  const activePrecisionPieces = selectedStrategy === "coverage" ? 0 : precisionLayer.totalPieces;
  const activePrecisionImpressions = selectedStrategy === "coverage" ? 0 : precisionLayer.estimatedImpressions;
  const totalCost = selectedStrategy === "precision"
    ? precisionLayer.costCents
    : coverageLayer.costCents + activePrecisionCost;
  const totalReach = selectedStrategy === "precision"
    ? precisionLayer.households
    : coverageLayer.households;

  const coveragePct = selectedStrategy === "precision"
    ? precisionLayer.coveragePct
    : coverageLayer.coveragePct;

  return {
    recommendedStrategy: selectedStrategy,
    headline:
      selectedStrategy === "hybrid"
        ? "Recommended Plan: Winning Strategy (Hybrid)"
        : selectedStrategy === "precision"
          ? "Recommended Plan: Precision Strategy"
          : "Recommended Plan: Coverage Strategy",
    whyThisPlan: buildWhy(selectedStrategy, input),
    coverageLayer,
    precisionLayer,
    combined: {
      totalReach,
      totalPieces: selectedStrategy === "precision"
        ? precisionLayer.totalPieces
        : coverageLayer.totalPieces + activePrecisionPieces,
      totalCostCents: totalCost,
      costPerHouseholdCents: moneyPerHousehold(totalCost, totalReach),
      estimatedImpressions: selectedStrategy === "precision"
        ? precisionLayer.estimatedImpressions
        : coverageLayer.estimatedImpressions + activePrecisionImpressions,
    },
    scenarios: buildScenarios(input, universeHouseholds, drops),
    suggestedDropSchedule: buildDropSchedule(drops, input.daysUntilElection ?? null, selectedHouseholds),
    coverageStrengthScore: scoreCoverage(coveragePct, drops, input.daysUntilElection ?? null),
    deliveryConfidence: confidence(input.daysUntilElection ?? null),
    timeToImpact: timeToImpact(input.daysUntilElection ?? null),
    complianceNote:
      "Recommendations use geography, household counts, route logistics, budget, and timing only. They do not predict votes, classify ideology, or infer individual behavior.",
  };
}
