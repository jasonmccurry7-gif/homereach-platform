import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { analyzeGroupObservation } from "./analysis";
import {
  GROUP_OBSERVATION_STATUSES,
  type GroupAnalyzeInput,
  type GroupDashboardData,
  type GroupDraftType,
  type GroupIntelligenceSummary,
  type GroupObservation,
  type GroupObservationStatus,
  type GroupResponseDraft,
  type GroupSource,
} from "./types";

type Db = ReturnType<typeof createServiceClient>;
type GenericRow = Record<string, unknown>;

export type GroupFilters = {
  status?: string | null;
  category?: string | null;
  group?: string | null;
  minScore?: number | null;
  query?: string | null;
};

export async function loadGroupIntelligenceDashboard(filters: GroupFilters = {}): Promise<GroupDashboardData> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return seedDashboard(["Supabase service credentials are unavailable in this environment."]);
  }

  const db = createServiceClient();
  const [observationsResult, sourcesResult] = await Promise.all([
    listObservations(db, filters),
    safeListSources(db),
  ]);

  const warnings = [observationsResult.error, sourcesResult.error].filter(Boolean) as string[];
  if (observationsResult.schemaMissing || sourcesResult.schemaMissing) {
    return seedDashboard([
      "Apply supabase/migrations/20260528012805_group_intelligence_response_drafting.sql to persist Group Intelligence data.",
      ...warnings,
    ]);
  }

  const observations = observationsResult.data ?? [];
  const sources = sourcesResult.data ?? [];
  return {
    schemaReady: warnings.length === 0,
    warnings,
    observations,
    sources,
    summary: buildSummary(observations, warnings),
  };
}

export async function createGroupObservation(input: GroupAnalyzeInput, userId: string | null) {
  const db = createServiceClient();
  const analysis = await analyzeGroupObservation(input);
  const sourceId = await findOrCreateSource(db, input, userId);
  const now = new Date().toISOString();

  const { data: observation, error } = await db
    .from("group_intelligence_observations")
    .insert({
      source_id: sourceId,
      group_name: input.groupName.trim(),
      post_author_name: clean(input.postAuthorName),
      business_name: clean(input.businessName),
      business_type: clean(input.businessType),
      post_url: clean(input.postUrl),
      observed_at: input.observedAt || now,
      source_text: input.sourceText.trim(),
      pain_point_summary: analysis.painPointSummary,
      urgency_level: analysis.urgencyLevel,
      opportunity_category: analysis.opportunityCategory,
      opportunity_score: analysis.opportunityScore,
      recommended_response_angle: analysis.recommendedResponseAngle,
      suggested_service_fit: analysis.suggestedServiceFit,
      follow_up_suggestion: analysis.followUpSuggestion,
      status: analysis.opportunityCategory === "Not relevant" ? "Not Relevant" : "New",
      notes: clean(input.notes),
      created_by: userId,
      metadata: {
        detected_city: analysis.detectedCity,
        detected_pain_points: analysis.detectedPainPoints,
        safety_notes: analysis.safetyNotes,
        analysis_mode: process.env.GROUP_INTELLIGENCE_AI_ENABLED === "true" ? "ai_with_deterministic_fallback" : "deterministic",
      },
    })
    .select("*")
    .single();

  if (error) throw error;
  const observationId = String(observation.id);
  const draftRows = [
    {
      observation_id: observationId,
      draft_type: "public_comment",
      title: "Helpful public comment",
      content: analysis.publicCommentDraft,
      approval_status: "needs_review",
      created_by: userId,
      metadata: { safety: "copy_only_human_review_required" },
    },
    {
      observation_id: observationId,
      draft_type: "private_dm",
      title: "Short private DM",
      content: analysis.privateDmDraft,
      approval_status: "needs_review",
      created_by: userId,
      metadata: { safety: "copy_only_human_review_required" },
    },
    {
      observation_id: observationId,
      draft_type: "follow_up",
      title: "Follow-up message",
      content: analysis.followUpDraft,
      approval_status: "needs_review",
      created_by: userId,
      metadata: { safety: "copy_only_human_review_required" },
    },
    ...analysis.facebookPostIdeas.slice(0, 3).map((idea, index) => ({
      observation_id: observationId,
      draft_type: "facebook_post_idea" as GroupDraftType,
      title: `Facebook post idea ${index + 1}`,
      content: idea,
      approval_status: "needs_review",
      created_by: userId,
      metadata: { safety: "idea_only_human_review_required" },
    })),
  ];

  const { error: draftError } = await db.from("group_response_drafts").insert(draftRows);
  if (draftError) throw draftError;

  const { data: hydrated, error: hydrateError } = await db
    .from("group_intelligence_observations")
    .select("*, group_response_drafts(*)")
    .eq("id", observationId)
    .single();
  if (hydrateError) throw hydrateError;

  return {
    observation: mapObservation(hydrated),
    analysis,
  };
}

