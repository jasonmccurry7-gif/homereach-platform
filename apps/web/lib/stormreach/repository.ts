import "server-only";

import { syncApprovalLedgerPayloads, type ApprovalLedgerPayload } from "@/lib/approvals/ledger";
import { createServiceClient } from "@/lib/supabase/service";
import { buildDailyStormReachReport, generateStormReachRecommendations } from "./agent";
import { distanceMiles, eventCentroid, isRecentStormEvent, stormReachLookbackHours } from "./geo";
import { matchIndustriesForEvent } from "./industry-matching";
import { generateStormOutreachDraft, impactedAreaLabel } from "./outreach";
import {
  buildGeofenceExport,
  buildPostcardDraft,
  buildStormMarketingPackages,
  createProposalToken,
  estimateCampaignRevenueCents,
} from "./packages";
import { fetchGooglePlacesContractors } from "./places";
import {
  applySuppression,
  dedupeProspects,
  industryMatchesCategory,
  isCoreStormReachContractorIndustry,
  isWithinStormReachStormOutreachRadius,
  normalizeBusinessName,
  normalizeEmail,
  normalizePhone,
  searchRadiusForEvent,
  STORMREACH_CORE_CONTRACTOR_INDUSTRIES,
  stormReachAllowedStormOutreachIndustries,
  stormReachContractorSearchRadiusMiles,
  stormReachStormOutreachRadiusMiles,
  type StormSuppressionRecord,
} from "./prospecting";
import { scoreStormEvent } from "./scoring";
import type {
  NormalizedStormEvent,
  ScoredStormEvent,
  StormBusinessProspectInput,
  StormDashboardData,
  StormDashboardEvent,
  StormEventStatus,
} from "./types";
import { fetchWeatherProviderEvents } from "./weather-providers";

type ServiceClient = ReturnType<typeof createServiceClient>;
type Db = ServiceClient & { from(table: string): any };
type JsonRecord = Record<string, unknown>;

export type StormReachActor = {
  id?: string | null;
  label?: string | null;
  email?: string | null;
};

type QueryResult<T> = {
  data: T[];
  error: string | null;
};

type StormEventRow = StormDashboardEvent & {
  source_payload?: JsonRecord | null;
  scoring_factors?: JsonRecord | null;
};

type EventDetail = {
  event: StormEventRow | null;
  geographies: JsonRecord[];
  zipCodes: JsonRecord[];
  industryMatches: JsonRecord[];
  prospects: JsonRecord[];
  outreachCampaigns: JsonRecord[];
  outreachMessages: JsonRecord[];
  packages: JsonRecord[];
  geofenceCampaigns: JsonRecord[];
  postcardCampaigns: JsonRecord[];
  improvements: JsonRecord[];
  auditLogs: JsonRecord[];
  errors: string[];
};

export type StormReachScheduledJob = "fifteen_minute" | "hourly" | "three_hour" | "daily" | "weekly";

export function stormReachPersistenceConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function loadStormReachDashboard(supabase?: ServiceClient): Promise<StormDashboardData> {
  const db = asDb(supabase);
  const errors: string[] = [];

  const [
    events,
    prospects,
    outreachMessages,
    packages,
    geofenceCampaigns,
    postcardCampaigns,
    generatedAssets,
    agentRuns,
    campaigns,
    improvements,
    providerStatus,
  ] = await Promise.all([
    queryRows<StormDashboardEvent>("storm_events", db.from("storm_events").select("*").order("detected_at", { ascending: false }).limit(120)),
    queryRows<JsonRecord>("storm_business_prospects", db.from("storm_business_prospects").select("*").order("created_at", { ascending: false }).limit(120)),
    queryRows<JsonRecord>("storm_outreach_messages", db.from("storm_outreach_messages").select("*").order("created_at", { ascending: false }).limit(120)),
    queryRows<JsonRecord>("storm_marketing_packages", db.from("storm_marketing_packages").select("*").order("updated_at", { ascending: false }).limit(80)),
    queryRows<JsonRecord>("storm_geofence_campaigns", db.from("storm_geofence_campaigns").select("*").order("updated_at", { ascending: false }).limit(80)),
    queryRows<JsonRecord>("storm_postcard_campaigns", db.from("storm_postcard_campaigns").select("*").order("updated_at", { ascending: false }).limit(80)),
    queryRows<JsonRecord>("storm_generated_assets", db.from("storm_generated_assets").select("*").order("created_at", { ascending: false }).limit(80)),
    queryRows<JsonRecord>("storm_agent_runs", db.from("storm_agent_runs").select("*").order("started_at", { ascending: false }).limit(40)),
    queryRows<JsonRecord>("storm_campaigns", db.from("storm_campaigns").select("*").order("updated_at", { ascending: false }).limit(80)),
    queryRows<JsonRecord>("storm_agent_improvements", db.from("storm_agent_improvements").select("*").order("created_at", { ascending: false }).limit(40)),
    queryRows<JsonRecord>("storm_provider_runs", db.from("storm_provider_runs").select("*").order("started_at", { ascending: false }).limit(20)),
  ]);

  for (const result of [events, prospects, outreachMessages, packages, geofenceCampaigns, postcardCampaigns, improvements, providerStatus]) {
    if (result.error) errors.push(result.error);
  }
  for (const result of [generatedAssets, agentRuns, campaigns]) {
    if (result.error && !isMissingOptionalStormReachTable(result.error)) errors.push(result.error);
  }

  const activeEvents = events.data.filter((event) => !["archived", "dismissed"].includes(String(event.status))).length;
  const last24HourEvents = events.data.filter((event) => !["archived", "dismissed"].includes(String(event.status)) && isRecentStormEvent(event)).length;
  const highOrExtremeEvents = events.data.filter((event) => event.severity_level === "High" || event.severity_level === "Extreme").length;
  const projectedRevenueCents = packages.data.reduce((sum, row) => sum + numberValue(row.revenue_estimate_cents), 0);
  const prospectsReady = prospects.data.filter((row) => row.suppression_status !== "suppressed");

  return {
    events: events.data,
    prospects: prospects.data,
    outreachMessages: outreachMessages.data,
    packages: packages.data,
    geofenceCampaigns: geofenceCampaigns.data,
    postcardCampaigns: postcardCampaigns.data,
    generatedAssets: generatedAssets.data,
    agentRuns: agentRuns.data,
    campaigns: campaigns.data,
    improvements: improvements.data,
    providerStatus: providerStatus.data,
    errors,
    metrics: {
      activeEvents,
      last24HourEvents,
      highOrExtremeEvents,
      prospectsReady: prospectsReady.length,
      contractorProspectsReady: prospectsReady.filter((row) => isCoreStormReachContractorIndustry(String(row.category ?? ""))).length,
      outreachDrafts: outreachMessages.data.filter((row) => row.status === "draft" || row.approval_status === "needs_review").length,
      campaignPackages: packages.data.length,
      generatedAssets: generatedAssets.data.length,
      projectedRevenueCents,
    },
  };
}

