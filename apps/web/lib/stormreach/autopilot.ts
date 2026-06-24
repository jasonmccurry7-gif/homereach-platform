import "server-only";

import { syncApprovalLedgerPayloads, type ApprovalLedgerPayload } from "@/lib/approvals/ledger";
import { createServiceClient } from "@/lib/supabase/service";
import {
  buildStormAutopilotImpactPlan,
  buildStormOpportunityAssetSpecs,
  buildStormReachAutopilotDraft,
  classifyStormReachAutopilotOpportunity,
  isStormReachAutopilotCandidate,
  recommendStormReachAutopilotServices,
  STORMREACH_AUTOPILOT_AGENT_NAME,
  STORMREACH_AUTOPILOT_SERVICE_CATEGORIES,
  type AutopilotChannel,
} from "./autopilot-core";
import { createOverdriveCampaignPackagesForStormEvent } from "./overdrive";
import {
  industryMatchesCategory,
  isWithinStormReachStormOutreachRadius,
  stormReachAllowedStormOutreachIndustries,
  stormReachStormOutreachRadiusMiles,
} from "./prospecting";
import {
  generateProspectsForStormEvent,
  ingestStormReachEvents,
  loadStormReachDashboard,
  loadStormReachEventDetail,
  type StormReachActor,
} from "./repository";
import type { ScoredStormEvent, StormBusinessProspectInput, StormDashboardEvent } from "./types";

type ServiceClient = ReturnType<typeof createServiceClient>;
type Db = ServiceClient;
type JsonRecord = Record<string, unknown>;

export function stormReachAutopilotState() {
  return String(process.env.STORMREACH_AUTOPILOT_STATE || process.env.STORMREACH_DEFAULT_STATE || "OH").trim().toUpperCase();
}

export function stormReachAutopilotRunnerEnabled() {
  return String(process.env.STORMREACH_AUTOPILOT_RUNNER_ENABLED ?? "true").toLowerCase() !== "false";
}

export function stormReachAutopilotRadiusMiles(level: string) {
  void level;
  return stormReachStormOutreachRadiusMiles();
}

