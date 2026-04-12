"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Lead = {
  id: string; business_name: string; contact_name: string | null;
  email: string | null; phone: string | null; city: string | null;
  category: string | null; score: number; pipeline_stage: string;
  status: string; priority: string; buying_signal: boolean;
  is_duplicate: boolean; unreachable: boolean; fb_never_sent: boolean;
  do_not_contact: boolean; total_messages_sent: number; total_replies: number;
  last_contacted_at: string | null; assigned_agent_id: string | null;
  profiles?: { full_name: string } | null;
};

type Agent = {
  agent_id: string; messages_sent: number; replies: number; deals_closed: number;
  revenue_cents: number; reply_rate: number; close_rate: number;
  rank_overall: number; tier_name: string; commission_cents: number;
  profiles?: { full_name: string; email: string } | null;
  flags?: { high_activity_low_conversion: boolean; has_unfollowed_replies: boolean };
};

type Company = {
  id: string; name: string; mrr_cents: number; status: string;
  contact_name: string | null; email: string | null;
};

type AutoEnrollment = {
  id: string; sequence_id: string; lead_id: string; status: string;
  current_step: number; next_send_at: string | null;
  sales_leads?: { business_name: string; city: string | null } | null;
  auto_sequences?: { name: string; channel: string } | null;
};

type View = "overview" | "leads" | "agents" | "pipeline" | "automation" | "revenue";

const STAGE_COLORS: Record<string, string> = {
  new:          "bg-gray-700/50 text-gray-300",
  contacted:    "bg-blue-900/40 text-blue-300",
  replied:      "bg-yellow-900/40 text-yellow-300",
  interested:   "bg-orange-900/40 text-orange-300",
  negotiating:  "bg-purple-900/40 text-purple-300",
  payment_sent: "bg-indigo-900/40 text-indigo-300",
  closed_won:   "bg-green-900/40 text-green-400",
  closed_lost:  "bg-red-900/30 text-red-400",
  suppressed:   "bg-gray-800 text-gray-500",
};

