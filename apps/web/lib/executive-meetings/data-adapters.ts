import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type {
  ExecutiveAdapterStatus,
  ExecutiveDataAdapterSnapshot,
  ExecutiveSourceSnapshot,
} from "./types";

type Db = ReturnType<typeof createServiceClient>;
type CountConfig = (query: any) => any;

const DAY_MS = 24 * 60 * 60 * 1000;

export async function loadExecutiveSourceSnapshot(db: Db): Promise<ExecutiveSourceSnapshot> {
  const generatedAt = new Date();
  const since24h = new Date(generatedAt.getTime() - DAY_MS).toISOString();
  const todayKey = generatedAt.toISOString().slice(0, 10);

  const [
    leadsToday,
    followUpsDue,
    outreachApprovals,
    revenueMessages24h,
    pendingMiniApps,
    manualTakeovers,
    openAiTasks,
    aiActivity24h,
    paidOrders,
    websiteProjects,
    marketingCampaigns,
    targetedCampaigns,
    politicalCampaigns,
    failedAuditEvents,
    estimatedMiniApps,
  ] = await Promise.all([
    countAdapter(db, {
      key: "leads_today",
      label: "Leads today",
      table: "sales_leads",
      href: "/admin/crm",
      detail: "New sales leads created in the last 24 hours.",
      configure: (query) => query.gte("created_at", since24h),
    }),
    countAdapter(db, {
      key: "followups_due",
      label: "Follow-ups due",
      table: "sales_leads",
      href: "/admin/revenue-operations",
      detail: "Revenue pipeline items with due follow-up work.",
      configure: (query) => query.lte("next_action_due_at", generatedAt.toISOString()),
    }),
    countAdapter(db, {
      key: "outreach_approvals",
      label: "Outreach approvals",
      table: "revenue_message_approval_queue",
      href: "/admin/content-review",
      detail: "Revenue messages waiting on human review.",
      configure: (query) => query.in("status", ["pending", "needs_review", "queued", "draft"]),
    }),
    countAdapter(db, {
      key: "revenue_messages_24h",
      label: "Message events 24h",
      table: "revenue_message_events",
      href: "/admin/inbox",
      detail: "Inbound or outbound revenue-message events in the last 24 hours.",
      configure: (query) => query.gte("created_at", since24h),
    }),
    countAdapter(db, {
      key: "mini_app_approvals",
      label: "Mini apps pending",
      table: "agent_mini_apps",
      href: "/admin/agent-mini-apps",
      detail: "Agent mini apps waiting for review or edits.",
      configure: (query) => query.in("status", ["generated", "needs_review", "edited"]),
    }),
    countAdapter(db, {
      key: "manual_takeovers",
      label: "Manual takeovers",
      table: "agent_execution_queue",
      href: "/admin/agent-execution",
      detail: "Execution queue items where a human must step in.",
      configure: (query) => query.eq("manual_takeover_required", true).neq("status", "cancelled"),
    }),
    countAdapter(db, {
      key: "open_ai_tasks",
      label: "Open AI workforce tasks",
      table: "ai_workforce_tasks",
      href: "/admin/agents",
      detail: "Central AI workforce manifest rows still open or awaiting approval.",
      configure: (query) => query.not("status", "in", "(completed,rejected,cancelled)"),
    }),
    countAdapter(db, {
      key: "ai_activity_24h",
      label: "AI activity 24h",
      table: "ai_workforce_activity_logs",
      href: "/admin/agents",
      detail: "AI workforce activity ledger rows in the last 24 hours.",
      configure: (query) => query.gte("created_at", since24h),
    }),
    countAdapter(db, {
      key: "paid_orders",
      label: "Paid orders",
      table: "orders",
      href: "/admin/orders",
      detail: "Paid order records visible to the executive layer.",
      configure: (query) => query.eq("status", "paid"),
    }),
    countAdapter(db, {
      key: "website_projects",
      label: "Website projects",
      table: "website_projects",
      href: "/admin/websites",
      detail: "Website project records for client build/accountability review.",
    }),
    countAdapter(db, {
      key: "marketing_campaigns",
      label: "Shared campaigns",
      table: "marketing_campaigns",
      href: "/admin/campaigns",
      detail: "Shared postcard campaign records.",
    }),
    countAdapter(db, {
      key: "targeted_campaigns",
      label: "Targeted campaigns",
      table: "targeted_route_campaigns",
      href: "/admin/targeted-campaigns",
      detail: "Targeted route campaign records.",
    }),
    countAdapter(db, {
      key: "political_campaigns",
      label: "Political campaigns",
      table: "political_campaigns",
      href: "/admin/political",
      detail: "Political campaign records visible to the executive layer.",
    }),
    countAdapter(db, {
      key: "risk_events",
      label: "Risk/audit events",
      table: "platform_audit_events",
      href: "/admin/control-center",
      detail: "High-risk, failed, or warning audit events from the last 24 hours.",
      configure: (query) =>
        query.gte("occurred_at", since24h).in("result_status", ["failure", "blocked", "warning"]),
    }),
    moneyAdapter(db, todayKey),
  ]);

  const adapters = [
    leadsToday,
    followUpsDue,
    outreachApprovals,
    revenueMessages24h,
    pendingMiniApps,
    manualTakeovers,
    openAiTasks,
    aiActivity24h,
    paidOrders,
    websiteProjects,
    marketingCampaigns,
    targetedCampaigns,
    politicalCampaigns,
    failedAuditEvents,
  ];

  const warnings = adapters
    .filter((adapter) => adapter.warning)
    .map((adapter) => `${adapter.label}: ${adapter.warning}`);
  if (estimatedMiniApps.warning) warnings.push(`Mini app money impact: ${estimatedMiniApps.warning}`);

  return {
    generatedAt: generatedAt.toISOString(),
    timezone: "America/New_York",
    adapters,
    totals: {
      leadsToday: leadsToday.value,
      followUpsDue: followUpsDue.value,
      outreachApprovals: outreachApprovals.value,
      revenueMessages24h: revenueMessages24h.value,
      pendingMiniAppApprovals: pendingMiniApps.value,
      manualTakeovers: manualTakeovers.value,
      openAiTasks: openAiTasks.value,
      aiActivity24h: aiActivity24h.value,
      ordersPaid: paidOrders.value,
      websiteProjects: websiteProjects.value,
      activeCampaigns: marketingCampaigns.value + targetedCampaigns.value + politicalCampaigns.value,
      failedOrRiskEvents: failedAuditEvents.value,
      estimatedRevenueAwaitingApproval: estimatedMiniApps.estimatedRevenue,
      estimatedSavingsAwaitingApproval: estimatedMiniApps.estimatedSavings,
    },
    warnings,
  };
}

