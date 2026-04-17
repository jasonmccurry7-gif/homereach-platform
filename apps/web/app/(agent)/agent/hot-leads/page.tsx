"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Lead {
  id: string;
  business_name: string;
  city: string;
  category: string;
  status: string;
  last_reply_at?: string;
}

function timeAgo(iso: string) {
  const ms   = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  const hrs  = Math.floor(ms / 3600000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${hrs}h ago`;
}

const STATUS_BADGE: Record<string, string> = {
  replied:    "bg-red-700 text-red-100",
  interested: "bg-orange-700 text-orange-100",
};

export default function HotLeadsPage() {
  const [leads,   setLeads]   = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hot leads: replied or interested, replied within 4h
    fetch("/api/agent/leads?status=replied&limit=50")
      .then(r => r.json())
      .then(d => {
        const all = d.leads ?? [];
        // Also fetch interested
        return fetch("/api/agent/leads?status=interested&limit=50")
          .then(r2 => r2.json())
          .then(d2 => {
            const combined = [...all, ...(d2.leads ?? [])];
            // Filter to last 4 hours
            const hot = combined.filter(l =>
              l.last_reply_at &&
              Date.now() - new Date(l.last_reply_at).getTime() < 4 * 3600000
            );
            // Sort by recency
            hot.sort((a, b) =>
              new Date(b.last_reply_at!).getTime() - new Date(a.last_reply_at!).getTime()
            );
            setLeads(hot);
          });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4">
        <h1 className="text-2xl font-bold">🔥 Hot Leads</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {loading ? "Loading…" : `${leads.length} leads with recent activity`}
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">🌡️</p>
          <p className="font-medium text-gray-400">No hot leads right now</p>
          <p className="text-sm mt-1">Leads with replies in the last 4 hours appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map(lead => (
            <Link
              key={lead.id}
              href={`/agent/leads/${lead.id}`}
              className="block bg-red-900/20 border border-red-700/50 rounded-xl p-4 active:bg-red-900/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">🔥 {lead.business_name}</p>
                  <p className="text-sm text-gray-400 truncate mt-0.5">{lead.city} · {lead.category}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[lead.status] ?? "bg-gray-700 text-gray-100"}`}>
                    {lead.status}
                  </span>
                  {lead.last_reply_at && (
                    <p className="text-xs text-gray-500 mt-1">{timeAgo(lead.last_reply_at)}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-600 text-center pb-4">
        Showing leads with replies in the last 4 hours
      </p>
    </div>
  );
}
