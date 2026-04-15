"use client";

import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TODAY'S FACEBOOK EXECUTION
// Agent-facing dashboard: posts to work → comment replies → DM scripts → close
// ─────────────────────────────────────────────────────────────────────────────

interface Opportunity {
  id: string;
  post_type: string;
  group_name: string;
  post_url: string;
  post_text: string;
  city_detected: string;
  category_detected: string;
  urgency_score: number;
  conversion_score: number;
  lead_score: number;
  close_probability: number;
  commenter_name: string;
  business_name: string;
  profile_link: string;
  original_comment: string;
  suggested_reply: string;
  actual_reply: string;
  dm_stage_1: string;
  dm_stage_2: string;
  dm_stage_3: string;
  dm_stage_4: string;
  dm_stage_5: string;
  dm_stage_current: number;
  pipeline_status: string;
  is_hot_lead: boolean;
  category_available: boolean;
  follow_up_due_at: string | null;
  created_at: string;
}

interface ExecutionData {
  date: string;
  agent_id: string;
  execution: {
    needsComment:    Opportunity[];
    needsDm:         Opportunity[];
    inConversation:  Opportunity[];
    hotLeads:        Opportunity[];
    followUps:       Opportunity[];
    closeReady:      Opportunity[];
  };
  totals: {
    total_active:   number;
    needs_comment:  number;
    needs_dm:       number;
    hot_leads:      number;
    follow_ups_due: number;
    close_ready:    number;
  };
}

const STAGE_LABELS: Record<string, string> = {
  post_discovered: "Discovered", post_qualified: "Qualified",
  businesses_extracted: "Extracted", replies_generated: "Reply Ready",
  comment_posted: "Comment Sent", engaged: "Engaged",
  dm_ready: "DM Ready", dm_sent: "DM Sent", replied: "Replied",
  qualified: "Qualified Lead", offer_presented: "Offer Sent",
  close_attempt: "Closing", closed_won: "🏆 WON", closed_lost: "Lost",
  follow_up: "Follow-Up",
};

const DM_STAGE_LABELS = ["", "Warm Opener", "Diagnose Marketing", "Position HomeReach", "Scarcity + Close", "Final Close"];

// Objection handlers
const OBJECTION_RESPONSES: Record<string, string> = {
  "too expensive":    "Totally get it — let me ask though: what's it costing you to NOT be in front of those homeowners? Our Back Feature starts at $200/mo reaching 2,500 homes. That's 8 cents per home per month. Hard to find that anywhere.",
  "not interested":   "No worries at all. Quick question before I let you go — is it the timing, the price, or just not the right fit? Only asking because I want to make sure I'm not missing something.",
  "already advertise":"That's smart — what's working best for you right now? I ask because HomeReach is different from digital. Physical postcards in homeowners' hands, exclusive category, no algorithm. Most businesses run us alongside what they're already doing.",
  "send info":        "Absolutely — here's everything you need: home-reach.com/get-started\n\nYou'll see exact pricing, what the postcard looks like, and how many spots are left in your city. Takes 3 minutes to lock in. Want me to hold your category for 24 hours while you look?",
  "maybe later":      "I hear you. The only thing I can't guarantee is the spot will still be open later — we had two other businesses ask about that category this week. But I respect the timing. Can I check back in 3 days?",
  "need to think":    "Of course. What's the main thing you're thinking through — is it budget, the concept, or just timing? I want to make sure you have what you need to decide.",
};

