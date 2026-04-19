"use client";

// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — High Priority Leads card for the sales dashboard.
//
// Self-gates: when ENABLE_LEAD_INTEL is off, /api/admin/lead-intel/high-priority
// returns 404 and this component renders null. Drop it next to other cards
// with a single import + single JSX line.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";

type HighPriorityLead = {
  id: string;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  status: string;
  signal_score: number;
  signal_tier: string;
  last_contacted_at: string | null;
};

async function safeFetch(url: string): Promise<HighPriorityLead[] | null> {
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

export default function HighPriorityLeadsCard() {
  const [rows, setRows] = useState<HighPriorityLead[] | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const r = await safeFetch("/api/admin/lead-intel/high-priority");
      if (r === null) { setEnabled(false); return; }
      setEnabled(true);
      setRows(r);
    })();
  }, []);

  if (enabled === null) return null;
  if (enabled === false) return null;
  if (!rows?.length) return null;

  return (
    <section className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
        High Priority Leads ({rows.length})
      </h3>
      <p className="mb-3 text-xs text-gray-500">
        Ranked by signal score (recency + engagement + storm-fit + category-fit).
      </p>
      <ul className="divide-y">
        {rows.map((l) => (
          <li key={l.id} className="py-2 flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{l.business_name}</div>
              <div className="text-xs text-gray-600">
                {l.contact_name ? `${l.contact_name} · ` : ""}
                {l.category ?? "—"}
                {l.city ? ` · ${l.city}${l.state ? ", " + l.state : ""}` : ""}
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-700">
                {l.phone && <a className="text-blue-700 underline" href={`tel:${l.phone}`}>{l.phone}</a>}
                {l.email && <a className="text-blue-700 underline" href={`mailto:${l.email}`}>{l.email}</a>}
                {l.last_contacted_at && (
                  <span className="text-gray-500">
                    Last contacted {new Date(l.last_contacted_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="rounded bg-red-100 px-2 py-0.5 text-xs font-mono text-red-800">
                {l.signal_score}/20
              </div>
              <div className="mt-1 text-xs uppercase text-gray-500">{l.status}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
