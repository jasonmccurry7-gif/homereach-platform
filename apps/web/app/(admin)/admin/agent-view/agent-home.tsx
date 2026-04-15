"use client";

import { useState } from "react";
import DoThisNow from "./do-this-now";
import DealsAtRisk from "./deals-at-risk";
import CallEngine from "./call-engine";
import QuickCallLog from "./quick-call-log";
import RevenueStrip from "./revenue-strip";

// ─────────────────────────────────────────────────────────────────────────────
// AGENT HOME — Revenue Domination OS
// Layout order: Revenue Strip → DO THIS NOW → Deals at Risk → Call List
// ─────────────────────────────────────────────────────────────────────────────

const OBJECTION_RESPONSES: Record<string, { label: string; response: string }[]> = {
  "price": [
    { label: "Cost per home", response: "Think about it this way — you're reaching 2,500 homeowners for less than 10 cents each. That's cheaper than any paid ad, and it's a physical mailer they hold in their hands." },
    { label: "Compare to Google", response: "Most businesses pay $15–50 per click on Google. We're putting you in front of 2,500 homes for a flat monthly rate. One new customer usually pays for the whole month." },
    { label: "Exclusive angle", response: "It's not just the reach — it's the exclusivity. No other [category] business in [city] can run while you're active. That's protection of your market, not just advertising." },
  ],
  "timing": [
    { label: "Spot pressure", response: "I totally understand. The only thing I'd mention is the spot — once someone else in [category] locks it in, it's closed until they cancel. I can note your interest and check back in 2 weeks if that helps." },
    { label: "No commitment", response: "No long-term contract required. You can start month-to-month and see results before committing to anything ongoing." },
    { label: "Season angle", response: "That actually makes this a great time — you'd be getting in front of homeowners before the busy season hits, not after everyone else already has." },
  ],
  "trust": [
    { label: "Social proof", response: "Totally fair. We're working with [category] businesses in Wooster, Medina, and Cuyahoga Falls right now. I can send you a sample mailer so you can see exactly what your ad would look like." },
    { label: "See it first", response: "Before committing to anything, let me send you a sample of what the postcard looks like. Takes 2 minutes to review. Would that help?" },
    { label: "Proof of reach", response: "The mailing list is verified residential addresses — homeowners, not renters. These are the people who actually hire for your services." },
  ],
  "already_marketing": [
    { label: "Complement, not replace", response: "That's actually great — it means you're already investing in growth. This would work alongside what you're doing, not replace it. Most businesses run us and see it pull a completely different type of customer." },
    { label: "Different channel", response: "The difference is physical vs digital. Your online ads catch people when they're searching. Our postcard reaches them when they're sitting at home, before they even start searching." },
    { label: "Exclusivity matters", response: "The other thing is the category lock. Your competitors may be on Google too — but they can't be in this mailer while you are." },
  ],
  "not_interested": [
    { label: "Curiosity question", response: "Totally respect that. Quick question before I let you go — is it the timing, the format, or just not something you've needed in the past? Only asking so I know for future reference." },
    { label: "Leave door open", response: "No problem at all. I'll make a note to check back in 60 days — sometimes timing just isn't right. Is there a better time of year for you?" },
    { label: "Small ask", response: "I get it. Would it be okay if I sent you a one-page overview just so you have it? No pressure, just something to file away in case it makes sense later." },
  ],
};

type Tab = "home" | "calls" | "scripts";

