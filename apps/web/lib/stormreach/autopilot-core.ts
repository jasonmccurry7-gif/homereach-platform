import type { ScoredStormEvent, StormBusinessProspectInput, StormDashboardEvent } from "./types";
import { STORMREACH_STORM_OUTREACH_INDUSTRIES } from "./prospecting";
import { stormReachContractorCopyProfile } from "./outreach";

export const STORMREACH_AUTOPILOT_AGENT_NAME = "StormReach Agent";
export const STORMREACH_AUTOPILOT_PHONE = "330-206-9639";

export const STORMREACH_AUTOPILOT_SERVICE_CATEGORIES = STORMREACH_STORM_OUTREACH_INDUSTRIES;

export type AutopilotOpportunityLevel = "Critical" | "High" | "Medium" | "Watch";
export type AutopilotChannel = "email" | "sms" | "facebook_dm";

export type StormAutopilotOpportunity = {
  score: number;
  level: AutopilotOpportunityLevel;
  reasons: string[];
  radiusMiles: number;
};

export type StormAutopilotImpactPlan = {
  areaLabel: string;
  state: string;
  counties: string[];
  cities: string[];
  zipCodes: string[];
  estimatedHouseholds: number;
  estimatedHomesImpacted: number;
  recommendedMailQuantity: number;
  geofenceRadiusMiles: number;
  opportunityLevel: AutopilotOpportunityLevel;
  estimatedCampaignValueCents: number;
};

export type StormAutopilotDraft = {
  subject: string | null;
  body: string;
  variantKey: string;
  riskNotes: string[];
  metadata: Record<string, unknown>;
};

export type StormGeneratedAssetSpec = {
  assetType: "storm_opportunity_image" | "social_image_16x9" | "social_image_1080x1350" | "pdf_one_pager" | "campaign_summary";
  title: string;
  format: "svg" | "html" | "markdown";
  contentText: string;
  assetPayload: Record<string, unknown>;
  sourceData: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export function classifyStormReachAutopilotOpportunity(event: ScoredStormEvent | StormDashboardEvent): StormAutopilotOpportunity {
  const text = `${read(event, "title")} ${read(event, "description")} ${read(event, "event_type")} ${read(event, "eventType")}`.toLowerCase();
  const hazard = hazardMetrics(event);
  const windMph = numberValue(hazard.windSpeedMph);
  const hailSize = numberValue(hazard.hailSizeInches);
  const baseScore = Math.max(numberValue(read(event, "severity_score")), numberValue(read(event, "severityScore")));
  const households = Math.max(numberValue(read(event, "estimated_households")), numberValue(read(event, "estimatedHouseholds")));
  const reasons: string[] = [];
  let score = baseScore;

  if (String(read(event, "event_type") ?? read(event, "eventType")) === "tornado" || /confirmed tornado|tornado warning|radar indicated tornado/.test(text)) {
    score = 100;
    reasons.push("Tornado warning or tornado report.");
  } else if (windMph >= 70) {
    score = Math.max(score, 95);
    reasons.push("Wind report or forecast at 70+ mph.");
  } else if (windMph >= 58) {
    score = Math.max(score, 84);
    reasons.push("Severe wind threshold at 58+ mph.");
  }

  if (hailSize >= 1) {
    score = Math.max(score, 88);
    reasons.push("Hail signal at one inch or larger.");
  }
  if (/tree down|trees down|power line|power lines|outage|property damage|structural damage|roof damage|damage report/.test(text)) {
    score = Math.min(100, score + 10);
    reasons.push("Damage language matched tree, power line, outage, or property damage reports.");
  }
  if (households >= 40000) {
    score = Math.min(100, score + 5);
    reasons.push("Dense enough area for rapid geofence and postcard response.");
  }

  const capped = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: capped,
    level: capped >= 95 ? "Critical" : capped >= 84 ? "High" : capped >= 65 ? "Medium" : "Watch",
    radiusMiles: capped >= 95 ? 40 : capped >= 84 ? 35 : 25,
    reasons: reasons.length ? reasons : ["No tornado, 58+ mph wind, one-inch hail, or damage report signal matched yet."],
  };
}

