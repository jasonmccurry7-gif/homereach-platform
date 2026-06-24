import type { ScoredStormEvent } from "./types";
import { estimateCampaignRevenueCents } from "./packages";

type StrategistEvent = ScoredStormEvent & {
  recommendedIndustries?: string[];
};

export type StormAgentImprovementDraft = {
  stormEventId?: string | null;
  recommendationType: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  confidenceScore: number;
  metadata: Record<string, unknown>;
};

type RecommendationInput = {
  events: StrategistEvent[];
  prospectCountByEvent?: Map<string, number> | Record<string, number>;
  outreachCountByEvent?: Map<string, number> | Record<string, number>;
  packageCountByEvent?: Map<string, number> | Record<string, number>;
};

export function generateStormReachRecommendations(input: RecommendationInput): StormAgentImprovementDraft[] {
  const recommendations: StormAgentImprovementDraft[] = [];
  const events = [...input.events].sort((a, b) => b.severityScore - a.severityScore);

  for (const event of events.slice(0, 20)) {
    const prospects = countFor(input.prospectCountByEvent, event.eventId);
    const outreach = countFor(input.outreachCountByEvent, event.eventId);
    const packages = countFor(input.packageCountByEvent, event.eventId);

    if ((event.severityLevel === "High" || event.severityLevel === "Extreme") && prospects === 0) {
      recommendations.push({
        stormEventId: event.eventId,
        recommendationType: "prospecting_gap",
        title: `Generate prospects for ${event.title}`,
        description: "High-value storm event has no attached contractor prospect list yet. Prioritize existing HomeReach records first, then optional provider enrichment if API keys are configured.",
        priority: event.severityLevel === "Extreme" ? "critical" : "high",
        confidenceScore: Math.min(96, Number(event.confidenceScore ?? 50) + 5),
        metadata: {
          event_id: event.eventId,
          severity_score: event.severityScore,
          estimated_households: event.estimatedHouseholds,
          no_auto_send: true,
        },
      });
    }

    if (prospects > 0 && outreach === 0) {
      recommendations.push({
        stormEventId: event.eventId,
        recommendationType: "outreach_ready_gap",
        title: `Draft StormReach outreach for ${event.title}`,
        description: "Prospects exist but email drafts have not been prepared. Generate short approval-required drafts and check suppression records before any send.",
        priority: event.severityLevel === "Extreme" ? "high" : "medium",
        confidenceScore: 86,
        metadata: {
          prospect_count: prospects,
          human_approval_required: true,
        },
      });
    }

    if (packages === 0 && event.severityScore >= 65) {
      recommendations.push({
        stormEventId: event.eventId,
        recommendationType: "campaign_package_gap",
        title: `Build geofence + postcard packages for ${event.title}`,
        description: "This event is strong enough for a campaign package. Prepare geofence export, postcard concept, pricing placeholders, and proposal review path.",
        priority: event.severityLevel === "Extreme" ? "high" : "medium",
        confidenceScore: 84,
        metadata: {
          projected_revenue_cents: estimateCampaignRevenueCents(event, Math.max(1, event.recommendedIndustries?.length ?? 1)),
          no_auto_launch: true,
          no_auto_charge: true,
        },
      });
    }

    if (Number(event.confidenceScore ?? 50) < 60) {
      recommendations.push({
        stormEventId: event.eventId,
        recommendationType: "data_quality_warning",
        title: `Review source confidence for ${event.title}`,
        description: "Storm source confidence is low. Verify the affected area before prospecting, outreach, or campaign package creation.",
        priority: "medium",
        confidenceScore: 75,
        metadata: {
          confidence_score: event.confidenceScore ?? 50,
          source: event.source,
        },
      });
    }
  }

  if (!events.length) {
    recommendations.push({
      recommendationType: "provider_monitoring",
      title: "No active StormReach events detected",
      description: "Provider ingestion returned no events. Confirm NWS, NOAA SPC, and FEMA provider runs are succeeding before assuming the opportunity queue is empty.",
      priority: "medium",
      confidenceScore: 72,
      metadata: {
        provider_check_required: true,
      },
    });
  }

  return recommendations;
}

export function buildDailyStormReachReport(events: StrategistEvent[]) {
  const highValue = events.filter((event) => event.severityLevel === "High" || event.severityLevel === "Extreme");
  const projectedRevenue = highValue.reduce(
    (sum, event) => sum + estimateCampaignRevenueCents(event, Math.max(1, event.recommendedIndustries?.length ?? 1)),
    0,
  );

  return [
    "StormReach Daily Opportunity Report",
    "",
    `Active events reviewed: ${events.length}`,
    `High or extreme opportunities: ${highValue.length}`,
    `Projected review-stage revenue: ${formatCents(projectedRevenue)}`,
    "",
    highValue.length
      ? highValue
          .slice(0, 8)
          .map((event, index) => `${index + 1}. ${event.title} - ${event.severityLevel} (${event.severityScore})`)
          .join("\n")
      : "No high-value storm opportunities are currently queued.",
    "",
    "Approval boundary: this report may create tasks and recommendations only. It does not send outreach, launch campaigns, change pricing, or charge customers.",
  ].join("\n");
}

function countFor(source: Map<string, number> | Record<string, number> | undefined, key: string) {
  if (!source) return 0;
  if (source instanceof Map) return source.get(key) ?? 0;
  return source[key] ?? 0;
}

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}
