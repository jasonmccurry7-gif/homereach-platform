// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Political Command Center: server-only query helpers
//
// Typed reads for campaign_candidates and political_campaign_contacts.
// RLS-scoped via the user-cookie Supabase server client (so admin sees all;
// sales_agent sees all per migration 059 RLS; client sees nothing).
//
// These functions read ONLY the new columns introduced by migrations 059+060
// (geography_type / geography_value / district_type / candidate_status).
// Deprecated columns (district, city, county, race_level, status text, stage,
// estimated_deal_value_cents) are NOT selected. This is how we close the
// deprecation window cleanly — nothing new depends on them.
//
// Nothing in this file runs unless a caller imports it, so while
// ENABLE_POLITICAL is unset there is zero effect.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";
import { createClient } from "@/lib/supabase/server";

// ── Types ────────────────────────────────────────────────────────────────────

export type GeographyType = "state" | "county" | "city" | "district";
export type DistrictType = "federal" | "state" | "local";
export type CandidateStatus = "active" | "inactive" | "won" | "lost";
export type PreferredContactMethod = "email" | "sms" | "call" | "facebook_dm";

export interface CandidateRow {
  id: string;
  candidateName: string;
  officeSought: string | null;
  state: string;
  geographyType: GeographyType | null;
  geographyValue: string | null;
  districtType: DistrictType | null;
  candidateStatus: CandidateStatus;
  electionDate: string | null;
  electionYear: number | null;

  partyOptionalPublic: string | null;

  campaignWebsite: string | null;
  campaignEmail: string | null;
  campaignPhone: string | null;
  facebookUrl: string | null;
  messengerUrl: string | null;
  campaignManagerName: string | null;
  campaignManagerEmail: string | null;

  sourceUrl: string | null;
  sourceType: string | null;
  dataVerifiedAt: string | null;

  completenessScore: number | null;
  priorityScore: number | null;

  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  notes: string | null;