export function isStormReachAutopilotCandidate(event: ScoredStormEvent | StormDashboardEvent, now = new Date()) {
  if (["archived", "dismissed"].includes(String(read(event, "status")))) return false;
  const eventType = String(read(event, "event_type") ?? read(event, "eventType"));
  const allowed = new Set(["tornado", "high_wind", "severe_thunderstorm", "derecho", "hail"]);
  const opportunity = classifyStormReachAutopilotOpportunity(event);
  return allowed.has(eventType) && opportunity.score >= 65 && recentEnough(event, now);
}

export function buildStormAutopilotImpactPlan(event: ScoredStormEvent | StormDashboardEvent): StormAutopilotImpactPlan {
  const opportunity = classifyStormReachAutopilotOpportunity(event);
  const zipCodes = stringArray(read(event, "impacted_zip_codes") ?? read(event, "impactedZipCodes")).slice(0, 24);
  const cities = stringArray(read(event, "impacted_cities") ?? read(event, "impactedCities")).slice(0, 12);
  const counties = stringArray(read(event, "impacted_counties") ?? read(event, "impactedCounties")).slice(0, 12);
  const state = clean(read(event, "impacted_state") ?? read(event, "impactedState"));
  const estimatedHouseholds = Math.max(1500, numberValue(read(event, "estimated_households")), numberValue(read(event, "estimatedHouseholds")), zipCodes.length * 3800, cities.length * 14000, counties.length * 55000);
  const estimatedHomesImpacted = Math.max(500, Math.round(estimatedHouseholds * impactRate(opportunity.level)));
  const recommendedMailQuantity = Math.max(500, Math.min(10000, roundToNearest(Math.round(estimatedHomesImpacted * 0.38), 250)));

  return {
    areaLabel: areaLabel({ cities, counties, state }),
    state,
    counties,
    cities,
    zipCodes,
    estimatedHouseholds,
    estimatedHomesImpacted,
    recommendedMailQuantity,
    geofenceRadiusMiles: opportunity.radiusMiles,
    opportunityLevel: opportunity.level,
    estimatedCampaignValueCents: estimateCampaignValueCents(opportunity.level, recommendedMailQuantity),
  };
}

export function recommendStormReachAutopilotServices(event: ScoredStormEvent | StormDashboardEvent) {
  void event;
  return [...STORMREACH_AUTOPILOT_SERVICE_CATEGORIES];
}

