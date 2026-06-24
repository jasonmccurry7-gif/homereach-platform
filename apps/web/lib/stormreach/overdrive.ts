import "server-only";

import { createHash } from "node:crypto";
import { syncApprovalLedgerPayloads, type ApprovalLedgerPayload } from "@/lib/approvals/ledger";
import { createServiceClient } from "@/lib/supabase/service";
import { buildGeofenceExport, buildPostcardDraft, createProposalToken, recommendedGeofenceRadiusMiles } from "./packages";
import {
  industryMatchesCategory,
  isWithinStormReachStormOutreachRadius,
  STORMREACH_STORM_OUTREACH_INDUSTRIES,
  stormReachAllowedStormOutreachIndustries,
  stormReachStormOutreachRadiusMiles,
} from "./prospecting";
import {
  generateProspectsForStormEvent,
  ingestStormReachEvents,
  loadStormReachDashboard,
  loadStormReachEventDetail,
  type StormReachActor,
  upsertStormReachNormalizedEvent,
} from "./repository";
import { severityLevel } from "./scoring";
import { stormReachContractorCopyProfile } from "./outreach";
import type { NormalizedStormEvent, ScoredStormEvent, StormBusinessProspectInput, StormDashboardEvent, StormEventType } from "./types";
import { fetchWeatherProviderEvents } from "./weather-providers";

type ServiceClient = ReturnType<typeof createServiceClient>;
type Db = ServiceClient & { from(table: string): any };
type JsonRecord = Record<string, unknown>;

export const STORMREACH_OVERDRIVE_WORKFLOW = "StormReach Overdrive Mode";
const STORMREACH_OVERDRIVE_PHONE = "330-206-9639";

export const STORMREACH_OVERDRIVE_SERVICE_CATEGORIES = STORMREACH_STORM_OUTREACH_INDUSTRIES;

export type StormReachOverdriveProvider = {
  getActiveAlerts(state: string): Promise<NormalizedStormEvent[]>;
  getStormReports(state: string): Promise<NormalizedStormEvent[]>;
  getImpactedAreas(alert: NormalizedStormEvent): Array<{ county?: string; city?: string; zipCode?: string; score: number }>;
  normalizeAlert(rawAlert: unknown): NormalizedStormEvent | null;
  calculateThreatScore(event: NormalizedStormEvent | StormDashboardEvent): OverdriveThreatScore;
};

export type OverdriveThreatScore = {
  score: number;
  label: "urgent" | "high" | "watch" | "inactive";
  color: "red" | "orange" | "yellow" | "gray";
  reasons: string[];
};

export type ManualStormEventInput = {
  eventType?: StormEventType | string | null;
  headline?: string | null;
  description?: string | null;
  windMph?: number | string | null;
  hailSize?: number | string | null;
  tornadoPossible?: boolean | string | null;
  state?: string | null;
  counties?: string[] | string | null;
  cities?: string[] | string | null;
  zipCodes?: string[] | string | null;
  startTime?: string | null;
  endTime?: string | null;
};

export const stormReachOverdriveProvider: StormReachOverdriveProvider = {
  async getActiveAlerts(state: string) {
    const results = await fetchWeatherProviderEvents({ state: normalizeState(state), limit: 250 });
    return results.filter((result) => result.provider === "nws" || result.provider === "fema_ipaws").flatMap((result) => result.events);
  },
  async getStormReports(state: string) {
    const results = await fetchWeatherProviderEvents({ state: normalizeState(state), limit: 250 });
    return results.filter((result) => result.provider === "noaa_spc").flatMap((result) => result.events);
  },
  getImpactedAreas(alert: NormalizedStormEvent) {
    const threat = calculateOverdriveThreatScore(alert);
    return [
      ...alert.impactedCounties.map((county) => ({ county, score: threat.score })),
      ...alert.impactedCities.map((city) => ({ city, score: threat.score })),
      ...alert.impactedZipCodes.map((zipCode) => ({ zipCode, score: threat.score })),
    ];
  },
  normalizeAlert(rawAlert: unknown) {
    if (!rawAlert || typeof rawAlert !== "object") return null;
    const row = rawAlert as Partial<NormalizedStormEvent>;
    return row.eventId && row.title ? row as NormalizedStormEvent : null;
  },
  calculateThreatScore: calculateOverdriveThreatScore,
};

export function stormReachOverdriveEnabled() {
  return String(process.env.STORMREACH_OVERDRIVE_ENABLED ?? "true").toLowerCase() !== "false";
}

export function stormReachOverdriveState() {
  return normalizeState(process.env.STORMREACH_DEFAULT_STATE || "OH");
}