export async function updateObservationStatus({
  observationId,
  status,
  notes,
  followUpDueAt,
}: {
  observationId: string;
  status: GroupObservationStatus;
  notes?: string | null;
  followUpDueAt?: string | null;
}) {
  if (!GROUP_OBSERVATION_STATUSES.includes(status)) {
    throw new Error("Invalid Group Intelligence status.");
  }
  const patch: GenericRow = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (notes !== undefined) patch.notes = clean(notes);
  if (followUpDueAt !== undefined) patch.follow_up_due_at = clean(followUpDueAt);
  if (status === "Responded") patch.responded_at = new Date().toISOString();

  const db = createServiceClient();
  const { data, error } = await db
    .from("group_intelligence_observations")
    .update(patch)
    .eq("id", observationId)
    .select("*, group_response_drafts(*)")
    .single();
  if (error) throw error;
  return mapObservation(data);
}

export async function markDraftCopied({
  draftId,
  draftType,
  userId,
}: {
  draftId: string;
  draftType: GroupDraftType;
  userId: string | null;
}) {
  const db = createServiceClient();
  const now = new Date().toISOString();
  const { data: draft, error } = await db
    .from("group_response_drafts")
    .update({
      copied_at: now,
      copied_by: userId,
      updated_at: now,
    })
    .eq("id", draftId)
    .select("id, observation_id, draft_type")
    .single();
  if (error) throw error;

  const observationPatch: GenericRow = { updated_at: now };
  if (draftType === "public_comment") {
    observationPatch.copied_public_comment_at = now;
    observationPatch.status = "Comment Drafted";
  }
  if (draftType === "private_dm") {
    observationPatch.copied_dm_at = now;
    observationPatch.status = "DM Drafted";
  }

  if (Object.keys(observationPatch).length > 1) {
    await db
      .from("group_intelligence_observations")
      .update(observationPatch)
      .eq("id", String(draft.observation_id));
  }

  return draft;
}

export async function saveObservationAsLead(observationId: string, userId: string | null) {
  const db = createServiceClient();
  const { data: observation, error } = await db
    .from("group_intelligence_observations")
    .select("*, group_response_drafts(*)")
    .eq("id", observationId)
    .single();
  if (error) throw error;

  const mapped = mapObservation(observation);
  const detectedCity = typeof mapped.metadata.detected_city === "string" ? mapped.metadata.detected_city : null;
  const businessName =
    mapped.businessName?.trim() ||
    mapped.postAuthorName?.trim() ||
    `Facebook group opportunity - ${mapped.groupName}`;

  const priority = mapped.opportunityScore >= 75 ? "high" : mapped.opportunityScore >= 45 ? "medium" : "low";
  const leadNotes = [
    "Source: Facebook Group Intelligence",
    `Group: ${mapped.groupName}`,
    mapped.postUrl ? `Source post: ${mapped.postUrl}` : null,
    `Pain point: ${mapped.painPointSummary}`,
    `Recommended angle: ${mapped.recommendedResponseAngle}`,
    `Suggested fit: ${mapped.suggestedServiceFit}`,
    mapped.notes ? `Operator notes: ${mapped.notes}` : null,
    "",
    "Human review required before any outreach.",
  ]
    .filter(Boolean)
    .join("\n");

  const { data: lead, error: leadError } = await db
    .from("sales_leads")
    .insert({
      business_name: businessName,
      contact_name: mapped.postAuthorName,
      facebook_url: mapped.postUrl,
      city: detectedCity,
      state: "OH",
      category: mapped.opportunityCategory,
      score: mapped.opportunityScore,
      priority,
      buying_signal: mapped.opportunityScore >= 60,
      status: "queued",
      notes: leadNotes,
      assigned_agent_id: userId,
    })
    .select("id")
    .single();
  if (leadError) throw leadError;

  await db
    .from("group_intelligence_observations")
    .update({
      converted_lead_id: lead.id,
      status: "Converted to Lead",
      updated_at: new Date().toISOString(),
    })
    .eq("id", observationId);

  await db.from("sales_events").insert({
    agent_id: userId,
    lead_id: lead.id,
    action_type: "lead_loaded",
    channel: "facebook",
    city: detectedCity,
    category: mapped.opportunityCategory,
    message: "Saved from Group Intelligence & Response Drafting.",
    metadata: {
      source: "Facebook Group Intelligence",
      observation_id: observationId,
      group_name: mapped.groupName,
      post_url: mapped.postUrl,
    },
  });

  return { leadId: String(lead.id) };
}

