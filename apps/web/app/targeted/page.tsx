import type { Metadata } from "next";
import { ALL_MOCK_ROUTES, CAMPAIGN_CITIES } from "@/lib/admin/mock-routes";
import { ROUTE_PRICING_TIERS } from "@/lib/engine/targeted-routes";
import { CampaignBuilder } from "./campaign-builder";

export const metadata: Metadata = {
  title: "Targeted Route Campaign — HomeReach",
  description: "Reach thousands of homeowners on specific mail routes with a dedicated postcard campaign.",
};

export default function TargetedCampaignPage() {
  return (
    <CampaignBuilder
      cities={CAMPAIGN_CITIES}
      allRoutes={ALL_MOCK_ROUTES}
      pricingTiers={ROUTE_PRICING_TIERS}
    />
  );
}
