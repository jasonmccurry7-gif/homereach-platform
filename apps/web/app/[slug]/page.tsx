// ─────────────────────────────────────────────────────────────────────────────
// City × Category Landing Pages — e.g. /wooster-roofing, /medina-hvac
// SEO-optimized local landing pages that drive to /get-started
// URL format: /{city}-{category} e.g. /wooster-roofing
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import InventoryPurchasingPage from "../inventory-purchasing/page";

// ─── data ────────────────────────────────────────────────────────────────────

const CITIES: Record<string, { display: string; county: string; state: string }> = {
  wooster:           { display: "Wooster",              county: "Wayne County",     state: "OH" },
  medina:            { display: "Medina",               county: "Medina County",    state: "OH" },
  ashland:           { display: "Ashland",              county: "Ashland County",   state: "OH" },
  mansfield:         { display: "Mansfield",            county: "Richland County",  state: "OH" },
  "mount-vernon":    { display: "Mount Vernon",         county: "Knox County",      state: "OH" },
  coshocton:         { display: "Coshocton",            county: "Coshocton County", state: "OH" },
  millersburg:       { display: "Millersburg",          county: "Holmes County",    state: "OH" },
  loudonville:       { display: "Loudonville",          county: "Ashland County",   state: "OH" },
  orrville:          { display: "Orrville",             county: "Wayne County",     state: "OH" },
  rittman:           { display: "Rittman",              county: "Wayne County",     state: "OH" },
  dover:             { display: "Dover",                county: "Tuscarawas County",state: "OH" },
};

