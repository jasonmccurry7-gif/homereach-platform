// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Political Command Center: Priority Engine
//
// Pure scoring. No DB, no IO, no clock side effects beyond an injectable
// `now` parameter. Deterministic — same input → same output, every time.
//
// Inputs are operational ONLY:
//   • Contact-info completeness (email, phone, website, manager, FB)
//   • Recency of contact (last_contacted_at)
//   • Election proximity (days until election_date)
//   • Response/engagement history
//   • Existing proposal progress (sent / viewed / approved)
//
// Explicitly NOT inputs:
//   • Ideology
//   • Party registration (even when public)
//   • Voter-segment fit
//   • Persuasion likelihood
//   • Donation data
//   • Polling / electoral competitiveness
//
// The function returns both a total score (0–100) and a breakdown, so the
// admin UI can show operators why a candidate ranks where it does.
// ─────────────────────────────────────────────────────────────────────────────

export interface PriorityInput {
  /** Candidate fields from campaign_candidates. */
  email: string | null;
  phone: string | null;
  website: string | null;
  facebookUrl: string | null;
  managerName: string | null;
  managerEmail: string | null;
  partyOnRecord: string | null;

  /** ISO timestamps, nullable. */
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;

  /** Election date (YYYY-MM-DD) or ISO. */
  electionDate: string | null;

  /** Compliance — a do_not_contact candidate gets forced to 0. */
  doNotContact: boolean;

  /**
   * Engagement signals from downstream tables. The rescorer loads these
   * from sales_events + political_proposals; the pure function doesn't
   * care where they came from.
   */
  daysSinceLastEngagement: number | null;  // sales_events or comms timestamp
  hasProposalSent: boolean;
  hasProposalViewed: boolean;
  hasProposalApproved: boolean;
}

export type PriorityTier = "hot" | "warm" | "cold";

export interface PriorityBreakdown {
  completeness: number;       // 0–25
  recency: number;            // 0–20
  electionProximity: number;  // 0–30
  engagement: number;         // 0–10
  proposalActivity: number;   // 0–15
}

export interface PriorityResult {
  /** Operational score, 0–100. Integer. */
  score: number;
  /** 'hot' | 'warm' | 'cold' — derived from score, not stored separately. */
  tier: PriorityTier;
  /** Completeness score 0-100 — reused by the UI as "contact completeness". */
  completenessScore: number;
  breakdown: PriorityBreakdown;
  /** Human-readable reasons, 1-3 items. Pure — safe to render anywhere. */
  reasons: string[];
}

// ── Thresholds ──────────────────────────────────────────────────────────────

export const HOT_THRESHOLD = 70;
export const WARM_THRESHOLD = 40;

// ── Public entry point ──────────────────────────────────────────────────────

export function computeCandidatePriority(
  input: PriorityInput,
  now: Date = new Date(),
): PriorityResult {
  if (input.doNotContact) {
    return {
      score: 0,
      tier: "cold",
      completenessScore: 0,
      breakdown: {
        completeness: 0,
        recency: 0,
        electionProximity: 0,
        engagement: 0,
        proposalActivity: 0,
      },
      reasons: ["Candidate is marked do_not_contact."],
    };
  }

  const breakdown: PriorityBreakdown = {
    completeness: scoreCompleteness(input),
    recency: scoreRecency(input.lastContactedAt, now),
    electionProximity: scoreElectionProximity(input.electionDate, now),
    engagement: scoreEngagement(input),
    proposalActivity: scoreProposalActivity(input),
  };

  const score = clampScore(
    breakdown.completeness +
      breakdown.recency +
      breakdown.electionProximity +
      breakdown.engagement +
      breakdown.proposalActivity,
  );

  const tier: PriorityTier =
    score >= HOT_THRESHOLD ? "hot" : score >= WARM_THRESHOLD ? "warm" : "cold";

  return {
    score,
    tier,
    completenessScore: scoreCompleteness(input) * 4, // 0–25 → 0–100
    breakdown,
    reasons: buildReasons(input, breakdown, now),
  };
}

// ── Individual scoring functions ────────────────────────────────────────────

