"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Admin server actions for the political candidate detail page.
//
// - generateQuoteAction: pure preview; returns a PoliticalQuoteResult.
//   No DB writes. Used by the QuoteForm client component to show pricing
//   before the operator commits.
// - createProposalAction: persists the quote as a political_proposals row,
//   returns the public URL so the rep can copy/send it.
//
// Auth posture:
//   - The admin layout already gates this to admin + sales_agent users.
//   - We read the current user via the user-scoped Supabase client to
//     record created_by on the proposal.
//   - DB writes go through the service-role path (proposals.ts uses it
//     so the public flow works uniformly).
//
// Compliance: internal cost / margin / profit are STORED (for reporting)
// but NEVER returned to a client-facing surface. The server action return
// shape explicitly omits them from the public-facing fields.
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { isPoliticalEnabled } from "@/lib/political/env";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { loadCandidate } from "@/lib/political/queries";
import {
  createProposalFromQuote,
} from "@/lib/political/proposals";
import {
  generatePoliticalQuote,
  type PoliticalQuoteInput,
  type PoliticalQuoteResult,
} from "@/lib/political/quote";
import type { DistrictType, GeographyType } from "@/lib/political/queries";
import {
  sendPoliticalSms,
  sendPoliticalEmail,
  logPoliticalCall,
  logPoliticalFacebook,
} from "@/lib/political/outreach";
import { createServiceClient } from "@/lib/supabase/service";

// ── Shared error envelope ────────────────────────────────────────────────────

export type ActionError = { error: string };
export type ActionOk<T> = { ok: true; data: T };
export type ActionResult<T> = ActionOk<T> | ActionError;

function fail(error: string): ActionError {
  return { error };
}
function ok<T>(data: T): ActionOk<T> {
  return { ok: true, data };
}

