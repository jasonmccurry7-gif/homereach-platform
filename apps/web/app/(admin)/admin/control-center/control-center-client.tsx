"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type LaunchCheck = {
  name: string; status: "pass" | "warn" | "fail";
  value: number | string | boolean; description: string; fix?: string;
};

type DedupCluster = {
  id: string; match_reason: string; confidence: string; resolution: string;
  canonical: { id: string; business_name: string; phone: string | null; email: string | null; city: string | null; total_messages_sent: number };
  duplicate: { id: string; business_name: string; phone: string | null; email: string | null; city: string | null; total_messages_sent: number };
};

type QLeadRow = {
  id: string; business_name: string; contact_name: string | null;
  email: string | null; phone: string | null; city: string | null;
  category: string | null; quarantine_reason: string; quarantined_at: string;
  quarantine_reviewed: boolean;
};

type FbEvent = {
  id: string; fb_outreach_status: string; fb_actually_sent: boolean;
  sent_at: string | null; message_body: string | null; created_at: string;
  sales_leads: { business_name: string; city: string | null; facebook_url: string | null } | null;
};

type Agent = {
  agent_id: string; messages_sent: number; replies: number; deals_closed: number;
  revenue_cents: number; reply_rate: number; close_rate: number;
  rank_overall: number; tier_name: string; commission_cents: number;
  profiles: { full_name: string; email: string } | null;
  flags: { high_activity_low_conversion: boolean; has_unfollowed_replies: boolean };
};

type Lead = {
  id: string; business_name: string; contact_name: string | null;
  email: string | null; phone: string | null; city: string | null;
  category: string | null; score: number; pipeline_stage: string;
  buying_signal: boolean; do_not_contact: boolean;
  total_messages_sent: number; total_replies: number;
  is_quarantined: boolean; quarantine_reason: string | null;
  profiles: { full_name: string } | null;
};

type PauseState = {
  system: { all_paused: boolean; pause_reason: string | null } | null;
  sequences: { id: string; name: string; channel: string; status: string }[];
  agents: { agent_id: string; paused: boolean; profiles: { full_name: string } | null }[];
};

type View = "launch" | "dedup" | "quarantine" | "fb_audit" | "leads" | "agents" | "automation" | "revenue";

const STAGE_COLORS: Record<string, string> = {
  new:"bg-gray-700/50 text-gray-300", contacted:"bg-blue-900/40 text-blue-300",
  replied:"bg-yellow-900/40 text-yellow-300", interested:"bg-orange-900/40 text-orange-300",
  negotiating:"bg-purple-900/40 text-purple-300", payment_sent:"bg-indigo-900/40 text-indigo-300",
  closed_won:"bg-green-900/40 text-green-400", closed_lost:"bg-red-900/30 text-red-400",
  suppressed:"bg-gray-800 text-gray-500",
};

const fmt$ = (c: number) => `$${(c / 100).toFixed(0)}`;