/** Completeness — do we have enough to actually reach this campaign? */
function scoreCompleteness(input: PriorityInput): number {
  let s = 0;
  if (nonEmpty(input.email)) s += 6;
  if (nonEmpty(input.phone)) s += 6;
  if (nonEmpty(input.website)) s += 4;
  if (nonEmpty(input.managerName) || nonEmpty(input.managerEmail)) s += 5;
  if (nonEmpty(input.facebookUrl)) s += 2;
  if (nonEmpty(input.partyOnRecord)) s += 2;
  return Math.min(25, s);
}

/** Recency of last contact — uncontacted campaigns = highest priority;
 *  very-recently-contacted = wait for a response; stale-contacted = diminishes. */
function scoreRecency(lastContactedAt: string | null, now: Date): number {
  if (!lastContactedAt) return 20; // never contacted → high priority
  const days = daysBetween(lastContactedAt, now);
  if (days === null) return 10;
  if (days <= 3) return 5;     // too recent, give them time
  if (days <= 14) return 15;
  if (days <= 30) return 12;
  if (days <= 60) return 8;
  if (days <= 120) return 4;
  return 0;                    // stale — not priority anymore
}

/** Election proximity — the operational urgency curve.
 *  Sweet spot is 60–90 days out (time to design + send mail + land in home). */
function scoreElectionProximity(electionDate: string | null, now: Date): number {
  if (!electionDate) return 5; // unknown date = neutral-low
  const days = daysBetween(new Date().toISOString(), electionDate, now);
  if (days === null) return 5;
  if (days < 0) return 0;        // already past
  if (days < 14) return 5;       // too close, mail window is closing
  if (days < 30) return 20;      // tight, still feasible
  if (days < 60) return 25;      // sweet spot start
  if (days < 90) return 30;      // peak — ideal mail window
  if (days < 150) return 20;
  if (days < 270) return 12;
  if (days < 365) return 6;
  return 2;                       // far future
}

/** Engagement — was there recent bi-directional activity we can build on? */
function scoreEngagement(input: PriorityInput): number {
  const days = input.daysSinceLastEngagement;
  if (days === null) return 0;
  if (days <= 14) return 10;
  if (days <= 30) return 7;
  if (days <= 60) return 4;
  return 2;
}

/** Proposal activity — pipeline depth. */
function scoreProposalActivity(input: PriorityInput): number {
  if (input.hasProposalApproved) return 15;
  if (input.hasProposalViewed) return 10;
  if (input.hasProposalSent) return 8;
  return 0;
}

// ── Reason builder ─────────────────────────────────────────────────────────

function buildReasons(
  input: PriorityInput,
  breakdown: PriorityBreakdown,
  now: Date,
): string[] {
  const reasons: string[] = [];

  // Election proximity is usually the top operational driver.
  if (input.electionDate) {
    const days = daysBetween(new Date().toISOString(), input.electionDate, now);
    if (days !== null && days >= 0) {
      if (days < 14) reasons.push(`Election in ${days}d — mail window closing`);
      else if (days < 60) reasons.push(`Election in ${days}d — tight window`);
      else if (days < 90) reasons.push(`Election in ${days}d — ideal mail window`);
      else if (days < 150) reasons.push(`Election in ${days}d — approaching window`);
    }
  }

  if (!input.lastContactedAt) reasons.push("Never contacted");
  else {
    const days = daysBetween(input.lastContactedAt, now);
    if (days !== null && days > 30) reasons.push(`Last contacted ${days}d ago`);
  }

  if (input.hasProposalApproved) reasons.push("Approved proposal in pipeline");
  else if (input.hasProposalViewed) reasons.push("Proposal viewed, awaiting decision");
  else if (input.hasProposalSent) reasons.push("Proposal sent");

  if (breakdown.completeness < 10) reasons.push("Contact info incomplete");

  // Keep the reasons list short and actionable.
  return reasons.slice(0, 3);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function nonEmpty(s: string | null | undefined): boolean {
  return !!(s && s.trim().length > 0);
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Days between `fromIso` and `toIso` (or `now` if `toIso` is omitted).
 * Positive means `toIso` is in the future. Null on bad input.
 */
function daysBetween(fromIso: string, toIso: string | Date, now?: Date): number | null {
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from)) return null;
  const to =
    typeof toIso === "string"
      ? (Date.parse(toIso) || (now ?? new Date()).getTime())
      : (toIso instanceof Date ? toIso.getTime() : (now ?? new Date()).getTime());
  if (!Number.isFinite(to)) return null;
  const diffMs = to - from;
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}