export function calculateOverdriveThreatScore(event: NormalizedStormEvent | StormDashboardEvent, context: {
  majorOutageArea?: boolean;
  highHouseholdDensity?: boolean;
  olderHousingStock?: boolean;
  overlapCount?: number;
} = {}): OverdriveThreatScore {
  const text = `${read(event, "title")} ${read(event, "description")} ${read(event, "event_type")}`.toLowerCase();
  const hazard = hazardMetrics(event) ?? {};
  const wind = Number(hazard.windSpeedMph ?? 0);
  const hail = Number(hazard.hailSizeInches ?? 0);
  const households = Number(read(event, "estimated_households") ?? read(event, "estimatedHouseholds") ?? 0);
  const areaUnits = Math.max(1, arrayValue(read(event, "impacted_zip_codes") ?? read(event, "impactedZipCodes")).length || arrayValue(read(event, "impacted_cities") ?? read(event, "impactedCities")).length || arrayValue(read(event, "impacted_counties") ?? read(event, "impactedCounties")).length);
  const metadata = objectValue(read(event, "metadata"));
  const reasons: string[] = [];
  let score = Number(read(event, "severity_score") ?? read(event, "severityScore") ?? 0);

  if (String(read(event, "event_type") ?? read(event, "eventType")) === "tornado" || /tornado warning|confirmed tornado|radar indicated tornado/.test(text)) {
    score = 100;
    reasons.push("Tornado warning or tornado signal.");
  } else if (wind >= 75) {
    score = Math.max(score, 95);
    reasons.push("Wind threat 75 mph or higher.");
  } else if (wind >= 65) {
    score = Math.max(score, 90);
    reasons.push("Wind threat 65-74 mph.");
  } else if (wind >= 58) {
    score = Math.max(score, 80);
    reasons.push("Severe wind threshold 58-64 mph.");
  }

  if (hail >= 1) {
    score = Math.max(score, 90);
    reasons.push("Hail one inch or larger.");
  }
  if (context.majorOutageArea || metadata.major_outage_area === true || metadata.power_outage_signal === true) {
    score += 10;
    reasons.push("Major outage placeholder signal.");
  }
  if (context.highHouseholdDensity || households / areaUnits >= 7000) {
    score += 5;
    reasons.push("High household density placeholder.");
  }
  if (context.olderHousingStock || metadata.older_housing_stock_signal === true) {
    score += 5;
    reasons.push("Older housing stock placeholder.");
  }
  if ((context.overlapCount ?? Number(metadata.overlap_count ?? 0)) > 1) {
    score += 10;
    reasons.push("Multiple overlapping warnings or reports.");
  }

  const capped = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: capped,
    label: capped >= 95 ? "urgent" : capped >= 80 ? "high" : capped >= 50 ? "watch" : "inactive",
    color: capped >= 95 ? "red" : capped >= 80 ? "orange" : capped >= 50 ? "yellow" : "gray",
    reasons: reasons.length ? reasons : ["No emergency Overdrive threshold matched yet."],
  };
}

export function recommendOverdriveServices(event: Pick<NormalizedStormEvent, "eventType" | "title" | "description"> | StormDashboardEvent) {
  void event;
  return [...STORMREACH_OVERDRIVE_SERVICE_CATEGORIES];
}

export function manualStormEventToNormalizedEvent(input: ManualStormEventInput, now = new Date()): NormalizedStormEvent {
  const state = normalizeState(input.state || stormReachOverdriveState());
  const counties = stringList(input.counties);
  const cities = stringList(input.cities);
  const zipCodes = stringList(input.zipCodes);
  const eventType = normalizeEventType(input.eventType);
  const windMph = numberOrNull(input.windMph);
  const hailSize = numberOrNull(input.hailSize);
  const tornadoPossible = input.tornadoPossible === true || String(input.tornadoPossible ?? "").toLowerCase() === "true";
  const title = clean(input.headline) || `Manual ${eventType.replaceAll("_", " ")} event${state ? ` in ${state}` : ""}`;
  const description = clean(input.description) || "Manual StormReach Overdrive event entered by an admin.";
  const idSeed = [state, eventType, title, counties.join("|"), cities.join("|"), zipCodes.join("|"), input.startTime ?? now.toISOString()].join(":");

  return {
    eventId: `manual-overdrive:${stableHash(idSeed)}`,
    eventType,
    source: "Manual StormReach Overdrive",
    sourceUrl: "/admin/stormreach",
    title,
    description,
    startTime: isoOrNow(input.startTime, now),
    endTime: toIso(input.endTime),
    detectedAt: now.toISOString(),
    geographyType: "manual_area",
    impactedPolygonGeojson: {},
    impactedCounties: counties,
    impactedCities: cities,
    impactedZipCodes: zipCodes,
    impactedState: state,
    estimatedHouseholds: Math.max(1500, zipCodes.length * 3800, cities.length * 14000, counties.length * 55000),
    estimatedHomeowners: Math.round(Math.max(1500, zipCodes.length * 3800, cities.length * 14000, counties.length * 55000) * 0.64),
    confidenceScore: 72,
    hazardMetrics: {
      windSpeedMph: windMph,
      hailSizeInches: hailSize,
      tornadoRating: tornadoPossible ? "possible" : null,
    },
    sourcePayload: {
      provider: "manual_overdrive",
      raw: input,
    },
    metadata: {
      overdrive_mode: true,
      manual_entry: true,
      tornado_possible: tornadoPossible,
      no_auto_send: true,
      human_approval_required: true,
    },
  };
}

