import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Globe2,
  MapPin,
  MessageSquareText,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { VisibilityScanForm } from "@/components/local-visibility/visibility-scan-form";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBreadcrumbLd, buildServiceLd, buildSoftwareApplicationLd, type JsonLd as JsonLdShape } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "Local Visibility and Reputation Command Center | HomeReach",
  description:
    "Get found, look trusted, generate more reviews, improve Google Business Profile performance, and see what to fix next with HomeReach Local Visibility.",
  alternates: { canonical: "/local-visibility" },
  openGraph: {
    title: "Get found. Look trusted. Win more local customers.",
    description:
      "HomeReach helps local businesses improve Google visibility, generate more reviews, keep listings accurate, and respond faster with AI-assisted reputation tools.",
  },
};

const features = [
  {
    title: "Google profile optimization",
    body: "Track photos, services, categories, posts, Q&A, calls, website clicks, directions, and profile completeness.",
    icon: MapPin,
  },
  {
    title: "Review generation",
    body: "Send approved review requests, track review velocity, and make happy customers easier to turn into visible proof.",
    icon: Star,
  },
  {
    title: "AI review replies",
    body: "Draft brand-safe replies for Google, Facebook, and Yelp reviews while keeping public posting approval-first.",
    icon: MessageSquareText,
  },
  {
    title: "Listings health",
    body: "Audit name, address, phone, hours, services, categories, links, and consistency across important local profiles.",
    icon: ShieldCheck,
  },
  {
    title: "Local SEO recommendations",
    body: "Identify service pages, city pages, FAQs, review keywords, Google post ideas, and website improvements.",
    icon: Search,
  },
  {
    title: "Weekly visibility briefing",
    body: "Give the owner a plain-English update on what changed, what matters, and what to do next.",
    icon: Sparkles,
  },
];

const packages = [
  {
    name: "Starter Visibility",
    price: "$299/mo",
    summary: "For businesses that need the local trust foundation cleaned up.",
    includes: ["GBP audit", "Review request links", "Basic review dashboard", "Monthly visibility report"],
  },
  {
    name: "Growth Reputation",
    price: "$599/mo",
    summary: "For businesses that need review velocity and weekly action.",
    includes: ["Approved review requests", "AI review reply drafts", "Listings health checks", "Google post drafts", "Weekly recommendations"],
  },
  {
    name: "Local Dominance",
    price: "$999+/mo",
    summary: "For competitive markets and multi-location operators.",
    includes: ["Full reputation dashboard", "Listings optimization", "AI local SEO recommendations", "Competitor visibility tracking", "Monthly strategy report"],
  },
];

export default function LocalVisibilityPage() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com";
  const schemas: JsonLdShape[] = [
    buildServiceLd({
      name: "HomeReach Local Visibility and Reputation",
      description:
        "AI-assisted local SEO, review generation, listings health, Google Business Profile optimization, and reputation management for local businesses.",
      category: "LocalBusinessService",
      url: `${base}/local-visibility`,
    }),
    buildSoftwareApplicationLd({
      name: "HomeReach Local Visibility Command Center",
      description: "AI-powered local visibility and reputation command center for small businesses.",
      url: `${base}/local-visibility`,
      applicationCategory: "BusinessApplication",
    }),
    buildBreadcrumbLd([
      { name: "Home", url: `${base}/` },
      { name: "Local Visibility", url: `${base}/local-visibility` },
    ]),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <JsonLd schemas={schemas} />
      <SiteHeader variant="growth" />
      <main>
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-6 lg:py-20">
            <div>
              <p className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-100">
                HomeReach Local
              </p>
              <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
                Get found. Look trusted. Win more local customers.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                HomeReach helps local businesses improve Google visibility, generate more reviews, keep listings
                accurate, and respond faster with AI-assisted reputation tools.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#visibility-scan"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400"
                >
                  Get a Free Visibility Scan
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  See How It Works
                </a>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-slate-950/30 backdrop-blur">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Visibility Score", "82", "Are customers finding you?"],
                  ["Trust Score", "77", "Do you look credible?"],
                  ["Review Momentum", "64", "Are fresh reviews coming in?"],
                  ["Next Fix", "1", "What should happen next?"],
                ].map(([label, value, detail]) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
                    <p className="mt-3 text-3xl font-black text-white">{value}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
                <div className="flex items-start gap-3">
                  <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
                  <p className="text-sm font-semibold leading-6 text-emerald-50">
                    AI agents help local businesses get found, look trusted, and turn reputation into revenue.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="visibility-scan" className="px-4 py-14 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <VisibilityScanForm />
          </div>
        </section>

        <section id="how-it-works" className="px-4 pb-14 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Command Center</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                Everything is organized around what matters, what changed, and what to do next.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-lg font-black tracking-tight text-slate-950">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{feature.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 pb-14 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Automation rules</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">AI drafts. Humans approve public actions.</h2>
              <div className="mt-5 grid gap-3">
                {[
                  "Draft review replies and Google post ideas.",
                  "Send only approved review requests.",
                  "Never auto-post negative or sensitive review replies.",
                  "Never change listings without approval.",
                ].map((item) => (
                  <div key={item} className="flex gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <p className="text-sm font-semibold leading-6 text-emerald-950">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {packages.map((pkg) => (
                <div key={pkg.name} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-lg font-black tracking-tight text-slate-950">{pkg.name}</p>
                  <p className="mt-2 text-3xl font-black text-blue-700">{pkg.price}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{pkg.summary}</p>
                  <ul className="mt-4 space-y-2">
                    {pkg.includes.map((item) => (
                      <li key={item} className="flex gap-2 text-sm font-semibold leading-6 text-slate-700">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 lg:px-6">
          <div className="mx-auto rounded-lg bg-slate-950 p-6 text-white lg:max-w-7xl lg:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Next Step</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight">Start with the free scan, then turn the fixes into a managed plan.</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  HomeReach Local can connect to postcards, SEO pages, review requests, Google profile drafts, and
                  owner-friendly weekly reports.
                </p>
              </div>
              <Link
                href="#visibility-scan"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-50"
              >
                Get a Free Visibility Scan
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