export default function AgentHome({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [tab,          setTab]         = useState<Tab>("home");
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [flash,        setFlash]        = useState<{ msg: string; ok: boolean } | null>(null);
  const [showObjection, setShowObjection] = useState<string | null>(null);

  const showFlashMsg = (msg: string, ok = true) => {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Flash */}
      {flash && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl font-bold text-sm ${flash.ok ? "bg-green-600" : "bg-red-600"}`}>
          {flash.msg}
        </div>
      )}

      {/* Quick Log Modal */}
      {showQuickLog && (
        <QuickCallLog
          agentId={agentId}
          onClose={() => setShowQuickLog(false)}
          onSaved={() => { setShowQuickLog(false); showFlashMsg("✓ Call logged"); }}
        />
      )}

      {/* Objection Handler Modal */}
      {showObjection && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowObjection(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white mb-4">💬 Handle: "{showObjection}"</h3>
            {(OBJECTION_RESPONSES[showObjection] ?? OBJECTION_RESPONSES["not_interested"]).map(r => (
              <div key={r.label} className="mb-3 rounded-xl bg-gray-800 p-3">
                <p className="text-xs font-bold text-blue-400 mb-1">{r.label}</p>
                <p className="text-sm text-gray-200">{r.response}</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(r.response); showFlashMsg("Copied!"); }}
                  className="mt-2 text-xs text-gray-500 hover:text-white underline"
                >Copy</button>
              </div>
            ))}
            <button onClick={() => setShowObjection(null)} className="mt-2 w-full py-2 bg-gray-800 rounded-xl text-sm text-gray-400">Close</button>
          </div>
        </div>
      )}

      {/* Revenue Strip */}
      <RevenueStrip agentId={agentId} />

      {/* Tab bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 flex items-center">
        {[
          { key: "home",    label: "🏠 Home",      },
          { key: "calls",   label: "📞 Call List", },
          { key: "scripts", label: "📝 Scripts",   },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key ? "border-blue-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => setShowQuickLog(true)}
          className="ml-auto my-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg"
        >
          + Quick Log
        </button>
      </div>

      {/* ── HOME TAB ── */}
      {tab === "home" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-2xl mx-auto w-full">

          {/* DO THIS NOW */}
          <DoThisNow agentId={agentId} onAction={(action) => {
            if (action.phone) window.location.href = `tel:${action.phone}`;
          }} />

          {/* Deals at Risk */}
          <DealsAtRisk agentId={agentId} onFlash={showFlashMsg} />

          {/* Objection Quick Access */}
          <div>
            <h3 className="text-sm font-bold text-gray-400 mb-2">💬 Objection Handlers</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "price",            label: "Too Expensive",    color: "border-red-700 text-red-400" },
                { key: "timing",           label: "Bad Timing",       color: "border-amber-700 text-amber-400" },
                { key: "trust",            label: "Not Sure",         color: "border-blue-700 text-blue-400" },
                { key: "already_marketing",label: "Already Marketing",color: "border-purple-700 text-purple-400" },
                { key: "not_interested",   label: "Not Interested",   color: "border-gray-700 text-gray-400" },
              ].map(obj => (
                <button
                  key={obj.key}
                  onClick={() => setShowObjection(obj.key)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold text-center hover:bg-gray-800 transition ${obj.color}`}
                >
                  {obj.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ── CALLS TAB ── */}
      {tab === "calls" && (
        <div className="flex-1 overflow-hidden">
          <CallEngine agentId={agentId} />
        </div>
      )}

      {/* ── SCRIPTS TAB ── */}
      {tab === "scripts" && (
        <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-4">
          <h2 className="text-white font-bold text-lg">📝 Script Library</h2>
          <p className="text-sm text-gray-400">Tap any category to view scripts. Use [CITY] as a placeholder — it fills in automatically on call cards.</p>
          {[
            "roofing","hvac","plumbing","landscaping","concrete-masonry",
            "junk-removal","pressure-washing","windows-doors","garage-doors",
            "painting","electrical","home-remodeling","home-services","all"
          ].map(cat => (
            <ScriptCard key={cat} category={cat} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScriptCard({ category }: { category: string }) {
  const [scripts, setScripts] = useState<{ label: string; script: string; variant: number }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (scripts.length > 0) { setOpen(!open); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sales/call-scripts?category=${category}`);
      const data = await res.json();
      setScripts(data.scripts ?? []);
      setOpen(true);
    } catch { /* silent */ }
    setLoading(false);
  };

  const label = category === "all" ? "General (Fallback)" : category.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900">
      <button onClick={load} className="w-full text-left px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className="text-gray-500 text-xs">{loading ? "Loading…" : open ? "▲" : "▼"}</span>
      </button>
      {open && scripts.map(s => (
        <div key={s.variant} className="border-t border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-blue-400">Script {s.variant}: {s.label}</p>
            <button
              onClick={() => navigator.clipboard.writeText(s.script)}
              className="text-xs text-gray-500 hover:text-white"
            >Copy</button>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{s.script}</p>
        </div>
      ))}
    </div>
  );
}