export async function createManualOverdriveStormEvent(input: ManualStormEventInput, options: { supabase?: ServiceClient; actor?: StormReachActor } = {}) {
  const event = manualStormEventToNormalizedEvent(input);
  const row = await upsertStormReachNormalizedEvent(event, {
    supabase: options.supabase,
    actor: options.actor,
    sourceProvider: "manual_overdrive",
    industryOverrides: recommendOverdriveServices(event),
  });
  await applyOverdriveMetadata(options.supabase, row, calculateOverdriveThreatScore(row), recommendOverdriveServices(row), options.actor);
  return { ok: true, eventId: row.id, event_id: row.event_id, threat: calculateOverdriveThreatScore(row), error: null };
}

export async function runStormReachOverdriveMode(options: {
  supabase?: ServiceClient;
  actor?: StormReachActor;
  state?: string | null;
  eventLimit?: number;
  prospectLimit?: number;
  draftLimit?: number;
  packageLimit?: number;
} = {}) {
  const supabase = options.supabase ?? createServiceClient();
  const db = supabase as Db;
  const state = normalizeState(options.state || stormReachOverdriveState());
  const actor = options.actor ?? { label: "stormreach_overdrive" };
  const startedAt = new Date().toISOString();

  if (!stormReachOverdriveEnabled()) {
    return { ok: false, job: "stormreach_overdrive", state, error: "StormReach Overdrive Mode is disabled.", eventsProcessed: 0 };
  }

  const ingest = await ingestStormReachEvents({ supabase, actor, state, limit: 250 });
  const dashboard = await loadStormReachDashboard(supabase);
  const candidates = dashboard.events
    .filter((event) => normalizeState(event.impacted_state) === state)
    .filter((event) => !["archived", "dismissed"].includes(event.status))
    .filter((event) => recentEnough(event.detected_at || event.start_time))
    .map((event) => ({ event, threat: calculateOverdriveThreatScore(event) }))
    .filter((item) => item.threat.score >= 50)
    .sort((a, b) => b.threat.score - a.threat.score)
    .slice(0, options.eventLimit ?? positiveInteger(process.env.STORMREACH_OVERDRIVE_EVENT_LIMIT, 12));

  const eventResults = [];
  for (const item of candidates) {
    const services = recommendOverdriveServices(item.event);
    await applyOverdriveMetadata(supabase, item.event, item.threat, services, actor);
    const prospects = await generateProspectsForStormEvent(item.event.id, {
      supabase,
      actor,
      industries: services,
      radiusMiles: stormReachStormOutreachRadiusMiles(),
      limit: options.prospectLimit ?? positiveInteger(process.env.STORMREACH_MAX_PROSPECTS_PER_RUN, 500),
      includeExternalProviders: true,
      coreContractorMode: false,
    });
    const drafts = await draftOverdriveOutreachForStormEvent(item.event.id, {
      supabase,
      actor,
      industries: services,
      limit: options.draftLimit ?? positiveInteger(process.env.STORMREACH_MAX_DRAFTS_PER_RUN, 500),
    });
    const packages = await createOverdriveCampaignPackagesForStormEvent(item.event.id, {
      supabase,
      actor,
      industries: services.slice(0, options.packageLimit ?? 4),
    });
    eventResults.push({ eventId: item.event.id, title: item.event.title, threat: item.threat, services, prospects, drafts, packages });
  }

  await db.from("storm_provider_runs").insert({
    provider_key: "stormreach_overdrive",
    run_type: "ohio_overdrive_15_minute",
    status: eventResults.every((result) => result.prospects.ok && result.drafts.ok && result.packages.ok) ? "completed" : "warning",
    events_seen: candidates.length,
    events_upserted: eventResults.reduce((sum, result) => sum + Number(result.prospects.inserted ?? 0), 0),
    errors: eventResults.flatMap((result) => [result.prospects.error, result.drafts.error, result.packages.error].filter(Boolean)),
    metadata: {
      state,
      overdrive_enabled: true,
      ingest_events_seen: ingest.eventsSeen,
      ingest_events_upserted: ingest.eventsUpserted,
      no_auto_send: true,
      approval_required: true,
      service_categories: STORMREACH_OVERDRIVE_SERVICE_CATEGORIES,
    },
    started_at: startedAt,
    completed_at: new Date().toISOString(),
  });

  await createOverdriveNotification(db, state, eventResults.length, eventResults[0]?.threat.score ?? 0);

  return {
    ok: ingest.ok && eventResults.every((result) => result.prospects.ok && result.drafts.ok && result.packages.ok),
    job: "stormreach_overdrive",
    state,
    eventsProcessed: candidates.length,
    prospectsInserted: eventResults.reduce((sum, result) => sum + Number(result.prospects.inserted ?? 0), 0),
    draftsCreated: eventResults.reduce((sum, result) => sum + Number(result.drafts.inserted ?? 0), 0),
    packagesCreated: eventResults.reduce((sum, result) => sum + Number(result.packages.inserted ?? 0), 0),
    ingest,
    eventResults,
  };
}

