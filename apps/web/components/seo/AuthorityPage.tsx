import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { CtaButton } from "@/components/marketing/cta-button";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { JsonLd } from "@/components/seo/JsonLd";
import type { SeoVisualAsset } from "@/lib/seo/authority";
import type { JsonLd as JsonLdShape } from "@/lib/seo/schema";

type AuthorityLink = { label: string; href: string };

type AuthoritySection = {
  eyebrow: string;
  title: string;
  body?: string;
  items?: string[];
};

type AuthorityMetric = {
  label: string;
  value: string;
  note?: string;
};

export function AuthorityPage({
  schemas,
  breadcrumbs,
  eyebrow,
  title,
  summary,
  visual,
  primaryCta,
  secondaryCta,
  metrics = [],
  sections,
  proofPoints = [],
  faqs = [],
  links = [],
  children,
}: {
  schemas: JsonLdShape[];
  breadcrumbs: AuthorityLink[];
  eyebrow: string;
  title: string;
  summary: string;
  visual: SeoVisualAsset;
  primaryCta: AuthorityLink;
  secondaryCta?: AuthorityLink;
  metrics?: AuthorityMetric[];
  sections: AuthoritySection[];
  proofPoints?: string[];
  faqs?: Array<{ question: string; answer: string }>;
  links?: AuthorityLink[];
  children?: React.ReactNode;
}) {
  const imageUrl = `/seo-assets/${visual.assetSlug}.svg`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <JsonLd schemas={schemas} />
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <Image
            src={imageUrl}
            alt={visual.alt}
            fill
            priority
            sizes="100vw"
            unoptimized
            className="object-cover opacity-[0.38]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,.97),rgba(2,6,23,.76)_52%,rgba(2,6,23,.36))]" />
          <div className="relative mx-auto grid w-full max-w-7xl min-w-0 gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1fr_0.86fr] lg:items-end lg:px-6">
            <div className="min-w-0 max-w-4xl">
              <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-300" aria-label="Breadcrumb">
                {breadcrumbs.map((item, index) => (
                  <span key={item.href} className="flex items-center gap-2">
                    {index > 0 ? <span>/</span> : null}
                    <Link href={item.href} className="hover:text-white">
                      {item.label}
                    </Link>
                  </span>
                ))}
              </nav>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                {eyebrow}
              </p>
              <h1 className="mt-6 max-w-4xl break-words text-4xl font-black leading-[1.04] text-white sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="mt-6 max-w-2xl break-words text-base leading-8 text-slate-200 sm:text-lg">{summary}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <CtaButton href={primaryCta.href} variant="primary" className="w-full sm:w-auto">
                  {primaryCta.label}
                </CtaButton>
                {secondaryCta ? (
                  <CtaButton href={secondaryCta.href} variant="secondary" className="w-full sm:w-auto">
                    {secondaryCta.label}
                  </CtaButton>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.08] p-4 backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Authority signals</p>
              <div className="mt-4 grid gap-3">
                {(proofPoints.length ? proofPoints : [visual.caption]).slice(0, 4).map((point) => (
                  <div key={point} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.8)]" />
                    <span className="text-sm font-semibold leading-6 text-slate-100">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {metrics.length ? (
          <section className="border-b border-slate-200 bg-white px-4 py-6 lg:px-6">
            <div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{metric.value}</p>
                  {metric.note ? <p className="mt-2 text-xs leading-5 text-slate-600">{metric.note}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="px-4 py-16 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-3">
            {sections.map((section) => (
              <article key={section.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">{section.eyebrow}</p>
                <h2 className="mt-3 text-2xl font-black text-slate-950">{section.title}</h2>
                {section.body ? <p className="mt-4 text-sm leading-7 text-slate-600">{section.body}</p> : null}
                {section.items?.length ? (
                  <div className="mt-5 grid gap-3">
                    {section.items.map((item) => (
                      <div key={item} className="flex gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                        <p className="text-sm leading-6 text-slate-700">{item}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {children}

        {faqs.length ? (
          <section className="bg-white px-4 py-16 lg:px-6">
            <div className="mx-auto max-w-4xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">FAQs</p>
              <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200">
                {faqs.map((faq) => (
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
        ) : null}

        {links.length ? (
          <section className="px-4 py-16 lg:px-6">
            <div className="mx-auto max-w-7xl">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-700" aria-hidden="true" />
                <h2 className="text-xl font-black text-slate-950">Related authority paths</h2>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {links.map((link) => (
                  <Link key={link.href} href={link.href} className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-lg">
                    <p className="text-sm font-black text-slate-950 group-hover:text-blue-700">{link.label}</p>
                    <ArrowRight className="mt-4 h-4 w-4 text-blue-700 transition group-hover:translate-x-1" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="px-4 pb-16 lg:px-6">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-lg bg-slate-950 p-8 text-white shadow-2xl shadow-slate-950/20 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-200">SEO flywheel</p>
                <h2 className="mt-3 text-3xl font-black sm:text-4xl">Traffic should become a proposal, a campaign, proof, and stronger authority.</h2>
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
                  Public pages educate and convert. Admin systems handle research, approvals, outreach, creative, analytics, fulfillment, and revenue follow-up.
                </p>
              </div>
              <CtaButton href={primaryCta.href} variant="primary" className="w-full sm:w-auto">
                {primaryCta.label}
              </CtaButton>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