const CATEGORIES: Record<string, {
  display: string;
  headline: string;
  pain: string;
  cta: string;
  stats: string;
  avgJob: string;
}> = {
  roofing: {
    display: "Roofing",
    headline: "The Only Roofer in {{city}} Homeowners See Every Month",
    pain: "Homeowners in {{city}} need roofing work — but they can't find you. They search Google, get four results, and call whoever has the most reviews. With HomeReach, you're in their mailbox before they ever open Google.",
    cta: "Claim the Roofing Spot in {{city}}",
    stats: "Common roofing project range: $8,000–$25,000. Final campaign economics depend on offer, timing, geography, and follow-up.",
    avgJob: "$8,000–$25,000",
  },
  hvac: {
    display: "HVAC",
    headline: "Be the Only HVAC Company {{city}} Homeowners Know By Name",
    pain: "When a furnace dies in January or AC fails in July, homeowners don't shop around — they call the first name they know. With HomeReach, that name is yours.",
    cta: "Claim the HVAC Spot in {{city}}",
    stats: "Common HVAC project range: $1,500–$8,000. Results depend on local demand, offer strength, seasonality, and follow-up.",
    avgJob: "$1,500–$8,000",
  },
  plumbing: {
    display: "Plumbing",
    headline: "Own the Plumbing Category in {{city}}",
    pain: "Plumbing emergencies don't wait. When a pipe bursts or a water heater dies, homeowners call who they remember. Be the plumber {{city}} homeowners already know.",
    cta: "Claim the Plumbing Spot in {{city}}",
    stats: "Average plumbing job: $500–$3,000. Emergency calls come at premium rates.",
    avgJob: "$500–$3,000",
  },
  landscaping: {
    display: "Landscaping",
    headline: "Be the Landscaper Every {{city}} Homeowner Calls First",
    pain: "Landscaping is a repeat business — but only if homeowners remember you. Monthly postcard presence means they do.",
    cta: "Claim the Landscaping Spot in {{city}}",
    stats: "Average landscaping relationship: $2,000–$8,000/year. One customer = years of recurring revenue.",
    avgJob: "$2,000–$8,000/yr",
  },
  "pressure-washing": {
    display: "Pressure Washing",
    headline: "The Only Pressure Washing Company {{city}} Sees Every Month",
    pain: "Pressure washing is high-frequency — homeowners need it 1–3× per year. Be top of mind before the season starts.",
    cta: "Claim the Pressure Washing Spot in {{city}}",
    stats: "Average pressure washing job: $300–$800. High volume potential in spring/fall.",
    avgJob: "$300–$800",
  },
  painting: {
    display: "Painting",
    headline: "Own the Painting Category in {{city}}",
    pain: "Homeowners delay painting projects because they don't have a painter they trust. Monthly presence builds that trust before they even start shopping.",
    cta: "Claim the Painting Spot in {{city}}",
    stats: "Average painting job: $3,000–$15,000 interior/exterior.",
    avgJob: "$3,000–$15,000",
  },
  electrical: {
    display: "Electrical",
    headline: "Be {{city}}'s Go-To Electrician Before Homeowners Search",
    pain: "Electrical jobs are trust-based and urgent. Homeowners call who they know — and with HomeReach, they know you.",
    cta: "Claim the Electrical Spot in {{city}}",
    stats: "Average electrical job: $800–$4,000. Panel upgrades and rewires run $5,000+.",
    avgJob: "$800–$4,000",
  },
  "concrete-masonry": {
    display: "Concrete & Masonry",
    headline: "Own Concrete & Masonry in {{city}}",
    pain: "Concrete and masonry are high-ticket, infrequent projects — which makes top-of-mind awareness critical. When they're ready, be the name they already know.",
    cta: "Claim the Concrete & Masonry Spot in {{city}}",
    stats: "Average concrete/masonry project: $5,000–$20,000.",
    avgJob: "$5,000–$20,000",
  },
  "junk-removal": {
    display: "Junk Removal",
    headline: "Be the Junk Removal Company {{city}} Calls Without Thinking",
    pain: "Junk removal is an impulse need. Homeowners don't shop around — they call who they remember. With monthly postcards, that's you.",
    cta: "Claim the Junk Removal Spot in {{city}}",
    stats: "Average junk removal job: $200–$800. High volume, fast turnaround.",
    avgJob: "$200–$800",
  },
  "windows-doors": {
    display: "Windows & Doors",
    headline: "Own Windows & Doors in {{city}}",
    pain: "Windows and doors are big-ticket replacement projects homeowners think about for months. Be present every month so when they're ready — they call you.",
    cta: "Claim the Windows & Doors Spot in {{city}}",
    stats: "Average window/door project: $3,000–$15,000. High referral value.",
    avgJob: "$3,000–$15,000",
  },
  "garage-doors": {
    display: "Garage Doors",
    headline: "Be {{city}}'s Only Garage Door Company in Every Mailbox",
    pain: "Garage door emergencies are urgent — homeowners call immediately. Monthly postcards mean your number is the one they reach for.",
    cta: "Claim the Garage Doors Spot in {{city}}",
    stats: "Average garage door job: $500–$3,000. Emergency calls are premium.",
    avgJob: "$500–$3,000",
  },
  "home-remodeling": {
    display: "Home Remodeling",
    headline: "Own Home Remodeling in {{city}}",
    pain: "Remodeling is the highest-value home service category. Homeowners plan for months. Be the remodeler they've been seeing in their mailbox the whole time.",
    cta: "Claim the Home Remodeling Spot in {{city}}",
    stats: "Common remodeling project range: $15,000–$75,000+. Larger projects make consistent local visibility strategically valuable.",
    avgJob: "$15,000–$75,000+",
  },
};

// ─── slug parser ─────────────────────────────────────────────────────────────

function parseSlug(slug: string): { city: string; category: string } | null {
  // Try each known city as a prefix
  const categoryKeys = Object.keys(CATEGORIES);
  for (const cityKey of Object.keys(CITIES)) {
    if (slug.startsWith(cityKey + "-")) {
      const categoryPart = slug.slice(cityKey.length + 1);
      if (categoryKeys.includes(categoryPart)) {
        return { city: cityKey, category: categoryPart };
      }
    }
  }
  return null;
}

