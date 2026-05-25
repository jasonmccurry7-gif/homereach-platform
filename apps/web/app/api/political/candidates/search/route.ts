import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isPoliticalEnabled } from "@/lib/political/env";
import { searchCandidateSuggestions } from "@/lib/political/candidate-intelligence/repository";
import {
  normalizePublicCandidateSearchParams,
  toPublicCandidateSuggestion,
} from "@/lib/political/candidate-suggestions-public";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isPoliticalEnabled()) {
    return NextResponse.json(
      { ok: false, candidates: [], error: "Political Command Center is disabled." },
      { status: 404 }
    );
  }

  const url = new URL(req.url);
  const { query, state, limit } = normalizePublicCandidateSearchParams({
    query: url.searchParams.get("q"),
    state: url.searchParams.get("state"),
    limit: url.searchParams.get("limit"),
  });

  if (query.length < 2) {
    return NextResponse.json({ ok: true, candidates: [] });
  }

  try {
    const supabase = createServiceClient();
    const candidates = await searchCandidateSuggestions(supabase, { query, state, limit });
    const publicCandidates = candidates.map(toPublicCandidateSuggestion);
    return NextResponse.json({ ok: true, candidates: publicCandidates });
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
      { status: migrationHint ? 200 : 500 }
    );
  }
}
