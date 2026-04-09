import type { Metadata } from "next";
import { MOCK_TARGETED_CAMPAIGNS, ALL_MOCK_ROUTES, CAMPAIGN_CITIES } from "@/lib/admin/mock-routes";
import { CampaignsClient } from "./campaigns-client";

export const metadata: Metadata = { title: "Campaigns — HomeReach Admin" };

// ─────────────────────────────────────────────────────────────────────────────
// Admin Campaigns Dashboard
// Shows both shared postcard campaigns and targeted route campaigns.
// TODO: Replace mock data with Supabase queries when DB is connected.
// ─────────────────────────────────────────────────────────────────────────────

export default async function AdminCampaignsPage() {
  // Enrich campaigns with their route details
  const enriched = MOCK_TARGETED_CAMPAIGNS.map((c) => ({
    ...c,
    routes: ALL_MOCK_ROUTES.filter((r) => c.selectedRouteIds.includes(r.id)),
  }));

  return (
    <CampaignsClient
      campaigns={enriched}
      cities={CAMPAIGN_CITIES}
      allRoutes={ALL_MOCK_ROUTES}
    />
  );
}