export function buildStormReachAutopilotDraft(input: {
  channel: AutopilotChannel;
  event: ScoredStormEvent | StormDashboardEvent;
  prospect: Partial<StormBusinessProspectInput> & Record<string, unknown>;
  category: string;
  sequence?: number;
}): StormAutopilotDraft {
  const plan = buildStormAutopilotImpactPlan(input.event);
  const business = clean(input.prospect.businessName ?? input.prospect.business_name) || "your team";
  const firstName = firstNameOrBusiness(input.prospect.ownerName ?? input.prospect.owner_name, business);
  const category = clean(input.category) || clean(input.prospect.category) || "storm response";
  const sequence = input.sequence ?? 0;
  const profile = stormReachContractorCopyProfile(`${category} ${input.prospect.category ?? ""}`);
  const riskNotes = [
    "Human approval required before sending.",
    "No automatic SMS or Facebook Messenger sending.",
    "Do not claim verified property damage unless source-confirmed.",
    "Respect suppression, unsubscribe, TCPA, CAN-SPAM, and platform rules.",
  ];

  if (input.channel === "sms") {
    const body = fitSms(
      `Jason/HomeReach. I mapped storm-response pockets near ${plan.areaLabel} for ${business}. For ${profile.label}, the play is geofence first + postcard follow-up. Want the map? ${STORMREACH_AUTOPILOT_PHONE}. Reply STOP to opt out.`,
      plan.areaLabel,
      business,
    );
    return {
      subject: null,
      body,
      variantKey: `autopilot-sms-${sequence + 1}`,
      riskNotes,
      metadata: { channel: "sms", one_click_approval_required: true, business_hours_required: true },
    };
  }

  if (input.channel === "facebook_dm") {
    const opener = sequence % 2 === 0 ? `Hey ${business}, Jason with HomeReach.` : `Quick storm note for ${business}.`;
    const question = sequence % 3 === 0
      ? `Want me to send the map before you decide?`
      : `Want me to send you the ZIPs, map, and quick pricing?`;
    return {
      subject: null,
      body: `${opener} StormReach flagged ${plan.areaLabel} for ${profile.label} outreach. I am not assuming damage at any specific home, but homeowners may be checking ${profile.homeownerConcern}. We can geofence the mapped pockets first, then mail postcards to the same area. ${question}`,
      variantKey: `autopilot-dm-${sequence + 1}`,
      riskNotes,
      metadata: { channel: "facebook_dm", one_click_copy_or_open_required: true, messenger_link_required: false, reply_keyword: profile.replyKeyword },
    };
  }

  const subjectOptions = [
    `${profile.label} map for ${plan.areaLabel}`,
    `${plan.areaLabel} storm-response pockets`,
    `Should ${business} cover ${plan.areaLabel}?`,
    `Geofence + postcard plan for ${plan.areaLabel}`,
  ];
  const opening = [
    `I am watching the storm reports around ${plan.areaLabel}, and this looks relevant for ${profile.serviceFocus}.`,
    `StormReach flagged ${plan.areaLabel} as a possible storm-response area for ${profile.label} companies.`,
    `I am not assuming damage at any specific home, but ${profile.demandSignal}.`,
    `We are building a StormReach opportunity map for ${plan.areaLabel} without hype, fear tactics, or insurance promises.`,
  ][sequence % 4];

  return {
    subject: subjectOptions[sequence % subjectOptions.length] ?? "StormReach opportunity",
    body: [
      `Hi ${firstName},`,
      "",
      opening,
      "",
      `For ${business}, the question I would ask is whether there are enough nearby homeowners checking ${profile.homeownerConcern} to justify moving fast.`,
      "",
      "I can send you the short version:",
      `- ${profile.mapPromise}`,
      "- geofence targeting around the mapped pockets",
      "- postcard follow-up to the same area within 24-48 hours",
      "- budget, timing, and lead tracking before anything runs",
      "",
      `Want me to send the map? Reply "${profile.replyKeyword}" or call/text me at ${STORMREACH_AUTOPILOT_PHONE}.`,
      "",
      "Jason",
      "HomeReach / StormReach",
      STORMREACH_AUTOPILOT_PHONE,
    ].join("\n"),
    variantKey: `autopilot-email-${sequence + 1}`,
    riskNotes,
    metadata: { channel: "email", one_click_approval_required: true, can_spam_review_required: true, contractor_mindset: profile.ownerReaction, reply_keyword: profile.replyKeyword },
  };
}

export function buildStormOpportunityAssetSpecs(event: ScoredStormEvent | StormDashboardEvent): StormGeneratedAssetSpec[] {
  const plan = buildStormAutopilotImpactPlan(event);
  const opportunity = classifyStormReachAutopilotOpportunity(event);
  const services = recommendStormReachAutopilotServices(event).slice(0, 9);
  const weatherSignal = weatherSignalLabel(event);
  const title = `Storm Opportunity Alert - ${plan.areaLabel}`;
  const summary = buildStormReachCampaignSummary(event);
  const sourceData = {
    storm_event_id: String(read(event, "id") ?? read(event, "eventId") ?? read(event, "event_id") ?? ""),
    source: read(event, "source"),
    source_url: read(event, "source_url") ?? read(event, "sourceUrl"),
    title: read(event, "title"),
    detected_at: read(event, "detected_at") ?? read(event, "detectedAt"),
    opportunity,
    plan,
  };

  return [
    {
      assetType: "social_image_16x9",
      title,
      format: "svg",
      contentText: buildStormAlertSvg({ width: 1600, height: 900, plan, opportunity, services, weatherSignal, title, layout: "landscape" }),
      assetPayload: { width: 1600, height: 900, social_format: "16:9 landscape" },
      sourceData,
      metadata: { no_auto_publish: true, human_approval_required: true },
    },
    {
      assetType: "social_image_1080x1350",
      title,
      format: "svg",
      contentText: buildStormAlertSvg({ width: 1080, height: 1350, plan, opportunity, services, weatherSignal, title, layout: "portrait" }),
      assetPayload: { width: 1080, height: 1350, social_format: "1080x1350" },
      sourceData,
      metadata: { no_auto_publish: true, human_approval_required: true },
    },
    {
      assetType: "pdf_one_pager",
      title: `${title} one-pager`,
      format: "html",
      contentText: buildStormOnePagerHtml({ event, plan, opportunity, services, weatherSignal, summary }),
      assetPayload: { print_size: "US Letter", pdf_ready: true },
      sourceData,
      metadata: { no_auto_publish: true, human_approval_required: true },
    },
    {
      assetType: "campaign_summary",
      title: `${title} campaign summary`,
      format: "markdown",
      contentText: summary,
      assetPayload: { summary_kind: "stormreach_autopilot" },
      sourceData,
      metadata: { no_auto_send: true, human_approval_required: true },
    },
  ];
}

