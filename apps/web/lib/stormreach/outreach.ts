import { HOMEREACH_PERSONAS, type HomeReachPersonaKey } from "../revenue-messaging/personas";
import type { ScoredStormEvent, StormBusinessProspectInput, StormOutreachDraft } from "./types";

type OutreachInput = {
  event: Pick<ScoredStormEvent, "eventId" | "eventType" | "title" | "startTime" | "detectedAt" | "impactedCities" | "impactedCounties" | "impactedState" | "severityLevel" | "source">;
  prospect?: Partial<StormBusinessProspectInput> | null;
  industry: string;
  variantKey?: string;
  sequence?: number;
  senderKey?: HomeReachPersonaKey;
};

export type StormReachContractorCopyProfile = {
  key: "roofing" | "tree_service" | "siding" | "home_services" | "storm_services";
  label: string;
  ownerReaction: string;
  homeownerConcern: string;
  serviceFocus: string;
  demandSignal: string;
  mapPromise: string;
  replyKeyword: "MAP" | "ROUTES" | "STORM";
};

export function stormReachContractorCopyProfile(value: string | null | undefined): StormReachContractorCopyProfile {
  const lower = String(value ?? "").toLowerCase();
  if (lower.includes("roof")) {
    return {
      key: "roofing",
      label: "roofing",
      ownerReaction: "As a roofer, I would only respond if the message gave me a mapped area and a way to get ahead of homeowners who are already thinking about roof checks.",
      homeownerConcern: "roof leaks, lifted shingles, gutters, and exterior storm checks",
      serviceFocus: "roof inspections, roof repair, gutters, and exterior checks",
      demandSignal: "roofing demand moves quickly after hail or damaging wind signals",
      mapPromise: "a roofing-focused storm map with ZIPs, neighborhood targets, and postcard quantities",
      replyKeyword: "MAP",
    };
  }
  if (lower.includes("tree") || lower.includes("limb")) {
    return {
      key: "tree_service",
      label: "tree service",
      ownerReaction: "As a tree service owner, I would respond if the message helped me get visible before homeowners start calling whoever they see first.",
      homeownerConcern: "downed limbs, leaning trees, cleanup, driveway access, and yard safety",
      serviceFocus: "tree cleanup, trimming, removal, and storm-response scheduling",
      demandSignal: "tree calls are often decided fast when wind reports mention limbs, lines, or cleanup",
      mapPromise: "a tree-service storm map with the most practical neighborhoods to cover first",
      replyKeyword: "ROUTES",
    };
  }
  if (lower.includes("siding") || lower.includes("window") || lower.includes("gutter")) {
    return {
      key: "siding",
      label: "siding and exterior",
      ownerReaction: "As a siding or exterior contractor, I would respond if the note tied the storm to exterior checks without sounding like an insurance hustle.",
      homeownerConcern: "siding, trim, gutters, windows, screens, and exterior openings",
      serviceFocus: "siding, windows, gutters, trim, and exterior repair conversations",
      demandSignal: "exterior repair demand builds when homeowners walk the property after wind or hail",
      mapPromise: "an exterior-services storm map with the ZIPs and homeowner counts worth reviewing",
      replyKeyword: "MAP",
    };
  }
  if (lower.includes("home")) {
    return {
      key: "home_services",
      label: "home services",
      ownerReaction: "As a home service owner, I would respond if the message felt specific to the storm window and gave me a simple map before asking for money.",
      homeownerConcern: "exterior repairs, cleanup, property checks, and storm-related service needs",
      serviceFocus: "storm-response home service calls and local homeowner follow-up",
      demandSignal: "storm windows create a short period where homeowners pay closer attention to who can help nearby",
      mapPromise: "a storm-response map with the strongest neighborhoods, ZIPs, and postcard quantities",
      replyKeyword: "STORM",
    };
  }
  return {
    key: "storm_services",
    label: "storm response",
    ownerReaction: "As a contractor, I would respond if the message gave me a real area, a fast plan, and a simple next step instead of another generic marketing pitch.",
    homeownerConcern: "storm-related repair, cleanup, and property-check needs",
    serviceFocus: "storm-response calls and local homeowner follow-up",
    demandSignal: "homeowners tend to search and ask neighbors soon after a strong storm signal",
    mapPromise: "a storm-response map with the neighborhoods and mail quantities worth reviewing",
    replyKeyword: "MAP",
  };
}

