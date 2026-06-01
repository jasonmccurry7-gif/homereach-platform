export type NeighborhoodSaturationAreaType = "neighborhood" | "zip" | "route_cluster" | "city" | "custom_area";

export type NeighborhoodSaturationArea = {
  name: string;
  geography: string;
  areaType: NeighborhoodSaturationAreaType;
  priority: "primary" | "secondary";
  notes?: string | null;
  recommendedMonthlyBudgetCents: number;
};

export type NeighborhoodSaturationMetadata = {
  enabled: boolean;
  areas: NeighborhoodSaturationArea[];
  saturationGoal?: string | null;
  directMailQuantity?: number | null;
  planningNotes?: string | null;
  score: number;
  priority: "high" | "medium" | "low";
  scoreReasons: string[];
  missingItems: string[];
};

const STRONG_INDUSTRY_FIT = [
  "roof",
  "hvac",
  "lawn",
  "landscap",
  "pest",
  "concrete",
  "siding",
  "window",
  "solar",
  "real estate",
  "realtor",
  "med spa",
  "dent",
  "restaurant",
  "political",
] as const;

function normalizeLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parsePriority(value: string | null | undefined): "primary" | "secondary" {
  return String(value ?? "").toLowerCase().includes("secondary") ? "secondary" : "primary";
}

function parseDirectMailQuantity(value: string | null | undefined) {
  const numeric = Number(String(value ?? "").replace(/[^0-9]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.min(250000, Math.round(numeric));
}

function splitLooseList(value: string | null | undefined) {
  return String(value ?? "")
    .split(/[\n,;]+/)
    .map(normalizeLine)
    .filter(Boolean)
    .slice(0, 20);
}

function parseAreaLines(input: {
  raw?: string | null;
  areaType: NeighborhoodSaturationAreaType;
  monthlyAdBudgetCents: number;
  fallbackPrefix: string;
}) {
  const lines = splitLooseList(input.raw).slice(0, 12);
  const perAreaBudget = Math.round(input.monthlyAdBudgetCents / Math.max(1, lines.length));

  return lines.map((line, index) => {
    const [namePart, geographyPart, priorityPart, notesPart] = line.split("|").map((part) => normalizeLine(part ?? ""));
    const geography = String(geographyPart || namePart);
    const name = geographyPart ? namePart || `${input.fallbackPrefix} ${index + 1}` : `${input.fallbackPrefix} ${index + 1}`;

    return {
      name,
      geography,
      areaType: input.areaType,
      priority: parsePriority(priorityPart),
      notes: notesPart || null,
      recommendedMonthlyBudgetCents: perAreaBudget,
    } satisfies NeighborhoodSaturationArea;
  });
}

function buildZipAreas(input: { raw?: string | null; monthlyAdBudgetCents: number; existingAreaCount: number }) {
  const zips = splitLooseList(input.raw).slice(0, 12);
  const totalAreas = Math.max(1, input.existingAreaCount + zips.length);
  const perAreaBudget = Math.round(input.monthlyAdBudgetCents / totalAreas);

  return zips.map((zip) => ({
    name: `ZIP ${zip}`,
    geography: zip,
    areaType: "zip" as const,
    priority: "secondary" as const,
    notes: "ZIP supplied during Neighborhood Saturation intake.",
    recommendedMonthlyBudgetCents: perAreaBudget,
  }));
}

function scoreNeighborhoodSaturation(input: {
  areas: NeighborhoodSaturationArea[];
  industry?: string | null;
  monthlyAdBudgetCents: number;
  postcardAddon: boolean;
  campaignOffer?: string | null;
  directMailQuantity?: number | null;
}) {
  const scoreReasons: string[] = [];
  const missingItems: string[] = [];
  let score = 50;
  const areaCount = input.areas.length;
  const budgetPerArea = input.monthlyAdBudgetCents / Math.max(1, areaCount);
  const lowerIndustry = String(input.industry ?? "").toLowerCase();

  if (areaCount === 0) {
    score -= 35;
    missingItems.push("Add at least one target neighborhood, ZIP, or route cluster.");
  } else if (areaCount <= 3) {
    score += 20;
    scoreReasons.push("Focused area count supports a cleaner first test.");
  } else if (areaCount <= 6) {
    score += 10;
    scoreReasons.push("Area count is workable if budget is allocated carefully.");
  } else {
    score -= 10;
    missingItems.push("Reduce the first launch area count or increase budget before launch.");
  }

  if (budgetPerArea >= 50000) {
    score += 20;
    scoreReasons.push("Budget per area is strong for a starter saturation test.");
  } else if (budgetPerArea >= 25000) {
    score += 10;
    scoreReasons.push("Budget per area is acceptable for a focused starter test.");
  } else {
    score -= 15;
    missingItems.push("Budget is thin for the number of areas selected.");
  }

  if (STRONG_INDUSTRY_FIT.some((token) => lowerIndustry.includes(token))) {
    score += 10;
    scoreReasons.push("Industry is a strong fit for neighborhood visibility.");
  }

  if (String(input.campaignOffer ?? "").trim()) {
    score += 5;
    scoreReasons.push("Campaign offer is available for creative planning.");
  } else {
    missingItems.push("Confirm the campaign offer before launch.");
  }

  if (input.postcardAddon || Number(input.directMailQuantity ?? 0) > 0) {
    score += 10;
    scoreReasons.push("Direct mail can create repeated exposure in the same area.");
  }

  const finalScore = clampScore(score);
  return {
    score: finalScore,
    priority: finalScore >= 75 ? "high" : finalScore >= 55 ? "medium" : "low",
    scoreReasons,
    missingItems,
  } as const;
}

export function buildNeighborhoodSaturationMetadata(input: {
  industry?: string | null;
  monthlyAdBudgetCents: number;
  postcardAddon: boolean;
  campaignOffer?: string | null;
  rawAreas?: string | null;
  zipCodes?: string | null;
  routeClusters?: string | null;
  saturationGoal?: string | null;
  directMailQuantity?: string | null;
  planningNotes?: string | null;
}) {
  const baseAreas = parseAreaLines({
    raw: input.rawAreas,
    areaType: "neighborhood",
    monthlyAdBudgetCents: input.monthlyAdBudgetCents,
    fallbackPrefix: "Neighborhood",
  });
  const routeAreas = parseAreaLines({
    raw: input.routeClusters,
    areaType: "route_cluster",
    monthlyAdBudgetCents: input.monthlyAdBudgetCents,
    fallbackPrefix: "Route Cluster",
  });
  const zipAreas = buildZipAreas({
    raw: input.zipCodes,
    monthlyAdBudgetCents: input.monthlyAdBudgetCents,
    existingAreaCount: baseAreas.length + routeAreas.length,
  });
  const areas = [...baseAreas, ...routeAreas, ...zipAreas].slice(0, 20);
  const directMailQuantity = parseDirectMailQuantity(input.directMailQuantity);
  const score = scoreNeighborhoodSaturation({
    areas,
    industry: input.industry,
    monthlyAdBudgetCents: input.monthlyAdBudgetCents,
    postcardAddon: input.postcardAddon,
    campaignOffer: input.campaignOffer,
    directMailQuantity,
  });

  return {
    enabled:
      areas.length > 0 ||
      Boolean(String(input.saturationGoal ?? "").trim()) ||
      Boolean(String(input.planningNotes ?? "").trim()) ||
      Boolean(directMailQuantity),
    areas,
    saturationGoal: input.saturationGoal?.trim() || null,
    directMailQuantity,
    planningNotes: input.planningNotes?.trim() || null,
    score: score.score,
    priority: score.priority,
    scoreReasons: score.scoreReasons,
    missingItems: score.missingItems,
  } satisfies NeighborhoodSaturationMetadata;
}

export function getNeighborhoodSaturationMetadata(metadata: unknown): NeighborhoodSaturationMetadata | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { neighborhood_saturation?: unknown }).neighborhood_saturation;
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<NeighborhoodSaturationMetadata>;
  const areas = Array.isArray(candidate.areas)
    ? candidate.areas
        .filter((item): item is NeighborhoodSaturationArea => Boolean(item && typeof item.geography === "string"))
        .map((item, index) => ({
          name: item.name || `Neighborhood ${index + 1}`,
          geography: item.geography,
          areaType: item.areaType || "custom_area",
          priority: (item.priority === "secondary" ? "secondary" : "primary") as "primary" | "secondary",
          notes: item.notes ?? null,
          recommendedMonthlyBudgetCents: Number.isFinite(Number(item.recommendedMonthlyBudgetCents))
            ? Number(item.recommendedMonthlyBudgetCents)
            : 0,
        }))
    : [];

  return {
    enabled: Boolean(candidate.enabled || areas.length > 0),
    areas,
    saturationGoal: candidate.saturationGoal ?? null,
    directMailQuantity: Number.isFinite(Number(candidate.directMailQuantity)) ? Number(candidate.directMailQuantity) : null,
    planningNotes: candidate.planningNotes ?? null,
    score: Number.isFinite(Number(candidate.score)) ? Number(candidate.score) : 0,
    priority: candidate.priority === "high" || candidate.priority === "medium" ? candidate.priority : "low",
    scoreReasons: Array.isArray(candidate.scoreReasons) ? candidate.scoreReasons.filter((item) => typeof item === "string") : [],
    missingItems: Array.isArray(candidate.missingItems) ? candidate.missingItems.filter((item) => typeof item === "string") : [],
  };
}

