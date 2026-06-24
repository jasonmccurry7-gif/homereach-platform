import { describe, expect, it } from "vitest";
import { evaluateStormReachSendPolicy } from "../approval-and-send-engine";
import { generateStormReachRecommendations } from "../agent";
import { buildCensusGeographyUrl } from "../impact-zone-engine";
import { isRecentStormEvent } from "../geo";
import { matchIndustriesForEvent } from "../industry-matching";
import { generateStormOutreachDraft } from "../outreach";
import { __stormReachAutopilotTestUtils, STORMREACH_AUTOPILOT_PHONE } from "../autopilot-core";
import { __stormReachOverdriveTestUtils } from "../overdrive-core";
import { buildStormReachOperatorConversationPlaybook, buildStormReachOperatorCreativeBrief, buildStormReachOperatorHandoffLinks } from "../operator-assets";
import { buildStormMarketingPackages } from "../packages";
import { buildPostcardRoutePlanningMetadata, buildUspsEddmPlanningUrl } from "../postcard-campaign-engine";
import {
  applySuppression,
  dedupeProspects,
  isStormReachStormOutreachIndustry,
  isWithinStormReachStormOutreachRadius,
  stormReachAllowedStormOutreachIndustries,
  stormReachContractorSearchRadiusMiles,
  STORMREACH_CORE_CONTRACTOR_INDUSTRIES,
} from "../prospecting";
import { scoreStormEvent } from "../scoring";
import type { NormalizedStormEvent, ScoredStormEvent, StormBusinessProspectInput } from "../types";
import { __stormReachFemaIpawsTestUtils } from "../weather-providers/fema-ipaws";
import { __stormReachFemaTestUtils } from "../weather-providers/fema";
import { __stormReachNoaaTestUtils } from "../weather-providers/noaa";
import { __stormReachNwsTestUtils } from "../weather-providers/nws";

const baseEvent: NormalizedStormEvent = {
  eventId: "fixture:hail:dayton",
  eventType: "hail",
  source: "National Weather Service",
  sourceUrl: "https://api.weather.gov/alerts/active",
  title: "Severe thunderstorm with large hail near Dayton",
  description: "Radar indicated hail up to 2.00 inches and wind gusts to 70 mph.",
  startTime: "2026-06-08T15:00:00.000Z",
  endTime: "2026-06-08T18:00:00.000Z",
  detectedAt: "2026-06-08T15:05:00.000Z",
  geographyType: "alert_polygon",
  impactedPolygonGeojson: { type: "Point", coordinates: [-84.1916, 39.7589] },
  impactedCounties: ["Montgomery"],
  impactedCities: ["Dayton"],
  impactedZipCodes: ["45402", "45409"],
  impactedState: "OH",
  estimatedHouseholds: 42000,
  estimatedHomeowners: 27000,
  confidenceScore: 88,
  hazardMetrics: { hailSizeInches: 2, windSpeedMph: 70 },
};

