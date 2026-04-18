"use client";

import { useCallback, useState } from "react";
import QaThreadDetail from "./QaThreadDetail";

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

const statusColor: Record<Question["status"], string> = {
  open: "text-amber-300",
  answered: "text-sky-300",
  resolved: "text-emerald-300",
  archived: "text-neutral-500",
};

export default function QaThreadRow({
  question,
  isAdminView,
}: {
  question: Question;
  isAdminView: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((x) => !x), []);

  return (
    <li className="rounded-md border border-neutral-800 bg-neutral-900/60">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-neutral-900"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-neutral-100">{question.question_text}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500">
            <span className={statusColor[question.status]}>{question.status}</span>
            {question.is_pinned && <span className="text-rose-300">pinned</span>}
            {question.category_tags.map((t) => (
              <span key={t} className="rounded bg-neutral-800 px-1.5 py-0.5">
                {t}
              </span>
            ))}
            <span>&middot;</span>
            <span>{new Date(question.created_at).toLocaleString()}</span>
          </div>
        </div>
        <span className="shrink-0 text-neutral-500">{expanded ? "\u2212" : "+"}</span>
      </button>

      {expanded && (
        <div className="border-t border-neutral-800 px-3 py-3">
          <QaThreadDetail questionId={question.id} isAdminView={isAdminView} />
        </div>
      )}
    </li>
  );
}
