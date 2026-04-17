"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Scorecard { texts_sent: number; emails_sent: number; replies: number; deals_closed: number; revenue_cents: number; }
interface Lead { id: string; business_name: string; city: string; category: string; status: string; last_reply_at?: string; }
interface Action { id: string; label: string; urgency: string; lead_id: string; deep_link: string; }
interface DashData { agent_id: string; scorecard: Scorecard; hot_leads: Lead[]; replies_waiting: Lead[]; payment_queue: Lead[]; reply_count: number; }

function timeAgo(iso: string) {
  const ms   = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  const hrs  = Math.floor(ms / 3600000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${hrs}h ago`;
}

const STATUS_BADGE: Record<string, string> = {
  replied:      "bg-red-700 text-red-100",
  interested:   "bg-orange-700 text-orange-100",
  payment_sent: "bg-yellow-700 text-yellow-100",
  contacted:    "bg-blue-800 text-blue-100",
  queued:       "bg-gray-700 text-gray-100",
  closed:       "bg-emerald-800 text-emerald-100",
};

export default function AgentHomeClient({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [data,    setData]    = useState<DashData | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const firstName = agentName.split(" ")[0];
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    fetch("/api/agent/dashboard").then(r => r.json()).then(setData).catch(() => {});
    fetch("/api/agent/actions").then(r => r.json()).then(d => setActions(d.actions ?? [])).catch(() => {});
  }, []);

  const sc = data?.scorecard;

  return (
    <div className="p-4 space-y-5">
      {/* Greeting */}
      <div className="pt-4">
        <h1 className="text-2xl font-bold">{greeting}, {firstName} ☀️</h1>
        <p className="text-gray-400 text-sm mt-0.5">Here&apos;s your dashboard</p>
      </div>

      {/* Scorecard */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Today&apos;s Scorecard</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Texts Sent",    value: sc?.texts_sent ?? "—",   color: "text-blue-400" },
            { label: "Emails Sent",   value: sc?.emails_sent ?? "—",  color: "text-purple-400" },
            { label: "Replies",       value: sc?.replies ?? "—",      color: "text-emerald-400" },
            { label: "Deals Closed",  value: sc?.deals_closed ?? "—", color: "text-yellow-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-400">{label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
        {sc && sc.revenue_cents > 0 && (
          <p className="text-emerald-400 font-semibold text-sm mt-3 text-center">
            💰 ${(sc.revenue_cents / 100).toLocaleString()} revenue today
          </p>
        )}
      </div>

      {/* Hot Leads */}
      {(data?.hot_leads ?? []).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">🔥 Hot Leads</p>
            <Link href="/agent/hot-leads" className="text-xs text-blue-400">View all →</Link>
          </div>
          <div className="space-y-2">
            {(data?.hot_leads ?? []).slice(0, 3).map(lead => (
              <Link key={lead.id} href={`/agent/leads/${lead.id}`} className="block bg-red-900/20 border border-red-700/50 rounded-xl p-4 active:bg-red-900/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{lead.business_name}</p>
                    <p className="text-sm text-gray-400">{lead.city} · {lead.category}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs bg-red-700 text-red-100 px-2 py-0.5 rounded-full">🔥 HOT</span>
                    {lead.last_reply_at && <p className="text-xs text-gray-500 mt-1">{timeAgo(lead.last_reply_at)}</p>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Next Actions */}
      {actions.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">⚡ Next Actions</p>
          <div className="space-y-2">
            {actions.slice(0, 3).map(action => (
              <Link key={action.id} href={action.deep_link} className="block bg-gray-900 border border-gray-700 rounded-xl p-4 active:bg-gray-800 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${action.urgency === "critical" ? "bg-red-500" : action.urgency === "high" ? "bg-orange-500" : "bg-amber-500"}`} />
                  <p className="text-sm text-gray-200">{action.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Replies waiting banner */}
      {(data?.reply_count ?? 0) > 0 && (
        <Link href="/agent/replies" className="block bg-blue-900/30 border border-blue-600 rounded-xl p-4 text-center active:bg-blue-900/50 transition-colors">
          <p className="text-blue-300 font-semibold">💬 {data?.reply_count} {data?.reply_count === 1 ? "reply" : "replies"} waiting for you</p>
          <p className="text-blue-400 text-xs mt-0.5">Tap to respond →</p>
        </Link>
      )}
    </div>
  );
}
