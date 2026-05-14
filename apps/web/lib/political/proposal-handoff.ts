import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { CreateOutreachLeadInput } from "./leads";
import {
  createProposalFromStrategySnapshot,
  type ProposalRow,
  type StrategyProposalScenarioInput,
} from "./proposals";

export type PlannerIntent = "request_review" | "generate_proposal";

export interface PlannerSnapshotInput {
  strategySnapshot?: Record<string, unknown> | null;
  selectedScenarioSnapshot?: Record<string, unknown> | null;
  scenarioComparisonSnapshot?: unknown[] | null;
  routeCoverageSnapshot?: Record<string, unknown> | null;
  selectedRouteIds?: string[] | null;
}

export interface ProposalHandoffResult {
  candidateId: string;
  campaignId: string;
  proposal: ProposalRow;
  proposalUrl: string;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function money(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function pct(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : null;
}

function legacyGeography(input: CreateOutreachLeadInput) {
  return {
    county: input.geographyType === "county" ? clean(input.geographyValue) : null,
    city: input.geographyType === "city" ? clean(input.geographyValue) : null,
    district: input.geographyType === "district" ? clean(input.geographyValue) : null,
  };
}

function normalizeScenario(
  snapshots: PlannerSnapshotInput,
): StrategyProposalScenarioInput | null {
  const raw = snapshots.selectedScenarioSnapshot ?? {};
  const households = money(raw.households);
  const drops = money(raw.drops);
  const totalPieces = money(raw.totalPieces) || households * drops;
  const totalCostCents = money(raw.totalCostCents);

  if (households <= 0 || drops <= 0 || totalPieces <= 0 || totalCostCents <= 0) {
    return null;
  }

  return {
    kind: typeof raw.kind === "string" ? raw.kind : null,
    label: typeof raw.label === "string" ? raw.label : "Campaign Mail Plan",
    strategy: typeof raw.strategy === "string" ? raw.strategy : null,
    routeCount: money(raw.routeCount),
    households,
    coveragePct: pct(raw.coveragePct),
    drops,
    totalPieces,
    totalCostCents,
    costPerHouseholdCents: money(raw.costPerHouseholdCents),
    estimatedImpressions: money(raw.estimatedImpressions),
    tradeoff: typeof raw.tradeoff === "string" ? raw.tradeoff : null,
  };
}

function campaignName(input: CreateOutreachLeadInput): string {
  return (
    clean(input.organizationName) ??
    clean(input.candidateName) ??
    `${input.contactName.trim()} Campaign Mail Plan`
  );
}

function candidateName(input: CreateOutreachLeadInput): string {
  return (
    clean(input.candidateName) ??
    clean(input.organizationName) ??
    input.contactName.trim()
  );
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";
}

export async function createProposalHandoffFromPlanner(
  leadId: string,
  input: CreateOutreachLeadInput,
  snapshots: PlannerSnapshotInput,
): Promise<ProposalHandoffResult> {
  const scenario = normalizeScenario(snapshots);
  if (!scenario) {
    throw new Error("Selected scenario is missing cost, reach, or drop data.");
  }

  const sb = createServiceClient();
  const districtType = input.districtType ?? "local";
  const geographyType = input.geographyType ?? "state";
  const geographyValue = clean(input.geographyValue) ?? input.state ?? "OH";
  const state = (input.state ?? "OH").trim().toUpperCase().slice(0, 2) || "OH";
  const geo = legacyGeography(input);
  const now = new Date().toISOString();

  const { data: candidate, error: candidateError } = await sb
    .from("campaign_candidates")
    .insert({
      candidate_name: candidateName(input),
      office_sought: clean(input.officeSought),
      race_level: districtType,
      election_date: clean(input.electionDate),
      state,
      ...geo,
      geography_type: geographyType,
      geography_value: geographyValue,
      district_type: districtType,
      candidate_status: "active",
      campaign_email: input.contactEmail.trim().toLowerCase(),
      campaign_phone: clean(input.contactPhone),
      campaign_manager_name: input.contactName.trim(),
      campaign_manager_email: input.contactEmail.trim().toLowerCase(),
      source_type: "public_portal",
      data_verified_at: now,
      status: "active",
      notes: clean(input.notes),
    })
    .select("id")
    .single();

  if (candidateError || !candidate) {
    throw new Error(`createProposalHandoff candidate: ${candidateError?.message ?? "no row"}`);
  }

  const candidateId = candidate.id as string;

  const { data: campaign, error: campaignError } = await sb
    .from("political_campaigns")
    .insert({
      candidate_id: candidateId,
      campaign_name: campaignName(input),
      office: clean(input.officeSought),
      race_type: districtType,
      ...geo,
      geography_type: geographyType,
      geography_value: geographyValue,
      district_type: districtType,
      stage: "proposal_sent",
      pipeline_status: "proposal_sent",
      estimated_deal_value_cents: scenario.totalCostCents,
      budget_estimate_cents: input.budgetEstimateCents ?? scenario.totalCostCents,
      election_date: clean(input.electionDate),
    })
    .select("id")
    .single();

  if (campaignError || !campaign) {
    throw new Error(`createProposalHandoff campaign: ${campaignError?.message ?? "no row"}`);
  }

  const campaignId = campaign.id as string;

  const { error: contactError } = await sb
    .from("political_campaign_contacts")
    .insert({
      campaign_candidate_id: candidateId,
      campaign_id: campaignId,
      name: input.contactName.trim(),
      role: "Campaign contact",
      email: input.contactEmail.trim().toLowerCase(),
      phone: clean(input.contactPhone),
      is_primary: true,
      preferred_contact_method: clean(input.contactPhone) ? "sms" : "email",
    });

  if (contactError) {
    throw new Error(`createProposalHandoff contact: ${contactError.message}`);
  }

  const proposal = await createProposalFromStrategySnapshot({
    campaignId,
    candidateId,
    createdBy: null,
    scenario,
    strategySnapshot: snapshots.strategySnapshot,
    scenarioComparisonSnapshot: snapshots.scenarioComparisonSnapshot,
    routeCoverageSnapshot: snapshots.routeCoverageSnapshot,
    selectedRouteIds: snapshots.selectedRouteIds,
  });

  const { error: leadUpdateError } = await sb
    .from("political_outreach_leads")
    .update({
      status: "converted",
      converted_to_campaign_id: campaignId,
      proposal_id: proposal.id,
      proposal_generated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (leadUpdateError) {
    console.error("[political/proposal-handoff] lead update failed", leadUpdateError);
  }

  return {
    candidateId,
    campaignId,
    proposal,
    proposalUrl: `${appUrl()}/p/${proposal.publicToken}`,
  };
}
