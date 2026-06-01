export const PRODUCT_OVERVIEW_PATHS = {
  marketCapture: "/market-capture",
  sharedPostcards: "/shared-postcards",
  targetedCampaigns: "/targeted",
  digitalTargeting: "/digital-targeting",
  politicalCampaigns: "/political",
  inventoryIntelligence: "/inventory-purchasing",
  propertyIntelligence: "/property-intelligence",
  contractOS: "/contractos",
  aiGrowthOs: "/local-growth-os",
  localVisibility: "/local-visibility",
  services: "/services",
  aiWebsiteAssistant: "/services/ai-website-assistant",
  localSeo: "/services/local-seo",
  reputation: "/services/reputation",
  socialContent: "/services/social-content",
  governmentContracts: "/services/government-contracts",
} as const;

export const PRODUCT_START_PATHS = {
  marketCapture: "/market-capture/intake",
  sharedPostcards: "/get-started",
  targetedCampaigns: "/targeted/start",
  digitalTargeting: "/digital-targeting/intake",
  politicalCampaigns: "/political/plan",
  inventoryIntelligence: "/waitlist?product=procurement-savings-review",
  propertyIntelligence: "/intelligence",
  contractOS: "/contractos/dashboard",
  aiGrowthOs: "/growth-center",
  localVisibility: "/local-visibility#visibility-scan",
  aiWebsiteAssistant: "/services/ai-website-assistant#assistant-demo",
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