export default function ControlCenterClient() {
  const [view, setView] = useState<View>("launch");
  const [actionMsg, setActionMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  // Launch readiness
  const [launchChecks, setLaunchChecks] = useState<LaunchCheck[]>([]);
  const [launchVerdict, setLaunchVerdict] = useState<string>("");
  const [launchLoading, setLaunchLoading] = useState(false);

  // Dedup
  const [dedupClusters, setDedupClusters] = useState<DedupCluster[]>([]);
  const [dedupCounts, setDedupCounts] = useState<Record<string, number>>({});
  const [dedupFilter, setDedupFilter] = useState("pending");

  // Quarantine
  const [qLeads, setQLeads] = useState<QLeadRow[]>([]);
  const [qTotal, setQTotal] = useState(0);
  const [qReasonCounts, setQReasonCounts] = useState<Record<string, number>>({});

  // FB Audit
  const [fbSummary, setFbSummary] = useState<Record<string, number>>({});
  const [fbEvents, setFbEvents] = useState<FbEvent[]>([]);
  const [fbWarning, setFbWarning] = useState<string | null>(null);
  const [fbFilter, setFbFilter] = useState("never_sent");

  // Leads
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadTotal, setLeadTotal] = useState(0);
  const [leadPage, setLeadPage] = useState(0);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadStage, setLeadStage] = useState("");
  const [leadCity, setLeadCity] = useState("");

  // Agents
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentPeriod, setAgentPeriod] = useState<"today"|"week"|"month">("week");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Automation / Pause
  const [pauseState, setPauseState] = useState<PauseState>({ system: null, sequences: [], agents: [] });
  const [dueCount, setDueCount] = useState(0);

  // Revenue
  const [companies, setCompanies] = useState<{ id: string; name: string; mrr_cents: number; status: string; contact_name: string | null; email: string | null }[]>([]);
  const [totalMRR, setTotalMRR] = useState(0);

  // ── Loaders ──────────────────────────────────────────────────────────────────
  const fetchLaunch = useCallback(async () => {
    setLaunchLoading(true);
    const res = await fetch("/api/admin/crm/launch-readiness");
    const data = await res.json();
    setLaunchChecks(data.checks ?? []);
    setLaunchVerdict(data.verdict ?? "");
    setLaunchLoading(false);
  }, []);

  const fetchDedup = useCallback(async () => {
    const res = await fetch(`/api/admin/crm/dedup?resolution=${dedupFilter}`);
    const data = await res.json();
    setDedupClusters(data.clusters ?? []);
    setDedupCounts(data.counts ?? {});
  }, [dedupFilter]);

  const fetchQuarantine = useCallback(async () => {
    const res = await fetch("/api/admin/crm/quarantine?reviewed=false");
    const data = await res.json();
    setQLeads(data.leads ?? []);
    setQTotal(data.total ?? 0);
    setQReasonCounts(data.reason_counts ?? {});
  }, []);

  const fetchFbAudit = useCallback(async () => {
    const res = await fetch(`/api/admin/crm/fb-audit?status=${fbFilter}&limit=50`);
    const data = await res.json();
    setFbSummary(data.summary ?? {});
    setFbEvents(data.events ?? []);
    setFbWarning(data.warning);
  }, [fbFilter]);

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams({ page: String(leadPage), limit: "50" });
    if (leadSearch) params.set("q",     leadSearch);
    if (leadStage)  params.set("stage", leadStage);
    if (leadCity)   params.set("city",  leadCity);
    const res = await fetch(`/api/admin/crm/leads?${params}`);
    const data = await res.json();
    setLeads(data.leads ?? []);
    setLeadTotal(data.total ?? 0);
  }, [leadPage, leadSearch, leadStage, leadCity]);

  const fetchAgents = useCallback(async () => {
    const res = await fetch(`/api/admin/crm/leaderboard?period=${agentPeriod}`);
    const data = await res.json();
    setAgents(data.rows ?? []);
  }, [agentPeriod]);

  const fetchAutomation = useCallback(async () => {
    const [pr, due] = await Promise.all([
      fetch("/api/admin/system/pause"),
      fetch("/api/admin/automation/send-due"),
    ]);
    const [p, d] = await Promise.all([pr.json(), due.json()]);
    setPauseState(p);
    setDueCount(d.due_now ?? 0);
  }, []);

  const fetchRevenue = useCallback(async () => {
    const res = await fetch("/api/admin/crm/companies");
    const data = await res.json();
    setCompanies(data.companies ?? []);
    setTotalMRR(data.total_mrr_cents ?? 0);
  }, []);

  useEffect(() => {
    if (view === "launch")     fetchLaunch();
    if (view === "dedup")      fetchDedup();
    if (view === "quarantine") fetchQuarantine();
    if (view === "fb_audit")   fetchFbAudit();
    if (view === "leads")      fetchLeads();
    if (view === "agents")     fetchAgents();
    if (view === "automation") fetchAutomation();
    if (view === "revenue")    fetchRevenue();
  }, [view, fetchLaunch, fetchDedup, fetchQuarantine, fetchFbAudit, fetchLeads, fetchAgents, fetchAutomation, fetchRevenue]);

  useEffect(() => { if (view === "dedup") fetchDedup(); }, [dedupFilter, fetchDedup, view]);
  useEffect(() => { if (view === "fb_audit") fetchFbAudit(); }, [fbFilter, fetchFbAudit, view]);
  useEffect(() => { if (view === "leads") fetchLeads(); }, [leadPage, leadSearch, leadStage, leadCity, fetchLeads, view]);
  useEffect(() => { if (view === "agents") fetchAgents(); }, [agentPeriod, fetchAgents, view]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const flash = (text: string, type: "ok" | "err" = "ok") => {
    setActionMsg({ text, type });
    setTimeout(() => setActionMsg(null), 4000);
  };

  const resolveDedup = async (clusterId: string, action: string) => {
    const res = await fetch("/api/admin/crm/dedup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cluster_id: clusterId, action }),
    });
    const data = await res.json();
    if (data.ok) { flash(`✓ Cluster ${action}`); fetchDedup(); }
    else         flash(data.error, "err");
  };

  const restoreQuarantine = async (leadId: string) => {
    const res = await fetch("/api/admin/crm/quarantine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId, note: "Manually restored by admin" }),
    });
    const data = await res.json();
    if (data.ok) { flash("Lead restored from quarantine"); fetchQuarantine(); }
    else         flash(data.error, "err");
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
    flash("Marked DNC");
    fetchLeads();
  };

  const setPause = async (scope: string, paused: boolean, id?: string, reason?: string) => {
    const res = await fetch("/api/admin/system/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, id, paused, reason }),
    });
    const data = await res.json();
    if (data.ok) { flash(`${paused ? "⏸ Paused" : "▶ Resumed"} ${scope}${id ? ` (${id.slice(0,8)})` : ""}`); fetchAutomation(); }
    else         flash(data.error, "err");
  };

  const triggerSendDue = async () => {
    const res = await fetch("/api/admin/automation/send-due", { method: "POST" });
    const data = await res.json();
    flash(`Sent ${data.sent ?? 0} messages | Skipped ${data.skipped ?? 0}`);
    fetchAutomation();
  };

  // ── Nav ───────────────────────────────────────────────────────────────────────
  type NavItem = { v: View; label: string; badge?: string; badgeColor?: string };
  const navItems: NavItem[] = [
    { v: "launch",     label: "🚀 Launch Readiness",
      badge: launchVerdict === "NO_GO" ? "NO-GO" : launchVerdict === "GO" ? "GO" : launchVerdict === "GO_WITH_WARNINGS" ? "WARNINGS" : "",
      badgeColor: launchVerdict === "NO_GO" ? "bg-red-600" : launchVerdict === "GO" ? "bg-green-600" : "bg-yellow-600" },
    { v: "dedup",      label: "🔍 Dedup Center",
      badge: String(dedupCounts["pending"] ?? ""),
      badgeColor: "bg-orange-600" },
    { v: "quarantine", label: "🔒 Quarantine",
      badge: String(qTotal || ""),
      badgeColor: "bg-yellow-700" },
    { v: "fb_audit",   label: "📘 FB Audit",
      badge: String(fbSummary["never_sent"] ?? ""),
      badgeColor: "bg-blue-700" },
    { v: "leads",      label: "🎯 All Leads" },
    { v: "agents",     label: "👥 Agents" },
    { v: "automation", label: "🤖 Automation",
      badge: dueCount > 0 ? String(dueCount) : "",
      badgeColor: "bg-yellow-600" },
    { v: "revenue",    label: "💰 Revenue" },
  ];

  const STAGES = ["new","contacted","replied","interested","negotiating","payment_sent","closed_won","closed_lost","suppressed"];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Admin Control Center</h1>
            <p className="text-xs text-gray-500 mt-0.5">Launch-hardened visibility + full operational control</p>
          </div>
          {actionMsg && (
            <div className={`border text-sm px-4 py-2 rounded-lg ${
              actionMsg.type === "ok"
                ? "bg-green-900/50 border-green-700 text-green-300"
                : "bg-red-900/50 border-red-700 text-red-300"
            }`}>
              {actionMsg.text}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mt-4">
          {navItems.map(({ v, label, badge, badgeColor }) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                view === v ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}>
              {label}
              {badge && badge !== "0" && badge !== "" && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-bold text-white ${badgeColor ?? "bg-gray-600"}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* ═══════════════════════════════════════════════════════════════════
            LAUNCH READINESS
        ═══════════════════════════════════════════════════════════════════ */}
        {view === "launch" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-black px-4 py-2 rounded-xl ${
                  launchVerdict === "GO"            ? "bg-green-900/50 text-green-400 border border-green-700" :
                  launchVerdict === "NO_GO"         ? "bg-red-900/50 text-red-400 border border-red-700" :
                  launchVerdict === "GO_WITH_WARNINGS" ? "bg-yellow-900/50 text-yellow-400 border border-yellow-700" :
                  "bg-gray-800 text-gray-400"
                }`}>
                  {launchVerdict || "—"}
                </span>
                <div>
                  <p className="font-semibold text-white">Launch Readiness</p>
                  <p className="text-xs text-gray-500">
                    {launchChecks.filter(c => c.status === "pass").length} pass ·{" "}
                    {launchChecks.filter(c => c.status === "warn").length} warn ·{" "}
                    {launchChecks.filter(c => c.status === "fail").length} fail
                  </p>
                </div>
              </div>
              <button onClick={fetchLaunch} disabled={launchLoading}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 rounded-lg transition-colors disabled:opacity-50">
                {launchLoading ? "Checking…" : "↺ Refresh"}
              </button>
            </div>

            <div className="space-y-2">
              {launchChecks.map(c => (
                <div key={c.name} className={`border rounded-xl p-4 ${
                  c.status === "pass" ? "border-green-900/50 bg-green-950/30" :
                  c.status === "warn" ? "border-yellow-900/50 bg-yellow-950/20" :
                  "border-red-900/50 bg-red-950/20"
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {c.status === "pass" ? "✅" : c.status === "warn" ? "⚠️" : "❌"}
                      </span>
                      <div>
                        <p className={`font-semibold ${
                          c.status === "pass" ? "text-green-300" :
                          c.status === "warn" ? "text-yellow-300" : "text-red-300"
                        }`}>{c.description}</p>
                        <p className="text-xs text-gray-500 mt-0.5 font-mono">{c.name}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-xl ${
                        c.status === "pass" ? "text-green-400" :
                        c.status === "warn" ? "text-yellow-400" : "text-red-400"
                      }`}>
                        {typeof c.value === "boolean" ? (c.value ? "YES" : "NO") : String(c.value)}
                      </p>
                    </div>
                  </div>
                  {c.fix && (
                    <div className="mt-2 ml-10 px-3 py-2 bg-gray-900/80 rounded-lg border border-gray-800">
                      <p className="text-xs text-gray-400"><span className="text-orange-400 font-semibold">FIX:</span> {c.fix}</p>
                    </div>
                  )}
                </div>
              ))}
              {launchLoading && (
                <div className="text-center py-8 text-gray-500">Checking launch readiness…</div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            DEDUP CENTER
        ═══════════════════════════════════════════════════════════════════ */}
        {view === "dedup" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Duplicate Resolution Center</h2>
                <p className="text-xs text-gray-500 mt-0.5">Exact phone or email match = high-confidence duplicate</p>
              </div>
              <div className="flex gap-2">
                {["pending","merged","kept_separate","all"].map(f => (
                  <button key={f} onClick={() => setDedupFilter(f)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize ${dedupFilter === f ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                    {f.replace("_"," ")} {dedupCounts[f] !== undefined ? `(${dedupCounts[f]})` : ""}
                  </button>
                ))}
              </div>
            </div>

            {dedupClusters.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <p className="text-green-400 font-semibold text-lg">✅ No pending duplicates</p>
                <p className="text-gray-500 text-sm mt-1">All duplicate pairs have been resolved</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dedupClusters.map(c => (
                  <div key={c.id} className="bg-gray-900 border border-orange-900/40 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                          c.confidence === "high" ? "bg-red-900/50 text-red-400" : "bg-yellow-900/50 text-yellow-400"
                        }`}>{c.confidence} confidence</span>
                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{c.match_reason}</span>
                      </div>
                      {c.resolution === "pending" && (
                        <div className="flex gap-2">
                          <button onClick={() => resolveDedup(c.id, "merge")}
                            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg">
                            Merge → Keep Canonical
                          </button>
                          <button onClick={() => resolveDedup(c.id, "keep_separate")}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg">
                            Keep Separate
                          </button>
                          <button onClick={() => resolveDedup(c.id, "reviewed")}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg">
                            Mark Reviewed
                          </button>
                        </div>
                      )}
                      {c.resolution !== "pending" && (
                        <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded">{c.resolution}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[{ label: "CANONICAL (keep)", data: c.canonical, color: "border-green-900/50" },
                        { label: "DUPLICATE (merge/suppress)", data: c.duplicate, color: "border-red-900/40" }].map(({ label, data, color }) => (
                        <div key={label} className={`bg-gray-800 border ${color} rounded-lg p-3`}>
                          <p className="text-xs text-gray-500 uppercase font-bold mb-1">{label}</p>
                          <p className="font-semibold text-white">{data?.business_name ?? "—"}</p>
                          <p className="text-xs text-gray-400">📞 {data?.phone ?? "none"}</p>
                          <p className="text-xs text-gray-400">✉️ {(data as { email?: string | null })?.email ?? "none"}</p>
                          <p className="text-xs text-gray-500">{data?.city ?? "—"} · {data?.total_messages_sent ?? 0} msgs sent</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            QUARANTINE
        ═══════════════════════════════════════════════════════════════════ */}
        {view === "quarantine" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Quarantine Queue</h2>
                <p className="text-xs text-gray-500 mt-0.5">Leads removed from sales workflow — no phone AND no email</p>
              </div>
              <div className="flex gap-4">
                {Object.entries(qReasonCounts).map(([reason, count]) => (
                  <div key={reason} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-center">
                    <p className="text-lg font-bold text-yellow-400">{count}</p>
                    <p className="text-xs text-gray-500">{reason.replace(/_/g," ")}</p>
                  </div>
                ))}
              </div>
            </div>

            {qLeads.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <p className="text-green-400 font-semibold">✅ No unreviewed quarantine leads</p>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                      <th className="px-4 py-3 text-left">Business</th>
                      <th className="px-4 py-3 text-left">City</th>
                      <th className="px-4 py-3 text-left">Reason</th>
                      <th className="px-4 py-3 text-left">Phone / Email</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {qLeads.map(lead => (
                      <tr key={lead.id} className="hover:bg-gray-800/30">
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{lead.business_name}</p>
                          <p className="text-xs text-gray-500">{lead.category}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{lead.city ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-yellow-900/40 text-yellow-300 px-2 py-0.5 rounded">
                            {lead.quarantine_reason?.replace(/_/g," ") ?? "unknown"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {lead.phone ?? <span className="text-red-400">no phone</span>} · {lead.email ?? <span className="text-red-400">no email</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => restoreQuarantine(lead.id)}
                            className="text-xs px-3 py-1.5 bg-blue-800/50 hover:bg-blue-700/60 text-blue-300 rounded-lg">
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            FB AUDIT
        ═══════════════════════════════════════════════════════════════════ */}
        {view === "fb_audit" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Facebook Outreach Truth Audit</h2>
            {fbWarning && (
              <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4">
                <p className="text-red-300 font-semibold">{fbWarning}</p>
                <p className="text-xs text-red-500 mt-1">These messages DO NOT count toward agent activity scores or leaderboard totals.</p>
              </div>
            )}

            {/* Status breakdown */}
            <div className="grid grid-cols-5 gap-3">
              {(["never_sent","draft_generated","queued","sent","failed"] as const).map(s => (
                <button key={s} onClick={() => setFbFilter(s)}
                  className={`border rounded-xl p-3 text-center transition-colors ${fbFilter === s ? "border-blue-500 bg-blue-900/20" : "border-gray-800 bg-gray-900 hover:border-gray-700"}`}>
                  <p className={`text-2xl font-bold ${
                    s === "never_sent" ? "text-red-400" :
                    s === "sent"       ? "text-green-400" :
                    s === "failed"     ? "text-orange-400" : "text-yellow-400"
                  }`}>{fbSummary[s] ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.replace(/_/g," ")}</p>
                </button>
              ))}
            </div>

            {/* Event table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <p className="text-sm text-gray-400">Showing: <span className="text-white font-medium">{fbFilter.replace(/_/g," ")}</span></p>
                <p className="text-xs text-gray-500">{fbEvents.length} events</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 text-left">Business</th>
                    <th className="px-4 py-2 text-left">City</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Message preview</th>
                    <th className="px-4 py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {fbEvents.slice(0, 50).map(ev => (
                    <tr key={ev.id} className="hover:bg-gray-800/20">
                      <td className="px-4 py-2 text-white">{ev.sales_leads?.business_name ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-400">{ev.sales_leads?.city ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                          ev.fb_outreach_status === "never_sent"     ? "bg-red-900/50 text-red-400" :
                          ev.fb_outreach_status === "sent"            ? "bg-green-900/40 text-green-400" :
                          ev.fb_outreach_status === "failed"          ? "bg-orange-900/40 text-orange-400" :
                          "bg-yellow-900/40 text-yellow-400"
                        }`}>{ev.fb_outreach_status ?? "unknown"}</span>
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs max-w-[300px] truncate">
                        {ev.message_body?.slice(0, 80) ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs">
                        {ev.created_at ? new Date(ev.created_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                  {fbEvents.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No events with status: {fbFilter}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ALL LEADS
        ═══════════════════════════════════════════════════════════════════ */}
        {view === "leads" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <input type="text" placeholder="Search…" value={leadSearch}
                onChange={e => { setLeadSearch(e.target.value); setLeadPage(0); }}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 w-56" />
              <select value={leadStage} onChange={e => setLeadStage(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
                <option value="">All Stages</option>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="text" placeholder="City" value={leadCity}
                onChange={e => setLeadCity(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 w-36" />
              <span className="ml-auto text-xs text-gray-500">{leadTotal.toLocaleString()} leads</span>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                    <th className="px-4 py-3 text-left">Business</th>
                    <th className="px-4 py-3 text-left">City</th>
                    <th className="px-4 py-3 text-left">Stage</th>
                    <th className="px-4 py-3 text-center">Score</th>
                    <th className="px-4 py-3 text-center">Msgs/Replies</th>
                    <th className="px-4 py-3 text-left">Agent</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-gray-800/30">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          {lead.buying_signal && <span className="text-xs bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded font-bold">HOT</span>}
                          {lead.do_not_contact && <span className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">DNC</span>}
                          {lead.is_quarantined && <span className="text-xs bg-yellow-900/50 text-yellow-400 px-1.5 py-0.5 rounded">🔒</span>}
                          <span className="text-white truncate max-w-[180px]">{lead.business_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-400">{lead.city ?? "—"}</td>
                      <td className="px-4 py-2">
                        <select value={lead.pipeline_stage} onChange={e => updateStage(lead.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded border-0 cursor-pointer ${STAGE_COLORS[lead.pipeline_stage] ?? "bg-gray-700 text-gray-300"}`}>
                          {STAGES.map(s => <option key={s} value={s} className="bg-gray-800 text-white">{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-center font-bold text-sm">
                        <span className={lead.score >= 80 ? "text-green-400" : lead.score >= 60 ? "text-yellow-400" : "text-gray-400"}>
                          {lead.score}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center text-gray-400 text-xs">
                        {lead.total_messages_sent} / {lead.total_replies}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">
                        {lead.profiles?.full_name ?? "Unassigned"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {!lead.do_not_contact && (
                          <button onClick={() => markDnc(lead.id)}
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/20">DNC</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No leads found</td></tr>
                  )}
                </tbody>
              </table>
              {leadTotal > 50 && (
                <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
                  <button onClick={() => setLeadPage(p => Math.max(0, p-1))} disabled={leadPage === 0}
                    className="text-xs text-gray-400 hover:text-white disabled:opacity-30">← Prev</button>
                  <span className="text-xs text-gray-500">Page {leadPage+1} of {Math.ceil(leadTotal/50)}</span>
                  <button onClick={() => setLeadPage(p => p+1)} disabled={(leadPage+1)*50 >= leadTotal}
                    className="text-xs text-gray-400 hover:text-white disabled:opacity-30">Next →</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            AGENTS
        ═══════════════════════════════════════════════════════════════════ */}
        {view === "agents" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["today","week","month"] as const).map(p => (
                <button key={p} onClick={() => setAgentPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize ${agentPeriod === p ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>
                  {p}
                </button>
              ))}
            </div>
            {agents.map(agent => {
              const agentName = agent.profiles?.full_name ?? "Agent";
              const isPaused = pauseState.agents.find(a => a.agent_id === agent.agent_id)?.paused ?? false;
              return (
                <div key={agent.agent_id}
                  className={`bg-gray-900 border rounded-xl p-4 cursor-pointer ${selectedAgent === agent.agent_id ? "border-blue-500" : "border-gray-800"}`}
                  onClick={() => setSelectedAgent(selectedAgent === agent.agent_id ? null : agent.agent_id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        agent.rank_overall === 1 ? "bg-yellow-600/30 text-yellow-400" : "bg-gray-800 text-gray-400"
                      }`}>#{agent.rank_overall}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">{agentName}</p>
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                            agent.tier_name === "Elite" ? "bg-yellow-900/50 text-yellow-400" :
                            agent.tier_name === "Closer" ? "bg-purple-900/50 text-purple-400" :
                            "bg-gray-800 text-gray-500"
                          }`}>{agent.tier_name}</span>
                          {isPaused && <span className="text-xs bg-orange-900/50 text-orange-400 px-2 py-0.5 rounded">⏸ Paused</span>}
                          {agent.flags?.high_activity_low_conversion && <span className="text-xs bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded">⚠ Low Conv</span>}
                          {agent.flags?.has_unfollowed_replies && <span className="text-xs bg-orange-900/40 text-orange-400 px-1.5 py-0.5 rounded">💬 Replies</span>}
                        </div>
                        <p className="text-xs text-gray-500">{agent.profiles?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex gap-4 text-right text-sm">
                        <div><p className="font-bold text-white">{agent.messages_sent}</p><p className="text-xs text-gray-500">Msgs</p></div>
                        <div><p className="font-bold text-yellow-400">{agent.replies}</p><p className="text-xs text-gray-500">Replies</p></div>
                        <div><p className="font-bold text-green-400">{agent.deals_closed}</p><p className="text-xs text-gray-500">Deals</p></div>
                        <div><p className="font-bold text-blue-400">{fmt$(agent.revenue_cents)}</p><p className="text-xs text-gray-500">Revenue</p></div>
                        <div><p className="font-bold text-purple-400">{fmt$(agent.commission_cents)}</p><p className="text-xs text-gray-500">Comm</p></div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); setPause("agent", !isPaused, agent.agent_id, "Admin pause"); }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${isPaused ? "bg-green-800 text-green-300" : "bg-orange-900/50 text-orange-300 hover:bg-orange-800/60"}`}>
                        {isPaused ? "▶ Resume" : "⏸ Pause"}
                      </button>
                    </div>
                  </div>
                  {selectedAgent === agent.agent_id && (
                    <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-3 gap-3">
                      <div className="bg-gray-800 rounded-lg p-3"><p className="text-xs text-gray-500">Reply Rate</p><p className="text-xl font-bold text-white">{agent.reply_rate.toFixed(1)}%</p></div>
                      <div className="bg-gray-800 rounded-lg p-3"><p className="text-xs text-gray-500">Close Rate</p><p className="text-xl font-bold text-white">{agent.close_rate.toFixed(1)}%</p></div>
                      <div className="bg-gray-800 rounded-lg p-3"><p className="text-xs text-gray-500">Avg Deal</p><p className="text-xl font-bold text-white">{agent.deals_closed > 0 ? fmt$(Math.round(agent.revenue_cents/agent.deals_closed)) : "—"}</p></div>
                    </div>
                  )}
                </div>
              );
            })}
            {agents.length === 0 && <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">No agent data — run validation to trigger leaderboard refresh</div>}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            AUTOMATION CONTROLS
        ═══════════════════════════════════════════════════════════════════ */}
        {view === "automation" && (
          <div className="space-y-6">
            {/* System pause */}
            <div className={`border rounded-xl p-5 ${pauseState.system?.all_paused ? "border-red-800 bg-red-950/20" : "border-gray-800 bg-gray-900"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-white text-lg">
                    {pauseState.system?.all_paused ? "⏸ System PAUSED" : "▶ System Running"}
                  </p>
                  {pauseState.system?.all_paused && (
                    <p className="text-xs text-red-400 mt-0.5">Reason: {pauseState.system.pause_reason ?? "No reason"}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  {dueCount > 0 && !pauseState.system?.all_paused && (
                    <button onClick={triggerSendDue} className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 text-white text-sm font-semibold rounded-lg">
                      Send {dueCount} due now
                    </button>
                  )}
                  <button
                    onClick={() => setPause("system", !pauseState.system?.all_paused, undefined, "Admin pause all")}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg ${pauseState.system?.all_paused ? "bg-green-700 hover:bg-green-600 text-white" : "bg-red-800 hover:bg-red-700 text-white"}`}>
                    {pauseState.system?.all_paused ? "▶ Resume All" : "⏸ Pause All"}
                  </button>
                </div>
              </div>
            </div>

            {/* Per-sequence pause */}
            <div>
              <h3 className="font-semibold text-gray-300 mb-3">Sequences</h3>
              <div className="space-y-2">
                {pauseState.sequences.map(seq => (
                  <div key={seq.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{seq.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${seq.channel === "sms" ? "bg-green-900/50 text-green-400" : "bg-blue-900/50 text-blue-400"}`}>{seq.channel}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${seq.status === "active" ? "bg-green-900/30 text-green-400" : "bg-orange-900/40 text-orange-400"}`}>{seq.status}</span>
                      </div>
                    </div>
                    <button onClick={() => setPause("sequence", seq.status === "active", seq.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${seq.status === "paused" ? "bg-green-800 text-green-300" : "bg-gray-700 hover:bg-gray-600 text-gray-300"}`}>
                      {seq.status === "paused" ? "▶ Resume" : "⏸ Pause"}
                    </button>
                  </div>
                ))}
                {pauseState.sequences.length === 0 && <p className="text-gray-500 text-sm">No sequences — run Migration 23</p>}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            REVENUE
        ═══════════════════════════════════════════════════════════════════ */}
        {view === "revenue" && (
          <div className="space-y-6">
            <div className="bg-green-900/20 border border-green-800/50 rounded-xl p-6">
              <p className="text-sm text-green-500 uppercase font-semibold">Monthly Recurring Revenue</p>
              <p className="text-5xl font-bold text-green-400 mt-2">{fmt$(totalMRR)}</p>
              <p className="text-xs text-green-600 mt-1">{companies.filter(c => c.status === "active").length} active contracts</p>
            </div>
            {companies.map(c => (
              <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.contact_name} · {c.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-green-400">{fmt$(c.mrr_cents)}<span className="text-xs text-gray-500 font-normal">/mo</span></p>
                  <span className={`text-xs px-2 py-0.5 rounded ${c.status === "active" ? "bg-green-900/30 text-green-400" : "bg-gray-700 text-gray-400"}`}>{c.status}</span>
                </div>
              </div>
            ))}
            {companies.length === 0 && <p className="text-gray-500 text-sm">No companies — run Migration 21c</p>}
          </div>
        )}
      </div>
    </div>
  );
}
