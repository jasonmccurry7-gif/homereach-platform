"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface ActivityLead {
  id: string;
  business_name: string;
  city: string;
  category: string;
  status: string;
  last_reply_at?: string;
  created_at: string;
}

interface Scorecard {
  texts_sent:   number;
  emails_sent:  number;
  replies:      number;
  deals_closed: number;
  revenue_cents: number;
}

interface DashData {
  scorecard: Scorecard;
}

const STATUS_BADGE: Record<string, string> = {
  replied:      "bg-red-700 text-red-100",
  interested:   "bg-orange-700 text-orange-100",
  payment_sent: "bg-yellow-700 text-yellow-100",
  contacted:    "bg-blue-800 text-blue-100",
  queued:       "bg-gray-700 text-gray-100",
  closed:       "bg-emerald-800 text-emerald-100",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}

export default function ActivityPage() {
  const [dash,   setDash]   = useState<DashData | null>(null);
  const [leads,  setLeads]  = useState<ActivityLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/agent/dashboard").then(r => r.json()).catch(() => null),
      fetch("/api/agent/leads?status=all&limit=50").then(r => r.json()).catch(() => null),
    ]).then(([dashData, leadsData]) => {
      if (dashData)  setDash(dashData);
      if (leadsData) setLeads(leadsData.leads ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const sc = dash?.scorecard;

  // Count by status
  const statusCounts = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-4 space-y-5">
      <div className="pt-4">
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="text-gray-400 text-sm mt-0.5">Your performance overview</p>
      </div>

      {/* Today's scorecard */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Today&apos;s Scorecard</p>
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-3 animate-pulse h-16" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Texts Sent",   value: sc?.texts_sent   ?? 0, color: "text-blue-400" },
                { label: "Emails Sent",  value: sc?.emails_sent  ?? 0, color: "text-purple-400" },
                { label: "Replies",      value: sc?.replies      ?? 0, color: "text-emerald-400" },
                { label: "Deals Closed", value: sc?.deals_closed ?? 0, color: "text-yellow-400" },
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
          </>
        )}
      </div>

      {/* Pipeline breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Pipeline Breakdown</p>
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {[
              { status: "replied",      label: "Replied",      icon: "📩" },
              { status: "interested",   label: "Interested",   icon: "🤝" },
              { status: "payment_sent", label: "Payment Sent", icon: "💳" },
              { status: "contacted",    label: "Contacted",    icon: "📞" },
              { status: "closed",       label: "Closed",       icon: "✅" },
              { status: "queued",       label: "Queued",       icon: "📋" },
            ].map(({ status, label, icon }) => {
              const count = statusCounts[status] ?? 0;
              const total = leads.length;
              const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <Link key={status} href={`/agent/leads?status=${status}`} className="flex items-center gap-3 py-1">
                  <span className="text-sm w-5">{icon}</span>
                  <span className="text-sm text-gray-300 w-28">{label}</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${STATUS_BADGE[status]?.split(" ")[0] ?? "bg-gray-600"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-400 w-6 text-right">{count}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent leads */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Recent Leads</p>
          <Link href="/agent/leads" className="text-xs text-blue-400">View all →</Link>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-900 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {leads.slice(0, 10).map(lead => (
              <Link
                key={lead.id}
                href={`/agent/leads/${lead.id}`}
                className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl p-3 active:opacity-80"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{lead.business_name}</p>
                  <p className="text-xs text-gray-500">{lead.city} · {formatDate(lead.created_at)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${STATUS_BADGE[lead.status] ?? "bg-gray-700 text-gray-100"}`}>
                  {lead.status.replace("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
