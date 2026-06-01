"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";

export default function SupplifyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-amber-100">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <p className="text-xs font-black uppercase tracking-[0.18em]">
              Supplify Recovery
            </p>
          </div>
          <h1 className="mt-3 text-3xl font-black text-white">
            Supplify paused this view before showing unreliable data.
          </h1>
          <p className="mt-3 text-sm leading-6 text-amber-50/85">
            The profitability command center could not finish loading this route.
            No supplier order, vendor switch, payment, or spend action was made.
          </p>
          {error.digest ? (
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-amber-100/80">
              Error reference: {error.digest}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[360px]">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber-200 px-4 py-2 text-sm font-black text-neutral-950 hover:bg-amber-100"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
          <Link
            href="/operations-copilot"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/10"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Command
          </Link>
        </div>
      </div>
    </section>
  );
}
