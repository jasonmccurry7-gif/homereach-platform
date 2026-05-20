export const PRODUCT_OVERVIEW_PATHS = {
  sharedPostcards: "/shared-postcards",
  targetedCampaigns: "/targeted",
  politicalCampaigns: "/political",
  inventoryIntelligence: "/inventory-purchasing",
  propertyIntelligence: "/property-intelligence",
} as const;

export const PRODUCT_START_PATHS = {
  sharedPostcards: "/get-started",
  targetedCampaigns: "/targeted/start",
  politicalCampaigns: "/political/plan",
  inventoryIntelligence: "/operations-copilot/supplier-prices",
  propertyIntelligence: "/intelligence",
  yardSigns: "/targeted/start?product=yard-signs",
  doorHangers: "/targeted/start?product=door-hangers",
  businessCards: "/targeted/start?product=business-cards",
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
