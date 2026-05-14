// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Political Command Center: Proposal + Order server helpers
//
// Two query surfaces:
//   (1) User-scoped reads through the Supabase server client (admin pages).
//       Uses RLS per migration 061 — admin sees all; sales_agent can
//       read all proposals but only update their own; client = none.
//   (2) Service-role reads/writes for the public /p/[token] flow, where
//       the 32-byte public_token is the authentication. No Supabase Auth
//       session exists on that path.
//
// All writes go through the service-role client — the public flow needs
// it (no user), and admin-driven writes are idempotent enough that using
// service role is acceptable for Phase 4. Later phases can tighten.
//
// This module does NOT import "server-only" at the top; some of its pure
// helpers (random token generation, snapshot extraction) are safe in any
// runtime. The DB-touching helpers explicitly throw if called on the client.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";

import { randomBytes } from "node:crypto";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { createServiceClient } from "@homereach/services/auth";
import type {
  PoliticalQuoteResult,
} from "./quote";
import {
  DEFAULT_COST_PER_PIECE_CENTS,
  MINIMUM_TOTAL_PIECES,
  resolveVolumeBand,
} from "./pricing-config";

// ── Types mirroring the DB rows ──────────────────────────────────────────────

export type ProposalStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "approved"
  | "declined"
  | "expired";

export type PaymentStatus =
  | "pending"
  | "deposit_paid"
  | "paid"
  | "failed"
  | "refunded"
  | "canceled";

export type FulfillmentStatus =
  | "pending"
  | "production"
  | "mailed"
  | "delivered"
  | "completed"
  | "canceled";

export type PaymentMode = "deposit" | "full";

export interface ProposalRow {
  id: string;
  campaignId: string;
  candidateId: string;
  status: ProposalStatus;
  sentAt: string | null;
  viewedAt: string | null;
  approvedAt: string | null;
  declinedAt: string | null;
  expiresAt: string | null;
  publicToken: string | null;
  createdBy: string | null;

  /** Full PoliticalQuoteResult as jsonb. May be empty ({}) for legacy drafts. */
  pricingSnapshot: Record<string, unknown>;

  households: number;
  drops: number;
  totalPieces: number;
  totalInvestmentCents: number;
  internalCostCents: number;
  internalMarginCents: number;

  deliveryWindowText: string | null;