export function buildStormReachCampaignSummary(event: ScoredStormEvent | StormDashboardEvent) {
  const plan = buildStormAutopilotImpactPlan(event);
  const opportunity = classifyStormReachAutopilotOpportunity(event);
  const services = recommendStormReachAutopilotServices(event).slice(0, 10);

  return [
    `# StormReach Campaign Summary: ${plan.areaLabel}`,
    "",
    `Opportunity level: ${opportunity.level} (${opportunity.score}/100)`,
    `Weather signal: ${weatherSignalLabel(event)}`,
    `Impacted ZIPs: ${plan.zipCodes.length ? plan.zipCodes.join(", ") : "Pending enrichment"}`,
    `Estimated homes impacted: ${formatNumber(plan.estimatedHomesImpacted)}`,
    `Recommended mail quantity: ${formatNumber(plan.recommendedMailQuantity)}`,
    `Geofence radius: ${plan.geofenceRadiusMiles} miles`,
    `Likely contractor categories: ${services.join(", ")}`,
    "",
    "Recommended package: geofence-first storm response with targeted postcard follow-up in 24-48 hours.",
    "Approval rule: this summary is preparation only. Do not send, launch, charge, or publish without human approval.",
  ].join("\n");
}

function buildStormAlertSvg(input: {
  width: number;
  height: number;
  plan: StormAutopilotImpactPlan;
  opportunity: StormAutopilotOpportunity;
  services: string[];
  weatherSignal: string;
  title: string;
  layout: "landscape" | "portrait";
}) {
  const { height, layout, opportunity, plan, services, weatherSignal, width } = input;
  const isPortrait = layout === "portrait";
  const pad = isPortrait ? 70 : 84;
  const mapX = isPortrait ? pad : Math.round(width * 0.56);
  const mapY = isPortrait ? 730 : 185;
  const mapW = isPortrait ? width - pad * 2 : width - mapX - pad;
  const mapH = isPortrait ? 320 : 430;
  const contentW = isPortrait ? width - pad * 2 : Math.round(width * 0.48);
  const zipText = plan.zipCodes.length ? plan.zipCodes.slice(0, 8).join(" | ") : "ZIP enrichment pending";
  const servicesText = services.slice(0, isPortrait ? 8 : 9).join(" | ");
  const accent = opportunity.level === "Critical" ? "#dc2626" : opportunity.level === "High" ? "#f97316" : opportunity.level === "Medium" ? "#eab308" : "#64748b";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(input.title)}">`,
    `<rect width="${width}" height="${height}" fill="#f8fafc"/>`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`,
    `<rect x="0" y="0" width="${width}" height="${Math.round(height * 0.08)}" fill="#0f172a"/>`,
    `<text x="${pad}" y="${Math.round(height * 0.052)}" font-family="Inter, Arial, sans-serif" font-size="${isPortrait ? 30 : 34}" font-weight="900" fill="#ffffff">HomeReach StormReach</text>`,
    `<rect x="${width - pad - 210}" y="${Math.round(height * 0.022)}" rx="24" width="210" height="44" fill="${accent}"/>`,
    `<text x="${width - pad - 105}" y="${Math.round(height * 0.053)}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="21" font-weight="900" fill="#ffffff">${opportunity.level}</text>`,
    `<text x="${pad}" y="${isPortrait ? 165 : 158}" font-family="Inter, Arial, sans-serif" font-size="${isPortrait ? 56 : 58}" font-weight="900" fill="#0f172a">Storm Opportunity Alert</text>`,
    `<text x="${pad}" y="${isPortrait ? 218 : 218}" font-family="Inter, Arial, sans-serif" font-size="${isPortrait ? 34 : 38}" font-weight="800" fill="${accent}">${escapeXml(plan.areaLabel)}</text>`,
    `<text x="${pad}" y="${isPortrait ? 270 : 270}" font-family="Inter, Arial, sans-serif" font-size="${isPortrait ? 26 : 26}" font-weight="700" fill="#334155">Last 24 hours | ${escapeXml(weatherSignal)}</text>`,
    metricBlock(pad, isPortrait ? 330 : 340, contentW, "Estimated homes impacted", formatNumber(plan.estimatedHomesImpacted), accent),
    metricBlock(pad, isPortrait ? 435 : 448, contentW, "Recommended mail drop", formatNumber(plan.recommendedMailQuantity), "#0f172a"),
    metricBlock(pad, isPortrait ? 540 : 556, contentW, "Estimated campaign value", formatCurrency(plan.estimatedCampaignValueCents), "#0f172a"),
    `<text x="${pad}" y="${isPortrait ? 675 : 690}" font-family="Inter, Arial, sans-serif" font-size="${isPortrait ? 22 : 24}" font-weight="900" fill="#0f172a">Impacted ZIPs</text>`,
    `<text x="${pad}" y="${isPortrait ? 710 : 728}" font-family="Inter, Arial, sans-serif" font-size="${isPortrait ? 21 : 22}" font-weight="700" fill="#475569">${escapeXml(zipText)}</text>`,
    mapSvg(mapX, mapY, mapW, mapH, plan, accent),
    `<text x="${pad}" y="${isPortrait ? 1105 : 790}" font-family="Inter, Arial, sans-serif" font-size="${isPortrait ? 23 : 24}" font-weight="900" fill="#0f172a">Services likely to benefit</text>`,
    `<text x="${pad}" y="${isPortrait ? 1144 : 830}" font-family="Inter, Arial, sans-serif" font-size="${isPortrait ? 20 : 21}" font-weight="700" fill="#475569">${escapeXml(servicesText)}</text>`,
    `<text x="${pad}" y="${isPortrait ? 1210 : 870}" font-family="Inter, Arial, sans-serif" font-size="${isPortrait ? 26 : 28}" font-weight="900" fill="#0f172a">Be First To The Storm</text>`,
    `<text x="${pad}" y="${isPortrait ? 1250 : 0}" font-family="Inter, Arial, sans-serif" font-size="${isPortrait ? 22 : 0}" font-weight="800" fill="${accent}">${isPortrait ? "Lock in your Storm Campaign Today" : ""}</text>`,
    !isPortrait ? `<rect x="${Math.round(width * 0.56)}" y="660" rx="18" width="${width - Math.round(width * 0.56) - pad}" height="130" fill="#0f172a"/>` : "",
    !isPortrait ? `<text x="${Math.round(width * 0.56) + 34}" y="715" font-family="Inter, Arial, sans-serif" font-size="31" font-weight="900" fill="#ffffff">Be First To The Storm</text>` : "",
    !isPortrait ? `<text x="${Math.round(width * 0.56) + 34}" y="758" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" fill="#fed7aa">Lock in your Storm Campaign Today</text>` : "",
    `<text x="${pad}" y="${height - 46}" font-family="Inter, Arial, sans-serif" font-size="${isPortrait ? 24 : 22}" font-weight="800" fill="#0f172a">Jason McCurry | ${STORMREACH_AUTOPILOT_PHONE} | home-reach.com</text>`,
    `</svg>`,
  ].filter(Boolean).join("");
}

