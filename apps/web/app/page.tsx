// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Public Homepage — home-reach.com
// High-conversion marketing page. Clear offer in 5 seconds. Strong CTAs.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HomeReach — Get Your Business in Front of 2,500+ Homeowners Every Month",
  description:
    "Category-exclusive local advertising for local businesses. One business per category per city. Reach 2,500+ targeted homeowners every single month.",
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800/60 bg-gray-950/90 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs shadow-md">
              HR
            </div>
            <span className="text-base font-bold text-white">HomeReach</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/get-started"
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              Claim Your Spot
            </Link>
          </div>
        </div>
      </header>

      {/* ── SECTION 1: HERO ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/50 via-gray-950 to-gray-950 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
          {/* Urgency chip */}
          <div className="inline-flex items-center gap-2 rounded-full border border-red-700/40 bg-red-900/20 px-4 py-1.5 text-xs font-semibold text-red-300 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            Only 1 business per category per city · Spots filling fast
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight">
            Get Your Business in Front of<br />
            <span className="text-blue-400">2,500+ Homeowners</span><br />
            in Your City Every Month
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-gray-200 leading-relaxed">
            Category-exclusive local advertising that keeps your business visible
            and helps generate consistent leads.
          </p>

          <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">
            Only 1 business per category per city. Most cities have limited spots remaining.
          </p>

          {/* Primary CTAs */}
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/get-started"
              className="rounded-xl bg-blue-600 px-10 py-4 text-base font-bold text-white shadow-lg hover:bg-blue-500 transition-all hover:-translate-y-0.5 hover:shadow-blue-500/30 hover:shadow-xl"
            >
              Claim Your Spot in Your City →
            </Link>
            <Link
              href="/get-started"
              className="rounded-xl border border-gray-600 bg-gray-900 px-8 py-4 text-base font-bold text-gray-200 hover:bg-gray-800 hover:border-gray-500 transition-colors"
            >
              Check Availability
            </Link>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            No long-term contracts · Setup in 2 weeks · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <section className="border-y border-gray-800 bg-gray-900/50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {[
              { value: "2,500+",   label: "Homes reached per city per month" },
              { value: "1 per category", label: "Exclusive business placement" },
              { value: "Monthly",  label: "Stay top-of-mind locally" },
              { value: "Limited",  label: "Spots fill by city and category" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl sm:text-3xl font-black text-white">{s.value}</p>
                <p className="mt-1 text-sm text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2: HOW IT WORKS ──────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
            Simple process
          </p>
          <h2 className="text-3xl font-black text-white">How It Works</h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              step: "01",
              icon: "📬",
              title: "We send premium mailers",
              body: "We send premium oversized mailers to top neighborhoods in your city — every single month.",
            },
            {
              step: "02",
              icon: "⭐",
              title: "Your business is featured — exclusively",
              body: "Your business is featured on the mailer, category exclusive. No competitors. Just you.",
            },
            {
              step: "03",
              icon: "📞",
              title: "Homeowners remember you",
              body: "Homeowners see you consistently month after month, so when they need your service, they call you.",
            },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl border border-gray-800 bg-gray-900 p-7">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{item.icon}</span>
                <span className="text-2xl font-black text-blue-600/40">{item.step}</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 3: WHY IT WORKS ──────────────────────────────────────── */}
      <section className="border-y border-gray-800 bg-gray-900/30 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
            The psychology
          </p>
          <h2 className="text-3xl font-black text-white mb-8">Why This Works</h2>

          <div className="rounded-2xl border border-blue-800/30 bg-gradient-to-b from-blue-950/20 to-gray-900 p-10 text-left max-w-2xl mx-auto">
            <p className="text-xl text-gray-200 font-medium leading-relaxed mb-4">
              Most homeowners don&apos;t act the first time they see an ad.
            </p>
            <p className="text-xl text-gray-200 font-medium leading-relaxed mb-4">
              They act when they need something.
            </p>
            <p className="text-lg text-gray-300 leading-relaxed">
              We make sure your business is the one they remember — by putting your
              name in front of them every single month, exclusively in your category,
              until the moment they pick up the phone.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: RESULTS ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-green-400 mb-2">
            Real outcomes
          </p>
          <h2 className="text-3xl font-black text-white">What Businesses Are Seeing</h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              stat: "3–5×",
              label: "Return on ad spend",
              body: "Businesses consistently report getting more back than they put in — because every dollar targets only homeowners in their city.",
              color: "text-green-400",
              border: "border-green-800/30",
              bg: "from-green-950/20",
            },
            {
              stat: "Monthly",
              label: "Consistent visibility",
              body: "Unlike a one-time ad or a social post, your business shows up in mailboxes every single month. Consistency builds trust.",
              color: "text-blue-400",
              border: "border-blue-800/30",
              bg: "from-blue-950/20",
            },
            {
              stat: "0 competitors",
              label: "Exclusive positioning",
              body: "You own your category in your city. No competitor can appear on the same mailer for as long as you stay active.",
              color: "text-purple-400",
              border: "border-purple-800/30",
              bg: "from-purple-950/20",
            },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-2xl border ${item.border} bg-gradient-to-b ${item.bg} to-gray-900 p-8`}
            >
              <p className={`text-4xl font-black mb-2 ${item.color}`}>{item.stat}</p>
              <p className="text-base font-bold text-white mb-3">{item.label}</p>
              <p className="text-sm text-gray-400 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 5: SCARCITY ──────────────────────────────────────────── */}
      <section className="border-y border-gray-800 bg-gray-900/30 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-2xl border border-amber-800/40 bg-gradient-to-br from-amber-950/40 to-gray-900 p-10">
            <div className="grid sm:grid-cols-2 gap-10 items-center">
              <div>
                <span className="text-4xl">⚠️</span>
                <h2 className="mt-4 text-2xl font-black text-white">
                  Your Spot Is Either Available… Or It&apos;s Gone
                </h2>
                <p className="mt-3 text-gray-300 leading-relaxed">
                  Only 1 business per category per city. The moment another business
                  in your trade claims your city, that spot is locked — and you&apos;re out.
                </p>
                <p className="mt-3 text-gray-400 text-sm">
                  Once it&apos;s taken, it&apos;s locked. There&apos;s no waitlist, no buyout.
                  The only way to get it back is if they cancel.
                </p>
                <Link
                  href="/get-started"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-bold text-white hover:bg-blue-500 transition-colors"
                >
                  Check Availability in Your City →
                </Link>
              </div>
              <div className="space-y-3">
                {[
                  { category: "Roofing",      city: "Austin, TX",    status: "🔴 Taken" },
                  { category: "Landscaping",  city: "Austin, TX",    status: "🟢 Open" },
                  { category: "Electrician",  city: "Denver, CO",    status: "🟢 Open" },
                  { category: "Pest Control", city: "Nashville, TN", status: "🔴 Taken" },
                  { category: "HVAC",         city: "Phoenix, AZ",   status: "🟡 1 left" },
                ].map((row) => (
                  <div
                    key={`${row.category}-${row.city}`}
                    className="flex items-center justify-between rounded-xl bg-gray-900 border border-gray-800 px-4 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{row.category}</p>
                      <p className="text-xs text-gray-500">{row.city}</p>
                    </div>
                    <span className="text-xs font-bold text-gray-300">{row.status}</span>
                  </div>
                ))}
                <p className="text-center text-xs text-gray-600 pt-1">
                  Illustrative — check your actual city below
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: PRICING ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
            Simple pricing
          </p>
          <h2 className="text-3xl font-black text-white">Straightforward Plans</h2>
          <p className="mx-auto mt-3 max-w-md text-gray-400">
            Simple plans starting at $200/month. Multiple placement options available
            depending on your visibility level and city.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
          {/* Shared Spot */}
          <div className="rounded-2xl border border-blue-800/40 bg-gradient-to-b from-blue-950/30 to-gray-900 p-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">Most Popular</p>
                <h3 className="text-xl font-black text-white">Shared Postcard Spot</h3>
              </div>
              <span className="text-3xl">📬</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-5">
              Your business on a premium monthly postcard to 2,500+ homeowners in your
              city. One exclusive spot per category. No competitors on the same card.
            </p>
            <ul className="space-y-2 mb-6">
              {[
                "2,500+ targeted homeowners per month",
                "1 business per category — locked in",
                "Professional design included",
                "Monthly delivery, no long-term contract",
                "Track calls and results in your dashboard",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-blue-400 mt-0.5 shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="border-t border-gray-800 pt-4 mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-400">Starting at</p>
              <p className="text-2xl font-black text-white">$200<span className="text-sm font-normal text-gray-400">/mo</span></p>
            </div>
            <Link
              href="/get-started"
              className="block w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-bold text-white hover:bg-blue-500 transition-colors"
            >
              Claim Your Spot →
            </Link>
          </div>

          {/* Targeted Campaign */}
          <div className="rounded-2xl border border-gray-700 bg-gray-900 p-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-400 mb-1">Any US City</p>
                <h3 className="text-xl font-black text-white">Targeted Campaign</h3>
              </div>
              <span className="text-3xl">🎯</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-5">
              Your own dedicated postcard — no other businesses on the card. Target
              any city in the US. Choose your reach: 500 to 5,000 homes per run.
            </p>
            <ul className="space-y-2 mb-6">
              {[
                "Any city in the United States",
                "100% dedicated — your card only",
                "500 to 5,000 homes per campaign",
                "Full design customization",
                "One-time or recurring, your choice",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-purple-400 mt-0.5 shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="border-t border-gray-800 pt-4 mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-400">Starting at</p>
              <p className="text-2xl font-black text-white">$350<span className="text-sm font-normal text-gray-400"> one-time</span></p>
            </div>
            <Link
              href="/targeted"
              className="block w-full rounded-xl border border-purple-600 py-3 text-center text-sm font-bold text-purple-300 hover:bg-purple-900/30 transition-colors"
            >
              Launch a Campaign →
            </Link>
          </div>
          {/* Property Intelligence Leads — NEW */}
          <div className="rounded-2xl border border-amber-700/50 bg-gradient-to-b from-amber-950/30 to-gray-900 p-8 relative">
            <div className="absolute -top-3 left-4">
              <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-black">NEW PRODUCT</span>
            </div>
            <div className="flex items-start justify-between mb-4 mt-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">Founding Member Pricing</p>
                <h3 className="text-xl font-black text-white">Property Intelligence Leads</h3>
              </div>
              <span className="text-3xl">🏠</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-5">
              We identify homeowners who need your service — before they start searching.
              Verified intent signals from 2,500+ homeowner data points per city.
            </p>
            <ul className="space-y-2 mb-6">
              {[
                "Pre-qualified homeowner leads by category",
                "Category exclusivity available (Tier 3)",
                "Monthly subscription — leads delivered automatically",
                "Full dashboard with lead details",
                "Founding Member rates locked in for life",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-amber-400 mt-0.5 shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="border-t border-gray-800 pt-4 mb-4">
              <p className="text-xs text-gray-500 line-through">From $400/month</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-amber-400">$200</p>
                <p className="text-sm text-gray-400">/month — Founding Member Rate</p>
              </div>
              <p className="text-xs text-green-400 mt-1">🏷️ Founding slots limited — locks in for life</p>
            </div>
            <Link
              href="/intelligence"
              className="block w-full rounded-xl bg-amber-500 py-3 text-center text-sm font-black text-black hover:bg-amber-400 transition-colors"
            >
              Claim Founding Rate →
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: FINAL CTA ─────────────────────────────────────────── */}
      <section className="border-t border-gray-800 bg-gradient-to-b from-gray-950 to-blue-950/20">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h2 className="text-4xl font-black text-white leading-tight">
            If You&apos;re Serious About Growing<br />Your Business Locally…
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-gray-300 leading-relaxed">
            This is one of the simplest ways to stay in front of homeowners
            every month. But availability is limited.
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
            Once your competitor claims your city and category — it&apos;s gone.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/get-started"
              className="rounded-xl bg-blue-600 px-12 py-4 text-base font-bold text-white shadow-lg hover:bg-blue-500 transition-all hover:-translate-y-0.5 hover:shadow-blue-500/30 hover:shadow-xl"
            >
              Claim Your Spot Now →
            </Link>
          </div>
          <p className="mt-5 text-xs text-gray-600">
            No commitment to check · Spot reserves when you complete signup
          </p>
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
          <div className="flex flex-wrap justify-center items-center gap-5 text-sm text-gray-500">
            <Link href="/get-started" className="hover:text-gray-300 transition-colors">Shared Postcards</Link>
            <Link href="/targeted"      className="hover:text-gray-300 transition-colors">Targeted Campaigns</Link>
            <Link href="/intelligence"  className="hover:text-amber-400 transition-colors font-medium text-amber-500">Property Intelligence ✦</Link>
            <Link href="/nonprofit"   className="hover:text-gray-300 transition-colors">Nonprofits</Link>
            <Link href="/login"       className="hover:text-gray-300 transition-colors">Log in</Link>
          </div>
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} HomeReach. All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  );
}