export async function draftOverdriveOutreachForStormEvent(eventId: string, options: {
  supabase?: ServiceClient;
  actor?: StormReachActor;
  industries?: string[];
  limit?: number;
} = {}) {
  const db = (options.supabase ?? createServiceClient()) as Db;
  const detail = await loadStormReachEventDetail(eventId, options.supabase);
  if (!detail.event) return { ok: false, inserted: 0, error: "Storm event not found." };
  const event = dashboardEventToScored(detail.event);
  const industries = stormReachAllowedStormOutreachIndustries(options.industries?.length ? options.industries : recommendOverdriveServices(detail.event));
  const existing = new Set(detail.outreachMessages.map((row) => `${String(row.prospect_id ?? "")}:${String(row.channel ?? "")}`));
  const prospects = detail.prospects
    .filter((row) => row.suppression_status !== "suppressed")
    .filter((row) => isWithinStormReachStormOutreachRadius(row.distance_to_event))
    .filter((row) => industries.some((industry) => industryMatchesCategory(industry, String(row.category ?? "")) || String(row.category ?? "").toLowerCase().includes(industry.toLowerCase())))
    .slice(0, options.limit ?? 100);
  const now = new Date().toISOString();
  const campaign = await ensureOverdriveOutreachCampaign(db, detail.event.id, options.actor);
  const rows: JsonRecord[] = [];

  for (const [index, prospect] of prospects.entries()) {
    const category = bestCategory(String(prospect.category ?? ""), industries);
    const channels: Array<"email" | "sms" | "facebook_dm"> = ["email", ...(prospect.phone ? ["sms" as const] : []), "facebook_dm"];
    for (const channel of channels) {
      if (rows.length >= (options.limit ?? 100)) break;
      if (existing.has(`${String(prospect.id)}:${channel}`)) continue;
      const draft = buildOverdriveOutreachDraft({
        channel,
        event,
        prospect: prospect as Partial<StormBusinessProspectInput>,
        category,
        sequence: index + rows.length,
      });
      const { data, error } = await db.from("storm_outreach_messages").insert({
        outreach_campaign_id: campaign.id,
        storm_event_id: detail.event.id,
        prospect_id: prospect.id,
        channel,
        sender_key: "jason",
        recipient_email: channel === "email" ? prospect.email ?? null : null,
        recipient_phone: channel === "sms" ? prospect.phone ?? null : null,
        subject: draft.subject,
        body: draft.body,
        variant_key: draft.variantKey,
        status: "draft",
        approval_status: "needs_review",
        suppression_status: prospect.suppression_status ?? "unknown",
        metadata: {
          overdrive_mode: true,
          category,
          risk_notes: draft.riskNotes,
          no_auto_send: true,
          human_approval_required: true,
        },
        created_by: options.actor?.id ?? null,
        created_at: now,
        updated_at: now,
      }).select("*").single();
      if (error) return { ok: false, inserted: rows.length, error: error.message };
      if (data) rows.push(data as JsonRecord);
    }
  }

  if (rows.length) {
    await syncApprovalLedgerPayloads(rows.map((row) => overdriveMessageApproval(row, detail.event!)), {
      actorId: options.actor?.id ?? null,
      actorLabel: options.actor?.label ?? "stormreach_overdrive",
      eventType: "stormreach_overdrive_drafts_synced",
      syncSource: "stormreach",
    });
  }

  return { ok: true, inserted: rows.length, error: null };
}

