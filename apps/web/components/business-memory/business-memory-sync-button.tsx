"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function BusinessMemorySyncButton({
  endpoint,
  label = "Sync Memory",
}: {
  endpoint: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setState("syncing");
    setMessage(null);
    try {
      const response = await fetch(endpoint, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? "Sync failed.");
      }
      setState("done");
      setMessage(`${body.profilesTouched ?? 0} profile${body.profilesTouched === 1 ? "" : "s"} updated.`);
      window.location.reload();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Sync failed.");
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={sync}
        disabled={state === "syncing"}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${state === "syncing" ? "animate-spin" : ""}`} aria-hidden="true" />
        {state === "syncing" ? "Syncing..." : label}
      </button>
      {message ? (
        <p className={`text-xs font-semibold ${state === "error" ? "text-red-700" : "text-slate-500"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
