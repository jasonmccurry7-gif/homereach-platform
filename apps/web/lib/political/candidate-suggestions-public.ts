import type { CandidateSuggestion } from "./candidate-intelligence/types";

export const PUBLIC_CANDIDATE_SEARCH_DEFAULT_LIMIT = 8;
export const PUBLIC_CANDIDATE_SEARCH_MAX_LIMIT = 20;
export const PUBLIC_CANDIDATE_SEARCH_MAX_QUERY_LENGTH = 80;

export interface PublicCandidateSearchParams {
  query: string;
  state?: string;
  limit: number;
}

function clampLimit(rawLimit: string | null): number {
  const parsed = rawLimit ? Number.parseInt(rawLimit, 10) : PUBLIC_CANDIDATE_SEARCH_DEFAULT_LIMIT;
  if (!Number.isFinite(parsed)) return PUBLIC_CANDIDATE_SEARCH_DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), PUBLIC_CANDIDATE_SEARCH_MAX_LIMIT);
}

function normalizeState(rawState: string | null): string | undefined {
  const state = (rawState ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(state) ? state : undefined;
}

export function normalizePublicCandidateSearchParams(input: {
  query: string | null;
  state: string | null;
  limit: string | null;
}): PublicCandidateSearchParams {
  return {
    query: (input.query ?? "").trim().slice(0, PUBLIC_CANDIDATE_SEARCH_MAX_QUERY_LENGTH),
    state: normalizeState(input.state),
    limit: clampLimit(input.limit),
  };
}

export function toPublicCandidateSuggestion(candidate: CandidateSuggestion): CandidateSuggestion {
  const publicCandidate = { ...candidate };
  delete publicCandidate.campaignEmail;
  delete publicCandidate.campaignPhone;
  return publicCandidate;
}
