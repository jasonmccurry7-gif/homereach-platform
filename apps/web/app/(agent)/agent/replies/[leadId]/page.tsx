"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Lead {
  id: string;
  business_name: string;
  city: string;
  state: string;
  category: string;
  status: string;
  phone?: string;
  email?: string;
  last_reply_at?: string;
}

interface SalesEvent {
  id: string;
  event_type: string;
  notes?: string;
  created_at: string;
}

interface LeadDetailResponse {
  lead: Lead;
  events: SalesEvent[];
  recommended_action?: string;
  is_hot: boolean;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
    hour12: true,
  });
}

const EVENT_ICONS: Record<string, string> = {
  text_sent:         "💬",
  email_sent:        "✉️",
  reply_received:    "📩",
  call_made:         "📞",
  payment_link_sent: "💳",
  deal_closed:       "🎉",
  note_added:        "📝",
};

export default function ReplyDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const router     = useRouter();

  const [data,    setData]    = useState<LeadDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);

  const load = async () => {
    const res  = await fetch(`/api/agent/leads/${leadId}`);
    const json = await res.json();
    setData(json);
  };

  useEffect(() => {
    if (!leadId) return;
    load().finally(() => setLoading(false));
  }, [leadId]);

  const logAction = async (event_type: string) => {
    if (!leadId || logging) return;
    setLogging(true);
    try {
      await fetch("/api/agent/log-action", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lead_id: leadId, event_type }),
      });
      await load();
    } catch { /* silent */ }
    finally { setLogging(false); }
  };

  if (loading) return (
    <div className="p-4 space-y-3 animate-pulse pt-8">
      <div className="h-6 bg-gray-800 rounded w-1/3" />
      <div className="h-8 bg-gray-800 rounded w-2/3" />
      <div className="h-24 bg-gray-900 rounded-xl" />
      <div className="h-32 bg-gray-900 rounded-xl" />
    </div>
  );

  if (!data) return (
    <div className="p-4 pt-12 text-center text-gray-400">
      <p>Lead not found</p>
      <button onClick={() => router.back()} className="mt-4 text-blue-400 text-sm">← Go back</button>
    </div>
  );

  const { lead, events, recommended_action, is_hot } = data;

  // Most recent replies (newest first for context)
  const replies = events.filter(e => e.event_type === "reply_received").slice(0, 5);

  return (
    <div className="p-4 space-y-4 pb-8">
      <button onClick={() => router.back()} className="text-blue-400 text-sm pt-4 block">← Replies</button>

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{lead.business_name}</h1>
            <p className="text-gray-400 text-sm">{lead.city}, {lead.state} · {lead.category}</p>
          </div>
          {is_hot && <span className="text-xs bg-red-700 text-red-100 px-2 py-0.5 rounded-full flex-shrink-0">🔥 HOT</span>}
        </div>
      </div>

      {/* Recommended action */}
      {recommended_action && (
        <div className="bg-blue-900/30 border border-blue-600 rounded-xl p-3">
          <p className="text-xs text-blue-400 font-semibold uppercase mb-1">⚡ Recommended Next Action</p>
          <p className="text-blue-200 text-sm">{recommended_action}</p>
        </div>
      )}

      {/* Recent reply context */}
      {replies.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Recent Replies</p>
          <div className="space-y-3">
            {replies.map(ev => (
              <div key={ev.id} className="border-l-2 border-red-700 pl-3">
                {ev.notes && <p className="text-sm text-gray-200">{ev.notes}</p>}
                <p className="text-xs text-gray-500 mt-0.5">{formatTime(ev.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick log actions */}
      <div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Log Your Response</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Sent Text",      event: "text_sent",         icon: "💬" },
            { label: "Sent Email",     event: "email_sent",        icon: "✉️" },
            { label: "Payment Link",   event: "payment_link_sent", icon: "💳" },
            { label: "Closed Deal",    event: "deal_closed",       icon: "🎉" },
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

      {/* Contact */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Contact</p>
        {lead.phone && (
          <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-blue-400 text-sm">
            📞 {lead.phone}
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-blue-400 text-sm">
            ✉️ {lead.email}
          </a>
        )}
      </div>

      {/* Full history */}
      <div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Full Activity</p>
        <div className="space-y-3">
          {events.map(ev => (
            <div key={ev.id} className="flex gap-3">
              <div className="w-7 h-7 bg-gray-800 rounded-full flex items-center justify-center text-sm flex-shrink-0">
                {EVENT_ICONS[ev.event_type] ?? "📋"}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-200">
                  {ev.event_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                </p>
                {ev.notes && <p className="text-xs text-gray-400 mt-0.5">{ev.notes}</p>}
                <p className="text-xs text-gray-600">{formatTime(ev.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
