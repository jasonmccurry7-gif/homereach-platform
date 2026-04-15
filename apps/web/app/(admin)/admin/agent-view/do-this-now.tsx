"use client";

import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// DO THIS NOW — Revenue Priority Engine
// The top module. Shows 3–8 actions ranked by revenue likelihood.
// Dynamically reprioritizes every 2 minutes.
// ─────────────────────────────────────────────────────────────────────────────

interface PriorityAction {
  id:               string;
  lead_id:          string;
  business_name:    string;
  city:             string;
  category:         string;
  phone:            string | null;
  email:            string | null;
  action_type:      string;
  what_to_do:       string;
  why_it_matters:   string;
  urgency:          "critical" | "high" | "medium";
  revenue_potential: string;
  priority_score:   number;
  cta_label:        string;
  cta_action:       string;
  last_event_at:    string | null;
}

const URGENCY_STYLES: Record<string, string> = {
  critical: "border-red-500/60 bg-red-900/10",
  high:     "border-amber-500/60 bg-amber-900/10",
  medium:   "border-blue-500/40 bg-blue-900/10",
};

const URGENCY_BADGE: Record<string, string> = {
  critical: "bg-red-500 text-white",
  high:     "bg-amber-500 text-black",
  medium:   "bg-blue-600 text-white",
};

const URGENCY_LABEL: Record<string, string> = {
  critical: "🚨 CRITICAL",
  high:     "⚡ HIGH",
  medium:   "📋 MEDIUM",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d >= 1) return `${d}d ago`;
  if (h >= 1) return `${h}h ago`;
  return "just now";
}

export default function DoThisNow({
  agentId,
  onAction,
}: {
  agentId:  string;
  onAction: (action: PriorityAction) => void;
}) {
  const [actions,  setActions]  = useState<PriorityAction[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/sales/priority-actions?agent_id=${agentId}`);
      const data = await res.json();
      setActions(data.actions ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 120_000); // refresh every 2 min
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 animate-pulse">
      <p className="text-sm text-gray-600">Loading priority actions…</p>
    </div>
  );

  if (actions.length === 0) return (
    <div className="rounded-2xl border border-green-800/40 bg-green-900/10 p-5 text-center">
      <p className="text-2xl mb-2">✅</p>
      <p className="text-green-400 font-bold text-sm">All caught up!</p>
      <p className="text-gray-500 text-xs mt-1">No urgent actions right now. Work your call list.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-white font-black text-lg">⚡ DO THIS NOW</h2>
          <p className="text-xs text-gray-500">{actions.length} revenue actions ranked by close probability</p>
        </div>
        <button onClick={load} className="text-xs text-gray-600 hover:text-gray-300">↻ Refresh</button>
      </div>

      {/* Action cards */}
      {actions.map((action, i) => (
        <div
          key={action.id}
          className={`rounded-xl border transition-all ${URGENCY_STYLES[action.urgency]}`}
        >
          {/* Collapsed row */}
          <button
            className="w-full text-left px-4 py-3 flex items-center gap-3"
            onClick={() => setExpanded(expanded === action.id ? null : action.id)}
          >
            {/* Rank */}
            <span className={`shrink-0 w-6 h-6 rounded-full text-xs font-black flex items-center justify-center ${
              i === 0 ? "bg-red-500 text-white" : i === 1 ? "bg-amber-500 text-black" : "bg-gray-700 text-gray-300"
            }`}>{i + 1}</span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{action.what_to_do}</p>
              <p className="text-xs text-gray-400 truncate">{action.business_name} · {action.city} · {action.category}</p>
            </div>

            {/* Urgency badge */}
            <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${URGENCY_BADGE[action.urgency]}`}>
              {URGENCY_LABEL[action.urgency]}
            </span>
          </button>

          {/* Expanded */}
          {expanded === action.id && (
            <div className="px-4 pb-4 border-t border-gray-800/50 pt-3 space-y-3">
              {/* Why it matters */}
              <p className="text-xs text-gray-300 italic">"{action.why_it_matters}"</p>

              {/* Revenue + time */}
              <div className="flex gap-4 text-xs">
                <span className="text-emerald-400 font-semibold">💰 {action.revenue_potential}</span>
                {action.last_event_at && (
                  <span className="text-gray-500">Last contact: {timeAgo(action.last_event_at)}</span>
                )}
              </div>

              {/* CTA */}
              <div className="flex gap-2 flex-wrap">
                {action.phone && (
                  <a
                    href={`tel:${action.phone}`}
                    onClick={() => onAction(action)}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition"
                  >
                    📞 {action.cta_label}
                  </a>
                )}
                {!action.phone && action.email && (
                  <button
                    onClick={() => onAction(action)}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition"
                  >
                    📧 {action.cta_label}
                  </button>
                )}
                {!action.phone && !action.email && (
                  <button
                    onClick={() => onAction(action)}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition"
                  >
                    {action.cta_label}
                  </button>
                )}
                <button
                  onClick={() => setExpanded(null)}
                  className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2 rounded-xl border border-gray-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
