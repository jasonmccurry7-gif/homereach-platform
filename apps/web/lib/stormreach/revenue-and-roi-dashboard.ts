import type { StormDashboardData } from "./types";

export function calculateStormReachRoiMetrics(data: Pick<StormDashboardData, "events" | "prospects" | "outreachMessages" | "packages" | "geofenceCampaigns" | "postcardCampaigns">) {
  const emailsSent = data.outreachMessages.filter((row) => row.status === "sent").length;
  const replies = data.outreachMessages.filter((row) => row.replied_at).length;
  const packagesSold = data.packages.filter((row) => ["won", "approved", "client_approved"].includes(String(row.client_approval_status ?? row.status ?? ""))).length;
  const revenueCents = data.packages.reduce((sum, row) => sum + numeric(row.revenue_estimate_cents), 0);

  return {
    eventsDetected: data.events.length,
    highValueEvents: data.events.filter((event) => event.severity_level === "High" || event.severity_level === "Extreme").length,
    prospectsGenerated: data.prospects.length,
    emailsDrafted: data.outreachMessages.filter((row) => row.status === "draft" || row.approval_status === "needs_review").length,
    emailsSent,
    replyRate: emailsSent ? replies / emailsSent : 0,
    bookedCalls: data.outreachMessages.filter((row) => row.booked_call_at).length,
    campaignsSold: packagesSold,
    geofenceCampaignsCreated: data.geofenceCampaigns.length,
    postcardCampaignsCreated: data.postcardCampaigns.length,
    revenueCents,
    revenuePerEventCents: data.events.length ? Math.round(revenueCents / data.events.length) : 0,
  };
}

function numeric(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}