export async function loadStormReachEventDetail(eventId: string, supabase?: ServiceClient): Promise<EventDetail> {
  const db = asDb(supabase);
  const errors: string[] = [];
  const eventQuery = isUuid(eventId)
    ? db.from("storm_events").select("*").eq("id", eventId).maybeSingle()
    : db.from("storm_events").select("*").eq("event_id", eventId).maybeSingle();
  const eventResult = await querySingle<StormEventRow>("storm_events.detail", eventQuery);
  if (eventResult.error) errors.push(eventResult.error);
  const event = eventResult.data;

  if (!event?.id) {
    return {
      event: null,
      geographies: [],
      zipCodes: [],
      industryMatches: [],
      prospects: [],
      outreachCampaigns: [],
      outreachMessages: [],
      packages: [],
      geofenceCampaigns: [],
      postcardCampaigns: [],
      improvements: [],
      auditLogs: [],
      errors,
    };
  }

  const [
    geographies,
    zipCodes,
    industryMatches,
    prospects,
    outreachCampaigns,
    outreachMessages,
    packages,
    geofenceCampaigns,
    postcardCampaigns,
    improvements,
    auditLogs,
  ] = await Promise.all([
    queryRows<JsonRecord>("storm_event_geographies", db.from("storm_event_geographies").select("*").eq("storm_event_id", event.id).order("created_at", { ascending: false })),
    queryRows<JsonRecord>("storm_event_zip_codes", db.from("storm_event_zip_codes").select("*").eq("storm_event_id", event.id).order("damage_likelihood_score", { ascending: false })),
    queryRows<JsonRecord>("storm_event_industry_matches", db.from("storm_event_industry_matches").select("*").eq("storm_event_id", event.id).order("match_score", { ascending: false })),
    queryRows<JsonRecord>("storm_business_prospects", db.from("storm_business_prospects").select("*").eq("storm_event_id", event.id).order("confidence_score", { ascending: false }).limit(300)),
    queryRows<JsonRecord>("storm_outreach_campaigns", db.from("storm_outreach_campaigns").select("*").eq("storm_event_id", event.id).order("created_at", { ascending: false })),
    queryRows<JsonRecord>("storm_outreach_messages", db.from("storm_outreach_messages").select("*").eq("storm_event_id", event.id).order("created_at", { ascending: false }).limit(300)),
    queryRows<JsonRecord>("storm_marketing_packages", db.from("storm_marketing_packages").select("*").eq("storm_event_id", event.id).order("created_at", { ascending: false })),
    queryRows<JsonRecord>("storm_geofence_campaigns", db.from("storm_geofence_campaigns").select("*").eq("storm_event_id", event.id).order("created_at", { ascending: false })),
    queryRows<JsonRecord>("storm_postcard_campaigns", db.from("storm_postcard_campaigns").select("*").eq("storm_event_id", event.id).order("created_at", { ascending: false })),
    queryRows<JsonRecord>("storm_agent_improvements", db.from("storm_agent_improvements").select("*").eq("storm_event_id", event.id).order("created_at", { ascending: false })),
    queryRows<JsonRecord>("storm_audit_logs", db.from("storm_audit_logs").select("*").eq("storm_event_id", event.id).order("created_at", { ascending: false }).limit(80)),
  ]);

  for (const result of [geographies, zipCodes, industryMatches, prospects, outreachCampaigns, outreachMessages, packages, geofenceCampaigns, postcardCampaigns, improvements, auditLogs]) {
    if (result.error) errors.push(result.error);
  }

  return {
    event,
    geographies: geographies.data,
    zipCodes: zipCodes.data,
    industryMatches: industryMatches.data,
    prospects: prospects.data,
    outreachCampaigns: outreachCampaigns.data,
    outreachMessages: outreachMessages.data,
    packages: packages.data,
    geofenceCampaigns: geofenceCampaigns.data,
    postcardCampaigns: postcardCampaigns.data,
    improvements: improvements.data,
    auditLogs: auditLogs.data,
    errors,
  };
}

