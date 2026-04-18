"use client";

import { useCallback, useEffect, useState } from "react";

type Hit = { id: string; title: string; body: string; tags: string[] };

export default function QaKnowledgeSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/qa/knowledge/search?${params.toString()}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = (await res.json()) as { results: Hit[] };
        setHits(data.results || []);
      }
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = window.setTimeout(() => void search(), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
        Saved knowledge
      </div>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the sales bible&hellip;"
        className="mb-2 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
      />
      {loading ? (
        <div className="text-xs text-neutral-500">Searching&hellip;</div>
      ) : hits.length === 0 ? (
        <div className="text-xs text-neutral-500">
          {q.trim() ? "No matches yet." : "Type to search official answers."}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {hits.map((h) => (
            <li
              key={h.id}
              className="rounded border border-neutral-800 bg-neutral-950 p-2 text-xs"
            >
              <div className="font-medium text-emerald-200">{h.title}</div>
              <div className="mt-0.5 text-neutral-300">{h.body.slice(0, 200)}{h.body.length > 200 ? "\u2026" : ""}</div>
              {h.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {h.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
