// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Political Command Center: Dashboard Queries
//
// Server-only reads for the /admin/political dashboard strip and follow-up
// queue. All queries go through the user-scoped Supabase client (RLS).
//
// Numbers are intentionally simple aggregates — small table counts, one-shot
// SUMs. No window functions, no PL/pgSQL, nothing that requires new DB
// objects beyond what 059–064 have already set up.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";

import { createClient as createUserClient } from "@/lib/supabase/server";

export interface DashboardKpis {
  totalCandidates: number;
  activeCandidates: number;
  hotCandidates: number;
  followUpsDue: number;
  proposalsSent: number;          // sent + viewed + approved
  proposalsApproved: number;
  proposalsDeclined: number;
  closeRatePct: number | null;    // approved / (approved + declined)
  revenueCents: number;           // sum of amount_paid_cents across paid/deposit_paid
  avgDealCents: number | null;    // average political_orders.total_cents for paid orders
  electionsThisQuarter: number;   // next 90 days
}

/** Returns the dashboard KPIs in one call. A single page render = ~6 count
 *  queries + 2 sum/avg queries. Fast even at scale. */
export async function loadDashboardKpis(): Promise<DashboardKpis> {
  const supabase = await createUserClient();

  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayIso = new Date().toISOString();
  const todayDateOnly = todayIso.slice(0, 10);

  // ── Candidate counts ──────────────────────────────────────────────────────
  const totalP = supabase
    .from("campaign_candidates")
    .select("id", { count: "exact", head: true });

  const activeP = supabase
    .from("campaign_candidates")
    .select("id", { count: "exact", head: true })
    .eq("candidate_status", "active");

  const hotP = supabase
    .from("campaign_candidates")
    .select("id", { count: "exact", head: true })
    .gte("priority_score", 70);

  const followUpsP = supabase
    .from("campaign_candidates")
    .select("id", { count: "exact", head: true })
    .lte("next_follow_up_at", todayIso)
    .eq("do_not_contact", false);

  const electionsQuarterP = supabase
    .from("campaign_candidates")
    .select("id", { count: "exact", head: true })
    .gte("election_date", todayDateOnly)
    .lte("election_date", in90);

  // ── Proposal counts ───────────────────────────────────────────────────────
  const proposalsSentP = supabase
    .from("political_proposals")
    .select("id", { count: "exact", head: true })
    .in("status", ["sent", "viewed", "approved"]);

  const proposalsApprovedP = supabase
    .from("political_proposals")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");

  const proposalsDeclinedP = supabase
    .from("political_proposals")
    .select("id", { count: "exact", head: true })
    .eq("status", "declined");

  // ── Orders (revenue) — sum + avg ──────────────────────────────────────────
  // Supabase doesn't expose AVG directly via the REST client, so we pull a
  // bounded set and compute client-side. Bounded at 1000 rows; past that we'd
  // move to a view or rpc.
  const ordersP = supabase
    .from("political_orders")
    .select("total_cents, amount_paid_cents, payment_status")
    .in("payment_status", ["paid", "deposit_paid"])
    .limit(1000);

  const [
    totalRes,
    activeRes,
    hotRes,
    followUpsRes,
    electionsRes,
    proposalsSentRes,
    proposalsApprovedRes,
    proposalsDeclinedRes,
    ordersRes,
  ] = await Promise.all([
    totalP,
    activeP,
    hotP,
    followUpsP,
    electionsQuarterP,
    proposalsSentP,
    proposalsApprovedP,
    proposalsDeclinedP,
    ordersP,
  ]);

  const totalCandidates     = totalRes.count     ?? 0;
  const activeCandidates    = activeRes.count    ?? 0;
  const hotCandidates       = hotRes.count       ?? 0;
  const followUpsDue        = followUpsRes.count ?? 0;
  const electionsThisQuarter = electionsRes.count ?? 0;
  const proposalsSent       = proposalsSentRes.count     ?? 0;
  const proposalsApproved   = proposalsApprovedRes.count ?? 0;
  const proposalsDeclined   = proposalsDeclinedRes.count ?? 0;

  const closedTotal = proposalsApproved + proposalsDeclined;
  const closeRatePct = closedTotal > 0
    ? Math.round((proposalsApproved / closedTotal) * 1000) / 10
    : null;

  let revenueCents = 0;
  let paidOrderCount = 0;
  let paidOrderTotalSum = 0;
  for (const row of (ordersRes.data ?? []) as Array<{
    total_cents: number | string;
    amount_paid_cents: number | string;
    payment_status: string;
  }>) {
    revenueCents += Number(row.amount_paid_cents) || 0;
    if (row.payment_status === "paid") {
      paidOrderCount += 1;
      paidOrderTotalSum += Number(row.total_cents) || 0;
    }
  }
  const avgDealCents = paidOrderCount > 0
    ? Math.round(paidOrderTotalSum / paidOrderCount)
    : null;

  return {
    totalCandidates,
    activeCandidates,
    hotCandidates,
    followUpsDue,
    proposalsSent,
    proposalsApproved,
    proposalsDeclined,
    closeRatePct,
    revenueCents,
    avgDealCents,
    electionsThisQuarter,
  };
}