describe("StormReach provider parsing", () => {
  it("parses NOAA SPC hail CSV rows into normalized events", () => {
    const rows = __stormReachNoaaTestUtils.toObjects("time,size,location,county,state,lat,lon,comments\n1530,2.00,Dayton,Montgomery,OH,39.75,-84.19,Large hail reported");
    const event = __stormReachNoaaTestUtils.mapSpcReport(rows[0], new Date("2026-06-08T16:00:00.000Z"));

    expect(event?.eventType).toBe("hail");
    expect(event?.impactedCities).toEqual(["Dayton"]);
    expect(event?.hazardMetrics?.hailSizeInches).toBe(2);
    expect((event?.impactedPolygonGeojson as { coordinates?: number[] }).coordinates?.[0]).toBe(-84.19);
  });

  it("ignores NWS beach hazard alerts even when the body mentions wind", () => {
    const event = __stormReachNwsTestUtils.mapFeature({
      id: "beach-hazards-fixture",
      geometry: null,
      properties: {
        event: "Beach Hazards Statement",
        headline: "Beach Hazards Statement for Lake Erie",
        description: "Wind and wave action will cause currents on the lakeshore.",
        areaDesc: "Lorain; Cuyahoga",
        sent: "2026-06-11T15:54:00-04:00",
        onset: "2026-06-12T02:00:00-04:00",
        ends: "2026-06-12T14:00:00-04:00",
        severity: "Moderate",
        urgency: "Expected",
        certainty: "Likely",
        status: "Actual",
      },
    }, new Date("2026-06-11T20:00:00.000Z"));

    expect(event).toBeNull();
  });

  it("parses FEMA fire declarations as wildfire/smoke events", () => {
    const event = __stormReachFemaTestUtils.mapFemaDeclaration({
      disasterNumber: "9999",
      state: "CA",
      designatedArea: "Los Angeles (County)",
      declarationTitle: "Wildfire and Straight-line Winds",
      incidentType: "Fire",
      declarationDate: "2026-06-08T00:00:00.000Z",
    }, new Date("2026-06-08T12:00:00.000Z"));

    expect(event?.eventType).toBe("wildfire_smoke");
    expect(event?.impactedCounties).toEqual(["Los Angeles"]);
  });

  it("parses FEMA IPAWS CAP polygons into GeoJSON events", () => {
    const event = __stormReachFemaIpawsTestUtils.mapCapAlert(`
      <alert>
        <identifier>CAP-123</identifier>
        <sent>2026-06-08T12:00:00-04:00</sent>
        <status>Actual</status>
        <msgType>Alert</msgType>
        <scope>Public</scope>
        <info>
          <event>Excessive Heat Warning</event>
          <urgency>Expected</urgency>
          <severity>Severe</severity>
          <certainty>Likely</certainty>
          <headline>Excessive heat around Phoenix</headline>
          <description>Dangerous heat is expected.</description>
          <area>
            <areaDesc>Maricopa County, AZ</areaDesc>
            <polygon>33.70,-112.30 33.70,-111.90 33.30,-111.90 33.30,-112.30</polygon>
            <geocode><valueName>UGC</valueName><value>AZC013</value></geocode>
          </area>
        </info>
      </alert>
    `, new Date("2026-06-08T17:00:00.000Z"), "https://example.test/ipaws.xml");

    expect(event?.eventType).toBe("heat_wave");
    expect(event?.impactedState).toBe("AZ");
    expect(event?.impactedCounties).toContain("Maricopa");
    expect(event?.impactedPolygonGeojson).toMatchObject({ type: "Polygon" });
  });
});