function buildStormOnePagerHtml(input: {
  event: ScoredStormEvent | StormDashboardEvent;
  plan: StormAutopilotImpactPlan;
  opportunity: StormAutopilotOpportunity;
  services: string[];
  weatherSignal: string;
  summary: string;
}) {
  const { plan, opportunity, services, weatherSignal } = input;
  return [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\"><title>StormReach Opportunity One-Pager</title>",
    "<style>body{font-family:Arial,sans-serif;margin:36px;color:#0f172a}h1{font-size:34px;margin:0 0 8px}h2{font-size:18px;margin:24px 0 8px}.badge{display:inline-block;background:#0f172a;color:white;padding:8px 12px;border-radius:8px;font-weight:800}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.box{border:1px solid #cbd5e1;border-radius:8px;padding:14px}.big{font-size:28px;font-weight:900}.muted{color:#475569}.cta{background:#f97316;color:white;border-radius:8px;padding:16px;font-size:24px;font-weight:900;margin-top:20px}</style></head><body>",
    "<div class=\"badge\">HomeReach StormReach</div>",
    `<h1>Storm Opportunity Alert: ${escapeHtml(plan.areaLabel)}</h1>`,
    `<p class=\"muted\">Last 24 hours | ${escapeHtml(weatherSignal)} | Opportunity ${opportunity.level} (${opportunity.score}/100)</p>`,
    "<div class=\"grid\">",
    `<div class=\"box\"><div class=\"muted\">Estimated homes impacted</div><div class=\"big\">${formatNumber(plan.estimatedHomesImpacted)}</div></div>`,
    `<div class=\"box\"><div class=\"muted\">Recommended mail drop</div><div class=\"big\">${formatNumber(plan.recommendedMailQuantity)}</div></div>`,
    `<div class=\"box\"><div class=\"muted\">Campaign value</div><div class=\"big\">${formatCurrency(plan.estimatedCampaignValueCents)}</div></div>`,
    "</div>",
    "<h2>Impacted Area</h2>",
    `<p>State/county/city: ${escapeHtml([plan.state, plan.counties.slice(0, 4).join(", "), plan.cities.slice(0, 4).join(", ")].filter(Boolean).join(" | ") || "Pending enrichment")}</p>`,
    `<p>ZIP codes: ${escapeHtml(plan.zipCodes.length ? plan.zipCodes.join(", ") : "Pending enrichment")}</p>`,
    "<h2>Services Likely To Benefit</h2>",
    `<p>${escapeHtml(services.join(", "))}</p>`,
    "<h2>What HomeReach Does</h2>",
    "<ul><li>Geofence impacted areas</li><li>Mail postcards within 48 hours after approval</li><li>Target verified homeowners</li><li>Digital retargeting</li><li>Campaign tracking</li></ul>",
    "<div class=\"cta\">Be First To The Storm. Lock in your Storm Campaign Today.</div>",
    `<p><strong>Contact:</strong> Jason McCurry | ${STORMREACH_AUTOPILOT_PHONE} | home-reach.com</p>`,
    "<p class=\"muted\">Guardrail: do not claim damage occurred unless confirmed by a source. Use storm impacted, potential damage, or storm response language until verified.</p>",
    "</body></html>",
  ].join("");
}

