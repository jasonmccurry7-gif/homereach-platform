export const PRODUCT_OVERVIEW_PATHS = {
  sharedPostcards: "/shared-postcards",
  targetedCampaigns: "/targeted",
  politicalCampaigns: "/political",
  inventoryIntelligence: "/inventory-purchasing",
  propertyIntelligence: "/property-intelligence",
  services: "/services",
  aiWebsiteAssistant: "/services/ai-website-assistant",
  localSeo: "/services/local-seo",
  reputation: "/services/reputation",
  socialContent: "/services/social-content",
  governmentContracts: "/services/government-contracts",
} as const;

export const PRODUCT_START_PATHS = {
  sharedPostcards: "/get-started",
  targetedCampaigns: "/targeted/start",
  politicalCampaigns: "/political/plan",
  inventoryIntelligence: "/operations-copilot/supplier-prices",
  propertyIntelligence: "/intelligence",
  aiWebsiteAssistant: "/waitlist?product=ai-website-assistant",
  localSeo: "/waitlist?product=local-seo",
  reputation: "/waitlist?product=reputation",
  socialContent: "/waitlist?product=social-content",
  governmentContracts: "/waitlist?product=government-contracts",
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

  try {
    const target = new URL(value, "https://home-reach.local");
    if (target.pathname.startsWith("/api/")) return fallback;
    if (target.pathname === "/login" || target.pathname === "/signup") {
      return fallback;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
