"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

interface Lead {
  id: string;
  business_name: string;
  city: string;
  category: string;
  status: string;
  last_reply_at?: string;
  assigned_agent_id?: string;
}

interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  queued:       "Queued",
  contacted:    "Contacted",
  replied:      "Replied",
  interested:   "Interested",
  payment_sent: "Payment Sent",
  closed:       "Closed",
};

const STATUS_BADGE: Record<string, string> = {
  replied:      "bg-red-700 text-red-100",
  interested:   "bg-orange-700 text-orange-100",
  payment_sent: "bg-yellow-700 text-yellow-100",
  contacted:    "bg-blue-800 text-blue-100",
  queued:       "bg-gray-700 text-gray-100",
  closed:       "bg-emerald-800 text-emerald-100",
};

const FILTERS = [
  { label: "All",          value: "all" },
  { label: "Replies",      value: "replied" },
  { label: "Interested",   value: "interested" },
  { label: "Payment",      value: "payment_sent" },
  { label: "Contacted",    value: "contacted" },
  { label: "Closed",       value: "closed" },
];

function timeAgo(iso: string) {
  const ms   = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  const hrs  = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hrs  < 24)  return `${hrs}h ago`;
  return `${days}d ago`;
}

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const statusFilter = searchParams.get("status") ?? "all";

  const [data,    setData]    = useState<LeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);

  const load = useCallback(async (status: string, p: number) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/agent/leads?status=${status}&page=${p}&limit=25`);
      const json = await res.json();
      setData(prev =>
        p === 1 ? json : prev ? { ...json, leads: [...prev.leads, ...json.leads] } : json
      );
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setPage(1);
    load(statusFilter, 1);
  }, [statusFilter, load]);

  const handleFilter = (value: string) => {
    router.push(`/agent/leads?status=${value}`);
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    load(statusFilter, next);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="pt-4">
        <h1 className="text-2xl font-bold">Leads</h1>
        {data && <p className="text-gray-400 text-sm mt-0.5">{data.total} total</p>}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => handleFilter(f.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              statusFilter === f.value
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lead list */}
      {loading && page === 1 ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : (data?.leads ?? []).length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">📭</p>
          <p>No leads in this category</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(data?.leads ?? []).map(lead => {
            const isHot = lead.status === "replied" &&
              lead.last_reply_at &&
              (Date.now() - new Date(lead.last_reply_at).getTime()) < 4 * 3600000;

            return (
              <Link
                key={lead.id}
                href={`/agent/leads/${lead.id}`}
                className={`block rounded-xl p-4 active:opacity-80 transition-opacity ${
                  isHot
                    ? "bg-red-900/20 border border-red-700/50"
                    : "bg-gray-900 border border-gray-800"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isHot && <span className="text-sm">🔥</span>}
                      <p className="font-semibold text-white truncate">{lead.business_name}</p>
                    </div>
                    <p className="text-sm text-gray-400 truncate mt-0.5">{lead.city} · {lead.category}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[lead.status] ?? "bg-gray-700 text-gray-100"}`}>
                      {STATUS_LABEL[lead.status] ?? lead.status}
                    </span>
                    {lead.last_reply_at && (
                      <p className="text-xs text-gray-500">{timeAgo(lead.last_reply_at)}</p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}

          {data?.has_more && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="w-full py-3 text-sm text-blue-400 bg-gray-900 border border-gray-800 rounded-xl"
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
