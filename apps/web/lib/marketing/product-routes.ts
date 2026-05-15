export const PRODUCT_OVERVIEW_PATHS = {
  sharedPostcards: "/shared-postcards",
  targetedCampaigns: "/targeted",
  politicalCampaigns: "/political",
  inventoryIntelligence: "/inventory-purchasing",
  propertyIntelligence: "/property-intelligence",
} as const;

export const PRODUCT_START_PATHS = {
  sharedPostcards: "/get-started",
  targetedCampaigns: "/targeted/intake",
  politicalCampaigns: "/political/plan",
  inventoryIntelligence: "/inventory-purchasing/dashboard",
  propertyIntelligence: "/intelligence",
  yardSigns: "/targeted/intake?product=yard-signs",
  doorHangers: "/targeted/intake?product=door-hangers",
  businessCards: "/targeted/intake?product=business-cards",
} as const;

export function accountStartHref(redirectPath: string) {
  return `/signup?redirect=${encodeURIComponent(redirectPath)}`;
}

export function loginHref(redirectPath: string) {
  return `/login?redirect=${encodeURIComponent(redirectPath)}`;
}

export function safeRelativeRedirect(value: string | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}
