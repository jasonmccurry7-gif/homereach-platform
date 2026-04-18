"use client";

import { useEffect, useState } from "react";

type Q = {
  id: string;
  question_text: string;
  category_tags: string[];
  status: string;
  upvote_count: number;
  created_at: string;
};

export default function QaAdminQueue() {
  const [unresolved, setUnresolved] = useState<Q[]>([]);
  const [popular, setPopular] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/qa/admin/queue", {
          credentials: "include",
        });
        if (res.ok) {
          const data = (await res.json()) as { unresolved: Q[]; popular: Q[] };
          setUnresolved(data.unresolved || []);
          setPopular(data.popular || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return null;
  if (unresolved.length === 0 && popular.length === 0) return null;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
        Admin queue
      </div>

      {unresolved.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-amber-300">
            Unresolved (&gt;1h old)
          </div>
          <ul className="space-y-1">
            {unresolved.map((q) => (
              <li
                key={q.id}
                className="rounded border border-amber-900/50 bg-amber-950/20 p-2 text-xs text-amber-100"
              >
                {q.question_text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {popular.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-sky-300">
            Popular (ready to promote to official)
          </div>
          <ul className="space-y-1">
            {popular.map((q) => (
              <li
                key={q.id}
                className="rounded border border-sky-900/50 bg-sky-950/20 p-2 text-xs text-sky-100"
              >
                <span className="mr-2 text-sky-300">&uarr;{q.upvote_count}</span>
                {q.question_text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