export async function createOverdriveCampaignPackagesForStormEvent(eventId: string, options: {
  supabase?: ServiceClient;
  actor?: StormReachActor;
  industries?: string[];
} = {}) {
  const db = (options.supabase ?? createServiceClient()) as Db;
  const detail = await loadStormReachEventDetail(eventId, options.supabase);
  if (!detail.event) return { ok: false, inserted: 0, error: "Storm event not found." };
  const event = dashboardEventToScored(detail.event);
  const area = areaLabel(event);
  const industries = stormReachAllowedStormOutreachIndustries(options.industries?.length ? options.industries : recommendOverdriveServices(detail.event).slice(0, 4));
  const existing = new Set(detail.packages.map((row) => `${String(row.industry).toLowerCase()}:${String(row.package_name).toLowerCase()}`));
  const now = new Date().toISOString();
  const inserted: JsonRecord[] = [];

  for (const industry of industries) {
    for (const draft of overdrivePackagePresets(event, industry)) {
      const key = `${industry.toLowerCase()}:${draft.packageName.toLowerCase()}`;
      if (existing.has(key)) continue;
      const { data, error } = await db.from("storm_marketing_packages").insert({
        storm_event_id: detail.event.id,
        industry,
        package_name: draft.packageName,
        package_type: draft.packageType,
        status: "draft",
        approval_status: "needs_review",
        client_approval_status: "not_sent",
        event_summary: draft.eventSummary,
        impacted_area_map: event.impactedPolygonGeojson ?? {},
        estimated_households: event.estimatedHouseholds ?? 0,
        recommended_geofence_radius_miles: recommendedGeofenceRadiusMiles(event),
        recommended_postcard_quantity: draft.recommendedPostcardQuantity,
        suggested_timeline: draft.suggestedTimeline,
        suggested_budget_cents: draft.suggestedBudgetCents,
        estimated_price_to_client_cents: draft.estimatedPriceToClientCents,
        revenue_estimate_cents: draft.revenueEstimateCents,
        email_draft: `StormReach Overdrive outreach draft for ${industry} in ${area}. Approval required before use.`,
        sms_draft: overdriveSms(area, "this business"),
        landing_page_copy: landingPageCopy(area),
        postcard_copy: draft.postcardCopy,
        ad_copy: draft.adCopy,
        proposal_token: createProposalToken(),
        human_approval_required: true,
        metadata: {
          overdrive_mode: true,
          no_auto_send: true,
          no_auto_charge: true,
          no_auto_launch: true,
          package_preset: draft.packageName,
        },
        created_by: options.actor?.id ?? null,
        created_at: now,
        updated_at: now,
      }).select("*").single();
      if (error) return { ok: false, inserted: inserted.length, error: error.message };
      const row = data as JsonRecord;
      inserted.push(row);

      const geofence = buildGeofenceExport(event, industry, String(row.id));
      await db.from("storm_geofence_campaigns").insert({
        storm_event_id: detail.event.id,
        marketing_package_id: row.id,
        industry,
        status: "draft",
        approval_status: "needs_review",
        polygon_geojson: geofence.polygonGeojson,
        selected_zip_codes: geofence.selectedZipCodes,
        radius_miles: geofence.radiusMiles,
        estimated_audience_size: geofence.estimatedAudienceSize,
        export_geojson: geofence.exportGeojson,
        export_zip_csv: geofence.exportZipCsv,
        campaign_brief: `${geofence.campaignBrief}\nOverdrive preset: ${draft.packageName}`,
        external_platform_status: "not_started",
        human_approval_required: true,
        metadata: { ...geofence.metadata, overdrive_mode: true },
        created_by: options.actor?.id ?? null,
        created_at: now,
        updated_at: now,
      });

      const postcard = buildPostcardDraft(event, industry, String(row.id));
      await db.from("storm_postcard_campaigns").insert({
        storm_event_id: detail.event.id,
        marketing_package_id: row.id,
        industry,
        headline: postcard.headline,
        body: draft.postcardCopy,
        cta: postcard.cta,
        image_direction: postcard.imageDirection,
        mail_quantity: draft.recommendedPostcardQuantity,
        estimated_print_postage_cost_cents: postcard.estimatedPrintPostageCostCents,
        estimated_price_to_client_cents: draft.estimatedPriceToClientCents,
        campaign_timeline: draft.suggestedTimeline,
        status: "draft",
        approval_status: "needs_review",
        human_approval_required: true,
        metadata: { ...postcard.metadata, overdrive_mode: true },
        created_by: options.actor?.id ?? null,
        created_at: now,
        updated_at: now,
      });
    }
  }

  return { ok: true, inserted: inserted.length, error: null };
}

