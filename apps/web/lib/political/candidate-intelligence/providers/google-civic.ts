import { isoDate } from "../normalization";
import type { CandidateIntelProviderResult, NormalizedElectionTimeline } from "../types";

interface GoogleElection {
  id: string;
  name: string;
  electionDay: string;
  ocdDivisionId?: string;
  [key: string]: unknown;
}

function stateFromOcd(ocd?: string): string | null {
  const match = String(ocd ?? "").match(/state:([a-z]{2})/i);
  return match ? match[1]!.toUpperCase() : null;
}

export async function fetchGoogleCivicIntel(args: {
  state?: string;
}): Promise<CandidateIntelProviderResult> {
  const sourceKey = "google_civic_elections_v1";
  const key = process.env.GOOGLE_CIVIC_API_KEY;
  if (!key) {
    return {
      sourceKey,
      skipped: true,
      reason: "GOOGLE_CIVIC_API_KEY is not configured.",
      records: [],
      timelines: [],
    };
  }

  const url = new URL("https://www.googleapis.com/civicinfo/v2/elections");
  url.searchParams.set("key", key);
  const response = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Google Civic elections returned ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as { elections?: GoogleElection[] };
  const timelines: NormalizedElectionTimeline[] = (payload.elections ?? [])
    .flatMap((election) => {
      const electionDate = isoDate(election.electionDay);
      const state = stateFromOcd(election.ocdDivisionId);
      if (!electionDate) return [];
      if (args.state && state && state !== args.state.toUpperCase()) return [];

      return [{
        sourceKey,
        sourceUrl: url.toString().replace(key, "[redacted]"),
        rawPayload: election,
        electionName: election.name,
        electionType: /primary/i.test(election.name) ? "primary" : /special/i.test(election.name) ? "special" : "general",
        electionDate,
        cycle: Number.parseInt(electionDate.slice(0, 4), 10),
        state,
        jurisdictionName: election.ocdDivisionId ?? null,
        jurisdictionType: "ocd_division",
        dataConfidence: "public_aggregate",
      } satisfies NormalizedElectionTimeline];
    });

  return {
    sourceKey,
    records: [],
    timelines,
    warnings: [
      "Google Civic candidate data is address/election dependent. The nightly sync stores election timelines; intake can use voterInfoQuery later when an address or district centerpoint is available.",
    ],
  };
}
