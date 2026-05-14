import {
  confidenceFromSource,
  electionYearFrom,
  inferOfficeHierarchy,
  inferOfficeLevel,
  normalizeParty,
  normalizeWhitespace,
  sha256Json,
} from "../normalization";
import type { CandidateIntelProviderResult, NormalizedCandidateIntelRecord } from "../types";

const SOURCE_KEY = "serpapi_candidate_search_v1";

interface SerpApiOrganicResult {
  position?: number;
  title?: string;
  link?: string;
  displayed_link?: string;
  snippet?: string;
  source?: string;
  [key: string]: unknown;
}

interface SerpApiPayload {
  error?: string;
  organic_results?: SerpApiOrganicResult[];
  search_metadata?: Record<string, unknown>;
  search_parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

const STATE_NAMES: Record<string, string> = {
  OH: "Ohio",
  IL: "Illinois",
  TN: "Tennessee",
};

const NON_CAMPAIGN_HOST_PARTS = [
  "ballotpedia.org",
  "wikipedia.org",
  "fec.gov",
  "ohiosos.gov",
  "elections.il.gov",
  "tnsos",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "youtube.com",
  "news",
  "newspaper",
  "cleveland.com",
  "dispatch.com",
  "cincinnati.com",
  "wkyc.com",
  "local12.com",
  "nbc",
  "abc",
  "cbs",
  "fox",
  "pbs",
];

export function isCandidateSerpApiEnabled(): boolean {
  return process.env.ENABLE_CANDIDATE_SERPAPI === "true";
}

function clean(value: unknown, max = 260): string | null {
  const text = normalizeWhitespace(String(value ?? ""));
  return text ? text.slice(0, max) : null;
}

function domainFrom(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function inferOfficeFromText(text: string, fallback?: string | null): string | null {
  if (fallback) return fallback;
  const lower = text.toLowerCase();
  if (lower.includes("governor")) return "Governor";
  if (lower.includes("state senate")) return "State Senate";
  if (lower.includes("state house")) return "State House";
  if (lower.includes("congress") || lower.includes("u.s. house") || lower.includes("us house")) {
    return "US Representative";
  }
  if (lower.includes("u.s. senate") || lower.includes("us senate")) return "US Senator";
  if (lower.includes("mayor")) return "Mayor";
  if (lower.includes("city council")) return "City Council";
  if (lower.includes("school board")) return "School Board";
  if (lower.includes("judge") || lower.includes("court")) return "Judge";
  return null;
}

function partyFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bdemocrat(ic)?\b/.test(lower)) return "Democratic";
  if (/\brepublican\b|\bgop\b/.test(lower)) return "Republican";
  if (/\bindependent\b/.test(lower)) return "Independent";
  if (/\bnonpartisan\b/.test(lower)) return "Nonpartisan";
  return null;
}

function socialLinksFor(link: string | null): Record<string, unknown> {
  const host = domainFrom(link);
  if (!host || !link) return {};
  if (host.includes("facebook.com")) return { facebook: link };
  if (host.includes("instagram.com")) return { instagram: link };
  if (host === "x.com" || host.includes("twitter.com")) return { x: link };
  if (host.includes("linkedin.com")) return { linkedin: link };
  if (host.includes("youtube.com")) return { youtube: link };
  return {};
}

function isLikelyCampaignWebsite(link: string | null, title: string, candidateName: string): boolean {
  const host = domainFrom(link);
  if (!host || !link) return false;
  if (NON_CAMPAIGN_HOST_PARTS.some((part) => host.includes(part))) return false;
  const nameParts = candidateName.toLowerCase().split(/\s+/).filter((part) => part.length > 2);
  const hostMatchesName = nameParts.some((part) => host.includes(part.replace(/[^a-z0-9]/g, "")));
  const campaignLanguage = /\bfor\b|\bcampaign\b|\bcommittee\b|\bvote\b|\belect\b/i.test(`${title} ${host}`);
  return hostMatchesName || campaignLanguage;
}

function buildQuery(args: {
  query?: string;
  candidateName?: string;
  officeName?: string | null;
  state?: string;
  cycle?: number;
}): string | null {
  if (args.query?.trim()) return args.query.trim();
  if (!args.candidateName?.trim()) return null;
  const pieces = [
    `"${args.candidateName.trim()}"`,
    args.officeName,
    args.state ? STATE_NAMES[args.state.toUpperCase()] ?? args.state.toUpperCase() : null,
    args.cycle,
    "campaign candidate official",
  ].filter(Boolean);
  return pieces.join(" ");
}