export function buildOverdriveOutreachDraft(input: {
  channel: "email" | "sms" | "facebook_dm";
  event: Pick<ScoredStormEvent, "eventId" | "title" | "impactedCities" | "impactedCounties" | "impactedState">;
  prospect?: Partial<StormBusinessProspectInput> | null;
  category: string;
  sequence?: number;
}) {
  const area = areaLabel(input.event);
  const business = clean(input.prospect?.businessName) || "your team";
  const first = clean(input.prospect?.ownerName).split(/\s+/)[0] || business;
  const variant = `overdrive-${input.channel}-${(input.sequence ?? 0) + 1}`;
  const profile = stormReachContractorCopyProfile(`${input.category} ${input.prospect?.category ?? ""}`);
  const detailsCta = (input.sequence ?? 0) % 2 === 0
    ? `reply "${profile.replyKeyword}"`
    : `reply back and I will send the map`;
  const riskNotes = [
    "Human approval required before sending.",
    "Do not claim confirmed damage unless verified by source.",
    "Use storm impacted, potential damage, or storm response language.",
    "Suppression and unsubscribe checks required before any send.",
  ];

  if (input.channel === "sms") {
    return {
      subject: null,
      body: fitOverdriveSms(`${overdriveSms(area, business, profile)} Reply STOP to opt out.`),
      variantKey: variant,
      riskNotes,
    };
  }

  if (input.channel === "facebook_dm") {
    return {
      subject: null,
      body: `Hey ${business}, Jason with HomeReach. I am mapping storm-response pockets near ${area} for ${profile.label} companies. The idea is geofence the affected neighborhoods first, then postcard the same homes after the weather clears. Want me to send the map, ZIPs, and rough budget?`,
      variantKey: variant,
      riskNotes,
    };
  }

  return {
    subject: `${profile.label} storm map for ${area}`,
    body: [
      `Hi ${first},`,
      "",
      `I am watching the severe-weather reports around ${area}, and this looks relevant for ${profile.serviceFocus}.`,
      "",
      `I am not claiming every home has damage. The practical opportunity is that homeowners may be checking ${profile.homeownerConcern}, and the first local company they notice often gets the call.`,
      "",
      "What I can send you first:",
      `- ${profile.mapPromise}`,
      "- geofence targeting around the mapped neighborhoods",
      "- postcard follow-up to the same homes within 24-48 hours",
      "- simple landing page and lead tracking",
      "- budget before anything is launched",
      "",
      `If you want us to prepare a storm-response campaign for ${area}, ${detailsCta} and I will send the details.`,
      "",
      `You can also call/text me at ${STORMREACH_OVERDRIVE_PHONE}.`,
      "",
      "Jason",
      "HomeReach / StormReach",
    ].join("\n"),
    variantKey: variant,
    riskNotes,
  };
}

export function overdrivePackagePresets(event: ScoredStormEvent, industry: string) {
  const area = areaLabel(event);
  const households = Math.max(1500, Number(event.estimatedHouseholds ?? 0));
  const mailQty = Math.min(5000, Math.max(500, Math.round(households * 0.12)));
  return [
    {
      packageName: "Rapid Geofence Launch",
      packageType: "geofence_only" as const,
      eventSummary: `${event.title}. StormReach Overdrive score ${calculateOverdriveThreatScore(event).score} for ${area}.`,
      recommendedPostcardQuantity: 0,
      suggestedTimeline: "Tonight/tomorrow after admin approval. Ready for external ad platform setup, not auto-launched.",
      suggestedBudgetCents: 125000,
      estimatedPriceToClientCents: 125000,
      revenueEstimateCents: 72500,
      postcardCopy: "Postcard follow-up can be added after the first response window.",
      adCopy: `Storm response help for ${area} homeowners. Fast local ${industry.toLowerCase()} support without pressure.`,
    },
    {
      packageName: "Storm Mail Follow-Up",
      packageType: "postcard_only" as const,
      eventSummary: `${event.title}. Target impacted ZIPs/routes after weather source review.`,
      recommendedPostcardQuantity: mailQty,
      suggestedTimeline: "24-48 hours after approval and route review.",
      suggestedBudgetCents: Math.round(mailQty * 145),
      estimatedPriceToClientCents: Math.round(mailQty * 145),
      revenueEstimateCents: Math.round(mailQty * 65),
      postcardCopy: `Storm come through your neighborhood? Local ${industry.toLowerCase()} help is available for a simple property check. Scan to request a fast estimate.`,
      adCopy: "Postcard-only follow-up package for impacted ZIPs and carrier routes.",
    },
    {
      packageName: "Full Storm Response Package",
      packageType: "combined_geofence_postcard" as const,
      eventSummary: `${event.title}. Full geofence + landing page + postcard + lead tracking package for ${area}.`,
      recommendedPostcardQuantity: mailQty,
      suggestedTimeline: "Approve tonight, geofence setup tomorrow, postcard follow-up in 24-48 hours after route review.",
      suggestedBudgetCents: 325000,
      estimatedPriceToClientCents: 325000,
      revenueEstimateCents: 188500,
      postcardCopy: `Need help after the recent storm? Fast help for roof, tree, siding, window, and exterior storm response in ${area}.`,
      adCopy: `${landingPageCopy(area)} CTA: Request a fast storm damage estimate.`,
    },
  ];
}

