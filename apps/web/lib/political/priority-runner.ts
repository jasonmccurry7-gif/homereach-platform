// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Political Priority Rescorer (batch)
//
// Pulls active candidates, runs the pure priority engine, and writes
// priority_score + completeness_score back to each row. Logs a single
// political_priority_runs row per batch.
//
// Gated by ENABLE_POLITICAL at the calling action. Safe to run multiple
// times per day — always recomputes from current DB state.
//
// Mirrors the shape of lib/lead-intel/rescorer.ts. Uses the local
// `@/lib/supabase/service` service-role client for write parity with
// existing rescorers in the codebase.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  computeCandidatePriority,
  HOT_THRESHOLD,
  WARM_THRESHOLD,
  type PriorityInput,
  type PriorityTier,
} from "./priority";

type Supa = ReturnType<typeof createServiceClient>;

export interface PriorityRescoreSummary {
  ok: boolean;
  runId: string | null;
  candidatesScanned: number;
  candidatesUpdated: number;
  tierCounts: { hot: number; warm: number; cold: number };
  errors: string[];
  durationMs: number;
}

/** Sensible cap for Phase 7 validation. Real volumes stay well under this. */
const BATCH_CAP = 5000;
const PAGE_SIZE = 500;

export async function rescoreAllPoliticalCandidates(params: {
  ranByUserId?: string | null;
  source?: string;
} = {}): Promise<PriorityRescoreSummary> {
  const t0 = Date.now();
  const supa = createServiceClient();
  const errors: string[] = [];
  const tierCounts = { hot: 0, warm: 0, cold: 0 };

  // 1. Open the audit row.
  let runId: string | null = null;
  try {
    const { data, error } = await supa
      .from("political_priority_runs")
      .insert({
        ran_by_user_id: params.ranByUserId ?? null,
        source: params.source ?? "manual",
        status: "running",
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "insert returned no row");
    }
    runId = (data as { id: string }).id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    errors.push(`open audit row: ${msg}`);
    // If we can't even open the audit row we still continue, so rescoring
    // isn't blocked on audit failure. Errors are recorded in the return.
  }

  let candidatesScanned = 0;
  let candidatesUpdated = 0;

  // 2. Page through candidates in batches.
  for (let offset = 0; offset < BATCH_CAP; offset += PAGE_SIZE) {
    const { data, error } = await supa
      .from("campaign_candidates")
      .select(
        [
          "id",
          "candidate_email:campaign_email",   // just renaming for clarity in the mapper
          "campaign_email",
          "campaign_phone",
          "campaign_website",
          "facebook_url",
          "campaign_manager_name",
          "campaign_manager_email",
          "party_optional_public",
          "last_contacted_at",
          "next_follow_up_at",
          "election_date",
          "do_not_contact",
          "priority_score",
          "completeness_score",
        ].join(", "),
      )
      .eq("do_not_contact", false)
      .range(offset, offset + PAGE_SIZE - 1)
      .order("created_at", { ascending: true });

    if (error) {
      errors.push(`fetch page ${offset}: ${error.message}`);
      break;
    }
    const rows = (data ?? []) as unknown as CandidateRescoreRow[];
    if (rows.length === 0) break;
    candidatesScanned += rows.length;

    // 3. Load proposal signals for this batch in one query.
    const candidateIds = rows.map((r) => r.id);
    const proposalSignalsByCandidate = await loadProposalSignals(supa, candidateIds);

    // 4. Load engagement signals (last sales_event per candidate) in one query.
    const engagementByCandidate = await loadEngagementSignals(supa, candidateIds);

    // 5. Score + update each row.
    for (const row of rows) {
      const engagementDays = engagementByCandidate.get(row.id) ?? null;
      const proposalSignal = proposalSignalsByCandidate.get(row.id) ?? {
        hasProposalSent: false,
        hasProposalViewed: false,
        hasProposalApproved: false,
      };

      const input: PriorityInput = {
        email: row.campaign_email,
        phone: row.campaign_phone,
        website: row.campaign_website,
        facebookUrl: row.facebook_url,
        managerName: row.campaign_manager_name,
        managerEmail: row.campaign_manager_email,
        partyOnRecord: row.party_optional_public,
        lastContactedAt: row.last_contacted_at,
        nextFollowUpAt: row.next_follow_up_at,
        electionDate: row.election_date,
        doNotContact: row.do_not_contact,
        daysSinceLastEngagement: engagementDays,
        ...proposalSignal,
      };

      const result = computeCandidatePriority(input);
      tierCounts[result.tier] += 1;

      const needsUpdate =
        row.priority_score !== result.score ||
        row.completeness_score !== result.completenessScore;

      if (needsUpdate) {
        const { error: updErr } = await supa
          .from("campaign_candidates")
          .update({
            priority_score: result.score,
            completeness_score: result.completenessScore,
          })
          .eq("id", row.id);
        if (updErr) {
          errors.push(`update ${row.id}: ${updErr.message}`);
        } else {
          candidatesUpdated += 1;
        }
      }
    }

    // If this page was shorter than PAGE_SIZE we've hit the end.
    if (rows.length < PAGE_SIZE) break;
  }

  // 6. Close the audit row.
  const durationMs = Date.now() - t0;
  if (runId) {
    try {
      await supa
        .from("political_priority_runs")
        .update({
          status: errors.length === 0 ? "ok" : "error",
          completed_at: new Date().toISOString(),
          candidates_scanned: candidatesScanned,
          candidates_updated: candidatesUpdated,
          summary: {
            tier_counts: tierCounts,
            errors,
            duration_ms: durationMs,
          },
        })
        .eq("id", runId);
    } catch (err) {
      // Non-fatal — don't want the audit-close to override the real result.
      errors.push(`close audit row: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return {
    ok: errors.length === 0,
    runId,
    candidatesScanned,
    candidatesUpdated,
    tierCounts,
    errors,
    durationMs,
  };
}

// ── Internal types + helpers ────────────────────────────────────────────────

interface CandidateRescoreRow {
  id: string;
  campaign_email: string | null;
  campaign_phone: string | null;
  campaign_website: string | null;
  facebook_url: string | null;
  campaign_manager_name: string | null;
  campaign_manager_email: string | null;
  party_optional_public: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  election_date: string | null;
  do_not_contact: boolean;
  priority_score: number | null;
  completeness_score: number | null;
}

interface ProposalSignal {
  hasProposalSent: boolean;
  hasProposalViewed: boolean;
  hasProposalApproved: boolean;
}

async function loadProposalSignals(
  supa: Supa,
  candidateIds: string[],
): Promise<Map<string, ProposalSignal>> {
  const map = new Map<string, ProposalSignal>();
  if (candidateIds.length === 0) return map;

  const { data, error } = await supa
    .from("political_proposals")
    .select("candidate_id, status")
    .in("candidate_id", candidateIds);
  if (error) return map;

  for (const row of (data ?? []) as unknown as Array<{ candidate_id: string; status: string }>) {
    const existing = map.get(row.candidate_id) ?? {
      hasProposalSent: false,
      hasProposalViewed: false,
      hasProposalApproved: false,
    };
    if (row.status === "approved") existing.hasProposalApproved = true;
    if (row.status === "viewed") existing.hasProposalViewed = true;
    if (row.status === "sent" || row.status === "viewed" || row.status === "approved") {
      existing.hasProposalSent = true;
    }
    map.set(row.candidate_id, existing);
  }
  return map;
}

async function loadEngagementSignals(
  supa: Supa,
  candidateIds: string[],
): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>();
  if (candidateIds.length === 0) return map;

  // We track engagement via political_campaigns → sales_events.political_campaign_id.
  // For each candidate, find the newest sales_event attached to any of their
  // political_campaigns, then compute days-since.
  const { data: campaignsData, error: campaignsErr } = await supa
    .from("political_campaigns")
    .select("id, candidate_id")
    .in("candidate_id", candidateIds);
  if (campaignsErr || !campaignsData) return map;
  const campaignRows = campaignsData as unknown as Array<{ id: string; candidate_id: string }>;
  const campaignToCandidate = new Map<string, string>();
  for (const r of campaignRows) campaignToCandidate.set(r.id, r.candidate_id);
  const campaignIds = campaignRows.map((r) => r.id);
  if (campaignIds.length === 0) return map;

  const { data: eventsData, error: eventsErr } = await supa
    .from("sales_events")
    .select("political_campaign_id, created_at")
    .in("political_campaign_id", campaignIds)
    .order("created_at", { ascending: false })
    .limit(Math.max(1000, candidateIds.length * 5));
  if (eventsErr || !eventsData) return map;

  const now = Date.now();
  for (const ev of (eventsData ?? []) as unknown as Array<{
    political_campaign_id: string | null;
    created_at: string;
  }>) {
    if (!ev.political_campaign_id) continue;
    const candId = campaignToCandidate.get(ev.political_campaign_id);
    if (!candId) continue;
    if (map.has(candId)) continue; // already took the newest one
    const ts = Date.parse(ev.created_at);
    if (!Number.isFinite(ts)) continue;
    const days = Math.round((now - ts) / (24 * 60 * 60 * 1000));
    map.set(candId, days);
  }
  return map;
}

// Re-exports for the UI layer.
export { HOT_THRESHOLD, WARM_THRESHOLD };
export type { PriorityTier };
