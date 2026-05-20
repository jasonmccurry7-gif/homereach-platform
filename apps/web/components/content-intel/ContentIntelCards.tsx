"use client";

// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Content Intelligence Sales Dashboard Cards
//
// Renders three action-focused cards: Today's Actions, Scripts, Winning Angle.
// Self-gating: when ENABLE_CONTENT_INTEL is off the API returns 404 and the
// component renders null. This lets us paste ONE import + ONE JSX line into
// the existing sales-dashboard with zero regression risk.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";

type Action = { id: string; category: string; title: string; steps: string[]; status: string };
type Script = { id: string; category: string; channel: "dm" | "sms" | "email" | "call"; title: string; body: string; status: string };
type Offer  = { id: string; category: string; title: string; improvement: string; supporting_script: string | null; status: string };

async function safeFetch<T>(url: string): Promise<T[] | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return null; // flag off
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j?.rows) ? j.rows : [];
  } catch {
    return [];
  }
}

export default function ContentIntelCards() {
  const [actions, setActions] = useState<Action[] | null>(null);
  const [scripts, setScripts] = useState<Script[] | null>(null);
  const [offers,  setOffers]  = useState<Offer[]  | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const [a, s, o] = await Promise.all([
      safeFetch<Action>("/api/admin/content-intel/actions"),
      safeFetch<Script>("/api/admin/content-intel/scripts"),
      safeFetch<Offer>("/api/admin/content-intel/offers"),
    ]);
    if (a === null) { setEnabled(false); return; }
    setEnabled(true);
    setActions(a); setScripts(s ?? []); setOffers(o ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function sendFeedback(itemType: string, itemId: string, outcome: "win" | "neutral" | "failed") {
    await fetch("/api/admin/content-intel/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemType, itemId, outcome }),
    });
    load();
  }

  if (enabled === null)  return null;  // still loading
  if (enabled === false) return null;  // flag off

  const winningAngle = offers?.[0] ?? null;

  return (
    <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Today's Actions */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">Today's Actions</h3>
        {!actions?.length && <p className="text-sm text-gray-500">No actions queued. Next cycle runs tomorrow.</p>}
        <ul className="space-y-3">
          {actions?.slice(0, 3).map((a) => (
            <li key={a.id} className="rounded border p-3">
              <div className="text-xs font-medium uppercase text-gray-500">{a.category}</div>
              <div className="font-semibold">{a.title}</div>
              <ol className="mt-1 list-decimal pl-5 text-sm text-gray-700">
                {a.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
              <FeedbackBar itemType="action" itemId={a.id} onFeedback={sendFeedback} />
            </li>
          ))}
        </ul>
      </div>

      {/* Scripts */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">Scripts</h3>
        {!scripts?.length && <p className="text-sm text-gray-500">No scripts queued.</p>}
        <ul className="space-y-3">
          {scripts?.slice(0, 2).map((s) => (
            <li key={s.id} className="rounded border p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium uppercase text-gray-500">{s.category} · {s.channel}</div>
              </div>
              <div className="font-semibold">{s.title}</div>
              <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-800">{s.body}</pre>
              <FeedbackBar itemType="script" itemId={s.id} onFeedback={sendFeedback} />
            </li>
          ))}
        </ul>
      </div>

      {/* Winning Angle */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">Winning Angle</h3>
        {!winningAngle && <p className="text-sm text-gray-500">No offer identified yet.</p>}
        {winningAngle && (
          <div className="rounded border p-3">
            <div className="text-xs font-medium uppercase text-gray-500">{winningAngle.category}</div>
            <div className="font-semibold">{winningAngle.title}</div>
            <p className="mt-1 text-sm text-gray-800">{winningAngle.improvement}</p>
            {winningAngle.supporting_script && (
              <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs">{winningAngle.supporting_script}</pre>
            )}
            <FeedbackBar itemType="offer" itemId={winningAngle.id} onFeedback={sendFeedback} />
          </div>
        )}
      </div>
    </section>
  );
}

function FeedbackBar({
  itemType, itemId, onFeedback,
}: {
  itemType: string;
  itemId: string;
  onFeedback: (t: string, id: string, outcome: "win" | "neutral" | "failed") => void;
}) {
  return (
    <div className="mt-2 flex gap-2 text-xs">
      <button onClick={() => onFeedback(itemType, itemId, "win")}     className="rounded border px-2 py-0.5 hover:bg-green-50">Win</button>
      <button onClick={() => onFeedback(itemType, itemId, "neutral")} className="rounded border px-2 py-0.5 hover:bg-gray-50">Neutral</button>
      <button onClick={() => onFeedback(itemType, itemId, "failed")}  className="rounded border px-2 py-0.5 hover:bg-red-50">Fail</button>
    </div>
  );
}
