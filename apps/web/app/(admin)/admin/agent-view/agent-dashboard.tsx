"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type SalesLead = {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  facebook_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  score: number;
  priority: "low" | "medium" | "high";
  rating: number | null;
  reviews_count: number;
  buying_signal: boolean;
  status: string;
  notes: string | null;
};

type Channel = "sms" | "email" | "facebook";
type ActionType = "lead_loaded" | "lead_skipped" | "message_sent" | "email_sent" | "text_sent" | "facebook_sent" | "reply_received" | "conversation_started" | "follow_up_sent" | "payment_link_created" | "deal_closed";

type Stats = {
  loaded: number;
  skipped: number;
  sent: number;
  replies: number;
  deals: number;
  revenue: number;
};

type Guidance = { type: string; message: string; priority: "high" | "medium" | "low" };

// ─── Agent Dashboard ──────────────────────────────────────────────────────────
export default function AgentDashboard({ agentId }: { agentId: string }) {
  const [lead, setLead] = useState<SalesLead | null>(null);
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<Channel>("sms");
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<Stats>({ loaded: 0, skipped: 0, sent: 0, replies: 0, deals: 0, revenue: 0 });
  const [guidance, setGuidance] = useState<Guidance[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [filterCity, setFilterCity] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [dealRevenue, setDealRevenue] = useState("200");
  const [showRevenueInput, setShowRevenueInput] = useState(false);
  const [sessionStart] = useState(Date.now());
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // ── Load next lead ──────────────────────────────────────────────────────────
  const loadNextLead = useCallback(async () => {
    setLoading(true);
    setMessage("");
    setShowRevenueInput(false);

    const params = new URLSearchParams({ channel });
    if (filterCity)     params.set("city", filterCity);
    if (filterCategory) params.set("category", filterCategory);

    const res = await fetch(`/api/admin/sales/next-lead?${params}`);
    const data = await res.json();
    setLead(data.lead ?? null);
    setLoading(false);

    if (data.lead) {
      logEvent("lead_loaded", data.lead.id, null, null, null);
      setStats(s => ({ ...s, loaded: s.loaded + 1 }));
    }
  }, [channel, filterCity, filterCategory]);

  // ── Log event ───────────────────────────────────────────────────────────────
  const logEvent = async (
    action_type: ActionType,
    lead_id: string | null,
    ch: Channel | null,
    msg: string | null,
    revenue_cents: number | null,
  ) => {
    if (!agentId) return;
    await fetch("/api/admin/sales/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: agentId,
        lead_id,
        action_type,
        channel: ch ?? channel,
        city:     lead?.city ?? null,
        category: lead?.category ?? null,
        message:  msg,
        revenue_cents,
      }),
    });
  };

  // ── Fetch guidance ──────────────────────────────────────────────────────────
  const fetchGuidance = useCallback(async () => {
    const since = new Date(sessionStart).toISOString();
    const res = await fetch(`/api/admin/sales/insights?since=${since}`);
    const data = await res.json();
    setGuidance(data.guidance ?? []);
  }, [sessionStart]);

  useEffect(() => {
    loadNextLead();
  }, [loadNextLead]);

  useEffect(() => {
    const interval = setInterval(fetchGuidance, 30000);
    fetchGuidance();
    return () => clearInterval(interval);
  }, [fetchGuidance]);

  // ── Show flash ──────────────────────────────────────────────────────────────
  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleSkip = async () => {
    if (lead) {
      await logEvent("lead_skipped", lead.id, null, null, null);
      setStats(s => ({ ...s, skipped: s.skipped + 1 }));
    }
    loadNextLead();
  };

  const handleSend = async () => {
    if (!lead) return;
    const actionMap: Record<Channel, ActionType> = {
      sms:      "text_sent",
      email:    "email_sent",
      facebook: "facebook_sent",
    };
    await logEvent(actionMap[channel], lead.id, channel, message || null, null);
    setStats(s => ({ ...s, sent: s.sent + 1 }));
    showFlash("✓ Message logged");
    fetchGuidance();
    loadNextLead();
  };

  const handleReply = async () => {
    if (!lead) return;
    await logEvent("reply_received", lead.id, channel, null, null);
    await logEvent("conversation_started", lead.id, channel, null, null);
    setStats(s => ({ ...s, replies: s.replies + 1 }));
    showFlash("✓ Reply + conversation logged");
    fetchGuidance();
  };

  const handlePaymentLink = async () => {
    if (!lead) return;
    await logEvent("payment_link_created", lead.id, channel, null, null);
    showFlash("✓ Payment link logged");
    fetchGuidance();
  };

  const handleDealClosed = async () => {
    if (!lead) return;
    const rev = Math.round(parseFloat(dealRevenue || "200") * 100);
    await logEvent("deal_closed", lead.id, channel, null, rev);
    setStats(s => ({ ...s, deals: s.deals + 1, revenue: s.revenue + rev }));
    showFlash(`🎉 DEAL CLOSED — $${dealRevenue}`);
    setShowRevenueInput(false);
    fetchGuidance();
    loadNextLead();
  };

  const handleFollowUp = async () => {
    if (!lead) return;
    await logEvent("follow_up_sent", lead.id, channel, message || null, null);
    showFlash("✓ Follow-up logged");
    loadNextLead();
  };

  // ── Available channels based on lead data ───────────────────────────────────
  const availableChannels: Channel[] = [];
  if (lead?.phone) availableChannels.push("sms");
  if (lead?.email) availableChannels.push("email");
  if (lead?.facebook_url) availableChannels.push("facebook");

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="font-bold text-sm tracking-wide uppercase text-gray-200">HomeReach Sales</span>
        </div>
        {/* Session stats */}
        <div className="flex items-center gap-6 text-xs">
          <Stat label="Loaded"   value={stats.loaded}   color="text-gray-400" />
          <Stat label="Sent"     value={stats.sent}     color="text-blue-400" />
          <Stat label="Replied"  value={stats.replies}  color="text-yellow-400" />
          <Stat label="Deals"    value={stats.deals}    color="text-green-400" />
          <Stat label="Revenue"  value={`$${(stats.revenue/100).toFixed(0)}`} color="text-emerald-400" />
        </div>
      </div>

      {/* Guidance banner */}
      {guidance.length > 0 && (
        <div className="bg-orange-900/40 border-b border-orange-700/50 px-4 py-2">
          <div className="flex items-center gap-3 flex-wrap">
            {guidance.slice(0, 2).map((g, i) => (
              <div key={i} className={`flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full ${
                g.priority === "high" ? "bg-red-500/20 text-red-300 border border-red-500/30" :
                g.priority === "medium" ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30" :
                "bg-blue-500/20 text-blue-300 border border-blue-500/30"
              }`}>
                {g.priority === "high" ? "⚡" : g.priority === "medium" ? "→" : "ℹ"} {g.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flash message */}
      {flash && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-xl shadow-2xl z-50 font-bold text-sm animate-bounce">
          {flash}
        </div>
      )}

      <div className="flex flex-1 gap-0">
        {/* Left: Filters */}
        <div className="w-44 bg-gray-900 border-r border-gray-800 p-3 flex flex-col gap-3">
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Filters</div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">City</label>
            <select
              className="w-full bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 border border-gray-700 focus:outline-none focus:border-blue-500"
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
            >
              <option value="">All Cities</option>
              {["Wooster","Medina","Massillon","Cuyahoga Falls","Ravenna","Green","Stow","Hudson","North Canton","Fairlawn","Twinsburg"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Category</label>
            <select
              className="w-full bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 border border-gray-700 focus:outline-none focus:border-blue-500"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {["Restaurant & Food","Home Services","Health & Wellness","Automotive","Real Estate","Cleaning Services","Junk Removal","Other"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Channel</label>
            <div className="flex flex-col gap-1">
              {(["sms","email","facebook"] as Channel[]).map(ch => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`text-xs px-2 py-1.5 rounded-lg font-medium transition-all ${
                    channel === ch
                      ? ch === "sms" ? "bg-green-600 text-white"
                        : ch === "email" ? "bg-blue-600 text-white"
                        : "bg-indigo-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {ch === "sms" ? "📱 SMS" : ch === "email" ? "📧 Email" : "💬 Facebook"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Lead card */}
        <div className="flex-1 flex flex-col items-center justify-start p-6 gap-4">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-500 text-sm animate-pulse">Loading lead...</div>
            </div>
          ) : !lead ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="text-4xl">🎉</div>
              <div className="text-white font-bold text-xl">Queue empty</div>
              <div className="text-gray-400 text-sm">No more leads match this filter</div>
              <button onClick={loadNextLead} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold text-sm">
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Lead card */}
              <div className="w-full max-w-2xl bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
                {/* Card header */}
                <div className={`px-5 py-4 flex items-start justify-between ${lead.buying_signal ? "bg-gradient-to-r from-emerald-900/60 to-gray-900" : "bg-gray-800/60"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {lead.buying_signal && (
                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2 py-0.5 rounded-full font-bold">🔥 HOT</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        lead.priority === "high" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                        lead.priority === "medium" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                        "bg-gray-700 text-gray-400"
                      }`}>{lead.priority?.toUpperCase()}</span>
                      {lead.status !== "queued" && (
                        <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs px-2 py-0.5 rounded-full">{lead.status}</span>
                      )}
                    </div>
                    <h2 className="text-white font-bold text-xl mt-1 truncate">{lead.business_name}</h2>
                    {lead.contact_name && <p className="text-gray-400 text-sm">{lead.contact_name}</p>}
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <div className="text-2xl font-bold text-white">{lead.score}</div>
                    <div className="text-xs text-gray-500">score</div>
                    {lead.rating && <div className="text-yellow-400 text-xs mt-0.5">⭐ {lead.rating} ({lead.reviews_count})</div>}
                  </div>
                </div>

                {/* Contact details */}
                <div className="px-5 py-3 grid grid-cols-2 gap-2 border-t border-gray-800">
                  <ContactRow icon="📍" label={[lead.city, lead.state].filter(Boolean).join(", ")} />
                  <ContactRow icon="🏷️" label={lead.category ?? "—"} />
                  {lead.phone && <ContactRow icon="📱" label={lead.phone} highlight={channel === "sms"} />}
                  {lead.email && <ContactRow icon="📧" label={lead.email} highlight={channel === "email"} />}
                  {lead.website && <ContactRow icon="🌐" label={lead.website} />}
                  {lead.facebook_url && <ContactRow icon="💬" label="Facebook Profile" highlight={channel === "facebook"} link={lead.facebook_url} />}
                  {lead.address && <ContactRow icon="📌" label={lead.address} />}
                </div>

                {/* Channel availability warning */}
                {availableChannels.length > 0 && !availableChannels.includes(channel) && (
                  <div className="mx-5 mb-3 bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 text-xs px-3 py-2 rounded-lg">
                    ⚠️ This lead has no {channel} contact info.{" "}
                    Switch to {availableChannels.join(" or ")}.
                  </div>
                )}

                {/* Message input */}
                <div className="px-5 pb-4">
                  <textarea
                    ref={messageRef}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={
                      channel === "sms" ? "Type your SMS message (optional — log send without message)" :
                      channel === "email" ? "Email message (optional)" :
                      "FB DM message (optional)"
                    }
                    rows={2}
                    className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2.5 border border-gray-700 focus:outline-none focus:border-blue-500 resize-none placeholder-gray-600"
                  />
                </div>
              </div>

              {/* Primary action buttons */}
              <div className="w-full max-w-2xl grid grid-cols-2 gap-3">
                <button
                  onClick={handleSend}
                  disabled={availableChannels.length > 0 && !availableChannels.includes(channel)}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-base transition-all active:scale-95 shadow-lg shadow-blue-900/40"
                >
                  {channel === "sms" ? "📱" : channel === "email" ? "📧" : "💬"}
                  {" "}SEND {channel.toUpperCase()} →
                </button>

                <button
                  onClick={handleSkip}
                  className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-4 rounded-2xl text-base transition-all active:scale-95"
                >
                  SKIP →
                </button>
              </div>

              {/* Secondary actions */}
              <div className="w-full max-w-2xl grid grid-cols-4 gap-2">
                <SecondaryButton onClick={handleReply}       label="Reply Rcvd"  icon="💬" color="yellow" />
                <SecondaryButton onClick={handleFollowUp}    label="Follow-Up"   icon="🔁" color="blue"   />
                <SecondaryButton onClick={handlePaymentLink} label="Payment Link" icon="💳" color="purple" />
                <button
                  onClick={() => setShowRevenueInput(v => !v)}
                  className="flex flex-col items-center justify-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl text-xs transition-all active:scale-95"
                >
                  <span>🏆</span>
                  <span>CLOSE DEAL</span>
                </button>
              </div>

              {/* Deal revenue input */}
              {showRevenueInput && (
                <div className="w-full max-w-2xl bg-emerald-900/30 border border-emerald-700/40 rounded-2xl p-4 flex items-center gap-3">
                  <span className="text-emerald-300 font-bold text-sm">Deal value:</span>
                  <span className="text-white font-bold">$</span>
                  <input
                    type="number"
                    value={dealRevenue}
                    onChange={e => setDealRevenue(e.target.value)}
                    className="bg-gray-800 text-white font-bold text-lg px-3 py-1.5 rounded-lg border border-emerald-700 focus:outline-none w-28"
                    min="1"
                  />
                  <span className="text-gray-400 text-sm">/mo</span>
                  <button
                    onClick={handleDealClosed}
                    className="ml-auto bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-5 py-2 rounded-xl text-sm"
                  >
                    Confirm Close 🎉
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`font-bold text-sm ${color}`}>{value}</span>
      <span className="text-gray-600 text-xs">{label}</span>
    </div>
  );
}

function ContactRow({ icon, label, highlight, link }: { icon: string; label: string; highlight?: boolean; link?: string }) {
  const content = (
    <div className={`flex items-center gap-2 text-sm ${highlight ? "text-white font-medium" : "text-gray-400"}`}>
      <span className="text-base">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
  if (link) return <a href={link} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">{content}</a>;
  return content;
}

function SecondaryButton({ onClick, label, icon, color }: {
  onClick: () => void; label: string; icon: string; color: "yellow" | "blue" | "purple" | "green";
}) {
  const colors = {
    yellow: "bg-yellow-800/40 hover:bg-yellow-700/60 text-yellow-300",
    blue:   "bg-blue-800/40 hover:bg-blue-700/60 text-blue-300",
    purple: "bg-purple-800/40 hover:bg-purple-700/60 text-purple-300",
    green:  "bg-emerald-800/40 hover:bg-emerald-700/60 text-emerald-300",
  };
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 ${colors[color]} font-bold py-3 rounded-xl text-xs transition-all active:scale-95`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
