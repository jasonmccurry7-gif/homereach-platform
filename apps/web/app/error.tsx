"use client";

import Link from "next/link";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
      <section className="w-full max-w-xl rounded-2xl border border-red-300/20 bg-red-950/20 p-6 shadow-2xl shadow-slate-950/40">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-red-200">
          HomeReach
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">
          Something did not load
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          The page hit an application error. You can retry the render or return
          to a stable command center route.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-black text-white transition hover:bg-red-500"
          >
            Try again
          </button>
          <Link
            href="/political"
            className="rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-black text-white transition hover:bg-white/[0.1]"
          >
            Political Command
          </Link>
        </div>
      </section>
    </main>
  );
}
