import { createServiceClient } from "@/lib/supabase/service";
import {
  seedAgentProfiles,
  seedBusinessContext,
  seedDataSources,
  seedOutputReviews,
  seedOutputs,
  seedPromptChains,
  seedPromptSops,
  seedVerificationChecks,
} from "./seed";
import type {
  AiAgentProfile,
  AiAssetsCommandCenterData,
  AiBusinessContext,
  AiDataSource,
  AiOutput,
  AiOutputReview,
  AiPromptChain,
  AiPromptChainStep,
  AiPromptSop,
  AiVerificationCheck,
} from "./types";

type GenericRow = Record<string, unknown>;

const MIGRATION_HINT =
  "Apply supabase/migrations/20260522032246_ai_assets_command_center.sql to persist AI assets. The command center is using safe seed assets until the tables are available.";

export async function loadAiAssetsCommandCenter(): Promise<AiAssetsCommandCenterData> {
  const reusedSystems = [
    "Existing /admin route group, role gate, and AdminNav shell",
    "Existing Supabase auth/app_metadata role model",
    "Existing service-role server data access pattern for admin-only command centers",
    "Existing agent registry and revenue approval concepts; this adds the missing reusable context/SOP/source layer",
    "Existing political, procurement, outreach, government contracts, and SEO modules as source workflows",
  ];

  const auditFindings = [
    "No central AI Assets or prompt SOP command center existed before this build.",
    "AI Workforce exists as an execution/run dashboard, not a source-of-truth prompt/context library.",
    "Revenue messaging already has suggestion and approval tables; this command center reuses that safety model conceptually instead of duplicating sends.",
    "Political data sources exist for campaign intelligence; the new AI data source library is broader and reusable across all HomeReach workflows.",
    "All high-risk AI outputs remain draft/review/approve. No autonomous publishing, outreach, bid submission, pricing, payment, or vendor-spend actions are introduced.",
  ];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return seedData({
      schemaReady: false,
      warnings: [
        "Supabase URL or service role key is not available in this environment.",
        "AI Assets is showing seed fallback records and should not be treated as live operational truth.",
      ],
      reusedSystems,
      auditFindings,
    });
  }

  const db = createServiceClient();
  const [
    contextResult,
    sopsResult,
    sourcesResult,
    agentsResult,
    chainsResult,
    stepsResult,
    outputsResult,
    checksResult,
    reviewsResult,
  ] = await Promise.all([
    safeList(db, "ai_business_context", "updated_at"),
    safeList(db, "ai_prompt_sops", "updated_at"),
    safeList(db, "ai_data_sources", "updated_at"),
    safeList(db, "ai_agent_profiles", "agent_name", true),
    safeList(db, "ai_prompt_chains", "updated_at"),
    safeList(db, "ai_prompt_chain_steps", "step_order", true),
    safeList(db, "ai_outputs", "created_at"),
    safeList(db, "ai_verification_checks", "created_at"),
    safeList(db, "ai_output_reviews", "created_at"),
  ]);

  const results = [
    contextResult,
    sopsResult,
    sourcesResult,
    agentsResult,
    chainsResult,
    stepsResult,
    outputsResult,
    checksResult,
    reviewsResult,
  ];
  const errors = results.flatMap((result) => (result.error ? [result.error] : []));
  if (errors.length > 0) {
    return seedData({
      schemaReady: false,
      warnings: Array.from(
        new Set([
          ...errors.map((error) => error.message).filter(Boolean),
          "AI Assets fell back to seed records after a live load failure. Do not treat this page as the persisted source of truth until the warnings are resolved.",
        ]),
      ),
      reusedSystems,
      auditFindings,
    });
  }

  const stepRows = stepsResult.data ?? [];
  const stepsByChain = new Map<string, AiPromptChainStep[]>();
  for (const row of stepRows) {
    const step = mapChainStep(row);
    const existing = stepsByChain.get(step.chainId) ?? [];
    existing.push(step);
    stepsByChain.set(step.chainId, existing);
  }

  const promptChains = (chainsResult.data ?? [])
    .map((row) => mapPromptChain(row, stepsByChain.get(String(row.id)) ?? []))
    .map((chain) => ({ ...chain, steps: chain.steps.sort((a, b) => a.stepOrder - b.stepOrder) }));

  const outputRows = outputsResult.data ?? [];
  const reviewRows = reviewsResult.data ?? [];

  return {
    schemaReady: true,
    migrationHint: null,
    warnings: [],
    businessContext: contextResult.data?.[0] ? mapBusinessContext(contextResult.data[0]) : seedBusinessContext,
    promptSops: (sopsResult.data ?? []).map(mapPromptSop).concat(sopsResult.data?.length ? [] : seedPromptSops),
    dataSources: (sourcesResult.data ?? []).map(mapDataSource).concat(sourcesResult.data?.length ? [] : seedDataSources),
    agentProfiles: (agentsResult.data ?? []).map(mapAgentProfile).concat(agentsResult.data?.length ? [] : seedAgentProfiles),
    promptChains: promptChains.length ? promptChains : seedPromptChains,
    outputs: outputRows.map(mapOutput),
    verificationChecks: (checksResult.data ?? []).map(mapVerificationCheck).concat(checksResult.data?.length ? [] : seedVerificationChecks),
    outputReviews: reviewRows.map(mapOutputReview),
    reusedSystems,
    auditFindings,
  };
}

