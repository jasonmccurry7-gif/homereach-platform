export const TARGETED_PRICING_TIERS = [
  {
    homes: 500,
    perPieceCents: 80,
    label: "Neighborhood Launch",
    shortLabel: "Launch",
    purpose: "Start with one focused homeowner area and get into market quickly.",
    strategy: "Best for first campaigns, tight service areas, and offer tests.",
    frequency: "1 drop",
    neighborhoods: "1 focused route cluster",
    visibilityImpact: "Local recognition starter",
    estimatedImpressions: 500,
    recommendedFor: ["Roofing", "HVAC", "Plumbing", "Landscaping"],
    popular: false,
  },
  {
    homes: 1000,
    perPieceCents: 77,
    label: "Local Awareness Expansion",
    shortLabel: "Expand",
    purpose: "Reach enough nearby homes to make the brand harder to miss.",
    strategy: "Best for local service businesses building repeat neighborhood visibility.",
    frequency: "1 drop",
    neighborhoods: "2 to 3 route clusters",
    visibilityImpact: "Stronger neighborhood presence",
    estimatedImpressions: 1000,
    recommendedFor: ["Pest Control", "Remodeling", "Flooring", "Concrete"],
    popular: false,
  },
  {
    homes: 2500,
    perPieceCents: 73,
    label: "High-Value Homeowner Reach",
    shortLabel: "Homeowner",
    purpose: "Cover a broader homeowner zone with a more serious market signal.",
    strategy: "Best for premium service categories, seasonal pushes, and high-ticket offers.",
    frequency: "1 drop",
    neighborhoods: "Multi-neighborhood coverage",
    visibilityImpact: "Route-level market pressure",
    estimatedImpressions: 2500,
    recommendedFor: ["Roofing", "Solar", "Remodeling", "Med Spas"],
    popular: true,
  },
  {
    homes: 5000,
    perPieceCents: 70,
    label: "Territory Domination",
    shortLabel: "Dominate",
    purpose: "Create a large-area visibility push before competitors own the route conversation.",
    strategy: "Best for expansion markets, storm response, category defense, and aggressive launch windows.",
    frequency: "1 drop",
    neighborhoods: "City or multi-ZIP saturation",
    visibilityImpact: "High local saturation",
    estimatedImpressions: 5000,
    recommendedFor: ["Roofing", "HVAC", "Political Campaigns", "Real Estate"],
    popular: false,
  },
] as const;

export const TARGETED_CAMPAIGN_PLAYBOOKS = [
  {
    title: "Storm Recovery Campaign",
    packageHomes: 5000,
    signal: "Fast visibility after weather or urgent neighborhood demand.",
  },
  {
    title: "Repeat Visibility",
    packageHomes: 2500,
    signal: "Use the same route set again to build recognition over time.",
  },
  {
    title: "Protected Category Push",
    packageHomes: 2500,
    signal: "Request a human review for category protection before launch.",
  },
  {
    title: "Service Radius Builder",
    packageHomes: 1000,
    signal: "Expand around the shop, showroom, or strongest jobsite cluster.",
  },
] as const;

export type TargetedPricingTier = (typeof TARGETED_PRICING_TIERS)[number];
export type TargetedHomesCount = TargetedPricingTier["homes"];

export const VALID_TARGETED_HOMES_COUNTS = TARGETED_PRICING_TIERS.map(
  (tier) => tier.homes,
) as TargetedHomesCount[];

export function isTargetedHomesCount(value: number): value is TargetedHomesCount {
  return VALID_TARGETED_HOMES_COUNTS.includes(value as TargetedHomesCount);
}

export function getTargetedPricingTier(homesCount: number) {
  return TARGETED_PRICING_TIERS.find((tier) => tier.homes === homesCount) ?? null;
}

export function resolveTargetedCampaignPriceCents(homesCount: number): number {
  const tier = getTargetedPricingTier(homesCount);
  if (!tier) {
    throw new Error(
      `homesCount must be one of: ${VALID_TARGETED_HOMES_COUNTS.join(", ")}`,
    );
  }

  return tier.homes * tier.perPieceCents;
}

export function formatTargetedCampaignDollars(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })}`;
}

export function getTargetedCampaignTotalCents(tier: TargetedPricingTier) {
  return tier.homes * tier.perPieceCents;
}
