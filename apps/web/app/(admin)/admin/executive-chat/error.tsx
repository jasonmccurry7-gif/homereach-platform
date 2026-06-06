"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ExecutiveChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#07111f] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-lg border border-rose-300/25 bg-rose-300/10 p-6">
        <div className="flex gap-3">
          <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-rose-100" />
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-rose-100">Executive meeting error</p>
            <h1 className="mt-2 text-2xl font-black text-white">The command center could not load.</h1>
            <p className="mt-2 text-sm leading-6 text-rose-50/80">{error.message || "Unknown loading error."}</p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-black text-slate-950 transition hover:bg-rose-50"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
