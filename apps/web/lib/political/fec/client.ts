// ─────────────────────────────────────────────────────────────────────────────
// OpenFEC API client.
//
// Docs: https://api.open.fec.gov/developers/
// Auth: every request needs ?api_key=… (api.data.gov key, free signup).
//       Set FEC_API_KEY in env. Falls back to DEMO_KEY (30 req/hour, 50/day).
//
// Pagination: OpenFEC returns up to 100 records/page. We page until either:
//   • the API reports we're past the last page, or
//   • we hit `maxRecords` (a safety cap the caller passes in).
//
// We deliberately do NOT swallow errors — the ingestion orchestrator decides
// how to surface them to the operator (per-batch retry vs. abort).
// ─────────────────────────────────────────────────────────────────────────────

const FEC_BASE = "https://api.open.fec.gov/v1";
const DEFAULT_PER_PAGE = 100;
const DEMO_KEY = "DEMO_KEY";

export interface FecClientOptions {
  /** Override the default API key (defaults to env FEC_API_KEY → DEMO_KEY). */
  apiKey?: string;
  /** Hard ceiling on records returned across all pages. */
  maxRecords?: number;
  /** Sleep between page fetches (ms). DEMO_KEY needs ~120s/req in theory. */
  pageDelayMs?: number;
  /** abort signal */
  signal?: AbortSignal;
}

export interface FecPage<T> {
  results: T[];
  pagination: {
    page: number;
    pages: number;
    per_page: number;
    count: number;
  };
}

/**
 * Resolve the FEC API key from options → env → DEMO_KEY.
 * Returns the key plus a boolean signaling whether the caller is on
 * the strictly-rate-limited demo tier.
 */
export function resolveApiKey(opts?: FecClientOptions): {
  key: string;
  isDemo: boolean;
} {
  const key =
    opts?.apiKey ??
    process.env.FEC_API_KEY ??
    DEMO_KEY;
  return { key, isDemo: key === DEMO_KEY };
}

// ─────────────────────────────────────────────────────────────────────────────
// FEC payload shapes — only the fields we actually consume. The full
// payload is captured into staging.raw_payload so we never lose data.
// ─────────────────────────────────────────────────────────────────────────────

export interface FecCandidate {
  candidate_id: string;
  name: string;
  party: string | null;
  party_full: string | null;
  office: "P" | "S" | "H" | null;            // P=Pres, S=Senate, H=House
  office_full: string | null;
  state: string | null;
  district: string | null;
  district_number: number | null;
  incumbent_challenge_full: string | null;   // "Incumbent" / "Challenger" / "Open seat"
  cycles: number[];
  election_years: number[];
  principal_committees?: { committee_id: string; name: string }[];
  candidate_status: string | null;
  load_date: string | null;
  // Many other fields we capture verbatim into raw_payload
  [k: string]: unknown;
}

export interface FecCommittee {
  committee_id: string;
  name: string;
  committee_type: string | null;
  committee_type_full: string | null;
  designation: string | null;
  designation_full: string | null;
  party: string | null;
  party_full: string | null;
  state: string | null;
  state_full: string | null;
  treasurer_name: string | null;
  street_1: string | null;
  street_2: string | null;
  city: string | null;
  zip: string | null;
  email: string | null;
  organization_type: string | null;
  cycles: number[];
  candidate_ids?: string[];
  load_date: string | null;
  [k: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic paged fetch
// ─────────────────────────────────────────────────────────────────────────────

async function fetchPage<T>(
  endpoint: string,
  query: Record<string, string | number | boolean | undefined>,
  apiKey: string,
  signal?: AbortSignal,
): Promise<FecPage<T>> {
  const u = new URL(`${FEC_BASE}${endpoint}`);
  u.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    u.searchParams.set(k, String(v));
  }

  const res = await fetch(u.toString(), {
    headers: { accept: "application/json" },
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenFEC ${endpoint} returned ${res.status}: ${body.slice(0, 500)}`);
  }

  return (await res.json()) as FecPage<T>;
}

async function fetchAll<T>(args: {
  endpoint: string;
  query: Record<string, string | number | boolean | undefined>;
  opts?: FecClientOptions;
  /** Called after each successful page. Useful for streaming UI updates later. */
  onPage?: (page: FecPage<T>, pageNum: number) => void;
}): Promise<T[]> {
  const { endpoint, query, opts, onPage } = args;
  const { key, isDemo } = resolveApiKey(opts);
  const maxRecords = opts?.maxRecords ?? 50_000;
  const perPage = DEFAULT_PER_PAGE;
  const pageDelayMs = opts?.pageDelayMs ?? (isDemo ? 1500 : 50);

  const results: T[] = [];
  let page = 1;
  // OpenFEC has hard cap of 100 pages with offset-based paging, but supports
  // last_indexes (cursor) — for now we stay within the cap (10k records) and
  // page by `page=` for simplicity. Phase 1B will switch to last_indexes.

  while (results.length < maxRecords) {
    const data = await fetchPage<T>(
      endpoint,
      { ...query, per_page: perPage, page, sort: "candidate_id" },
      key,
      opts?.signal,
    );

    if (onPage) onPage(data, page);
    if (!data.results || data.results.length === 0) break;

    for (const item of data.results) {
      if (results.length >= maxRecords) break;
      results.push(item);
    }

    if (page >= data.pagination.pages) break;
    page++;

    if (pageDelayMs > 0) {
      await new Promise((r) => setTimeout(r, pageDelayMs));
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: candidates + committees
// ─────────────────────────────────────────────────────────────────────────────

export interface ListCandidatesQuery {
  cycle: number;
  state?: string;            // 2-letter (e.g. 'OH'). Undefined = all states.
  office?: "P" | "S" | "H";
  candidate_status?: "C" | "F" | "N" | "P";  // C=current, F=future, N=no candidate, P=prior
}

export async function listFecCandidates(
  q: ListCandidatesQuery,
  opts?: FecClientOptions,
): Promise<FecCandidate[]> {
  // Note: OpenFEC's /candidates endpoint accepts arrays for office/state via
  // repeated query keys. We support a single value here for simplicity.
  return fetchAll<FecCandidate>({
    endpoint: "/candidates/",
    query: {
      cycle: q.cycle,
      state: q.state,
      office: q.office,
      candidate_status: q.candidate_status ?? "C",
    },
    opts,
  });
}

export interface ListCommitteesQuery {
  cycle: number;
  state?: string;
  committee_type?: string;   // 'P','H','S','Q','N','O','V','W','X','Y','Z','I','C','E','D','U'
  designation?: string;      // 'A','B','D','J','P','U'
}

export async function listFecCommittees(
  q: ListCommitteesQuery,
  opts?: FecClientOptions,
): Promise<FecCommittee[]> {
  return fetchAll<FecCommittee>({
    endpoint: "/committees/",
    query: {
      cycle: q.cycle,
      state: q.state,
      committee_type: q.committee_type,
      designation: q.designation,
    },
    opts,
  });
}
