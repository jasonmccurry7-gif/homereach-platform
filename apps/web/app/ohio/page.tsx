import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, MapPin, ShieldCheck } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { CtaButton } from "@/components/marketing/cta-button";
import {
  getAuthorityClusters,
  listAuthorityGuides,
  ohioAuthorityCities,
  seoAuthorityTopics,
} from "@/lib/seo/authority";
import { buildBreadcrumbLd, buildItemListLd, type JsonLd as JsonLdShape } from "@/lib/seo/schema";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

export const metadata: Metadata = {
  title: "Ohio Direct Mail, Political Mail, and Campaign Execution | HomeReach",
  description:
    "HomeReach Ohio authority hub for direct mail, shared postcards, targeted neighborhood campaigns, political mail, procurement savings, and campaign execution.",
  alternates: { canonical: `${BASE}/ohio` },
  openGraph: {
    title: "Ohio Direct Mail, Political Mail, and Campaign Execution | HomeReach",
    description:
      "A premium Ohio authority hub for direct mail, political mail, shared postcards, targeted campaigns, procurement, and campaign execution.",
    images: [{ url: `${BASE}/seo-assets/ohio-authority-direct-mail-map.svg`, alt: "Ohio direct mail authority coverage map" }],
  },
};

export default function OhioAuthorityHub() {
  const clusters = getAuthorityClusters();
  const guides = listAuthorityGuides();
  const schemas: JsonLdShape[] = [
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Ohio", url: `${BASE}/ohio` },
    ]),
    buildItemListLd({
      name: "Ohio HomeReach Authority Pages",
      url: `${BASE}/ohio`,
      items: ohioAuthorityCities.map((city) => ({
        name: `${city.name} direct mail and campaign execution`,
        url: `${BASE}/ohio/${city.slug}`,
      })),
    }),
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <JsonLd schemas={schemas} />
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <Image
            src="/seo-assets/ohio-authority-direct-mail-map.svg"
            alt="Ohio coverage map showing HomeReach direct mail, political mail, and campaign execution markets"
            fill
            priority
            sizes="100vw"
            unoptimized
            className="object-cover opacity-[0.4]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,.96),rgba(2,6,23,.70)_54%,rgba(2,6,23,.28))]" />
          <div className="relative mx-auto w-full max-w-7xl min-w-0 px-4 py-20 lg:px-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Ohio authority hub
            </p>
            <h1 className="mt-6 max-w-4xl break-words text-4xl font-black leading-[1.04] text-white sm:text-5xl lg:text-6xl">
              Ohio direct mail, political mail, and campaign execution authority
            </h1>
            <p className="mt-6 max-w-2xl break-words text-base leading-8 text-slate-200 sm:text-lg">
              Premium public pages for buyers, search engines, and local intent. Advanced maps, proposals, outreach, creative, procurement, and fulfillment stay behind the scenes.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <CtaButton href="/get-started" variant="primary">Get My Proposal</CtaButton>
              <CtaButton href="#cities" variant="secondary">See Ohio Markets</CtaButton>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white px-4 py-10 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {clusters.map((cluster) => (
              <Link key={cluster.name} href={cluster.href} className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{cluster.name}</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{cluster.count}</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">{cluster.detail}</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="cities" className="px-4 py-16 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Geographic authority</p>
              <h2 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">
                City hubs that create local trust without cluttering the homepage.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ohioAuthorityCities.map((city) => (
                <Link key={city.slug} href={`/ohio/${city.slug}`} className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">{city.region}</p>
                  <h3 className="mt-3 text-2xl font-black text-slate-950">{city.name}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{city.marketPositioning}</p>
                  <div className="mt-5 flex items-center gap-2 text-sm font-black text-blue-700">
                    Open city hub
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 px-4 py-16 text-white lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-200">Long-tail revenue pages</p>
              <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
                Service, category, and political pages built from one quality-controlled model.
              </h2>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {seoAuthorityTopics.map((topic) => (
                <Link
                  key={topic.slug}
                  href={`/ohio/columbus/${topic.slug}`}
                  className="rounded-lg border border-white/10 bg-white/[0.06] p-4 transition hover:bg-white hover:text-slate-950"
                >
                  <p className="text-sm font-black">{topic.label}</p>
                  <p className="mt-2 text-xs leading-5 opacity-75">{topic.summary}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Educational authority</p>
              <h2 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">
                Guides that earn trust before they ask for a lead.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-600">
                These pages support informational search, internal linking, proposal education, and future case-study expansion.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {guides.slice(0, 6).map((guide) => (
                <Link key={guide.slug} href={`/learn/${guide.slug}`} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-lg">
                  <BookOpen className="h-5 w-5 text-blue-700" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-black text-slate-950">{guide.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{guide.summary}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 lg:px-6">
          <div className="mx-auto max-w-7xl rounded-lg bg-white p-8 shadow-xl shadow-slate-950/10 ring-1 ring-slate-200">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-emerald-700">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Review-first SEO flywheel
                </div>
                <h2 className="mt-3 text-3xl font-black text-slate-950">
                  Traffic should become proposals, customers, visual proof, and stronger authority.
                </h2>
              </div>
              <CtaButton href="/get-started" variant="primary">Start My Campaign</CtaButton>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
