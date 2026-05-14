// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Political Command Center: Contracts + E-Sign
//
// Two layers:
//   (1) Pure `buildContractTerms()` — generates the plain-text agreement
//       from a proposal snapshot. Deterministic, no IO. Tested in isolation.
//   (2) Server-only DB helpers that create / load / sign contracts. Use the
//       service-role Supabase client because the public sign page has no
//       authenticated user (the 32-byte public_token IS the auth).
//
// UETA / E-SIGN evidence set captured at sign time:
//   • intent + identity  → signer_name, signer_email
//   • timestamp          → signed_at
//   • integrity          → terms_text stored verbatim before signing and
//                          never modified afterward
//   • non-repudiation    → signer_ip + unique public_token
//
// Compliance: the terms include an explicit non-political clause stating
// HomeReach performs logistics only — no voter scoring, no persuasion
// modeling, no ideology inference. That clause is documentation of a
// restriction, not a persuasion artifact.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";

import { randomBytes } from "node:crypto";
import { createServiceClient } from "@homereach/services/auth";
import { createClient as createUserClient } from "@/lib/supabase/server";
import type { ProposalRow } from "./proposals";

// ── Types ────────────────────────────────────────────────────────────────────

export type ContractStatus = "pending" | "signed" | "canceled" | "expired";

