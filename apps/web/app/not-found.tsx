import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
      <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-slate-950/40">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200">
          HomeReach
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          This route is not available, or it may require a different command
          center path.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-500"
          >
            Home
          </Link>
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