// ─── metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  if (
    slug === "inventory-purchasing" ||
    slug === "inventory-intelligence" ||
    slug === "inventory" ||
    slug === "purchasing" ||
    slug === "find-my-savings"
  ) {
    return {
      title: "Inventory Purchasing Dashboard & Supplier Savings",
      description:
        "Track recurring supplies, compare supplier pricing, and uncover supplier savings opportunities with HomeReach.",
    };
  }

  const parsed = parseSlug(slug);
  if (!parsed) return { title: "HomeReach" };

  const city = CITIES[parsed.city];
  const cat = CATEGORIES[parsed.category];
  if (!city || !cat) return { title: "HomeReach" };
  const cityDisplay = city.display;
  const catDisplay = cat.display;

  return {
    title: `${catDisplay} in ${cityDisplay}, OH — HomeReach`,
    description: `Premium shared postcard visibility for ${catDisplay.toLowerCase()} businesses in ${cityDisplay}, OH. Availability, pricing, and route counts are confirmed before checkout.`,
  };
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function CityLandingPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (slug === "inventory-purchasing") {
    return <InventoryPurchasingPage />;
  }

  if (
    slug === "inventory-intelligence" ||
    slug === "inventory" ||
    slug === "purchasing"
  ) {
    redirect("/inventory-purchasing");
  }

  if (slug === "find-my-savings") {
    redirect("/login?redirect=/operations-copilot");
  }

  const parsed = parseSlug(slug);
  if (!parsed) notFound();

  const city = CITIES[parsed.city];
  const cat = CATEGORIES[parsed.category];
  if (!city || !cat) notFound();
  const cityDisplay = city.display;
  const catDisplay = cat.display;

  function fill(template: string) {
    return template.replace(/\{\{city\}\}/g, cityDisplay);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* NAV */}
      <header className="border-b border-gray-800/60 bg-gray-950/95 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <HomeReachLogo tone="light" size="sm" />
          </Link>
          <Link href="/get-started" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500 transition-colors">
            Claim This Spot →
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-950/40 via-gray-950 to-gray-950" />
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center">

          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-700/40 bg-blue-900/20 px-4 py-1.5 text-xs font-bold text-blue-300">
            📍 {cityDisplay}, {city.state} · {city.county}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight">
            {fill(cat.headline)}
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-gray-300 leading-relaxed">
            {fill(cat.pain)}
          </p>

          <div className="mt-8 inline-block rounded-xl border border-amber-700/40 bg-amber-900/20 px-6 py-3">
            <p className="text-sm text-amber-200">
              <span className="font-black text-amber-300">Availability is confirmed before checkout.</span> Check the {catDisplay} spot in {cityDisplay}.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/get-started" className="rounded-xl bg-blue-600 px-10 py-4 text-base font-bold text-white shadow-xl transition-all hover:-translate-y-0.5 hover:bg-blue-500">
              {fill(cat.cta)} →
            </Link>
            <Link href="/how-it-works" className="rounded-xl border border-gray-700 bg-gray-900 px-7 py-4 text-base font-semibold text-gray-300 hover:bg-gray-800 transition-colors">
              How It Works
            </Link>
          </div>

          <p className="mt-4 text-xs text-gray-600">60 seconds to check · No commitment until signup</p>
        </div>
      </section>

      {/* STATS */}
      <div className="border-y border-gray-800 bg-gray-900/60">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-black text-white">2,500+</p>
              <p className="text-xs text-gray-500 mt-1">Typical monthly household reach, verified before checkout</p>
            </div>
            <div>
              <p className="text-2xl font-black text-amber-400">1 spot</p>
              <p className="text-xs text-gray-500 mt-1">Category protection when availability is confirmed</p>
            </div>
            <div>
              <p className="text-2xl font-black text-green-400">{cat.avgJob}</p>
              <p className="text-xs text-gray-500 mt-1">Common project value range</p>
            </div>
          </div>
        </div>
      </div>

      {/* WHY THIS WORKS */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-3xl font-black text-white text-center mb-10">Why {catDisplay} Businesses in {cityDisplay} Choose HomeReach</h2>
        <div className="space-y-5">
          {[
            {
              icon: "🔒",
              title: "Category protection, verified first",
              body: `HomeReach checks the current ${catDisplay.toLowerCase()} category status in ${cityDisplay} before checkout so you know whether a protected placement is actually available.`,
            },
            {
              icon: "📬",
              title: `Local mailbox visibility in ${cityDisplay}`,
              body: `Premium oversized postcards are planned around verified household counts, route availability, and print/mail timing before a campaign is approved.`,
            },
            {
              icon: "💰",
              title: "A clearer way to buy local visibility",
              body: `${fill(cat.stats)} Final pricing and availability are confirmed before checkout, with no unsupported ROI guarantees.`,
            },
            {
              icon: "📞",
              title: "Stay visible before customers need you",
              body: `Consistent local presence helps your business stay familiar in ${cityDisplay} so homeowners have a name to remember when a need appears.`,
            },
          ].map(item => (
            <div key={item.title} className="flex gap-5 rounded-2xl border border-gray-800 bg-gray-900 p-6">
              <span className="text-3xl shrink-0">{item.icon}</span>
              <div>
                <h3 className="font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SCARCITY */}
      <section className="border-y border-gray-800 bg-red-950/10 py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-700/40 bg-red-900/20 px-3 py-1.5 text-xs font-bold text-red-300 mb-4">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            Availability: {cityDisplay}, {city.state}
          </div>
          <h2 className="text-3xl font-black text-white mb-4">
            Check Whether the {catDisplay} Spot in {cityDisplay} Is Available
          </h2>
          <p className="text-gray-400 leading-relaxed">
            HomeReach verifies current availability before checkout. If the protected spot is already active,
            we will route you to the waitlist or a targeted campaign option instead of taking an unavailable order.
          </p>
          <div className="mt-8">
            <Link href="/get-started" className="inline-block rounded-xl bg-blue-600 px-10 py-4 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-blue-500">
              Check If the {catDisplay} Spot Is Still Open →
            </Link>
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h2 className="text-3xl font-black text-white mb-4">Simple Pricing, Confirmed Before Checkout</h2>
        <p className="text-gray-400 mb-10">
          Pricing, household reach, route counts, and category availability are confirmed in the checkout flow before
          you commit. No hidden setup fees or unsupported performance promises.
        </p>
        <div className="rounded-2xl border border-blue-700/40 bg-gradient-to-b from-blue-950/30 to-gray-900 p-8">
          <div className="grid gap-4 sm:grid-cols-3 text-center mb-6">
            <div>
              <p className="text-3xl font-black text-white">Verified</p>
              <p className="text-xs text-gray-500 mt-1">Pricing before checkout</p>
            </div>
            <div>
              <p className="text-3xl font-black text-blue-400">Route</p>
              <p className="text-xs text-gray-500 mt-1">Household counts checked</p>
            </div>
            <div>
              <p className="text-3xl font-black text-green-400">Review</p>
              <p className="text-xs text-gray-500 mt-1">Before payment</p>
            </div>
          </div>
          <ul className="text-left space-y-2.5 mb-8">
            {[
              "Household reach verified for " + cityDisplay,
              "Category protection confirmed before payment",
              "Professional postcard design included",
              "Cancel anytime with 30 days notice",
            ].map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                <svg className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          <Link href="/get-started" className="block w-full rounded-xl bg-blue-600 py-3.5 text-center text-sm font-bold text-white transition-colors hover:bg-blue-500">
            {fill(cat.cta)} →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-800 bg-gray-900/40">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <HomeReachLogo tone="light" size="sm" />
          </Link>
          <div className="flex flex-wrap justify-center gap-5 text-sm text-gray-500">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <Link href="/how-it-works" className="hover:text-gray-300 transition-colors">How It Works</Link>
            <Link href="/get-started" className="hover:text-gray-300 transition-colors">Get Started</Link>
          </div>
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} HomeReach</p>
        </div>
      </footer>
    </div>
  );
}

// ─── static params for SEO pre-rendering ──────────────────────────────────────

export function generateStaticParams() {
  const slugs: { slug: string }[] = [];
  for (const cityKey of Object.keys(CITIES)) {
    for (const catKey of Object.keys(CATEGORIES)) {
      slugs.push({ slug: `${cityKey}-${catKey}` });
    }
  }
  return slugs;
}