function overdriveSms(area: string, businessName: string, profile = stormReachContractorCopyProfile("")) {
  return `Jason/HomeReach. I mapped storm-response pockets near ${area} for ${businessName}. For ${profile.label}, geofence first + postcard follow-up is the play. Want the map? ${STORMREACH_OVERDRIVE_PHONE}.`;
}

function fitOverdriveSms(value: string) {
  if (value.length <= 320) return value;
  const short = `Jason/HomeReach. I mapped storm-response pockets nearby. Geofence first + postcard follow-up. Want the map? ${STORMREACH_OVERDRIVE_PHONE}. Reply STOP to opt out.`;
  return short;
}

function landingPageCopy(area: string) {
  return [
    `Storm damage help for ${area} homeowners`,
    "Fast help for roof, tree, siding, window, and exterior storm damage.",
    "Request a fast storm damage estimate",
  ].join("\n");
}

async function applyOverdriveMetadata(supabase: ServiceClient | undefined, event: StormDashboardEvent, threat: OverdriveThreatScore, services: string[], actor?: StormReachActor) {
  const db = (supabase ?? createServiceClient()) as Db;
  const severityScore = Math.max(Number(event.severity_score ?? 0), threat.score);
  await db.from("storm_events").update({
    severity_score: severityScore,
    severity_level: severityLevel(severityScore),
    recommended_industries: unique([...(event.recommended_industries ?? []), ...services]),
    metadata: {
      ...(event.metadata ?? {}),
      overdrive_mode: true,
      overdrive_state: normalizeState(event.impacted_state) || stormReachOverdriveState(),
      storm_damage_opportunity_score: threat.score,
      overdrive_threat_label: threat.label,
      overdrive_reasons: threat.reasons,
      legal_guardrail: "Do not claim damage occurred unless confirmed. Use storm impacted, potential damage, or storm response language until verified.",
      no_auto_send: true,
      human_approval_required: true,
      updated_by: actor?.label ?? "stormreach_overdrive",
    },
    updated_at: new Date().toISOString(),
  }).eq("id", event.id);
}

async function ensureOverdriveOutreachCampaign(db: Db, eventId: string, actor?: StormReachActor) {
  const existing = await db
    .from("storm_outreach_campaigns")
    .select("*")
    .eq("storm_event_id", eventId)
    .eq("campaign_name", "StormReach Overdrive emergency outreach")
    .maybeSingle();
  if (existing.data) return existing.data as JsonRecord;
  const now = new Date().toISOString();
  const { data, error } = await db.from("storm_outreach_campaigns").insert({
    storm_event_id: eventId,
    industry: "Storm response",
    sender_key: "jason",
    campaign_name: "StormReach Overdrive emergency outreach",
    status: "draft",
    approval_status: "needs_review",
    subject_base: "Storm Damage Opportunity Alert",
    human_approval_required: true,
    metadata: { overdrive_mode: true, no_auto_send: true },
    created_by: actor?.id ?? null,
    created_at: now,
    updated_at: now,
  }).select("*").single();
  if (error) throw new Error(error.message);
  return data as JsonRecord;
}

function overdriveMessageApproval(message: JsonRecord, event: StormDashboardEvent): ApprovalLedgerPayload {
  return {
    source_key: `storm_outreach_messages:${String(message.id)}:stormreach_overdrive_message`,
    source_system: "stormreach",
    source_table: "storm_outreach_messages",
    source_id: String(message.id),
    source_href: `/admin/stormreach/${event.id}`,
    domain: "revenue",
    approval_kind: "stormreach_overdrive_message",
    title: String(message.subject ?? `StormReach ${message.channel} draft`),
    detail: String(message.body ?? "").slice(0, 500),
    source_status: String(message.status ?? "draft"),
    approval_state: "needs_review",
    lane: "needs_approval",
    priority: "high",
    approval_required: true,
    human_approval_required: true,
    sensitive_action: true,
    related_entity_type: "storm_event",
    related_entity_id: event.id,
    channel: String(message.channel ?? "manual"),
    next_action: "Review weather claim, contact permission, suppression status, and CTA before sending.",
    guardrail: "Approval does not send. Sending remains disabled until a separate approved provider workflow is used.",
    policy_flags: ["storm_weather_claim_review", "suppression_required", "no_confirmed_damage_claims"],
    action_target: { id: String(message.id), kind: "stormreach_overdrive_draft", status: String(message.status ?? "draft") },
    evidence: { storm_event_id: event.id, source: event.source, source_url: event.source_url },
    metadata: { overdrive_mode: true, no_auto_send: true },
    source_created_at: String(message.created_at ?? new Date().toISOString()),
    source_updated_at: String(message.updated_at ?? new Date().toISOString()),
    updated_at: new Date().toISOString(),
  };
}