export function generateStormOutreachDraft(input: OutreachInput): StormOutreachDraft {
  const {
    event,
    prospect,
    industry,
    sequence = 0,
  } = input;
  const variantKey = input.variantKey ?? `storm-${sequence + 1}`;
  const senderKey = input.senderKey ?? senderFor(event, sequence);
  const persona = HOMEREACH_PERSONAS[senderKey] ?? HOMEREACH_PERSONAS.jason;
  const area = impactedAreaLabel(event);
  const firstName = firstNameFrom(prospect?.ownerName);
  const businessName = cleanBusinessName(prospect?.businessName);
  const profile = stormReachContractorCopyProfile(`${industry} ${prospect?.category ?? ""}`);
  const seed = hashString([event.eventId, area, industry, businessName, variantKey, String(sequence)].join("|"));
  const subject = generateStormSubject(event, industry, variantKey, businessName, seed);
  const opening = pick([
    `I am looking at the latest storm reports around ${area}.`,
    `Quick note because ${area} showed up in recent severe-weather reports.`,
    `StormReach flagged ${area} as an area worth reviewing for ${profile.label} companies.`,
    `I was mapping the recent weather activity around ${area}.`,
    `The latest storm signal near ${area} looks relevant for ${profile.label} work.`,
  ], seed);
  const ownerNeed = pick([
    `When this kind of weather hits, homeowners are usually not thinking about marketing. They are checking ${profile.homeownerConcern}.`,
    `${profile.demandSignal}, but the useful window is usually short.`,
    `The owner question is simple: are there enough affected neighborhoods nearby to justify moving fast?`,
    `The opportunity is not the whole county. It is the pockets of homeowners most likely to be paying attention right now.`,
  ], seed + 1);
  const mapLine = pick([
    `What I would send first is ${profile.mapPromise}.`,
    `The useful piece is the map: ZIPs, neighborhood targets, household estimates, and the cleanest 24-48 hour plan.`,
    `I can package the mapped area, recommended geofence, postcard quantity, and budget before anything runs.`,
    `The first step would be a simple storm map, not a long proposal.`,
  ], seed + 2);
  const offerLine = pick([
    "The play is geofence first around the mapped pockets, then postcard follow-up to the same homes after the weather clears.",
    "Instead of spraying ads across the whole market, we can focus geofence and postcard spend around the neighborhoods that make sense.",
    "HomeReach can make this fast: mapped area, geofence plan, postcard follow-up, landing page, and lead tracking for review.",
    "That gives you visibility while people are paying attention, without claiming every home has damage.",
  ], seed + 3);
  const businessLine = businessName
    ? pick([
      `I thought of ${businessName} because this is right in the lane for ${profile.serviceFocus}.`,
      `${businessName} may be a fit if you want a clean way to show up while homeowners are checking ${profile.homeownerConcern}.`,
      `This could be worth a look for ${businessName} if you are taking nearby ${profile.label} calls.`,
    ], seed + 4)
    : pick([
      `This looks like a fit for a local ${profile.label} company that wants to move quickly but keep the message respectful.`,
      `It may be useful if you want to reach homeowners near the impacted area without overstating anything.`,
    ], seed + 4);
  const cta = pick([
    `Want me to send the map for ${area}? Reply "${profile.replyKeyword}" and I will send it over.`,
    `If useful, reply "${profile.replyKeyword}" and I will send the mapped area with the geofence and postcard numbers.`,
    `Worth seeing the map before you decide? Reply "${profile.replyKeyword}" or call/text 330-206-9639.`,
    `I can send the 10-minute version: map, ZIPs, budget, and timing. Reply "${profile.replyKeyword}" if you want it.`,
  ], seed + 5);
  const optOutLine = pick([
    "If this is not useful, reply no and I will keep you off storm-related notes.",
    "If you would rather not get storm-related opportunities from me, reply no and I will note it.",
    "No pressure either way; reply no if this is not a fit.",
  ], seed + 6);
  const paragraphs = paragraphShape({
    opening,
    ownerNeed,
    businessLine,
    mapLine,
    offerLine,
    cta,
    seed,
  });

  const body = [
    `Hi ${firstName || "there"},`,
    "",
    ...paragraphs,
    "",
    optOutLine,
    "",
    persona.name.split(/\s+/)[0] || persona.name,
    "HomeReach",
  ].join("\n");

  return {
    subject,
    body,
    variantKey,
    senderKey,
    personalization: {
      first_name: firstName || "",
      business_name: businessName || "",
      area,
      industry,
      contractor_mindset: profile.ownerReaction,
      reply_keyword: profile.replyKeyword,
      event_title: event.title,
      source: event.source,
    },
    riskNotes: [
      "Human review required before sending.",
      "Do not imply confirmed damage at any individual home.",
      "Do not make insurance claim, savings, or repair outcome guarantees.",
      "Suppression list and prior opt-outs must be checked before any send.",
    ],
    approvalStatus: "needs_review",
  };
}

