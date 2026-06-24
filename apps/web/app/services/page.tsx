import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Globe2,
  Landmark,
  Mail,
  MessageSquare,
  PackageSearch,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { JsonLd } from "@/components/seo/JsonLd";
import { listGrowthServiceModules, type GrowthServiceCategory } from "@/lib/growth-execution/services";
import { buildBreadcrumbLd, buildItemListLd, buildServiceCatalogLd, type JsonLd as JsonLdShape } from "@/lib/seo/schema";
import { listMainProductSeoTargets } from "@/lib/seo/product-seo";

export const metadata: Metadata = {
  title: "HomeReach Services | Local SEO, AI Assistant, Reputation, Postcards, Procurement",
  description:
    "Explore HomeReach services for local SEO, AI website lead capture, reputation management, direct mail postcards, procurement savings, social content, and government contracts.",
  keywords: [
    "local business growth services",
    "AI website assistant",
    "local SEO for small businesses",
    "reputation management",
    "direct mail postcards",
    "procurement savings",
    "government contract support",
  ],
  alternates: { canonical: "/services" },
};

const categoryIcons: Record<GrowthServiceCategory, typeof Mail> = {
  postcards: Mail,
  lead_capture: Bot,
  follow_up: MessageSquare,
  seo: Search,
  reputation: Star,
  content: Globe2,
  paid_media: ClipboardCheck,
  procurement: PackageSearch,
  government: Landmark,
};

export default function ServicesPage() {
  const services = listGrowthServiceModules();
  const publicServices = services.filter((service) => service.publicExposure !== "admin_only");
  const seoTargets = listMainProductSeoTargets(publicServices);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com";
  const schemas: JsonLdShape[] = [
    buildBreadcrumbLd([
      { name: "Home", url: `${base}/` },
      { name: "Services", url: `${base}/services` },
    ]),
    buildItemListLd({
      name: "HomeReach public service pages",
      url: `${base}/services`,
      items: publicServices.map((service) => ({
        name: service.shortTitle,
        url: `${base}${service.publicPath}`,
      })),
    }),
    buildServiceCatalogLd({
      name: "HomeReach growth execution services",
      description:
        "Direct mail, AI website assistant, local SEO, reputation, social content, procurement, and government contract support services.",
      url: `${base}/services`,
      services: publicServices.map((service) => ({
        name: service.title,
        description: service.outcome,
        url: `${base}${service.publicPath}`,
        category: service.category,
      })),
    }),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <JsonLd schemas={schemas} />
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 lg:px-6 lg:py-20">
            <div className="max-w-4xl">
              <p className="inline-flex rounded-full border border-blue-300/25 bg-blue-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-100">
                HomeReach Growth Execution Platform
              </p>
              <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
                Postcards, lead capture, follow-up, SEO, reputation, and operations under one simple growth system.
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                HomeReach keeps postcards as the wedge, then connects the supporting services that help local businesses
                get found, capture leads, follow up, save money, and stay organized.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/get-started"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500"
                >
                  Start My Campaign
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/waitlist?product=growth-services"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  Request Growth Plan
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white px-4 py-12 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Main ranking targets</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                The core HomeReach products search engines should understand.
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                Each product has a crawlable page, a clear buyer intent, internal links, and a next action. This keeps
                the site focused on revenue pages instead of scattered feature pages.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {seoTargets.map((target) => (
                <Link
                  key={target.slug}
                  href={target.path}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-xl hover:shadow-slate-950/10"
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">{target.searchIntent}</p>
                  <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">{target.title}</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-700">{target.primaryKeyword}</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{target.answerSummary}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {publicServices.map((service) => {
                const Icon = categoryIcons[service.category];
                return (
                  <Link
                    key={service.slug}
                    href={service.publicPath}
                    className="group flex min-h-[21rem] flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-2xl hover:shadow-slate-950/10"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                        {statusLabel(service.status)}
                      </span>
                    </div>
                    <h2 className="mt-5 text-xl font-black tracking-tight text-slate-950">{service.shortTitle}</h2>
                    <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{service.outcome}</p>
                    <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Best for</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{service.whoFor}</p>
                    </div>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-700 transition group-hover:gap-3">
                      {service.primaryCtaLabel}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950">
                Simple for customers. Powerful underneath.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                The customer-facing experience stays clean. HomeReach keeps CRM, outreach, payment, maps, creative,
                procurement, government contracts, and AI approval workflows inside the admin command center.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Postcards stay the primary differentiator.",
                "No high-risk AI actions run without approval.",
                "Existing checkout, authentication, maps, and dashboards stay preserved.",
                "Every service creates a path into leads, proposals, campaigns, or recurring revenue.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <p className="text-sm font-semibold leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 lg:px-6">
          <div className="mx-auto max-w-7xl rounded-lg bg-slate-950 p-6 text-white lg:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">Not just postcards</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight">A local growth operating system built around execution.</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  Start with the channel that makes you visible, then add lead capture, SEO, reputation, procurement, and
                  follow-up as the business grows.
                </p>
              </div>
              <Link
                href="/waitlist?product=growth-services"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-blue-50"
              >
                Get My Growth Plan
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

function statusLabel(status: string) {
  switch (status) {
    case "live":
      return "Live";
    case "enhanced":
      return "Enhanced";
    case "preview":
      return "Preview";
    case "future_ready":
      return "Ready";
    case "needs_integration":
      return "Integration";
    default:
      return status;
  }
}
