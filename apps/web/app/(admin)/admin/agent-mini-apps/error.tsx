"use client";

export default function AgentMiniAppsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#07111f] p-4 text-white sm:p-6 lg:p-8">
      <section className="mx-auto max-w-3xl rounded-lg border border-rose-300/25 bg-rose-400/10 p-5">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-rose-100">Agent Mini Apps error</p>
        <h1 className="mt-2 text-2xl font-black">Today&apos;s Agent Stack could not load.</h1>
        <p className="mt-2 text-sm leading-6 text-rose-50/80">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md border border-rose-100/30 bg-rose-100 px-3 py-2 text-sm font-black text-rose-950"
        >
          Retry
        </button>
      </section>
    </main>
  );
}
