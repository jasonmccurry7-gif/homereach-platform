import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, ClipboardCheck } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { CtaButton } from "@/components/marketing/cta-button";
import { getAuthorityGuide, listAuthorityGuides, type AuthorityGuide } from "@/lib/seo/authority";
import {
  buildArticleLd,
  buildBreadcrumbLd,
  buildFaqPageLd,
  buildImageObjectLd,
  type JsonLd as JsonLdShape,
} from "@/lib/seo/schema";

export const dynamicParams = false;
export const revalidate = 86400;

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

type Props = {
  params: Promise<{ guideSlug: string }>;
};

export function generateStaticParams() {
  return listAuthorityGuides().map((guide) => ({ guideSlug: guide.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { guideSlug } = await params;
  const guide = getAuthorityGuide(guideSlug);
  if (!guide) return { title: "Not Found" };
  const imageUrl = `${BASE}/seo-assets/${guide.visual.assetSlug}.svg`;
  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    alternates: { canonical: `${BASE}/learn/${guide.slug}` },
    openGraph: {
      title: guide.metaTitle,
      description: guide.metaDescription,
      url: `${BASE}/learn/${guide.slug}`,
      images: [{ url: imageUrl, alt: guide.visual.alt }],
    },
  };
}

export default async function GuidePage({ params }: Props) {
  const { guideSlug } = await params;
  const guide = getAuthorityGuide(guideSlug);
  if (!guide) notFound();

  const fullUrl = `${BASE}/learn/${guide.slug}`;
  const imageUrl = `/seo-assets/${guide.visual.assetSlug}.svg`;
  const schemas: JsonLdShape[] = [
    buildArticleLd({
      headline: guide.title,
      description: guide.summary,
      url: fullUrl,
      image: `${BASE}/seo-assets/${guide.visual.assetSlug}.svg`,
      dateModified: new Date().toISOString(),
    }),
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Learn", url: `${BASE}/learn/${guide.slug}` },
      { name: guide.title, url: fullUrl },
    ]),
    buildFaqPageLd(guide.faqs),
    buildImageObjectLd({
      name: guide.visual.title,
      contentUrl: `${BASE}/seo-assets/${guide.visual.assetSlug}.svg`,
      caption: guide.visual.caption,
    }),
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <JsonLd schemas={schemas} />
      <SiteHeader />
      <main>
        <GuideHero guide={guide} imageUrl={imageUrl} />
        <GuideSections guide={guide} />
        <GuideChecklist guide={guide} />
        <GuideFaq guide={guide} />
        <GuideLinks guide={guide} />
      </main>
      <SiteFooter />
    </div>
  );
}

function GuideHero({ guide, imageUrl }: { guide: AuthorityGuide; imageUrl: string }) {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <Image
        src={imageUrl}
        alt={guide.visual.alt}
        fill
        priority
        sizes="100vw"
        unoptimized
        className="object-cover opacity-[0.38]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,.96),rgba(2,6,23,.74)_50%,rgba(2,6,23,.32))]" />
      <div className="relative mx-auto w-full max-w-7xl min-w-0 px-4 py-16 lg:px-6 lg:py-20">
        <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
          {guide.eyebrow}
        </p>
        <h1 className="mt-6 max-w-4xl break-words text-4xl font-black leading-[1.04] text-white sm:text-5xl lg:text-6xl">
          {guide.title}
        </h1>
        <p className="mt-6 max-w-2xl break-words text-base leading-8 text-slate-200 sm:text-lg">{guide.summary}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <CtaButton href={guide.ctaHref} variant="primary">{guide.ctaLabel}</CtaButton>
          <CtaButton href="#guide" variant="secondary">Read Guide</CtaButton>
        </div>
      </div>
    </section>
  );
}

function GuideSections({ guide }: { guide: AuthorityGuide }) {
  return (
    <section id="guide" className="px-4 py-16 lg:px-6">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Audience</p>
          <h2 className="mt-3 text-3xl font-black text-slate-950">Useful before it asks for a lead.</h2>
          <p className="mt-5 text-base leading-8 text-slate-600">{guide.audience}</p>
        </div>
        <div className="grid gap-4">
          {guide.sections.map((section) => (
            <article key={section.heading} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-black text-slate-950">{section.heading}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function GuideChecklist({ guide }: { guide: AuthorityGuide }) {
  return (
    <section className="bg-slate-950 px-4 py-16 text-white lg:px-6">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-200">Operational checklist</p>
          <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
            Strategy only matters when it turns into the next action.
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-300">
            The guide supports search and buyer education; HomeReach workflows carry the proposal, proof, outreach, payment, and fulfillment work forward.
          </p>
        </div>
        <div className="grid gap-3">
          {guide.checklist.map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-100">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GuideFaq({ guide }: { guide: AuthorityGuide }) {
  return (
    <section className="px-4 py-16 lg:px-6">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">FAQs</p>
        <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {guide.faqs.map((faq) => (
            <details key={faq.question} className="p-5 open:bg-slate-50">
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

function GuideLinks({ guide }: { guide: AuthorityGuide }) {
  return (
    <section className="px-4 pb-16 lg:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 className="text-xl font-black text-slate-950">Related next steps</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {guide.internalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="group rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white">
                <p className="text-sm font-black text-slate-950 group-hover:text-blue-700">{link.label}</p>
                <ArrowRight className="mt-4 h-4 w-4 text-blue-700" aria-hidden="true" />
              </Link>
            ))}
          </div>
          <div className="mt-6">
            <CtaButton href={guide.ctaHref} variant="primary">{guide.ctaLabel}</CtaButton>
          </div>
        </div>
      </div>
    </section>
  );
}
