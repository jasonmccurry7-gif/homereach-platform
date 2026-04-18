"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CATEGORY_TAGS = [
  "pricing",
  "objections",
  "scripts",
  "cities",
  "product",
  "technical",
] as const;

type Tag = (typeof CATEGORY_TAGS)[number];

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

type Suggestion = { id: string; title: string; body: string };

export default function QaAskInput({
  onCreated,
}: {
  onCreated: (q: Question) => void;
}) {
  const [text, setText] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [visibility, setVisibility] = useState<"team" | "private">("team");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debRef = useRef<number | null>(null);

  // Debounced dedupe check
  useEffect(() => {
    if (debRef.current) window.clearTimeout(debRef.current);
    if (text.trim().length < 10) {
      setSuggestions([]);
      return;
    }
    debRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/qa/knowledge/dedupe-check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ draft: text }),
          credentials: "include",
        });
        if (res.ok) {
          const data = (await res.json()) as { suggestions: Suggestion[] };
          setSuggestions(data.suggestions || []);
        }
      } catch {
        /* ignore */
      }
    }, 450);
    return () => {
      if (debRef.current) window.clearTimeout(debRef.current);
    };
  }, [text]);

  const submit = useCallback(async () => {
    if (posting) return;
    const t = text.trim();
    if (t.length < 3) {
      setError("Question must be at least 3 characters.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/qa/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionText: t,
          categoryTags: tags,
          visibility,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { question: Question };
      onCreated(data.question);
      setText("");
      setTags([]);
      setSuggestions([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPosting(false);
    }
  }, [text, tags, visibility, posting, onCreated]);

  const toggleTag = useCallback((tag: Tag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  return (
    <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/80 p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask anything about pricing, objections, scripts, cities, product, or process&hellip;"
        rows={3}
        className="w-full resize-none rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {CATEGORY_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
              tags.includes(tag)
                ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
                : "border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="rounded-md border border-amber-900 bg-amber-950/30 p-2 text-xs">
          <div className="mb-1 text-amber-200">
            Similar answers already exist &mdash; you can skip asking.
          </div>
          <ul className="space-y-1">
            {suggestions.map((s) => (
              <li key={s.id} className="text-amber-100/80">
                <span className="font-medium">{s.title}</span>
                {s.body ? <span className="ml-1 text-amber-100/60">&mdash; {s.body.slice(0, 120)}&hellip;</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-neutral-400">
          <input
            type="checkbox"
            checked={visibility === "private"}
            onChange={(e) => setVisibility(e.target.checked ? "private" : "team")}
            className="accent-emerald-500"
          />
          Private (only me)
        </label>

        <button
          type="button"
          onClick={submit}
          disabled={posting || text.trim().length < 3}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white shadow transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {posting ? "Asking&hellip;" : "Ask"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/40 p-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