function seedData({
  auditFindings,
  reusedSystems,
  schemaReady,
  warnings,
}: {
  auditFindings: string[];
  reusedSystems: string[];
  schemaReady: boolean;
  warnings: string[];
}): AiAssetsCommandCenterData {
  return {
    schemaReady,
    migrationHint: MIGRATION_HINT,
    warnings,
    businessContext: seedBusinessContext,
    promptSops: seedPromptSops,
    dataSources: seedDataSources,
    agentProfiles: seedAgentProfiles,
    promptChains: seedPromptChains,
    outputs: seedOutputs,
    verificationChecks: seedVerificationChecks,
    outputReviews: seedOutputReviews,
    reusedSystems,
    auditFindings,
  };
}

async function safeList(
  db: ReturnType<typeof createServiceClient>,
  table: string,
  orderColumn: string,
  ascending = false,
): Promise<{ data: GenericRow[] | null; error: { message: string } | null }> {
  const { data, error } = await db
    .from(table)
    .select("*")
    .order(orderColumn, { ascending })
    .limit(200);

  return {
    data: (data ?? null) as GenericRow[] | null,
    error: error ? { message: error.message } : null,
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function asStatus(value: unknown): "active" | "inactive" | "draft" | "archived" {
  return value === "inactive" || value === "draft" || value === "archived" ? value : "active";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function mapBusinessContext(row: GenericRow): AiBusinessContext {
  return {
    id: String(row.id),
    title: String(row.title ?? "HomeReach Master Business Context"),
    category: String(row.category ?? "master"),
    companyOverview: String(row.company_overview ?? ""),
    offers: String(row.offers ?? ""),
    pricing: String(row.pricing ?? ""),
    targetCustomers: String(row.target_customers ?? ""),
    brandVoice: String(row.brand_voice ?? ""),
    salesPositioning: String(row.sales_positioning ?? ""),
    complianceRules: String(row.compliance_rules ?? ""),
    politicalMailRules: String(row.political_mail_rules ?? ""),
    procurementDashboardRules: String(row.procurement_dashboard_rules ?? ""),
    sharedPostcardRules: String(row.shared_postcard_rules ?? ""),
    targetedCampaignRules: String(row.targeted_campaign_rules ?? ""),
    samGovRules: String(row.sam_gov_rules ?? ""),
    humanApprovalRequirements: String(row.human_approval_requirements ?? ""),
    tags: asStringArray(row.tags),
    status: asStatus(row.status),
    lastReviewedAt: asNullableString(row.last_reviewed_at),
    notes: asNullableString(row.notes),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function mapPromptSop(row: GenericRow): AiPromptSop {
  return {
    id: String(row.id),
    promptName: String(row.prompt_name ?? ""),
    category: String(row.category ?? "Uncategorized"),
    purpose: String(row.purpose ?? ""),
    requiredInputs: asStringArray(row.required_inputs),
    promptText: String(row.prompt_text ?? ""),
    outputFormat: String(row.output_format ?? ""),
    approvalRequirement: String(row.approval_requirement ?? ""),
    tags: asStringArray(row.tags),
    status: asStatus(row.status),
    relatedWorkflow: asNullableString(row.related_workflow),
    relatedOffer: asNullableString(row.related_offer),
    lastReviewedAt: asNullableString(row.last_reviewed_at),
    notes: asNullableString(row.notes),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function mapDataSource(row: GenericRow): AiDataSource {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    category: String(row.category ?? "Uncategorized"),
    description: String(row.description ?? ""),
    content: String(row.content ?? ""),
    tags: asStringArray(row.tags),
    relatedWorkflow: asNullableString(row.related_workflow),
    relatedOffer: asNullableString(row.related_offer),
    qualityRating: Number(row.quality_rating ?? 3),
    status: asStatus(row.status),
    lastReviewedAt: asNullableString(row.last_reviewed_at),
    notes: asNullableString(row.notes),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function mapAgentProfile(row: GenericRow): AiAgentProfile {
  return {
    id: String(row.id),
    agentName: String(row.agent_name ?? ""),
    mission: String(row.mission ?? ""),
    allowedActions: asStringArray(row.allowed_actions),
    disallowedActions: asStringArray(row.disallowed_actions),
    requiredDataSources: asStringArray(row.required_data_sources),
    requiredPromptSops: asStringArray(row.required_prompt_sops),
    approvalRules: String(row.approval_rules ?? ""),
    complianceRules: String(row.compliance_rules ?? ""),
    escalationRules: String(row.escalation_rules ?? ""),
    outputFormat: String(row.output_format ?? ""),
    toneRules: String(row.tone_rules ?? ""),
    successMetrics: asStringArray(row.success_metrics),
    status: asStatus(row.status),
    lastReviewedAt: asNullableString(row.last_reviewed_at),
    notes: asNullableString(row.notes),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function mapPromptChain(row: GenericRow, steps: AiPromptChainStep[]): AiPromptChain {
  return {
    id: String(row.id),
    chainName: String(row.chain_name ?? ""),
    category: String(row.category ?? "Uncategorized"),
    purpose: String(row.purpose ?? ""),
    requiredInputs: asStringArray(row.required_inputs),
    sourceAssets: asStringArray(row.source_assets),
    approvalPoints: asStringArray(row.approval_points),
    runStatus: String(row.run_status ?? "ready"),
    status: asStatus(row.status),
    lastReviewedAt: asNullableString(row.last_reviewed_at),
    notes: asNullableString(row.notes),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
    steps,
  };
}

function mapChainStep(row: GenericRow): AiPromptChainStep {
  return {
    id: String(row.id),
    chainId: String(row.chain_id),
    stepOrder: Number(row.step_order ?? 1),
    stepName: String(row.step_name ?? ""),
    requiredInputs: asStringArray(row.required_inputs),
    sourceAssets: asStringArray(row.source_assets),
    outputSummary: String(row.output_summary ?? ""),
    approvalRequired: Boolean(row.approval_required ?? true),
    runStatus: String(row.run_status ?? "ready"),
    notes: asNullableString(row.notes),
  };
}

function mapOutput(row: GenericRow): AiOutput {
  const approvalStatus = String(row.approval_status ?? "needs_review");
  const verificationStatus = String(row.verification_status ?? "pending");
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    agentName: asNullableString(row.agent_name),
    workflow: asNullableString(row.workflow),
    outputType: String(row.output_type ?? "draft"),
    content: String(row.content ?? ""),
    dataSources: asStringArray(row.data_sources),
    promptSopName: asNullableString(row.prompt_sop_name),
    chainName: asNullableString(row.chain_name),
    approvalStatus:
      approvalStatus === "draft" ||
      approvalStatus === "approved" ||
      approvalStatus === "rejected" ||
      approvalStatus === "revision_needed" ||
      approvalStatus === "sent" ||
      approvalStatus === "archived"
        ? approvalStatus
        : "needs_review",
    verificationStatus:
      verificationStatus === "verified" || verificationStatus === "failed" || verificationStatus === "needs_review"
        ? verificationStatus
        : "pending",
    winningOutput: Boolean(row.winning_output),
    status: asStatus(row.status),
    notes: asNullableString(row.notes),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function mapVerificationCheck(row: GenericRow): AiVerificationCheck {
  const status = String(row.status ?? "not_started");
  return {
    id: String(row.id),
    outputId: asNullableString(row.output_id),
    label: String(row.label ?? ""),
    category: String(row.category ?? "general"),
    status:
      status === "verified" || status === "failed" || status === "needs_review"
        ? status
        : "not_started",
    required: Boolean(row.required ?? true),
    completedAt: asNullableString(row.completed_at),
    notes: asNullableString(row.notes),
  };
}

function mapOutputReview(row: GenericRow): AiOutputReview {
  return {
    id: String(row.id),
    outputId: asNullableString(row.output_id),
    reviewStatus: String(row.review_status ?? "needs_review"),
    reviewNotes: asNullableString(row.review_notes),
    checklist: isRecord(row.checklist) ? row.checklist : {},
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
