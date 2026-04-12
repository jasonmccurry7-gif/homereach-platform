"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Lead = {
  id: string; business_name: string; contact_name: string | null;
  email: string | null; phone: string | null; city: string | null;
  category: string | null; score: number; priority: string;
  buying_signal: boolean; status: string; pipeline_stage: string;
  is_duplicate: boolean; unreachable: boolean; fb_never_sent: boolean;
  total_messages_sent: number; total_replies: number;
  last_contacted_at: string | null; last_reply_at: string | null;
  next_follow_up_at: string | null; notes: string | null;
};
type Note = { id: string; body: string; type: string; created_at: string; profiles: { full_name: string } | null };
type Task = { id: string; title: string; type: string; status: string; due_at: string | null };
type OutreachEvent = { id: string; channel: string; type: string; status: string; message_body: string | null; sent_at: string | null; got_reply: boolean; fb_actually_sent: boolean };
type Company = { id: string; name: string; contact_name: string | null; email: string | null; mrr_cents: number; status: string; industry: string | null; crm_deals: { monthly_value_cents: number; city: string | null; category: string | null }[] };

type View = "pipeline" | "leads" | "companies" | "leaderboard";

const STAGES = ["new","contacted","replied","interested","negotiating","payment_sent","closed_won","closed_lost"] as const;
type Stage = typeof STAGES[number];

const STAGE_COLORS: Record<Stage, string> = {
  new:          "bg-gray-700 text-gray-300",
  contacted:    "bg-blue-900/50 text-blue-300",
  replied:      "bg-yellow-900/50 text-yellow-300",
  interested:   "bg-orange-900/50 text-orange-300",
  negotiating:  "bg-purple-900/50 text-purple-300",
  payment_sent: "bg-indigo-900/50 text-indigo-300",
  closed_won:   "bg-green-900/50 text-green-400 font-bold",
  closed_lost:  "bg-red-900/30 text-red-400",
};

