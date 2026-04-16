// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Public Homepage — home-reach.com
// CRO-optimized: Hero → Problem → Solution → Products → Proof → Scarcity → CTA
// Messaging: "Own your category" · Not "grow your business"
// Primary CTA: Check Availability / Claim Your Category
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HomeReach — Own Your Category. Own Your City.",
  description:
    "One business. One category. One city. HomeReach puts your name on a postcard to 2,500+ homeowners every month — and locks out every competitor in your trade.",
};

function CheckIcon({ className = "text-blue-400" }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 shrink-0 mt-0.5 ${className}`} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* NAV */}
      <header className="border-b border-gray-800/60 bg-gray-950/95 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs shadow-md">HR</div>
            <span className="text-base font-bold text-white">HomeReach</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-400">
            <Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link>
            <Link href="#products" className="hover:text-white transition-colors">Products</Link>
            <Link href="/get-started" className="hover:text-white transition-colors">Availability</Link>
          </nav>
          <Link href="/get-started" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-500 transition-colors">
            Check Availability →
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-950/40 via-gray-950 to-gray-950" />
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-blue-600/8 blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-20 text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-amber-700/40 bg-amber-900/20 px-4 py-1.5 text-xs font-bold text-amber-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            Only 1 business per category per city — spots are filling
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight">
            <span className="text-white">Own Your Category.</span>
            <br />
            <span className="text-blue-400">Own Your City.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-xl text-gray-300 leading-relaxed">
            HomeReach puts your business on a postcard to{" "}
            <strong className="text-white">2,500+ homeowners</strong> in your city — every single month. One business per category. No competitors.{" "}
            <strong className="text-white">Just you.</strong>
          </p>

          <div className="mt-6 inline-block rounded-xl border border-blue-800/40 bg-blue-900/20 px-6 py-3">
            <p className="text-sm text-blue-300">
              <span className="text-2xl font-black text-white">$0.08</span>
              {" "}per home · 2,500 homes · Starting at $200/month
            </p>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/get-started" className="rounded-xl bg-blue-600 px-10 py-4 text-base font-bold text-white shadow-xl transition-all hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-blue-500/30">
              Check Availability in Your City →
            </Link>
            <Link href="/how-it-works" className="rounded-xl border border-gray-700 bg-gray-900 px-8 py-4 text-base font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:bg-gray-800 hover:text-white">
              See How It Works
            </Link>
          </div>

          <p className="mt-4 text-xs text-gray-600">No commitment to check · Takes 60 seconds · Spot reserves at signup</p>

          <div className="mt-14 flex flex-wrap justify-center gap-6 text-sm text-gray-500">
            {["✓ Category exclusive", "✓ No long-term contracts", "✓ Professional design included", "✓ Ohio-based team"].map(t => (
              <span key={t} className="font-medium">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* STAT STRIP */}
      <div className="border-y border-gray-800 bg-gray-900/60">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 text-center">
            {[
              { value: "2,500+",      sub: "Homeowners reached per month" },
              { value: "$0.08",       sub: "Cost per homeowner reached" },
              { value: "1 per city",  sub: "Exclusive per category" },
              { value: "Monthly",     sub: "Consistent top-of-mind" },
            ].map(s => (
              <div key={s.sub}>
                <p className="text-3xl font-black text-white">{s.value}</p>
                <p className="mt-1 text-xs text-gray-500 font-medium">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PROBLEM */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3">The real problem</p>
        <h2 className="text-4xl font-black text-white leading-tight">
          Homeowners in Your City Don&apos;t Know You Exist
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-gray-400 leading-relaxed">
          You do great work. But when a homeowner needs a roofer, an HVAC tech, or a landscaper — they search Google, find three competitors, and pick whoever shows up first.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3 text-left">
          {[
            { icon: "🔍", title: "Google ads punish you", body: "You pay $15–$40 per click. That same click goes to your top 3 competitors too. You're renting attention you don't own." },
            { icon: "📱", title: "Social posts disappear", body: "You post, get 12 likes from family, and it's gone in 48 hours. No homeowner is thinking about you when their HVAC breaks in July." },
            { icon: "🔄", title: "Feast-or-famine cycle", body: "Busy season comes, slow season destroys momentum. No consistent presence = no predictable pipeline." },
          ].map(item => (
            <div key={item.title} className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
              <span className="text-3xl">{item.icon}</span>
              <h3 className="mt-3 text-base font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SOLUTION */}
      <section className="border-y border-gray-800 bg-gradient-to-b from-blue-950/20 to-gray-950 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">The HomeReach model</p>
          <h2 className="text-4xl font-black text-white leading-tight">
            One Business. One Category. One City.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-gray-300 leading-relaxed">
            We send a premium postcard to 2,500+ homeowners in your city every month.
            Your business is the only one in your trade on that card.{" "}
            <strong className="text-white">You own the category. Your competitor can&apos;t buy it away.</strong>
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              { step: "01", icon: "📬", title: "We mail your city monthly", body: "Premium oversized postcards hit 2,500+ targeted homeowner addresses in your service area — every month, on autopilot.", color: "text-blue-400" },
              { step: "02", icon: "🔒", title: "You're locked in — alone", body: "Your business is the only one featured in your category on the card. No competitor can appear beside you. You're the only option they see.", color: "text-green-400" },
              { step: "03", icon: "📞", title: "Homeowners call you first", body: "Month after month, your name lands in their mailbox. When they need your service, you're the business they remember — and trust.", color: "text-purple-400" },
            ].map(item => (
              <div key={item.step} className="rounded-2xl border border-gray-800 bg-gray-900 p-7 text-left">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{item.icon}</span>
                  <span className={`text-2xl font-black opacity-40 ${item.color}`}>{item.step}</span>
                </div>
                <h3 className={`text-base font-bold mb-2 ${item.color}`}>{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BEFORE / AFTER */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-green-400 mb-3">The shift</p>
          <h2 className="text-4xl font-black text-white">Before HomeReach vs. After</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-red-400 mb-4">❌ Before</p>
            <ul className="space-y-3">
              {[
                "Competing on Google with 3+ other contractors for the same click",
                "Paying per click with no guaranteed return",
                "Forgotten between seasons — no consistent presence",
                "Hoping for referrals, reviews, and word-of-mouth",
                "Your competitor owns the neighborhood. You're invisible.",
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-red-200/80">
                  <span className="text-red-500 mt-0.5 shrink-0 font-bold">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-green-800/40 bg-green-950/20 p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-green-400 mb-4">✅ After HomeReach</p>
            <ul className="space-y-3">
              {[
                "You're the only business in your trade on the card — zero competition",
                "$0.08 per homeowner reached, $200/month flat",
                "In 2,500 mailboxes every month, building trust consistently",
                "Homeowners see your name before they search Google",
                "You own the category. Your city. Your customers.",
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-green-200/80">
                  <CheckIcon className="text-green-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-8 text-center">
          <Link href="/get-started" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-10 py-4 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-blue-500">
            Check If Your Category Is Open →
          </Link>
        </div>
      </section>

      {/* PRODUCTS */}
      <section id="products" className="border-y border-gray-800 bg-gray-900/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">Choose your weapon</p>
            <h2 className="text-4xl font-black text-white">Three Ways to Own Your Market</h2>
            <p className="mx-auto mt-4 max-w-lg text-gray-400">Whether you want to dominate your local city or expand across multiple markets — we have the product for you.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Shared Postcard */}
            <div className="relative rounded-2xl border border-blue-700/50 bg-gradient-to-b from-blue-950/40 to-gray-900 p-8 flex flex-col">
              <div className="absolute -top-3 left-5">
                <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">MOST POPULAR</span>
              </div>
              <div className="flex items-start justify-between mb-5 mt-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">Shared Postcard</p>
                  <h3 className="text-2xl font-black text-white">Postcard Spot</h3>
                </div>
                <span className="text-3xl">📬</span>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed mb-6">Your business on a premium postcard to 2,500+ homeowners in your city. One exclusive spot per category. No competitors on the same card. Ever.</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {["2,500+ homeowners per month", "1 business per category — locked", "Professional design included", "Monthly delivery, no annual lock-in", "Dashboard to track results"].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300"><CheckIcon />{f}</li>
                ))}
              </ul>
              <div className="border-t border-gray-800 pt-5 mb-5">
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-white">$200</p>
                  <p className="text-sm text-gray-400">/month</p>
                </div>
                <p className="text-xs text-blue-300 mt-1">$0.08 per homeowner reached</p>
              </div>
              <Link href="/get-started" className="block w-full rounded-xl bg-blue-600 py-3.5 text-center text-sm font-bold text-white transition-colors hover:bg-blue-500">
                Claim Your Category →
              </Link>
            </div>

            {/* Targeted Campaign */}
            <div className="rounded-2xl border border-gray-700 bg-gray-900 p-8 flex flex-col">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-purple-400 mb-1">Any US City</p>
                  <h3 className="text-2xl font-black text-white">Targeted Campaign</h3>
                </div>
                <span className="text-3xl">🎯</span>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed mb-6">Your own dedicated postcard — no other businesses on the card. Target any city in the US. 500 to 5,000 homes per run.</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {["Any city in the United States", "100% dedicated — your card only", "500 to 5,000 homes per campaign", "Full design customization", "One-time or recurring, your choice"].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300"><CheckIcon className="text-purple-400" />{f}</li>
                ))}
              </ul>
              <div className="border-t border-gray-800 pt-5 mb-5">
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-white">$350</p>
                  <p className="text-sm text-gray-400">one-time</p>
                </div>
                <p className="text-xs text-purple-300 mt-1">Recurring available for ongoing markets</p>
              </div>
              <Link href="/targeted" className="block w-full rounded-xl border border-purple-600 py-3.5 text-center text-sm font-bold text-purple-300 transition-colors hover:bg-purple-900/30">
                Launch a Campaign →
              </Link>
            </div>

            {/* Property Intelligence */}
            <div className="relative rounded-2xl border border-amber-700/50 bg-gradient-to-b from-amber-950/30 to-gray-900 p-8 flex flex-col">
              <div className="absolute -top-3 left-5">
                <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-black">NEW · FOUNDING RATE</span>
              </div>
              <div className="flex items-start justify-between mb-5 mt-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">Intent-Based Leads</p>
                  <h3 className="text-2xl font-black text-white">Property Intelligence</h3>
                </div>
                <span className="text-3xl">🏠</span>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed mb-6">We identify homeowners who need your service — before they start searching. Delivered monthly. Category exclusivity at Tier 3.</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {["Pre-qualified homeowner leads by trade", "Verified intent signals per city", "Category exclusivity at top tier", "Monthly automatic delivery", "Founding Member rates locked for life"].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300"><CheckIcon className="text-amber-400" />{f}</li>
                ))}
              </ul>
              <div className="border-t border-gray-800 pt-5 mb-5">
                <p className="text-xs text-gray-500 line-through mb-1">From $400/month standard</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-amber-400">$200</p>
                  <p className="text-sm text-gray-400">/month</p>
                </div>
                <p className="text-xs text-green-400 mt-1">🏷️ Founding rate locks in forever</p>
              </div>
              <Link href="/intelligence" className="block w-full rounded-xl bg-amber-500 py-3.5 text-center text-sm font-black text-black transition-colors hover:bg-amber-400">
                Claim Founding Rate →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PROOF */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-green-400 mb-3">Why it works</p>
          <h2 className="text-4xl font-black text-white">The Math Is Simple</h2>
          <p className="mx-auto mt-4 max-w-lg text-gray-400">At $0.08 per homeowner, you only need one job to see a return. Every job beyond that is pure profit.</p>
        </div>

        <div className="mb-14 mx-auto max-w-3xl rounded-2xl border border-blue-800/40 bg-gradient-to-b from-blue-950/30 to-gray-900 p-10">
          <h3 className="text-xl font-black text-white text-center mb-8">Example: HVAC Business, Cleveland OH</h3>
          <div className="grid gap-6 sm:grid-cols-3 text-center">
            <div>
              <p className="text-4xl font-black text-white">$200</p>
              <p className="text-sm text-gray-400 mt-1">Monthly cost</p>
            </div>
            <div>
              <p className="text-4xl font-black text-blue-400">2,500</p>
              <p className="text-sm text-gray-400 mt-1">Homeowners reached</p>
            </div>
            <div>
              <p className="text-4xl font-black text-green-400">1 job</p>
              <p className="text-sm text-gray-400 mt-1">Needed to break even</p>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-800 pt-6 text-center">
            <p className="text-gray-300 text-sm leading-relaxed max-w-lg mx-auto">
              The average HVAC job is $800–$2,500. One call from a postcard covers 4–12 months of cost. Most businesses see <span className="font-bold text-white">3–5 jobs per month</span> by month 3.
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { stat: "3–5×", label: "Typical return on ad spend", body: "Each dollar you spend reaches targeted homeowners in your exact service area — not random internet clicks.", color: "text-green-400", border: "border-green-800/30", bg: "from-green-950/20" },
            { stat: "Month 3", label: "When most businesses see traction", body: "Mailers work on repetition. By month 3, homeowners recognize your name and trust you before they call.", color: "text-blue-400", border: "border-blue-800/30", bg: "from-blue-950/20" },
            { stat: "0", label: "Competitors on your card — ever", body: "While your competition fights over Google Ads, you have the only presence in your category in 2,500 mailboxes.", color: "text-purple-400", border: "border-purple-800/30", bg: "from-purple-950/20" },
          ].map(item => (
            <div key={item.label} className={`rounded-2xl border ${item.border} bg-gradient-to-b ${item.bg} to-gray-900 p-8`}>
              <p className={`text-4xl font-black mb-2 ${item.color}`}>{item.stat}</p>
              <p className="text-base font-bold text-white mb-3">{item.label}</p>
              <p className="text-sm text-gray-400 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SCARCITY */}
      <section className="border-y border-gray-800 bg-gray-900/30 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="rounded-2xl border border-red-900/40 bg-gradient-to-br from-red-950/30 to-gray-900 p-10">
            <div className="grid sm:grid-cols-2 gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-red-700/40 bg-red-900/30 px-3 py-1 text-xs font-bold text-red-300 mb-4">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                  Availability is real-time
                </div>
                <h2 className="text-3xl font-black text-white leading-tight">
                  Your Category Is Either Open…<br />
                  <span className="text-red-400">Or It&apos;s Gone.</span>
                </h2>
                <p className="mt-4 text-gray-300 leading-relaxed">
                  The moment another roofer, HVAC tech, or landscaper in your city claims the spot — it&apos;s locked. There&apos;s no waitlist. No buyout. No getting it back unless they cancel.
                </p>
                <p className="mt-3 text-sm text-gray-500">We built this model around scarcity because exclusivity only works if the limit is real. It is.</p>
                <Link href="/get-started" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-bold text-white transition-colors hover:bg-blue-500">
                  Check Availability Before It&apos;s Gone →
                </Link>
              </div>
              <div className="space-y-3">
                {[
                  { category: "Roofing",           city: "Wooster, OH",   status: "🔴 Taken",   cls: "text-red-400" },
                  { category: "Landscaping",        city: "Wooster, OH",   status: "🟢 Open",    cls: "text-green-400" },
                  { category: "HVAC",               city: "Medina, OH",    status: "🟢 Open",    cls: "text-green-400" },
                  { category: "Plumbing",           city: "Medina, OH",    status: "🔴 Taken",   cls: "text-red-400" },
                  { category: "Concrete & Masonry", city: "Wooster, OH",   status: "🟡 1 left",  cls: "text-amber-400" },
                  { category: "Pressure Washing",   city: "Mansfield, OH", status: "🟢 Open",    cls: "text-green-400" },
                ].map(row => (
                  <div key={`${row.category}-${row.city}`} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{row.category}</p>
                      <p className="text-xs text-gray-500">{row.city}</p>
                    </div>
                    <span className={`text-xs font-bold ${row.cls}`}>{row.status}</span>
                  </div>
                ))}
                <p className="text-center text-xs text-gray-600 pt-1">Illustrative sample — check your actual city below</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW TO GET STARTED */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">Getting started</p>
        <h2 className="text-4xl font-black text-white mb-14">You&apos;re Live in 2 Weeks</h2>
        <div className="grid gap-6 sm:grid-cols-4">
          {[
            { step: "1", icon: "🔍", title: "Check availability", body: "See if your category is open in your city. Takes 60 seconds." },
            { step: "2", icon: "📋", title: "Pick your spot", body: "Choose your city, your category, and your postcard tier." },
            { step: "3", icon: "🎨", title: "We design it", body: "Our team builds your postcard — professional, ready to mail." },
            { step: "4", icon: "📬", title: "Homeowners see you", body: "2,500 homeowners get your card. Every month. Just you." },
          ].map(item => (
            <div key={item.step} className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/20 border border-blue-700/40 text-2xl mb-4">{item.icon}</div>
              <p className="text-xs font-bold text-blue-400 mb-1">STEP {item.step}</p>
              <h3 className="text-sm font-bold text-white mb-2">{item.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-gray-800 bg-gradient-to-b from-gray-950 to-blue-950/20 py-28">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-5xl font-black text-white leading-tight">
            Own Your Category.<br />
            <span className="text-blue-400">Before Someone Else Does.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-lg text-gray-300 leading-relaxed">
            While you&apos;re reading this, another business in your trade might be checking the same availability. The first to claim it keeps it.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/get-started" className="rounded-xl bg-blue-600 px-14 py-4 text-base font-bold text-white shadow-2xl transition-all hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-blue-500/30">
              Check Availability Now →
            </Link>
          </div>
          <p className="mt-5 text-xs text-gray-600">60 seconds to check · No commitment · Spot reserves at signup only</p>
          <div className="mt-12 flex flex-wrap justify-center gap-5 text-xs text-gray-600">
            {["✓ Ohio-based team", "✓ Professional postcard design", "✓ Category exclusive — guaranteed", "✓ No long-term contracts"].map(t => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-800 bg-gray-900/40">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white font-black text-xs">HR</div>
            <span className="text-sm font-bold text-gray-300">HomeReach</span>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-5 text-sm text-gray-500">
            <Link href="/get-started"  className="hover:text-gray-300 transition-colors">Shared Postcards</Link>
            <Link href="/targeted"      className="hover:text-gray-300 transition-colors">Targeted Campaigns</Link>
            <Link href="/intelligence"  className="hover:text-amber-400 transition-colors font-medium text-amber-500">Property Intelligence ✦</Link>
            <Link href="/how-it-works"  className="hover:text-gray-300 transition-colors">How It Works</Link>
            <Link href="/nonprofit"     className="hover:text-gray-300 transition-colors">Nonprofits</Link>
            <Link href="/login"         className="hover:text-gray-300 transition-colors">Log In</Link>
          </div>
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} HomeReach. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