export async function runStormReachAutopilot(options: {
  supabase?: ServiceClient;
  actor?: StormReachActor;
  state?: string | null;
  eventLimit?: number;
  prospectLimit?: number;
  draftLimit?: number;
  assetLimit?: number;
  now?: Date;
} = {}) {
  const supabase = options.supabase ?? createServiceClient();
  const db = supabase as Db;
  const actor = options.actor ?? { label: "stormreach_autopilot" };
  const state = String(options.state || stormReachAutopilotState()).toUpperCase();
  const startedAt = new Date();
  const runKey = `stormreach-autopilot-${state}-${startedAt.toISOString()}`;
  const runRow = await createAgentRun(db, {
    runKey,
    state,
    startedAt: startedAt.toISOString(),
  });

  if (!stormReachAutopilotRunnerEnabled()) {
    await completeAgentRun(db, runRow?.id, {
      status: "warning",
      summary: "StormReach Autopilot runner is disabled by STORMREACH_AUTOPILOT_RUNNER_ENABLED.",
      errors: ["StormReach Autopilot runner disabled."],
    });
    return {
      ok: false,
      job: "stormreach_autopilot",
      state,
      error: "StormReach Autopilot runner disabled.",
      eventsProcessed: 0,
    };
  }

  const ingest = await ingestStormReachEvents({ supabase, actor, state, limit: 300, now: options.now });
  const dashboard = await loadStormReachDashboard(supabase);
  const candidates = dashboard.events
    .filter((event) => !state || String(event.impacted_state ?? "").toUpperCase() === state)
    .filter((event) => isStormReachAutopilotCandidate(event, options.now ?? new Date()))
    .map((event) => ({ event, opportunity: classifyStormReachAutopilotOpportunity(event) }))
    .sort((a, b) => b.opportunity.score - a.opportunity.score)
    .slice(0, options.eventLimit ?? positiveInteger(process.env.STORMREACH_AUTOPILOT_EVENT_LIMIT, 8));

  const eventResults = [];
  const errors: string[] = [];

  for (const item of candidates) {
    const services = recommendStormReachAutopilotServices(item.event);
    const plan = buildStormAutopilotImpactPlan(item.event);
    await applyAutopilotMetadata(db, item.event, services, actor);

    const prospects = await generateProspectsForStormEvent(item.event.id, {
      supabase,
      actor,
      industries: services,
      radiusMiles: stormReachAutopilotRadiusMiles(plan.opportunityLevel),
      limit: options.prospectLimit ?? positiveInteger(process.env.STORMREACH_AUTOPILOT_PROSPECT_LIMIT, 400),
      includeExternalProviders: true,
      coreContractorMode: false,
    });
    if (!prospects.ok && prospects.error) errors.push(prospects.error);

    const drafts = await draftStormReachAutopilotOutreachForStormEvent(item.event.id, {
      supabase,
      actor,
      industries: services,
      limit: options.draftLimit ?? positiveInteger(process.env.STORMREACH_AUTOPILOT_DRAFT_LIMIT, 900),
    });
    if (!drafts.ok && drafts.error) errors.push(drafts.error);

    const packages = await createOverdriveCampaignPackagesForStormEvent(item.event.id, {
      supabase,
      actor,
      industries: services.slice(0, 4),
    });
    if (!packages.ok && packages.error) errors.push(packages.error);

    const assets = await createStormReachAutopilotAssetsForStormEvent(item.event.id, {
      supabase,
      actor,
      limit: options.assetLimit ?? 4,
    });
    if (!assets.ok && assets.error) errors.push(assets.error);

    const campaign = await createStormReachAutopilotCampaign(item.event.id, {
      supabase,
      actor,
    });
    if (!campaign.ok && campaign.error) errors.push(campaign.error);

    eventResults.push({
      eventId: item.event.id,
      title: item.event.title,
      opportunity: item.opportunity,
      plan,
      services,
      prospects,
      drafts,
      packages,
      assets,
      campaign,
    });
  }

  const summary = `StormReach Agent processed ${eventResults.length} ${state} storm event${eventResults.length === 1 ? "" : "s"}: ${sum(eventResults, "prospects", "inserted")} prospects, ${sum(eventResults, "drafts", "inserted")} outreach drafts, ${sum(eventResults, "assets", "inserted")} assets.`;
  await completeAgentRun(db, runRow?.id, {
    status: errors.length ? "warning" : "completed",
    summary,
    eventsSeen: dashboard.events.length,
    eventsUpserted: ingest.eventsUpserted,
    eventsQualified: candidates.length,
    prospectsCreated: sum(eventResults, "prospects", "inserted"),
    outreachDraftsCreated: sum(eventResults, "drafts", "inserted"),
    assetsCreated: sum(eventResults, "assets", "inserted"),
    campaignsCreated: sum(eventResults, "campaign", "inserted"),
    errors,
    metadata: {
      ingest,
      event_results: eventResults.map((result) => ({
        event_id: result.eventId,
        title: result.title,
        opportunity_level: result.plan.opportunityLevel,
        opportunity_score: result.opportunity.score,
        top_prospects: result.drafts.topProspects ?? [],
      })),
      no_auto_send: true,
      human_approval_required: true,
    },
  });

  if (eventResults.some((result) => result.plan.opportunityLevel === "Critical" || result.plan.opportunityLevel === "High")) {
    await createAdminNotification(db, {
      title: "StormReach Autopilot opportunity ready",
      body: summary,
      severity: eventResults.some((result) => result.plan.opportunityLevel === "Critical") ? "critical" : "warning",
      relatedTable: "storm_events",
      relatedId: eventResults[0]?.eventId ?? "stormreach_autopilot",
      metadata: { state, event_count: eventResults.length, no_auto_send: true },
    });
  }

  await logStormActivity(db, {
    stormEventId: eventResults[0]?.eventId ?? null,
    actor,
    action: "stormreach_autopilot_run",
    status: errors.length ? "warning" : "completed",
    summary,
    details: { state, events: eventResults.length, errors, no_auto_send: true },
    approvalStatus: "needs_review",
  });

  return {
    ok: errors.length === 0,
    job: "stormreach_autopilot",
    state,
    eventsProcessed: eventResults.length,
    prospectsInserted: sum(eventResults, "prospects", "inserted"),
    draftsCreated: sum(eventResults, "drafts", "inserted"),
    assetsCreated: sum(eventResults, "assets", "inserted"),
    campaignsCreated: sum(eventResults, "campaign", "inserted"),
    errors,
    ingest,
    eventResults,
  };
}

