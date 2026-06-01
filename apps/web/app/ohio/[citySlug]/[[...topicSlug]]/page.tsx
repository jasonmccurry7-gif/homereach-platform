import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, MapPin, ShieldCheck, Sparkles, Target } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { CtaButton } from "@/components/marketing/cta-button";
import {
  getOhioAuthorityPage,
  listOhioAuthorityPages,
  ohioAuthorityCities,
  seoAuthorityTopics,
  type OhioAuthorityPage,
} from "@/lib/seo/authority";
import {
  buildBreadcrumbLd,
  buildFaqPageLd,
  buildImageObjectLd,
  buildLocalBusinessLd,
  buildServiceLd,
  type JsonLd as JsonLdShape,
} from "@/lib/seo/schema";

export const dynamicParams = false;
export const revalidate = 86400;

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

type Props = {
  params: Promise<{ citySlug: string; topicSlug?: string[] }>;
};

export function generateStaticParams() {
  return [
    ...ohioAuthorityCities.map((city) => ({ citySlug: city.slug, topicSlug: [] })),
    ...ohioAuthorityCities.flatMap((city) =>
      seoAuthorityTopics.map((topic) => ({ citySlug: city.slug, topicSlug: [topic.slug] })),
    ),
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { citySlug, topicSlug } = await params;
  const topic = getTopicSlug(topicSlug);
  const page = getOhioAuthorityPage(citySlug, topic);
  if (!page) return { title: "Not Found" };

  const imageUrl = `${BASE}/seo-assets/${page.visual.assetSlug}.svg`;
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `${BASE}${page.path}` },
    keywords: [
      page.topic?.primaryKeyword,
      ...(page.topic?.supportingKeywords ?? []),
      `${page.city.name} direct mail`,
      `${page.city.name} postcard advertising`,
      "HomeReach",
    ].filter(Boolean) as string[],
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url: `${BASE}${page.path}`,
      images: [{ url: imageUrl, alt: page.visual.alt }],
    },
  };
}

