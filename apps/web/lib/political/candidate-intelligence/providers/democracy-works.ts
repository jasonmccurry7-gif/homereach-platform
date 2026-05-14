import { isoDate } from "../normalization";
import type { CandidateIntelProviderResult, NormalizedElectionTimeline } from "../types";

function pickDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return isoDate(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return isoDate(obj.date ?? obj.timestamp ?? obj.description);
  }
  return null;
}

function inferStateFromOcd(value: unknown): string | null {
  const match = String(value ?? "").match(/state:([a-z]{2})/i);
  return match ? match[1]!.toUpperCase() : null;
}

export async function fetchDemocracyWorksIntel(args: {
  state?: string;
  maxRecords?: number;
}): Promise<CandidateIntelProviderResult> {
  const sourceKey = "democracy_works_elections_v2";
  const key = process.env.DEMOCRACY_WORKS_API_KEY;
  if (!key) {
    return {
      sourceKey,
      skipped: true,
      reason: "DEMOCRACY_WORKS_API_KEY is not configured.",
      records: [],
      timelines: [],
    };
  }

  const base = process.env.DEMOCRACY_WORKS_API_BASE_URL || "https://api.democracy.works/v2";
  const url = new URL(`${base.replace(/\/$/, "")}/elections`);
  if (args.state) {
    url.searchParams.set("state", args.state.toUpperCase());
  }

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-api-key": key,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Democracy Works elections returned ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as Record<string, unknown>).elections)
      ? (payload as Record<string, unknown>).elections as unknown[]
      : [];

  const timelines: NormalizedElectionTimeline[] = rows.slice(0, args.maxRecords ?? 500).flatMap((row) => {
    const election = row as Record<string, unknown>;
    const electionDate = pickDate(election.date ?? election.electionDay ?? election["election-day"] ?? election.election_day);
    if (!electionDate) return [];

    const authority = election.authority as Record<string, unknown> | undefined;
    const ocd = election.ocdId ?? election["ocd-id"] ?? election.ocd_id ?? election.divisionId ?? authority?.ocdId;
    const state = inferStateFromOcd(ocd) ?? args.state?.toUpperCase() ?? null;
    if (args.state && state && state !== args.state.toUpperCase()) return [];

    const registration = election.registration as Record<string, unknown> | undefined;
    const byMail = election.byMail ?? election["by-mail"] ?? election.voteByMail;
    const early = election.earlyVoting ?? election["early-voting"];

    return [{
      sourceKey,
      sourceUrl: url.toString(),
      rawPayload: election,
      electionName: String(election.name ?? election.title ?? election["official-title"] ?? "Election"),
      electionType: String(election.type ?? election.electionType ?? "other").toLowerCase(),
      electionDate,
      cycle: Number.parseInt(electionDate.slice(0, 4), 10),
      state,
      jurisdictionName: String(ocd ?? authority?.name ?? ""),
      jurisdictionType: "ocd_division",
      registrationDeadline: pickDate(registration?.deadline),
      absenteeStart: pickDate((byMail as Record<string, unknown> | undefined)?.start),
      absenteeDeadline: pickDate((byMail as Record<string, unknown> | undefined)?.deadline),
      earlyVoteStart: pickDate((early as Record<string, unknown> | undefined)?.start),
      earlyVoteEnd: pickDate((early as Record<string, unknown> | undefined)?.end),
      dataConfidence: "paid_vendor",
    }];
  });

  return { sourceKey, records: [], timelines };
}