async function createOverdriveNotification(db: Db, state: string, eventCount: number, topScore: number) {
  await db.from("notifications").insert({
    channel: "in_app",
    severity: topScore >= 95 ? "critical" : topScore >= 80 ? "warning" : "info",
    title: `StormReach Overdrive ${state} refresh complete`,
    body: `${eventCount} Ohio storm event${eventCount === 1 ? "" : "s"} are queued for review. Drafts and packages require human approval.`,
    status: "queued",
    related_table: "storm_events",
    related_id: "stormreach_overdrive",
    metadata_json: { source: "stormreach_overdrive", state, event_count: eventCount, top_score: topScore, no_auto_send: true },
  });
}

function dashboardEventToScored(event: StormDashboardEvent): ScoredStormEvent {
  return {
    eventId: event.event_id,
    eventType: event.event_type,
    source: event.source,
    sourceUrl: event.source_url,
    title: event.title,
    description: event.description,
    startTime: event.start_time,
    endTime: event.end_time,
    detectedAt: event.detected_at,
    geographyType: event.geography_type,
    impactedPolygonGeojson: event.impacted_polygon_geojson ?? {},
    impactedCounties: event.impacted_counties ?? [],
    impactedCities: event.impacted_cities ?? [],
    impactedZipCodes: event.impacted_zip_codes ?? [],
    impactedState: event.impacted_state,
    estimatedHouseholds: event.estimated_households,
    estimatedHomeowners: event.estimated_homeowners,
    confidenceScore: event.confidence_score,
    sourcePayload: {},
    hazardMetrics: hazardMetrics(event),
    metadata: event.metadata ?? {},
    severityScore: event.severity_score,
    severityLevel: event.severity_level,
    scoringFactors: {},
  };
}

function hazardMetrics(event: NormalizedStormEvent | StormDashboardEvent) {
  const metadata = objectValue(read(event, "metadata"));
  const direct = objectValue(read(event, "hazardMetrics"));
  const stored = objectValue(metadata.hazard_metrics);
  return {
    ...stored,
    ...direct,
  } as ScoredStormEvent["hazardMetrics"];
}

function bestCategory(category: string, industries: string[]) {
  return industries.find((industry) => industryMatchesCategory(industry, category) || category.toLowerCase().includes(industry.toLowerCase())) ?? industries[0] ?? category;
}

function areaLabel(event: Pick<ScoredStormEvent, "impactedCities" | "impactedCounties" | "impactedState">) {
  return event.impactedCities[0] || event.impactedCounties[0]
    ? `${event.impactedCities[0] ?? event.impactedCounties[0]}${event.impactedState ? `, ${event.impactedState}` : ""}`
    : event.impactedState ?? "the impacted area";
}

function read(event: unknown, key: string) {
  return event && typeof event === "object" ? (event as Record<string, unknown>)[key] : undefined;
}

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringList(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return unique(value.map(clean));
  return unique(String(value ?? "").split(/,|;|\n/).map(clean));
}

function normalizeEventType(value: string | null | undefined): StormEventType {
  const cleanValue = String(value ?? "severe_thunderstorm").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const allowed: StormEventType[] = ["hail", "tornado", "high_wind", "hurricane_tropical_storm", "flooding", "winter_storm_ice", "heat_wave", "wildfire_smoke", "severe_thunderstorm", "derecho", "unknown"];
  return allowed.includes(cleanValue as StormEventType) ? cleanValue as StormEventType : "severe_thunderstorm";
}

function normalizeState(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function numberOrNull(value: unknown) {
  const number = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function isoOrNow(value: string | null | undefined, now: Date) {
  return toIso(value) ?? now.toISOString();
}

function toIso(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function recentEnough(value: string | null | undefined) {
  if (!value) return true;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return true;
  return Date.now() - timestamp <= 30 * 60 * 60 * 1000;
}

function stableHash(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 18);
}

function unique(values: string[]) {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function positiveInteger(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

export const __stormReachOverdriveTestUtils = {
  calculateOverdriveThreatScore,
  recommendOverdriveServices,
  manualStormEventToNormalizedEvent,
  buildOverdriveOutreachDraft,
  overdrivePackagePresets,
};
