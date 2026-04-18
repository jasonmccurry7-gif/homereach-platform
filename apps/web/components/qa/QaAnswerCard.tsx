"use client";

import { useCallback, useState } from "react";

type Answer = {
  id: string;
  source: "ai" | "team" | "admin";
  direct_answer: string;
  what_to_say: {
    sms?: string;
    email?: string;
    call?: string;
    dm?: string;
  };
  what_to_do_next: string;
  why_this_works: string;
  is_official: boolean;
  is_best: boolean;
  is_locked: boolean;
  model_name: string | null;
};

type Channel = "sms" | "email" | "call" | "dm";

const CHANNEL_LABELS: Record<Channel, string> = {
  sms: "SMS",
  email: "Email",
  call: "Call",
  dm: "DM",
};

export default function QaAnswerCard({
  answer,
  questionId,
  leadId,
  isAdminView,
  onChanged,
}: {
  answer: Answer;
  questionId: string;
  leadId: string | null;
  isAdminView: boolean;
  onChanged: () => void;
}) {
  const [copied, setCopied] = useState<Channel | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attached, setAttached] = useState(false);
  const [makingOfficial, setMakingOfficial] = useState(false);

  const copy = useCallback(
    async (channel: Channel, content: string) => {
      try {
        await navigator.clipboard.writeText(content);
      } catch {
        /* ignore */
      }
      setCopied(channel);
      window.setTimeout(() => setCopied(null), 1500);
      void fetch("/api/admin/qa/scripts/copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answerId: answer.id, channel, content }),
        credentials: "include",
      });
    },
    [answer.id],
  );

  const attach = useCallback(
    async (channel: Channel) => {
      if (!leadId || attaching) return;
      setAttaching(true);
      try {
        const content = answer.what_to_say[channel] || answer.direct_answer;
        const copyRes = await fetch("/api/admin/qa/scripts/copy", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answerId: answer.id, channel, content }),
          credentials: "include",
        });
        const copyData = (await copyRes.json().catch(() => ({}))) as {
          scriptId?: string;
        };
        await fetch("/api/admin/qa/scripts/attach-to-lead", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leadId,
            answerId: answer.id,
            questionId,
            scriptId: copyData.scriptId,
          }),
          credentials: "include",
        });
        setAttached(true);
      } finally {
        setAttaching(false);
      }
    },
    [answer, leadId, questionId, attaching],
  );

  const markOfficial = useCallback(async () => {
    if (makingOfficial) return;
    setMakingOfficial(true);
    try {
      const res = await fetch(`/api/admin/qa/answers/${answer.id}/mark-official`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });
      if (res.ok) onChanged();
    } finally {
      setMakingOfficial(false);
    }
  }, [answer.id, makingOfficial, onChanged]);

  const channels: Channel[] = (["sms", "email", "call", "dm"] as Channel[]).filter(
    (c) => typeof answer.what_to_say[c] === "string" && (answer.what_to_say[c] as string).length > 0,
  );

  const badgeClass = answer.is_official
    ? "text-emerald-300"
    : answer.source === "ai"
      ? "text-sky-300"
      : "text-neutral-400";

  return (
    <div className="space-y-2 rounded border border-neutral-800 bg-neutral-950/60 p-3">
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide">
        <div className="flex items-center gap-2">
          <span className={badgeClass}>
            {answer.is_official
              ? "Official"
              : answer.source === "ai"
                ? `AI${answer.model_name ? ` · ${answer.model_name}` : ""}`
                : answer.source}
          </span>
          {answer.is_best && <span className="text-emerald-300">&#9733; Best</span>}
          {answer.is_locked && <span className="text-rose-300">locked</span>}
        </div>
        {isAdminView && !answer.is_official && (
          <button
            type="button"
            onClick={markOfficial}
            disabled={makingOfficial}
            className="rounded border border-emerald-700 px-2 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-900/30 disabled:opacity-40"
          >
            {makingOfficial ? "&hellip;" : "Mark Official"}
          </button>
        )}
      </div>

      <div className="text-sm text-neutral-100">{answer.direct_answer}</div>

      {channels.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">
            What to say
          </div>
          {channels.map((c) => (
            <div
              key={c}
              className="flex items-start gap-2 rounded border border-neutral-800 bg-neutral-900 p-2 text-xs"
            >
              <div className="w-10 shrink-0 text-[10px] uppercase text-neutral-500">
                {CHANNEL_LABELS[c]}
              </div>
              <div className="flex-1 whitespace-pre-wrap text-neutral-200">
                {answer.what_to_say[c]}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => void copy(c, answer.what_to_say[c]!)}
                  className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-200 hover:bg-neutral-700"
                >
                  {copied === c ? "\u2713 Copied" : "Copy"}
                </button>
                {leadId && (
                  <button
                    type="button"
                    onClick={() => void attach(c)}
                    disabled={attaching || attached}
                    className="rounded bg-emerald-800/50 px-2 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-700/60 disabled:opacity-40"
                  >
                    {attached ? "Attached" : "Attach"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {answer.what_to_do_next && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">
            What to do next
          </div>
          <div className="text-xs text-neutral-200">{answer.what_to_do_next}</div>
        </div>
      )}

      {answer.why_this_works && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">
            Why this works
          </div>
          <div className="text-xs text-neutral-400">{answer.why_this_works}</div>
        </div>
      )}
    </div>
  );
}
