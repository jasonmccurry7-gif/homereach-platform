"use client";

import { useCallback, useEffect, useState } from "react";
import QaAnswerCard from "./QaAnswerCard";

type Answer = {
  id: string;
  source: "ai" | "team" | "admin";
  author_agent_id: string | null;
  direct_answer: string;
  what_to_say: {
    sms?: string;
    email?: string;
    call?: string;
    dm?: string;
  };
  what_to_do_next: string;
  why_this_works: string;
  related_question_ids: string[];
  is_official: boolean;
  is_best: boolean;
  is_locked: boolean;
  model_name: string | null;
  created_at: string;
};

type Reply = {
  id: string;
  parent_reply_id: string | null;
  author_agent_id: string;
  author_role: "agent" | "admin";
  body: string;
  upvote_count: number;
  is_admin_override: boolean;
  created_at: string;
};

export default function QaThreadDetail({
  questionId,
  isAdminView,
}: {
  questionId: string;
  isAdminView: boolean;
}) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyDraft, setReplyDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leadId, setLeadId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/qa/questions/${questionId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        question: { lead_id: string | null };
        answers: Answer[];
        replies: Reply[];
      };
      setLeadId(data.question.lead_id);
      setAnswers(data.answers || []);
      setReplies(data.replies || []);
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const postReply = useCallback(async () => {
    if (posting) return;
    const text = replyDraft.trim();
    if (text.length < 1) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/admin/qa/questions/${questionId}/replies`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text }),
        credentials: "include",
      });
      if (res.ok) {
        setReplyDraft("");
        await load();
      }
    } finally {
      setPosting(false);
    }
  }, [replyDraft, posting, questionId, load]);

  if (loading) {
    return <div className="text-xs text-neutral-500">Loading&hellip;</div>;
  }

  return (
    <div className="space-y-3">
      {answers.length === 0 && (
        <div className="rounded border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-500">
          No AI answer yet. The model may still be generating &mdash; refresh in a few seconds.
        </div>
      )}

      {answers.map((a) => (
        <QaAnswerCard
          key={a.id}
          answer={a}
          questionId={questionId}
          leadId={leadId}
          isAdminView={isAdminView}
          onChanged={load}
        />
      ))}

      {/* Replies */}
      {replies.length > 0 && (
        <div className="space-y-1.5 border-t border-neutral-800 pt-2">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">
            Team replies
          </div>
          {replies.map((r) => (
            <div
              key={r.id}
              className="rounded border border-neutral-800 bg-neutral-950 p-2 text-xs text-neutral-200"
            >
              <div className="mb-0.5 flex items-center gap-2 text-[10px] text-neutral-500">
                <span
                  className={
                    r.author_role === "admin" ? "text-sky-300" : "text-neutral-400"
                  }
                >
                  {r.author_role}
                </span>
                <span>&middot;</span>
                <span>{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <div className="whitespace-pre-wrap">{r.body}</div>
            </div>
          ))}
        </div>
      )}

      {/* Reply composer */}
      <div className="flex items-start gap-2 border-t border-neutral-800 pt-2">
        <textarea
          value={replyDraft}
          onChange={(e) => setReplyDraft(e.target.value)}
          placeholder="Add a reply&hellip;"
          rows={2}
          className="flex-1 resize-none rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={postReply}
          disabled={posting || replyDraft.trim().length < 1}
          className="rounded bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reply
        </button>
      </div>
    </div>
  );
}
