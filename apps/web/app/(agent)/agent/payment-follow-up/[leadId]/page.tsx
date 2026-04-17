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
  created_at: string;
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
  is_hot: boolean;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
    hour12: true,
  });
}

function timeAgo(iso: string) {
  const ms   = Date.now() - new Date(iso).getTime();
  const hrs  = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (hrs  < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

export default function PaymentFollowUpPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const router     = useRouter();

  const [data,    setData]    = useState<LeadDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [logged,  setLogged]  = useState(false);

  const load = async () => {
    const res  = await fetch(`/api/agent/leads/${leadId}`);
    const json = await res.json();
    setData(json);
  };

  useEffect(() => {
    if (!leadId) return;
    load().finally(() => setLoading(false));
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
      setLogged(true);
      await load();
    } catch { /* silent */ }
    finally { setLogging(false); }
  };

  if (loading) return (
    <div className="p-4 pt-8 space-y-3 animate-pulse">
      <div className="h-6 bg-gray-800 rounded w-1/3" />
      <div className="h-8 bg-gray-800 rounded w-2/3" />
      <div className="h-32 bg-gray-900 rounded-xl" />
    </div>
  );

  if (!data) return (
    <div className="p-4 pt-12 text-center text-gray-400">
      <p>Lead not found</p>
      <button onClick={() => router.back()} className="mt-4 text-blue-400 text-sm">← Go back</button>
    </div>
  );

  const { lead, events } = data;

  // Find when payment link was sent
  const paymentEvent = events.find(e => e.event_type === "payment_link_sent");
  const daysSincePayment = paymentEvent
    ? Math.floor((Date.now() - new Date(paymentEvent.created_at).getTime()) / 86400000)
    : null;

  const urgency = daysSincePayment !== null
    ? daysSincePayment >= 3 ? "critical" : daysSincePayment >= 1 ? "high" : "medium"
    : "medium";

  return (
    <div className="p-4 space-y-4 pb-8">
      <button onClick={() => router.back()} className="text-blue-400 text-sm pt-4 block">← Back</button>

      {/* Header */}
      <div>
        <p className="text-xs text-yellow-400 font-semibold uppercase tracking-wider mb-1">💳 Payment Follow-Up</p>
        <h1 className="text-xl font-bold">{lead.business_name}</h1>
        <p className="text-gray-400 text-sm">{lead.city}, {lead.state} · {lead.category}</p>
      </div>

      {/* Status card */}
      <div className={`rounded-xl p-4 border ${
        urgency === "critical" ? "bg-red-900/20 border-red-700" :
        urgency === "high"     ? "bg-orange-900/20 border-orange-700" :
                                 "bg-yellow-900/20 border-yellow-700"
      }`}>
        <p className={`font-semibold text-sm ${
          urgency === "critical" ? "text-red-300" :
          urgency === "high"     ? "text-orange-300" :
                                   "text-yellow-300"
        }`}>
          {urgency === "critical" ? "⚠️ Overdue — Follow up now" :
           urgency === "high"     ? "🔔 Follow up recommended" :
                                    "💬 Payment link sent"}
        </p>
        {paymentEvent && (
          <p className="text-gray-400 text-sm mt-1">
            Payment link sent {timeAgo(paymentEvent.created_at)} · {formatTime(paymentEvent.created_at)}
          </p>
        )}
        {daysSincePayment !== null && (
          <p className="text-gray-400 text-sm">
            {daysSincePayment === 0 ? "Sent today" : `${daysSincePayment} day${daysSincePayment !== 1 ? "s" : ""} since link sent`}
          </p>
        )}
      </div>

      {/* Success state */}
      {logged && (
        <div className="bg-emerald-900/30 border border-emerald-600 rounded-xl p-4 text-center">
          <p className="text-emerald-300 font-semibold">✅ Action logged!</p>
        </div>
      )}

      {/* Actions */}
      <div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Log Follow-Up</p>
        <div className="space-y-2">
          <button
            onClick={() => logAction("text_sent", "Payment follow-up text sent")}
            disabled={logging}
            className="w-full flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm text-gray-200 active:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <span className="text-xl">💬</span>
            <div className="text-left">
              <p className="font-medium">Sent Follow-Up Text</p>
              <p className="text-xs text-gray-400">Log that you texted about payment</p>
            </div>
          </button>
          <button
            onClick={() => logAction("email_sent", "Payment follow-up email sent")}
            disabled={logging}
            className="w-full flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm text-gray-200 active:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <span className="text-xl">✉️</span>
            <div className="text-left">
              <p className="font-medium">Sent Follow-Up Email</p>
              <p className="text-xs text-gray-400">Log that you emailed about payment</p>
            </div>
          </button>
          <button
            onClick={() => logAction("payment_link_sent", "New payment link sent")}
            disabled={logging}
            className="w-full flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm text-gray-200 active:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <span className="text-xl">🔗</span>
            <div className="text-left">
              <p className="font-medium">Resent Payment Link</p>
              <p className="text-xs text-gray-400">Sent a new payment link</p>
            </div>
          </button>
          <button
            onClick={() => logAction("deal_closed", "Payment received — deal closed")}
            disabled={logging}
            className="w-full flex items-center gap-3 bg-emerald-900/30 border border-emerald-700 rounded-xl p-4 text-sm text-emerald-200 active:bg-emerald-900/50 transition-colors disabled:opacity-50"
          >
            <span className="text-xl">🎉</span>
            <div className="text-left">
              <p className="font-medium">Payment Received — Close Deal</p>
              <p className="text-xs text-emerald-400">Mark this lead as closed</p>
            </div>
          </button>
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
    </div>
  );
}
