// ─────────────────────────────────────────────────────────────────────────────
// How It Works — home-reach.com/how-it-works
// Deep explainer: process, FAQ, and trust-building before /get-started
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works — HomeReach",
  description:
    "See exactly how HomeReach works: category-exclusive postcards to 2,500+ homeowners, one business per city per trade, professional design, monthly delivery.",
};

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* NAV */}
      <header className="border-b border-gray-800/60 bg-gray-950/95 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs shadow-md">HR</div>
            <span className="text-base font-bold text-white">HomeReach</span>
          </Link>
          <Link href="/get-started" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-500 transition-colors">
            Check Availability →
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">The complete picture</p>
        <h1 className="text-5xl font-black text-white leading-tight">
          How HomeReach Works
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-gray-300 leading-relaxed">
          Category-exclusive postcard advertising for local home service businesses.
          One business. One trade. One city. Every month.
        </p>
      </section>

      {/* STEP BY STEP */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="space-y-6">
          {[
            {
              step: "01",
              icon: "🔍",
              title: "You check availability",
              body: "Visit home-reach.com/get-started, pick your city and your trade (roofing, HVAC, landscaping, plumbing, etc.), and see instantly if your spot is open. This takes about 60 seconds. No commitment to check.",
              detail: "Our system shows real-time availability based on active orders in your city. If a competitor has already claimed your category, you'll see that — and you can join a notification list if they ever cancel.",
              color: "bg-blue-600",
            },
            {
              step: "02",
              icon: "📋",
              title: "You claim your category",
              body: "If your spot is available, you complete a simple intake form: your business name, contact info, service category, and city. That's it. No long onboarding.",
              detail: "Once you complete the intake, your spot is reserved for 48 hours while we confirm details. A HomeReach team member will reach out within 1 business day to finalize your design preferences and confirm your first mailing date.",
              color: "bg-green-600",
            },
            {
              step: "03",
              icon: "🎨",
              title: "We design your postcard",
              body: "Our team creates a professional, full-color postcard featuring your business — exclusively in your category. No other businesses appear on your card.",
              detail: "We handle everything: design, copywriting, layout. You'll get a proof to review before anything goes to print. Most proofs are ready within 3–5 business days. Revisions are included.",
              color: "bg-purple-600",
            },
            {
              step: "04",
              icon: "✅",
              title: "You approve, we mail",
              body: "Once you approve the design, we handle printing and mailing to 2,500+ verified homeowner addresses in your target city. You don't lift a finger.",
              detail: "We use premium oversized postcards (6×9 or larger) mailed via USPS Every Door Direct Mail (EDDM) to ensure maximum delivery rates. Postcards go out within 2 weeks of approval.",
              color: "bg-amber-600",
            },
            {
              step: "05",
              icon: "📬",
              title: "Homeowners see you — every month",
              body: "Month after month, your name lands in 2,500+ mailboxes in your city. You're the only business in your category on the card. No competitors. Just you.",
              detail: "The consistency is the key. Homeowners don't act on the first postcard — they act when they need something. By showing up every month, you're the name they remember when the furnace breaks or the roof starts leaking.",
              color: "bg-blue-600",
            },
            {
              step: "06",
              icon: "📞",
              title: "Phone rings. You close jobs.",
              body: "Homeowners call. You close. That's the whole model. No platform algorithms. No pay-per-click bidding wars. Just a direct line from your name to their phone.",
              detail: "Track inbound calls in your HomeReach dashboard. We recommend adding a unique phone number or promo code to your postcard so you can attribute jobs directly to your HomeReach presence.",
              color: "bg-green-600",
            },
          ].map(item => (
            <div key={item.step} className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
              <div className="flex items-start gap-5 p-8">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.color} text-2xl`}>
                  {item.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-black text-gray-600 uppercase tracking-wider">STEP {item.step}</span>
                  </div>
                  <h3 className="text-xl font-black text-white mb-3">{item.title}</h3>
                  <p className="text-gray-300 leading-relaxed mb-4">{item.body}</p>
                  <p className="text-sm text-gray-500 leading-relaxed border-l-2 border-gray-700 pl-4">{item.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/get-started" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-10 py-4 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-blue-500">
            Check Availability in Your City →
          </Link>
          <p className="mt-3 text-xs text-gray-600">60 seconds to check · No commitment required</p>
        </div>
      </section>

      {/* THE EXCLUSIVITY GUARANTEE */}
      <section className="border-y border-gray-800 bg-blue-950/20 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">The guarantee</p>
          <h2 className="text-3xl font-black text-white mb-5">The Exclusivity Is Real</h2>
          <p className="text-gray-300 leading-relaxed text-lg">
            When we say <strong className="text-white">one business per category per city</strong>, we mean it.
            Our system enforces this at the order level — once a roofer claims Wooster, Ohio,
            no other roofing company can purchase that slot until they cancel.
          </p>
          <p className="mt-4 text-gray-400 leading-relaxed">
            This isn&apos;t a sales tactic. It&apos;s the entire premise of the product.
            If exclusivity were optional, the whole value proposition collapses.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Per city", val: "1 slot", sub: "per service category" },
              { label: "Lock duration", val: "Ongoing", sub: "until the business cancels" },
              { label: "Waitlist", val: "None", sub: "first to claim, first to keep" },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-blue-800/30 bg-blue-900/20 p-5">
                <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">{item.label}</p>
                <p className="text-2xl font-black text-white">{item.val}</p>
                <p className="text-xs text-gray-500 mt-1">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-24">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">Common questions</p>
          <h2 className="text-3xl font-black text-white">Everything You&apos;re Wondering</h2>
        </div>
        <div className="space-y-5">
          {[
            {
              q: "What is EDDM (Every Door Direct Mail)?",
              a: "EDDM is a USPS program that delivers mail to every home on a specific postal route. We use this to reach every homeowner in your target area — no purchased list required, no guessing. 100% delivery to physical mailboxes.",
            },
            {
              q: "How do I know the postcard is reaching the right homeowners?",
              a: "We target residential addresses in your city's highest-value postal routes — neighborhoods where homeowners are most likely to have money to spend on home services. You can review the target routes before we mail.",
            },
            {
              q: "What categories do you serve?",
              a: "Currently: Roofing, HVAC, Plumbing, Landscaping, Concrete & Masonry, Junk Removal, Pressure Washing, Windows & Doors, Garage Doors, Painting, Electrical, Home Remodeling, and General Home Services. More being added monthly.",
            },
            {
              q: "What cities are you in?",
              a: "We currently serve 11 cities in Ohio: Wooster, Medina, Ashland, Mansfield, Mount Vernon, Coshocton, Millersburg, Loudonville, Orrville, Rittman, and Dover/New Philadelphia. We're expanding — email us if your city isn't listed.",
            },
            {
              q: "Can I be in multiple cities?",
              a: "Yes. You can claim your category in as many cities as you serve. Each city is a separate subscription. If you're an HVAC company covering both Wooster and Medina, you can lock both spots.",
            },
            {
              q: "Do I have to sign a long-term contract?",
              a: "No. HomeReach is month-to-month. We recommend staying at least 3 months to see the full compounding effect of repetition, but there's no penalty for canceling. Just give us 30 days notice before your next billing cycle.",
            },
            {
              q: "What does the postcard look like?",
              a: "Premium oversized (6×9 or larger) full-color postcard. Your business name, logo, phone number, and a strong call to action are featured prominently. Your category is highlighted. No other businesses appear on the card. Design is professional and done by our team — included in your subscription.",
            },
            {
              q: "How long until I see results?",
              a: "Direct mail is a brand-building medium — it works through repetition. Most businesses see their first inbound calls within the first 1–2 months. By month 3, you typically have name recognition in the neighborhood. We recommend measuring over a 90-day window.",
            },
            {
              q: "What if my competitor already took my spot?",
              a: "Your category in your city is marked as taken. You can request to be notified if that business cancels. In the meantime, you can claim the same category in a neighboring city, or choose a different product (Targeted Campaign) that doesn't require exclusivity.",
            },
          ].map(item => (
            <div key={item.q} className="rounded-2xl border border-gray-800 bg-gray-900 p-7">
              <h3 className="text-base font-bold text-white mb-3">{item.q}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-gray-800 bg-gradient-to-b from-gray-950 to-blue-950/20 py-24">
        <div className="mx-auto max-w-xl px-6 text-center">
          <h2 className="text-4xl font-black text-white leading-tight">
            Ready to Own Your Category?
          </h2>
          <p className="mt-4 text-gray-400 leading-relaxed">
            Check if your city and trade are still available. Takes 60 seconds.
            No commitment until you complete signup.
          </p>
          <div className="mt-8">
            <Link href="/get-started" className="inline-block rounded-xl bg-blue-600 px-12 py-4 text-base font-bold text-white shadow-xl transition-all hover:-translate-y-0.5 hover:bg-blue-500">
              Check Availability →
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-600">No commitment to check · Spot reserves at signup only</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-800 bg-gray-900/40">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white font-black text-xs">HR</div>
            <span className="text-sm font-bold text-gray-300">HomeReach</span>
          </Link>
          <div className="flex flex-wrap justify-center gap-5 text-sm text-gray-500">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <Link href="/get-started" className="hover:text-gray-300 transition-colors">Get Started</Link>
            <Link href="/targeted" className="hover:text-gray-300 transition-colors">Targeted Campaigns</Link>
            <Link href="/login" className="hover:text-gray-300 transition-colors">Log In</Link>
          </div>
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} HomeReach</p>
        </div>
      </footer>
    </div>
  );
}
