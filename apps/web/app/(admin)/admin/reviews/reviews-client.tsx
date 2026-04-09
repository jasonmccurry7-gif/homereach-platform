"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Reviews Admin Dashboard — Client Component
//
// Shows: overview stats, filterable request table, timing rules reference,
// message template preview, and review config panel.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { ReviewRequest, ReviewStats, ReviewStatus, ReviewTriggerEvent } from "@/lib/review/types";
import { ReviewEngine }        from "@/lib/review/review-engine";
import { REVIEW_TIMING_RULES } from "@/lib/review/review-config";
import { getAllMessageTypes, renderMessage } from "@/lib/review/message-templates";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ReviewsClientProps {
  requests: ReviewRequest[];
  stats:    ReviewStats;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color = "text-white",
}: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReviewStatus }) {
  const meta = ReviewEngine.getStatusMeta(status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meta.color} ${meta.bg}`}>
      {meta.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Channel Badge
// ─────────────────────────────────────────────────────────────────────────────

function ChannelBadge({ channel }: { channel: string }) {
  const map: Record<string, string> = {
    sms:   "bg-blue-900/30 text-blue-400",
    email: "bg-purple-900/30 text-purple-400",
    both:  "bg-teal-900/30 text-teal-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[channel] ?? "bg-gray-800 text-gray-400"}`}>
      {channel.toUpperCase()}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger Badge
// ─────────────────────────────────────────────────────────────────────────────

