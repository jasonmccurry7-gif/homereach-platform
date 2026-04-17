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
  const days = Math.floor(ms / 86400000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

export default function RepliesPage() {
  const [leads,   setLeads]   = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agent/replies")
      .then(r => r.json())
      .then(d => setLeads(d.leads ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Sort: leads replied in last 4h first (hot), then by recency
  const hot    = leads.filter(l => l.last_reply_at && Date.now() - new Date(l.last_reply_at).getTime() < 4 * 3600000);
  const others = leads.filter(l => !hot.includes(l));

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4">
        <h1 className="text-2xl font-bold">Replies</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {loading ? "Loading…" : `${leads.length} waiting for you`}
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
          <p className="text-4xl mb-3">✅</p>
          <p>All caught up! No replies waiting.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Hot replies */}
          {hot.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">🔥 Hot — Replied within 4 hours</p>
              <div className="space-y-2">
                {hot.map(lead => (
                  <ReplyCard key={lead.id} lead={lead} hot />
                ))}
              </div>
            </div>
          )}

          {/* Older replies */}
          {others.length > 0 && (
            <div>
              {hot.length > 0 && (
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Earlier</p>
              )}
              <div className="space-y-2">
                {others.map(lead => (
                  <ReplyCard key={lead.id} lead={lead} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReplyCard({ lead, hot }: { lead: Lead; hot?: boolean }) {
  return (
    <Link
      href={`/agent/replies/${lead.id}`}
      className={`block rounded-xl p-4 active:opacity-80 transition-opacity ${
        hot
          ? "bg-red-900/20 border border-red-700/50"
          : "bg-gray-900 border border-gray-800"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white truncate">
            {hot && "🔥 "}{lead.business_name}
          </p>
          <p className="text-sm text-gray-400 truncate mt-0.5">{lead.city} · {lead.category}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="text-xs bg-red-700 text-red-100 px-2 py-0.5 rounded-full">Reply</span>
          {lead.last_reply_at && (
            <p className="text-xs text-gray-500 mt-1">{timeAgo(lead.last_reply_at)}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
