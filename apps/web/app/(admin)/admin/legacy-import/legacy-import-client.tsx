"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Legacy Import Dashboard — Client Component
//
// Tabs:
//   1. Import Summary — stats, report, safety breakdown
//   2. Business Registry — full normalized list with suppression status
//   3. Duplicates & Flags — records needing manual review
//   4. Outreach History — imported SMS/email events
//   5. Conversations — imported thread records
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { ImportState, NormalizedBusiness, ImportRecord } from "@/lib/legacy-import/types";
import { evaluateSuppression, getDecisionMeta } from "@/lib/legacy-import/suppression";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  initialState: ImportState;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color = "text-white", border = "border-gray-800",
}: {
  label:   string;
  value:   string | number;
  sub?:    string;
  color?:  string;
  border?: string;
}) {
  return (
    <div className={`bg-gray-900 border ${border} rounded-xl p-4 flex flex-col gap-1`}>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Suppression Badge
// ─────────────────────────────────────────────────────────────────────────────

function SuppressionBadge({ biz }: { biz: NormalizedBusiness }) {
  const result = evaluateSuppression(biz);
  const meta   = getDecisionMeta(result.decision);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${meta.color} ${meta.bg}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active_customer:  "bg-purple-900/30 text-purple-400",
    interested:       "bg-amber-900/30 text-amber-400",
    replied:          "bg-blue-900/30 text-blue-400",
    intake_sent:      "bg-teal-900/30 text-teal-400",
    contacted:        "bg-gray-700 text-gray-300",
    not_contacted:    "bg-gray-800 text-gray-500",
    scraped:          "bg-gray-800 text-gray-500",
    closed_lost:      "bg-gray-800 text-gray-600",
    do_not_contact:   "bg-red-900/30 text-red-400",
    booked:           "bg-green-900/30 text-green-400",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-gray-800 text-gray-400"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Import Record Status Badge
// ─────────────────────────────────────────────────────────────────────────────

function RecordBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    imported: "bg-green-900/30 text-green-400",
    merged:   "bg-blue-900/30 text-blue-400",
    flagged:  "bg-orange-900/30 text-orange-400",
    skipped:  "bg-gray-800 text-gray-500",
    error:    "bg-red-900/30 text-red-400",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-gray-700 text-gray-400"}`}>
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Outreach Flags mini-row
// ─────────────────────────────────────────────────────────────────────────────

function FlagRow({ biz }: { biz: NormalizedBusiness }) {
  const f = biz.outreachFlags;
  function Flag({ on, label }: { on: boolean; label: string }) {
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${on ? "bg-gray-700 text-gray-300" : "bg-gray-900 text-gray-700 line-through"}`}>
        {label}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      <Flag on={f.scraped_already}     label="scraped" />
      <Flag on={f.outreach_sent_sms}   label="sms" />
      <Flag on={f.outreach_sent_email} label="email" />
      <Flag on={f.replied}             label="replied" />
      <Flag on={f.intake_sent}         label="intake" />
      <Flag on={f.customer_active}     label="customer" />
      <Flag on={f.do_not_contact}      label="DNC" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Business Row (expandable)
// ─────────────────────────────────────────────────────────────────────────────

function BusinessRow({ biz }: { biz: NormalizedBusiness }) {
  const [open, setOpen] = useState(false);
  const result = evaluateSuppression(biz);

  return (
    <>
      <tr
        className="border-b border-gray-800 hover:bg-gray-900/50 cursor-pointer transition-colors"
        onClick={() => setOpen(!open)}
      >
        <td className="px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">{biz.name}</p>
            <p className="text-xs text-gray-500">{biz.city}{biz.state ? `, ${biz.state}` : ""}</p>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-gray-400">{biz.category ?? "—"}</td>
        <td className="px-4 py-3 text-xs text-gray-400 font-mono">{biz.phone ?? "—"}</td>
        <td className="px-4 py-3"><StatusBadge status={biz.status} /></td>
        <td className="px-4 py-3"><SuppressionBadge biz={biz} /></td>
        <td className="px-4 py-3 text-xs text-gray-500 text-center">{open ? "▲" : "▼"}</td>
      </tr>

      {open && (
        <tr className="bg-gray-900/60 border-b border-gray-800">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <p className="text-gray-500 font-medium uppercase tracking-wider mb-1">Contact Info</p>
                {biz.email   && <p className="text-gray-300">✉️ {biz.email}</p>}
                {biz.website && <p className="text-gray-300">🌐 {biz.website}</p>}
                {biz.address && <p className="text-gray-400">{biz.address}</p>}
                {biz.placeId && <p className="text-gray-600">Place ID: {biz.placeId}</p>}
              </div>
              <div className="space-y-1">
                <p className="text-gray-500 font-medium uppercase tracking-wider mb-1">Outreach History</p>
                <FlagRow biz={biz} />
                {biz.notes && (
                  <div className="mt-2 p-2 bg-gray-800 rounded text-gray-400 italic">
                    "{biz.notes}"
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-gray-500 font-medium uppercase tracking-wider mb-1">Suppression</p>
                <p className={result.allowed ? "text-green-400" : "text-red-400"}>
                  {result.allowed ? "✅ Outreach allowed" : "🚫 Outreach blocked"}
                </p>
                <p className="text-gray-500 mt-1">{result.reason}</p>
                <div className="mt-2 space-y-0.5">
                  <p className={`text-xs ${result.canSendSms    ? "text-green-400" : "text-gray-700"}`}>SMS: {result.canSendSms    ? "allowed" : "blocked"}</p>
                  <p className={`text-xs ${result.canSendEmail  ? "text-green-400" : "text-gray-700"}`}>Email: {result.canSendEmail  ? "allowed" : "blocked"}</p>
                  <p className={`text-xs ${result.canSendIntake ? "text-green-400" : "text-gray-700"}`}>Intake: {result.canSendIntake ? "allowed" : "blocked"}</p>
                </div>
                {result.requiresAdminOk && (
                  <p className="text-amber-400 mt-1">⚠ Requires admin approval to unblock</p>
                )}
                <p className="text-gray-600 mt-1">Source: {biz.source} · ID: {biz.legacyId}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────

type ActiveTab = "summary" | "businesses" | "flags" | "outreach" | "conversations";

export function LegacyImportClient({ initialState }: Props) {
  const [tab, setTab]           = useState<ActiveTab>("summary");
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatus] = useState("all");

  const { report, businesses, outreach, conversations } = initialState;

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        No import data available.
      </div>
    );
  }

  // ── Filtered businesses ──────────────────────────────────────────────────
  const filteredBiz = businesses.filter((b) => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        b.city?.toLowerCase().includes(q) ||
        b.phone?.includes(q) ||
        b.category?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const flaggedRecords = report.records.filter((r) => r.status === "flagged");
  const importedBizRecords = report.records.filter((r) => r.type === "business" && r.status === "imported");

  const tabs: { key: ActiveTab; label: string; count?: number }[] = [
    { key: "summary",       label: "Import Summary" },
    { key: "businesses",    label: `Business Registry (${businesses.length})` },
    { key: "flags",         label: `Duplicates & Flags (${flaggedRecords.length})`, count: flaggedRecords.length },
    { key: "outreach",      label: `Outreach History (${outreach.length})` },
    { key: "conversations", label: `Conversations (${conversations.length})` },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">🗄️ Legacy Data Import</h1>
              <span className="text-xs bg-green-900/30 text-green-400 border border-green-800/40 px-2 py-0.5 rounded-full font-medium">
                ✅ Import Complete
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Source: <span className="text-gray-400 font-medium">Replit</span> ·
              Run: <span className="text-gray-400 font-mono text-xs">{report.runId}</span> ·
              Completed: <span className="text-gray-400">{new Date(report.completedAt).toLocaleString()}</span>
            </p>
          </div>
          <div className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800/40 px-3 py-2 rounded-lg text-center max-w-xs">
            ⚠ Outreach suppression is <strong>active</strong>.<br />No new scraping or messaging until all records reviewed.
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-800 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                tab === t.key
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
              {t.count && t.count > 0 && (
                <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Summary ──────────────────────────────────────────────────── */}
        {tab === "summary" && (
          <div className="space-y-6">

            {/* Input counts */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Records Ingested from Replit</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatCard label="Businesses"    value={report.totalBusinesses}    color="text-white" />
                <StatCard label="Outreach Events" value={report.totalOutreach}    color="text-white" />
                <StatCard label="Conversations"  value={report.totalConversations} color="text-white" />
                <StatCard label="Messages"       value={report.totalMessages}      color="text-white" />
                <StatCard label="Customer Records" value={report.totalCustomers}   color="text-white" />
              </div>
            </div>

            {/* Import outcomes */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Import Outcomes</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatCard label="Cleanly Imported" value={report.imported} color="text-green-400" border="border-green-900/40" />
                <StatCard label="Merged (High Conf.)" value={report.merged} color="text-blue-400" border="border-blue-900/40" sub="auto-deduplicated" />
                <StatCard label="Flagged for Review" value={report.flagged} color="text-orange-400" border="border-orange-900/40" sub="needs human decision" />
                <StatCard label="Skipped" value={report.skipped} color="text-gray-500" sub="exact duplicates" />
                <StatCard label="Errors" value={report.errors} color={report.errors > 0 ? "text-red-400" : "text-gray-600"} />
              </div>
            </div>

            {/* Outreach safety */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Outreach Safety Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatCard label="Active Customers"   value={report.activeCustomers}        color="text-purple-400" border="border-purple-900/40" sub="hands off — clients" />
                <StatCard label="Safe for Outreach"  value={report.safeForOutreach}         color="text-green-400"  border="border-green-900/40"  sub="never contacted" />
                <StatCard label="Suppressed"         value={report.suppressedFromOutreach}  color="text-amber-400"  border="border-amber-900/40"  sub="active convo / DNC / lost" />
                <StatCard label="Do Not Contact"     value={report.doNotContact}            color="text-red-400"    border="border-red-900/40"    sub="permanent block" />
                <StatCard label="Needs Manual Review" value={report.requiresManualReview}   color="text-orange-400" border="border-orange-900/40" sub="resolve before outreach" />
              </div>
            </div>

            {/* Suppression breakdown bars */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Outreach Safety Breakdown</h3>
              {[
                { label: "Active customers (blocked)",     value: report.activeCustomers,       total: report.totalBusinesses, color: "bg-purple-500" },
                { label: "Safe for initial outreach",      value: report.safeForOutreach,        total: report.totalBusinesses, color: "bg-green-500"  },
                { label: "Suppressed (various reasons)",   value: report.suppressedFromOutreach, total: report.totalBusinesses, color: "bg-amber-500"  },
                { label: "Do not contact",                 value: report.doNotContact,           total: report.totalBusinesses, color: "bg-red-500"    },
              ].map((row) => {
                const pct = report.totalBusinesses > 0 ? Math.round((row.value / report.totalBusinesses) * 100) : 0;
                return (
                  <div key={row.label} className="flex items-center gap-3 mb-3">
                    <span className="text-xs text-gray-500 w-56 shrink-0">{row.label}</span>
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`${row.color} h-full rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-20 text-right">{row.value} <span className="text-gray-600">({pct}%)</span></span>
                  </div>
                );
              })}
            </div>

            {/* Import log preview */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Import Log (Business Records)</h3>
                <span className="text-xs text-gray-600">{importedBizRecords.length} total</span>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {report.records.filter((r) => r.type === "business").map((rec) => (
                  <div key={rec.id} className="flex items-start gap-3 py-2 border-b border-gray-800 last:border-0">
                    <RecordBadge status={rec.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium">{rec.name ?? "—"}</p>
                      {rec.reason && <p className="text-xs text-gray-500 mt-0.5 truncate">{rec.reason}</p>}
                    </div>
                    {rec.legacyId && (
                      <span className="text-xs text-gray-700 shrink-0">#{rec.legacyId}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Business Registry ────────────────────────────────────────── */}
        {tab === "businesses" && (
          <div>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                placeholder="Search by name, city, phone, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                {["active_customer","replied","interested","intake_sent","contacted","not_contacted","scraped","closed_lost","do_not_contact","booked"].map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outreach Decision</th>
                      <th className="px-4 py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBiz.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-600 text-sm">
                          No businesses match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredBiz.map((biz) => <BusinessRow key={biz.id} biz={biz} />)
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-600 flex justify-between">
                <span>{filteredBiz.length} of {businesses.length} businesses</span>
                <span>Click any row to expand suppression details</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Duplicates & Flags ────────────────────────────────────────── */}
        {tab === "flags" && (
          <div>
            {flaggedRecords.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-gray-400 font-medium">No duplicates requiring manual review</p>
                <p className="text-gray-600 text-sm mt-1">All high-confidence matches were auto-merged.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-4 text-sm text-amber-300">
                  ⚠ The following {flaggedRecords.length} records were flagged as possible duplicates.
                  Review and either merge or mark as separate before allowing outreach.
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Incoming Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Match Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matched On</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flaggedRecords.map((rec) => (
                        <tr key={rec.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-white">{rec.name ?? "—"}</p>
                            <p className="text-xs text-gray-600">Legacy #{rec.legacyId}</p>
                          </td>
                          <td className="px-4 py-3"><RecordBadge status={rec.status} /></td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              rec.dedupe?.confidence === "high"   ? "bg-green-900/30 text-green-400"  :
                              rec.dedupe?.confidence === "medium" ? "bg-amber-900/30 text-amber-400"  :
                                                                     "bg-gray-800 text-gray-400"
                            }`}>
                              {rec.dedupe?.confidence ?? "unknown"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {rec.dedupe?.matchedOn?.join(", ") ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                            <p className="truncate">{rec.reason}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              <button
                                disabled
                                className="text-xs px-2 py-1 bg-blue-900/30 text-blue-400 rounded cursor-not-allowed"
                                title="Requires DB wiring"
                              >
                                Merge
                              </button>
                              <button
                                disabled
                                className="text-xs px-2 py-1 bg-gray-800 text-gray-500 rounded cursor-not-allowed"
                                title="Requires DB wiring"
                              >
                                Keep Both
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Outreach History ─────────────────────────────────────────── */}
        {tab === "outreach" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent At</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {outreach.map((o) => (
                    <tr key={o.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{o.businessId}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          o.channel === "sms"   ? "bg-blue-900/30 text-blue-400"   :
                          o.channel === "email" ? "bg-purple-900/30 text-purple-400" : "bg-gray-800 text-gray-400"
                        }`}>{o.channel}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          o.status === "replied"   ? "bg-green-900/30 text-green-400"  :
                          o.status === "delivered" ? "bg-teal-900/30 text-teal-400"    :
                          o.status === "failed"    ? "bg-red-900/30 text-red-400"      : "bg-gray-800 text-gray-400"
                        }`}>{o.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {o.sentAt ? new Date(o.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">
                        {o.subject ? <span className="text-gray-300 font-medium">{o.subject} · </span> : null}
                        {o.body?.slice(0, 80)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-600">
              {outreach.length} outreach events imported from Replit
            </div>
          </div>
        )}

        {/* ── Tab: Conversations ────────────────────────────────────────────── */}
        {tab === "conversations" && (
          <div className="space-y-4">
            {conversations.map((conv) => (
              <div key={conv.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Business: {conv.businessId}</p>
                    <p className="text-xs text-gray-500">
                      Phone: {conv.phone ?? "—"} ·
                      {conv.messageCount} message{conv.messageCount !== 1 ? "s" : ""} ·
                      Last: {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    conv.status === "active"  ? "bg-green-900/30 text-green-400" :
                    conv.status === "closed"  ? "bg-gray-800 text-gray-500"       :
                    conv.status === "replied" ? "bg-blue-900/30 text-blue-400"    : "bg-gray-800 text-gray-400"
                  }`}>{conv.status}</span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {conv.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === "inbound" ? "justify-start" : "justify-end"}`}
                    >
                      <div className={`max-w-xs px-3 py-2 rounded-xl text-xs ${
                        msg.direction === "inbound"
                          ? "bg-gray-800 text-gray-200"
                          : "bg-blue-700 text-white"
                      }`}>
                        <p>{msg.body}</p>
                        <p className={`text-[10px] mt-1 ${msg.direction === "inbound" ? "text-gray-600" : "text-blue-300"}`}>
                          {msg.sentAt ? new Date(msg.sentAt).toLocaleString() : ""} · {msg.direction}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {conversations.length === 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-600">
                No conversation records imported.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
