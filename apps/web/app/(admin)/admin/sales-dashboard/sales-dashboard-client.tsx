"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type FunnelStages = {
  leads_viewed: number; leads_skipped: number; messages_sent: number;
  replies: number; conversations: number; follow_ups: number;
  payment_links: number; deals_closed: number;
};
type FunnelRates = {
  reply_rate: string; conversation_rate: string; close_rate: string;
  revenue_per_lead: string; revenue_per_msg: string;
};
type ChannelStats = Record<string, { sent: number; replies: number; deals: number; revenue: number }>;
type CityStats    = Record<string, { sent: number; deals: number; revenue: number }>;
type CatStats     = Record<string, { sent: number; deals: number; revenue: number }>;

type FunnelData = {
  stages: FunnelStages;
  rates: FunnelRates;
  revenue_total_cents: number;
  by_channel: ChannelStats;
  by_city: CityStats;
  by_category: CatStats;
};

type LeaderboardEntry = {
  agent_id: string;
  name: string;
  messages: number;
  replies: number;
  conversations: number;
  deals: number;
  revenue_cents: number;
  reply_rate: number;
  close_rate: number;
  flags: string[];
  leads_viewed: number;
  payment_links: number;
};

type Insight = string;
type Guidance = { type: string; message: string; priority: "high" | "medium" | "low" };

type AgentDetail = {
  agent_id: string; name: string; messages: number; replies: number;
  conversations: number; deals: number; revenue_cents: number;
  reply_rate: number; close_rate: number;
};

type TimeRange = "today" | "week" | "month";

