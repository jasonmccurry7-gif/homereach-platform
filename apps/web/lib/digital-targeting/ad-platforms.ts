import { isAdApiLaunchEnabled, isManualAdLaunchModeEnabled } from "./config";

type CampaignLaunchInput = {
  campaignId: string;
  businessName: string;
  objective: string;
  targetingType: string;
  monthlyAdSpendCents: number;
  trackingUrl?: string | null;
};

export type LaunchReadiness = {
  mode: "manual" | "api_draft";
  apiLaunchEnabled: boolean;
  manualLaunchEnabled: boolean;
  metaReady: boolean;
  googleReady: boolean;
  blockers: string[];
};

export type ManualLaunchPlan = {
  platform: "Meta" | "Google/Display";
  instructions: string[];
};

function hasAll(keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]));
}

export function getDigitalAdLaunchReadiness(): LaunchReadiness {
  const apiLaunchEnabled = isAdApiLaunchEnabled();
  const manualLaunchEnabled = isManualAdLaunchModeEnabled();
  const metaReady = hasAll(["META_MARKETING_API_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"]);
  const googleReady = hasAll([
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
  ]);
  const blockers: string[] = [];

  if (!apiLaunchEnabled) blockers.push("ENABLE_AD_API_LAUNCH is not true.");
  if (apiLaunchEnabled && !metaReady) blockers.push("Meta Marketing API credentials are incomplete.");
  if (apiLaunchEnabled && !googleReady) blockers.push("Google Ads API credentials are incomplete.");
  if (!manualLaunchEnabled && !apiLaunchEnabled) blockers.push("Manual and API launch modes are both disabled.");

  return {
    mode: apiLaunchEnabled && (metaReady || googleReady) ? "api_draft" : "manual",
    apiLaunchEnabled,
    manualLaunchEnabled,
    metaReady,
    googleReady,
    blockers,
  };
}

export function buildManualLaunchPlan(input: CampaignLaunchInput): ManualLaunchPlan[] {
  const budget = Math.max(0, Math.round(input.monthlyAdSpendCents / 100));
  const trackingUrl = input.trackingUrl || "Create or confirm tracking URL before launch.";

  return [
    {
      platform: "Meta",
      instructions: [
        `Create a campaign draft for ${input.businessName} using objective ${input.objective}.`,
        `Build ad set targeting around approved ${input.targetingType} locations only where Meta policies allow.`,
        `Set budget from confirmed client ad spend. Monthly reference budget: $${budget.toLocaleString()}.`,
        `Attach approved creative and route traffic to ${trackingUrl}.`,
        "Do not publish until admin approval, creative approval, ad spend confirmation, and compliance review are complete.",
      ],
    },
    {
      platform: "Google/Display",
      instructions: [
        `Create a display/search campaign draft for ${input.businessName} with geography based on approved target addresses, radii, ZIPs, cities, districts, or service areas.`,
        "Use campaign criteria/location targeting only where platform policy permits.",
        `Set client-funded media budget from confirmed ad spend. Monthly reference budget: $${budget.toLocaleString()}.`,
        `Attach final URL/tracking URL: ${trackingUrl}.`,
        "Do not publish until admin approval, creative approval, ad spend confirmation, and compliance review are complete.",
      ],
    },
  ];
}

export async function createAdApiDraft(input: CampaignLaunchInput) {
  const readiness = getDigitalAdLaunchReadiness();
  if (readiness.mode !== "api_draft") {
    return {
      ok: false as const,
      mode: "manual" as const,
      reason: readiness.blockers.join(" ") || "API launch mode is unavailable.",
      manualPlan: buildManualLaunchPlan(input),
    };
  }

  return {
    ok: false as const,
    mode: "api_draft" as const,
    reason:
      "API launch architecture is ready-gated, but paid ad creation is intentionally stubbed until platform account review and explicit admin approval are completed.",
    manualPlan: buildManualLaunchPlan(input),
  };
}
