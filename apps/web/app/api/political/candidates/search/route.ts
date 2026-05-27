import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isPoliticalEnabled } from "@/lib/political/env";
import { searchCandidateSuggestions } from "@/lib/political/candidate-intelligence/repository";
import {
  normalizePublicCandidateSearchParams,
  toPublicCandidateSuggestion,
} from "@/lib/political/candidate-suggestions-public";
import {
  checkPublicRateLimit,
  publicRateLimitHeaders,
} from "@/lib/security/public-rate-limit";

export const dynamic = "force-dynamic";

const CANDIDATE_SEARCH_RATE_LIMIT = {
  scope: "political:candidate-search",
  limit: 120,
  windowMs: 60_000,
};

export async function GET(req: NextRequest) {
  if (!isPoliticalEnabled()) {
    return NextResponse.json(
      { ok: false, candidates: [], error: "Political Command Center is disabled." },
      { status: 404 }
    );
  }

  const rateLimit = checkPublicRateLimit(req, CANDIDATE_SEARCH_RATE_LIMIT);
  const headers = publicRateLimitHeaders(rateLimit);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, candidates: [], error: "Too many candidate search requests." },
      { status: 429, headers }
    );
  }

  const url = new URL(req.url);
  const { query, state, limit } = normalizePublicCandidateSearchParams({
    query: url.searchParams.get("q"),
    state: url.searchParams.get("state"),
    limit: url.searchParams.get("limit"),
  });

  if (query.length < 2) {
    return NextResponse.json({ ok: true, candidates: [] }, { headers });
  }

  try {
    const supabase = createServiceClient();
    const candidates = await searchCandidateSuggestions(supabase, { query, state, limit });
    const publicCandidates = candidates.map(toPublicCandidateSuggestion);
    return NextResponse.json({ ok: true, candidates: publicCandidates }, { headers });
  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : "Candidate search failed.";
    const migrationHint = /candidate_intel|relation .* does not exist/i.test(message)
      ? "Run Supabase migration 088_candidate_intelligence_ingestion.sql before enabling live candidate search."
      : undefined;

    return NextResponse.json(
      {
        ok: false,
        candidates: [],
        error: message,
        migrationHint,
      },
      { status: migrationHint ? 200 : 500, headers }
    );
  }
}
