export const MARKET_CAPTURE_MANAGEMENT_FEE_CENTS = 49900;
export const MARKET_CAPTURE_PRODUCT_NAME = "Market Capture";
export const MARKET_CAPTURE_RECOMMENDED_AD_SPEND_CENTS = 100000;
export const MARKET_CAPTURE_MIN_COMMITMENT_MONTHS = 3;

export const MARKET_CAPTURE_PRICING_TIERS = [
  {
    id: "starter",
    name: "Market Capture Starter",
    managementFeeCents: 49900,
    recommendedAdSpendCents: 100000,
    summary: "Fastest path to sell local visibility with tight fulfillment scope.",
    bestFor: "Local SMBs testing one focused neighborhood campaign",
    scope: [
      "One campaign focus",
      "Up to 3 target areas",
      "Basic creative guidance",
      "Monthly manual report",
      "Optional direct mail quote",
    ],
  },
  {
    id: "growth",
    name: "Market Capture Growth",
    managementFeeCents: 74900,
    recommendedAdSpendCents: 150000,
    summary: "Better fit for clients with more target areas or a stronger monthly campaign rhythm.",
    bestFor: "Businesses ready to expand visibility beyond a single starter test",
    scope: [
      "Expanded target area planning",
      "Creative refresh guidance",
      "Direct mail add-on planning",
      "Stronger reporting review",
      "Monthly optimization notes",
    ],
  },
  {
    id: "dominance",
    name: "Market Capture Dominance",
    managementFeeCents: 99900,
    recommendedAdSpendCents: 300000,
    summary: "Highest-margin package for digital plus direct mail saturation and fuller campaign planning.",
    bestFor: "Roofers, HVAC, med spas, political campaigns, and operators pursuing market saturation",
    scope: [
      "Digital plus direct mail planning",
      "Competitor, event, or jobsite campaign strategy",
      "Landing/tracking recommendations",
      "Richer performance review",
      "Renewal and expansion plan",
    ],
  },
] as const;

export type MarketCapturePricingTierId = (typeof MARKET_CAPTURE_PRICING_TIERS)[number]["id"];

export function getMarketCapturePricingTier(value: unknown) {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  return MARKET_CAPTURE_PRICING_TIERS.find((tier) => tier.id === key) ?? MARKET_CAPTURE_PRICING_TIERS[0];
}

function enabled(key: string) {
  return process.env[key] !== "false";
}

export function isMarketCaptureEnabled() {
  return enabled("ENABLE_MARKET_CAPTURE");
}

export function isMarketCaptureIntakeEnabled() {
  return isMarketCaptureEnabled() && enabled("ENABLE_MARKET_CAPTURE_INTAKE");
}

export function isMarketCapturePipelineEnabled() {
  return isMarketCaptureEnabled() && enabled("ENABLE_MARKET_CAPTURE_PIPELINE");
}

export function isMarketCapturePaymentEnabled() {
  return isMarketCaptureEnabled() && enabled("ENABLE_MARKET_CAPTURE_PAYMENT");
}

export function isMarketCaptureSalesDashboardEnabled() {
  return isMarketCaptureEnabled() && enabled("ENABLE_MARKET_CAPTURE_SALES_DASHBOARD");
}

export function isMarketCaptureDraftsEnabled() {
  return isMarketCaptureEnabled() && enabled("ENABLE_MARKET_CAPTURE_DRAFTS");
}

export function isMarketCaptureFulfillmentEnabled() {
  return isMarketCaptureEnabled() && enabled("ENABLE_MARKET_CAPTURE_FULFILLMENT");
}

export function isMarketCaptureChecklistsEnabled() {
  return isMarketCaptureFulfillmentEnabled() && enabled("ENABLE_MARKET_CAPTURE_CHECKLISTS");
}

export function isMarketCaptureApprovalsEnabled() {
  return isMarketCaptureFulfillmentEnabled() && enabled("ENABLE_MARKET_CAPTURE_APPROVALS");
}

export function isMarketCaptureReportingEnabled() {
  return isMarketCaptureFulfillmentEnabled() && enabled("ENABLE_MARKET_CAPTURE_REPORTING");
}

export function isMarketCaptureAssetsEnabled() {
  return isMarketCaptureFulfillmentEnabled() && enabled("ENABLE_MARKET_CAPTURE_ASSETS");
}

export function isMarketCaptureTeamTasksEnabled() {
  return isMarketCaptureFulfillmentEnabled() && enabled("ENABLE_MARKET_CAPTURE_TEAM_TASKS");
}

export function isMarketCaptureClientPortalEnabled() {
  return isMarketCaptureFulfillmentEnabled() && enabled("ENABLE_MARKET_CAPTURE_CLIENT_PORTAL");
}

export function hasMarketCaptureStripeCheckout() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getMarketCaptureStripePriceId() {
  const value = process.env.STRIPE_MARKET_CAPTURE_PRICE_ID?.trim();
  return value || null;
}

export function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export function parseDollarInputToCents(value: unknown, fallbackCents = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value * 100));
  }

  if (typeof value !== "string") return fallbackCents;
  const normalized = value.replace(/[$,\s]/g, "");
  if (!normalized) return fallbackCents;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return fallbackCents;
  return Math.max(0, Math.round(parsed * 100));
}