export async function draftStormReachAutopilotOutreachForStormEvent(eventId: string, options: {
  supabase?: ServiceClient;
  actor?: StormReachActor;
  industries?: string[];
  prospectIds?: string[];
  limit?: number;
} = {}) {
  const db = (options.supabase ?? createServiceClient()) as Db;
  const detail = await loadStormReachEventDetail(eventId, options.supabase);
  if (!detail.event) return { ok: false, inserted: 0, error: "Storm event not found.", topProspects: [] };

  const event = dashboardEventToScored(detail.event);
  const industries = stormReachAllowedStormOutreachIndustries(options.industries?.length ? options.industries : recommendStormReachAutopilotServices(detail.event));
  const existing = new Set(detail.outreachMessages.map((row) => `${String(row.prospect_id ?? "")}:${String(row.channel ?? "")}`));
  const prospects = detail.prospects
    .filter((row) => !options.prospectIds?.length || options.prospectIds.includes(String(row.id)))
    .filter((row) => row.suppression_status !== "suppressed")
    .filter((row) => isWithinStormReachStormOutreachRadius(row.distance_to_event))
    .filter((row) => !industries.length || industries.some((industry) => industryMatchesCategory(industry, String(row.category ?? ""))))
    .sort((a, b) => scoreProspect(b) - scoreProspect(a))
    .slice(0, options.limit ?? 300);

  const topProspects = prospects.slice(0, 10).map((row) => ({
    id: row.id,
    business_name: row.business_name,
    category: row.category,
    city: row.city,
    state: row.state,
    lead_score: scoreProspect(row),
    email: row.email ?? "Not publicly found",
    phone: row.phone ?? "Not publicly found",
    messenger_link: metadataValue(row, "messenger_link") || "Not publicly found",
  }));

  const campaign = await ensureAutopilotOutreachCampaign(db, detail.event.id, options.actor);
  const rows: JsonRecord[] = [];
  const now = new Date().toISOString();
  const limit = options.limit ?? 300;

  for (const [index, prospect] of prospects.entries()) {
    const category = bestCategory(String(prospect.category ?? ""), industries);
    const channels: AutopilotChannel[] = ["email", ...(prospect.phone ? ["sms" as const] : []), "facebook_dm"];
    for (const channel of channels) {
      if (rows.length >= limit) break;
      if (existing.has(`${String(prospect.id)}:${channel}`)) continue;
      const draft = buildStormReachAutopilotDraft({
        channel,
        event,
        prospect: prospect as Partial<StormBusinessProspectInput> & JsonRecord,
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
          autopilot_mode: true,
          category,
          lead_score: scoreProspect(prospect),
          messenger_link: metadataValue(prospect, "messenger_link") || "Not publicly found",
          facebook_page: metadataValue(prospect, "facebook_page") || "Not publicly found",
          risk_notes: draft.riskNotes,
          ...draft.metadata,
          no_auto_send: true,
          human_approval_required: true,
        },
        created_by: options.actor?.id ?? null,
        created_at: now,
        updated_at: now,
      }).select("*").single();
      if (error) return { ok: false, inserted: rows.length, error: error.message, topProspects };
      if (data) rows.push(data as JsonRecord);
    }
  }

  if (rows.length) {
    await syncApprovalLedgerPayloads(rows.map((row) => autopilotMessageApproval(row, detail.event!)), {
      actorId: options.actor?.id ?? null,
      actorLabel: options.actor?.label ?? "stormreach_autopilot",
      eventType: "stormreach_autopilot_drafts_synced",
      syncSource: "stormreach",
    });
  }

  await logStormActivity(db, {
    stormEventId: detail.event.id,
    actor: options.actor,
    action: "stormreach_autopilot_outreach_drafted",
    status: "draft",
    summary: `StormReach Agent drafted ${rows.length} approval-gated email/SMS/Messenger messages.`,
    details: { industries, top_prospects: topProspects, no_auto_send: true },
    approvalStatus: "needs_review",
  });

  return { ok: true, inserted: rows.length, error: null, topProspects };
}

