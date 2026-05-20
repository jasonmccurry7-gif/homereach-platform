"use client";

// ─────────────────────────────────────────────────────────────────────────────
// QaBoard — main client component for /admin/qa and /agent/qa
//
// Mobile-first layout:
//   Top:    Ask question input
//   Middle: Active threads
//   Bottom: Saved knowledge (on agent view) / Admin queue (on admin view)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import QaAskInput from "./QaAskInput";
import QaThreadRow from "./QaThreadRow";
import QaKnowledgeSearch from "./QaKnowledgeSearch";
import QaAdminQueue from "./QaAdminQueue";

type Question = {
  id: string;
  question_text: string;
  category_tags: string[];
  visibility: "private" | "team" | "public";
  status: "open" | "answered" | "resolved" | "archived";
  is_pinned: boolean;
  upvote_count: number;
  asked_by_agent_id: string;
  created_at: string;
};

type FilterKey = "all" | "unresolved" | "pinned" | "mine";

export default function QaBoard({ isAdminView }: { isAdminView: boolean }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter === "unresolved") params.set("status", "open");
      if (filter === "pinned") params.set("pinned", "true");
      const res = await fetch(`/api/admin/qa/questions?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { questions: Question[] };
      setQuestions(data.questions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleNewQuestion = useCallback(
    (q: Question) => {
      setQuestions((prev) => [q, ...prev]);
      // Refresh after a short delay so AI answer appears
      window.setTimeout(() => void load(), 1500);
    },
    [load],
  );

  return (
    <div className="space-y-6">
      {/* Top: Ask */}
      <QaAskInput onCreated={handleNewQuestion} />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(["all", "unresolved", "pinned", "mine"] as FilterKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full border px-3 py-1 ${
              filter === k
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                : "border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Middle: Threads */}
      <section>
        {loading ? (
          <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
            Loading threads&hellip;
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
            No questions yet. Ask the first one above.
          </div>
        ) : (
          <ul className="space-y-2">
            {questions.map((q) => (
              <QaThreadRow key={q.id} question={q} isAdminView={isAdminView} />
            ))}
          </ul>
        )}
      </section>

      {/* Bottom: Admin queue or knowledge search */}
      {isAdminView ? <QaAdminQueue /> : <QaKnowledgeSearch />}
    </div>
  );
}