async function countAdapter(
  db: Db,
  input: {
    key: string;
    label: string;
    table: string;
    detail: string;
    href?: string;
    configure?: CountConfig;
  },
): Promise<ExecutiveDataAdapterSnapshot> {
  try {
    let query = db.from(input.table).select("id", { count: "exact", head: true });
    if (input.configure) query = input.configure(query);
    const result = await query;
    if (result.error) {
      return adapter(input, 0, statusFromError(result.error), result.error.message);
    }
    return adapter(input, result.count ?? 0, (result.count ?? 0) > 0 ? "online" : "empty", null);
  } catch (error) {
    return adapter(input, 0, "warning", error instanceof Error ? error.message : "Adapter query failed.");
  }
}

async function moneyAdapter(db: Db, todayKey: string) {
  try {
    const { data, error } = await db
      .from("agent_mini_apps")
      .select("estimated_revenue, estimated_savings")
      .in("status", ["generated", "needs_review", "edited", "approved"])
      .gte("updated_at", `${todayKey}T00:00:00.000Z`)
      .limit(500);

    if (error) {
      return { estimatedRevenue: 0, estimatedSavings: 0, warning: error.message };
    }

    return (data ?? []).reduce(
      (acc, row) => ({
        estimatedRevenue: acc.estimatedRevenue + numberValue((row as Record<string, unknown>).estimated_revenue),
        estimatedSavings: acc.estimatedSavings + numberValue((row as Record<string, unknown>).estimated_savings),
        warning: acc.warning,
      }),
      { estimatedRevenue: 0, estimatedSavings: 0, warning: null as string | null },
    );
  } catch (error) {
    return {
      estimatedRevenue: 0,
      estimatedSavings: 0,
      warning: error instanceof Error ? error.message : "Mini app money adapter failed.",
    };
  }
}

function adapter(
  input: { key: string; label: string; table: string; detail: string; href?: string },
  value: number,
  status: ExecutiveAdapterStatus,
  warning: string | null,
): ExecutiveDataAdapterSnapshot {
  return {
    key: input.key,
    label: input.label,
    table: input.table,
    value,
    status,
    detail: input.detail,
    href: input.href,
    warning,
  };
}

function statusFromError(error: { code?: string; message?: string }): ExecutiveAdapterStatus {
  if (error.code === "42P01" || error.message?.toLowerCase().includes("does not exist")) return "missing";
  return "warning";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
