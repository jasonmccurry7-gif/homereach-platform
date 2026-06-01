"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clipboard, Save } from "lucide-react";
import { MARKET_CAPTURE_PIPELINE_STAGES, MARKET_CAPTURE_STAGE_LABELS } from "@/lib/market-capture/campaign";

type Props =
  | { mode: "stage"; leadId: string; currentStage: string }
  | { mode: "task"; leadId: string; taskId: string; taskStatus: string }
  | { mode: "note"; leadId: string }
  | { mode: "copy"; copyText: string };

export function MarketCaptureLeadActions(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(leadId: string, body: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/market-capture/${leadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Update failed.");
      return;
    }
    router.refresh();
  }

  if (props.mode === "copy") {
    const { copyText } = props;
    async function copy() {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
    return (
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50"
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
      </button>
    );
  }

  if (props.mode === "stage") {
    return (
      <form
        action={(formData) => {
          const stage = String(formData.get("stage") ?? props.currentStage);
          const note = String(formData.get("note") ?? "");
          void post(props.leadId, { action: "update_stage", stage, note });
        }}
        className="grid gap-2 sm:min-w-[22rem]"
      >
        <select name="stage" defaultValue={props.currentStage} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800">
          {MARKET_CAPTURE_PIPELINE_STAGES.map((stage) => (
            <option key={stage} value={stage}>{MARKET_CAPTURE_STAGE_LABELS[stage]}</option>
          ))}
        </select>
        <input name="note" placeholder="Optional stage note" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm" />
        <button disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-600 disabled:opacity-50">
          <Save className="h-4 w-4" aria-hidden="true" />
          Update Stage
        </button>
        {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
      </form>
    );
  }

  if (props.mode === "task") {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {["open", "in_progress", "completed", "blocked"].map((status) => (
          <button
            key={status}
            type="button"
            disabled={busy || props.taskStatus === status}
            onClick={() => post(props.leadId, { action: "update_task", taskId: props.taskId, status })}
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {status.replace(/_/g, " ")}
          </button>
        ))}
        {error ? <p className="basis-full text-xs font-bold text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        const content = String(formData.get("content") ?? "");
        if (content.trim()) void post(props.leadId, { action: "add_note", content });
      }}
      className="mt-4 grid gap-2"
    >
      <textarea name="content" rows={3} placeholder="Add a note..." className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <button disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50">
        <Save className="h-4 w-4" aria-hidden="true" />
        Add Note
      </button>
      {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
    </form>
  );
}
