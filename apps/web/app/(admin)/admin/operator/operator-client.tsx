"use client";

import { useEffect, useState, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Operator Command Center Client
// 7 sections. Auto-refreshes every 30 seconds.
// All fulfillment state is labeled [INFERRED — MANUAL ACTION NEEDED].
// ─────────────────────────────────────────────────────────────────────────────

interface CommandItem  { type: string; label: string; severity: "red" | "amber" | "green"; count: number; action?: string; }
interface PipelineStage { status: string; count: number; leads: LeadRow[]; }
interface LeadRow      { id: string; business_name: string; city: string; category: string; status: string; last_reply_at?: string; last_contacted_at?: string; assigned_agent_id?: string; }
interface AgentStat    { agent_id: string; name: string; messages: number; replies: number; conversations: number; deals: number; revenue_cents: number; reply_rate: number; close_rate: number; flags: string[]; }
interface HealthCheck  { name: string; status: "green" | "yellow" | "red"; message?: string; }
interface FulfillRow   { id: string; status: string; created_at: string; activated_at?: string; businesses?: { name: string; email?: string }; cities?: { name: string }; categories?: { name: string }; intake_submissions?: Array<{ id: string; status: string; submitted_at?: string }>; }

interface OperatorData {
  timestamp:         string;
  command_center:    CommandItem[];
  funnel?:           { revenue_total_cents?: number };
  leaderboard?:      { leaderboard?: AgentStat[] };
  health?:           { status: string; checks: HealthCheck[] };
  at_risk?:          { at_risk?: Array<{ id: string; business_name: string; city: string; risk_type: string; risk_label: string; stale_since: string; days_stale: number }> };
  alerts_recent?:    { summary?: { sent: number; suppressed: number; failed: number } };
  hot_leads?:        LeadRow[];
  payment_sent_stale?: LeadRow[];
  fulfillment_items?: FulfillRow[];
  pipeline_stages?:  PipelineStage[];
  apex_last_run?:    { created_at: string; duration_ms: number; summary?: string } | null;
  priority_actions?: { actions?: Array<{ id: string; label: string; urgency: string }> };
}

function timeAgo(iso: string): string {
  const ms   = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  const hrs  = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

const SEV_CLASSES = {
  red:   "bg-red-900/40 border-red-500 text-red-300",
  amber: "bg-amber-900/40 border-amber-500 text-amber-300",
  green: "bg-emerald-900/40 border-emerald-500 text-emerald-300",
};

const STAGE_LABELS: Record<string, string> = {
  queued:       "New Leads",
  contacted:    "Contacted",
  replied:      "Replied",
  payment_sent: "Payment Sent",
  closed:       "Closed",
};

// ── Section: Command Center ───────────────────────────────────────────────────
function CommandCenter({ items }: { items: CommandItem[] }) {
  if (items.length === 0) {
    return (
      <div className="bg-emerald-900/20 border border-emerald-700 rounded-lg p-4 text-emerald-400 text-sm font-medium">
        ✅ All clear — no immediate actions required
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {items.map((item, i) => (
        <div key={i} className={`flex items-center justify-between border rounded-lg px-4 py-3 ${SEV_CLASSES[item.severity]}`}>
          <span className="text-sm font-semibold">{item.label}</span>
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-bold ${item.severity === "red" ? "text-red-400" : item.severity === "amber" ? "text-amber-400" : "text-emerald-400"}`}>
              {item.count}
            </span>
            {item.action && (
              <a href={item.action} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded transition-colors">
                View →
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section: Revenue Velocity ─────────────────────────────────────────────────
function RevenueVelocity({ funnel, leaderboard }: { funnel?: OperatorData["funnel"]; leaderboard?: OperatorData["leaderboard"] }) {
  const rev     = ((funnel?.revenue_total_cents ?? 0) / 100).toFixed(0);
  const agents  = leaderboard?.leaderboard ?? [];
  const deals   = agents.reduce((s, a) => s + a.deals, 0);
  const msgs    = agents.reduce((s, a) => s + a.messages, 0);
  const replies = agents.reduce((s, a) => s + a.replies, 0);

  return (
    <div className="grid grid-cols-4 gap-4">
      {[
        { label: "💰 Revenue Today",    value: `$${Number(rev).toLocaleString()}`, color: "text-emerald-400" },
        { label: "📨 Messages Sent",    value: msgs.toString(),                    color: "text-blue-400" },
        { label: "💬 Replies",          value: replies.toString(),                 color: "text-purple-400" },
        { label: "✅ Deals Closed",     value: deals.toString(),                   color: "text-yellow-400" },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-xs mb-1">{label}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Section: Closing Pipeline ─────────────────────────────────────────────────
function ClosingPipeline({ stages, hotLeads }: { stages?: PipelineStage[]; hotLeads?: LeadRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const hotIds = new Set((hotLeads ?? []).map(l => l.id));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-base font-semibold">🎯 Closing Pipeline</h2>
        <span className="text-xs text-gray-500">Click stage to expand leads</span>
      </div>
      <div className="grid grid-cols-5 divide-x divide-gray-800">
        {(stages ?? []).map(stage => (
          <button
            key={stage.status}
            onClick={() => setExpanded(expanded === stage.status ? null : stage.status)}
            className={`p-4 text-left transition-colors ${expanded === stage.status ? "bg-gray-800" : "hover:bg-gray-800/50"}`}
          >
            <p className="text-xs text-gray-400 mb-1">{STAGE_LABELS[stage.status] ?? stage.status}</p>
            <p className="text-2xl font-bold text-white">{stage.count}</p>
          </button>
        ))}
      </div>
      {expanded && (() => {
        const stage = (stages ?? []).find(s => s.status === expanded);
        if (!stage || stage.leads.length === 0) return (
          <div className="px-6 py-3 text-sm text-gray-500">No leads in this stage</div>
        );
        return (
          <div className="divide-y divide-gray-800">
            {stage.leads.map(lead => {
              const isHot  = hotIds.has(lead.id);
              const isAtRisk = lead.last_reply_at && hoursSince(lead.last_reply_at) > 24;
              return (
                <div key={lead.id} className="px-6 py-3 flex items-center gap-4 text-sm">
                  <div className="flex-1">
                    <span className="font-medium text-white">{lead.business_name}</span>
                    <span className="text-gray-400 ml-2">{lead.city} · {lead.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isHot     && <span className="bg-red-800 text-red-300 text-xs px-2 py-0.5 rounded-full font-medium">🔥 HOT</span>}
                    {isAtRisk  && <span className="bg-amber-800 text-amber-300 text-xs px-2 py-0.5 rounded-full font-medium">⚠️ AT-RISK</span>}
                    {lead.last_reply_at && <span className="text-gray-500 text-xs">{timeAgo(lead.last_reply_at)}</span>}
                    <a href={`/agent/leads/${lead.id}`} className="text-blue-400 hover:text-blue-300 text-xs">Open →</a>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ── Section: Fulfillment Command ──────────────────────────────────────────────
function FulfillmentCommand({ items }: { items?: FulfillRow[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-gray-500 text-sm">
        No active spots requiring fulfillment action.
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-base font-semibold">📦 Fulfillment Command</h2>
        <p className="text-xs text-amber-400 mt-0.5">
          ⚠️ INFERRED STATE — all rows require manual action. No automation triggered.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              {["Business", "City / Category", "Since Purchase", "Intake Status", "Action Needed"].map(h => (
                <th key={h} className="px-4 py-3 text-xs text-gray-400 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {items.map(row => {
              const hrsSince   = hoursSince(row.created_at);
              const intake     = Array.isArray(row.intake_submissions) ? row.intake_submissions[0] : null;
              const intakeStatus = intake?.status ?? "not_started";
              const rowColor   = hrsSince > 48 ? "bg-red-900/20" : hrsSince > 24 ? "bg-amber-900/10" : "";
              return (
                <tr key={row.id} className={`${rowColor} hover:bg-gray-800/30 transition-colors`}>
                  <td className="px-4 py-3 font-medium text-white">
                    {(row.businesses as { name: string } | undefined)?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {(row.cities as { name: string } | undefined)?.name ?? "—"} · {(row.categories as { name: string } | undefined)?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={hrsSince > 48 ? "text-red-400 font-semibold" : hrsSince > 24 ? "text-amber-400" : "text-gray-300"}>
                      {hrsSince < 1 ? "< 1h" : `${Math.floor(hrsSince)}h`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {intakeStatus === "submitted" ? (
                      <span className="text-emerald-400 font-medium">✅ Submitted</span>
                    ) : intakeStatus === "reviewed" ? (
                      <span className="text-blue-400 font-medium">✅ Reviewed</span>
                    ) : (
                      <span className="text-amber-400 font-medium">⏳ Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-orange-400 font-medium">MANUAL ACTION NEEDED</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Section: Sales Warboard ───────────────────────────────────────────────────
function SalesWarboard({ leaderboard }: { leaderboard?: OperatorData["leaderboard"] }) {
  const agents = leaderboard?.leaderboard ?? [];
  if (agents.length === 0) {
    return <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-gray-500 text-sm">No agent data yet today.</div>;
  }
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-base font-semibold">⚔️ Sales Warboard</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-left">
            {["Rank", "Agent", "Texts", "Emails", "Replies", "Deals", "Revenue", "Reply %"].map(h => (
              <th key={h} className="px-4 py-3 text-xs text-gray-400 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {[...agents].sort((a, b) => b.deals - a.deals || b.revenue_cents - a.revenue_cents).map((agent, idx) => (
            <tr key={agent.agent_id} className="hover:bg-gray-800/30 transition-colors">
              <td className="px-4 py-3 text-gray-400 font-bold">#{idx + 1}</td>
              <td className="px-4 py-3 font-medium text-white">{agent.name}</td>
              <td className="px-4 py-3 text-blue-300">{agent.messages}</td>
              <td className="px-4 py-3 text-purple-300">{agent.messages}</td>
              <td className="px-4 py-3 text-emerald-300">{agent.replies}</td>
              <td className="px-4 py-3 text-yellow-300 font-bold">{agent.deals}</td>
              <td className="px-4 py-3 text-emerald-400 font-semibold">${(agent.revenue_cents / 100).toLocaleString()}</td>
              <td className="px-4 py-3 text-gray-300">{(agent.reply_rate * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Section: System Intelligence ──────────────────────────────────────────────
function SystemIntelligence({
  health,
  apexLastRun,
  alertsRecent,
}: {
  health?:      OperatorData["health"];
  apexLastRun?: OperatorData["apex_last_run"];
  alertsRecent?: OperatorData["alerts_recent"];
}) {
  const overallStatus = health?.status ?? "unknown";
  const checks = health?.checks ?? [];

  const statusColor = overallStatus === "GREEN" ? "text-emerald-400" : overallStatus === "YELLOW" ? "text-amber-400" : "text-red-400";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-base font-semibold">🛡️ System Intelligence</h2>
        <span className={`text-sm font-bold ${statusColor}`}>{overallStatus}</span>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
        {/* Health checks */}
        <div>
          <p className="text-xs text-gray-400 font-semibold mb-2">SYSTEM CHECKS</p>
          <div className="space-y-1.5">
            {checks.map((c: HealthCheck) => (
              <div key={c.name} className="flex items-center gap-2 text-xs">
                <span>{c.status === "green" ? "✅" : c.status === "yellow" ? "⚠️" : "❌"}</span>
                <span className={c.status === "red" ? "text-red-400" : c.status === "yellow" ? "text-amber-400" : "text-gray-400"}>
                  {c.name.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Apex + Alert stats */}
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-400 font-semibold mb-1">LAST APEX RUN</p>
            {apexLastRun ? (
              <div className="text-xs text-gray-300">
                <p>{timeAgo(apexLastRun.created_at)}</p>
                <p className="text-gray-500">{apexLastRun.duration_ms ? `${(apexLastRun.duration_ms / 1000).toFixed(1)}s` : ""}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-600">No data</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold mb-1">INTERNAL ALERTS (24h)</p>
            {alertsRecent?.summary ? (
              <div className="text-xs space-y-0.5">
                <p className="text-emerald-400">✅ Sent: {alertsRecent.summary.sent}</p>
                <p className="text-gray-500">⏭️ Suppressed: {alertsRecent.summary.suppressed}</p>
                {alertsRecent.summary.failed > 0 && <p className="text-red-400">❌ Failed: {alertsRecent.summary.failed}</p>}
              </div>
            ) : (
              <p className="text-xs text-gray-600">No alert data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section: Next Action Engine ───────────────────────────────────────────────
function NextActionEngine({ priorityActions }: { priorityActions?: OperatorData["priority_actions"] }) {
  const actions = priorityActions?.actions ?? [];
  if (actions.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-gray-500 text-sm">
        No priority actions at this time.
      </div>
    );
  }
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-base font-semibold">⚡ Next Action Engine</h2>
      </div>
      <div className="divide-y divide-gray-800">
        {actions.slice(0, 10).map((action, i) => (
          <div key={i} className="px-6 py-3 flex items-center gap-4 text-sm">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${action.urgency === "critical" || action.urgency === "high" ? "bg-red-500" : action.urgency === "medium" ? "bg-amber-500" : "bg-gray-500"}`} />
            <span className="flex-1 text-gray-200">{action.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function OperatorClient({ initialData }: { initialData: OperatorData | null }) {
  const [data,      setData]      = useState<OperatorData | null>(initialData);
  const [loading,   setLoading]   = useState(!initialData);
  const [lastFetch, setLastFetch] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/operator/summary", { cache: "no-store" });
      if (res.ok) {
        setData(await res.json());
        setLastFetch(new Date());
      }
    } catch { /* silent — keep showing last data */ }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!initialData) fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData, initialData]);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">🎯 Operator Command Center</h1>
            <p className="text-gray-400 text-sm mt-1">Real-time control over the entire revenue engine</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Last updated</p>
            <p className="text-white font-mono text-sm">{lastFetch.toLocaleTimeString()}</p>
            {loading && <p className="text-xs text-amber-400 mt-0.5">Refreshing…</p>}
          </div>
        </div>

        {/* 1. Command Center */}
        <div>
          <h2 className="text-xs text-gray-500 font-semibold tracking-widest uppercase mb-3">Command Center</h2>
          <CommandCenter items={data?.command_center ?? []} />
        </div>

        {/* 2. Revenue Velocity */}
        <div>
          <h2 className="text-xs text-gray-500 font-semibold tracking-widest uppercase mb-3">Revenue Velocity</h2>
          <RevenueVelocity funnel={data?.funnel} leaderboard={data?.leaderboard} />
        </div>

        {/* 3. Closing Pipeline */}
        <div>
          <h2 className="text-xs text-gray-500 font-semibold tracking-widest uppercase mb-3">Closing Pipeline</h2>
          <ClosingPipeline stages={data?.pipeline_stages} hotLeads={data?.hot_leads} />
        </div>

        {/* 4. Fulfillment Command */}
        <div>
          <h2 className="text-xs text-gray-500 font-semibold tracking-widest uppercase mb-3">Fulfillment Command</h2>
          <FulfillmentCommand items={data?.fulfillment_items} />
        </div>

        {/* Two-column: Warboard + System Intelligence */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h2 className="text-xs text-gray-500 font-semibold tracking-widest uppercase mb-3">Sales Warboard</h2>
            <SalesWarboard leaderboard={data?.leaderboard} />
          </div>
          <div id="system">
            <h2 className="text-xs text-gray-500 font-semibold tracking-widest uppercase mb-3">System Intelligence</h2>
            <SystemIntelligence health={data?.health} apexLastRun={data?.apex_last_run} alertsRecent={data?.alerts_recent} />
          </div>
        </div>

        {/* 7. Next Action Engine */}
        <div>
          <h2 className="text-xs text-gray-500 font-semibold tracking-widest uppercase mb-3">Next Action Engine</h2>
          <NextActionEngine priorityActions={data?.priority_actions} />
        </div>

      </div>
    </div>
  );
}
