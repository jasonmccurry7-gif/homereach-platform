"use client";

import { useState, useTransition } from "react";

type ActionKey =
  | "pause_all"
  | "pause_email"
  | "pause_sms"
  | "manual_approval_on"
  | "reduce_email_cap"
  | "reduce_sms_cap"
  | "clear_domain_pause";

const ACTIONS: Array<{ key: ActionKey; label: string; tone: "danger" | "warn" | "safe" }> = [
  { key: "manual_approval_on", label: "Turn on manual approval", tone: "safe" },
  { key: "pause_email", label: "Pause email", tone: "warn" },
  { key: "pause_sms", label: "Pause SMS", tone: "warn" },
  { key: "reduce_email_cap", label: "Reduce email caps", tone: "safe" },
  { key: "reduce_sms_cap", label: "Reduce SMS caps", tone: "safe" },
  { key: "clear_domain_pause", label: "Clear domain pause", tone: "safe" },
  { key: "pause_all", label: "Emergency pause all", tone: "danger" },
];

function classForTone(tone: "danger" | "warn" | "safe") {
  if (tone === "danger") return "border-rose-300/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25";
  if (tone === "warn") return "border-amber-300/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25";
  return "border-emerald-300/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20";
}

export function DeliverabilityActions() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(action: ActionKey) {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/deliverability/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(data.message ?? data.error ?? "Control action completed.");
    });
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-300">Fail-safe controls</p>
          <h2 className="mt-2 text-2xl font-black">Quick protection actions</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            These update the existing HomeReach safety switches. They do not delete queues,
            change payments, or bypass approval requirements.
          </p>
        </div>
        {message ? (
          <div className="rounded-xl border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-100">
            {message}
          </div>
        ) : null}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ACTIONS.map((action) => (
          <button
            key={action.key}
            type="button"
            disabled={pending}
            onClick={() => run(action.key)}
            className={`rounded-xl border px-4 py-3 text-left text-sm font-black transition disabled:cursor-wait disabled:opacity-60 ${classForTone(action.tone)}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