export async function createStormReachAutopilotAssetsForStormEvent(eventId: string, options: {
  supabase?: ServiceClient;
  actor?: StormReachActor;
  limit?: number;
} = {}) {
  const db = (options.supabase ?? createServiceClient()) as Db;
  const detail = await loadStormReachEventDetail(eventId, options.supabase);
  if (!detail.event) return { ok: false, inserted: 0, error: "Storm event not found." };

  const event = dashboardEventToScored(detail.event);
  const specs = buildStormOpportunityAssetSpecs(event).slice(0, options.limit ?? 4);
  const existingResult = await db
    .from("storm_generated_assets")
    .select("asset_type,format,status")
    .eq("storm_event_id", detail.event.id)
    .neq("status", "archived");
  if (existingResult.error) return { ok: false, inserted: 0, error: existingResult.error.message };
  const existing = new Set(((existingResult.data ?? []) as JsonRecord[]).map((row) => `${row.asset_type}:${row.format}`));
  const now = new Date().toISOString();
  const rows = specs
    .filter((spec) => !existing.has(`${spec.assetType}:${spec.format}`))
    .map((spec) => ({
      storm_event_id: detail.event!.id,
      asset_type: spec.assetType,
      title: spec.title,
      format: spec.format,
      status: "generated",
      approval_status: "needs_review",
      content_text: spec.contentText,
      asset_payload: spec.assetPayload,
      source_data: spec.sourceData,
      metadata: {
        ...spec.metadata,
        autopilot_mode: true,
        no_auto_publish: true,
        human_approval_required: true,
      },
      generated_by: STORMREACH_AUTOPILOT_AGENT_NAME,
      created_by: options.actor?.id ?? null,
      created_at: now,
      updated_at: now,
    }));

  if (!rows.length) return { ok: true, inserted: 0, error: null };
  const { error } = await db.from("storm_generated_assets").insert(rows);
  if (error) return { ok: false, inserted: 0, error: error.message };

  await logStormActivity(db, {
    stormEventId: detail.event.id,
    actor: options.actor,
    action: "stormreach_autopilot_assets_generated",
    status: "generated",
    summary: `StormReach Agent generated ${rows.length} branded storm opportunity asset${rows.length === 1 ? "" : "s"}.`,
    details: { assets: rows.map((row) => row.asset_type), no_auto_publish: true },
    approvalStatus: "needs_review",
  });

  return { ok: true, inserted: rows.length, error: null };
}

export async function createStormReachAutopilotCampaign(eventId: string, options: {
  supabase?: ServiceClient;
  actor?: StormReachActor;
} = {}) {
  const db = (options.supabase ?? createServiceClient()) as Db;
  const detail = await loadStormReachEventDetail(eventId, options.supabase);
  if (!detail.event) return { ok: false, inserted: 0, error: "Storm event not found." };
  const plan = buildStormAutopilotImpactPlan(detail.event);
  const existing = await db
    .from("storm_campaigns")
    .select("id")
    .eq("storm_event_id", detail.event.id)
    .eq("campaign_type", "storm_autopilot")
    .neq("status", "archived")
    .maybeSingle();
  if (existing.error && !/no rows/i.test(existing.error.message ?? "")) return { ok: false, inserted: 0, error: existing.error.message };
  if (existing.data?.id) return { ok: true, inserted: 0, id: existing.data.id, error: null };

  const now = new Date().toISOString();
  const { data, error } = await db.from("storm_campaigns").insert({
    storm_event_id: detail.event.id,
    campaign_name: `StormReach Autopilot - ${plan.areaLabel}`,
    campaign_type: "storm_autopilot",
    status: "needs_review",
    approval_status: "needs_review",
    opportunity_level: plan.opportunityLevel,
    estimated_value_cents: plan.estimatedCampaignValueCents,
    recommended_mail_quantity: plan.recommendedMailQuantity,
    geofence_radius_miles: plan.geofenceRadiusMiles,
    owner_user_id: options.actor?.id ?? null,
    metadata: {
      autopilot_mode: true,
      plan,
      no_auto_send: true,
      no_auto_launch: true,
      no_auto_charge: true,
      human_approval_required: true,
    },
    created_by: options.actor?.id ?? null,
    created_at: now,
    updated_at: now,
  }).select("id").single();
  if (error) return { ok: false, inserted: 0, error: error.message };
  return { ok: true, inserted: 1, id: data?.id, error: null };
}

