import type { StormDashboardEvent } from "./types";

export const STORMREACH_OPERATOR_AGENT_NAME = "StormReach Operator Agent";
export const STORMREACH_OPERATOR_WORKFLOW = "StormReach Autonomous Operator";

export type StormReachOperatorPackageInput = {
  id?: string | null;
  package_name?: string | null;
  package_type?: string | null;
  industry?: string | null;
  estimated_households?: number | null;
  recommended_geofence_radius_miles?: number | null;
  recommended_postcard_quantity?: number | null;
  suggested_timeline?: string | null;
  estimated_price_to_client_cents?: number | null;
  proposal_token?: string | null;
  landing_page_copy?: string | null;
  postcard_copy?: string | null;
  ad_copy?: string | null;
};

export type StormReachOperatorHandoffLinks = {
  proposalUrl: string | null;
  intakeUrl: string;
  paymentStatus: "approval_required" | "not_configured";
  paymentAction: string;
};

export function buildStormReachOperatorHandoffLinks(input: {
  appUrl?: string | null;
  event: Pick<StormDashboardEvent, "id" | "event_id">;
  packageRow?: StormReachOperatorPackageInput | null;
}): StormReachOperatorHandoffLinks {
  const appUrl = normalizeAppUrl(input.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  const industry = encodeURIComponent(String(input.packageRow?.industry ?? "StormReach"));
  const eventKey = encodeURIComponent(input.event.event_id || input.event.id);
  const proposalUrl = input.packageRow?.proposal_token
    ? `${appUrl}/stormreach/proposals/${encodeURIComponent(input.packageRow.proposal_token)}`
    : null;

  return {
    proposalUrl,
    intakeUrl: `${appUrl}/digital-targeting/intake?source=stormreach&event=${eventKey}&industry=${industry}`,
    paymentStatus: "approval_required",
    paymentAction:
      "Create or send a Stripe checkout link only after the campaign package, pricing, recipient, and customer-facing claims are approved by an admin.",
  };
}

export function buildStormReachOperatorConversationPlaybook(input: {
  event: Pick<StormDashboardEvent, "title" | "source" | "source_url" | "impacted_cities" | "impacted_counties" | "impacted_state" | "severity_level">;
  packageRow?: StormReachOperatorPackageInput | null;
  links: StormReachOperatorHandoffLinks;
}) {
  const industry = String(input.packageRow?.industry ?? "roofing or siding");
  const area = impactedArea(input.event);
  const proposalLine = input.links.proposalUrl
    ? `Here is the simple StormReach proposal page: ${input.links.proposalUrl}`
    : `I can send the simple proposal page after the package is approved.`;

  return {
    approvalStatus: "needs_review" as const,
    sourceTrace: {
      eventTitle: input.event.title,
      source: input.event.source,
      sourceUrl: input.event.source_url,
    },
    guardrails: [
      "Do not state that any specific home is damaged.",
      "Do not imply government, emergency-service, or insurance affiliation.",
      "Do not send, schedule, publish, charge, or launch without the required approval record.",
      "Respect opt-outs, suppression matches, and unsubscribe requirements.",
    ],
    replies: [
      {
        scenario: "Interested contractor asks for details",
        draft:
          `Absolutely. The short version: severe weather was reported around ${area}, and StormReach can put your ${industry.toLowerCase()} business in front of the affected neighborhoods with geofenced ads first, then postcards as the follow-up.\n\n${proposalLine}\n\nI can also send the map view if you want to review the exact area before anything moves forward.`,
      },
      {
        scenario: "Contractor asks for pricing",
        draft:
          `I can keep it simple. The package page shows the recommended budget, geofence radius, postcard count, and timeline for ${area}. Nothing is launched or billed until you approve the package and HomeReach confirms the details.\n\n${proposalLine}`,
      },
      {
        scenario: "Contractor asks for a link",
        draft:
          `Here is the intake link so we can capture the business info, offer, service area, and creative notes: ${input.links.intakeUrl}\n\nPayment is handled after approval. ${input.links.paymentAction}`,
      },
      {
        scenario: "Contractor asks whether homes are damaged",
        draft:
          `I would not make that claim. The weather source shows the area was impacted, so the campaign is positioned around helping homeowners who may be checking their property. We keep the messaging factual and avoid damage guarantees or insurance language.`,
      },
      {
        scenario: "Opt-out or not interested",
        draft:
          "Understood. I will mark you as not interested and make sure you are not included in this StormReach outreach sequence.",
      },
    ],
  };
}

export function buildStormReachOperatorCreativeBrief(input: {
  event: Pick<StormDashboardEvent, "title" | "source" | "source_url" | "event_type" | "impacted_cities" | "impacted_counties" | "impacted_state" | "estimated_households" | "severity_level">;
  packageRow?: StormReachOperatorPackageInput | null;
  links: StormReachOperatorHandoffLinks;
}) {
  const industry = String(input.packageRow?.industry ?? "roofing or siding");
  const area = impactedArea(input.event);
  const postcardQuantity = numberValue(input.packageRow?.recommended_postcard_quantity, 500);
  const radiusMiles = numberValue(input.packageRow?.recommended_geofence_radius_miles, 5);
  const households = numberValue(input.packageRow?.estimated_households, input.event.estimated_households ?? 0);
  const ctaUrl = input.links.proposalUrl ?? input.links.intakeUrl;

  return {
    approvalStatus: "needs_review" as const,
    eventSummary: `${input.event.title}. Source: ${input.event.source}. Area: ${area}.`,
    geofence: {
      status: "ready_to_prepare",
      radiusMiles,
      audienceEstimate: Math.round(Math.max(households * 0.7, postcardQuantity)),
      setupNote:
        "Use the StormReach event polygon or selected ZIPs as the first geofence draft. Export GeoJSON/ZIP CSV for external platform setup after admin approval.",
    },
    postcard: {
      format: "6x9 postcard concept",
      quantity: postcardQuantity,
      headline: String(input.packageRow?.postcard_copy ?? postcardHeadline(industry)),
      body:
        `Severe weather moved through ${area} recently. If you are checking your property, local ${industry.toLowerCase()} help is available for a simple inspection or repair conversation.`,
      cta: "Scan to request a quick review",
      qrDestination: ctaUrl,
      imageDirection:
        `Helpful, calm ${industry.toLowerCase()} service scene in a real neighborhood. Use clean trucks, crew, roofline or exterior detail. Avoid disaster imagery, fear, insurance-claim framing, or damaged-home certainty.`,
    },
    social: {
      feedPostCopy:
        `Recent severe weather near ${area}? If you are checking your roof, siding, gutters, or exterior, local ${industry.toLowerCase()} help is available. Quick review: ${ctaUrl}`,
      storyCopy: "Recent storm nearby? Tap for a quick property check.",
      creativePrompt:
        `Create a clean local-service ad for ${industry} after severe weather in ${area}. Show a real neighborhood exterior and a professional crew. Tone should be helpful and calm, not scary. Do not show catastrophic damage or make insurance promises.`,
      formats: ["1:1 feed", "4:5 feed", "9:16 story/reel"],
    },
    compliance: [
      "Human approval required before client-facing use, social publishing, postcard print, ad launch, payment request, or bulk outreach.",
      "Do not claim homes are damaged.",
      "Do not promise insurance outcomes.",
      "Cite the weather source when discussing the trigger internally.",
    ],
  };
}

export function renderStormReachOperatorOutput(input: {
  event: Pick<StormDashboardEvent, "title" | "severity_level">;
  packageRow?: StormReachOperatorPackageInput | null;
  links: StormReachOperatorHandoffLinks;
  conversation: ReturnType<typeof buildStormReachOperatorConversationPlaybook>;
  creative: ReturnType<typeof buildStormReachOperatorCreativeBrief>;
}) {
  const packageName = String(input.packageRow?.package_name ?? "StormReach package");
  const priceCents = numberValue(input.packageRow?.estimated_price_to_client_cents, 0);
  const proposalLine = input.links.proposalUrl ? `Proposal: ${input.links.proposalUrl}` : "Proposal: pending package token";

  return [
    `StormReach Operator Handoff`,
    ``,
    `Event: ${input.event.title}`,
    `Severity: ${input.event.severity_level}`,
    `Package: ${packageName}`,
    `Price: ${priceCents ? formatCents(priceCents) : "Review pricing"}`,
    proposalLine,
    `Intake: ${input.links.intakeUrl}`,
    `Payment: ${input.links.paymentAction}`,
    ``,
    `Conversation Playbook`,
    ...input.conversation.replies.map((reply) => `- ${reply.scenario}: ${reply.draft.replace(/\s+/g, " ").trim()}`),
    ``,
    `Creative Brief`,
    `Postcard headline: ${input.creative.postcard.headline}`,
    `Postcard CTA: ${input.creative.postcard.cta}`,
    `Social feed copy: ${input.creative.social.feedPostCopy}`,
    `Geofence: ${input.creative.geofence.radiusMiles} miles, estimated audience ${input.creative.geofence.audienceEstimate}`,
    ``,
    `Approval Boundary`,
    ...input.creative.compliance.map((item) => `- ${item}`),
  ].join("\n");
}

export function operatorPriority(severityLevel: string | null | undefined) {
  if (severityLevel === "Extreme") return "critical";
  if (severityLevel === "High") return "high";
  if (severityLevel === "Moderate") return "medium";
  return "low";
}

function impactedArea(event: Pick<StormDashboardEvent, "impacted_cities" | "impacted_counties" | "impacted_state">) {
  const city = event.impacted_cities?.[0];
  const county = event.impacted_counties?.[0];
  return [city ?? county ?? "the impacted area", event.impacted_state].filter(Boolean).join(", ");
}

function postcardHeadline(industry: string) {
  if (/roof/i.test(industry)) return "Need your roof checked after the recent storm?";
  if (/siding|window|gutter/i.test(industry)) return "Storm come through your neighborhood?";
  if (/tree|debris|junk/i.test(industry)) return "Need cleanup help after the recent storm?";
  if (/restoration|water|mold/i.test(industry)) return "Water or moisture concerns after the storm?";
  if (/hvac|generator|electrical|plumb/i.test(industry)) return "Need home help after the recent weather?";
  return "Local help after recent severe weather.";
}

function normalizeAppUrl(value: string) {
  return value.trim().replace(/\/+$/, "") || "http://localhost:3000";
}

function numberValue(value: unknown, fallback: number) {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : fallback;
}

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}