function metricBlock(x: number, y: number, width: number, label: string, value: string, color: string) {
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="82" rx="16" fill="#f8fafc" stroke="#dbe3ef"/>`,
    `<text x="${x + 24}" y="${y + 31}" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="800" fill="#64748b">${escapeXml(label)}</text>`,
    `<text x="${x + 24}" y="${y + 66}" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="900" fill="${color}">${escapeXml(value)}</text>`,
  ].join("");
}

function mapSvg(x: number, y: number, width: number, height: number, plan: StormAutopilotImpactPlan, accent: string) {
  const circles = [
    [0.32, 0.46, 44],
    [0.48, 0.38, 58],
    [0.62, 0.54, 38],
  ];
  return [
    `<g transform="translate(${x},${y})">`,
    `<rect x="0" y="0" width="${width}" height="${height}" rx="22" fill="#e2e8f0" stroke="#cbd5e1"/>`,
    `<path d="M${width * 0.16} ${height * 0.22} L${width * 0.79} ${height * 0.18} L${width * 0.88} ${height * 0.58} L${width * 0.68} ${height * 0.82} L${width * 0.28} ${height * 0.75} Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="3"/>`,
    ...circles.map(([cx, cy, radius], index) => `<circle cx="${Number(cx) * width}" cy="${Number(cy) * height}" r="${radius}" fill="${accent}" fill-opacity="${0.24 + index * 0.08}" stroke="${accent}" stroke-width="4"/>`),
    `<text x="${width * 0.08}" y="${height - 44}" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="900" fill="#0f172a">${escapeXml(plan.areaLabel)}</text>`,
    `<text x="${width * 0.08}" y="${height - 16}" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="700" fill="#475569">Impact radius: ${plan.geofenceRadiusMiles} miles</text>`,
    "</g>",
  ].join("");
}