export interface ContractRow {
  id: string;
  proposalId: string;
  campaignId: string;
  orderId: string | null;
  status: ContractStatus;
  publicToken: string | null;
  termsText: string;
  signerName: string | null;
  signerEmail: string | null;
  signerIp: string | null;
  signedAt: string | null;
  version: number;
  expiresAt: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContractDbRow {
  id: string;
  proposal_id: string;
  campaign_id: string;
  order_id: string | null;
  status: ContractStatus;
  public_token: string | null;
  terms_text: string;
  signer_name: string | null;
  signer_email: string | null;
  signer_ip: string | null;
  signed_at: string | null;
  version: number;
  expires_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const CONTRACT_COLUMNS = [
  "id",
  "proposal_id",
  "campaign_id",
  "order_id",
  "status",
  "public_token",
  "terms_text",
  "signer_name",
  "signer_email",
  "signer_ip",
  "signed_at",
  "version",
  "expires_at",
  "sent_at",
  "viewed_at",
  "created_by",
  "created_at",
  "updated_at",
].join(", ");

function rowToContract(r: ContractDbRow): ContractRow {
  return {
    id: r.id,
    proposalId: r.proposal_id,
    campaignId: r.campaign_id,
    orderId: r.order_id,
    status: r.status,
    publicToken: r.public_token,
    termsText: r.terms_text,
    signerName: r.signer_name,
    signerEmail: r.signer_email,
    signerIp: r.signer_ip,
    signedAt: r.signed_at,
    version: r.version,
    expiresAt: r.expires_at,
    sentAt: r.sent_at,
    viewedAt: r.viewed_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── Token ────────────────────────────────────────────────────────────────────

/** 32-byte hex. Collision-free enough; partial unique index backs it up. */
export function generateContractToken(): string {
  return randomBytes(32).toString("hex");
}

// ── Pure terms builder ──────────────────────────────────────────────────────

export interface BuildContractTermsInput {
  proposal: ProposalRow;
  candidateName: string;
  candidateOffice: string | null;
  campaignName: string;
  state: string;
  geographyLabel: string;
  /** Defaults to "HomeReach". */
  vendorName?: string;
  /** Defaults to "the State of Ohio". */
  governingLaw?: string;
  /** Defaults to 3. */
  cancellationDays?: number;
  /** For the "Issued {date}" line. Defaults to current date. */
  issuedAt?: Date;
}

/** Builds the plain-text agreement persisted as terms_text. */
export function buildContractTerms(input: BuildContractTermsInput): string {
  const vendor = (input.vendorName ?? "HomeReach").trim();
  const governing = (input.governingLaw ?? "the State of Ohio").trim();
  const cancellation = input.cancellationDays ?? 3;
  const issuedAt = input.issuedAt ?? new Date();
  const { proposal } = input;

  const total = formatCentsUSD(proposal.totalInvestmentCents);
  const depositFraction = 0.5;
  const deposit = formatCentsUSD(Math.round(proposal.totalInvestmentCents * depositFraction));
  const balance = formatCentsUSD(
    proposal.totalInvestmentCents - Math.round(proposal.totalInvestmentCents * depositFraction),
  );
  const validUntil = proposal.expiresAt ? formatIsoDate(proposal.expiresAt) : "the date noted on the proposal";
  const window = proposal.deliveryWindowText ?? "approximately 12–19 business days from production start";

  const candidateLine = input.candidateOffice
    ? `${input.candidateName} — ${input.candidateOffice}`
    : input.candidateName;

  return [
    `SERVICES AGREEMENT — ${vendor} Political Direct Mail`,
    ``,
    `This Services Agreement ("Agreement") is entered into between:`,
    ``,
    `  Vendor:  ${vendor}`,
    `  Client:  ${candidateLine} (${input.campaignName})`,
    ``,
    `1. SCOPE OF SERVICES`,
    `   ${vendor} will execute one direct-mail engagement covering`,
    `   ${proposal.totalPieces.toLocaleString("en-US")} pieces across ${proposal.drops} drop${proposal.drops === 1 ? "" : "s"}`,
    `   targeting approximately ${proposal.households.toLocaleString("en-US")} households in`,
    `   ${input.geographyLabel}.`,
    ``,
    `2. FEES`,
    `   Total investment: ${total} (USD).`,
    `   Payment terms: 50% deposit (${deposit}) due upon signature;`,
    `   balance of ${balance} due upon delivery, unless otherwise agreed`,
    `   in writing. Pricing valid until ${validUntil}.`,
    ``,
    `3. SCHEDULE`,
    `   ${vendor} will begin production within five (5) business days of`,
    `   receipt of deposit and approved artwork. Delivery window: ${window}.`,
    `   Delivery estimates; firm in-home dates require written confirmation`,
    `   from both parties.`,
    ``,
    `4. CANCELLATION`,
    `   Either party may cancel within ${cancellation} business days of signing`,
    `   for a full refund of any unstarted work. After production has begun,`,
    `   fees for completed work and committed materials are non-refundable.`,
    ``,
    `5. DATA & PRIVACY — NON-POLITICAL GUARANTEE`,
    `   Any audience lists provided by the Client are used solely to fulfill`,
    `   this Agreement. ${vendor} does not sell, share, or repurpose audience`,
    `   data. ${vendor} does not infer political beliefs, ideology, voter`,
    `   behavior, or persuasion attributes from any data in this engagement.`,
    `   Work is limited to geographic and household-level logistics aggregation.`,
    ``,
    `6. INTELLECTUAL PROPERTY`,
    `   Client retains ownership of campaign artwork and audience data.`,
    `   ${vendor} retains the right to display anonymized aggregate metrics`,
    `   about the engagement (e.g., geography, volume range) in case studies.`,
    ``,
    `7. LIMITATION OF LIABILITY`,
    `   ${vendor}'s aggregate liability under this Agreement is limited to the`,
    `   fees paid by Client for the affected work.`,
    ``,
    `8. GOVERNING LAW`,
    `   This Agreement is governed by the laws of ${governing}.`,
    ``,
    `9. ELECTRONIC SIGNATURE`,
    `   The parties consent to executing this Agreement electronically under`,
    `   the Electronic Signatures in Global and National Commerce Act`,
    `   (E-SIGN Act) and the Uniform Electronic Transactions Act (UETA).`,
    `   An electronic signature has the same legal effect as a handwritten`,
    `   signature.`,
    ``,
    `Signed by typing the signer's full name and submitting the form on the`,
    `linked agreement page. Signature, IP address, and timestamp are recorded`,
    `as evidence of acceptance.`,
    ``,
    `Issued ${formatIsoDate(issuedAt.toISOString())} by ${vendor}.`,
  ].join("\n");
}

// ── DB helpers ───────────────────────────────────────────────────────────────

/** Admin/sales read — RLS-scoped. */
export async function loadContractForProposal(proposalId: string): Promise<ContractRow | null> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("political_contracts")
    .select(CONTRACT_COLUMNS)
    .eq("proposal_id", proposalId)
    .in("status", ["pending", "signed"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`loadContractForProposal: ${error.message}`);
  if (!data || data.length === 0) return null;
  return rowToContract(data[0] as unknown as ContractDbRow);
}

/** Public-flow read — service role. Used by /p/[token] to surface the
 *  "Sign contract" link alongside the pay buttons. Returns the newest
 *  active (pending or signed) contract, or null. */
export async function loadActiveContractForProposalPublic(
  proposalId: string,
): Promise<ContractRow | null> {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("political_contracts")
    .select(CONTRACT_COLUMNS)
    .eq("proposal_id", proposalId)
    .in("status", ["pending", "signed"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`loadActiveContractForProposalPublic: ${error.message}`);
  if (!data || data.length === 0) return null;
  return rowToContract(data[0] as unknown as ContractDbRow);
}

/** Public token read — service role, token is the auth. */
export async function loadContractByToken(token: string): Promise<ContractRow | null> {
  if (!token || token.length < 32) return null;
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("political_contracts")
    .select(CONTRACT_COLUMNS)
    .eq("public_token", token)
    .maybeSingle();
  if (error) throw new Error(`loadContractByToken: ${error.message}`);
  if (!data) return null;
  return rowToContract(data as unknown as ContractDbRow);
}

/**
 * Same lookup as loadContractByToken but ALSO returns the proposal +
 * candidate + campaign context needed to render the sign page header.
 * Refuses canceled/expired contracts.
 */
export interface PublicContractContext {
  contract: ContractRow;
  candidateName: string;
  candidateOffice: string | null;
  campaignName: string;
  state: string;
  geographyLabel: string;
  proposalToken: string | null;
}

export async function loadPublicContract(token: string): Promise<PublicContractContext | null> {
  if (!token || token.length < 32) return null;
  const admin = createServiceClient();

  const { data: contractData, error } = await admin
    .from("political_contracts")
    .select(CONTRACT_COLUMNS)
    .eq("public_token", token)
    .maybeSingle();
  if (error) throw new Error(`loadPublicContract: ${error.message}`);
  if (!contractData) return null;
  const contract = rowToContract(contractData as unknown as ContractDbRow);

  if (contract.status === "canceled" || contract.status === "expired") return null;
  if (contract.expiresAt && new Date(contract.expiresAt).getTime() < Date.now()) return null;

  const { data: proposalData, error: propErr } = await admin
    .from("political_proposals")
    .select("public_token")
    .eq("id", contract.proposalId)
    .maybeSingle();
  if (propErr) throw new Error(`loadPublicContract proposal: ${propErr.message}`);

  const { data: candidateData, error: candErr } = await admin
    .from("campaign_candidates")
    .select("candidate_name, office_sought, state, geography_type, geography_value")
    .eq("id", await getCandidateIdForProposal(admin, contract.proposalId))
    .maybeSingle();
  if (candErr) throw new Error(`loadPublicContract candidate: ${candErr.message}`);
  if (!candidateData) return null;

  const { data: campaignData, error: campErr } = await admin
    .from("political_campaigns")
    .select("campaign_name")
    .eq("id", contract.campaignId)
    .maybeSingle();
  if (campErr) throw new Error(`loadPublicContract campaign: ${campErr.message}`);
  if (!campaignData) return null;

  const cand = candidateData as {
    candidate_name: string;
    office_sought: string | null;
    state: string;
    geography_type: string | null;
    geography_value: string | null;
  };
  const camp = campaignData as { campaign_name: string };

  return {
    contract,
    candidateName: cand.candidate_name,
    candidateOffice: cand.office_sought,
    campaignName: camp.campaign_name,
    state: cand.state,
    geographyLabel:
      cand.geography_type && cand.geography_value
        ? `${cand.geography_value} (${cand.geography_type}) · ${cand.state}`
        : cand.state,
    proposalToken: (proposalData as { public_token: string | null } | null)?.public_token ?? null,
  };
}

// Small helper — avoids a join since supabase-js doesn't ergonomically do
// two-level embeds without explicit foreign-key hints here.
async function getCandidateIdForProposal(
  admin: ReturnType<typeof createServiceClient>,
  proposalId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("political_proposals")
    .select("candidate_id")
    .eq("id", proposalId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { candidate_id: string }).candidate_id;
}

// ── Writes ───────────────────────────────────────────────────────────────────

export interface CreateContractInput {
  proposal: ProposalRow;
  /** Context used by buildContractTerms. Caller has already loaded it. */
  terms: BuildContractTermsInput;
  createdBy: string | null;
  orderId?: string | null;
}

/**
 * Idempotent: if the proposal already has a pending or signed contract,
 * returns the existing row unchanged. Otherwise creates a new pending
 * contract with a fresh token + rendered terms + status 'pending' + sent_at.
 */
export async function createContractForProposal(
  input: CreateContractInput,
): Promise<ContractRow> {
  const admin = createServiceClient();

  // Look for an existing active contract first (idempotency).
  const { data: existingData, error: existingErr } = await admin
    .from("political_contracts")
    .select(CONTRACT_COLUMNS)
    .eq("proposal_id", input.proposal.id)
    .in("status", ["pending", "signed"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (existingErr) {
    throw new Error(`createContractForProposal lookup: ${existingErr.message}`);
  }
  if (existingData && existingData.length > 0) {
    return rowToContract(existingData[0] as unknown as ContractDbRow);
  }

  const termsText = buildContractTerms(input.terms);
  const token = generateContractToken();
  // Default expiration mirrors the proposal's expiry (or +30 days if absent).
  const expiresAt =
    input.proposal.expiresAt ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("political_contracts")
    .insert({
      proposal_id:  input.proposal.id,
      campaign_id:  input.proposal.campaignId,
      order_id:     input.orderId ?? null,
      status:       "pending",
      public_token: token,
      terms_text:   termsText,
      version:      1,
      expires_at:   expiresAt,
      sent_at:      new Date().toISOString(),
      created_by:   input.createdBy,
    })
    .select(CONTRACT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(`createContractForProposal insert: ${error?.message ?? "no row"}`);
  }
  return rowToContract(data as unknown as ContractDbRow);
}

/** Marks a contract as first-viewed. Idempotent. */
export async function markContractViewed(token: string): Promise<void> {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("political_contracts")
    .select("id, viewed_at, status")
    .eq("public_token", token)
    .maybeSingle();
  if (error) throw new Error(`markContractViewed lookup: ${error.message}`);
  if (!data) return;
  const row = data as { id: string; viewed_at: string | null; status: ContractStatus };
  if (row.viewed_at) return;
  if (row.status !== "pending") return;
  const { error: updErr } = await admin
    .from("political_contracts")
    .update({ viewed_at: new Date().toISOString() })
    .eq("id", row.id);
  if (updErr) throw new Error(`markContractViewed update: ${updErr.message}`);
}

export interface SignContractInput {
  token: string;
  signerName: string;
  signerEmail: string;
  signerIp: string | null;
}

/**
 * Records a signature. Idempotent — if the contract is already signed,
 * returns the existing row unchanged rather than overwriting evidence.
 *
 * Throws if the contract doesn't exist or is canceled/expired.
 */
export async function signContractByToken(input: SignContractInput): Promise<ContractRow> {
  const signerName = input.signerName.trim();
  const signerEmail = input.signerEmail.trim();

  if (signerName.length < 2 || signerName.length > 200) {
    throw new Error("Signer name must be between 2 and 200 characters.");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(signerEmail)) {
    throw new Error("Signer email is not a valid address.");
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("political_contracts")
    .select(CONTRACT_COLUMNS)
    .eq("public_token", input.token)
    .maybeSingle();
  if (error) throw new Error(`signContract lookup: ${error.message}`);
  if (!data) throw new Error("Contract not found.");
  const contract = rowToContract(data as unknown as ContractDbRow);

  if (contract.status === "signed") return contract;
  if (contract.status === "canceled") throw new Error("This contract has been canceled.");
  if (contract.status === "expired") throw new Error("This contract has expired.");
  if (contract.expiresAt && new Date(contract.expiresAt).getTime() < Date.now()) {
    throw new Error("This contract has expired.");
  }

  const { data: updData, error: updErr } = await admin
    .from("political_contracts")
    .update({
      status: "signed",
      signer_name: signerName,
      signer_email: signerEmail,
      signer_ip: input.signerIp,
      signed_at: new Date().toISOString(),
    })
    .eq("id", contract.id)
    .select(CONTRACT_COLUMNS)
    .single();
  if (updErr || !updData) {
    throw new Error(`signContract update: ${updErr?.message ?? "no row"}`);
  }
  return rowToContract(updData as unknown as ContractDbRow);
}

// ── High-level orchestration ────────────────────────────────────────────────

/**
 * Called from the approve flow. Loads the proposal + its candidate + campaign,
 * then creates a pending contract if one doesn't already exist.
 *
 * Idempotent: if the proposal already has an active contract, returns it.
 * Never throws on missing context data — returns null in that edge case so
 * the caller can log and continue (the contract can be created later
 * manually by an admin if needed).
 */
export async function ensureContractForProposal(
  proposalId: string,
  createdBy: string | null,
): Promise<ContractRow | null> {
  const admin = createServiceClient();

  // 1. Load proposal
  const { data: proposalData, error: propErr } = await admin
    .from("political_proposals")
    .select(
      "id, campaign_id, candidate_id, status, public_token, households, drops, " +
      "total_pieces, total_investment_cents, internal_cost_cents, internal_margin_cents, " +
      "delivery_window_text, expires_at, sent_at, viewed_at, approved_at, declined_at, " +
      "created_by, pricing_snapshot, resend_count, last_resent_at, created_at, updated_at",
    )
    .eq("id", proposalId)
    .maybeSingle();
  if (propErr || !proposalData) return null;

  const p = proposalData as unknown as {
    id: string;
    campaign_id: string;
    candidate_id: string;
    status: ProposalRow["status"];
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
  };

  const proposal: ProposalRow = {
    id: p.id,
    campaignId: p.campaign_id,
    candidateId: p.candidate_id,
    status: p.status,
    sentAt: p.sent_at,
    viewedAt: p.viewed_at,
    approvedAt: p.approved_at,
    declinedAt: p.declined_at,
    expiresAt: p.expires_at,
    publicToken: p.public_token,
    createdBy: p.created_by,
    pricingSnapshot: p.pricing_snapshot ?? {},
    households: Number(p.households) || 0,
    drops: p.drops,
    totalPieces: Number(p.total_pieces) || 0,
    totalInvestmentCents: Number(p.total_investment_cents) || 0,
    internalCostCents: Number(p.internal_cost_cents) || 0,
    internalMarginCents: Number(p.internal_margin_cents) || 0,
    deliveryWindowText: p.delivery_window_text,
    resendCount: p.resend_count,
    lastResentAt: p.last_resent_at,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };

  // 2. Load candidate + campaign context
  const { data: candidateData, error: candErr } = await admin
    .from("campaign_candidates")
    .select("candidate_name, office_sought, state, geography_type, geography_value")
    .eq("id", proposal.candidateId)
    .maybeSingle();
  if (candErr || !candidateData) return null;

  const { data: campaignData, error: campErr } = await admin
    .from("political_campaigns")
    .select("campaign_name")
    .eq("id", proposal.campaignId)
    .maybeSingle();
  if (campErr || !campaignData) return null;

  const cand = candidateData as {
    candidate_name: string;
    office_sought: string | null;
    state: string;
    geography_type: string | null;
    geography_value: string | null;
  };
  const camp = campaignData as { campaign_name: string };

  const geographyLabel =
    cand.geography_type && cand.geography_value
      ? `${cand.geography_value} (${cand.geography_type}) · ${cand.state}`
      : cand.state;

  // 3. Create (idempotent — returns existing if active)
  return createContractForProposal({
    proposal,
    createdBy,
    terms: {
      proposal,
      candidateName: cand.candidate_name,
      candidateOffice: cand.office_sought,
      campaignName: camp.campaign_name,
      state: cand.state,
      geographyLabel,
    },
  });
}

// ── Internal format helpers ─────────────────────────────────────────────────

function formatCentsUSD(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatIsoDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