function resultToRecord(args: {
  result: SerpApiOrganicResult;
  query: string;
  candidateName: string;
  officeName?: string | null;
  state?: string;
  cycle?: number;
  retrievedAt: string;
}): NormalizedCandidateIntelRecord | null {
  const title = clean(args.result.title, 300) ?? "";
  const link = clean(args.result.link, 600);
  const snippet = clean(args.result.snippet, 1000) ?? "";
  const combined = `${title} ${snippet}`;
  if (!link && !title && !snippet) return null;

  const officeName = inferOfficeFromText(combined, args.officeName);
  const officeLevel = inferOfficeLevel(officeName);
  const party = normalizeParty(partyFromText(combined));
  const campaignWebsite = isLikelyCampaignWebsite(link, title, args.candidateName) ? link : null;
  const sourceRecordId = sha256Json({
    source: SOURCE_KEY,
    candidate: args.candidateName,
    link,
    title,
    position: args.result.position,
  });
  const completeness = [
    args.candidateName,
    officeName,
    args.state,
    link,
    snippet,
    campaignWebsite,
    party,
  ].filter(Boolean).length * 8;

  return {
    sourceKey: SOURCE_KEY,
    sourceRecordId,
    sourceUrl: link,
    sourceRetrievedAt: args.retrievedAt,
    rawPayload: {
      query: args.query,
      result: args.result,
    },
    candidateName: args.candidateName,
    displayName: args.candidateName,
    party,
    officeName,
    officeLevel,
    officeHierarchy: inferOfficeHierarchy(officeName, officeLevel),
    state: args.state?.toUpperCase() ?? null,
    jurisdictionName: args.state ? STATE_NAMES[args.state.toUpperCase()] ?? args.state.toUpperCase() : null,
    jurisdictionType: args.state ? "state" : null,
    districtType: officeLevel === "state" ? "statewide_or_state_district" : null,
    districtLabel: args.state ? STATE_NAMES[args.state.toUpperCase()] ?? args.state.toUpperCase() : null,
    electionYear: electionYearFrom(null, args.cycle ?? null),
    filingStatus: "public_web_result",
    campaignWebsite,
    socialLinks: {
      ...socialLinksFor(link),
      serpapiResult: link,
      displayedLink: clean(args.result.displayed_link),
    },
    mapLayerHint: {
      preferredLayer: officeLevel === "federal" ? "district" : "state",
      state: args.state?.toUpperCase() ?? null,
    },
    uspsRouteHint: {
      matchBy: "operator_verified_geography",
      note: "SerpAPI can discover public campaign context, but USPS counts still require route verification.",
    },
    dataConfidence: "public_aggregate",
    confidence: Math.min(82, confidenceFromSource(SOURCE_KEY, completeness)),
  };
}

export async function fetchSerpapiCandidateIntel(args: {
  query?: string;
  candidateName?: string;
  officeName?: string | null;
  state?: string;
  cycle?: number;
  maxRecords?: number;
}): Promise<CandidateIntelProviderResult> {
  const key = process.env.SERPAPI_KEY;
  if (!isCandidateSerpApiEnabled()) {
    return {
      sourceKey: SOURCE_KEY,
      skipped: true,
      reason: "ENABLE_CANDIDATE_SERPAPI is not true. Candidate SerpAPI enrichment is gated off.",
      records: [],
    };
  }
  if (!key) {
    return {
      sourceKey: SOURCE_KEY,
      skipped: true,
      reason: "SERPAPI_KEY is not configured.",
      records: [],
    };
  }

  const query = buildQuery(args);
  const candidateName = clean(args.candidateName) ?? clean(args.query);
  if (!query || !candidateName) {
    return {
      sourceKey: SOURCE_KEY,
      skipped: true,
      reason: "Candidate SerpAPI enrichment requires candidateName or a targeted query.",
      records: [],
    };
  }

  const maxRecords = Math.min(Math.max(args.maxRecords ?? 5, 1), 10);
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", key);
  url.searchParams.set("num", String(Math.min(10, Math.max(maxRecords, 4))));
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  if (args.state) {
    url.searchParams.set("location", `${STATE_NAMES[args.state.toUpperCase()] ?? args.state.toUpperCase()}, United States`);
  }

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`SerpAPI candidate search returned ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as SerpApiPayload;
  if (payload.error) {
    throw new Error(`SerpAPI candidate search error: ${payload.error}`);
  }

  const retrievedAt = new Date().toISOString();
  const records = (payload.organic_results ?? [])
    .slice(0, maxRecords)
    .map((result) =>
      resultToRecord({
        result,
        query,
        candidateName,
        officeName: args.officeName,
        state: args.state,
        cycle: args.cycle,
        retrievedAt,
      }),
    )
    .filter((record): record is NormalizedCandidateIntelRecord => Boolean(record));

  return {
    sourceKey: SOURCE_KEY,
    records,
    warnings: [
      "SerpAPI results are public web discovery signals, not authoritative filing records. Verify official source URLs before proposal, outreach, or production handoff.",
    ],
  };
}