function requireFlag(): ActionError | null {
  if (!isPoliticalEnabled()) {
    return fail("Political Command Center is disabled. Set ENABLE_POLITICAL=true.");
  }
  return null;
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── Quote preview ────────────────────────────────────────────────────────────

export interface GenerateQuoteArgs {
  candidateId: string;
  householdCountOverride?: number | null;
  drops: number;
  daysUntilElection?: number | null;
  addOns: {
    setup: boolean;
    design: boolean;
    rush: boolean;
    targeting: boolean;
    yardSigns?: { quantity: number } | null;
    doorHangers?: { quantity: number } | null;
  };
}

export async function generateQuoteAction(
  args: GenerateQuoteArgs,
): Promise<ActionResult<PoliticalQuoteResult>> {
  const flag = requireFlag();
  if (flag) return flag;

  const candidate = await loadCandidate(args.candidateId);
  if (!candidate) return fail("Candidate not found.");
  if (!candidate.geographyType || !candidate.geographyValue) {
    return fail(
      "Candidate has no geography set. Populate geography_type + geography_value before generating a quote.",
    );
  }
  if (!candidate.districtType) {
    return fail(
      "Candidate has no district_type. Set district_type (federal/state/local) first.",
    );
  }

  const input: PoliticalQuoteInput = {
    state: candidate.state,
    geographyType: candidate.geographyType as GeographyType,
    geographyValue: candidate.geographyValue,
    districtType: candidate.districtType as DistrictType,
    drops: args.drops,
    daysUntilElection: args.daysUntilElection ?? null,
    addOns: {
      setup: args.addOns.setup,
      design: args.addOns.design,
      rush: args.addOns.rush,
      targeting: args.addOns.targeting,
      ...(args.addOns.yardSigns ? { yardSigns: args.addOns.yardSigns } : {}),
      ...(args.addOns.doorHangers ? { doorHangers: args.addOns.doorHangers } : {}),
    },
    ...(typeof args.householdCountOverride === "number"
      ? { householdCountOverride: args.householdCountOverride }
      : {}),
  };

  try {
    const quote = generatePoliticalQuote(input);
    return ok(quote);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Unknown error generating quote.");
  }
}

// ── Persist as proposal ──────────────────────────────────────────────────────

export interface CreateProposalArgs extends GenerateQuoteArgs {
  /** If set, the engine will fail loudly on tight / warning conditions. */
  campaignId: string;
}

export interface CreateProposalResultData {
  proposalId: string;
  publicUrl: string;
  publicToken: string;
  totalInvestmentCents: number;
}

export async function createProposalAction(
  args: CreateProposalArgs,
): Promise<ActionResult<CreateProposalResultData>> {
  const flag = requireFlag();
  if (flag) return flag;

  const quoteRes = await generateQuoteAction(args);
  if ("error" in quoteRes) return quoteRes;

  const candidate = await loadCandidate(args.candidateId);
  if (!candidate) return fail("Candidate not found.");

  const createdBy = await currentUserId();

  try {
    const proposal = await createProposalFromQuote({
      candidateId: args.candidateId,
      campaignId: args.campaignId,
      createdBy,
      quote: quoteRes.data,
    });

    if (!proposal.publicToken) {
      return fail("Internal error: proposal saved without a public token.");
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";
    const publicUrl = `${appUrl}/p/${proposal.publicToken}`;

    revalidatePath(`/admin/political/${args.candidateId}`);

    return ok({
      proposalId: proposal.id,
      publicUrl,
      publicToken: proposal.publicToken,
      totalInvestmentCents: proposal.totalInvestmentCents,
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Unknown error creating proposal.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6: Outreach actions
//
// Each action:
//   1. Checks the political flag.
//   2. Captures the current user id (written into sales_events.agent_id).
//   3. Delegates to the outreach service, which enforces compliance +
//      logs the event into sales_events with political_campaign_id set.
// ─────────────────────────────────────────────────────────────────────────────

export interface SendSmsArgs {
  campaignId: string;
  candidateId: string;
  contactId?: string | null;
  to: string;
  body: string;
  scriptSlug?: string | null;
}

export interface SendEmailArgs {
  campaignId: string;
  candidateId: string;
  contactId?: string | null;
  to: string;
  subject: string;
  body: string;
  scriptSlug?: string | null;
}

export interface LogCallArgs {
  campaignId: string;
  candidateId: string;
  contactId?: string | null;
  toPhone: string;
  outcome: string;
  scriptSlug?: string | null;
}

export interface LogFacebookArgs {
  campaignId: string;
  candidateId: string;
  contactId?: string | null;
  messengerUrl?: string | null;
  body: string;
  scriptSlug?: string | null;
}

export interface OutreachActionOk {
  eventId: string;
  providerExternalId?: string | null;
}

function textToHtml(body: string): string {
  // Server-side HTML conversion. HTML-escape first, then convert newlines to <br>.
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped.replace(/\r?\n/g, "<br/>");
}

export async function sendSmsAction(args: SendSmsArgs): Promise<ActionResult<OutreachActionOk>> {
  const flag = requireFlag();
  if (flag) return flag;
  const agentId = await currentUserId();

  const result = await sendPoliticalSms({
    campaignId: args.campaignId,
    candidateId: args.candidateId,
    contactId: args.contactId ?? null,
    agentId,
    scriptSlug: args.scriptSlug ?? null,
    to: args.to,
    body: args.body,
  });

  if (!result.ok) return fail(result.error);
  revalidatePath(`/admin/political/${args.candidateId}`);
  return ok({
    eventId: result.eventId,
    providerExternalId: result.providerExternalId ?? null,
  });
}

export async function sendEmailAction(args: SendEmailArgs): Promise<ActionResult<OutreachActionOk>> {
  const flag = requireFlag();
  if (flag) return flag;
  const agentId = await currentUserId();

  const html = textToHtml(args.body);

  const result = await sendPoliticalEmail({
    campaignId: args.campaignId,
    candidateId: args.candidateId,
    contactId: args.contactId ?? null,
    agentId,
    scriptSlug: args.scriptSlug ?? null,
    to: args.to,
    subject: args.subject,
    html,
    text: args.body,
  });

  if (!result.ok) return fail(result.error);
  revalidatePath(`/admin/political/${args.candidateId}`);
  return ok({
    eventId: result.eventId,
    providerExternalId: result.providerExternalId ?? null,
  });
}

export async function logCallAction(args: LogCallArgs): Promise<ActionResult<OutreachActionOk>> {
  const flag = requireFlag();
  if (flag) return flag;
  const agentId = await currentUserId();

  const result = await logPoliticalCall({
    campaignId: args.campaignId,
    candidateId: args.candidateId,
    contactId: args.contactId ?? null,
    agentId,
    scriptSlug: args.scriptSlug ?? null,
    toPhone: args.toPhone,
    outcome: args.outcome,
  });

  if (!result.ok) return fail(result.error);
  revalidatePath(`/admin/political/${args.candidateId}`);
  return ok({ eventId: result.eventId });
}

export async function logFacebookAction(args: LogFacebookArgs): Promise<ActionResult<OutreachActionOk>> {
  const flag = requireFlag();
  if (flag) return flag;
  const agentId = await currentUserId();

  const result = await logPoliticalFacebook({
    campaignId: args.campaignId,
    candidateId: args.candidateId,
    contactId: args.contactId ?? null,
    agentId,
    scriptSlug: args.scriptSlug ?? null,
    messengerUrl: args.messengerUrl ?? null,
    body: args.body,
  });

  if (!result.ok) return fail(result.error);
  revalidatePath(`/admin/political/${args.candidateId}`);
  return ok({ eventId: result.eventId });
}

// ─────────────────────────────────────────────────────────────────────────────
// Follow-up 1: Create a political_campaigns row from the candidate page.
//
// Previously this required manual SQL. Now:
//   - Sales agent or admin triggers the action from the detail page modal
//   - Action uses the service-role client (matches other write paths) but
//     stamps owner_id = current authenticated user so RLS-equivalent
//     semantics are preserved at the app layer
//   - Field defaults are inherited from the candidate (office, district,
//     geography, election_date) to minimize operator input
// ─────────────────────────────────────────────────────────────────────────────

export type DistrictTypeValue = "federal" | "state" | "local";
export type GeographyTypeValue = "state" | "county" | "city" | "district";
export type CampaignPipelineStatus =
  | "prospect"
  | "contacted"
  | "proposal_sent"
  | "won"
  | "lost";

export interface CreateCampaignArgs {
  candidateId: string;
  campaignName: string;
  office?: string | null;
  districtType?: DistrictTypeValue | null;
  geographyType?: GeographyTypeValue | null;
  geographyValue?: string | null;
  pipelineStatus?: CampaignPipelineStatus;
  budgetEstimateCents?: number | null;
  electionDate?: string | null; // YYYY-MM-DD
}

export interface CreateCampaignResultData {
  campaignId: string;
  campaignName: string;
}

export async function createPoliticalCampaignAction(
  args: CreateCampaignArgs,
): Promise<ActionResult<CreateCampaignResultData>> {
  const flag = requireFlag();
  if (flag) return flag;

  // Basic input validation
  const name = args.campaignName?.trim();
  if (!name) return fail("Campaign name is required.");
  if (name.length < 2 || name.length > 200) {
    return fail("Campaign name must be between 2 and 200 characters.");
  }

  if (args.districtType && !["federal", "state", "local"].includes(args.districtType)) {
    return fail(`Invalid district_type: ${args.districtType}`);
  }
  if (
    args.geographyType &&
    !["state", "county", "city", "district"].includes(args.geographyType)
  ) {
    return fail(`Invalid geography_type: ${args.geographyType}`);
  }
  if (
    args.pipelineStatus &&
    !["prospect", "contacted", "proposal_sent", "won", "lost"].includes(args.pipelineStatus)
  ) {
    return fail(`Invalid pipeline_status: ${args.pipelineStatus}`);
  }

  if (args.budgetEstimateCents !== undefined && args.budgetEstimateCents !== null) {
    if (
      !Number.isFinite(args.budgetEstimateCents) ||
      args.budgetEstimateCents < 0 ||
      args.budgetEstimateCents > 1_000_000_000_000
    ) {
      return fail("Budget estimate must be a non-negative integer cents value.");
    }
  }

  if (args.electionDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.electionDate)) {
      return fail("Election date must be in YYYY-MM-DD format.");
    }
  }

  // Load candidate to verify it exists + pull defaults.
  const candidate = await loadCandidate(args.candidateId);
  if (!candidate) return fail("Candidate not found.");

  const ownerId = await currentUserId();
  if (!ownerId) return fail("Not authenticated.");

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("political_campaigns")
    .insert({
      candidate_id:            candidate.id,
      campaign_name:           name,
      office:                  args.office ?? candidate.officeSought ?? null,
      district_type:           args.districtType ?? candidate.districtType ?? null,
      geography_type:          args.geographyType ?? candidate.geographyType ?? null,
      geography_value:         args.geographyValue ?? candidate.geographyValue ?? null,
      pipeline_status:         args.pipelineStatus ?? "prospect",
      budget_estimate_cents:   args.budgetEstimateCents ?? null,
      owner_id:                ownerId,
      election_date:           args.electionDate ?? candidate.electionDate ?? null,
    })
    .select("id, campaign_name")
    .single();

  if (error || !data) {
    return fail(`createPoliticalCampaign: ${error?.message ?? "no row returned"}`);
  }

  revalidatePath(`/admin/political/${candidate.id}`);
  revalidatePath("/admin/political");

  const row = data as unknown as { id: string; campaign_name: string };
  return ok({ campaignId: row.id, campaignName: row.campaign_name });
}