export default function FacebookExecutionClient({ agentId }: { agentId: string }) {
  const [data,        setData]        = useState<ExecutionData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<string>("hot");
  const [flash,       setFlash]       = useState<{ msg: string; ok: boolean } | null>(null);
  const [showAdd,     setShowAdd]     = useState(false);
  const [showObjection, setShowObjection] = useState<string | null>(null);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);

  // Add opportunity form
  const [form, setForm] = useState({
    group_name: "", post_url: "", post_text: "",
    commenter_name: "", business_name: "", original_comment: "",
    profile_link: "", post_type: "business_promo",
  });

  const showFlash = (msg: string, ok = true) => {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/facebook?view=execution&agent_id=${agentId}`);
      setData(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (id: string, action: string, extra?: Record<string, unknown>) => {
    await fetch("/api/admin/facebook", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id, action, ...extra }),
    });
    showFlash(action === "closed_won" ? "🎉 DEAL CLOSED!" : `✓ ${action.replace(/_/g, " ")} logged`);
    load();
  };

  const submitOpportunity = async () => {
    const res = await fetch("/api/admin/facebook", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(form),
    });
    if (res.ok) {
      showFlash("✓ Opportunity added — scripts generated!");
      setShowAdd(false);
      setForm({ group_name: "", post_url: "", post_text: "", commenter_name: "", business_name: "", original_comment: "", profile_link: "", post_type: "business_promo" });
      load();
    } else {
      showFlash("Failed to add opportunity", false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">Loading Facebook Execution Board…</p>
    </div>
  );

  const exec = data?.execution;
  const tabs = [
    { key: "hot",      label: "🔥 Hot Leads",     count: exec?.hotLeads.length ?? 0,      urgent: true  },
    { key: "close",    label: "💰 Close Ready",    count: exec?.closeReady.length ?? 0,    urgent: true  },
    { key: "followup", label: "🔁 Follow-Ups",     count: exec?.followUps.length ?? 0,     urgent: true  },
    { key: "dm",       label: "💬 DM Queue",       count: exec?.needsDm.length ?? 0,       urgent: false },
    { key: "comment",  label: "📝 Comment Queue",  count: exec?.needsComment.length ?? 0,  urgent: false },
    { key: "active",   label: "⚡ In Progress",    count: exec?.inConversation.length ?? 0, urgent: false },
  ];

  const activeItems: Opportunity[] = (() => {
    switch (activeTab) {
      case "hot":      return exec?.hotLeads ?? [];
      case "close":    return exec?.closeReady ?? [];
      case "followup": return exec?.followUps ?? [];
      case "dm":       return exec?.needsDm ?? [];
      case "comment":  return exec?.needsComment ?? [];
      case "active":   return exec?.inConversation ?? [];
      default: return [];
    }
  })();

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Flash */}
      {flash && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl font-bold text-sm ${flash.ok ? "bg-green-600" : "bg-red-600"}`}>
          {flash.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">📱 Facebook Execution Board</h1>
            <p className="text-sm text-gray-400 mt-0.5">{data?.date} · Comment → DM → Close</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Stats */}
            <div className="flex gap-4 text-xs">
              {[
                { label: "Hot", value: exec?.hotLeads.length ?? 0, color: "text-red-400" },
                { label: "Close", value: exec?.closeReady.length ?? 0, color: "text-emerald-400" },
                { label: "DMs", value: exec?.needsDm.length ?? 0, color: "text-blue-400" },
                { label: "Comments", value: exec?.needsComment.length ?? 0, color: "text-gray-300" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition"
            >
              + Add Post
            </button>
            <button onClick={load} className="text-xs text-gray-500 hover:text-white underline">Refresh</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                  tab.urgent && tab.count > 0 ? "bg-red-500 text-white" : "bg-gray-700 text-gray-300"
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Objection handler panel */}
      {showObjection && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70" onClick={() => setShowObjection(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white mb-4">💬 Objection Handler</h3>
            <div className="space-y-3">
              {Object.entries(OBJECTION_RESPONSES).map(([trigger, response]) => (
                <div key={trigger} className="rounded-xl border border-gray-700 p-3">
                  <p className="text-xs font-bold text-red-400 mb-1">They say: "{trigger}"</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{response}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(response); showFlash("Copied!"); }}
                    className="mt-2 text-xs text-blue-400 hover:underline"
                  >Copy response</button>
                </div>
              ))}
            </div>
            <button onClick={() => setShowObjection(null)} className="mt-4 w-full py-2 bg-gray-800 rounded-xl text-sm text-gray-400 hover:text-white">Close</button>
          </div>
        </div>
      )}

      {/* Add Opportunity Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70" onClick={() => setShowAdd(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white mb-4">+ Add Facebook Opportunity</h3>
            <p className="text-xs text-gray-400 mb-4">Paste post details → system generates reply + DM scripts automatically</p>
            <div className="space-y-3">
              {[
                { key: "group_name", label: "Facebook Group Name", placeholder: "e.g. Wooster Ohio Community Board" },
                { key: "post_url",   label: "Post URL (optional)", placeholder: "https://facebook.com/..." },
                { key: "business_name", label: "Business Name", placeholder: "e.g. Smith Plumbing LLC" },
                { key: "commenter_name", label: "Person's Name", placeholder: "e.g. John Smith" },
                { key: "profile_link", label: "Facebook Profile Link (optional)", placeholder: "https://facebook.com/..." },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-400 mb-1">{field.label}</label>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    value={(form as any)[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Post Text (paste it here)</label>
                <textarea
                  rows={3}
                  placeholder="Paste the Facebook post text..."
                  value={form.post_text}
                  onChange={e => setForm(f => ({ ...f, post_text: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Their Comment (if they commented)</label>
                <textarea
                  rows={2}
                  placeholder="Paste their comment..."
                  value={form.original_comment}
                  onChange={e => setForm(f => ({ ...f, original_comment: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Post Type</label>
                <select
                  value={form.post_type}
                  onChange={e => setForm(f => ({ ...f, post_type: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                >
                  <option value="business_promo">Business promo post</option>
                  <option value="service_request">Someone requesting a service</option>
                  <option value="recommendation">Asking for recommendations</option>
                  <option value="local_engagement">Local community thread</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 bg-gray-800 rounded-xl text-sm text-gray-400 hover:text-white">Cancel</button>
              <button
                onClick={submitOpportunity}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold text-white"
              >Generate Scripts →</button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="p-6 max-w-4xl mx-auto">
        {activeItems.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">📭</p>
            <p className="text-gray-400 text-lg font-medium">Nothing here yet</p>
            <p className="text-gray-600 text-sm mt-2">Click "+ Add Post" to paste a Facebook post and generate your scripts</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeItems.map(opp => (
              <OpportunityCard
                key={opp.id}
                opp={opp}
                expanded={expandedId === opp.id}
                onToggle={() => setExpandedId(expandedId === opp.id ? null : opp.id)}
                onAction={doAction}
                onShowFlash={showFlash}
                onObjection={() => setShowObjection(opp.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Opportunity Card ─────────────────────────────────────────────────────────

function OpportunityCard({
  opp, expanded, onToggle, onAction, onShowFlash, onObjection
}: {
  opp: Opportunity;
  expanded: boolean;
  onToggle: () => void;
  onAction: (id: string, action: string, extra?: Record<string, unknown>) => void;
  onShowFlash: (msg: string, ok?: boolean) => void;
  onObjection: () => void;
}) {
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    onShowFlash(`✓ ${label} copied`);
  };

  const dmScript = [opp.dm_stage_1, opp.dm_stage_2, opp.dm_stage_3, opp.dm_stage_4, opp.dm_stage_5][opp.dm_stage_current] ?? opp.dm_stage_1;
  const nextDmStage = Math.min(4, opp.dm_stage_current + 1);

  return (
    <div className={`rounded-2xl border transition-all ${
      opp.is_hot_lead
        ? "border-red-500/50 bg-red-900/10"
        : opp.pipeline_status === "closed_won"
        ? "border-emerald-500/50 bg-emerald-900/10"
        : "border-gray-800 bg-gray-900"
    }`}>
      {/* Card header */}
      <button onClick={onToggle} className="w-full text-left px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {opp.is_hot_lead && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white animate-pulse">🔥 HOT</span>}
              <span className="font-bold text-white truncate">{opp.business_name || opp.commenter_name || "Unknown Business"}</span>
              <span className="text-xs text-gray-500">{STAGE_LABELS[opp.pipeline_status] ?? opp.pipeline_status}</span>
            </div>
            <p className="text-xs text-gray-400">
              {[opp.category_detected, opp.city_detected, opp.group_name].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className={`text-sm font-bold ${opp.lead_score >= 70 ? "text-red-400" : opp.lead_score >= 40 ? "text-amber-400" : "text-gray-500"}`}>
                {opp.lead_score}%
              </p>
              <p className="text-[10px] text-gray-600">score</p>
            </div>
            <span className="text-gray-600">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-800/50 pt-4">

          {/* Original post/comment */}
          {(opp.original_comment || opp.post_text) && (
            <div className="rounded-xl bg-gray-800/50 p-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Their post / comment</p>
              <p className="text-sm text-gray-300">{opp.original_comment || opp.post_text}</p>
              {opp.profile_link && (
                <a href={opp.profile_link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline mt-1 inline-block">
                  View profile →
                </a>
              )}
            </div>
          )}

          {/* Comment reply */}
          {opp.suggested_reply && (
            <div className="rounded-xl bg-blue-900/20 border border-blue-800/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-blue-400 uppercase">📝 Comment Reply (post this publicly)</p>
                <div className="flex gap-2">
                  <button onClick={() => copy(opp.suggested_reply, "Reply")}
                    className="text-xs text-blue-400 hover:underline">Copy</button>
                  <button onClick={() => onAction(opp.id, "comment_sent")}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded-full font-bold">
                    Mark Sent
                  </button>
                </div>
              </div>
              <p className="text-sm text-white">{opp.suggested_reply}</p>
            </div>
          )}

          {/* DM Script */}
          {dmScript && (
            <div className="rounded-xl bg-emerald-900/20 border border-emerald-800/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[10px] font-bold text-emerald-400 uppercase">💬 DM Script</p>
                  <p className="text-[10px] text-gray-500">Stage {opp.dm_stage_current + 1}/5: {["Warm Opener","Diagnose Marketing","Position HomeReach","Scarcity + Close","Final Close"][opp.dm_stage_current]}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copy(dmScript, "DM script")}
                    className="text-xs text-emerald-400 hover:underline">Copy</button>
                  <button onClick={() => onAction(opp.id, "dm_sent", { dm_stage_current: nextDmStage })}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-full font-bold">
                    Mark Sent →
                  </button>
                </div>
              </div>
              <p className="text-sm text-white whitespace-pre-wrap">{dmScript}</p>

              {/* DM stage progress */}
              <div className="flex gap-1 mt-2">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i <= opp.dm_stage_current ? "bg-emerald-500" : "bg-gray-700"}`} />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => onAction(opp.id, "reply_received")}
              className="text-xs bg-amber-600/30 border border-amber-600/50 text-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-600/50">
              They Replied
            </button>
            <button onClick={() => onAction(opp.id, "qualified")}
              className="text-xs bg-blue-600/30 border border-blue-600/50 text-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-600/50">
              Qualified ✓
            </button>
            <button onClick={() => onAction(opp.id, "closed_won", { revenue_cents: 20000 })}
              className="text-xs bg-emerald-600/30 border border-emerald-600/50 text-emerald-300 px-3 py-1.5 rounded-lg hover:bg-emerald-600/50 font-bold">
              🏆 Closed Won
            </button>
            <button onClick={() => onAction(opp.id, "follow_up", { follow_up_due_at: new Date(Date.now() + 86400000).toISOString() })}
              className="text-xs bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-600">
              Follow-Up Tomorrow
            </button>
            <button onClick={onObjection}
              className="text-xs bg-purple-900/30 border border-purple-700/50 text-purple-300 px-3 py-1.5 rounded-lg hover:bg-purple-700/30">
              💬 Objection Help
            </button>
            <button onClick={() => onAction(opp.id, "closed_lost")}
              className="text-xs text-gray-600 hover:text-red-400 px-3 py-1.5 rounded-lg">
              Lost
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