async function applyAutopilotMetadata(db: Db, event: StormDashboardEvent, services: string[], actor?: StormReachActor) {
  const opportunity = classifyStormReachAutopilotOpportunity(event);
  const plan = buildStormAutopilotImpactPlan(event);
  await db.from("storm_events").update({
    recommended_industries: unique([...(event.recommended_industries ?? []), ...services]),
    severity_score: Math.max(Number(event.severity_score ?? 0), opportunity.score),
    metadata: {
      ...(event.metadata ?? {}),
      autopilot_mode: true,
      autopilot_agent: STORMREACH_AUTOPILOT_AGENT_NAME,
      autopilot_opportunity_level: opportunity.level,
      autopilot_opportunity_score: opportunity.score,
      autopilot_reasons: opportunity.reasons,
      autopilot_plan: plan,
      no_auto_send: true,
      no_auto_launch: true,
      human_approval_required: true,
      updated_by: actor?.label ?? "stormreach_autopilot",
    },
    updated_at: new Date().toISOString(),
  }).eq("id", event.id);
}

async function ensureAutopilotOutreachCampaign(db: Db, eventId: string, actor?: StormReachActor) {
  const existing = await db
    .from("storm_outreach_campaigns")
    .select("*")
    .eq("storm_event_id", eventId)
    .eq("campaign_name", "StormReach Autopilot business outreach")
    .maybeSingle();
  if (existing.data) return existing.data as JsonRecord;
  const now = new Date().toISOString();
  const { data, error } = await db.from("storm_outreach_campaigns").insert({
    storm_event_id: eventId,
    industry: "Storm response",
    sender_key: "jason",
    campaign_name: "StormReach Autopilot business outreach",
    status: "draft",
    approval_status: "needs_review",
    subject_base: "StormReach opportunity",
    human_approval_required: true,
    metadata: {
      autopilot_mode: true,
      agent_name: STORMREACH_AUTOPILOT_AGENT_NAME,
      service_categories: STORMREACH_AUTOPILOT_SERVICE_CATEGORIES,
      no_auto_send: true,
    },
    created_by: actor?.id ?? null,
    created_at: now,
    updated_at: now,
  }).select("*").single();
  if (error) throw new Error(error.message);
  return data as JsonRecord;
}

async function createAgentRun(db: Db, input: { runKey: string; state: string; startedAt: string }) {
  const { data, error } = await db.from("storm_agent_runs").insert({
    run_key: input.runKey,
    run_type: "autopilot_4h",
    agent_name: STORMREACH_AUTOPILOT_AGENT_NAME,
    status: "started",
    state: input.state,
    started_at: input.startedAt,
    metadata: { no_auto_send: true, human_approval_required: true },
  }).select("id").single();
  if (error) return null;
  return data as { id: string };
}

async function completeAgentRun(db: Db, runId: string | undefined, input: {
  status: "completed" | "warning" | "failed";
  summary: string;
  eventsSeen?: number;
  eventsUpserted?: number;
  eventsQualified?: number;
  prospectsCreated?: number;
  outreachDraftsCreated?: number;
  assetsCreated?: number;
  campaignsCreated?: number;
  errors?: string[];
  metadata?: JsonRecord;
}) {
  if (!runId) return;
  await db.from("storm_agent_runs").update({
    status: input.status,
    summary: input.summary,
    events_seen: input.eventsSeen ?? 0,
    events_upserted: input.eventsUpserted ?? 0,
    events_qualified: input.eventsQualified ?? 0,
    prospects_created: input.prospectsCreated ?? 0,
    outreach_drafts_created: input.outreachDraftsCreated ?? 0,
    assets_created: input.assetsCreated ?? 0,
    campaigns_created: input.campaignsCreated ?? 0,
    errors: input.errors ?? [],
    metadata: input.metadata ?? {},
    completed_at: new Date().toISOString(),
  }).eq("id", runId);
}