  resendCount: number;
  lastResentAt: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface OrderRow {
  id: string;
  proposalId: string;
  campaignId: string;

  totalCents: number;
  amountPaidCents: number;
  paymentMode: PaymentMode | null;
  paymentStatus: PaymentStatus;

  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;

  fulfillmentStatus: FulfillmentStatus;

  approvedAt: string | null;
  paidAt: string | null;
  fulfillmentStartedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;

  notes: string | null;

  createdAt: string;
  updatedAt: string;
}

/** Minimal candidate + campaign context needed for the public /p/[token] view. */
export interface PublicProposalContext {
  proposal: ProposalRow;
  candidateName: string;
  candidateOffice: string | null;
  campaignName: string;
  state: string;
  geographyType: string | null;
  geographyValue: string | null;
  districtType: string | null;
  electionDate: string | null;
}

// ── Column lists ─────────────────────────────────────────────────────────────

const PROPOSAL_COLUMNS = [
  "id",
  "campaign_id",
  "candidate_id",
  "status",
  "sent_at",
  "viewed_at",
  "approved_at",
  "declined_at",
  "expires_at",
  "public_token",
  "created_by",
  "pricing_snapshot",
  "households",
  "drops",
  "total_pieces",
  "total_investment_cents",
  "internal_cost_cents",
  "internal_margin_cents",
  "delivery_window_text",
  "resend_count",
  "last_resent_at",
  "created_at",
  "updated_at",
].join(", ");

const ORDER_COLUMNS = [
  "id",
  "proposal_id",
  "campaign_id",
  "total_cents",
  "amount_paid_cents",
  "payment_mode",
  "payment_status",
  "stripe_checkout_session_id",
  "stripe_payment_intent_id",
  "stripe_customer_id",
  "fulfillment_status",
  "approved_at",
  "paid_at",
  "fulfillment_started_at",
  "completed_at",
  "canceled_at",
  "notes",
  "created_at",
  "updated_at",
].join(", ");

// ── Mappers ──────────────────────────────────────────────────────────────────

interface ProposalDbRow {
  id: string;
  campaign_id: string;
  candidate_id: string;
  status: ProposalStatus;
  sent_at: string | null;
  viewed_at: string | null;
  approved_at: string | null;
  declined_at: string | null;
  expires_at: string | null;
  public_token: string | null;
  created_by: string | null;
  pricing_snapshot: Record<string, unknown> | null;
  households: number | string;
  drops: number;
  total_pieces: number | string;
  total_investment_cents: number | string;
  internal_cost_cents: number | string;
  internal_margin_cents: number | string;
  delivery_window_text: string | null;
  resend_count: number;
  last_resent_at: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderDbRow {
  id: string;
  proposal_id: string;
  campaign_id: string;
  total_cents: number | string;
  amount_paid_cents: number | string;
  payment_mode: PaymentMode | null;
  payment_status: PaymentStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  fulfillment_status: FulfillmentStatus;
  approved_at: string | null;
  paid_at: string | null;
  fulfillment_started_at: string | null;
  completed_at: string | null;
  canceled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Postgres bigint returns as string via supabase-js; normalize to number
 *  for JS-safe values (all our amounts stay under 2^53). */
function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function rowToProposal(r: ProposalDbRow): ProposalRow {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    candidateId: r.candidate_id,
    status: r.status,
    sentAt: r.sent_at,
    viewedAt: r.viewed_at,
    approvedAt: r.approved_at,
    declinedAt: r.declined_at,
    expiresAt: r.expires_at,
    publicToken: r.public_token,
    createdBy: r.created_by,
    pricingSnapshot: r.pricing_snapshot ?? {},
    households: num(r.households),
    drops: r.drops,
    totalPieces: num(r.total_pieces),
    totalInvestmentCents: num(r.total_investment_cents),
    internalCostCents: num(r.internal_cost_cents),
    internalMarginCents: num(r.internal_margin_cents),
    deliveryWindowText: r.delivery_window_text,
    resendCount: r.resend_count,
    lastResentAt: r.last_resent_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToOrder(r: OrderDbRow): OrderRow {
  return {
    id: r.id,
    proposalId: r.proposal_id,
    campaignId: r.campaign_id,
    totalCents: num(r.total_cents),
    amountPaidCents: num(r.amount_paid_cents),
    paymentMode: r.payment_mode,
    paymentStatus: r.payment_status,
    stripeCheckoutSessionId: r.stripe_checkout_session_id,
    stripePaymentIntentId: r.stripe_payment_intent_id,
    stripeCustomerId: r.stripe_customer_id,
    fulfillmentStatus: r.fulfillment_status,
    approvedAt: r.approved_at,
    paidAt: r.paid_at,
    fulfillmentStartedAt: r.fulfillment_started_at,
    completedAt: r.completed_at,
    canceledAt: r.canceled_at,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── Token generation ─────────────────────────────────────────────────────────

/**
 * Generates a 32-byte (64 hex char) opaque token. Collision probability
 * is negligible; the partial unique index on public_token enforces it
 * at the DB level as belt-and-suspenders.
 */
export function generatePublicToken(): string {
  return randomBytes(32).toString("hex");
}

// ── Snapshot extraction ──────────────────────────────────────────────────────
//
// When createProposalFromQuote runs, we persist the full PoliticalQuoteResult
// as jsonb AND denormalize the hot fields onto dedicated columns.

interface SnapshotSummary {
  households: number;
  drops: number;
  totalPieces: number;
  totalInvestmentCents: number;
  internalCostCents: number;
  internalMarginCents: number;
  deliveryWindowText: string;
}

function extractSnapshotSummary(q: PoliticalQuoteResult): SnapshotSummary {
  return {
    households: q.estimatedHouseholds,
    drops: q.input.drops,
    totalPieces: q.totalPieces,
    totalInvestmentCents: q.totalCents,
    internalCostCents: q.internal.totalCostCents,
    internalMarginCents: q.internal.totalMarginCents,
    deliveryWindowText: q.clientSummary.deliveryWindowText,
  };
}

// ── Admin reads (user-scoped, RLS) ──────────────────────────────────────────

/** Admin/sales read of proposals for a specific candidate. Newest first. */
export async function listProposalsForCandidate(candidateId: string): Promise<ProposalRow[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("political_proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listProposalsForCandidate: ${error.message}`);
  return ((data ?? []) as unknown as ProposalDbRow[]).map(rowToProposal);
}

/** Admin/sales read of a single proposal by id. Null on miss. */
export async function loadProposalById(proposalId: string): Promise<ProposalRow | null> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("political_proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("id", proposalId)
    .maybeSingle();
  if (error) throw new Error(`loadProposalById: ${error.message}`);
  if (!data) return null;
  return rowToProposal(data as unknown as ProposalDbRow);
}

/** Admin/sales read of all orders for a proposal. Newest first. */
export async function listOrdersForProposal(proposalId: string): Promise<OrderRow[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("political_orders")
    .select(ORDER_COLUMNS)
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listOrdersForProposal: ${error.message}`);
  return ((data ?? []) as unknown as OrderDbRow[]).map(rowToOrder);
}

// ── Token-gated public read (service role) ──────────────────────────────────

/**
 * Loads proposal + candidate + campaign context by public_token.
 * Used by /p/[token]. Service-role client since no Supabase Auth is present.
 *
 * Refuses to return anything when status is 'draft' — a draft proposal must
 * be explicitly 'sent' before the public link activates.
 */
export async function loadPublicProposal(token: string): Promise<PublicProposalContext | null> {
  if (!token || token.length < 32) return null;
  const admin = createServiceClient();

  const { data: proposalData, error: proposalErr } = await admin
    .from("political_proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("public_token", token)
    .maybeSingle();
  if (proposalErr) throw new Error(`loadPublicProposal: ${proposalErr.message}`);
  if (!proposalData) return null;

  const proposal = rowToProposal(proposalData as unknown as ProposalDbRow);

  // A draft proposal means a sales agent hasn't sent it yet. Refuse public access.
  if (proposal.status === "draft") return null;

  // Expiration check — explicit status, no DB trigger.
  if (proposal.expiresAt && new Date(proposal.expiresAt).getTime() < Date.now()) {
    // Return null for expired — page renders its own "this link has expired" state.
    return null;
  }

  const { data: candidateData, error: candErr } = await admin
    .from("campaign_candidates")
    .select("candidate_name, office_sought, state, geography_type, geography_value, district_type, election_date")
    .eq("id", proposal.candidateId)
    .maybeSingle();
  if (candErr) throw new Error(`loadPublicProposal candidate: ${candErr.message}`);
  if (!candidateData) return null;

  const { data: campaignData, error: campErr } = await admin
    .from("political_campaigns")
    .select("campaign_name")
    .eq("id", proposal.campaignId)
    .maybeSingle();
  if (campErr) throw new Error(`loadPublicProposal campaign: ${campErr.message}`);
  if (!campaignData) return null;

  const cand = candidateData as {
    candidate_name: string;
    office_sought: string | null;
    state: string;
    geography_type: string | null;
    geography_value: string | null;
    district_type: string | null;
    election_date: string | null;
  };
  const camp = campaignData as { campaign_name: string };

  return {
    proposal,
    candidateName: cand.candidate_name,
    candidateOffice: cand.office_sought,
    campaignName: camp.campaign_name,
    state: cand.state,
    geographyType: cand.geography_type,
    geographyValue: cand.geography_value,
    districtType: cand.district_type,
    electionDate: cand.election_date,
  };
}

// ── Writes (service role) ────────────────────────────────────────────────────

export interface CreateProposalInput {
  campaignId: string;
  candidateId: string;
  createdBy: string | null;
  quote: PoliticalQuoteResult;
  /** Default: 30 days from now. */
  expiresAt?: Date;
}

/**
 * Creates a proposal with status='sent' and a fresh public_token. Stores the
 * full quote snapshot + denormalized hot fields. Returns the new row.
 */
export async function createProposalFromQuote(
  input: CreateProposalInput,
): Promise<ProposalRow> {
  const admin = createServiceClient();
  const summary = extractSnapshotSummary(input.quote);
  const token = generatePublicToken();
  const expiresAt =
    input.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await admin
    .from("political_proposals")
    .insert({
      campaign_id:              input.campaignId,
      candidate_id:             input.candidateId,
      status:                   "sent",
      sent_at:                  new Date().toISOString(),
      expires_at:               expiresAt.toISOString(),
      public_token:             token,
      created_by:               input.createdBy,
      pricing_snapshot:         input.quote as unknown as Record<string, unknown>,
      households:               summary.households,
      drops:                    summary.drops,
      total_pieces:             summary.totalPieces,
      total_investment_cents:   summary.totalInvestmentCents,
      internal_cost_cents:      summary.internalCostCents,
      internal_margin_cents:    summary.internalMarginCents,
      delivery_window_text:     summary.deliveryWindowText,
    })
    .select(PROPOSAL_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(`createProposalFromQuote: ${error?.message ?? "no row returned"}`);
  }
  return rowToProposal(data as unknown as ProposalDbRow);
}

export interface StrategyProposalScenarioInput {
  kind?: string | null;
  label?: string | null;
  strategy?: string | null;
  routeCount?: number | null;
  households: number;
  coveragePct?: number | null;
  drops: number;
  totalPieces: number;
  totalCostCents: number;
  costPerHouseholdCents?: number | null;
  estimatedImpressions?: number | null;
  tradeoff?: string | null;
}

export interface CreateProposalFromStrategyInput {
  campaignId: string;
  candidateId: string;
  createdBy: string | null;
  scenario: StrategyProposalScenarioInput;
  strategySnapshot?: Record<string, unknown> | null;
  scenarioComparisonSnapshot?: unknown[] | null;
  routeCoverageSnapshot?: Record<string, unknown> | null;
  selectedRouteIds?: string[] | null;
  expiresAt?: Date;
}

function internalCostFromScenario(scenario: StrategyProposalScenarioInput): number {
  const billablePieces = Math.max(MINIMUM_TOTAL_PIECES, Math.floor(scenario.totalPieces));
  const band = resolveVolumeBand(billablePieces);
  return DEFAULT_COST_PER_PIECE_CENTS[band] * billablePieces;
}

/**
 * Creates a public proposal from the public campaign planner's selected
 * scenario. Used by the /political self-serve path after the system has
 * created the candidate + campaign shell.
 */
export async function createProposalFromStrategySnapshot(
  input: CreateProposalFromStrategyInput,
): Promise<ProposalRow> {
  const admin = createServiceClient();
  const token = generatePublicToken();
  const expiresAt =
    input.expiresAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const households = Math.max(0, Math.floor(input.scenario.households));
  const drops = Math.max(1, Math.floor(input.scenario.drops));
  const totalPieces = Math.max(0, Math.floor(input.scenario.totalPieces));
  const totalInvestmentCents = Math.max(0, Math.floor(input.scenario.totalCostCents));

  if (households <= 0 || drops <= 0 || totalPieces <= 0 || totalInvestmentCents <= 0) {
    throw new Error("createProposalFromStrategySnapshot: selected scenario is not proposal-ready");
  }

  const internalCostCents = internalCostFromScenario(input.scenario);
  const internalMarginCents = Math.max(0, totalInvestmentCents - internalCostCents);

  const pricingSnapshot = {
    source: "public_campaign_strategy_planner",
    scenario: input.scenario,
    strategySnapshot: input.strategySnapshot ?? {},
    scenarioComparisonSnapshot: input.scenarioComparisonSnapshot ?? [],
    routeCoverageSnapshot: input.routeCoverageSnapshot ?? {},
    selectedRouteIds: input.selectedRouteIds ?? [],
    clientSummary: {
      households,
      drops,
      totalPieces,
      totalInvestmentCents,
      deliveryWindowText: "~12-19 business days from approval",
    },
    internal: {
      estimatedCostCents: internalCostCents,
      estimatedMarginCents: internalMarginCents,
    },
  };

  const { data, error } = await admin
    .from("political_proposals")
    .insert({
      campaign_id: input.campaignId,
      candidate_id: input.candidateId,
      status: "sent",
      sent_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      public_token: token,
      created_by: input.createdBy,
      pricing_snapshot: pricingSnapshot,
      households,
      drops,
      total_pieces: totalPieces,
      total_investment_cents: totalInvestmentCents,
      internal_cost_cents: internalCostCents,
      internal_margin_cents: internalMarginCents,
      delivery_window_text: "~12-19 business days from approval",
    })
    .select(PROPOSAL_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(`createProposalFromStrategySnapshot: ${error?.message ?? "no row returned"}`);
  }

  return rowToProposal(data as unknown as ProposalDbRow);
}

/**
 * Records a first view on a proposal (idempotent — subsequent views don't
 * overwrite viewed_at). Transitions sent → viewed.
 */
export async function markProposalViewed(token: string): Promise<void> {
  const admin = createServiceClient();
  const { data: proposalData, error } = await admin
    .from("political_proposals")
    .select("id, status, viewed_at")
    .eq("public_token", token)
    .maybeSingle();
  if (error) throw new Error(`markProposalViewed lookup: ${error.message}`);
  if (!proposalData) return;
  const row = proposalData as { id: string; status: ProposalStatus; viewed_at: string | null };
  if (row.viewed_at) return; // idempotent
  if (row.status !== "sent") return;

  const { error: updErr } = await admin
    .from("political_proposals")
    .update({
      status: "viewed",
      viewed_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (updErr) throw new Error(`markProposalViewed update: ${updErr.message}`);
}

/** Approves the proposal + creates a pending political_order. Idempotent. */
export async function approveProposalByToken(
  token: string,
): Promise<{ proposal: ProposalRow; order: OrderRow }> {
  const admin = createServiceClient();
  const { data: proposalData, error } = await admin
    .from("political_proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("public_token", token)
    .maybeSingle();
  if (error) throw new Error(`approveProposal lookup: ${error.message}`);
  if (!proposalData) throw new Error("approveProposal: proposal not found");

  const proposal = rowToProposal(proposalData as unknown as ProposalDbRow);
  if (proposal.status === "declined" || proposal.status === "expired") {
    throw new Error(`approveProposal: proposal is ${proposal.status}, cannot approve`);
  }

  // Idempotent: if already approved, reuse existing order.
  let approvedProposal = proposal;
  if (proposal.status !== "approved") {
    const { data: updData, error: updErr } = await admin
      .from("political_proposals")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", proposal.id)
      .select(PROPOSAL_COLUMNS)
      .single();
    if (updErr || !updData) throw new Error(`approveProposal update: ${updErr?.message ?? "no row"}`);
    approvedProposal = rowToProposal(updData as unknown as ProposalDbRow);
  }

  // Find-or-create the order.
  const { data: existingOrders, error: orderErr } = await admin
    .from("political_orders")
    .select(ORDER_COLUMNS)
    .eq("proposal_id", proposal.id)
    .order("created_at", { ascending: false });
  if (orderErr) throw new Error(`approveProposal order lookup: ${orderErr.message}`);

  let order: OrderRow;
  if (existingOrders && existingOrders.length > 0) {
    order = rowToOrder(existingOrders[0] as unknown as OrderDbRow);
  } else {
    const { data: insData, error: insErr } = await admin
      .from("political_orders")
      .insert({
        proposal_id: proposal.id,
        campaign_id: proposal.campaignId,
        total_cents: proposal.totalInvestmentCents,
        amount_paid_cents: 0,
        payment_status: "pending",
        fulfillment_status: "pending",
        approved_at: new Date().toISOString(),
      })
      .select(ORDER_COLUMNS)
      .single();
    if (insErr || !insData) throw new Error(`approveProposal order insert: ${insErr?.message ?? "no row"}`);
    order = rowToOrder(insData as unknown as OrderDbRow);
  }

  return { proposal: approvedProposal, order };
}

/** Declines the proposal. Idempotent. */
export async function declineProposalByToken(token: string): Promise<ProposalRow> {
  const admin = createServiceClient();
  const { data: proposalData, error } = await admin
    .from("political_proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("public_token", token)
    .maybeSingle();
  if (error) throw new Error(`declineProposal lookup: ${error.message}`);
  if (!proposalData) throw new Error("declineProposal: proposal not found");
  const proposal = rowToProposal(proposalData as unknown as ProposalDbRow);

  if (proposal.status === "declined") return proposal;
  if (proposal.status === "approved") {
    throw new Error("declineProposal: proposal is already approved; contact sales to cancel the order");
  }

  const { data, error: updErr } = await admin
    .from("political_proposals")
    .update({
      status: "declined",
      declined_at: new Date().toISOString(),
    })
    .eq("id", proposal.id)
    .select(PROPOSAL_COLUMNS)
    .single();
  if (updErr || !data) throw new Error(`declineProposal update: ${updErr?.message ?? "no row"}`);
  return rowToProposal(data as unknown as ProposalDbRow);
}

// ── Payment tracking (service role) ─────────────────────────────────────────

export interface AttachCheckoutInput {
  orderId: string;
  sessionId: string;
  paymentMode: PaymentMode;
  amountCents: number;
}

/** Records the Stripe Checkout session on an order before the customer is
 *  redirected. Lets the success_url poller find the order later. */
export async function attachCheckoutSession(
  input: AttachCheckoutInput,
): Promise<void> {
  const admin = createServiceClient();
  const { error } = await admin
    .from("political_orders")
    .update({
      stripe_checkout_session_id: input.sessionId,
      payment_mode: input.paymentMode,
      // total_cents may differ from amountCents when a deposit is partial.
      // We record the deposit amount via amount_paid_cents when payment completes.
    })
    .eq("id", input.orderId);
  if (error) throw new Error(`attachCheckoutSession: ${error.message}`);
}

export interface PaymentCompletionInput {
  orderId: string;
  sessionId: string;
  paymentIntentId: string | null;
  stripeCustomerId: string | null;
  amountPaidCents: number;
  mode: PaymentMode;
}

/**
 * Called by the /p/[token]?paid=1&session_id=... handler after we retrieve
 * the Stripe session and confirm it's paid. Idempotent via unique indexes on
 * stripe_payment_intent_id and stripe_checkout_session_id.
 */
export async function recordPaymentCompleted(
  input: PaymentCompletionInput,
): Promise<OrderRow> {
  const admin = createServiceClient();
  // Decide payment_status based on mode + accumulated amount vs total.
  const { data: existing, error: exErr } = await admin
    .from("political_orders")
    .select(ORDER_COLUMNS)
    .eq("id", input.orderId)
    .maybeSingle();
  if (exErr || !existing) {
    throw new Error(`recordPaymentCompleted lookup: ${exErr?.message ?? "not found"}`);
  }
  const cur = rowToOrder(existing as unknown as OrderDbRow);

  // Accumulated total paid. If this is the same session (idempotent retry),
  // do not double-count.
  const sameSession = cur.stripeCheckoutSessionId === input.sessionId;
  const newAmountPaid = sameSession
    ? Math.max(cur.amountPaidCents, input.amountPaidCents)
    : cur.amountPaidCents + input.amountPaidCents;

  const reachedTotal = newAmountPaid >= cur.totalCents;
  const paymentStatus: PaymentStatus = reachedTotal
    ? "paid"
    : input.mode === "deposit"
      ? "deposit_paid"
      : "paid";

  const paidAt = reachedTotal || paymentStatus === "deposit_paid"
    ? new Date().toISOString()
    : cur.paidAt;

  const { data, error } = await admin
    .from("political_orders")
    .update({
      stripe_checkout_session_id: input.sessionId,
      stripe_payment_intent_id: input.paymentIntentId,
      stripe_customer_id: input.stripeCustomerId,
      payment_mode: input.mode,
      payment_status: paymentStatus,
      amount_paid_cents: newAmountPaid,
      paid_at: paidAt,
    })
    .eq("id", input.orderId)
    .select(ORDER_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`recordPaymentCompleted update: ${error?.message ?? "no row"}`);
  }
  return rowToOrder(data as unknown as OrderDbRow);
}

/**
 * Finds the political_order associated with a Stripe Checkout session id.
 * Used by the success_url redirect page when Stripe returns session_id in
 * the query string. Service-role so no auth is required.
 */
export async function findOrderByCheckoutSession(
  sessionId: string,
): Promise<OrderRow | null> {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("political_orders")
    .select(ORDER_COLUMNS)
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`findOrderByCheckoutSession: ${error.message}`);
  if (!data) return null;
  return rowToOrder(data as unknown as OrderDbRow);
}

/** Finds the most recent pending/deposit_paid order for a proposal id.
 *  The checkout page uses this to find "the current order" when initiating
 *  payment. */
export async function findActiveOrderForProposal(
  proposalId: string,
): Promise<OrderRow | null> {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("political_orders")
    .select(ORDER_COLUMNS)
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`findActiveOrderForProposal: ${error.message}`);
  if (!data || data.length === 0) return null;
  return rowToOrder(data[0] as unknown as OrderDbRow);
}