async function listObservations(db: Db, filters: GroupFilters) {
  try {
    let query = db
      .from("group_intelligence_observations")
      .select("*, group_response_drafts(*)")
      .order("opportunity_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
    if (filters.category && filters.category !== "all") query = query.eq("opportunity_category", filters.category);
    if (filters.group && filters.group !== "all") query = query.eq("group_name", filters.group);
    if (filters.minScore && filters.minScore > 0) query = query.gte("opportunity_score", filters.minScore);
    if (filters.query) {
      const safe = filters.query.replace(/[,%]/g, " ").trim();
      if (safe) {
        query = query.or(`group_name.ilike.%${safe}%,business_name.ilike.%${safe}%,post_author_name.ilike.%${safe}%,pain_point_summary.ilike.%${safe}%`);
      }
    }

    const { data, error } = await query;
    if (error) {
      return {
        data: [],
        error: error.message,
        schemaMissing: error.code === "42P01",
      };
    }
    return { data: (data ?? []).map(mapObservation), error: null, schemaMissing: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { data: [], error: message, schemaMissing: /does not exist|schema cache/i.test(message) };
  }
}

async function safeListSources(db: Db) {
  try {
    const { data, error } = await db
      .from("group_intelligence_sources")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) return { data: [], error: error.message, schemaMissing: error.code === "42P01" };
    return { data: (data ?? []).map(mapSource), error: null, schemaMissing: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { data: [], error: message, schemaMissing: /does not exist|schema cache/i.test(message) };
  }
}

async function findOrCreateSource(db: Db, input: GroupAnalyzeInput, userId: string | null) {
  const groupName = input.groupName.trim();
  const { data: existing } = await db
    .from("group_intelligence_sources")
    .select("id")
    .ilike("group_name", groupName)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return String(existing.id);

  const { data, error } = await db
    .from("group_intelligence_sources")
    .insert({
      group_name: groupName,
      group_url: clean(input.groupUrl),
      group_type: normalizeGroupType(input.groupType),
      access_basis: "manual_import",
      created_by: userId,
      metadata: {
        safety: "manual_import_assisted_only",
      },
    })
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

function buildSummary(observations: GroupObservation[], warnings: string[]): GroupIntelligenceSummary {
  const today = new Date().toISOString().slice(0, 10);
  const topOpportunities = observations
    .filter((item) => item.opportunityCategory !== "Not relevant")
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 10);
  const drafts = observations.flatMap((item) => item.drafts);
  const followUpsDue = observations.filter((item) => {
    if (item.status === "Follow-Up Due") return true;
    return item.followUpDueAt ? Date.parse(item.followUpDueAt) <= Date.now() : false;
  }).length;
  const painCounts = new Map<string, number>();
  for (const item of observations) {
    const painPoints = Array.isArray(item.metadata.detected_pain_points)
      ? item.metadata.detected_pain_points.filter((value): value is string => typeof value === "string")
      : [item.opportunityCategory];
    for (const point of painPoints) painCounts.set(point, (painCounts.get(point) ?? 0) + 1);
  }
  const topPainPoints = Array.from(painCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => ({ label, count }));
  const suggestedFacebookPosts = Array.from(
    new Set(
      observations
        .flatMap((item) => item.drafts)
        .filter((draft) => draft.draftType === "facebook_post_idea")
        .map((draft) => draft.content),
    ),
  ).slice(0, 3);

  return {
    schemaReady: warnings.length === 0,
    totalObservations: observations.length,
    newPainPoints: observations.filter((item) => item.status === "New").length,
    bestOpportunitiesToday: observations.filter((item) => item.createdAt.startsWith(today) && item.opportunityScore >= 65).length,
    draftsReadyForReview: drafts.filter((draft) => draft.approvalStatus === "needs_review").length,
    responsesCopied: observations.filter((item) => item.copiedPublicCommentAt || item.copiedDmAt).length,
    followUpsDue,
    convertedLeads: observations.filter((item) => item.convertedLeadId).length,
    topPainPoints,
    topOpportunities,
    suggestedFacebookPosts,
    dailyBrief: buildDailyBrief(topPainPoints, topOpportunities),
    warnings,
  };
}

function buildDailyBrief(
  topPainPoints: Array<{ label: string; count: number }>,
  topOpportunities: GroupObservation[],
) {
  if (!topOpportunities.length) {
    return "No qualified group opportunities are queued yet. Paste a post or comment to create the first supervised draft.";
  }
  const pain = topPainPoints[0]?.label.toLowerCase() ?? "local business pressure";
  const top = topOpportunities[0];
  if (!top) {
    return "No qualified group opportunities are queued yet. Paste a post or comment to create the first supervised draft.";
  }
  const groupName = top.groupName;
  const opportunityScore = top.opportunityScore;
  const category = top.opportunityCategory.toLowerCase();
  return `Local groups are currently signaling ${pain}. The highest-value opportunity is ${groupName} at ${opportunityScore}/100, with a ${category} angle. Keep responses helpful, short, and manually reviewed.`;
}

function seedDashboard(warnings: string[]): GroupDashboardData {
  const observations: GroupObservation[] = [];
  return {
    schemaReady: false,
    warnings,
    observations,
    sources: [],
    summary: buildSummary(observations, warnings),
  };
}

function mapObservation(row: GenericRow): GroupObservation {
  const drafts = Array.isArray(row.group_response_drafts)
    ? row.group_response_drafts.map((draft) => mapDraft(draft as GenericRow))
    : [];
  return {
    id: String(row.id),
    sourceId: nullable(row.source_id),
    groupName: String(row.group_name ?? ""),
    postAuthorName: nullable(row.post_author_name),
    businessName: nullable(row.business_name),
    businessType: nullable(row.business_type),
    postUrl: nullable(row.post_url),
    observedAt: String(row.observed_at ?? row.created_at ?? new Date().toISOString()),
    sourceText: String(row.source_text ?? ""),
    painPointSummary: String(row.pain_point_summary ?? ""),
    urgencyLevel: asUrgency(row.urgency_level),
    opportunityCategory: String(row.opportunity_category ?? "General small business advice opportunity") as GroupObservation["opportunityCategory"],
    opportunityScore: Number(row.opportunity_score ?? 0),
    recommendedResponseAngle: String(row.recommended_response_angle ?? ""),
    suggestedServiceFit: String(row.suggested_service_fit ?? ""),
    followUpSuggestion: String(row.follow_up_suggestion ?? ""),
    status: String(row.status ?? "New") as GroupObservationStatus,
    notes: nullable(row.notes),
    copiedPublicCommentAt: nullable(row.copied_public_comment_at),
    copiedDmAt: nullable(row.copied_dm_at),
    respondedAt: nullable(row.responded_at),
    followUpDueAt: nullable(row.follow_up_due_at),
    convertedLeadId: nullable(row.converted_lead_id),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
    metadata: asRecord(row.metadata),
    drafts: drafts.sort((a, b) => draftOrder(a.draftType) - draftOrder(b.draftType)),
  };
}

function mapDraft(row: GenericRow): GroupResponseDraft {
  return {
    id: String(row.id),
    observationId: String(row.observation_id ?? ""),
    draftType: String(row.draft_type ?? "public_comment") as GroupDraftType,
    title: nullable(row.title),
    content: String(row.content ?? ""),
    tone: String(row.tone ?? "helpful_local_human"),
    approvalStatus: String(row.approval_status ?? "needs_review"),
    copiedAt: nullable(row.copied_at),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapSource(row: GenericRow): GroupSource {
  return {
    id: String(row.id),
    groupName: String(row.group_name ?? ""),
    groupUrl: nullable(row.group_url),
    groupType: String(row.group_type ?? "other"),
    accessBasis: String(row.access_basis ?? "unknown"),
    status: String(row.status ?? "active"),
    notes: nullable(row.notes),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function draftOrder(type: GroupDraftType) {
  if (type === "public_comment") return 1;
  if (type === "private_dm") return 2;
  if (type === "follow_up") return 3;
  return 4;
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullable(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asUrgency(value: unknown): GroupObservation["urgencyLevel"] {
  return value === "low" || value === "medium" || value === "high" || value === "urgent" ? value : "medium";
}

function normalizeGroupType(value: unknown) {
  const raw = typeof value === "string" ? value : "local_small_business";
  return [
    "local_small_business",
    "restaurant_owner",
    "bakery",
    "real_estate",
    "contractor",
    "lawncare",
    "dealership",
    "chamber_community",
    "political_campaign",
    "other",
  ].includes(raw) ? raw : "local_small_business";
}