  doNotContact: boolean;
  doNotEmail: boolean;
  doNotText: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface ContactRow {
  id: string;
  campaignCandidateId: string;
  campaignId: string | null;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  preferredContactMethod: PreferredContactMethod | null;
  doNotContact: boolean;
  doNotEmail: boolean;
  doNotText: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListFilters {
  /** 2-letter state code, case-insensitive (stored upper). */
  state?: string | undefined;
  geographyType?: GeographyType | undefined;
  /** ILIKE substring match on geography_value. */
  geographyValue?: string | undefined;
  districtType?: DistrictType | undefined;
  candidateStatus?: CandidateStatus | undefined;
  /** ILIKE substring match on candidate_name. */
  search?: string | undefined;
}

// ── DB → TS mapping ──────────────────────────────────────────────────────────

const CANDIDATE_COLUMNS = [
  "id",
  "candidate_name",
  "office_sought",
  "state",
  "geography_type",
  "geography_value",
  "district_type",
  "candidate_status",
  "election_date",
  "election_year",
  "party_optional_public",
  "campaign_website",
  "campaign_email",
  "campaign_phone",
  "facebook_url",
  "messenger_url",
  "campaign_manager_name",
  "campaign_manager_email",
  "source_url",
  "source_type",
  "data_verified_at",
  "completeness_score",
  "priority_score",
  "last_contacted_at",
  "next_follow_up_at",
  "notes",
  "do_not_contact",
  "do_not_email",
  "do_not_text",
  "created_at",
  "updated_at",
].join(", ");

const CONTACT_COLUMNS = [
  "id",
  "campaign_candidate_id",
  "campaign_id",
  "name",
  "role",
  "email",
  "phone",
  "is_primary",
  "preferred_contact_method",
  "do_not_contact",
  "do_not_email",
  "do_not_text",
  "created_at",
  "updated_at",
].join(", ");

interface CandidateDbRow {
  id: string;
  candidate_name: string;
  office_sought: string | null;
  state: string;
  geography_type: GeographyType | null;
  geography_value: string | null;
  district_type: DistrictType | null;
  candidate_status: CandidateStatus;
  election_date: string | null;
  election_year: number | null;
  party_optional_public: string | null;
  campaign_website: string | null;
  campaign_email: string | null;
  campaign_phone: string | null;
  facebook_url: string | null;
  messenger_url: string | null;
  campaign_manager_name: string | null;
  campaign_manager_email: string | null;
  source_url: string | null;
  source_type: string | null;
  data_verified_at: string | null;
  completeness_score: number | null;
  priority_score: number | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  do_not_contact: boolean;
  do_not_email: boolean;
  do_not_text: boolean;
  created_at: string;
  updated_at: string;
}

interface ContactDbRow {
  id: string;
  campaign_candidate_id: string;
  campaign_id: string | null;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  preferred_contact_method: PreferredContactMethod | null;
  do_not_contact: boolean;
  do_not_email: boolean;
  do_not_text: boolean;
  created_at: string;
  updated_at: string;
}

function rowToCandidate(r: CandidateDbRow): CandidateRow {
  return {
    id: r.id,
    candidateName: r.candidate_name,
    officeSought: r.office_sought,
    state: r.state,
    geographyType: r.geography_type,
    geographyValue: r.geography_value,
    districtType: r.district_type,
    candidateStatus: r.candidate_status,
    electionDate: r.election_date,
    electionYear: r.election_year,
    partyOptionalPublic: r.party_optional_public,
    campaignWebsite: r.campaign_website,
    campaignEmail: r.campaign_email,
    campaignPhone: r.campaign_phone,
    facebookUrl: r.facebook_url,
    messengerUrl: r.messenger_url,
    campaignManagerName: r.campaign_manager_name,
    campaignManagerEmail: r.campaign_manager_email,
    sourceUrl: r.source_url,
    sourceType: r.source_type,
    dataVerifiedAt: r.data_verified_at,
    completenessScore: r.completeness_score,
    priorityScore: r.priority_score,
    lastContactedAt: r.last_contacted_at,
    nextFollowUpAt: r.next_follow_up_at,
    notes: r.notes,
    doNotContact: r.do_not_contact,
    doNotEmail: r.do_not_email,
    doNotText: r.do_not_text,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToContact(r: ContactDbRow): ContactRow {
  return {
    id: r.id,
    campaignCandidateId: r.campaign_candidate_id,
    campaignId: r.campaign_id,
    name: r.name,
    role: r.role,
    email: r.email,
    phone: r.phone,
    isPrimary: r.is_primary,
    preferredContactMethod: r.preferred_contact_method,
    doNotContact: r.do_not_contact,
    doNotEmail: r.do_not_email,
    doNotText: r.do_not_text,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── Reads ────────────────────────────────────────────────────────────────────

/**
 * Loads a paginated list of candidates. Orders by priority_score desc (NULLs
 * last) then created_at desc. Applies the URL filter set from the list page.
 */
export async function loadCandidates(
  filters: ListFilters = {},
  limit = 200,
): Promise<CandidateRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("campaign_candidates")
    .select(CANDIDATE_COLUMNS)
    .order("priority_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.state) q = q.eq("state", filters.state.toUpperCase());
  if (filters.geographyType) q = q.eq("geography_type", filters.geographyType);
  if (filters.geographyValue) q = q.ilike("geography_value", `%${filters.geographyValue}%`);
  if (filters.districtType) q = q.eq("district_type", filters.districtType);
  if (filters.candidateStatus) q = q.eq("candidate_status", filters.candidateStatus);
  if (filters.search) q = q.ilike("candidate_name", `%${filters.search}%`);

  const { data, error } = await q;
  if (error) throw new Error(`loadCandidates: ${error.message}`);
  return ((data ?? []) as unknown as CandidateDbRow[]).map(rowToCandidate);
}

/** Counts candidates matching the same filter set the list uses. */
export async function countCandidates(filters: ListFilters = {}): Promise<number> {
  const supabase = await createClient();
  let q = supabase
    .from("campaign_candidates")
    .select("id", { count: "exact", head: true });

  if (filters.state) q = q.eq("state", filters.state.toUpperCase());
  if (filters.geographyType) q = q.eq("geography_type", filters.geographyType);
  if (filters.geographyValue) q = q.ilike("geography_value", `%${filters.geographyValue}%`);
  if (filters.districtType) q = q.eq("district_type", filters.districtType);
  if (filters.candidateStatus) q = q.eq("candidate_status", filters.candidateStatus);
  if (filters.search) q = q.ilike("candidate_name", `%${filters.search}%`);

  const { count, error } = await q;
  if (error) throw new Error(`countCandidates: ${error.message}`);
  return count ?? 0;
}

/** Loads a single candidate by id. Returns null on miss (→ notFound on page). */
export async function loadCandidate(id: string): Promise<CandidateRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_candidates")
    .select(CANDIDATE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`loadCandidate: ${error.message}`);
  if (!data) return null;
  return rowToCandidate(data as unknown as CandidateDbRow);
}

/** Lists contacts for a candidate. Primary first, then by created_at. */
export async function loadContactsForCandidate(candidateId: string): Promise<ContactRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("political_campaign_contacts")
    .select(CONTACT_COLUMNS)
    .eq("campaign_candidate_id", candidateId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`loadContactsForCandidate: ${error.message}`);
  return ((data ?? []) as unknown as ContactDbRow[]).map(rowToContact);
}

// ── Campaigns (Phase 4 — used by quote UI) ──────────────────────────────────

export interface CampaignRow {
  id: string;
  candidateId: string;
  campaignName: string;
  office: string | null;
  districtType: DistrictType | null;
  geographyType: GeographyType | null;
  geographyValue: string | null;
  pipelineStatus: string;
  electionDate: string | null;
  createdAt: string;
}

interface CampaignDbRow {
  id: string;
  candidate_id: string;
  campaign_name: string;
  office: string | null;
  district_type: DistrictType | null;
  geography_type: GeographyType | null;
  geography_value: string | null;
  pipeline_status: string;
  election_date: string | null;
  created_at: string;
}

const CAMPAIGN_COLUMNS = [
  "id",
  "candidate_id",
  "campaign_name",
  "office",
  "district_type",
  "geography_type",
  "geography_value",
  "pipeline_status",
  "election_date",
  "created_at",
].join(", ");

function rowToCampaign(r: CampaignDbRow): CampaignRow {
  return {
    id: r.id,
    candidateId: r.candidate_id,
    campaignName: r.campaign_name,
    office: r.office,
    districtType: r.district_type,
    geographyType: r.geography_type,
    geographyValue: r.geography_value,
    pipelineStatus: r.pipeline_status,
    electionDate: r.election_date,
    createdAt: r.created_at,
  };
}

export async function loadCampaignsForCandidate(candidateId: string): Promise<CampaignRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("political_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`loadCampaignsForCandidate: ${error.message}`);
  return ((data ?? []) as unknown as CampaignDbRow[]).map(rowToCampaign);
}