export default async function OhioAuthorityPageRoute({ params }: Props) {
  const { citySlug, topicSlug } = await params;
  const topic = getTopicSlug(topicSlug);
  const page = getOhioAuthorityPage(citySlug, topic);
  if (!page) notFound();

  const imageUrl = `/seo-assets/${page.visual.assetSlug}.svg`;
  const fullUrl = `${BASE}${page.path}`;
  const schemas: JsonLdShape[] = [
    buildServiceLd({
      name: page.topic?.serviceName ?? `${page.city.name} direct mail and campaign execution`,
      description: page.metaDescription,
      city: page.city.name,
      category: page.topic?.label ?? "Direct mail and campaign execution",
      url: fullUrl,
    }),
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Ohio", url: `${BASE}/ohio` },
      { name: page.city.name, url: `${BASE}/ohio/${page.city.slug}` },
      ...(page.topic ? [{ name: page.topic.label, url: fullUrl }] : []),
    ]),
    buildLocalBusinessLd({
      name: "HomeReach",
      url: fullUrl,
      city: page.city.name,
      region: "OH",
      areaServed: `${page.city.name}, Ohio`,
    }),
    buildFaqPageLd(page.faqs),
    buildImageObjectLd({
      name: page.visual.title,
      contentUrl: `${BASE}/seo-assets/${page.visual.assetSlug}.svg`,
      caption: page.visual.caption,
    }),
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <JsonLd schemas={schemas} />
      <SiteHeader />
      <main>
        <Hero page={page} imageUrl={imageUrl} />
        <ProofStrip page={page} />
        <StrategySection page={page} />
        <VisualProof page={page} imageUrl={imageUrl} />
        <ExecutionSection page={page} />
        <FaqSection page={page} />
        <InternalLinks page={page} />
        <FinalCta page={page} />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero({ page, imageUrl }: { page: OhioAuthorityPage; imageUrl: string }) {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <Image
        src={imageUrl}
        alt={page.visual.alt}
        fill
        priority
        sizes="100vw"
        unoptimized
        className="object-cover opacity-[0.42]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,.96),rgba(2,6,23,.72)_48%,rgba(2,6,23,.34))]" />
      <div className="relative mx-auto grid w-full max-w-7xl min-w-0 gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1fr_0.82fr] lg:items-end lg:px-6">
        <div className="min-w-0 max-w-4xl">
          <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-300" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">Home</Link>
            <span>/</span>
            <Link href="/ohio" className="hover:text-white">Ohio</Link>
            <span>/</span>
            <span className="text-white">{page.city.name}</span>
          </nav>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {page.eyebrow}
          </p>
          <h1 className="mt-6 max-w-4xl break-words text-4xl font-black leading-[1.04] text-white sm:text-5xl lg:text-6xl">
            {page.h1}
          </h1>
          <p className="mt-6 max-w-2xl break-words text-base leading-8 text-slate-200 sm:text-lg">
            {page.intro}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CtaButton href={page.topic?.ctaHref ?? "/get-started"} variant="primary">
              {page.topic?.ctaLabel ?? "Get My Proposal"}
            </CtaButton>
            <CtaButton href="#visual-proof" variant="secondary">
              See Visual Proof
            </CtaButton>
          </div>
        </div>
        <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.08] p-4 backdrop-blur-xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Market signals</p>
          <div className="mt-4 grid gap-3">
            {page.city.neighborhoodSignals.slice(0, 4).map((signal) => (
              <div key={signal} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.8)]" />
                <span className="text-sm font-semibold text-slate-100">{signal}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofStrip({ page }: { page: OhioAuthorityPage }) {
  const items = [
    ["Local market", page.city.region],
    ["Primary use", page.topic?.shortLabel ?? "Authority hub"],
    ["CTA path", page.topic?.ctaLabel ?? "Get My Proposal"],
    ["Visual asset", page.visual.kind.replaceAll("_", " ")],
  ];

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
            <p className="mt-2 text-base font-black text-slate-950">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StrategySection({ page }: { page: OhioAuthorityPage }) {
  return (
    <section className="px-4 py-16 lg:px-6">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Strategy</p>
          <h2 className="mt-3 max-w-xl text-3xl font-black text-slate-950 sm:text-4xl">
            Built for search intent, but written for real buyers.
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-600">
            This page is designed to be useful, local, visual, and conversion-focused. It avoids thin content by tying the offer to geography, execution, proof, and next action.
          </p>
        </div>
        <div className="grid gap-4">
          {page.strategy.map((item, index) => (
            <article key={item} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-black text-blue-700">
                  {index + 1}
                </span>
                <p className="text-sm leading-7 text-slate-700">{item}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function VisualProof({ page, imageUrl }: { page: OhioAuthorityPage; imageUrl: string }) {
  return (
    <section id="visual-proof" className="bg-slate-950 px-4 py-16 text-white lg:px-6">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-200">Visual proof engine</p>
          <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
            Show the value before asking for the decision.
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-300">
            {page.visual.caption} Each visual has a stable URL, descriptive alt text, and image sitemap coverage so the SEO system builds authority without cluttering the homepage.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {page.proofPoints.map((point) => (
              <div key={point} className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                <p className="mt-3 text-sm leading-6 text-slate-200">{point}</p>
              </div>
            ))}
          </div>
        </div>
        <figure className="overflow-hidden rounded-lg border border-white/10 bg-white p-3 shadow-2xl shadow-slate-950/40">
          <Image
            src={imageUrl}
            alt={page.visual.alt}
            loading="lazy"
            width={1400}
            height={900}
            unoptimized
            className="aspect-[14/9] w-full rounded-md object-cover"
          />
          <figcaption className="px-2 py-3 text-sm font-semibold text-slate-600">{page.visual.caption}</figcaption>
        </figure>
      </div>
    </section>
  );
}

function ExecutionSection({ page }: { page: OhioAuthorityPage }) {
  const blocks = [
    {
      icon: Target,
      title: "Geography",
      body: `${page.city.name} planning starts with real local anchors: ${page.city.localAnchors.slice(0, 5).join(", ")}.`,
    },
    {
      icon: Sparkles,
      title: "Creative",
      body: page.topic?.proofAngle ?? "Premium maps and postcard previews help buyers understand the campaign before they commit.",
    },
    {
      icon: ShieldCheck,
      title: "Execution",
      body: "Proposal, proof, payment, print, mail, follow-up, and reporting stay connected behind the scenes.",
    },
  ];

  return (
    <section className="px-4 py-16 lg:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Execution path</p>
          <h2 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">
            Simple public page. Serious operating system underneath.
          </h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {blocks.map((block) => {
            const Icon = block.icon;
            return (
              <article key={block.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-black text-slate-950">{block.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{block.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FaqSection({ page }: { page: OhioAuthorityPage }) {
  return (
    <section className="border-y border-slate-200 bg-white px-4 py-16 lg:px-6">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">FAQs</p>
        <h2 className="mt-3 text-3xl font-black text-slate-950">Questions buyers ask before they move.</h2>
        <div className="mt-8 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50">
          {page.faqs.map((faq) => (
            <details key={faq.question} className="group p-5 open:bg-white">
              <summary className="cursor-pointer list-none text-base font-black text-slate-950 [&::-webkit-details-marker]:hidden">
                {faq.question}
              </summary>
              <p className="mt-3 text-sm leading-7 text-slate-600">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function InternalLinks({ page }: { page: OhioAuthorityPage }) {
  return (
    <section className="px-4 py-16 lg:px-6">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Related authority pages</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {page.internalLinks.slice(0, 8).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"
            >
              <span className="text-sm font-black text-slate-950 group-hover:text-blue-700">{link.label}</span>
              <ArrowRight className="mt-4 h-4 w-4 text-blue-600" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ page }: { page: OhioAuthorityPage }) {
  return (
    <section className="px-4 pb-16 lg:px-6">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-lg bg-slate-950 p-8 text-white shadow-2xl shadow-slate-950/20 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-200">{page.city.name} next step</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">
              Turn the search visit into a campaign plan.
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
              HomeReach keeps the decision simple: show the local strategy, prove it visually, then route the visitor into the right proposal or campaign workflow.
            </p>
          </div>
          <CtaButton href={page.topic?.ctaHref ?? "/get-started"} variant="primary">
            {page.topic?.ctaLabel ?? "Get My Proposal"}
          </CtaButton>
        </div>
      </div>
    </section>
  );
}

function getTopicSlug(topicSlug?: string[]) {
  if (!topicSlug || topicSlug.length === 0) return null;
  if (topicSlug.length > 1) return "__invalid__";
  return topicSlug[0] ?? null;
}
