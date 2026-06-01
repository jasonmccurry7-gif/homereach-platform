"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function AiCooGenerateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/ai-coo/generate", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "AI COO generation failed.");
      setMessage(`${data.createdOrUpdated ?? 0} recommendation${data.createdOrUpdated === 1 ? "" : "s"} refreshed.`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "AI COO generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void generate()}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
        {busy ? "Refreshing..." : "Generate Recommendations"}
      </button>
      {message ? <p className="text-xs font-semibold text-slate-500">{message}</p> : null}
    </div>
  );
}