export async function ingestStormReachEvents(options: {
  supabase?: ServiceClient;
  actor?: StormReachActor;
  limit?: number;
  state?: string | null;
  now?: Date;
} = {}) {
  const db = asDb(options.supabase);
  const results = await fetchWeatherProviderEvents({ limit: options.limit ?? 250, now: options.now, state: options.state });
  let eventsSeen = 0;
  let eventsUpserted = 0;
  const errors: string[] = [];
  const upsertedEvents: StormEventRow[] = [];

  for (const providerResult of results) {
    const runStartedAt = new Date().toISOString();
    eventsSeen += providerResult.events.length;
    let providerUpserts = 0;
    const providerErrors = [...providerResult.warnings];

    for (const normalized of providerResult.events) {
      try {
        const row = await upsertStormReachNormalizedEvent(normalized, {
          supabase: db,
          actor: options.actor,
          now: options.now,
          sourceProvider: providerResult.provider,
        });
        providerUpserts += 1;
        eventsUpserted += 1;
        upsertedEvents.push(row);
        if (row.severity_level === "High" || row.severity_level === "Extreme") {
          await createAdminNotification(db, {
            title: `${row.severity_level} StormReach event detected`,
            body: `${row.title} is ready for review. Outreach and campaigns remain approval-gated.`,
            severity: row.severity_level === "Extreme" ? "critical" : "warning",
            relatedTable: "storm_events",
            relatedId: row.id,
            metadata: { event_id: row.event_id, severity_score: row.severity_score },
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown StormReach event ingest error.";
        providerErrors.push(message);
        errors.push(message);
      }
    }

    await db.from("storm_provider_runs").insert({
      provider_key: providerResult.provider,
      run_type: "ingest",
      status: providerErrors.length ? "warning" : "completed",
      events_seen: providerResult.events.length,
      events_upserted: providerUpserts,
      errors: providerErrors,
      metadata: { source_url: providerResult.sourceUrl, state_filter: options.state ?? null },
      started_at: runStartedAt,
      completed_at: new Date().toISOString(),
    });

    if (providerErrors.length) {
      await createAdminNotification(db, {
        title: `StormReach provider warning: ${providerResult.provider}`,
        body: providerErrors.slice(0, 2).join(" "),
        severity: "warning",
        relatedTable: "storm_provider_runs",
        relatedId: providerResult.provider,
        metadata: { provider: providerResult.provider, errors: providerErrors },
      });
    }
  }

  return {
    ok: errors.length === 0,
    eventsSeen,
    eventsUpserted,
    errors,
    events: upsertedEvents,
  };
}

export async function upsertStormReachNormalizedEvent(event: NormalizedStormEvent, options: {
  supabase?: ServiceClient;
  actor?: StormReachActor;
  now?: Date;
  sourceProvider?: string | null;
  industryOverrides?: string[];
} = {}) {
  const db = asDb(options.supabase);
  const enriched = estimateHouseholds(event);
  const scored = scoreStormEvent(enriched, options.now ?? new Date());
  const matches = matchIndustriesForEvent(scored, options.industryOverrides ?? []);
  const payload = eventPayload(scored, matches.map((match) => match.industry), options.actor);
  const { data, error } = await db
    .from("storm_events")
    .upsert(payload, { onConflict: "event_id" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const row = data as StormEventRow;
  await syncEventChildren(db, row, scored, matches, options.actor);
  await logStormActivity(db, {
    stormEventId: row.id,
    action: "event_ingested",
    status: row.status,
    summary: `${row.title} ingested from ${row.source}.`,
    actor: options.actor,
    approvalStatus: "needs_review",
    details: {
      provider: options.sourceProvider ?? event.sourcePayload?.provider ?? event.source,
      severity_score: row.severity_score,
      confidence_score: row.confidence_score,
    },
  });
  await mirrorEventToWorkforce(db, row, options.actor);
  return row;
}

export async function generateProspectsForStormEvent(eventId: string, options: {
  supabase?: ServiceClient;
  actor?: StormReachActor;
  limit?: number;
  industries?: string[];
  radiusMiles?: number;
  includeExternalProviders?: boolean;
  coreContractorMode?: boolean;
} = {}) {
  const db = asDb(options.supabase);
  const detail = await loadStormReachEventDetail(eventId, db);
  if (!detail.event) return { ok: false, inserted: 0, suppressed: 0, duplicates: 0, error: "Storm event not found." };

  const event = detail.event;
  const scored = rowToScoredEvent(event);
  const contractorMode = options.coreContractorMode !== false;
  const requestedIndustries = options.industries?.length
    ? options.industries
    : contractorMode
      ? STORMREACH_CORE_CONTRACTOR_INDUSTRIES
      : detail.industryMatches.length
        ? detail.industryMatches.map((row) => String(row.industry)).filter(Boolean)
        : event.recommended_industries ?? [];
  const industries = stormReachAllowedStormOutreachIndustries(requestedIndustries);
  const limit = options.limit ?? 500;
  const radiusMiles = Math.min(
    options.radiusMiles ?? (contractorMode ? stormReachContractorSearchRadiusMiles() : searchRadiusForEvent(scored)),
    stormReachStormOutreachRadiusMiles(),
  );
  const placesResult = options.includeExternalProviders === false || !industries.length
    ? { prospects: [] as StormBusinessProspectInput[], warnings: [] as string[], providerConfigured: false, sourceUrl: "" }
    : await fetchGooglePlacesContractors({
      event: scored,
      industries,
      radiusMiles,
      limit: Math.max(limit, 240),
    });
  const [salesLeads, outreachProspects, businesses, suppressions, existing] = await Promise.all([
    queryRows<JsonRecord>("sales_leads", existingSalesLeadQuery(db, event.impacted_state, limit)),
    queryRows<JsonRecord>("outreach_prospects", db.from("outreach_prospects").select("id,business_name,campaign_name,contact_name,industry,phone,email,website,category,status,priority,notes,metadata,created_at,updated_at").limit(limit)),
    queryRows<JsonRecord>("businesses", db.from("businesses").select("id,name,email,phone,website,status,notes,created_at,updated_at").limit(Math.min(200, limit))),
    queryRows<StormSuppressionRecord>("outreach_suppression_list", db.from("outreach_suppression_list").select("contact_email,contact_phone,channel,reason,active").eq("active", true).limit(2000)),
    queryRows<JsonRecord>("storm_business_prospects.existing", db.from("storm_business_prospects").select("id,business_name,email,phone,city,state,category").eq("storm_event_id", event.id).limit(2000)),
  ]);

  const rawProspects: StormBusinessProspectInput[] = [
    ...placesResult.prospects,
    ...mapSalesLeads(salesLeads.data, industries, event.impacted_state),
    ...mapOutreachProspects(outreachProspects.data, industries),
    ...mapBusinesses(businesses.data, industries),
  ];
  const filtered = rawProspects.map((prospect) => attachProspectDistance(prospect, scored)).filter((prospect) => {
    if (prospect.state && event.impacted_state && String(prospect.state).toUpperCase() !== String(event.impacted_state).toUpperCase()) return false;
    if (!isWithinStormReachStormOutreachRadius(prospect.distanceToEvent)) return false;
    if (!industries.length) return false;
    return industries.some((industry) => industryMatchesCategory(industry, prospect.category));
  });
  const deduped = dedupeProspects(filtered);
  const suppressed = applySuppression(deduped.unique, suppressions.data);
  const insertableProspects = filterInsertableProspects(suppressed, existing.data, limit);
  const insertRows = insertableProspects.map((prospect) => prospectPayload(event.id, prospect, options.actor, scored, radiusMiles));

  let inserted = 0;
  if (insertRows.length) {
    const { data, error } = await db.from("storm_business_prospects").insert(insertRows).select("id,suppression_status");
    if (error) return { ok: false, inserted: 0, suppressed: 0, duplicates: deduped.duplicates.length, error: error.message };
    inserted = (data ?? []).length;
    const suppressedRows = ((data ?? []) as JsonRecord[]).filter((row) => row.suppression_status === "suppressed");
    if (suppressedRows.length) {
      await db.from("storm_suppression_matches").insert(suppressedRows.map((row) => ({
        storm_event_id: event.id,
        prospect_id: row.id,
        channel: "email",
        suppression_source: "outreach_suppression_list",
        reason: "Prospect matched suppression or prior opt-out.",
        active: true,
        metadata: { generated_by: "stormreach_prospecting" },
      })));
    }
  }

  await db.from("storm_events").update({ status: "prospecting", updated_at: new Date().toISOString() }).eq("id", event.id);
  await logStormActivity(db, {
    stormEventId: event.id,
    action: "prospects_generated",
    status: "prospecting",
    summary: `Generated ${inserted} StormReach ${industries.join("/")} prospects within the ${radiusMiles}-mile contractor search workflow.`,
    actor: options.actor,
    approvalStatus: "needs_review",
    details: {
      industries,
      search_radius_miles: radiusMiles,
      duplicates: deduped.duplicates.length,
      skipped_existing_or_batch_duplicates: suppressed.length - insertableProspects.length,
      suppressed: suppressed.filter((prospect) => prospect.suppressionStatus === "suppressed").length,
      sources: ["google_places", "serpapi_google_maps", "sales_leads", "outreach_prospects", "businesses", "outreach_suppression_list"],
      provider_warnings: placesResult.warnings,
      google_places_configured: placesResult.providerConfigured,
      future_provider_todos: ["Hunter.io", "Apollo"],
    },
  });
  await createAdminNotification(db, {
    title: "StormReach prospect list ready",
    body: `${inserted} review-ready prospects were attached to ${event.title}.`,
    severity: "info",
    relatedTable: "storm_events",
    relatedId: event.id,
    metadata: { inserted, suppressed: suppressed.filter((prospect) => prospect.suppressionStatus === "suppressed").length },
  });

  const providerSetupError = inserted === 0 ? prospectProviderSetupError(placesResult.warnings) : null;

  return {
    ok: !providerSetupError,
    inserted,
    suppressed: suppressed.filter((prospect) => prospect.suppressionStatus === "suppressed").length,
    duplicates: deduped.duplicates.length,
    providerWarnings: placesResult.warnings,
    searchRadiusMiles: radiusMiles,
    industries,
    error: providerSetupError,
  };
}

export async function draftOutreachForStormEvent(eventId: string, options: {
  supabase?: ServiceClient;
  actor?: StormReachActor;
  prospectIds?: string[];
  limit?: number;
  industries?: string[];
  includeMissingEmail?: boolean;
} = {}) {
  const db = asDb(options.supabase);
  const detail = await loadStormReachEventDetail(eventId, db);
  if (!detail.event) return { ok: false, drafted: 0, error: "Storm event not found." };
  const event = rowToScoredEvent(detail.event);
  const industries = stormReachAllowedStormOutreachIndustries(options.industries?.length ? options.industries : STORMREACH_CORE_CONTRACTOR_INDUSTRIES);
  const existingMessageProspectIds = new Set(detail.outreachMessages.map((row) => String(row.prospect_id ?? "")).filter(Boolean));
  const prospects = detail.prospects
    .filter((row) => !options.prospectIds?.length || options.prospectIds.includes(String(row.id)))
    .filter((row) => row.suppression_status !== "suppressed")
    .filter((row) => options.includeMissingEmail !== false || row.email)
    .filter((row) => !existingMessageProspectIds.has(String(row.id)))
    .filter((row) => isWithinStormReachStormOutreachRadius(row.distance_to_event))
    .filter((row) => industries.some((industry) => industryMatchesCategory(industry, String(row.category ?? ""))))
    .slice(0, options.limit ?? 100);

  if (!prospects.length) return { ok: true, drafted: 0, skippedExisting: existingMessageProspectIds.size, error: null };

  const campaignRowsByIndustry = new Map<string, JsonRecord>();
  for (const campaign of detail.outreachCampaigns) {
    const industry = String(campaign.industry ?? "");
    if (industry) campaignRowsByIndustry.set(industry.toLowerCase(), campaign);
  }
  const now = new Date().toISOString();
  const insertedMessages: JsonRecord[] = [];

  for (const [index, prospect] of prospects.entries()) {
    const industry = bestIndustry(String(prospect.category ?? ""), industries);
    let campaign = campaignRowsByIndustry.get(industry.toLowerCase());
    if (!campaign) {
      const draft = generateStormOutreachDraft({ event, prospect: prospect as Partial<StormBusinessProspectInput>, industry, sequence: index });
      const { data, error } = await db
        .from("storm_outreach_campaigns")
        .insert({
          storm_event_id: detail.event.id,
          industry,
          sender_key: draft.senderKey,
          campaign_name: `${event.title} - ${industry} contractor outreach`,
          status: "draft",
          approval_status: "needs_review",
          subject_base: draft.subject,
          human_approval_required: true,
          metadata: {
            source: "stormreach_outreach_generator",
            no_auto_send: true,
            policy: draft.riskNotes,
          },
          created_by: options.actor?.id ?? null,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();
      if (error) return { ok: false, drafted: insertedMessages.length, error: error.message };
      campaign = data as JsonRecord;
      campaignRowsByIndustry.set(industry.toLowerCase(), campaign);
    }

    const sequence = insertedMessages.length + existingMessageProspectIds.size;
    const variantKey = `storm-${sequence + 1}`;
    const draft = generateStormOutreachDraft({
      event,
      prospect: prospect as Partial<StormBusinessProspectInput>,
      industry,
      variantKey,
      sequence,
    });
    const { data, error } = await db
      .from("storm_outreach_messages")
      .insert({
        outreach_campaign_id: campaign.id,
        storm_event_id: detail.event.id,
        prospect_id: prospect.id,
        channel: "email",
        sender_key: draft.senderKey,
        recipient_email: prospect.email ?? null,
        recipient_phone: prospect.phone ?? null,
        subject: draft.subject,
        body: draft.body,
        variant_key: draft.variantKey,
        status: "draft",
        approval_status: "needs_review",
        suppression_status: prospect.email ? "clear" : "unknown",
        metadata: {
          personalization: draft.personalization,
          risk_notes: draft.riskNotes,
          generated_by: "stormreach_outreach_generator",
          contact_enrichment_required: !prospect.email,
          no_auto_send: true,
        },
        created_by: options.actor?.id ?? null,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();
    if (error) return { ok: false, drafted: insertedMessages.length, error: error.message };
    if (data) insertedMessages.push(data as JsonRecord);
  }

  await db.from("storm_events").update({ status: "outreach_ready", updated_at: now }).eq("id", detail.event.id);
  await syncApprovalLedgerPayloads(insertedMessages.map((message) => outreachLedgerPayload(message, detail.event!)), {
    actorId: options.actor?.id ?? null,
    actorLabel: options.actor?.label ?? "stormreach_outreach_generator",
    eventType: "stormreach_outreach_synced",
    syncSource: "stormreach",
  });
  await logStormActivity(db, {
    stormEventId: detail.event.id,
    action: "outreach_drafted",
    status: "outreach_ready",
    summary: `Drafted ${insertedMessages.length} varied approval-required StormReach emails for ${industries.join("/")} prospects.`,
    actor: options.actor,
    approvalStatus: "needs_review",
    details: {
      message_count: insertedMessages.length,
      skipped_existing_drafts: existingMessageProspectIds.size,
      industries,
      varied_copy: true,
      contact_enrichment_required: insertedMessages.filter((message) => !message.recipient_email).length,
      no_auto_send: true,
    },
  });
  await createAdminNotification(db, {
    title: "StormReach outreach ready for approval",
    body: `${insertedMessages.length} draft emails are ready for human review.`,
    severity: "info",
    relatedTable: "storm_events",
    relatedId: detail.event.id,
    metadata: { drafted: insertedMessages.length },
  });

  return { ok: true, drafted: insertedMessages.length, skippedExisting: existingMessageProspectIds.size, error: null };
}

export async function buildCampaignPackagesForStormEvent(eventId: string, options: {
  supabase?: ServiceClient;
  actor?: StormReachActor;
  industries?: string[];
} = {}) {
  const db = asDb(options.supabase);
  const detail = await loadStormReachEventDetail(eventId, db);
  if (!detail.event) return { ok: false, packages: 0, geofences: 0, postcards: 0, error: "Storm event not found." };
  const event = rowToScoredEvent(detail.event);
  const industries = stormReachAllowedStormOutreachIndustries(options.industries?.length
    ? options.industries
    : detail.industryMatches.length
      ? detail.industryMatches.map((row) => String(row.industry)).slice(0, 4)
      : detail.event.recommended_industries.slice(0, 4));
  const existingKeys = new Set(detail.packages.map((row) => `${String(row.industry).toLowerCase()}:${String(row.package_name).toLowerCase()}`));
  const now = new Date().toISOString();
  const insertedPackages: JsonRecord[] = [];
  const insertedGeofences: JsonRecord[] = [];
  const insertedPostcards: JsonRecord[] = [];

  for (const industry of industries) {
    for (const draft of buildStormMarketingPackages(event, industry)) {
      const key = `${industry.toLowerCase()}:${draft.packageName.toLowerCase()}`;
      if (existingKeys.has(key)) continue;
      const { data, error } = await db
        .from("storm_marketing_packages")
        .insert({
          storm_event_id: detail.event.id,
          industry,
          package_name: draft.packageName,
          package_type: draft.packageType,
          status: "draft",
          approval_status: "needs_review",
          client_approval_status: "not_sent",
          event_summary: draft.eventSummary,
          impacted_area_map: event.impactedPolygonGeojson ?? {},
          estimated_households: draft.estimatedHouseholds,
          recommended_geofence_radius_miles: draft.recommendedGeofenceRadiusMiles,
          recommended_postcard_quantity: draft.recommendedPostcardQuantity,
          suggested_timeline: draft.suggestedTimeline,
          suggested_budget_cents: draft.suggestedBudgetCents,
          estimated_price_to_client_cents: draft.estimatedPriceToClientCents,
          revenue_estimate_cents: draft.revenueEstimateCents,
          email_draft: draft.emailDraft,
          sms_draft: draft.smsDraft,
          landing_page_copy: draft.landingPageCopy,
          postcard_copy: draft.postcardCopy,
          ad_copy: draft.adCopy,
          proposal_token: createProposalToken(),
          human_approval_required: true,
          metadata: draft.metadata,
          created_by: options.actor?.id ?? null,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();
      if (error) return { ok: false, packages: insertedPackages.length, geofences: insertedGeofences.length, postcards: insertedPostcards.length, error: error.message };
      const packageRow = data as JsonRecord;
      insertedPackages.push(packageRow);

      const geofence = buildGeofenceExport(event, industry, String(packageRow.id));
      const { data: geofenceRow } = await db.from("storm_geofence_campaigns").insert({
        storm_event_id: detail.event.id,
        marketing_package_id: packageRow.id,
        industry,
        status: "draft",
        approval_status: "needs_review",
        polygon_geojson: geofence.polygonGeojson,
        selected_zip_codes: geofence.selectedZipCodes,
        radius_miles: geofence.radiusMiles,
        estimated_audience_size: geofence.estimatedAudienceSize,
        export_geojson: geofence.exportGeojson,
        export_zip_csv: geofence.exportZipCsv,
        campaign_brief: geofence.campaignBrief,
        external_platform_status: "not_started",
        human_approval_required: true,
        metadata: geofence.metadata,
        created_by: options.actor?.id ?? null,
        created_at: now,
        updated_at: now,
      }).select("*").single();
      if (geofenceRow) insertedGeofences.push(geofenceRow as JsonRecord);

      const postcard = buildPostcardDraft(event, industry, String(packageRow.id));
      const { data: postcardRow } = await db.from("storm_postcard_campaigns").insert({
        storm_event_id: detail.event.id,
        marketing_package_id: packageRow.id,
        industry,
        headline: postcard.headline,
        body: postcard.body,
        cta: postcard.cta,
        image_direction: postcard.imageDirection,
        mail_quantity: postcard.mailQuantity,
        estimated_print_postage_cost_cents: postcard.estimatedPrintPostageCostCents,
        estimated_price_to_client_cents: postcard.estimatedPriceToClientCents,
        campaign_timeline: postcard.campaignTimeline,
        status: "draft",
        approval_status: "needs_review",
        human_approval_required: true,
        metadata: postcard.metadata,
        created_by: options.actor?.id ?? null,
        created_at: now,
        updated_at: now,
      }).select("*").single();
      if (postcardRow) insertedPostcards.push(postcardRow as JsonRecord);
    }
  }

  await db.from("storm_events").update({ status: "campaign_ready", updated_at: now }).eq("id", detail.event.id);
  await syncApprovalLedgerPayloads(insertedPackages.map((row) => packageLedgerPayload(row, detail.event!)), {
    actorId: options.actor?.id ?? null,
    actorLabel: options.actor?.label ?? "stormreach_campaign_package_generator",
    eventType: "stormreach_package_synced",
    syncSource: "stormreach",
  });
  await logStormActivity(db, {
    stormEventId: detail.event.id,
    action: "campaign_packages_built",
    status: "campaign_ready",
    summary: `Built ${insertedPackages.length} StormReach campaign packages.`,
    actor: options.actor,
    approvalStatus: "needs_review",
    details: {
      package_count: insertedPackages.length,
      geofence_count: insertedGeofences.length,
      postcard_count: insertedPostcards.length,
      no_auto_launch: true,
      no_auto_charge: true,
    },
  });
  await createAdminNotification(db, {
    title: "StormReach campaign package ready",
    body: `${insertedPackages.length} geofence + postcard packages are ready for review.`,
    severity: "info",
    relatedTable: "storm_events",
    relatedId: detail.event.id,
    metadata: { packages: insertedPackages.length },
  });

  return {
    ok: true,
    packages: insertedPackages.length,
    geofences: insertedGeofences.length,
    postcards: insertedPostcards.length,
    error: null,
  };
}

export async function updateStormEventStatus(eventId: string, status: StormEventStatus, options: { supabase?: ServiceClient; actor?: StormReachActor } = {}) {
  const db = asDb(options.supabase);
  const detail = await loadStormReachEventDetail(eventId, db);
  if (!detail.event) return { ok: false, error: "Storm event not found." };
  const { error } = await db.from("storm_events").update({ status, updated_at: new Date().toISOString() }).eq("id", detail.event.id);
  if (error) return { ok: false, error: error.message };
  await logStormActivity(db, {
    stormEventId: detail.event.id,
    action: `event_${status}`,
    status,
    summary: `StormReach event marked ${status}.`,
    actor: options.actor,
    approvalStatus: status === "dismissed" || status === "archived" ? "not_required" : "needs_review",
    details: {},
  });
  return { ok: true, error: null };
}

export async function runStormReachStrategist(options: { supabase?: ServiceClient; actor?: StormReachActor; weekly?: boolean } = {}) {
  const db = asDb(options.supabase);
  const dashboard = await loadStormReachDashboard(db);
  const eventRows = dashboard.events.map((event) => rowToScoredEvent(event as StormEventRow));
  const prospectCounts = countBy(dashboard.prospects, "storm_event_id");
  const outreachCounts = countBy(dashboard.outreachMessages, "storm_event_id");
  const packageCounts = countBy(dashboard.packages, "storm_event_id");
  const recommendations = generateStormReachRecommendations({
    events: eventRows,
    prospectCountByEvent: remapCountsByEventId(dashboard.events, prospectCounts),
    outreachCountByEvent: remapCountsByEventId(dashboard.events, outreachCounts),
    packageCountByEvent: remapCountsByEventId(dashboard.events, packageCounts),
  });

  const existing = await queryRows<JsonRecord>("storm_agent_improvements.open", db.from("storm_agent_improvements").select("title,status").in("status", ["open", "needs_review"]).limit(500));
  const existingTitles = new Set(existing.data.map((row) => String(row.title).toLowerCase()));
  const insertRows = recommendations
    .filter((item) => !existingTitles.has(item.title.toLowerCase()))
    .map((item) => {
      const row = dashboard.events.find((event) => event.event_id === item.stormEventId);
      return {
        storm_event_id: row?.id ?? null,
        recommendation_type: item.recommendationType,
        title: item.title,
        description: item.description,
        priority: item.priority,
        status: "open",
        source: "stormreach_strategist",
        confidence_score: item.confidenceScore,
        approval_status: "needs_review",
        recommended_by: "StormReach Strategist",
        metadata: item.metadata,
        created_by: options.actor?.id ?? null,
      };
    });

  if (insertRows.length) {
    await db.from("storm_agent_improvements").insert(insertRows);
  }

  const report = buildDailyStormReachReport(eventRows);
  const { data: output } = await db.from("ai_outputs").insert({
    title: options.weekly ? "StormReach Weekly Strategy Report" : "StormReach Daily Opportunity Report",
    agent_name: "StormReach Strategist",
    workflow: options.weekly ? "stormreach_weekly_strategy" : "stormreach_daily_opportunity",
    output_type: options.weekly ? "strategy_report" : "opportunity_report",
    content: report,
    data_sources: ["storm_events", "storm_business_prospects", "storm_marketing_packages", "storm_agent_improvements"],
    prompt_sop_name: "StormReach Campaign Package QA",
    approval_status: "needs_review",
    verification_status: "pending",
    status: "active",
    notes: "Generated recommendation report. Does not launch, send, price, or charge.",
    metadata: {
      source: "stormreach_strategist",
      weekly: Boolean(options.weekly),
      recommendation_count: recommendations.length,
      human_approval_required: true,
    },
    owner_user_id: options.actor?.id ?? null,
  }).select("id").single();

  await db.from("ai_workforce_tasks").upsert({
    task_id: options.weekly ? "STORMREACH-WEEKLY-STRATEGY" : "STORMREACH-DAILY-OPPORTUNITY",
    workflow_name: options.weekly ? "StormReach Weekly Strategy" : "StormReach Daily Opportunity",
    requestor: "StormReach Strategist",
    assigned_agent: "StormReach Strategist",
    priority: dashboard.metrics.highOrExtremeEvents > 0 ? "high" : "medium",
    status: "awaiting_approval",
    input_path: "/admin/stormreach",
    input_data: {
      metrics: dashboard.metrics,
      recommendation_count: recommendations.length,
    },
    expected_output: "Review StormReach opportunities, recommendations, and data quality warnings.",
    dependencies: ["AGENTS.md approval gates", "AI Assets", "Weather provider source attribution"],
    approval_required: true,
    related_opportunity: "stormreach",
    output_id: output?.id ?? null,
    owner_user_id: options.actor?.id ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "task_id" });

  if (insertRows.some((row) => row.priority === "critical" || row.priority === "high")) {
    await createAdminNotification(db, {
      title: "StormReach Strategist recommends review",
      body: `${insertRows.length} new StormReach recommendations were created.`,
      severity: "warning",
      relatedTable: "storm_agent_improvements",
      relatedId: "stormreach_strategist",
      metadata: { recommendations: insertRows.length },
    });
  }

  return {
    ok: true,
    recommendations: recommendations.length,
    inserted: insertRows.length,
    outputId: output?.id ?? null,
    report,
  };
}

export async function runStormReachContinuousSweep(options: {
  supabase?: ServiceClient;
  actor?: StormReachActor;
  lookbackHours?: number;
  eventLimit?: number;
  prospectLimit?: number;
  emailLimit?: number;
  now?: Date;
} = {}) {
  const db = asDb(options.supabase);
  const actor = options.actor ?? { label: "stormreach_continuous_sweep" };
  const lookbackHours = options.lookbackHours ?? stormReachLookbackHours();
  const radiusMiles = stormReachContractorSearchRadiusMiles();
  const ingest = await ingestStormReachEvents({ supabase: db, actor, limit: 250, now: options.now });
  const dashboard = await loadStormReachDashboard(db);
  const events = dashboard.events
    .filter((event) => !["archived", "dismissed"].includes(event.status))
    .filter((event) => isRecentStormEvent(event, lookbackHours, options.now ?? new Date()))
    .slice(0, options.eventLimit ?? 20);

  const eventResults = [];
  for (const event of events) {
    const prospects = await generateProspectsForStormEvent(event.id, {
      supabase: db,
      actor,
      industries: STORMREACH_CORE_CONTRACTOR_INDUSTRIES,
      radiusMiles,
      limit: options.prospectLimit ?? 1000,
      includeExternalProviders: true,
      coreContractorMode: true,
    });
    const outreach = await draftOutreachForStormEvent(event.id, {
      supabase: db,
      actor,
      industries: STORMREACH_CORE_CONTRACTOR_INDUSTRIES,
      limit: options.emailLimit ?? 1000,
      includeMissingEmail: true,
    });
    eventResults.push({ eventId: event.id, title: event.title, prospects, outreach });
  }

  const recentHighValue = events.some((event) => event.severity_level === "High" || event.severity_level === "Extreme");
  const strategist = recentHighValue
    ? await runStormReachStrategist({ supabase: db, actor })
    : null;

  await db.from("storm_provider_runs").insert({
    provider_key: "stormreach_continuous_sweep",
    run_type: "last_24h_contractor_sweep",
    status: eventResults.every((result) => result.prospects.ok && result.outreach.ok) ? "completed" : "warning",
    events_seen: events.length,
    events_upserted: eventResults.reduce((sum, result) => sum + Number(result.prospects.inserted ?? 0), 0),
    errors: eventResults.flatMap((result) => [result.prospects.error, result.outreach.error].filter(Boolean)),
    metadata: {
      lookback_hours: lookbackHours,
      contractor_search_radius_miles: radiusMiles,
      industries: STORMREACH_CORE_CONTRACTOR_INDUSTRIES,
      emails_are_drafts_only: true,
      human_approval_required: true,
      ingest_events_seen: ingest.eventsSeen,
      ingest_events_upserted: ingest.eventsUpserted,
    },
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  return {
    ok: ingest.ok && eventResults.every((result) => result.prospects.ok && result.outreach.ok),
    job: "continuous_sweep",
    lookbackHours,
    contractorSearchRadiusMiles: radiusMiles,
    industries: STORMREACH_CORE_CONTRACTOR_INDUSTRIES,
    ingest,
    eventsProcessed: events.length,
    prospectsInserted: eventResults.reduce((sum, result) => sum + Number(result.prospects.inserted ?? 0), 0),
    emailsDrafted: eventResults.reduce((sum, result) => sum + Number(result.outreach.drafted ?? 0), 0),
    eventResults,
    strategist,
  };
}

export async function runStormReachScheduledJob(job: StormReachScheduledJob, options: { supabase?: ServiceClient } = {}) {
  const db = asDb(options.supabase);
  if (job === "fifteen_minute") {
    return runStormReachContinuousSweep({
      supabase: db,
      actor: { label: "stormreach_15_minute_cron" },
      eventLimit: positiveInteger(process.env.STORMREACH_15_MINUTE_EVENT_LIMIT, 12),
      prospectLimit: positiveInteger(process.env.STORMREACH_MAX_PROSPECTS_PER_RUN, 500),
      emailLimit: positiveInteger(process.env.STORMREACH_MAX_DRAFTS_PER_RUN, 500),
    });
  }

  if (job === "hourly") {
    return runStormReachContinuousSweep({ supabase: db, actor: { label: "stormreach_cron" } });
  }

  if (job === "three_hour") {
    const dashboard = await loadStormReachDashboard(db);
    const events = dashboard.events.filter((event) => ["High", "Extreme"].includes(event.severity_level) && !["archived", "dismissed"].includes(event.status) && isRecentStormEvent(event));
    const results = [];
    for (const event of events.slice(0, 10)) {
      const prospects = await generateProspectsForStormEvent(event.id, {
        supabase: db,
        actor: { label: "stormreach_cron" },
        limit: 500,
        industries: STORMREACH_CORE_CONTRACTOR_INDUSTRIES,
        radiusMiles: stormReachContractorSearchRadiusMiles(),
        coreContractorMode: true,
      });
      const outreach = await draftOutreachForStormEvent(event.id, {
        supabase: db,
        actor: { label: "stormreach_cron" },
        industries: STORMREACH_CORE_CONTRACTOR_INDUSTRIES,
        limit: 500,
        includeMissingEmail: true,
      });
      results.push({ eventId: event.id, prospects, outreach });
    }
    return { ok: results.every((result) => result.prospects.ok && result.outreach.ok), job, events: events.length, results };
  }

  if (job === "daily") {
    const strategist = await runStormReachStrategist({ supabase: db, actor: { label: "stormreach_cron" } });
    await db
      .from("storm_events")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("severity_level", "Low")
      .lt("detected_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .not("status", "in", "(archived,dismissed)");
    return { ok: true, job, strategist };
  }

  const strategist = await runStormReachStrategist({ supabase: db, actor: { label: "stormreach_cron" }, weekly: true });
  return { ok: true, job, strategist };
}

export async function loadStormReachProposal(token: string, supabase?: ServiceClient) {
  const db = asDb(supabase);
  const packageResult = await querySingle<JsonRecord>("storm_marketing_packages.proposal", db.from("storm_marketing_packages").select("*").eq("proposal_token", token).maybeSingle());
  if (!packageResult.data) return { package: null, event: null, error: packageResult.error };
  const eventResult = await querySingle<StormEventRow>("storm_events.proposal", db.from("storm_events").select("*").eq("id", packageResult.data.storm_event_id).maybeSingle());
  return { package: packageResult.data, event: eventResult.data, error: packageResult.error ?? eventResult.error };
}

export async function markStormReachProposalRequested(token: string, options: { supabase?: ServiceClient; note?: string } = {}) {
  const db = asDb(options.supabase);
  const proposal = await loadStormReachProposal(token, db);
  if (!proposal.package) return { ok: false, error: "Proposal not found." };
  const { error } = await db
    .from("storm_marketing_packages")
    .update({
      client_approval_status: "client_requested_approval",
      status: "proposal_sent",
      updated_at: new Date().toISOString(),
      metadata: {
        ...(asObject(proposal.package.metadata)),
        client_request_note: options.note ?? null,
        external_action_performed: false,
      },
    })
    .eq("id", proposal.package.id);
  if (error) return { ok: false, error: error.message };
  await createAdminNotification(db, {
    title: "StormReach proposal response",
    body: `${String(proposal.package.package_name)} was marked as client-requested approval. Human follow-up is required.`,
    severity: "success",
    relatedTable: "storm_marketing_packages",
    relatedId: String(proposal.package.id),
    metadata: { proposal_token: token },
  });
  return { ok: true, error: null };
}

function asDb(supabase?: ServiceClient): Db {
  return (supabase ?? createServiceClient()) as Db;
}

async function queryRows<T>(label: string, query: PromiseLike<{ data: T[] | null; error: { message?: string; code?: string } | null }>): Promise<QueryResult<T>> {
  try {
    const { data, error } = await query;
    if (error) return { data: [], error: `${label}: ${error.message ?? error.code ?? "query failed"}` };
    return { data: data ?? [], error: null };
  } catch (error) {
    return { data: [], error: `${label}: ${error instanceof Error ? error.message : "query failed"}` };
  }
}

async function querySingle<T>(label: string, query: PromiseLike<{ data: T | null; error: { message?: string; code?: string } | null }>) {
  try {
    const { data, error } = await query;
    if (error && !/no rows|multiple rows/i.test(error.message ?? "")) return { data: null, error: `${label}: ${error.message ?? error.code ?? "query failed"}` };
    return { data: data ?? null, error: null };
  } catch (error) {
    return { data: null, error: `${label}: ${error instanceof Error ? error.message : "query failed"}` };
  }
}

function isMissingOptionalStormReachTable(error: string) {
  return /storm_generated_assets|storm_agent_runs|storm_campaigns/i.test(error)
    && /schema cache|does not exist|could not find the table/i.test(error);
}

function estimateHouseholds(event: NormalizedStormEvent): NormalizedStormEvent {
  const currentHouseholds = Number(event.estimatedHouseholds ?? 0);
  if (currentHouseholds > 0) return event;
  const zipEstimate = event.impactedZipCodes.length * 3800;
  const cityEstimate = event.impactedCities.length * 14000;
  const countyEstimate = event.impactedCounties.length * 55000;
  const pointEstimate = event.geographyType === "point_report" ? 5000 : 0;
  const households = Math.max(zipEstimate, cityEstimate, countyEstimate, pointEstimate, 1500);
  return {
    ...event,
    estimatedHouseholds: households,
    estimatedHomeowners: Math.round(households * 0.64),
    metadata: {
      ...(event.metadata ?? {}),
      household_estimate_method: "stormreach_geography_proxy",
    },
  };
}

function eventPayload(event: ScoredStormEvent, industries: string[], actor?: StormReachActor) {
  return {
    event_id: event.eventId,
    event_type: event.eventType,
    source: event.source,
    source_url: event.sourceUrl ?? null,
    title: event.title,
    description: event.description,
    start_time: event.startTime ?? null,
    end_time: event.endTime ?? null,
    detected_at: event.detectedAt,
    severity_score: event.severityScore,
    severity_level: event.severityLevel,
    confidence_score: event.confidenceScore,
    geography_type: event.geographyType,
    impacted_polygon_geojson: event.impactedPolygonGeojson ?? {},
    impacted_counties: event.impactedCounties,
    impacted_cities: event.impactedCities,
    impacted_zip_codes: event.impactedZipCodes,
    impacted_state: event.impactedState ?? null,
    estimated_households: event.estimatedHouseholds ?? 0,
    estimated_homeowners: event.estimatedHomeowners ?? 0,
    recommended_industries: industries,
    recommended_campaigns: recommendedCampaigns(event, industries),
    status: "scored",
    approval_status: "needs_review",
    source_payload: event.sourcePayload ?? {},
    scoring_factors: event.scoringFactors,
    metadata: {
      ...(event.metadata ?? {}),
      hazard_metrics: event.hazardMetrics ?? {},
      no_auto_send: true,
      no_auto_launch: true,
      no_auto_charge: true,
    },
    created_by: actor?.id ?? null,
    updated_at: new Date().toISOString(),
  };
}

function recommendedCampaigns(event: ScoredStormEvent, industries: string[]) {
  const area = impactedAreaLabel(event);
  return industries.slice(0, 6).map((industry) => ({
    industry,
    campaign_type: "combined_geofence_postcard",
    area,
    estimated_households: event.estimatedHouseholds ?? 0,
    projected_revenue_cents: estimateCampaignRevenueCents({ ...event, recommendedIndustries: industries } as ScoredStormEvent, 1),
    approval_required: true,
  }));
}

async function syncEventChildren(db: Db, row: StormEventRow, event: ScoredStormEvent, matches: ReturnType<typeof matchIndustriesForEvent>, actor?: StormReachActor) {
  await db.from("storm_event_geographies").delete().eq("storm_event_id", row.id);
  const geographyRows = [
    ...event.impactedCounties.map((county) => ({
      storm_event_id: row.id,
      geography_type: "county",
      label: county,
      state: event.impactedState ?? null,
      county,
      polygon_geojson: {},
      estimated_households: Math.round((event.estimatedHouseholds ?? 0) / Math.max(1, event.impactedCounties.length || event.impactedCities.length || 1)),
      estimated_homeowners: Math.round((event.estimatedHomeowners ?? 0) / Math.max(1, event.impactedCounties.length || event.impactedCities.length || 1)),
      metadata: { source_event_id: event.eventId },
    })),
    ...event.impactedCities.map((city) => ({
      storm_event_id: row.id,
      geography_type: "city",
      label: city,
      state: event.impactedState ?? null,
      city,
      polygon_geojson: {},
      estimated_households: Math.round((event.estimatedHouseholds ?? 0) / Math.max(1, event.impactedCities.length || 1)),
      estimated_homeowners: Math.round((event.estimatedHomeowners ?? 0) / Math.max(1, event.impactedCities.length || 1)),
      metadata: { source_event_id: event.eventId },
    })),
  ];
  if (geographyRows.length) await db.from("storm_event_geographies").insert(geographyRows);

  if (event.impactedZipCodes.length) {
    await db.from("storm_event_zip_codes").upsert(event.impactedZipCodes.map((zipCode) => ({
      storm_event_id: row.id,
      zip_code: zipCode,
      state: event.impactedState ?? null,
      estimated_households: Math.round((event.estimatedHouseholds ?? 0) / Math.max(1, event.impactedZipCodes.length)),
      estimated_homeowners: Math.round((event.estimatedHomeowners ?? 0) / Math.max(1, event.impactedZipCodes.length)),
      damage_likelihood_score: Math.min(100, event.severityScore + 6),
      metadata: { source_event_id: event.eventId },
    })), { onConflict: "storm_event_id,zip_code" });
  }

  await db.from("storm_event_industry_matches").upsert(matches.map((match) => ({
    storm_event_id: row.id,
    industry: match.industry,
    match_score: match.matchScore,
    reason: match.reason,
    admin_override: Boolean(match.adminOverride),
    status: "recommended",
    metadata: { generated_by: "stormreach_industry_matching" },
    created_by: actor?.id ?? null,
  })), { onConflict: "storm_event_id,industry" });
}

function existingSalesLeadQuery(db: Db, state: string | null, limit: number) {
  let query = db
    .from("sales_leads")
    .select("id,business_name,contact_name,email,phone,website,city,state,category,status,score,priority,buying_signal,do_not_contact,sms_opt_out,email_status,notes,created_at,updated_at")
    .eq("do_not_contact", false)
    .limit(limit);
  if (state) query = query.eq("state", state);
  return query;
}

function mapSalesLeads(rows: JsonRecord[], industries: string[], state: string | null): StormBusinessProspectInput[] {
  return rows
    .filter((row) => !row.do_not_contact)
    .map((row) => ({
      sourceSalesLeadId: String(row.id),
      businessName: String(row.business_name ?? "Unnamed business"),
      ownerName: asNullableString(row.contact_name),
      email: asNullableString(row.email),
      phone: asNullableString(row.phone),
      website: asNullableString(row.website),
      city: asNullableString(row.city),
      state: asNullableString(row.state) ?? state,
      category: bestIndustry(String(row.category ?? ""), industries),
      source: "sales_leads",
      confidenceScore: Math.min(95, numberValue(row.score, 45) + (row.email ? 15 : 0) + (row.buying_signal ? 10 : 0)),
      priorContactStatus: asNullableString(row.status),
      crmStatus: String(row.status ?? "new"),
      notes: asNullableString(row.notes),
      metadata: {
        email_status: row.email_status ?? null,
        priority: row.priority ?? null,
        source: "sales_leads",
      },
    }));
}

function mapOutreachProspects(rows: JsonRecord[], industries: string[]): StormBusinessProspectInput[] {
  return rows.map((row) => ({
    sourceOutreachProspectId: String(row.id),
    businessName: String(row.business_name ?? row.campaign_name ?? "Unnamed prospect"),
    ownerName: asNullableString(row.contact_name),
    email: asNullableString(row.email),
    phone: asNullableString(row.phone),
    website: asNullableString(row.website),
    category: bestIndustry(String(row.industry ?? row.category ?? ""), industries),
    source: "outreach_prospects",
    confidenceScore: String(row.priority) === "urgent" ? 82 : String(row.priority) === "high" ? 74 : 58,
    priorContactStatus: asNullableString(row.status),
    crmStatus: String(row.status ?? "available"),
    notes: asNullableString(row.notes),
    metadata: {
      priority: row.priority ?? null,
      source: "outreach_prospects",
      original_category: row.category ?? null,
      metadata: asObject(row.metadata),
    },
  }));
}

function mapBusinesses(rows: JsonRecord[], industries: string[]): StormBusinessProspectInput[] {
  return rows.map((row) => ({
    sourceBusinessId: String(row.id),
    businessName: String(row.name ?? "Unnamed business"),
    email: asNullableString(row.email),
    phone: asNullableString(row.phone),
    website: asNullableString(row.website),
    category: industries[0] ?? "Home service",
    source: "businesses",
    confidenceScore: row.email ? 66 : 52,
    crmStatus: String(row.status ?? "active"),
    notes: asNullableString(row.notes),
    metadata: {
      source: "businesses",
    },
  }));
}

function bestIndustry(category: string, industries: string[]) {
  return (industries.find((industry) => industryMatchesCategory(industry, category)) ?? category) || industries[0] || "Home service";
}

function prospectPayload(eventUuid: string, prospect: StormBusinessProspectInput, actor: StormReachActor | undefined, event: ScoredStormEvent, radiusMiles?: number) {
  return {
    storm_event_id: eventUuid,
    source_business_id: prospect.sourceBusinessId ?? null,
    source_sales_lead_id: prospect.sourceSalesLeadId ?? null,
    source_outreach_prospect_id: prospect.sourceOutreachProspectId ?? null,
    business_name: prospect.businessName,
    owner_name: prospect.ownerName ?? null,
    email: prospect.email ?? null,
    phone: prospect.phone ?? null,
    website: prospect.website ?? null,
    city: prospect.city ?? null,
    state: prospect.state ?? event.impactedState ?? null,
    category: prospect.category,
    source: prospect.source,
    confidence_score: prospect.confidenceScore ?? 50,
    distance_to_event: prospect.distanceToEvent ?? null,
    prior_contact_status: prospect.priorContactStatus ?? null,
    crm_status: prospect.crmStatus ?? "new",
    suppression_status: prospect.suppressionStatus ?? "unchecked",
    notes: prospect.notes ?? null,
    metadata: {
      ...(prospect.metadata ?? {}),
      search_radius_miles: radiusMiles ?? searchRadiusForEvent(event),
      radius_verified: typeof prospect.distanceToEvent === "number",
      no_auto_send: true,
    },
    created_by: actor?.id ?? null,
  };
}

function filterInsertableProspects(
  prospects: StormBusinessProspectInput[],
  existingRows: JsonRecord[],
  limit: number,
) {
  const seenEmails = new Set(existingRows.map((row) => normalizeEmail(asNullableString(row.email))).filter(Boolean));
  const seenPhones = new Set(existingRows.map((row) => normalizePhone(asNullableString(row.phone))).filter(Boolean));
  const seenNames = new Set(existingRows.map((row) => prospectNameKey({
    businessName: asNullableString(row.business_name) ?? "",
    city: asNullableString(row.city),
    state: asNullableString(row.state),
  })).filter(Boolean));
  const insertable: StormBusinessProspectInput[] = [];

  for (const prospect of prospects) {
    const email = normalizeEmail(prospect.email);
    const phone = normalizePhone(prospect.phone);
    const name = prospectNameKey(prospect);

    if (email && seenEmails.has(email)) continue;
    if (phone && seenPhones.has(phone)) continue;
    if (!email && !phone && name && seenNames.has(name)) continue;

    if (email) seenEmails.add(email);
    if (phone) seenPhones.add(phone);
    if (!email && !phone && name) seenNames.add(name);

    insertable.push(prospect);
    if (insertable.length >= limit) break;
  }

  return insertable;
}

function prospectProviderSetupError(warnings: string[]) {
  const missingSerpApiKey = warnings.some((warning) => warning.includes("SerpAPI contractor search needs"));
  if (missingSerpApiKey) {
    return "StormReach could not generate new prospects because SerpAPI is enabled but no SerpAPI key is configured. Add STORMREACH_SERPAPI_KEY, SERPAPI_KEY, SERP_API, or SERPAPI_API_KEY, then rerun Generate Prospects.";
  }
  const serpApiDisabled = warnings.some((warning) => warning.includes("SerpAPI contractor search is disabled"));
  if (serpApiDisabled) {
    return "StormReach could not generate new prospects because SerpAPI is disabled. Set STORMREACH_ENABLE_SERPAPI=true, then rerun Generate Prospects.";
  }
  return null;
}

function attachProspectDistance(prospect: StormBusinessProspectInput, event: ScoredStormEvent): StormBusinessProspectInput {
  if (typeof prospect.distanceToEvent === "number") return prospect;
  const eventPoint = eventCentroid(event);
  const prospectCity = normalizeBusinessName(prospect.city);
  const stateMatches = !prospect.state || !event.impactedState || String(prospect.state).toUpperCase() === String(event.impactedState).toUpperCase();
  if (prospectCity && stateMatches && event.impactedCities.some((city) => normalizeBusinessName(city) === prospectCity)) {
    return {
      ...prospect,
      distanceToEvent: 0,
      metadata: {
        ...(prospect.metadata ?? {}),
        distance_estimate_source: "impacted_city_match",
      },
    };
  }
  const lat = numberValue(prospect.metadata?.latitude, Number.NaN);
  const lng = numberValue(prospect.metadata?.longitude, Number.NaN);
  if (!eventPoint || !Number.isFinite(lat) || !Number.isFinite(lng)) return prospect;
  return {
    ...prospect,
    distanceToEvent: Number(distanceMiles(eventPoint, [lng, lat]).toFixed(2)),
  };
}

function prospectNameKey(prospect: Pick<StormBusinessProspectInput, "businessName" | "city" | "state">) {
  const name = normalizeBusinessName(prospect.businessName);
  if (!name) return "";
  return `name:${name}:${String(prospect.city ?? "").trim().toLowerCase()}:${String(prospect.state ?? "").trim().toLowerCase()}`;
}

function rowToScoredEvent(row: StormEventRow): ScoredStormEvent & { recommendedIndustries?: string[] } {
  return {
    eventId: row.event_id,
    eventType: row.event_type,
    source: row.source,
    sourceUrl: row.source_url,
    title: row.title,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    detectedAt: row.detected_at,
    geographyType: row.geography_type,
    impactedPolygonGeojson: row.impacted_polygon_geojson ?? {},
    impactedCounties: row.impacted_counties ?? [],
    impactedCities: row.impacted_cities ?? [],
    impactedZipCodes: row.impacted_zip_codes ?? [],
    impactedState: row.impacted_state,
    estimatedHouseholds: row.estimated_households,
    estimatedHomeowners: row.estimated_homeowners,
    confidenceScore: row.confidence_score,
    sourcePayload: row.source_payload ?? {},
    hazardMetrics: asObject(row.metadata)?.hazard_metrics as ScoredStormEvent["hazardMetrics"],
    metadata: asObject(row.metadata),
    severityScore: row.severity_score,
    severityLevel: row.severity_level,
    scoringFactors: asObject(row.scoring_factors) as Record<string, string | number | null>,
    recommendedIndustries: row.recommended_industries ?? [],
  };
}

async function logStormActivity(db: Db, input: {
  stormEventId?: string | null;
  relatedTable?: string | null;
  relatedId?: string | null;
  actor?: StormReachActor;
  action: string;
  status: string;
  summary: string;
  details: JsonRecord;
  approvalStatus: string;
}) {
  await db.from("storm_audit_logs").insert({
    storm_event_id: input.stormEventId ?? null,
    related_table: input.relatedTable ?? null,
    related_id: input.relatedId ?? null,
    actor_user_id: input.actor?.id ?? null,
    actor_label: input.actor?.label ?? input.actor?.email ?? "system",
    action: input.action,
    status: input.status,
    summary: input.summary,
    details: input.details,
    approval_status: input.approvalStatus,
  });

  await db.from("ai_workforce_activity_logs").insert({
    task_public_id: input.stormEventId ? `STORM-${input.stormEventId}` : "STORMREACH",
    agent_name: "StormReach Strategist",
    event_type: input.action,
    status: input.status,
    summary: input.summary,
    details: input.details,
    approval_status: input.approvalStatus === "approved" ? "approved" : input.approvalStatus === "not_required" ? "not_required" : "needs_review",
    created_by: input.actor?.id ?? null,
  });
}

async function mirrorEventToWorkforce(db: Db, row: StormEventRow, actor?: StormReachActor) {
  await db.from("ai_workforce_tasks").upsert({
    task_id: `STORM-${row.id}`,
    workflow_name: "StormReach Event Review",
    requestor: "StormReach",
    assigned_agent: "StormReach Strategist",
    priority: row.severity_level === "Extreme" ? "critical" : row.severity_level === "High" ? "high" : "medium",
    status: "awaiting_approval",
    input_path: `/admin/stormreach/${row.id}`,
    input_data: {
      event_id: row.event_id,
      event_type: row.event_type,
      source: row.source,
      source_url: row.source_url,
      severity_score: row.severity_score,
      confidence_score: row.confidence_score,
      recommended_industries: row.recommended_industries,
    },
    expected_output: "Review event, approve prospecting/outreach/package actions, and preserve source attribution.",
    dependencies: ["Weather provider source", "AI Assets approval checks", "Suppression list"],
    approval_required: true,
    related_opportunity: row.event_id,
    owner_user_id: actor?.id ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "task_id" });
}

async function createAdminNotification(db: Db, input: {
  title: string;
  body: string;
  severity: "info" | "success" | "warning" | "critical";
  relatedTable: string;
  relatedId: string;
  metadata?: JsonRecord;
}) {
  await db.from("notifications").insert({
    channel: "in_app",
    severity: input.severity,
    title: input.title,
    body: input.body,
    status: "queued",
    related_table: input.relatedTable,
    related_id: input.relatedId,
    metadata_json: {
      source: "stormreach",
      ...(input.metadata ?? {}),
    },
  });
}

function outreachLedgerPayload(message: JsonRecord, event: StormEventRow): ApprovalLedgerPayload {
  return {
    source_key: `storm_outreach_messages:${message.id}:stormreach_outreach_email`,
    source_system: "stormreach",
    source_table: "storm_outreach_messages",
    source_id: String(message.id),
    source_href: `/admin/stormreach/${event.id}`,
    domain: "revenue",
    approval_kind: "stormreach_outbound_message",
    title: String(message.subject ?? "StormReach outreach draft"),
    detail: String(message.body ?? "").slice(0, 500),
    source_status: String(message.status ?? "draft"),
    approval_state: "needs_review",
    lane: "needs_approval",
    priority: event.severity_level === "Extreme" ? "critical" : event.severity_level === "High" ? "high" : "normal",
    approval_required: true,
    human_approval_required: true,
    sensitive_action: true,
    channel: "email",
    next_action: "Approve, revise, or reject before any outbound email send. Sending remains disabled by default.",
    guardrail: "StormReach outreach cannot be sent until suppression checks and human approval are complete.",
    policy_flags: ["can_spam_review", "no_damage_guarantee", "no_insurance_claim_guarantee", "suppression_required"],
    compliance_notes: "Marketing email requires unsubscribe handling and suppression-list enforcement before send.",
    action_target: { kind: "link_only", id: String(message.id), status: String(message.status ?? "draft") },
    evidence: { storm_event_id: event.id, event_source: event.source, event_source_url: event.source_url },
    metadata: { source_label: "StormReach", no_auto_send: true },
    source_created_at: asNullableString(message.created_at),
    source_updated_at: asNullableString(message.updated_at) ?? asNullableString(message.created_at),
    updated_at: new Date().toISOString(),
  };
}

function packageLedgerPayload(packageRow: JsonRecord, event: StormEventRow): ApprovalLedgerPayload {
  return {
    source_key: `storm_marketing_packages:${packageRow.id}:stormreach_campaign_package`,
    source_system: "stormreach",
    source_table: "storm_marketing_packages",
    source_id: String(packageRow.id),
    source_href: `/admin/stormreach/${event.id}`,
    domain: "campaigns",
    approval_kind: "stormreach_campaign_package",
    title: String(packageRow.package_name ?? "StormReach campaign package"),
    detail: String(packageRow.event_summary ?? ""),
    source_status: String(packageRow.status ?? "draft"),
    approval_state: "needs_review",
    lane: "needs_approval",
    priority: event.severity_level === "Extreme" ? "critical" : event.severity_level === "High" ? "high" : "normal",
    approval_required: true,
    human_approval_required: true,
    sensitive_action: true,
    next_action: "Review package, pricing, map, postcard copy, and geofence export before proposal or launch work.",
    guardrail: "Package approval does not launch ads, order postcards, charge customers, or change pricing.",
    policy_flags: ["no_auto_launch", "no_auto_charge", "pricing_review_required", "postcard_approval_required"],
    compliance_notes: "Claims must remain factual and storm-source-backed.",
    action_target: { kind: "link_only", id: String(packageRow.id), status: String(packageRow.status ?? "draft") },
    evidence: { storm_event_id: event.id, event_source: event.source, event_source_url: event.source_url },
    metadata: { source_label: "StormReach", proposal_token: packageRow.proposal_token ?? null },
    source_created_at: asNullableString(packageRow.created_at),
    source_updated_at: asNullableString(packageRow.updated_at) ?? asNullableString(packageRow.created_at),
    updated_at: new Date().toISOString(),
  };
}

function countBy(rows: JsonRecord[], key: string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = String(row[key] ?? "");
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function remapCountsByEventId(events: StormDashboardEvent[], countsByUuid: Map<string, number>) {
  const mapped = new Map<string, number>();
  for (const event of events) mapped.set(event.event_id, countsByUuid.get(event.id) ?? 0);
  return mapped;
}

function numberValue(value: unknown, fallback = 0) {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : fallback;
}

function positiveInteger(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function asNullableString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function asObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
