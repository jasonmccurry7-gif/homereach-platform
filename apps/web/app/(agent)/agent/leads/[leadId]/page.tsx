"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Lead {
  id: string;
  business_name: string;
  city: string;
  state: string;
  category: string;
  status: string;
  phone?: string;
  email?: string;
  address?: string;
  assigned_agent_id?: string;
  last_reply_at?: string;
  created_at: string;
}

interface SalesEvent {
  id: string;
  event_type: string;
  notes?: string;
  created_at: string;
  agent_id?: string;
}

interface LeadDetailResponse {
  lead: Lead;
  events: SalesEvent[];
  recommended_action?: string;
  is_hot: boolean;
}

const EVENT_ICONS: Record<string, string> = {
  text_sent:       "💬",
  email_sent:      "✉️",
  reply_received:  "📩",
  call_made:       "📞",
  payment_link_sent: "💳",
  deal_closed:     "🎉",
  note_added:      "📝",
};

const STATUS_BADGE: Record<string, string> = {
  replied:      "bg-red-700 text-red-100",
  interested:   "bg-orange-700 text-orange-100",
  payment_sent: "bg-yellow-700 text-yellow-100",
  contacted:    "bg-blue-800 text-blue-100",
  queued:       "bg-gray-700 text-gray-100",
  closed:       "bg-emerald-800 text-emerald-100",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
    hour12: true,
  });
}

export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const router     = useRouter();
  const [data,    setData]    = useState<LeadDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!leadId) return;
    fetch(`/api/agent/leads/${leadId}`)
      .then(r => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [leadId]);

  const logAction = async (event_type: string, notes?: string) => {
    if (!leadId || logging) return;
    setLogging(true);
    try {
      await fetch("/api/agent/log-action", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lead_id: leadId, event_type, notes }),
      });
      // Refresh data
      const res = await fetch(`/api/agent/leads/${leadId}`);
      const json = await res.json();
      setData(json);
    } catch { /* silent */ }
    finally { setLogging(false); }
  };

  if (loading) return (
    <div className="p-4 space-y-4 animate-pulse pt-8">
      <div className="h-8 bg-gray-800 rounded w-2/3" />
      <div className="h-4 bg-gray-800 rounded w-1/2" />
      <div className="h-32 bg-gray-900 rounded-xl" />
      <div className="h-24 bg-gray-900 rounded-xl" />
    </div>
  );

  if (error || !data) return (
    <div className="p-4 pt-12 text-center text-gray-400">
      <p className="text-4xl mb-3">🚫</p>
      <p>{error ?? "Lead not found"}</p>
      <button onClick={() => router.back()} className="mt-4 text-blue-400 text-sm">← Go back</button>
    </div>
  );

  const { lead, events, recommended_action, is_hot } = data;

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* Back */}
      <button onClick={() => router.back()} className="text-blue-400 text-sm pt-4 block">← Back</button>

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{lead.business_name}</h1>
            <p className="text-gray-400 text-sm">{lead.city}, {lead.state} · {lead.category}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {is_hot && <span className="text-xs bg-red-700 text-red-100 px-2 py-0.5 rounded-full">🔥 HOT</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[lead.status] ?? "bg-gray-700 text-gray-100"}`}>
              {lead.status.replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      {/* Recommended action */}
      {recommended_action && (
        <div className="bg-blue-900/30 border border-blue-600 rounded-xl p-4">
          <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">⚡ Recommended Next Action</p>
          <p className="text-blue-200 text-sm">{recommended_action}</p>
        </div>
      )}

      {/* Contact info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Contact</p>
        {lead.phone && (
          <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-blue-400 text-sm">
            <span>📞</span> {lead.phone}
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-blue-400 text-sm">
            <span>✉️</span> {lead.email}
          </a>
        )}
        {lead.address && (
          <p className="flex items-center gap-2 text-gray-300 text-sm">
            <span>📍</span> {lead.address}
          </p>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Log Action</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Text Sent",    event: "text_sent",         icon: "💬" },
            { label: "Email Sent",   event: "email_sent",        icon: "✉️" },
            { label: "Reply Rcvd",   event: "reply_received",    icon: "📩" },
            { label: "Payment Link", event: "payment_link_sent", icon: "💳" },
          ].map(({ label, event, icon }) => (
            <button
              key={event}
              onClick={() => logAction(event)}
              disabled={logging}
              className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm text-gray-200 active:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity timeline */}
      <div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Activity History</p>
        {events.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-6">No activity yet</p>
        ) : (
          <div className="space-y-3">
            {events.map((ev, idx) => (
              <div key={ev.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-base flex-shrink-0">
                    {EVENT_ICONS[ev.event_type] ?? "📋"}
                  </div>
                  {idx < events.length - 1 && <div className="w-px flex-1 bg-gray-800 mt-1" />}
                </div>
                <div className="pb-3 min-w-0">
                  <p className="text-sm text-gray-200 font-medium">
                    {ev.event_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                  </p>
                  {ev.notes && <p className="text-xs text-gray-400 mt-0.5">{ev.notes}</p>}
                  <p className="text-xs text-gray-600 mt-0.5">{formatTime(ev.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
