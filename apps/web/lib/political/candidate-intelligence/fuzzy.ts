import { normalizeCandidateName } from "./normalization";
import type { NormalizedCandidateIntelRecord } from "./types";

export interface CandidateMatchCandidate {
  id: string;
  normalized_name?: string | null;
  canonical_candidate_name?: string | null;
  office_name?: string | null;
  state?: string | null;
  district_label?: string | null;
  election_year?: number | null;
}

export interface CandidateMatchScore {
  score: number;
  reasons: Array<{ code: string; detail: string; weight: number }>;
}

function bigrams(value: string): Set<string> {
  const text = ` ${normalizeCandidateName(value)} `;
  const set = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) set.add(text.slice(i, i + 2));
  return set;
}

function dice(a: string, b: string): number {
  const aa = bigrams(a);
  const bb = bigrams(b);
  if (aa.size === 0 || bb.size === 0) return 0;
  let overlap = 0;
  for (const item of aa) if (bb.has(item)) overlap++;
  return (2 * overlap) / (aa.size + bb.size);
}

function eqLoose(a?: string | number | null, b?: string | number | null): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return normalizeCandidateName(String(a)) === normalizeCandidateName(String(b));
}

export function scoreCandidateMatch(
  record: NormalizedCandidateIntelRecord,
  candidate: CandidateMatchCandidate,
): CandidateMatchScore {
  const reasons: CandidateMatchScore["reasons"] = [];
  let score = 0;

  const nameScore = dice(record.candidateName, candidate.normalized_name || candidate.canonical_candidate_name || "");
  score += nameScore * 0.55;
  reasons.push({ code: "name_similarity", detail: `${Math.round(nameScore * 100)}% name similarity`, weight: nameScore * 0.55 });

  if (eqLoose(record.state, candidate.state)) {
    score += 0.15;
    reasons.push({ code: "state_match", detail: "Same state", weight: 0.15 });
  }

  if (eqLoose(record.officeName, candidate.office_name)) {
    score += 0.15;
    reasons.push({ code: "office_match", detail: "Same office", weight: 0.15 });
  }

  if (eqLoose(record.districtLabel ?? record.jurisdictionName, candidate.district_label)) {
    score += 0.1;
    reasons.push({ code: "district_match", detail: "Same district or jurisdiction", weight: 0.1 });
  }

  if (record.electionYear && candidate.election_year && record.electionYear === candidate.election_year) {
    score += 0.05;
    reasons.push({ code: "cycle_match", detail: "Same election cycle", weight: 0.05 });
  }

  return { score: Math.min(1, score), reasons };
}

export function scoreSearchResult(query: string, searchText: string, candidateName: string): number {
  const q = normalizeCandidateName(query);
  const haystack = normalizeCandidateName(searchText);
  if (!q) return 0;
  if (normalizeCandidateName(candidateName) === q) return 1;
  if (haystack.includes(q)) return 0.82;
  return dice(q, haystack);
}