// ─── Dashboard ─────────────────────────────────────────────────────────────────
export default function SalesDashboardClient() {
  const [funnel, setFunnel]         = useState<FunnelData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [insights, setInsights]     = useState<Insight[]>([]);
  const [guidance, setGuidance]     = useState<Guidance[]>([]);
  const [loading, setLoading]       = useState(true);
  const [timeRange, setTimeRange]   = useState<TimeRange>("today");
  const [activeAgent, setActiveAgent] = useState<AgentDetail | null>(null);
  const [sortBy, setSortBy] = useState<"deals" | "revenue" | "reply_rate" | "messages">("deals");

  const sinceMap: Record<TimeRange, string> = {
    today: new Date(Date.now() - 86400000).toISOString(),
    week:  new Date(Date.now() - 86400000 * 7).toISOString(),
    month: new Date(Date.now() - 86400000 * 30).toISOString(),
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const since = sinceMap[timeRange];
    const [fRes, lRes, iRes] = await Promise.all([
      fetch(`/api/admin/sales/funnel?since=${since}`),
      fetch(`/api/admin/sales/leaderboard?since=${since}`),
      fetch(`/api/admin/sales/insights?since=${since}`),
    ]);
    const [fData, lData, iData] = await Promise.all([fRes.json(), lRes.json(), iRes.json()]);
    setFunnel(fData.funnel ?? null);
    setLeaderboard(lData.leaderboard ?? []);
    setInsights(iData.insights ?? []);
    setGuidance(iData.guidance ?? []);
    setLoading(false);
  }, [timeRange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const i = setInterval(fetchAll, 30000); return () => clearInterval(i); }, [fetchAll]);

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    if (sortBy === "deals")      return b.deals - a.deals;
    if (sortBy === "revenue")    return b.revenue_cents - a.revenue_cents;
    if (sortBy === "reply_rate") return b.reply_rate - a.reply_rate;
    return b.messages - a.messages;
  });

  if (loading && !funnel) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400 text-sm animate-pulse">Loading intelligence data...</div>;
  }

  const stages = funnel?.stages;
  const rates  = funnel?.rates;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Intelligence</h1>
          <p className="text-gray-400 text-sm mt-0.5">Live tracking across all agents</p>
        </div>
        <div className="flex items-center gap-2">
          {(["today", "week", "month"] as TimeRange[]).map(t => (
            <button key={t} onClick={() => setTimeRange(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${timeRange === t ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <button onClick={fetchAll} className="ml-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium">↻ Refresh</button>
        </div>
      </div>

      {/* Urgent guidance */}
      {guidance.filter(g => g.priority === "high").length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-2">
          {guidance.filter(g => g.priority === "high").map((g, i) => (
            <div key={i} className="bg-red-900/30 border border-red-700/40 text-red-300 text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium">
              ⚡ {g.message}
            </div>
          ))}
        </div>
      )}

      {/* Revenue bar */}
      <div className="bg-gradient-to-r from-emerald-900/40 to-blue-900/20 border border-emerald-800/40 rounded-2xl px-6 py-4 mb-6 flex items-center justify-between">
        <div>
          <div className="text-3xl font-bold text-white">${((funnel?.revenue_total_cents ?? 0) / 100).toFixed(0)}</div>
          <div className="text-emerald-400 text-sm mt-0.5">Total Revenue</div>
        </div>
        <div className="grid grid-cols-4 gap-6">
          <BigStat label="Messages" value={stages?.messages_sent ?? 0} color="text-blue-400" />
          <BigStat label="Replies"  value={stages?.replies ?? 0}       color="text-yellow-400" />
          <BigStat label="Deals"    value={stages?.deals_closed ?? 0}  color="text-green-400" />
          <BigStat label="Reply Rate" value={rates?.reply_rate ?? "0%"} color="text-purple-400" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Funnel */}
        <div className="col-span-1 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-bold text-white text-sm mb-4">Conversion Funnel</h2>
          {stages && (
            <div className="space-y-2">
              {[
                { label: "Leads Viewed",    val: stages.leads_viewed,    color: "bg-gray-600" },
                { label: "Messages Sent",   val: stages.messages_sent,   color: "bg-blue-600" },
                { label: "Replies",         val: stages.replies,         color: "bg-yellow-600" },
                { label: "Conversations",   val: stages.conversations,   color: "bg-orange-600" },
                { label: "Payment Links",   val: stages.payment_links,   color: "bg-purple-600" },
                { label: "Deals Closed",    val: stages.deals_closed,    color: "bg-green-600" },
              ].map(({ label, val, color }) => {
                const pct = stages.leads_viewed > 0 ? (val / stages.leads_viewed * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{label}</span><span className="font-bold text-white">{val}</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.max(pct, 1)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {rates && (
            <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-2 text-xs">
              <RateCell label="Reply Rate"   val={rates.reply_rate} />
              <RateCell label="Close Rate"   val={rates.close_rate} />
              <RateCell label="Rev/Lead"     val={rates.revenue_per_lead} />
              <RateCell label="Rev/Message"  val={rates.revenue_per_msg} />
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white text-sm">Agent Leaderboard</h2>
            <div className="flex gap-1">
              {(["deals","revenue","reply_rate","messages"] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`text-xs px-2 py-1 rounded-lg transition-all ${sortBy === s ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>
                  {s === "reply_rate" ? "Reply%" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {sortedLeaderboard.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-10">No activity yet in this time range</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left py-2 px-2">Rank</th>
                    <th className="text-left py-2 px-2">Agent</th>
                    <th className="text-right py-2 px-2">Deals</th>
                    <th className="text-right py-2 px-2">Revenue</th>
                    <th className="text-right py-2 px-2">Msgs</th>
                    <th className="text-right py-2 px-2">Reply%</th>
                    <th className="text-right py-2 px-2">Close%</th>
                    <th className="text-left py-2 px-2">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLeaderboard.map((agent, i) => (
                    <tr
                      key={agent.agent_id}
                      onClick={() => setActiveAgent(activeAgent?.agent_id === agent.agent_id ? null : agent)}
                      className={`border-b border-gray-800/50 cursor-pointer transition-all ${
                        activeAgent?.agent_id === agent.agent_id ? "bg-blue-900/20" : "hover:bg-gray-800/40"
                      }`}
                    >
                      <td className="py-2.5 px-2">
                        <span className={`font-bold ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-400" : "text-gray-600"}`}>
                          #{i + 1}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="font-semibold text-white text-sm">{agent.name}</div>
                        {agent.flags.includes("top_closer") && <span className="text-yellow-400 text-xs">🏆 Top Closer</span>}
                        {agent.flags.includes("best_converter") && <span className="text-blue-400 text-xs">🎯 Best Conv.</span>}
                        {agent.flags.includes("most_active") && <span className="text-purple-400 text-xs">⚡ Most Active</span>}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-green-400">{agent.deals}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-emerald-400">${(agent.revenue_cents/100).toFixed(0)}</td>
                      <td className="py-2.5 px-2 text-right text-blue-300">{agent.messages}</td>
                      <td className="py-2.5 px-2 text-right text-yellow-300">{agent.reply_rate}%</td>
                      <td className="py-2.5 px-2 text-right text-purple-300">{agent.close_rate}%</td>
                      <td className="py-2.5 px-2">
                        <div className="flex flex-wrap gap-1">
                          {agent.flags.includes("high_activity_low_conversion") && <Flag label="Low Conv." color="red" />}
                          {agent.flags.includes("low_activity") && <Flag label="Low Activity" color="yellow" />}
                          {agent.flags.includes("replies_not_followed_up") && <Flag label="Missed FU" color="orange" />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Agent detail panel */}
          {activeAgent && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-white text-sm">Detail: {activeAgent.name}</div>
                <button onClick={() => setActiveAgent(null)} className="text-gray-500 text-xs hover:text-gray-300">✕ Close</button>
              </div>
              <div className="grid grid-cols-5 gap-3 text-center">
                {[
                  { label: "Messages",    val: activeAgent.messages },
                  { label: "Replies",     val: activeAgent.replies },
                  { label: "Convos",      val: activeAgent.conversations },
                  { label: "Deals",       val: activeAgent.deals },
                  { label: "Revenue",     val: `$${(activeAgent.revenue_cents/100).toFixed(0)}` },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-gray-800 rounded-xl p-3">
                    <div className="font-bold text-white">{val}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: Channel + City + Category + Insights */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        {/* By channel */}
        <BreakdownCard
          title="By Channel"
          data={funnel?.by_channel ?? {}}
          labelKey="ch"
          icons={{ sms: "📱", email: "📧", facebook: "💬", call: "📞" }}
        />

        {/* By city */}
        <BreakdownCard title="By City" data={funnel?.by_city ?? {}} labelKey="city" />

        {/* By category */}
        <BreakdownCard title="By Category" data={funnel?.by_category ?? {}} labelKey="cat" />

        {/* Insights */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-bold text-white text-sm mb-3">💡 Insights</h2>
          {insights.length === 0 ? (
            <div className="text-gray-500 text-xs text-center py-6">No data yet — start executing!</div>
          ) : (
            <div className="space-y-2">
              {insights.map((insight, i) => (
                <div key={i} className="bg-gray-800/60 rounded-xl px-3 py-2 text-xs text-gray-300 leading-relaxed border border-gray-700/50">
                  {insight}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function BigStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-gray-500 text-xs mt-0.5">{label}</div>
    </div>
  );
}

function RateCell({ label, val }: { label: string; val: string }) {
  return (
    <div className="bg-gray-800/60 rounded-lg px-2 py-1.5 text-center">
      <div className="font-bold text-white text-sm">{val}</div>
      <div className="text-gray-500 text-xs">{label}</div>
    </div>
  );
}

function Flag({ label, color }: { label: string; color: "red" | "yellow" | "orange" }) {
  const c = { red: "bg-red-900/40 text-red-400", yellow: "bg-yellow-900/40 text-yellow-400", orange: "bg-orange-900/40 text-orange-400" };
  return <span className={`${c[color]} text-xs px-1.5 py-0.5 rounded-full`}>{label}</span>;
}

function BreakdownCard({
  title, data, labelKey, icons,
}: {
  title: string;
  data: Record<string, { sent: number; replies?: number; deals: number; revenue: number }>;
  labelKey: string;
  icons?: Record<string, string>;
}) {
  const sorted = Object.entries(data)
    .sort((a, b) => b[1].deals - a[1].deals || b[1].sent - a[1].sent)
    .slice(0, 8);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h2 className="font-bold text-white text-sm mb-3">{title}</h2>
      {sorted.length === 0 ? (
        <div className="text-gray-500 text-xs text-center py-4">No data yet</div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map(([key, stats]) => (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="text-gray-300 truncate flex-1">
                {icons?.[key] ? icons[key] + " " : ""}{key}
              </span>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <span className="text-blue-400">{stats.sent}s</span>
                {stats.replies !== undefined && <span className="text-yellow-400">{stats.replies}r</span>}
                <span className="text-green-400 font-bold">{stats.deals}d</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
