import Link from "next/link";
import type { Metadata } from "next";

// ─────────────────────────────────────────────────────────────────────────────
// /political/thanks — Confirmation page after a successful lead submission.
//
// Receives a `ref` query param (the political_outreach_lead.id) so we can
// echo it back as a reference number. We deliberately don't surface anything
// else from the lead row to avoid leaking PII through a shareable URL.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Plan request received — HomeReach Campaign Mail",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function ThanksPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const ref = first(sp.ref);
  const proposalQueued = first(sp.proposal) === "queued";
  const refShort = ref.length >= 8 ? ref.slice(0, 8).toUpperCase() : "—";

  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/15 ring-2 ring-emerald-500/30">
        <svg
          className="h-8 w-8 text-emerald-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
        Plan request received
      </h1>

      <p className="mx-auto mt-4 max-w-xl text-base text-gray-400">
        {proposalQueued ? (
          <>
            Thanks. Your plan was saved, but we need a quick team review before
            opening the approval and payment link.
          </>
        ) : (
          <>
            Thanks. Our team is pulling household counts for your district and
            confirming production capacity in your drop window. Expect a tailored
            coverage + cost plan in your inbox within{" "}
            <strong className="text-white">one business day</strong>.
          </>
        )}
      </p>

      <div className="mx-auto mt-8 inline-block rounded-lg border border-gray-800 bg-gray-900/60 px-6 py-4 text-left">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Reference number
        </p>
        <p className="mt-1 font-mono text-lg font-bold text-white">{refShort}</p>
        <p className="mt-1 text-xs text-gray-500">
          Quote this if you call or email us in the meantime.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/political"
          className="rounded-lg border border-gray-700 bg-gray-900/40 px-6 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:border-gray-500 hover:text-white"
        >
          ← Back to overview
        </Link>
        <Link
          href="/political/data-sources"
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500"
        >
          How our pricing works
        </Link>
      </div>
    </div>
  );
}