function TriggerBadge({ event }: { event: ReviewTriggerEvent }) {
  const meta = ReviewEngine.getTriggerMeta(event);
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
      {meta.icon} {meta.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Row
// ─────────────────────────────────────────────────────────────────────────────

function RequestRow({ req }: { req: ReviewRequest }) {
  const [expanded, setExpanded] = useState(false);

  function fmt(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <>
      <tr
        className="border-b border-gray-800 hover:bg-gray-900/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">{req.businessName}</span>
            <span className="text-xs text-gray-500">{req.contactName}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <TriggerBadge event={req.triggerEvent} />
        </td>
        <td className="px-4 py-3">
          <ChannelBadge channel={req.channel} />
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={req.status} />
        </td>
        <td className="px-4 py-3 text-xs text-gray-400">{fmt(req.sentAt)}</td>
        <td className="px-4 py-3 text-xs text-gray-400">{fmt(req.reviewRequestSentAt)}</td>
        <td className="px-4 py-3 text-xs text-gray-400">
          {req.status === "completed" ? (
            <span className="text-green-400 font-medium">{fmt(req.completedAt)}</span>
          ) : req.status === "declined" ? (
            <span className="text-gray-600">—</span>
          ) : (
            <span className="text-gray-600">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 text-center">{req.reminderCount}</td>
        <td className="px-4 py-3 text-xs text-gray-600 text-right">{expanded ? "▲" : "▼"}</td>
      </tr>

      {expanded && (
        <tr className="bg-gray-900/80 border-b border-gray-800">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">

              {/* Contact Details */}
              <div className="space-y-1">
                <p className="text-gray-500 uppercase tracking-wider font-medium mb-2">Contact</p>
                {req.phone && (
                  <p className="text-gray-300">📞 {req.phone}</p>
                )}
                {req.email && (
                  <p className="text-gray-300">✉️ {req.email}</p>
                )}
                {req.agentId && (
                  <p className="text-gray-500">Agent: {req.agentId}</p>
                )}
                {req.leadId && (
                  <p className="text-gray-500">Lead: {req.leadId}</p>
                )}
              </div>

              {/* Timing */}
              <div className="space-y-1">
                <p className="text-gray-500 uppercase tracking-wider font-medium mb-2">Timeline</p>
                <p className="text-gray-400">Created: {fmt(req.createdAt)}</p>
                {req.scheduledFor && (
                  <p className="text-gray-400">Scheduled: {fmt(req.scheduledFor)}</p>
                )}
                {req.sentAt && (
                  <p className="text-gray-400">Check Sent: {fmt(req.sentAt)}</p>
                )}
                {req.reviewRequestSentAt && (
                  <p className="text-gray-400">Link Sent: {fmt(req.reviewRequestSentAt)}</p>
                )}
                {req.completedAt && (
                  <p className="text-green-400">Completed: {fmt(req.completedAt)}</p>
                )}
                {req.declinedAt && (
                  <p className="text-gray-500">Declined: {fmt(req.declinedAt)}</p>
                )}
              </div>

              {/* Satisfaction + Feedback */}
              <div className="space-y-1">
                <p className="text-gray-500 uppercase tracking-wider font-medium mb-2">Response</p>
                {req.satisfactionResponse && (
                  <p className={req.satisfactionResponse === "positive"
                    ? "text-green-400"
                    : req.satisfactionResponse === "negative"
                    ? "text-orange-400"
                    : "text-gray-500"
                  }>
                    Satisfaction: {req.satisfactionResponse === "positive" ? "✅ Positive" : req.satisfactionResponse === "negative" ? "⚠ Negative" : "No Response"}
                  </p>
                )}
                {req.internalFeedback && (
                  <div className="mt-2 p-2 bg-orange-900/20 border border-orange-800/40 rounded">
                    <p className="text-orange-300 font-medium mb-1">Internal Feedback:</p>
                    <p className="text-gray-300 italic">"{req.internalFeedback}"</p>
                  </div>
                )}
                <p className="text-gray-500">Platform: {req.reviewPlatform}</p>
                <p className="text-gray-500">Reminders sent: {req.reminderCount}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Funnel Bar
// ─────────────────────────────────────────────────────────────────────────────

function FunnelBar({
  label, value, total, color,
}: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-40 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-800 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-16 text-right">{value} <span className="text-gray-600">({pct}%)</span></span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Preview Panel
// ─────────────────────────────────────────────────────────────────────────────

function MessagePreviewPanel() {
  const types = getAllMessageTypes();
  const [selectedType, setSelectedType] = useState(types[0]);
  const [channel, setChannel] = useState<"sms" | "email">("sms");

  const previewVars = {
    firstName:    "Greg",
    businessName: "Townsend HVAC",
    agentName:    "The HomeReach Team",
    reviewLink:   "https://g.page/r/homereach/review",
    companyPhone: "(330) 867-4200",
  };

  const variants = [0, 1, 2];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-white mb-4">Message Template Preview</h3>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedType === t
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-gray-300"
              }`}
            >
              {t.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {(["sms", "email"] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => setChannel(ch)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                channel === ch
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-gray-300"
              }`}
            >
              {ch.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Variants */}
      <div className="space-y-3">
        {variants.map((vi) => {
          const msg = renderMessage(selectedType, channel, previewVars, vi);
          if (!msg) return null;
          return (
            <div key={vi} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">Variant {vi + 1}</span>
                {channel === "email" && msg.subject && (
                  <span className="text-xs text-blue-400 font-medium">Subject: {msg.subject}</span>
                )}
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{msg.body}</p>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-600 mt-3">
        Preview uses sample data: Greg from Townsend HVAC. Real messages fill in actual client details.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timing Rules Reference
// ─────────────────────────────────────────────────────────────────────────────

function TimingRulesPanel() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-white mb-4">Review Trigger Timing</h3>
      <div className="space-y-3">
        {REVIEW_TIMING_RULES.map((rule) => (
          <div key={rule.triggerEvent} className="flex items-start gap-3 py-3 border-b border-gray-800 last:border-0">
            <span className="text-xl mt-0.5">{rule.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">{rule.label}</p>
                <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded shrink-0">
                  {rule.delayHours}h delay
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
              <div className="flex gap-1 mt-1">
                {rule.channels.map((ch) => (
                  <span key={ch} className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">
                    {ch}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────

type ActiveTab = "requests" | "templates" | "config";
type StatusFilter = "all" | ReviewStatus;

export function ReviewsClient({ requests, stats }: ReviewsClientProps) {
  const [tab, setTab]               = useState<ActiveTab>("requests");
  const [statusFilter, setFilter]   = useState<StatusFilter>("all");
  const [search, setSearch]         = useState("");

  // ── Filtered requests ─────────────────────────────────────────────────────
  const filtered = requests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.businessName.toLowerCase().includes(q) ||
        r.contactName.toLowerCase().includes(q) ||
        r.phone?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all",                      label: "All" },
    { value: "satisfaction_check_pending", label: "Scheduled" },
    { value: "satisfaction_check_sent",    label: "Check Sent" },
    { value: "review_request_sent",        label: "Link Sent" },
    { value: "completed",                  label: "Completed" },
    { value: "declined",                   label: "Declined" },
    { value: "filtered_negative",          label: "Neg. Routed" },
    { value: "feedback_submitted",         label: "Feedback In" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">⭐ Review Requests</h1>
            <p className="text-sm text-gray-500 mt-1">
              Automated review generation — satisfaction filter → review link → tracking
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-green-400 bg-green-900/20 border border-green-800/40 px-3 py-1.5 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            System Active
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
          <StatCard label="Total Requested"      value={stats.totalRequested} />
          <StatCard label="Checks Sent"          value={stats.satisfactionChecksSent} />
          <StatCard label="Passed Check"         value={stats.passedSatisfactionCheck} color="text-green-400" />
          <StatCard label="Neg. Routed"          value={stats.failedSatisfactionCheck} color="text-orange-400" />
          <StatCard label="Links Sent"           value={stats.reviewRequestsSent} color="text-blue-400" />
          <StatCard label="Completed"            value={stats.reviewsCompleted} color="text-green-400" />
          <StatCard label="Declined"             value={stats.reviewsDeclined} color="text-gray-500" />
          <StatCard
            label="Conversion Rate"
            value={`${stats.conversionRate}%`}
            sub={`${stats.satisfactionPassRate}% pass sat. check`}
            color={stats.conversionRate >= 50 ? "text-green-400" : stats.conversionRate >= 30 ? "text-amber-400" : "text-red-400"}
          />
        </div>

        {/* Funnel */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <h3 className="text-sm font-semibold text-white mb-4">Review Funnel</h3>
          <div className="space-y-3">
            <FunnelBar label="Satisfaction checks sent"   value={stats.satisfactionChecksSent}  total={stats.totalRequested}          color="bg-blue-500" />
            <FunnelBar label="Passed satisfaction check"  value={stats.passedSatisfactionCheck} total={stats.satisfactionChecksSent}  color="bg-teal-500" />
            <FunnelBar label="Review links sent"          value={stats.reviewRequestsSent}       total={stats.passedSatisfactionCheck} color="bg-amber-500" />
            <FunnelBar label="Reviews completed"          value={stats.reviewsCompleted}         total={stats.reviewRequestsSent}      color="bg-green-500" />
          </div>

          {/* Channel + Platform breakdown */}
          <div className="grid grid-cols-2 gap-6 mt-5 pt-5 border-t border-gray-800">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">By Channel</p>
              <div className="space-y-1.5">
                {(["sms", "email", "both"] as const).map((ch) => (
                  <div key={ch} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 capitalize">{ch}</span>
                    <span className="text-gray-300">{stats.byChannel[ch]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">By Platform</p>
              <div className="space-y-1.5">
                {(["google", "facebook", "generic"] as const).map((p) => (
                  <div key={p} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 capitalize">{p}</span>
                    <span className="text-gray-300">{stats.byPlatform[p]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-800">
          {(["requests", "templates", "config"] as ActiveTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t === "requests" ? `Requests (${requests.length})` : t === "templates" ? "Message Templates" : "Configuration"}
            </button>
          ))}
        </div>

        {/* ── Tab: Requests ─────────────────────────────────────────────────── */}
        {tab === "requests" && (
          <div>
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                placeholder="Search by business, contact, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
              <div className="flex flex-wrap gap-1">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      statusFilter === opt.value
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-gray-300"
                    }`}
                  >
                    {opt.label}
                    {opt.value !== "all" && (
                      <span className="ml-1 opacity-60">
                        ({requests.filter((r) => r.status === opt.value).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trigger</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Sent</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Link Sent</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Reminders</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-gray-600 text-sm">
                          No review requests match your filters.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((req) => <RequestRow key={req.id} req={req} />)
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/50 text-xs text-gray-600 flex items-center justify-between">
                <span>{filtered.length} of {requests.length} requests</span>
                <span>Click any row to expand details</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Templates ────────────────────────────────────────────────── */}
        {tab === "templates" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MessagePreviewPanel />
            <TimingRulesPanel />
          </div>
        )}

        {/* ── Tab: Config ───────────────────────────────────────────────────── */}
        {tab === "config" && (
          <div className="space-y-6">
            {/* Review Links */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Review Links</h3>
                <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded">Requires Admin Update</span>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Google Review Link</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value="https://g.page/r/PLACEHOLDER/review"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono"
                    />
                    <button
                      disabled
                      className="px-3 py-2 bg-gray-700 text-gray-500 rounded-lg text-sm cursor-not-allowed"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Replace PLACEHOLDER with your actual Google Place ID before going live.
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Facebook Review Link</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value="https://www.facebook.com/homereach/reviews"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono"
                    />
                    <button
                      disabled
                      className="px-3 py-2 bg-gray-700 text-gray-500 rounded-lg text-sm cursor-not-allowed"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Timing Config */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Timing Settings</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Satisfaction Check Delay", value: "24 hours", note: "After trigger event" },
                  { label: "Review Link Delay",         value: "5 minutes", note: "After positive check" },
                  { label: "Max Reminders",             value: "2 follow-ups", note: "Before marking declined" },
                  { label: "Reminder Interval",         value: "7 days", note: "Between follow-ups" },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                    <p className="text-sm font-medium text-white">{item.value}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Integration Status */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Integration Status</h3>
              <div className="space-y-3">
                {[
                  { name: "Twilio SMS",   status: "pending", note: "Wire up sendSatisfactionCheck() and sendReminder() in review-engine.ts" },
                  { name: "Resend Email", status: "pending", note: "Wire up email delivery in review-engine.ts" },
                  { name: "Webhooks",     status: "pending", note: "markCompleted() needs webhook from Google/Facebook" },
                  { name: "Supabase",     status: "pending", note: "Replace in-memory _requests store with repository pattern" },
                ].map((item) => (
                  <div key={item.name} className="flex items-start gap-3 py-3 border-b border-gray-800 last:border-0">
                    <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-white">{item.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.note}</p>
                    </div>
                    <span className="ml-auto text-xs text-amber-400 bg-amber-900/20 px-2 py-0.5 rounded shrink-0">TODO</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-4">
                All engine logic is production-ready. Integration points are marked with <code className="text-gray-500">TODO</code> comments in <code className="text-gray-500">review-engine.ts</code>.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