// ── Follow-up queue ──────────────────────────────────────────────────────────

export interface FollowUpRow {
  id: string;
  candidateName: string;
  officeSought: string | null;
  state: string;
  priorityScore: number | null;
  nextFollowUpAt: string;
  lastContactedAt: string | null;
  candidateStatus: string;
  electionDate: string | null;
}

interface FollowUpDbRow {
  id: string;
  candidate_name: string;
  office_sought: string | null;
  state: string;
  priority_score: number | null;
  next_follow_up_at: string;
  last_contacted_at: string | null;
  candidate_status: string;
  election_date: string | null;
}

/** Candidates whose next_follow_up_at <= now. Ordered soonest-first.
 *  Excludes do_not_contact = true. */
export async function loadFollowUpQueue(limit = 20): Promise<FollowUpRow[]> {
  const supabase = await createUserClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("campaign_candidates")
    .select(
      "id, candidate_name, office_sought, state, priority_score, next_follow_up_at, last_contacted_at, candidate_status, election_date",
    )
    .lte("next_follow_up_at", now)
    .eq("do_not_contact", false)
    .order("next_follow_up_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`loadFollowUpQueue: ${error.message}`);
  return ((data ?? []) as unknown as FollowUpDbRow[]).map((r) => ({
    id: r.id,
    candidateName: r.candidate_name,
    officeSought: r.office_sought,
    state: r.state,
    priorityScore: r.priority_score,
    nextFollowUpAt: r.next_follow_up_at,
    lastContactedAt: r.last_contacted_at,
    candidateStatus: r.candidate_status,
    electionDate: r.election_date,
  }));
}

// ── Hot queue (ranked by priority_score) ────────────────────────────────────

export async function loadHotQueue(limit = 10): Promise<FollowUpRow[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("campaign_candidates")
    .select(
      "id, candidate_name, office_sought, state, priority_score, next_follow_up_at, last_contacted_at, candidate_status, election_date",
    )
    .gte("priority_score", 70)
    .eq("do_not_contact", false)
    .order("priority_score", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`loadHotQueue: ${error.message}`);
  return ((data ?? []) as unknown as FollowUpDbRow[]).map((r) => ({
    id: r.id,
    candidateName: r.candidate_name,
    officeSought: r.office_sought,
    state: r.state,
    priorityScore: r.priority_score,
    nextFollowUpAt: r.next_follow_up_at ?? "",
    lastContactedAt: r.last_contacted_at,
    candidateStatus: r.candidate_status,
    electionDate: r.election_date,
  }));
}

// ── Upcoming elections (next 90d, sorted closest-first) ─────────────────────

export interface UpcomingElectionRow {
  id: string;
  candidateName: string;
  officeSought: string | null;
  state: string;
  electionDate: string;
  daysUntil: number;
}

export async function loadUpcomingElections(days = 90, limit = 15): Promise<UpcomingElectionRow[]> {
  const supabase = await createUserClient();
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("campaign_candidates")
    .select("id, candidate_name, office_sought, state, election_date")
    .gte("election_date", today)
    .lte("election_date", cutoff)
    .order("election_date", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`loadUpcomingElections: ${error.message}`);
  const now = Date.now();
  return ((data ?? []) as unknown as Array<{
    id: string;
    candidate_name: string;
    office_sought: string | null;
    state: string;
    election_date: string;
  }>).map((r) => ({
    id: r.id,
    candidateName: r.candidate_name,
    officeSought: r.office_sought,
    state: r.state,
    electionDate: r.election_date,
    daysUntil: Math.max(
      0,
      Math.round((Date.parse(r.election_date) - now) / (24 * 60 * 60 * 1000)),
    ),
  }));
}

// ── Latest priority run (for "last rescored" indicator) ─────────────────────

export interface LatestRescoreInfo {
  lastRunAt: string | null;
  lastRunStatus: "ok" | "error" | "running" | null;
  candidatesUpdated: number | null;
}

export async function loadLatestRescoreInfo(): Promise<LatestRescoreInfo> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("political_priority_runs")
    .select("started_at, completed_at, status, candidates_updated")
    .order("started_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) {
    return { lastRunAt: null, lastRunStatus: null, candidatesUpdated: null };
  }
  const row = data[0] as {
    started_at: string;
    completed_at: string | null;
    status: "ok" | "error" | "running";
    candidates_updated: number;
  };
  return {
    lastRunAt: row.completed_at ?? row.started_at,
    lastRunStatus: row.status,
    candidatesUpdated: row.candidates_updated,
  };
}
