// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Public Homepage — home-reach.com
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HomeReach — Local Marketing That Works",
  description:
    "Postcards, digital ads, and automation — reaching 2,500+ homes in your city, every single month.",
};

const STATS = [
  { value: "15,000+", label: "Homes per city per drop" },
  { value: "100%", label: "Category exclusive" },
  { value: "3–5×", label: "Avg return on ad spend" },
  { value: "2-week", label: "Setup to first drop" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Claim your spot",
    body: "Choose your city and category. Your business is the only one in your trade on the entire mailer — guaranteed.",
  },
  {
    step: "02",
    title: "We handle everything",
    body: "Professional postcard design, printing, and delivery. 15,000 homes, every month. Zero work from you.",
  },
  {
    step: "03",
    title: "Track every result",
    body: "Watch your scans, calls, and leads roll in from your dashboard. Real data, not estimates.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs shadow-md">
              HR
            </div>
            <span className="text-base font-bold text-white">HomeReach</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-6">
            <Link
              href="/get-started"
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/targeted"
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              Targeted Campaigns
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors px-3 py-1.5"
            >
              Log in
            </Link>
            <Link
              href="/get-started"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-gray-950 to-gray-950 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-700/40 bg-blue-900/20 px-4 py-1.5 text-xs font-medium text-blue-300 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            Spots are limited in every city
          </div>

          <h1 className="text-5xl sm:text-6xl font-black leading-tight tracking-tight">
            Your business in<br />
            <span className="text-blue-400">every neighborhood</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-gray-300 leading-relaxed">
            Postcards, digital ads, and automated follow-up — reaching
            15,000+ homes in your city, every single month. 100% category
            exclusive.
          </p>

          {/* Primary CTAs */}
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/get-started"
              className="rounded-xl bg-blue-600 px-8 py-3.5 text-base font-bold text-white shadow-lg hover:bg-blue-500 transition-all hover:-translate-y-0.5"
            >
              Claim your spot →
            </Link>
            <Link
              href="/targeted"
              className="rounded-xl border border-gray-700 bg-gray-900 px-8 py-3.5 text-base font-bold text-gray-200 hover:bg-gray-800 hover:border-gray-600 transition-colors"
            >
              Run a targeted campaign
            </Link>
          </div>

          {/* Secondary CTAs */}
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-gray-800"
            >
              Log in to your account
            </Link>
            <span className="text-gray-700 py-2">·</span>
            <Link
              href="/waitlist"
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-gray-800"
            >
              Join the waitlist
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="border-y border-gray-800 bg-gray-900/50">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-black text-white">{s.value}</p>
                <p className="mt-1 text-sm text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
            How it works
          </p>
          <h2 className="text-3xl font-black text-white">
            Simple. Automated. Effective.
          </h2>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {HOW_IT_WORKS.map((item) => (
            <div
              key={item.step}
              className="rounded-2xl border border-gray-800 bg-gray-900 p-7"
            >
              <p className="text-4xl font-black text-blue-600/40 mb-4">
                {item.step}
              </p>
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Exclusivity callout ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-2xl border border-blue-800/40 bg-gradient-to-br from-blue-950/60 to-gray-900 p-10 text-center">
          <span className="text-4xl">🔒</span>
          <h2 className="mt-4 text-2xl font-black text-white">
            Category exclusive — always
          </h2>
          <p className="mx-auto mt-3 max-w-md text-gray-300">
            When you claim a spot, no competing business in your trade can
            advertise on the same mailer in your city. Ever.
          </p>
          <Link
            href="/get-started"
            className="mt-6 inline-block rounded-xl bg-blue-600 px-8 py-3 text-sm font-bold text-white hover:bg-blue-500 transition-colors"
          >
            Check your city →
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800 bg-gray-900/40">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white font-black text-xs">
              HR
            </div>
            <span className="text-sm font-bold text-gray-300">HomeReach</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/get-started" className="hover:text-gray-300 transition-colors">Get started</Link>
            <Link href="/targeted" className="hover:text-gray-300 transition-colors">Targeted campaigns</Link>
            <Link href="/login" className="hover:text-gray-300 transition-colors">Log in</Link>
          </div>
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} HomeReach. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