export default function CRMClient({ agentId }: { agentId: string }) {
  const [view, setView] = useState<View>("pipeline");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [totalMRR, setTotalMRR] = useState(0);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadDetail, setLeadDetail] = useState<{ notes: Note[]; tasks: Task[]; outreach: OutreachEvent[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [stageFilter, setStageFilter] = useState<Stage | "">("");
  const [cityFilter, setCityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [leaderboard, setLeaderboard] = useState<Record<string, unknown>[]>([]);
  const [pipelineCounts, setPipelineCounts] = useState<Record<string, number>>({});

  // Load leads
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (stageFilter) params.set("status", stageFilter);
    if (cityFilter)  params.set("city", cityFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (search) params.set("q", search);

    const res = await fetch(`/api/admin/sales/leads?${params}`);
    const data = await res.json();
    setLeads(data.leads ?? []);
    setLoading(false);
  }, [stageFilter, cityFilter, categoryFilter, search]);

  // Pipeline counts
  const fetchPipelineCounts = useCallback(async () => {
    const res = await fetch("/api/admin/sales/funnel");
    const data = await res.json();
    const stages = data.funnel?.stages ?? {};
    setPipelineCounts({
      new:          (data.total - stages.messages_sent) || 0,
      contacted:    stages.messages_sent ?? 0,
      replied:      stages.replies ?? 0,
      closed_won:   stages.deals_closed ?? 0,
    });
  }, []);

  // Lead detail
  const loadLeadDetail = async (lead: Lead) => {
    setSelectedLead(lead);
    setLeadDetail(null);
    const res = await fetch(`/api/admin/crm/lead?id=${lead.id}`);
    const data = await res.json();
    setLeadDetail({ notes: data.notes ?? [], tasks: data.tasks ?? [], outreach: data.outreach_events ?? [] });
  };

  // Companies
  const fetchCompanies = useCallback(async () => {
    const res = await fetch("/api/admin/crm/companies");
    const data = await res.json();
    setCompanies(data.companies ?? []);
    setTotalMRR(data.total_mrr_cents ?? 0);
  }, []);

  // Leaderboard
  const fetchLeaderboard = useCallback(async () => {
    const res = await fetch("/api/admin/sales/leaderboard?since=" + new Date(Date.now()-86400000*30).toISOString());
    const data = await res.json();
    setLeaderboard(data.leaderboard ?? []);
  }, []);

  useEffect(() => { fetchLeads(); fetchPipelineCounts(); }, [fetchLeads, fetchPipelineCounts]);
  useEffect(() => { if (view === "companies") fetchCompanies(); }, [view, fetchCompanies]);
  useEffect(() => { if (view === "leaderboard") fetchLeaderboard(); }, [view, fetchLeaderboard]);

  // Add note
  const addNote = async () => {
    if (!selectedLead || !noteBody.trim()) return;
    await fetch("/api/admin/crm/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: selectedLead.id, body: noteBody, type: "observation" }),
    });
    setNoteBody("");
    loadLeadDetail(selectedLead);
  };

  // Add task
  const addTask = async () => {
    if (!selectedLead || !taskTitle.trim()) return;
    await fetch("/api/admin/crm/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: selectedLead.id, title: taskTitle, due_at: taskDue || null, type: "follow_up" }),
    });
    setTaskTitle(""); setTaskDue("");
    loadLeadDetail(selectedLead);
  };

  // Move pipeline stage
  const moveStage = async (leadId: string, stage: Stage) => {
    await fetch("/api/admin/crm/lead", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: leadId, stage_change: stage, agent_id: agentId }),
    });
    setLeads(l => l.map(lead => lead.id === leadId ? { ...lead, pipeline_stage: stage } : lead));
    if (selectedLead?.id === leadId) setSelectedLead(l => l ? { ...l, pipeline_stage: stage } : l);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">HomeReach CRM</h1>
          <p className="text-xs text-gray-500 mt-0.5">1,646 leads · 11 markets · {companies.filter(c=>c.status==='active').length} active clients</p>
        </div>
        <div className="flex items-center gap-2">
          {(["pipeline","leads","companies","leaderboard"] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${view === v ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
              {v === "pipeline" ? "🗂 Pipeline" : v === "leads" ? "🎯 Leads" : v === "companies" ? "🏢 Companies" : "🏆 Leaderboard"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Pipeline view ── */}
        {view === "pipeline" && (
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Stage summary */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { stage: "new",       label: "New Leads",   count: pipelineCounts.new ?? 0,         color: "text-gray-300" },
                { stage: "contacted", label: "Contacted",   count: pipelineCounts.contacted ?? 0,   color: "text-blue-400" },
                { stage: "replied",   label: "Replied",     count: pipelineCounts.replied ?? 0,     color: "text-yellow-400" },
                { stage: "closed_won",label: "Closed Won",  count: pipelineCounts.closed_won ?? 0,  color: "text-green-400" },
              ].map(({ stage, label, count, color }) => (
                <button key={stage} onClick={() => { setStageFilter(stage as Stage); setView("leads"); }}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-left hover:border-gray-600 transition-all">
                  <div className={`text-3xl font-bold ${color}`}>{count.toLocaleString()}</div>
                  <div className="text-gray-400 text-sm mt-1">{label}</div>
                </button>
              ))}
            </div>

            {/* Stage pipeline board */}
            <div className="grid grid-cols-4 gap-3">
              {(["new","contacted","replied","interested"] as Stage[]).map(stage => {
                const stageLeads = leads.filter(l => l.pipeline_stage === stage || l.status === stage).slice(0,10);
                return (
                  <div key={stage} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                    <div className={`text-xs font-bold uppercase px-2 py-1 rounded-lg inline-block mb-3 ${STAGE_COLORS[stage]}`}>{stage.replace("_"," ")}</div>
                    <div className="space-y-2">
                      {stageLeads.map(lead => (
                        <div key={lead.id} onClick={() => loadLeadDetail(lead)}
                          className="bg-gray-800/60 rounded-xl p-3 cursor-pointer hover:bg-gray-700/60 transition-all">
                          <div className="flex items-start justify-between gap-1">
                            <div className="font-medium text-white text-xs truncate flex-1">{lead.business_name}</div>
                            {lead.buying_signal && <span className="text-orange-400 text-xs shrink-0">🔥</span>}
                          </div>
                          <div className="text-gray-500 text-xs mt-0.5">{lead.city} · {lead.category}</div>
                          <div className="flex items-center gap-2 mt-1.5">
                            {lead.phone && <span className="text-green-400 text-xs">📱</span>}
                            {lead.email && <span className="text-blue-400 text-xs">📧</span>}
                            <span className="text-gray-600 text-xs ml-auto">{lead.score}pts</span>
                          </div>
                        </div>
                      ))}
                      {stageLeads.length === 0 && <div className="text-gray-600 text-xs text-center py-4">No leads</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Leads table view ── */}
        {view === "leads" && (
          <div className="flex-1 overflow-y-auto">
            {/* Filters */}
            <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 flex-wrap">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search business name..."
                className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-blue-500 w-48"
              />
              <select value={stageFilter} onChange={e => setStageFilter(e.target.value as Stage | "")}
                className="bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 border border-gray-700 focus:outline-none">
                <option value="">All Stages</option>
                {STAGES.map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
              </select>
              <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
                className="bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 border border-gray-700 focus:outline-none">
                <option value="">All Cities</option>
                {["Wooster","Medina","Massillon","Cuyahoga Falls","Ravenna","Green","Stow","Hudson","North Canton","Fairlawn","Twinsburg"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 border border-gray-700 focus:outline-none">
                <option value="">All Categories</option>
                {["Restaurant & Food","Home Services","Health & Wellness","Automotive","Real Estate","Cleaning Services","Junk Removal"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={fetchLeads} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium">Search</button>
              <span className="text-gray-500 text-xs ml-auto">{leads.length} results</span>
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800 bg-gray-900/50 sticky top-0">
                  {["Business","City","Category","Stage","Score","Contact","Messages","Flags",""].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} onClick={() => loadLeadDetail(lead)}
                    className="border-b border-gray-800/50 hover:bg-gray-900/60 cursor-pointer transition-all">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-white">{lead.business_name}</div>
                      {lead.contact_name && <div className="text-gray-500">{lead.contact_name}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">{lead.city}</td>
                    <td className="px-3 py-2.5 text-gray-400">{lead.category}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[(lead.pipeline_stage ?? "new") as Stage] ?? "bg-gray-700 text-gray-400"}`}>
                        {(lead.pipeline_stage ?? "new").replace("_"," ")}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-white">{lead.score}</td>
                    <td className="px-3 py-2.5">
                      {lead.phone && <span className="text-green-400 mr-1">📱</span>}
                      {lead.email && <span className="text-blue-400 mr-1">📧</span>}
                      {!lead.phone && !lead.email && <span className="text-red-400">⚠</span>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">{lead.total_messages_sent}s / {lead.total_replies}r</td>
                    <td className="px-3 py-2.5">
                      {lead.buying_signal && <span className="text-orange-400">🔥</span>}
                      {lead.is_duplicate && <span className="text-purple-400 text-xs ml-1">DUP</span>}
                      {lead.unreachable && <span className="text-red-500 text-xs ml-1">!</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <select value={lead.pipeline_stage ?? "new"}
                        onClick={e => e.stopPropagation()}
                        onChange={e => moveStage(lead.id, e.target.value as Stage)}
                        className="bg-gray-800 text-gray-300 text-xs rounded px-1 py-0.5 border border-gray-700">
                        {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading && <div className="text-center text-gray-500 text-sm py-8 animate-pulse">Loading...</div>}
          </div>
        )}

        {/* ── Companies view ── */}
        {view === "companies" && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="mb-4 bg-emerald-900/30 border border-emerald-700/40 rounded-2xl px-5 py-4 flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-white">${(totalMRR/100).toFixed(2)}</div>
                <div className="text-emerald-400 text-sm mt-0.5">Monthly Recurring Revenue</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-white">{companies.filter(c=>c.status==="active").length}</div>
                <div className="text-gray-400 text-sm">Active clients</div>
              </div>
            </div>
            <div className="space-y-2">
              {companies.map(c => (
                <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">{c.name}</div>
                    <div className="text-gray-400 text-sm">{c.contact_name} · {c.email}</div>
                    <div className="text-gray-500 text-xs mt-1">{c.industry}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${c.mrr_cents > 0 ? "text-emerald-400" : "text-gray-500"}`}>
                      ${(c.mrr_cents/100).toFixed(2)}/mo
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === "active" ? "bg-green-900/40 text-green-400" : "bg-yellow-900/40 text-yellow-400"}`}>
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Leaderboard view ── */}
        {view === "leaderboard" && (
          <div className="flex-1 p-6 overflow-y-auto">
            <h2 className="font-bold text-white text-lg mb-4">🏆 Agent Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <div className="text-center text-gray-500 py-12">No activity yet — agents need to start executing!</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left py-2 px-3">Rank</th>
                    <th className="text-left py-2 px-3">Agent</th>
                    <th className="text-right py-2 px-3">Deals</th>
                    <th className="text-right py-2 px-3">Revenue</th>
                    <th className="text-right py-2 px-3">Messages</th>
                    <th className="text-right py-2 px-3">Reply%</th>
                    <th className="text-right py-2 px-3">Close%</th>
                    <th className="text-left py-2 px-3">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {(leaderboard as Record<string,unknown>[]).map((a, i) => (
                    <tr key={String(a.agent_id)} className="border-b border-gray-800/50 hover:bg-gray-900/40">
                      <td className="py-3 px-3 font-bold text-yellow-400">#{i+1}</td>
                      <td className="py-3 px-3 font-semibold text-white">{String(a.name)}</td>
                      <td className="py-3 px-3 text-right text-green-400 font-bold">{String(a.deals)}</td>
                      <td className="py-3 px-3 text-right text-emerald-400">${(Number(a.revenue_cents)/100).toFixed(0)}</td>
                      <td className="py-3 px-3 text-right text-blue-300">{String(a.messages)}</td>
                      <td className="py-3 px-3 text-right text-yellow-300">{String(a.reply_rate)}%</td>
                      <td className="py-3 px-3 text-right text-purple-300">{String(a.close_rate)}%</td>
                      <td className="py-3 px-3 text-xs text-gray-400">
                        {((a.flags as string[]) ?? []).filter(f=>!["top_closer","best_converter","most_active"].includes(f)).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Lead detail panel ── */}
        {selectedLead && (
          <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-800 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedLead.buying_signal && <span className="text-orange-400 text-xs">🔥 HOT</span>}
                  {selectedLead.is_duplicate && <span className="bg-purple-900/40 text-purple-300 text-xs px-1.5 rounded">DUPLICATE</span>}
                  {selectedLead.unreachable && <span className="bg-red-900/40 text-red-300 text-xs px-1.5 rounded">NO CONTACT</span>}
                </div>
                <h3 className="font-bold text-white mt-1 leading-tight">{selectedLead.business_name}</h3>
                <p className="text-gray-400 text-xs mt-0.5">{selectedLead.city} · {selectedLead.category}</p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-gray-500 hover:text-gray-300 text-sm ml-2">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Contact info */}
              <div className="bg-gray-800/60 rounded-xl p-3 space-y-1.5 text-xs">
                {selectedLead.phone && <div className="flex gap-2"><span className="text-gray-500">📱</span><span className="text-white">{selectedLead.phone}</span></div>}
                {selectedLead.email && <div className="flex gap-2"><span className="text-gray-500">📧</span><span className="text-white">{selectedLead.email}</span></div>}
                {!selectedLead.phone && !selectedLead.email && <div className="text-red-400">⚠️ No contact info available</div>}
                <div className="flex gap-4 pt-1 border-t border-gray-700 mt-1">
                  <span className="text-gray-500">Score: <span className="text-white font-bold">{selectedLead.score}</span></span>
                  <span className="text-gray-500">Msgs: <span className="text-white">{selectedLead.total_messages_sent}</span></span>
                  <span className="text-gray-500">Replies: <span className="text-white">{selectedLead.total_replies}</span></span>
                </div>
              </div>

              {/* Stage selector */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Pipeline Stage</label>
                <select value={selectedLead.pipeline_stage ?? "new"}
                  onChange={e => moveStage(selectedLead.id, e.target.value as Stage)}
                  className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500">
                  {STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
                </select>
              </div>

              {/* Action shortcuts */}
              <div className="grid grid-cols-2 gap-2">
                <a href="/admin/agent-view" className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded-xl">⚡ Open Dialer</a>
                <a href={`/admin/sales-dashboard`} className="flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2 rounded-xl">📊 Dashboard</a>
              </div>

              {/* Outreach history */}
              {leadDetail && (
                <>
                  <div>
                    <div className="text-xs text-gray-500 font-semibold uppercase mb-2">Outreach History ({leadDetail.outreach.length})</div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {leadDetail.outreach.slice(0,10).map(ev => (
                        <div key={ev.id} className={`rounded-lg px-3 py-2 text-xs ${ev.fb_actually_sent === false ? "bg-red-900/20 border border-red-800/40" : "bg-gray-800/60"}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-300">{ev.channel} · {ev.type}</span>
                            <span className={`font-medium ${ev.status === "sent" ? "text-green-400" : ev.status === "failed" ? "text-red-400" : "text-gray-500"}`}>{ev.status}</span>
                          </div>
                          {ev.fb_actually_sent === false && <div className="text-red-400 text-xs mt-0.5">⚠️ FB NOT DELIVERED</div>}
                          {ev.got_reply && <div className="text-yellow-400 text-xs mt-0.5">✓ Got reply</div>}
                          {ev.message_body && <div className="text-gray-500 text-xs mt-1 truncate">{ev.message_body}</div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <div className="text-xs text-gray-500 font-semibold uppercase mb-2">Notes ({leadDetail.notes.length})</div>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {leadDetail.notes.map(n => (
                        <div key={n.id} className="bg-gray-800/60 rounded-lg px-3 py-2 text-xs">
                          <div className="text-white">{n.body}</div>
                          <div className="text-gray-500 mt-0.5">{n.profiles?.full_name} · {new Date(n.created_at).toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <input value={noteBody} onChange={e => setNoteBody(e.target.value)}
                        placeholder="Add note..."
                        className="flex-1 bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 border border-gray-700 focus:outline-none"
                        onKeyDown={e => e.key === "Enter" && addNote()}
                      />
                      <button onClick={addNote} className="bg-blue-600 text-white text-xs px-2 py-1.5 rounded-lg font-bold">+</button>
                    </div>
                  </div>

                  {/* Tasks */}
                  <div>
                    <div className="text-xs text-gray-500 font-semibold uppercase mb-2">Tasks ({leadDetail.tasks.filter(t=>t.status==="pending").length} pending)</div>
                    <div className="space-y-1.5">
                      {leadDetail.tasks.filter(t => t.status !== "done").map(t => (
                        <div key={t.id} className="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2 text-xs">
                          <button onClick={() => fetch("/api/admin/crm/tasks",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id,status:"done"})}).then(()=>loadLeadDetail(selectedLead))}
                            className="w-4 h-4 rounded border border-gray-600 hover:border-green-400 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="text-white">{t.title}</div>
                            {t.due_at && <div className="text-gray-500">{new Date(t.due_at).toLocaleDateString()}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Add task..."
                        className="flex-1 bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 border border-gray-700 focus:outline-none" />
                      <input value={taskDue} onChange={e => setTaskDue(e.target.value)} type="date"
                        className="bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 border border-gray-700 w-28 focus:outline-none" />
                      <button onClick={addTask} className="bg-orange-600 text-white text-xs px-2 py-1.5 rounded-lg font-bold">+</button>
                    </div>
                  </div>
                </>
              )}
              {!leadDetail && selectedLead && <div className="text-gray-500 text-xs text-center py-4 animate-pulse">Loading detail...</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