export function generateStormSubject(
  event: Pick<ScoredStormEvent, "eventType" | "impactedCities" | "impactedCounties" | "impactedState">,
  industry: string,
  variantKey = "a",
  businessName = "",
  seed = hashString(`${event.eventType}:${industry}:${variantKey}:${businessName}`),
) {
  const area = impactedAreaLabel(event);
  const label = eventTypeLabel(event.eventType);
  const profile = stormReachContractorCopyProfile(industry);
  const service = /siding/i.test(industry) ? "siding" : /roof/i.test(industry) ? "roofing" : profile.label;
  const prefix = businessName ? `${businessName}: ` : "";
  return prefix + pick([
    `${service} map for ${area}`,
    `${label} storm response map for ${area}`,
    `Should ${businessName || "your team"} cover ${area}?`,
    `Storm pockets to review near ${area}`,
    `Geofence + postcard plan for ${area}`,
    `${area}: ${profile.replyKeyword.toLowerCase()} for storm response`,
  ], seed);
}

export function impactedAreaLabel(event: Pick<ScoredStormEvent, "impactedCities" | "impactedCounties" | "impactedState">) {
  const city = event.impactedCities?.[0];
  if (city) return `${city}${event.impactedState ? `, ${event.impactedState}` : ""}`;
  const county = event.impactedCounties?.[0];
  if (county) return `${county}${event.impactedState ? `, ${event.impactedState}` : ""}`;
  return event.impactedState ?? "the affected area";
}

export function eventTypeLabel(eventType: string) {
  return eventType
    .replace("hurricane_tropical_storm", "tropical storm")
    .replace("winter_storm_ice", "winter storm")
    .replace("wildfire_smoke", "wildfire smoke")
    .replaceAll("_", " ");
}

function firstNameFrom(value: string | null | undefined) {
  const clean = String(value ?? "").trim();
  if (!clean) return "";
  return clean.split(/\s+/)[0] ?? "";
}

function cleanBusinessName(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function senderFor(event: Pick<ScoredStormEvent, "severityLevel">, sequence: number): HomeReachPersonaKey {
  if (event.severityLevel === "Extreme") return sequence % 3 === 0 ? "jason" : "josh";
  if (event.severityLevel === "High") return sequence % 4 === 0 ? "jason" : "josh";
  return "josh";
}

function paragraphShape(input: {
  opening: string;
  ownerNeed: string;
  businessLine: string;
  mapLine: string;
  offerLine: string;
  cta: string;
  seed: number;
}) {
  const shapes = [
    [input.opening, input.ownerNeed, "", input.businessLine, input.mapLine, input.offerLine, "", input.cta],
    [`${input.opening} ${input.ownerNeed}`, "", input.businessLine, "", input.mapLine, input.offerLine, "", input.cta],
    [input.opening, "", `${input.businessLine} ${input.mapLine}`, "", input.offerLine, "", input.cta],
    [input.opening, input.businessLine, "", `${input.ownerNeed} ${input.offerLine}`, "", input.mapLine, "", input.cta],
  ];
  return pick(shapes, input.seed + 6);
}

function pick<T>(items: T[], seed: number) {
  if (!items.length) throw new Error("StormReach copy variant pool cannot be empty.");
  return items[Math.abs(seed) % items.length] ?? items[0]!;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return hash;
}