describe("StormReach opportunity logic", () => {
  it("scores large hail over dense suburbs as high or extreme", () => {
    const scored = scoreStormEvent(baseEvent, new Date("2026-06-08T17:00:00.000Z"));

    expect(scored.severityScore).toBeGreaterThanOrEqual(65);
    expect(["High", "Extreme"]).toContain(scored.severityLevel);
  });

  it("matches hail to exterior service categories", () => {
    const scored = scoreStormEvent(baseEvent, new Date("2026-06-08T17:00:00.000Z"));
    const matches = matchIndustriesForEvent(scored);

    expect(matches.map((match) => match.industry)).toContain("Roofing");
    expect(matches.map((match) => match.industry)).toContain("Gutters");
  });

  it("matches heat waves to HVAC, insulation, generator, and electrical categories", () => {
    const scored = scoreStormEvent({
      ...baseEvent,
      eventId: "fixture:heat:phoenix",
      eventType: "heat_wave",
      title: "Excessive Heat Warning near Phoenix",
      description: "Dangerous heat is expected in the affected area.",
      impactedCities: ["Phoenix"],
      impactedCounties: ["Maricopa"],
      impactedState: "AZ",
      hazardMetrics: {},
    }, new Date("2026-06-08T17:00:00.000Z"));
    const industries = matchIndustriesForEvent(scored).map((match) => match.industry);

    expect(industries).toContain("HVAC");
    expect(industries).toContain("Insulation");
    expect(industries).toContain("Generator installation");
    expect(industries).toContain("Electrical");
  });

  it("deduplicates prospects and keeps suppression status", () => {
    const prospects: StormBusinessProspectInput[] = [
      { businessName: "Apex Roofing LLC", email: "Owner@ApexRoof.com", category: "Roofing", source: "sales_leads", confidenceScore: 60 },
      { businessName: "Apex Roofing", email: "owner@apexroof.com", category: "Roofing", source: "outreach_prospects", confidenceScore: 75 },
      { businessName: "Clear Gutters", email: "hello@cleargutters.com", category: "Gutters", source: "sales_leads", confidenceScore: 70 },
    ];

    const deduped = dedupeProspects(prospects);
    const checked = applySuppression(deduped.unique, [{ contact_email: "hello@cleargutters.com", channel: "email", active: true }]);

    expect(deduped.unique).toHaveLength(2);
    expect(deduped.duplicates).toHaveLength(1);
    expect(checked.find((prospect) => prospect.businessName === "Clear Gutters")?.suppressionStatus).toBe("suppressed");
  });

  it("generates short approval-required outreach without disaster exploitation claims", () => {
    const scored = scoreStormEvent(baseEvent, new Date("2026-06-08T17:00:00.000Z"));
    const draft = generateStormOutreachDraft({
      event: scored,
      prospect: { businessName: "Apex Roofing", ownerName: "Taylor Smith", category: "Roofing" },
      industry: "Roofing",
    });

    expect(draft.subject).toMatch(/storm|weather|geofence/i);
    expect(draft.body).toContain("Hi Taylor,");
    expect(draft.body).toMatch(/geofence|geofenced/i);
    expect(draft.body).toMatch(/postcard/i);
    expect(draft.body).not.toMatch(/guaranteed|your home is damaged|file an insurance claim/i);
    expect(draft.approvalStatus).toBe("needs_review");
  });

  it("generates varied contractor outreach while preserving geofence and postcard positioning", () => {
    const scored = scoreStormEvent(baseEvent, new Date("2026-06-08T17:00:00.000Z"));
    const first = generateStormOutreachDraft({
      event: scored,
      prospect: { businessName: "Apex Roofing", ownerName: "Taylor Smith", category: "Roofing" },
      industry: "Roofing",
      sequence: 1,
    });
    const second = generateStormOutreachDraft({
      event: scored,
      prospect: { businessName: "Buckeye Siding", ownerName: "Morgan Lee", category: "Siding" },
      industry: "Siding",
      sequence: 2,
    });

    expect(first.subject).not.toBe(second.subject);
    expect(first.body).not.toBe(second.body);
    expect(first.body).toMatch(/geofence/i);
    expect(second.body).toMatch(/postcard/i);
    expect([first.approvalStatus, second.approvalStatus]).toEqual(["needs_review", "needs_review"]);
  });

  it("uses a 24-hour storm lookback and 50-mile core contractor defaults", () => {
    const now = new Date("2026-06-08T20:00:00.000Z");
    const previousRadius = process.env.STORMREACH_CONTRACTOR_SEARCH_RADIUS_MILES;
    delete process.env.STORMREACH_CONTRACTOR_SEARCH_RADIUS_MILES;
    expect(isRecentStormEvent(baseEvent, 24, now)).toBe(true);
    expect(isRecentStormEvent({
      ...baseEvent,
      detectedAt: "2026-06-06T20:00:00.000Z",
      startTime: "2026-06-06T18:00:00.000Z",
      endTime: "2026-06-06T19:00:00.000Z",
    }, 24, now)).toBe(false);
    expect(STORMREACH_CORE_CONTRACTOR_INDUSTRIES).toEqual(["Home services", "Tree service", "Roofing", "Siding"]);
    expect(stormReachContractorSearchRadiusMiles()).toBe(50);
    if (previousRadius === undefined) delete process.env.STORMREACH_CONTRACTOR_SEARCH_RADIUS_MILES;
    else process.env.STORMREACH_CONTRACTOR_SEARCH_RADIUS_MILES = previousRadius;
  });

  it("limits storm outreach businesses to approved categories within 50 miles", () => {
    expect(isStormReachStormOutreachIndustry("Roofing contractor")).toBe(true);
    expect(isStormReachStormOutreachIndustry("Tree removal")).toBe(true);
    expect(isStormReachStormOutreachIndustry("Local home improvement")).toBe(true);
    expect(isStormReachStormOutreachIndustry("HVAC contractor")).toBe(false);
    expect(stormReachAllowedStormOutreachIndustries(["Roofing", "HVAC", "Tree service"])).toEqual(["Tree service", "Roofing"]);
    expect(isWithinStormReachStormOutreachRadius(50)).toBe(true);
    expect(isWithinStormReachStormOutreachRadius("49.5")).toBe(true);
    expect(isWithinStormReachStormOutreachRadius(50.01)).toBe(false);
    expect(isWithinStormReachStormOutreachRadius(null)).toBe(false);
  });

  it("creates campaign packages with geofence and postcard components", () => {
    const scored = scoreStormEvent(baseEvent, new Date("2026-06-08T17:00:00.000Z"));
    const packages = buildStormMarketingPackages(scored, "Roofing");

    expect(packages).toHaveLength(4);
    expect(packages[0].emailDraft).toContain("Human approval required");
    expect(packages.some((pkg) => pkg.packageType === "emergency_first_to_market")).toBe(true);
    expect(packages.every((pkg) => pkg.recommendedPostcardQuantity > 0)).toBe(true);
  });

  it("builds Census and USPS planning helpers without credentials", () => {
    const scored = scoreStormEvent(baseEvent, new Date("2026-06-08T17:00:00.000Z"));
    const censusUrl = buildCensusGeographyUrl({ longitude: -84.1916, latitude: 39.7589 });
    const uspsUrl = buildUspsEddmPlanningUrl("45402");
    const postcardPlanning = buildPostcardRoutePlanningMetadata(scored, "Roofing");

    expect(censusUrl).toContain("geocoder/geographies/coordinates");
    expect(censusUrl).toContain("x=-84.1916");
    expect(uspsUrl).toContain("45402");
    expect(postcardPlanning.routePlanningStatus).toBe("manual_review_required");
  });

  it("blocks StormReach sending unless approval, suppression, autopilot, cap, and timing pass", () => {
    const blocked = evaluateStormReachSendPolicy({
      recipientEmail: "owner@example.com",
      approvalStatus: "needs_review",
      suppressionStatus: "clear",
      autopilotEnabled: false,
      dailyLimit: 0,
      now: new Date("2026-06-08T15:00:00.000Z"),
    });
    const allowed = evaluateStormReachSendPolicy({
      recipientEmail: "owner@example.com",
      approvalStatus: "approved",
      suppressionStatus: "clear",
      autopilotEnabled: true,
      dailyLimit: 10,
      sendsToday: 0,
      now: new Date("2026-06-08T15:00:00.000Z"),
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons.join(" ")).toMatch(/approval|autopilot|daily send limit/i);
    expect(allowed.allowed).toBe(true);
  });

  it("allows manual admin email sends outside business hours while blocking automation", () => {
    const afterHours = new Date(2026, 5, 8, 20, 0, 0);
    const automated = evaluateStormReachSendPolicy({
      sendMode: "automation",
      recipientEmail: "owner@example.com",
      approvalStatus: "approved",
      suppressionStatus: "clear",
      autopilotEnabled: false,
      dailyLimit: 0,
      sendsToday: 0,
      now: afterHours,
    });
    const manual = evaluateStormReachSendPolicy({
      sendMode: "manual_admin",
      recipientEmail: "owner@example.com",
      approvalStatus: "approved",
      suppressionStatus: "clear",
      autopilotEnabled: false,
      dailyLimit: 0,
      sendsToday: 0,
      now: afterHours,
    });

    expect(automated.allowed).toBe(false);
    expect(automated.reasons.join(" ")).toMatch(/autopilot|daily send limit|business-hours/i);
    expect(manual.allowed).toBe(true);
  });

  it("creates Strategist recommendations for high events without prospects", () => {
    const scored = scoreStormEvent(baseEvent, new Date("2026-06-08T17:00:00.000Z")) as ScoredStormEvent & { recommendedIndustries: string[] };
    scored.recommendedIndustries = ["Roofing", "Gutters"];
    const recommendations = generateStormReachRecommendations({ events: [scored] });

    expect(recommendations.some((item) => item.recommendationType === "prospecting_gap")).toBe(true);
    expect(recommendations.every((item) => item.metadata.no_auto_send !== false)).toBe(true);
  });

  it("builds operator conversation, intake, payment, geofence, postcard, and social handoffs behind approval", () => {
    const scored = scoreStormEvent(baseEvent, new Date("2026-06-08T17:00:00.000Z"));
    const [packageDraft] = buildStormMarketingPackages(scored, "Roofing");
    const dashboardEvent = {
      ...scored,
      id: "event-uuid",
      event_id: scored.eventId,
      event_type: scored.eventType,
      source_url: scored.sourceUrl ?? null,
      start_time: scored.startTime ?? null,
      end_time: scored.endTime ?? null,
      detected_at: scored.detectedAt,
      severity_score: scored.severityScore,
      severity_level: scored.severityLevel,
      confidence_score: scored.confidenceScore ?? 0,
      geography_type: scored.geographyType,
      impacted_polygon_geojson: scored.impactedPolygonGeojson,
      impacted_counties: scored.impactedCounties,
      impacted_cities: scored.impactedCities,
      impacted_zip_codes: scored.impactedZipCodes,
      impacted_state: scored.impactedState ?? null,
      estimated_households: scored.estimatedHouseholds ?? 0,
      estimated_homeowners: scored.estimatedHomeowners ?? 0,
      recommended_industries: ["Roofing", "Siding"],
      recommended_campaigns: [],
      status: "campaign_ready" as const,
      approval_status: "needs_review",
      metadata: {},
      created_at: scored.detectedAt,
      updated_at: scored.detectedAt,
    };
    const packageRow = {
      package_name: packageDraft.packageName,
      package_type: packageDraft.packageType,
      industry: "Roofing",
      estimated_households: packageDraft.estimatedHouseholds,
      recommended_geofence_radius_miles: packageDraft.recommendedGeofenceRadiusMiles,
      recommended_postcard_quantity: packageDraft.recommendedPostcardQuantity,
      estimated_price_to_client_cents: packageDraft.estimatedPriceToClientCents,
      proposal_token: "proposal-token",
      postcard_copy: packageDraft.postcardCopy,
      ad_copy: packageDraft.adCopy,
    };
    const links = buildStormReachOperatorHandoffLinks({ appUrl: "https://home-reach.com", event: dashboardEvent, packageRow });
    const playbook = buildStormReachOperatorConversationPlaybook({ event: dashboardEvent, packageRow, links });
    const creative = buildStormReachOperatorCreativeBrief({ event: dashboardEvent, packageRow, links });

    expect(links.proposalUrl).toBe("https://home-reach.com/stormreach/proposals/proposal-token");
    expect(links.intakeUrl).toContain("/digital-targeting/intake");
    expect(links.paymentStatus).toBe("approval_required");
    expect(playbook.replies.some((reply) => /payment is handled after approval/i.test(reply.draft))).toBe(true);
    expect(playbook.guardrails.join(" ")).toMatch(/Do not state that any specific home is damaged/i);
    expect(creative.geofence.radiusMiles).toBeGreaterThan(0);
    expect(creative.postcard.qrDestination).toContain("/stormreach/proposals/");
    expect(creative.social.formats).toContain("9:16 story/reel");
    expect(creative.compliance.join(" ")).toMatch(/Human approval required/i);
  });

  it("scores Overdrive damaging-wind thresholds for urgent Ohio operations", () => {
    const threat = __stormReachOverdriveTestUtils.calculateOverdriveThreatScore({
      ...baseEvent,
      eventId: "fixture:wind:ohio",
      eventType: "high_wind",
      title: "Severe storms capable of 75 mph wind gusts",
      description: "Damaging wind gusts around 75 mph are possible tonight.",
      hazardMetrics: { windSpeedMph: 75 },
      impactedState: "OH",
    });

    expect(threat.score).toBeGreaterThanOrEqual(95);
    expect(threat.label).toBe("urgent");
    expect(threat.reasons.join(" ")).toMatch(/75 mph/i);
  });

  it("recommends Overdrive contractor categories for high wind and outages", () => {
    const services = __stormReachOverdriveTestUtils.recommendOverdriveServices({
      eventType: "high_wind",
      title: "High wind and possible outages",
      description: "Damaging winds may cause power outages.",
    });

    expect(services).toContain("Roofing");
    expect(services).toContain("Tree service");
    expect(services).toContain("Home services");
    expect(services).toContain("Siding");
    expect(services).not.toContain("Electrical");
    expect(services).not.toContain("Generator installation");
    expect(services).not.toContain("Dumpster rental");
  });

  it("creates stable manual Overdrive event IDs to prevent duplicates", () => {
    const input = {
      eventType: "high_wind",
      headline: "Manual Ohio damaging wind event",
      description: "Operator-entered event from verified reports.",
      windMph: 75,
      state: "OH",
      counties: "Stark, Summit",
      cities: "Canton, Akron",
      zipCodes: "44702,44308",
      startTime: "2026-06-10T23:00:00.000Z",
    };
    const first = __stormReachOverdriveTestUtils.manualStormEventToNormalizedEvent(input, new Date("2026-06-10T23:10:00.000Z"));
    const second = __stormReachOverdriveTestUtils.manualStormEventToNormalizedEvent(input, new Date("2026-06-10T23:20:00.000Z"));

    expect(first.eventId).toBe(second.eventId);
    expect(first.impactedState).toBe("OH");
    expect(first.hazardMetrics?.windSpeedMph).toBe(75);
  });

  it("generates Overdrive email, SMS, and DM drafts behind approval guardrails", () => {
    const scored = scoreStormEvent(baseEvent, new Date("2026-06-08T17:00:00.000Z"));
    const email = __stormReachOverdriveTestUtils.buildOverdriveOutreachDraft({
      channel: "email",
      event: scored,
      prospect: { businessName: "Buckeye Roofing", ownerName: "Jordan Smith" },
      category: "Roofing",
    });
    const sms = __stormReachOverdriveTestUtils.buildOverdriveOutreachDraft({
      channel: "sms",
      event: scored,
      prospect: { businessName: "Buckeye Roofing" },
      category: "Roofing",
    });
    const dm = __stormReachOverdriveTestUtils.buildOverdriveOutreachDraft({
      channel: "facebook_dm",
      event: scored,
      prospect: { businessName: "Buckeye Roofing" },
      category: "Roofing",
    });

    expect(email.subject).toMatch(/Storm Damage Opportunity Alert/i);
    expect(email.body).toMatch(/geofence ads/i);
    expect(sms.body).toMatch(/STOP/i);
    expect(dm.body).toMatch(/Want details/i);
    expect(email.riskNotes.join(" ")).toMatch(/Human approval required/i);
  });

  it("creates Overdrive geofence, mail, and full-response package presets", () => {
    const scored = scoreStormEvent(baseEvent, new Date("2026-06-08T17:00:00.000Z"));
    const presets = __stormReachOverdriveTestUtils.overdrivePackagePresets(scored, "Tree service");

    expect(presets.map((preset) => preset.packageName)).toEqual([
      "Rapid Geofence Launch",
      "Storm Mail Follow-Up",
      "Full Storm Response Package",
    ]);
    expect(presets[0].packageType).toBe("geofence_only");
    expect(presets[1].recommendedPostcardQuantity).toBeGreaterThan(0);
    expect(presets[2].adCopy).toMatch(/Request a fast storm damage estimate/i);
  });

  it("classifies 70+ mph wind events as high-priority Autopilot candidates", () => {
    const scored = scoreStormEvent({
      ...baseEvent,
      eventId: "fixture:autopilot:wind",
      eventType: "high_wind",
      title: "Measured 72 mph wind with trees down near Akron",
      description: "Severe wind report included trees down and power line damage.",
      impactedCities: ["Akron"],
      impactedCounties: ["Summit"],
      impactedZipCodes: ["44308"],
      hazardMetrics: { windSpeedMph: 72 },
    }, new Date("2026-06-08T17:00:00.000Z"));
    const opportunity = __stormReachAutopilotTestUtils.classifyStormReachAutopilotOpportunity(scored);

    expect(__stormReachAutopilotTestUtils.isStormReachAutopilotCandidate(scored, new Date("2026-06-08T18:00:00.000Z"))).toBe(true);
    expect(["High", "Critical"]).toContain(opportunity.level);
    expect(opportunity.score).toBeGreaterThanOrEqual(95);
  });

  it("generates Autopilot email, SMS, and Messenger drafts without auto-send claims", () => {
    const scored = scoreStormEvent(baseEvent, new Date("2026-06-08T17:00:00.000Z"));
    const prospect = { businessName: "Buckeye Roofing", ownerName: "Jordan Smith", category: "Roofing" };
    const email = __stormReachAutopilotTestUtils.buildStormReachAutopilotDraft({ channel: "email", event: scored, prospect, category: "Roofing", sequence: 1 });
    const sms = __stormReachAutopilotTestUtils.buildStormReachAutopilotDraft({ channel: "sms", event: scored, prospect, category: "Roofing", sequence: 1 });
    const dm = __stormReachAutopilotTestUtils.buildStormReachAutopilotDraft({ channel: "facebook_dm", event: scored, prospect, category: "Roofing", sequence: 1 });

    expect(email.body).toContain(STORMREACH_AUTOPILOT_PHONE);
    expect(email.body).toMatch(/geofence/i);
    expect(email.body).toMatch(/postcard/i);
    expect(sms.body.length).toBeLessThanOrEqual(320);
    expect(sms.body).toMatch(/STOP/i);
    expect(dm.body).toMatch(/Want me to send/i);
    expect(email.riskNotes.join(" ")).toMatch(/Human approval required/i);
  });

  it("generates StormReach branded asset specs for social and one-pager formats", () => {
    const scored = scoreStormEvent(baseEvent, new Date("2026-06-08T17:00:00.000Z"));
    const specs = __stormReachAutopilotTestUtils.buildStormOpportunityAssetSpecs(scored);

    expect(specs.map((spec) => spec.assetType)).toContain("social_image_16x9");
    expect(specs.map((spec) => spec.assetType)).toContain("social_image_1080x1350");
    expect(specs.map((spec) => spec.assetType)).toContain("pdf_one_pager");
    expect(specs[0].contentText).toMatch(/HomeReach StormReach/);
    expect(specs[0].contentText).toMatch(/Be First To The Storm/);
    expect(specs.every((spec) => spec.metadata.human_approval_required)).toBe(true);
  });
});