const fmt$ = (cents: number) => `$${(cents / 100).toFixed(0)}`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export default function ControlCenterClient() {
  const [view, setView] = useState<View>("overview");

  // Leads
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadTotal, setLeadTotal] = useState(0);
  const [leadPage, setLeadPage] = useState(0);
  const [stageFilter, setStageFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showDnc, setShowDnc] = useState(false);

  // Agents
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentPeriod, setAgentPeriod] = useState<"today" | "week" | "month">("week");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // Companies / Revenue
  const [companies, setCompanies] = useState<Company[]>([]);
  const [totalMRR, setTotalMRR] = useState(0);

  // Automation
  const [sequences, setSequences] = useState<{ id: string; name: string; channel: string; status: string; step_count: number; enrollment_counts: Record<string, number> }[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [enrollments, setEnrollments] = useState<AutoEnrollment[]>([]);

  // Overview stats
  const [overviewStats, setOverviewStats] = useState({
    total_leads: 0, active_leads: 0, replies_today: 0,
    deals_this_week: 0, mrr_cents: 0, sequences_active: 0,
    messages_today: 0, pipeline_health: 0,
  });

  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // ── Data fetchers ────────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (stageFilter) params.set("stage", stageFilter);
    if (cityFilter)  params.set("city",  cityFilter);
    if (agentFilter) params.set("agent", agentFilter);
    if (search)      params.set("q",     search);
    if (showDnc)     params.set("dnc",   "true");
    params.set("page",  String(leadPage));
    params.set("limit", "50");

    const res = await fetch(`/api/admin/crm/leads?${params}`);
    const data = await res.json();
    setLeads(data.leads ?? []);
    setLeadTotal(data.total ?? 0);
    setLoading(false);
  }, [stageFilter, cityFilter, agentFilter, search, showDnc, leadPage]);

  const fetchAgents = useCallback(async () => {
    const res = await fetch(`/api/admin/crm/leaderboard?period=${agentPeriod}`);
    const data = await res.json();
    setAgents(data.rows ?? []);
  }, [agentPeriod]);

  const fetchCompanies = useCallback(async () => {
    const res = await fetch("/api/admin/crm/companies");
    const data = await res.json();
    setCompanies(data.companies ?? []);
    setTotalMRR(data.total_mrr_cents ?? 0);
  }, []);

  const fetchAutomation = useCallback(async () => {
    const [seqRes, dueRes] = await Promise.all([
      fetch("/api/admin/automation/sequences"),
      fetch("/api/admin/automation/send-due"),
    ]);
    const seqData = await seqRes.json();
    const dueData = await dueRes.json();
    setSequences(seqData.sequences ?? []);
    setDueCount(dueData.due_now ?? 0);
  }, []);

  const fetchOverview = useCallback(async () => {
    const [leadsRes, agentsRes, companiesRes, dueRes] = await Promise.all([
      fetch("/api/admin/crm/leads?limit=1"),
      fetch("/api/admin/crm/leaderboard?period=today"),
      fetch("/api/admin/crm/companies"),
      fetch("/api/admin/automation/send-due"),
    ]);
    const [ld, ag, co, du] = await Promise.all([
      leadsRes.json(), agentsRes.json(), companiesRes.json(), dueRes.json(),
    ]);

    const totalMsgs = (ag.rows ?? []).reduce((s: number, r: Agent) => s + r.messages_sent, 0);
    const totalDeals = (ag.rows ?? []).reduce((s: number, r: Agent) => s + r.deals_closed, 0);
    const totalReplies = (ag.rows ?? []).reduce((s: number, r: Agent) => s + r.replies, 0);

    setOverviewStats({
      total_leads:    ld.total ?? 0,
      active_leads:   ld.active ?? 0,
      replies_today:  totalReplies,
      deals_this_week: totalDeals,
      mrr_cents:       co.total_mrr_cents ?? 0,
      sequences_active: 0,
      messages_today:  totalMsgs,
      pipeline_health: 0,
    });
  }, []);

  useEffect(() => {
    if (view === "overview")    fetchOverview();
    if (view === "leads")       fetchLeads();
    if (view === "agents")      fetchAgents();
    if (view === "revenue")     fetchCompanies();
    if (view === "automation")  fetchAutomation();
  }, [view, fetchOverview, fetchLeads, fetchAgents, fetchCompanies, fetchAutomation]);

  useEffect(() => { if (view === "leads") fetchLeads(); }, [stageFilter, cityFilter, agentFilter, search, leadPage, view, fetchLeads]);
  useEffect(() => { if (view === "agents") fetchAgents(); }, [agentPeriod, view, fetchAgents]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const reassignLead = async (leadId: string, agentId: string) => {
    await fetch("/api/admin/crm/lead", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId, assigned_agent_id: agentId }),
    });
    flash("Lead reassigned");
    fetchLeads();
  };

  const updateStage = async (leadId: string, stage: string) => {
    await fetch("/api/admin/crm/lead", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId, pipeline_stage: stage }),
    });
    flash("Stage updated");
    fetchLeads();
  };

  const markDnc = async (leadId: string) => {
    await fetch("/api/admin/crm/lead", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId, do_not_contact: true }),
    });
    flash("Marked Do Not Contact");
    fetchLeads();
  };

  const triggerSendDue = async () => {
    const res = await fetch("/api/admin/automation/send-due", { method: "POST" });
    const data = await res.json();
    flash(`Sent ${data.sent ?? 0} messages, ${data.skipped ?? 0} skipped`);
    fetchAutomation();
  };

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 3000);
  };

  // ── Render helpers ───────────────────────────────────────────────────────────
  const STAGES = ["new","contacted","replied","interested","negotiating","payment_sent","closed_won","closed_lost","suppressed"];

  const NavBtn = ({ v, label }: { v: View; label: string }) => (
    <button
      onClick={() => setView(v)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        view === v ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Admin Control Center</h1>
            <p className="text-xs text-gray-500 mt-0.5">Full platform visibility & intervention</p>
          </div>
          {actionMsg && (
            <div className="bg-green-900/50 border border-green-700 text-green-300 text-sm px-4 py-2 rounded-lg">
              ✓ {actionMsg}
            </div>
          )}
        </div>
        <div className="flex gap-1 mt-4">
          <NavBtn v="overview"   label="📊 Overview" />
          <NavBtn v="leads"      label="🎯 All Leads" />
          <NavBtn v="agents"     label="👥 Agents" />
          <NavBtn v="pipeline"   label="🗂️ Pipeline" />
          <NavBtn v="automation" label="🤖 Automation" />
          <NavBtn v="revenue"    label="💰 Revenue" />
        </div>
      </div>

      <div className="p-6">
        {/* ── Overview ── */}
        {view === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Leads",     value: overviewStats.total_leads.toLocaleString(), color: "text-blue-400" },
                { label: "Messages Today",  value: overviewStats.messages_today.toLocaleString(), color: "text-yellow-400" },
                { label: "Replies Today",   value: overviewStats.replies_today.toLocaleString(), color: "text-green-400" },
                { label: "Deals This Week", value: overviewStats.deals_this_week.toLocaleString(), color: "text-purple-400" },
              ].map(s => (
                <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold text-gray-200 mb-3">Monthly Recurring Revenue</h3>
                <p className="text-4xl font-bold text-green-400">{fmt$(overviewStats.mrr_cents)}</p>
                <p className="text-xs text-gray-500 mt-1">Active contracts</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold text-gray-200 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button onClick={() => setView("leads")} className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300">
                    → View all leads
                  </button>
                  <button onClick={() => setView("automation")} className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300">
                    → Manage sequences ({dueCount} due now)
                  </button>
                  <button onClick={() => setView("agents")} className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300">
                    → Agent leaderboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Leads ── */}
        {view === "leads" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <input
                type="text" placeholder="Search name, city, category..."
                value={search} onChange={e => { setSearch(e.target.value); setLeadPage(0); }}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 w-64"
              />
              <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
                <option value="">All Stages</option>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="text" placeholder="City filter"
                value={cityFilter} onChange={e => setCityFilter(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 w-40"
              />
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input type="checkbox" checked={showDnc} onChange={e => setShowDnc(e.target.checked)}
                  className="rounded bg-gray-800 border-gray-600" />
                Show DNC
              </label>
              <span className="ml-auto text-xs text-gray-500 self-center">
                {leadTotal.toLocaleString()} total leads
              </span>
            </div>

            {/* Lead table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                    <th className="px-4 py-3 text-left">Business</th>
                    <th className="px-4 py-3 text-left">City</th>
                    <th className="px-4 py-3 text-left">Stage</th>
                    <th className="px-4 py-3 text-center">Score</th>
                    <th className="px-4 py-3 text-center">Msgs</th>
                    <th className="px-4 py-3 text-center">Replies</th>
                    <th className="px-4 py-3 text-left">Agent</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
                  ) : leads.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No leads found</td></tr>
                  ) : leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {lead.buying_signal && <span className="text-xs bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded font-bold">HOT</span>}
                          {lead.do_not_contact && <span className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">DNC</span>}
                          <span className="text-white font-medium truncate max-w-[200px]">{lead.business_name}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{lead.category}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{lead.city ?? "—"}</td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.pipeline_stage}
                          onChange={e => updateStage(lead.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded border-0 cursor-pointer font-medium ${STAGE_COLORS[lead.pipeline_stage] ?? "bg-gray-700 text-gray-300"}`}
                        >
                          {STAGES.map(s => <option key={s} value={s} className="bg-gray-800 text-white">{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${lead.score >= 80 ? "text-green-400" : lead.score >= 60 ? "text-yellow-400" : "text-gray-400"}`}>
                          {lead.score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400">{lead.total_messages_sent}</td>
                      <td className="px-4 py-3 text-center text-gray-400">{lead.total_replies}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {(lead.profiles as { full_name?: string } | null)?.full_name ?? "Unassigned"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!lead.do_not_contact && (
                          <button
                            onClick={() => markDnc(lead.id)}
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/20 transition-colors"
                          >
                            DNC
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Pagination */}
              {leadTotal > 50 && (
                <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
                  <button onClick={() => setLeadPage(p => Math.max(0, p - 1))} disabled={leadPage === 0}
                    className="text-xs text-gray-400 hover:text-white disabled:opacity-30">← Prev</button>
                  <span className="text-xs text-gray-500">
                    Page {leadPage + 1} of {Math.ceil(leadTotal / 50)}
                  </span>
                  <button onClick={() => setLeadPage(p => p + 1)} disabled={(leadPage + 1) * 50 >= leadTotal}
                    className="text-xs text-gray-400 hover:text-white disabled:opacity-30">Next →</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Agents ── */}
        {view === "agents" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["today","week","month"] as const).map(p => (
                <button key={p} onClick={() => setAgentPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${agentPeriod === p ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                  {p}
                </button>
              ))}
            </div>

            <div className="grid gap-3">
              {agents.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
                  No agent data for this period
                </div>
              ) : agents.map(agent => (
                <div
                  key={agent.agent_id}
                  className={`bg-gray-900 border rounded-xl p-4 cursor-pointer transition-colors ${
                    selectedAgent?.agent_id === agent.agent_id ? "border-blue-500" : "border-gray-800 hover:border-gray-700"
                  }`}
                  onClick={() => setSelectedAgent(selectedAgent?.agent_id === agent.agent_id ? null : agent)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        agent.rank_overall === 1 ? "bg-yellow-600/30 text-yellow-400" :
                        agent.rank_overall === 2 ? "bg-gray-600/30 text-gray-300" :
                        agent.rank_overall === 3 ? "bg-orange-900/30 text-orange-400" : "bg-gray-800 text-gray-400"
                      }`}>
                        #{agent.rank_overall}
                      </div>
                      <div>
                        <p className="font-semibold text-white">
                          {(agent.profiles as { full_name?: string } | null)?.full_name ?? "Agent"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(agent.profiles as { email?: string } | null)?.email ?? ""}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                        agent.tier_name === "Elite"     ? "bg-yellow-900/50 text-yellow-400" :
                        agent.tier_name === "Closer"    ? "bg-purple-900/50 text-purple-400" :
                        agent.tier_name === "Performer" ? "bg-blue-900/50 text-blue-400" :
                        "bg-gray-800 text-gray-500"
                      }`}>
                        {agent.tier_name}
                      </span>
                      {agent.flags?.high_activity_low_conversion && (
                        <span className="text-xs bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded">⚠ Low Conv</span>
                      )}
                      {agent.flags?.has_unfollowed_replies && (
                        <span className="text-xs bg-orange-900/40 text-orange-400 px-1.5 py-0.5 rounded">💬 Replies</span>
                      )}
                    </div>
                    <div className="flex gap-6 text-right">
                      <div><p className="text-lg font-bold text-white">{agent.messages_sent}</p><p className="text-xs text-gray-500">Msgs</p></div>
                      <div><p className="text-lg font-bold text-yellow-400">{agent.replies}</p><p className="text-xs text-gray-500">Replies</p></div>
                      <div><p className="text-lg font-bold text-green-400">{agent.deals_closed}</p><p className="text-xs text-gray-500">Deals</p></div>
                      <div><p className="text-lg font-bold text-blue-400">{fmt$(agent.revenue_cents)}</p><p className="text-xs text-gray-500">Revenue</p></div>
                      <div><p className="text-lg font-bold text-purple-400">{fmt$(agent.commission_cents)}</p><p className="text-xs text-gray-500">Commission</p></div>
                    </div>
                  </div>

                  {selectedAgent?.agent_id === agent.agent_id && (
                    <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-4 gap-4">
                      <div className="bg-gray-800 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Reply Rate</p>
                        <p className="text-xl font-bold text-white mt-1">{fmtPct(agent.reply_rate)}</p>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Close Rate</p>
                        <p className="text-xl font-bold text-white mt-1">{fmtPct(agent.close_rate)}</p>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Avg Deal</p>
                        <p className="text-xl font-bold text-white mt-1">
                          {agent.deals_closed > 0 ? fmt$(Math.round(agent.revenue_cents / agent.deals_closed)) : "—"}
                        </p>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Commission Rate</p>
                        <p className="text-xl font-bold text-white mt-1">
                          {agent.revenue_cents > 0 ? fmtPct((agent.commission_cents / agent.revenue_cents) * 100) : "—"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Pipeline ── */}
        {view === "pipeline" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Stage breakdown — update stages directly from the Leads view</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {STAGES.map(stage => {
                const count = leads.filter(l => l.pipeline_stage === stage).length;
                return (
                  <div key={stage} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${STAGE_COLORS[stage] ?? "bg-gray-700 text-gray-300"}`}>
                      {stage}
                    </span>
                    <p className="text-2xl font-bold text-white mt-2">{count}</p>
                    <button onClick={() => { setStageFilter(stage); setView("leads"); }}
                      className="text-xs text-blue-400 hover:text-blue-300 mt-1">View →</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Automation ── */}
        {view === "automation" && (
          <div className="space-y-6">
            {/* Due-now banner */}
            {dueCount > 0 && (
              <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-yellow-300">⚡ {dueCount} messages due now</p>
                  <p className="text-xs text-yellow-500 mt-0.5">Sequence messages ready to send</p>
                </div>
                <button onClick={triggerSendDue}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-semibold rounded-lg transition-colors">
                  Send Now
                </button>
              </div>
            )}

            {/* Sequences list */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-200">Active Sequences</h3>
              {sequences.map(seq => {
                const active    = seq.enrollment_counts?.active    ?? 0;
                const completed = seq.enrollment_counts?.completed ?? 0;
                const stopped   = seq.enrollment_counts?.stopped   ?? 0;
                return (
                  <div key={seq.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{seq.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                            seq.channel === "sms" ? "bg-green-900/50 text-green-400" : "bg-blue-900/50 text-blue-400"
                          }`}>{seq.channel.toUpperCase()}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            seq.status === "active" ? "bg-green-900/30 text-green-400" : "bg-gray-700 text-gray-400"
                          }`}>{seq.status}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{seq.step_count} steps</p>
                      </div>
                      <div className="flex gap-6 text-right text-sm">
                        <div><p className="font-bold text-blue-400">{active}</p><p className="text-xs text-gray-500">Active</p></div>
                        <div><p className="font-bold text-green-400">{completed}</p><p className="text-xs text-gray-500">Done</p></div>
                        <div><p className="font-bold text-gray-400">{stopped}</p><p className="text-xs text-gray-500">Stopped</p></div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {sequences.length === 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
                  No sequences found — run Migration 23 in Supabase
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Revenue ── */}
        {view === "revenue" && (
          <div className="space-y-6">
            <div className="bg-green-900/20 border border-green-800/50 rounded-xl p-6">
              <p className="text-sm text-green-500 uppercase tracking-wide font-semibold">Monthly Recurring Revenue</p>
              <p className="text-5xl font-bold text-green-400 mt-2">{fmt$(totalMRR)}</p>
              <p className="text-xs text-green-600 mt-1">{companies.filter(c => c.status === "active").length} active contracts</p>
            </div>

            <div className="space-y-3">
              {companies.map(company => (
                <div key={company.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{company.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{company.contact_name} · {company.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-400">{fmt$(company.mrr_cents)}<span className="text-xs text-gray-500 font-normal">/mo</span></p>
                      <span className={`text-xs px-2 py-0.5 rounded ${company.status === "active" ? "bg-green-900/30 text-green-400" : "bg-gray-700 text-gray-400"}`}>
                        {company.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
