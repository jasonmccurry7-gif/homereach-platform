"use client";

import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// DEALS YOU'RE ABOUT TO LOSE
// Surfaces stalled deals with one-click recovery actions.
// ─────────────────────────────────────────────────────────────────────────────

interface AtRiskDeal {
  id: string;
  lead_id: string;
  business_name: string;
  city: string;
  category: string;
  phone: string | null;
  email: string | null;
  risk_type: string;
  risk_label: string;
  stale_since: string;
  recovery_action: string;
  recovery_message: string;
  estimated_value: string;
  days_stale: number;
}

const RISK_COLORS: Record<string, string> = {
  payment_sent_stale:  "border-red-500 bg-red-900/10",
  replied_no_response: "border-red-400 bg-red-900/10",
  interested_stale:    "border-amber-500 bg-amber-900/10",
  contacted_stale:     "border-gray-700 bg-gray-900/50",
};

export default function DealsAtRisk({ agentId, onFlash }: {
  agentId: string;
  onFlash: (msg: string, ok?: boolean) => void;
}) {
  const [deals,     setDeals]    = useState<AtRiskDeal[]>([]);
  const [message,   setMessage]  = useState<string | null>(null);
  const [loading,   setLoading]  = useState(true);
  const [expanded,  setExpanded] = useState<string | null>(null);
  const [sending,   setSending]  = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/admin/sales/at-risk?agent_id=${agentId}`);
      const data = await res.json();
      setDeals(data.at_risk ?? []);
      setMessage(data.message ?? null);
    } catch { /* silent */ }
    setLoading(false);
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  const sendRecovery = async (deal: AtRiskDeal) => {
    setSending(deal.id);
    try {
      const channel = deal.phone ? "sms" : "email";
      await fetch("/api/admin/sales/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id:    agentId,
          lead_id:     deal.lead_id,
          action_type: channel === "sms" ? "text_sent" : "email_sent",
          channel,
          message:     deal.recovery_message,
        }),
      });
      onFlash(`✓ Recovery sent to ${deal.business_name}`);
      setDeals(prev => prev.filter(d => d.id !== deal.id));
    } catch {
      onFlash("Failed to send", false);
    }
    setSending(null);
  };

  if (loading) return null;
  if (deals.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-red-400 font-black text-base">⚠️ Deals You're About to Lose</h2>
        <span className="text-xs text-red-400 font-bold">{deals.length} at risk</span>
      </div>

      {/* Revenue warning */}
      {message && (
        <div className="rounded-xl bg-red-900/20 border border-red-700/40 px-4 py-2.5">
          <p className="text-sm font-bold text-red-300">{message}</p>
        </div>
      )}

      {/* Deal cards */}
      {deals.map(deal => (
        <div
          key={deal.id}
          className={`rounded-xl border transition-all ${RISK_COLORS[deal.risk_type] ?? "border-gray-700 bg-gray-900"}`}
        >
          <button
            className="w-full text-left px-4 py-3 flex items-center gap-3"
            onClick={() => setExpanded(expanded === deal.id ? null : deal.id)}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{deal.business_name}</p>
              <p className="text-xs text-gray-400">{deal.risk_label} · {deal.days_stale}d stale · {deal.city}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-emerald-400 font-semibold">{deal.estimated_value}</p>
            </div>
          </button>

          {expanded === deal.id && (
            <div className="px-4 pb-4 border-t border-gray-700/50 pt-3 space-y-3">
              {/* Recovery message preview */}
              <div className="rounded-lg bg-gray-800 px-3 py-2">
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Recovery message</p>
                <p className="text-xs text-gray-300">{deal.recovery_message}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {deal.phone && (
                  <a href={`tel:${deal.phone}`}
                    className="text-sm bg-green-600 hover:bg-green-500 text-white font-bold px-3 py-1.5 rounded-lg">
                    📞 Call
                  </a>
                )}
                <button
                  onClick={() => sendRecovery(deal)}
                  disabled={sending === deal.id}
                  className="text-sm bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  {sending === deal.id ? "Sending…" : deal.phone ? "📱 Send Text" : "📧 Send Email"}
                </button>
                <button
                  onClick={() => setDeals(prev => prev.filter(d => d.id !== deal.id))}
                  className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 border border-gray-700 rounded-lg"
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