export function buildNeighborhoodSaturationCampaignLocationRows(input: {
  campaignId: string;
  metadata: unknown;
  fallbackTargetArea?: string | null;
}) {
  const neighborhood = getNeighborhoodSaturationMetadata(input.metadata);
  if (!neighborhood?.areas.length) return [];

  return neighborhood.areas.map((area) => ({
    campaign_id: input.campaignId,
    location_type: "target_geography",
    name: area.name,
    address: null,
    radius_miles: null,
    notes: [
      `Geography: ${area.geography}`,
      `Type: ${area.areaType}`,
      `Priority: ${area.priority}`,
      area.recommendedMonthlyBudgetCents ? `Suggested monthly budget: $${Math.round(area.recommendedMonthlyBudgetCents / 100)}` : null,
      area.notes,
      neighborhood.saturationGoal ? `Goal: ${neighborhood.saturationGoal}` : null,
      neighborhood.planningNotes,
      input.fallbackTargetArea,
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 1800),
  }));
}

export function summarizeNeighborhoodSaturation(input: NeighborhoodSaturationMetadata | null) {
  if (!input?.enabled) return "No structured Neighborhood Saturation details submitted.";
  const count = input.areas.length;
  const areaWord = count === 1 ? "area" : "areas";
  return `${count} saturation ${areaWord}; score ${input.score}/100 (${input.priority} priority).`;
}
