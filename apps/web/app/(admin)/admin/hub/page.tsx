import type { Metadata } from "next";
import { AvailabilityEngine } from "@/lib/engine/availability";
import { ReservationEngine }  from "@/lib/engine/reservation";
import { MOCK_LEADS, MOCK_CONVERSATIONS, MOCK_STATS, type Lead, type Conversation } from "@/lib/admin/mock-data";
import { MOCK_MIGRATED_CLIENTS } from "@/lib/admin/mock-clients";
import { MOCK_AGENTS } from "@/lib/admin/mock-agents";
import { MOCK_TARGETED_CAMPAIGNS, ALL_MOCK_ROUTES } from "@/lib/admin/mock-routes";
import { HubClient } from "./hub-client";

export const metadata: Metadata = { title: "HomeReach OS — Control Center" };

export default async function HubPage() {
  const availEngine = new AvailabilityEngine();
  const resEngine   = new ReservationEngine();

  const [cities, activeReservations] = await Promise.all([
    availEngine.getAllCities(),
    resEngine.getAllActive(),
  ]);

  // Compute system snapshot
  const totalSpots  = cities.reduce((s, c) => s + c.totalSpots, 0);
  const soldSpots   = cities.reduce((s, c) => s + c.soldSpots, 0);
  const reservedSpots = cities.reduce((s, c) => s + c.reservedSpots, 0);

  // Hot leads = interested + ready_to_buy (not yet sold)
  const hotLeads = MOCK_LEADS.filter((l) =>
    l.status === "interested" && !l.spotId
  );

  // Deals awaiting intake = interested with no intake sent
  const awaitingIntake = MOCK_LEADS.filter((l) =>
    l.status === "interested" && !l.intakeFormSent
  );

  // Recently closed
  const recentlyClosed = MOCK_LEADS
    .filter((l) => l.status === "sold" || l.status === "closed_won")
    .slice(0, 4);

  // Conversations with unread
  const activeConversations = MOCK_CONVERSATIONS.filter((c) => c.unreadCount > 0);

  // Estimated MRR from sold spots
  const estimatedMRR = soldSpots * 299 +
    MOCK_MIGRATED_CLIENTS.filter((c) => c.migrationStatus !== "legacy_pending")
      .reduce((s, c) => s + c.monthlyPrice, 0);

  // Campaign stats
  const activeCampaigns  = MOCK_TARGETED_CAMPAIGNS.filter((c) => c.status === "active").length;
  const pendingCampaigns = MOCK_TARGETED_CAMPAIGNS.filter((c) => c.status === "pending_review").length;
  const campaignReach    = MOCK_TARGETED_CAMPAIGNS
    .filter((c) => c.status === "active")
    .reduce((s, c) => s + c.totalHouseholds, 0);

  const snapshot = {
    activeCities:      cities.filter((c) => c.soldSpots > 0).length,
    totalCities:       cities.length,
    spotsFilled:       soldSpots + reservedSpots,
    totalSpots,
    estimatedMRR,
    totalLeads:        MOCK_STATS.totalLeads,
    conversionRate:    Math.round((MOCK_STATS.activeClients / MOCK_STATS.totalLeads) * 100),
    activeAgents:      MOCK_AGENTS.filter((a) => a.status === "active").length,
    migratedClients:   MOCK_MIGRATED_CLIENTS.length,
    activeCampaigns,
    pendingCampaigns,
    campaignReach,
  };

  return (
    <HubClient
      cities={cities}
      activeReservations={activeReservations}
      hotLeads={hotLeads}
      awaitingIntake={awaitingIntake}
      recentlyClosed={recentlyClosed}
      activeConversations={activeConversations}
      snapshot={snapshot}
    />
  );
}
