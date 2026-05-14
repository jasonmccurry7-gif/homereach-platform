// ─────────────────────────────────────────────────────────────────────────────
// FEC payload → staging row normalization.
//
// We deliberately split "what the source said" (raw_payload) from "the
// fields we promote" (typed columns). raw_payload preserves the entire
// FEC record so a future re-normalization (Phase 2 dedup, schema changes)
// can recompute without re-fetching.
// ─────────────────────────────────────────────────────────────────────────────

import type { FecCandidate, FecCommittee } from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// Office mapping — FEC uses single-letter codes (P/S/H).
// Returns the office_code from political_offices that the staging row
// should reference (string), and a human-readable office_text.
// ─────────────────────────────────────────────────────────────────────────────

export function fecOfficeToCode(office: string | null | undefined):
  | { code: "us_president" | "us_senate" | "us_house"; text: string }
  | null
{
  switch (office) {
    case "P": return { code: "us_president", text: "President of the United States" };
    case "S": return { code: "us_senate",    text: "US Senator" };
    case "H": return { code: "us_house",     text: "US Representative" };
    default:  return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dedupe hash
//
// Format: lowercase pipe-joined identity tuple. Same hash → considered the
// same logical entity for Phase 1B's auto-merge engine.
// ─────────────────────────────────────────────────────────────────────────────

function normName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|the|hon|mr|mrs|ms|dr)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function candidateDedupeHash(args: {
  candidate_name: string;
  office_code: string | null;
  state: string | null;
  district: string | null;
  cycle: number | null;
}): string {
  return [
    normName(args.candidate_name),
    args.office_code ?? "",
    (args.state ?? "").toLowerCase(),
    (args.district ?? "").toLowerCase(),
    args.cycle ?? "",
  ].join("|");
}

function committeeDedupeHash(args: {
  legal_name: string;
  state: string | null;
  fec_committee_id: string;
}): string {
  // FEC IDs are unique within FEC, so we anchor on them. Name + state are
  // included so non-FEC sources (OH SoS later) can collide on the same hash
  // when no FEC linkage exists.
  return [
    normName(args.legal_name),
    (args.state ?? "").toLowerCase(),
    args.fec_committee_id.toLowerCase(),
  ].join("|");
}

// ─────────────────────────────────────────────────────────────────────────────
// Data confidence score (0–100)
//
// Pure data-completeness signal — explicitly NOT politics. Higher score =
// more fields present + source is more reliable. Used to surface "import-
// ready" rows first in the review queue.
// ─────────────────────────────────────────────────────────────────────────────

interface ScoreInputs {
  fields: Record<string, unknown>;
  weights: Record<string, number>;
  sourceReliability: number; // 0–25
}

function score(args: ScoreInputs): number {
  let raw = 0;
  let max = 0;
  for (const [field, weight] of Object.entries(args.weights)) {
    max += weight;
    const v = args.fields[field];
    if (v !== null && v !== undefined && v !== "") raw += weight;
  }
  const completeness = max > 0 ? Math.round((raw / max) * 75) : 0;
  return Math.min(100, completeness + args.sourceReliability);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public normalizers
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizedCandidateStagingRow {
  source_record_id: string;
  raw_payload: FecCandidate;
  candidate_name: string;
  party_optional: string | null;
  incumbent_optional: boolean | null;
  office_text: string | null;
  office_code: string | null;
  jurisdiction_text: string | null;
  district: string | null;
  state: string | null;
  cycle: number | null;
  data_confidence_score: number;
  dedupe_hash: string;
}

export function normalizeFecCandidate(c: FecCandidate, cycle: number): NormalizedCandidateStagingRow {
  const office = fecOfficeToCode(c.office);
  const cycles = c.cycles ?? [];
  const election_years = c.election_years ?? [];
  const incumbent =
    c.incumbent_challenge_full === "Incumbent" ? true :
    c.incumbent_challenge_full === "Challenger" ? false :
    null;

  // Jurisdiction text: state for senate, "OH-1" style for house, "United States" for president
  let jurisdiction_text: string | null = null;
  if (office?.code === "us_president") {
    jurisdiction_text = "United States";
  } else if (office?.code === "us_senate" && c.state) {
    jurisdiction_text = c.state;
  } else if (office?.code === "us_house" && c.state && c.district) {
    jurisdiction_text = `${c.state}-${String(c.district).padStart(2, "0")}`;
  } else if (c.state) {
    jurisdiction_text = c.state;
  }

  return {
    source_record_id: c.candidate_id,
    raw_payload: c,
    candidate_name: c.name,
    party_optional: c.party_full ?? c.party ?? null,
    incumbent_optional: incumbent,
    office_text: office?.text ?? c.office_full ?? null,
    office_code: office?.code ?? null,
    jurisdiction_text,
    district: c.district ?? (c.district_number != null ? String(c.district_number) : null),
    state: c.state,
    cycle: election_years[0] ?? cycles[0] ?? cycle,
    data_confidence_score: score({
      fields: {
        name: c.name,
        office: c.office,
        state: c.state,
        cycles: cycles.length > 0 ? "y" : null,
        election_years: election_years.length > 0 ? "y" : null,
        principal_committees: (c.principal_committees ?? []).length > 0 ? "y" : null,
      },
      weights: {
        name: 20, office: 20, state: 10,
        cycles: 5, election_years: 5, principal_committees: 5,
      },
      sourceReliability: 25, // FEC is official-tier, max
    }),
    dedupe_hash: candidateDedupeHash({
      candidate_name: c.name,
      office_code: office?.code ?? null,
      state: c.state,
      district: c.district ?? null,
      cycle: election_years[0] ?? cycles[0] ?? cycle,
    }),
  };
}

export interface NormalizedCommitteeStagingRow {
  source_record_id: string;
  raw_payload: FecCommittee;
  legal_name: string;
  display_name: string | null;
  org_type: string | null;
  state: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  address: string | null;
  linked_candidate_source_id: string | null;
  data_confidence_score: number;
  dedupe_hash: string;
}

export function normalizeFecCommittee(c: FecCommittee): NormalizedCommitteeStagingRow {
  const linked = (c.candidate_ids ?? [])[0] ?? null;
  const address = [c.street_1, c.street_2, c.city, c.state, c.zip]
    .filter((p) => p && String(p).trim().length > 0)
    .join(", ") || null;

  return {
    source_record_id: c.committee_id,
    raw_payload: c,
    legal_name: c.name,
    display_name: null,                          // FEC doesn't ship a separate short name
    org_type: c.committee_type ?? null,          // single-letter; mapped to enum at promotion
    state: c.state,
    primary_contact_name: c.treasurer_name,
    primary_contact_email: c.email,
    address,
    linked_candidate_source_id: linked,
    data_confidence_score: score({
      fields: {
        name: c.name,
        committee_type: c.committee_type,
        state: c.state,
        treasurer_name: c.treasurer_name,
        address,
        email: c.email,
      },
      weights: {
        name: 25, committee_type: 15, state: 10,
        treasurer_name: 10, address: 5, email: 10,
      },
      sourceReliability: 25,
    }),
    dedupe_hash: committeeDedupeHash({
      legal_name: c.name,
      state: c.state,
      fec_committee_id: c.committee_id,
    }),
  };
}
