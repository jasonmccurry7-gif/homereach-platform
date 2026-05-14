import "server-only";

import { createClient } from "@/lib/supabase/server";

type SupabaseLooseClient = Awaited<ReturnType<typeof createClient>> & {
  from(table: string): any;
};

export interface PoliticalCommandMetric {
  label: string;
  value: string;
  detail: string;
  tone?: "navy" | "red" | "gold" | "green";
}

export interface PoliticalCommandRow {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  amountCents?: number | null;
  href?: string;
  meta: string[];
}

export interface PoliticalCommandSnapshot {
  refreshedAt: string;
  counts: Record<string, number>;
  errors: string[];
}

export interface PoliticalSectionData {
  metrics: PoliticalCommandMetric[];
  rows: PoliticalCommandRow[];
  errors: string[];
  refreshedAt: string;
}

const POLITICAL_TABLES = [
  "campaign_candidates",
  "political_campaigns",
  "political_campaign_contacts",
  "political_organizations",
  "political_outreach_leads",
  "political_plans",
  "political_scenarios",
  "political_routes",
  "political_route_selections",
  "political_reservations",
  "political_proposals",
  "political_orders",
  "political_contracts",
  "political_follow_ups",
  "political_scripts",
  "political_approvals_log",
  "political_data_sources",
  "political_imports",
] as const;

function asCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function compactDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function safeCount(client: SupabaseLooseClient, table: string): Promise<[string, number, string | null]> {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) return [table, 0, `${table}: ${error.message}`];
  return [table, count ?? 0, null];
}

