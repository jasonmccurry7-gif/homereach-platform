"use client";

import { useState } from "react";
import { ArrowUpRight, Bot, Loader2, Send, ShieldCheck, Zap } from "lucide-react";
import type { CopilotSnapshot } from "@/lib/operations-copilot/types";

export function CopilotConsole({ snapshot }: { snapshot: CopilotSnapshot }) {
  const [message, setMessage] = useState("Give me today's operational summary.");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function askCopilot() {
    setLoading(true);
    setAnswer(null);
    const response = await fetch("/api/operations-copilot/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const payload = (await response.json()) as { answer?: string; error?: string };
    setAnswer(payload.answer ?? payload.error ?? "Unable to generate an answer.");
    setLoading(false);
  }

  async function triggerAction(actionType: string, title: string) {
    setLoading(true);
    const response = await fetch("/api/operations-copilot/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionType, title }),
    });
    const payload = (await response.json()) as { title?: string; status?: string; error?: string };
    setAnswer(
      payload.error ??
        `Action request created: ${payload.title ?? title}. Status: ${payload.status ?? "draft"}.`
    );
    setLoading(false);
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-lg border border-cyan-400/20 bg-neutral-900 p-5 shadow-2xl shadow-cyan-950/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Executive Copilot
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Operations command interface
            </h2>
          </div>
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200">
            Autonomy L{snapshot.autonomyLevel}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
            <Bot className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            Ask the operations department
          </div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="mt-3 min-h-28 w-full resize-none rounded-lg border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white outline-none ring-0 placeholder:text-neutral-500 focus:border-cyan-400/50"
          />
          <button
            type="button"
            onClick={askCopilot}
            disabled={loading || message.trim().length === 0}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-bold text-neutral-950 hover:bg-cyan-300 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            Execute analysis
          </button>
        </div>

        {answer && (
          <div className="mt-4 whitespace-pre-line rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm leading-6 text-cyan-50">
            {answer}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-white/10 bg-neutral-900 p-5">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-300" aria-hidden="true" />
          <h2 className="font-bold text-white">Quick Actions</h2>
        </div>
        <div className="mt-4 space-y-3">
          {snapshot.quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => triggerAction(action.actionType, action.label)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left hover:border-cyan-400/40 hover:bg-cyan-400/10"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-white">
                  {action.label}
                </span>
                <ArrowUpRight className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              </span>
              <span className="mt-1 block text-xs leading-5 text-neutral-400">
                {action.description}
              </span>
            </button>
          ))}
        </div>
        <div
          id="governance"
          className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Governance active
          </div>
          <p className="mt-1 text-xs leading-5 text-emerald-50/80">
            Purchases remain approval-gated unless autonomy policy explicitly
            allows low-risk execution.
          </p>
        </div>
      </div>
    </section>
  );
}