function weatherSignalLabel(event: ScoredStormEvent | StormDashboardEvent) {
  const hazard = hazardMetrics(event);
  const text = `${read(event, "title")} ${read(event, "description")}`.toLowerCase();
  if (String(read(event, "event_type") ?? read(event, "eventType")) === "tornado" || /tornado/.test(text)) return "Tornado signal";
  if (numberValue(hazard.windSpeedMph) >= 58) return `${numberValue(hazard.windSpeedMph)} mph wind signal`;
  if (numberValue(hazard.hailSizeInches) >= 1) return `${numberValue(hazard.hailSizeInches)} inch hail signal`;
  if (/tree|power line|outage|damage/.test(text)) return "Damage report signal";
  return "Severe weather signal";
}

function hazardMetrics(event: ScoredStormEvent | StormDashboardEvent) {
  const metadata = objectValue(read(event, "metadata"));
  const direct = objectValue(read(event, "hazardMetrics"));
  const stored = objectValue(metadata.hazard_metrics);
  return { ...stored, ...direct } as { windSpeedMph?: unknown; hailSizeInches?: unknown };
}

function recentEnough(event: ScoredStormEvent | StormDashboardEvent, now: Date) {
  const value = read(event, "detected_at") ?? read(event, "detectedAt") ?? read(event, "start_time") ?? read(event, "startTime") ?? read(event, "created_at");
  if (!value) return true;
  const time = Date.parse(String(value));
  return !Number.isFinite(time) || now.getTime() - time <= 30 * 60 * 60 * 1000;
}

function firstNameOrBusiness(ownerName: unknown, businessName: string) {
  return clean(ownerName).split(/\s+/)[0] || businessName;
}

function fitSms(value: string, area: string, business: string) {
  if (value.length <= 320) return value;
  const shorter = `Jason with HomeReach. StormReach flagged ${area}. We can help ${business} reach nearby homeowners with geofence ads + postcards. 10-min call? ${STORMREACH_AUTOPILOT_PHONE}. Reply STOP to opt out.`;
  return shorter.length <= 320 ? shorter : `Jason with HomeReach. StormReach flagged your area for geofence ads + postcards. 10-min call? ${STORMREACH_AUTOPILOT_PHONE}. Reply STOP to opt out.`;
}

function impactRate(level: AutopilotOpportunityLevel) {
  if (level === "Critical") return 0.22;
  if (level === "High") return 0.16;
  if (level === "Medium") return 0.1;
  return 0.05;
}

function estimateCampaignValueCents(level: AutopilotOpportunityLevel, mailQuantity: number) {
  const base = level === "Critical" ? 425000 : level === "High" ? 325000 : level === "Medium" ? 185000 : 95000;
  return base + Math.round(mailQuantity * 145);
}

function areaLabel(input: { cities: string[]; counties: string[]; state: string }) {
  const place = input.cities[0] || input.counties[0] || "impacted area";
  return input.state ? `${place}, ${input.state}` : place;
}

function read(value: unknown, key: string) {
  return value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? unique(value.map(clean)) : [];
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundToNearest(value: number, step: number) {
  return Math.max(step, Math.round(value / step) * step);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtml(value: unknown) {
  return escapeXml(value).replace(/'/g, "&#39;");
}

export const __stormReachAutopilotTestUtils = {
  classifyStormReachAutopilotOpportunity,
  isStormReachAutopilotCandidate,
  buildStormAutopilotImpactPlan,
  recommendStormReachAutopilotServices,
  buildStormReachAutopilotDraft,
  buildStormOpportunityAssetSpecs,
};