async function safeRows<T>(
  client: SupabaseLooseClient,
  table: string,
  columns: string,
  orderColumn = "created_at",
  limit = 20,
): Promise<{ rows: T[]; error: string | null }> {
  const { data, error } = await client
    .from(table)
    .select(columns)
    .order(orderColumn, { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return { rows: [], error: `${table}: ${error.message}` };
  return { rows: (data ?? []) as T[], error: null };
}

export async function loadPoliticalCommandSnapshot(): Promise<PoliticalCommandSnapshot> {
  const client = (await createClient()) as SupabaseLooseClient;
  const results = await Promise.all(POLITICAL_TABLES.map((table) => safeCount(client, table)));
  const counts: Record<string, number> = {};
  const errors: string[] = [];

  for (const [table, count, error] of results) {
    counts[table] = count;
    if (error) errors.push(error);
  }

  return {
    refreshedAt: new Date().toISOString(),
    counts,
    errors,
  };
}

interface LeadRow {
  id: string;
  contact_name: string;
  contact_email: string;
  candidate_name: string | null;
  organization_name: string | null;
  state: string | null;
  geography_type: string | null;
  geography_value: string | null;
  district_type: string | null;
  status: string;
  budget_estimate_cents: number | string | null;
  desired_drop_count: number | null;
  planner_intent?: string | null;
  proposal_id?: string | null;
  created_at: string;
}

interface PlanRow {
  id: string;
  name: string;
  goal: string | null;
  budget_cents: number | string | null;
  target_window_start: string | null;
  target_window_end: string | null;
  selected_scenario_id: string | null;
  created_at: string;
}

interface ProposalRow {
  id: string;
  public_token: string | null;
  status: string;
  households: number | string | null;
  drops: number | null;
  total_pieces: number | string | null;
  total_investment_cents: number | string | null;
  delivery_window_text: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  approved_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface OrderRow {
  id: string;
  total_cents: number | string;
  amount_paid_cents: number | string;
  payment_mode: string | null;
  payment_status: string;
  fulfillment_status: string;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
}

interface CampaignRow {
  id: string;
  campaign_name: string;
  office: string | null;
  pipeline_status: string;
  budget_estimate_cents: number | string | null;
  geography_type: string | null;
  geography_value: string | null;
  election_date: string | null;
  created_at: string;
}

interface FollowUpRow {
  id: string;
  channel: string;
  trigger: string;
  status: string;
  scheduled_for: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
}

function sectionBaseMetrics(snapshot: PoliticalCommandSnapshot): PoliticalCommandMetric[] {
  return [
    {
      label: "Candidates",
      value: formatCount(snapshot.counts.campaign_candidates ?? 0),
      detail: "leadable campaign records",
      tone: "navy",
    },
    {
      label: "Inbound Leads",
      value: formatCount(snapshot.counts.political_outreach_leads ?? 0),
      detail: "public planner submissions",
      tone: "green",
    },
    {
      label: "Proposals",
      value: formatCount(snapshot.counts.political_proposals ?? 0),
      detail: "quote and approval records",
      tone: "gold",
    },
    {
      label: "Orders",
      value: formatCount(snapshot.counts.political_orders ?? 0),
      detail: "payment and fulfillment records",
      tone: "red",
    },
  ];
}

export async function loadPoliticalLeadsSection(): Promise<PoliticalSectionData> {
  const client = (await createClient()) as SupabaseLooseClient;
  const snapshot = await loadPoliticalCommandSnapshot();
  const { rows, error } = await safeRows<LeadRow>(
    client,
    "political_outreach_leads",
    "id, contact_name, contact_email, candidate_name, organization_name, state, geography_type, geography_value, district_type, status, budget_estimate_cents, desired_drop_count, planner_intent, proposal_id, created_at",
  );
  const byStatus = new Map<string, number>();
  for (const row of rows) byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);

  return {
    refreshedAt: snapshot.refreshedAt,
    errors: [...snapshot.errors, ...(error ? [error] : [])],
    metrics: [
      {
        label: "Inbound Leads",
        value: formatCount(snapshot.counts.political_outreach_leads ?? 0),
        detail: `${formatCount(byStatus.get("new") ?? 0)} new in recent queue`,
        tone: "green",
      },
      {
        label: "Generated Proposals",
        value: formatCount(rows.filter((row) => row.proposal_id).length),
        detail: "recent leads with proposal handoff",
        tone: "gold",
      },
      {
        label: "Budget Captured",
        value: formatCount(rows.filter((row) => asCents(row.budget_estimate_cents)).length),
        detail: "recent leads with budget signal",
        tone: "navy",
      },
      {
        label: "Compliance Consent",
        value: formatCount(rows.length),
        detail: "visible queue uses stored consent flags",
        tone: "red",
      },
    ],
    rows: rows.map((row) => ({
      id: row.id,
      title: row.candidate_name || row.organization_name || row.contact_name,
      subtitle: `${row.contact_name} - ${row.contact_email}`,
      status: row.status,
      amountCents: asCents(row.budget_estimate_cents),
      href: `/admin/political/leads?lead=${row.id}`,
      meta: [
        [row.state, row.geography_type, row.geography_value].filter(Boolean).join(" / ") || "No geography",
        row.district_type || "No level",
        row.desired_drop_count ? `${row.desired_drop_count} drops` : "No drop count",
        row.planner_intent || "planner intent not set",
        compactDate(row.created_at),
      ],
    })),
  };
}

export async function loadPoliticalPlansSection(): Promise<PoliticalSectionData> {
  const client = (await createClient()) as SupabaseLooseClient;
  const snapshot = await loadPoliticalCommandSnapshot();
  const { rows, error } = await safeRows<PlanRow>(
    client,
    "political_plans",
    "id, name, goal, budget_cents, target_window_start, target_window_end, selected_scenario_id, created_at",
  );

  return {
    refreshedAt: snapshot.refreshedAt,
    errors: [...snapshot.errors, ...(error ? [error] : [])],
    metrics: [
      {
        label: "Plans",
        value: formatCount(snapshot.counts.political_plans ?? 0),
        detail: "saved strategy plans",
        tone: "navy",
      },
      {
        label: "Scenarios",
        value: formatCount(snapshot.counts.political_scenarios ?? 0),
        detail: "side-by-side comparisons",
        tone: "gold",
      },
      {
        label: "Finalized",
        value: formatCount(rows.filter((row) => row.selected_scenario_id).length),
        detail: "recent plans with final scenario",
        tone: "green",
      },
      {
        label: "Routes Selected",
        value: formatCount(snapshot.counts.political_route_selections ?? 0),
        detail: "stored route decisions",
        tone: "red",
      },
    ],
    rows: rows.map((row) => ({
      id: row.id,
      title: row.name,
      subtitle: row.goal || "No goal recorded",
      status: row.selected_scenario_id ? "scenario selected" : "scenario needed",
      amountCents: asCents(row.budget_cents),
      href: `/admin/political/plans?plan=${row.id}`,
      meta: [
        row.target_window_start && row.target_window_end
          ? `${compactDate(row.target_window_start)} - ${compactDate(row.target_window_end)}`
          : "No target window",
        row.selected_scenario_id ? "final plan ready" : "comparison open",
        compactDate(row.created_at),
      ],
    })),
  };
}

export async function loadPoliticalProposalsSection(): Promise<PoliticalSectionData> {
  const client = (await createClient()) as SupabaseLooseClient;
  const snapshot = await loadPoliticalCommandSnapshot();
  const { rows, error } = await safeRows<ProposalRow>(
    client,
    "political_proposals",
    "id, public_token, status, households, drops, total_pieces, total_investment_cents, delivery_window_text, sent_at, viewed_at, approved_at, expires_at, created_at",
  );

  return {
    refreshedAt: snapshot.refreshedAt,
    errors: [...snapshot.errors, ...(error ? [error] : [])],
    metrics: [
      {
        label: "Proposals",
        value: formatCount(snapshot.counts.political_proposals ?? 0),
        detail: "client-facing approvals",
        tone: "navy",
      },
      {
        label: "Viewed",
        value: formatCount(rows.filter((row) => row.viewed_at).length),
        detail: "recent proposal engagement",
        tone: "gold",
      },
      {
        label: "Approved",
        value: formatCount(rows.filter((row) => row.status === "approved").length),
        detail: "recent accepted plans",
        tone: "green",
      },
      {
        label: "At Risk",
        value: formatCount(rows.filter((row) => row.status === "sent" && !row.viewed_at).length),
        detail: "sent, not viewed yet",
        tone: "red",
      },
    ],
    rows: rows.map((row) => ({
      id: row.id,
      title: `${Number(row.households ?? 0).toLocaleString()} households / ${row.drops ?? 0} drops`,
      subtitle: row.delivery_window_text || "Delivery window not set",
      status: row.status,
      amountCents: asCents(row.total_investment_cents),
      href: row.public_token ? `/p/${row.public_token}` : `/admin/political/proposals?proposal=${row.id}`,
      meta: [
        `${Number(row.total_pieces ?? 0).toLocaleString()} pieces`,
        row.sent_at ? `sent ${compactDate(row.sent_at)}` : "not sent",
        row.viewed_at ? `viewed ${compactDate(row.viewed_at)}` : "not viewed",
        row.expires_at ? `expires ${compactDate(row.expires_at)}` : "no expiration",
      ],
    })),
  };
}

export async function loadPoliticalPaymentsSection(): Promise<PoliticalSectionData> {
  const client = (await createClient()) as SupabaseLooseClient;
  const snapshot = await loadPoliticalCommandSnapshot();
  const { rows, error } = await safeRows<OrderRow>(
    client,
    "political_orders",
    "id, total_cents, amount_paid_cents, payment_mode, payment_status, fulfillment_status, approved_at, paid_at, created_at",
  );
  const collected = rows.reduce((sum, row) => sum + (asCents(row.amount_paid_cents) ?? 0), 0);
  const booked = rows.reduce((sum, row) => sum + (asCents(row.total_cents) ?? 0), 0);

  return {
    refreshedAt: snapshot.refreshedAt,
    errors: [...snapshot.errors, ...(error ? [error] : [])],
    metrics: [
      {
        label: "Orders",
        value: formatCount(snapshot.counts.political_orders ?? 0),
        detail: "approval and payment records",
        tone: "navy",
      },
      {
        label: "Booked",
        value: formatCurrency(booked),
        detail: "recent order value",
        tone: "gold",
      },
      {
        label: "Collected",
        value: formatCurrency(collected),
        detail: "recent paid amount",
        tone: "green",
      },
      {
        label: "Outstanding",
        value: formatCurrency(Math.max(0, booked - collected)),
        detail: "recent balance remaining",
        tone: "red",
      },
    ],
    rows: rows.map((row) => ({
      id: row.id,
      title: `${formatCurrency(asCents(row.amount_paid_cents) ?? 0)} paid of ${formatCurrency(asCents(row.total_cents) ?? 0)}`,
      subtitle: `${row.payment_mode || "payment mode unset"} / ${row.fulfillment_status}`,
      status: row.payment_status,
      amountCents: asCents(row.total_cents),
      href: `/admin/political/payments?order=${row.id}`,
      meta: [
        row.approved_at ? `approved ${compactDate(row.approved_at)}` : "not approved",
        row.paid_at ? `paid ${compactDate(row.paid_at)}` : "not paid",
        compactDate(row.created_at),
      ],
    })),
  };
}

export async function loadPoliticalCampaignsSection(): Promise<PoliticalSectionData> {
  const client = (await createClient()) as SupabaseLooseClient;
  const snapshot = await loadPoliticalCommandSnapshot();
  const { rows, error } = await safeRows<CampaignRow>(
    client,
    "political_campaigns",
    "id, campaign_name, office, pipeline_status, budget_estimate_cents, geography_type, geography_value, election_date, created_at",
  );

  return {
    refreshedAt: snapshot.refreshedAt,
    errors: [...snapshot.errors, ...(error ? [error] : [])],
    metrics: [
      {
        label: "Campaigns",
        value: formatCount(snapshot.counts.political_campaigns ?? 0),
        detail: "active execution records",
        tone: "navy",
      },
      {
        label: "Contacts",
        value: formatCount(snapshot.counts.political_campaign_contacts ?? 0),
        detail: "decision-maker records",
        tone: "green",
      },
      {
        label: "Organizations",
        value: formatCount(snapshot.counts.political_organizations ?? 0),
        detail: "consultants, PACs, parties",
        tone: "gold",
      },
      {
        label: "Reservations",
        value: formatCount(snapshot.counts.political_reservations ?? 0),
        detail: "route inventory holds",
        tone: "red",
      },
    ],
    rows: rows.map((row) => ({
      id: row.id,
      title: row.campaign_name,
      subtitle: row.office || "Office not set",
      status: row.pipeline_status,
      amountCents: asCents(row.budget_estimate_cents),
      href: `/admin/political/campaigns?campaign=${row.id}`,
      meta: [
        [row.geography_type, row.geography_value].filter(Boolean).join(" / ") || "No geography",
        row.election_date ? `election ${compactDate(row.election_date)}` : "No election date",
        compactDate(row.created_at),
      ],
    })),
  };
}

export async function loadPoliticalFollowUpsSection(): Promise<PoliticalSectionData> {
  const client = (await createClient()) as SupabaseLooseClient;
  const snapshot = await loadPoliticalCommandSnapshot();
  const { rows, error } = await safeRows<FollowUpRow>(
    client,
    "political_follow_ups",
    "id, channel, trigger, status, scheduled_for, attempts, last_error, created_at",
    "scheduled_for",
  );

  return {
    refreshedAt: snapshot.refreshedAt,
    errors: [...snapshot.errors, ...(error ? [error] : [])],
    metrics: [
      {
        label: "Follow-Ups",
        value: formatCount(snapshot.counts.political_follow_ups ?? 0),
        detail: "automated and manual tasks",
        tone: "navy",
      },
      {
        label: "Pending",
        value: formatCount(rows.filter((row) => row.status === "pending").length),
        detail: "recent due queue",
        tone: "gold",
      },
      {
        label: "Scripts",
        value: formatCount(snapshot.counts.political_scripts ?? 0),
        detail: "message variation library",
        tone: "green",
      },
      {
        label: "Failed",
        value: formatCount(rows.filter((row) => row.status === "failed").length),
        detail: "recent delivery issues",
        tone: "red",
      },
    ],
    rows: rows.map((row) => ({
      id: row.id,
      title: `${row.channel} / ${row.trigger}`,
      subtitle: row.last_error || "No error recorded",
      status: row.status,
      href: `/admin/political/outreach?followup=${row.id}`,
      meta: [
        `scheduled ${compactDate(row.scheduled_for)}`,
        `${row.attempts} attempts`,
        compactDate(row.created_at),
      ],
    })),
  };
}

export async function loadPoliticalOverviewSection(): Promise<PoliticalSectionData> {
  const snapshot = await loadPoliticalCommandSnapshot();

  return {
    refreshedAt: snapshot.refreshedAt,
    errors: snapshot.errors,
    metrics: sectionBaseMetrics(snapshot),
    rows: [
      {
        id: "maps",
        title: "Map and Route Intelligence",
        subtitle: "Carrier route catalog, route selection, gaps, and reservations.",
        status: "operational",
        href: "/admin/political/maps",
        meta: [
          `${formatCount(snapshot.counts.political_routes ?? 0)} routes`,
          `${formatCount(snapshot.counts.political_reservations ?? 0)} reservations`,
          "coverage planner connected",
        ],
      },
      {
        id: "proposals",
        title: "Proposal and Approval Engine",
        subtitle: "Shareable links, client approval, contracts, and Stripe orders.",
        status: "operational",
        href: "/admin/political/proposals",
        meta: [
          `${formatCount(snapshot.counts.political_proposals ?? 0)} proposals`,
          `${formatCount(snapshot.counts.political_contracts ?? 0)} contracts`,
          `${formatCount(snapshot.counts.political_orders ?? 0)} orders`,
        ],
      },
      {
        id: "outreach",
        title: "Campaign Outreach Engine",
        subtitle: "Lead scoring, message variation, follow-up tasks, and action center.",
        status: "operational",
        href: "/admin/political/outreach",
        meta: [
          `${formatCount(snapshot.counts.campaign_candidates ?? 0)} candidates`,
          `${formatCount(snapshot.counts.political_follow_ups ?? 0)} follow-ups`,
          `${formatCount(snapshot.counts.political_scripts ?? 0)} scripts`,
        ],
      },
    ],
  };
}

export function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