function autopilotMessageApproval(message: JsonRecord, event: StormDashboardEvent): ApprovalLedgerPayload {
  return {
    source_key: `storm_outreach_messages:${String(message.id)}:stormreach_autopilot_message`,
    source_system: "stormreach",
    source_table: "storm_outreach_messages",
    source_id: String(message.id),
    source_href: `/admin/stormreach/${event.id}`,
    domain: "revenue",
    approval_kind: "stormreach_autopilot_message",
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
    next_action: "Review source claim, suppression status, channel permission, and CTA before any send/copy action.",
    guardrail: "Approval prepares the message only. It does not mass-send SMS, email, or Facebook Messenger.",
    policy_flags: ["storm_weather_claim_review", "suppression_required", "tcp_can_spam_review", "no_confirmed_damage_claims"],
    action_target: { id: String(message.id), kind: "stormreach_autopilot_draft", status: String(message.status ?? "draft") },
    evidence: { storm_event_id: event.id, source: event.source, source_url: event.source_url },
    metadata: { autopilot_mode: true, no_auto_send: true },
    source_created_at: String(message.created_at ?? new Date().toISOString()),
    source_updated_at: String(message.updated_at ?? new Date().toISOString()),
    updated_at: new Date().toISOString(),
  };
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
    hazardMetrics: ((event.metadata ?? {}) as JsonRecord).hazard_metrics as ScoredStormEvent["hazardMetrics"] ?? {},
    metadata: event.metadata ?? {},
    severityScore: event.severity_score,
    severityLevel: event.severity_level,
    scoringFactors: {},
  };
}

async function logStormActivity(db: Db, input: {
  stormEventId?: string | null;
  actor?: StormReachActor;
  action: string;
  status: string;
  summary: string;
  details: JsonRecord;
  approvalStatus: string;
}) {
  await db.from("storm_audit_logs").insert({
    storm_event_id: input.stormEventId ?? null,
    related_table: "storm_agent_runs",
    related_id: "stormreach_autopilot",
    actor_user_id: input.actor?.id ?? null,
    actor_label: input.actor?.label ?? input.actor?.email ?? STORMREACH_AUTOPILOT_AGENT_NAME,
    action: input.action,
    status: input.status,
    summary: input.summary,
    details: input.details,
    approval_status: input.approvalStatus,
  });

  await db.from("ai_workforce_activity_logs").insert({
    task_public_id: input.stormEventId ? `STORM-${input.stormEventId}` : "STORMREACH-AUTOPILOT",
    agent_name: STORMREACH_AUTOPILOT_AGENT_NAME,
    event_type: input.action,
    status: input.status,
    summary: input.summary,
    details: input.details,
    approval_status: "needs_review",
    created_by: input.actor?.id ?? null,
  });
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
      source: "stormreach_autopilot",
      ...(input.metadata ?? {}),
    },
  });
}

function scoreProspect(row: JsonRecord) {
  let score = Number(row.confidence_score ?? 50);
  if (row.email) score += 10;
  if (row.phone) score += 6;
  if (row.website) score += 4;
  const distanceToEvent = Number(row.distance_to_event);
  if (Number.isFinite(distanceToEvent) && distanceToEvent < 15) score += 6;
  if (metadataValue(row, "reviews")) score += 3;
  if (row.suppression_status === "suppressed") score -= 50;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function bestCategory(category: string, industries: string[]) {
  return industries.find((industry) => industryMatchesCategory(industry, category) || category.toLowerCase().includes(industry.toLowerCase())) ?? industries[0] ?? category;
}

function metadataValue(row: JsonRecord, key: string) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as JsonRecord : {};
  return metadata[key];
}

function positiveInteger(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function sum(rows: unknown[], key: string, nestedKey: string) {
  return rows.reduce<number>((total, row) => {
    const record = row && typeof row === "object" ? row as Record<string, unknown> : {};
    const value = record[key];
    const nested = value && typeof value === "object" ? (value as Record<string, unknown>)[nestedKey] : 0;
    return total + Number(nested ?? 0);
  }, 0);
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}
