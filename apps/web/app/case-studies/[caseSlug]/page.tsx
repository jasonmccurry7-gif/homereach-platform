import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthorityPage } from "@/components/seo/AuthorityPage";
import { getSeoCaseStudy, listSeoCaseStudies } from "@/lib/seo/authority";
import {
  buildArticleLd,
  buildBreadcrumbLd,
  buildImageObjectLd,
  type JsonLd as JsonLdShape,
} from "@/lib/seo/schema";

export const dynamicParams = false;
export const revalidate = 86400;

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

type Props = { params: Promise<{ caseSlug: string }> };

export function generateStaticParams() {
  return listSeoCaseStudies().map((study) => ({ caseSlug: study.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { caseSlug } = await params;
  const study = getSeoCaseStudy(caseSlug);
  if (!study) return { title: "Not Found" };
  return {
    title: study.metaTitle,
    description: study.metaDescription,
    alternates: { canonical: `${BASE}${study.path}` },
    openGraph: {
      title: study.metaTitle,
      description: study.metaDescription,
      url: `${BASE}${study.path}`,
      images: [{ url: `${BASE}/seo-assets/${study.visual.assetSlug}.svg`, alt: study.visual.alt }],
    },
  };
}

export default async function CaseStudyRoute({ params }: Props) {
  const { caseSlug } = await params;
  const study = getSeoCaseStudy(caseSlug);
  if (!study) notFound();

  const fullUrl = `${BASE}${study.path}`;
  const schemas: JsonLdShape[] = [
    buildArticleLd({
      headline: study.title,
      description: study.summary,
      url: fullUrl,
      image: `${BASE}/seo-assets/${study.visual.assetSlug}.svg`,
      dateModified: new Date().toISOString(),
    }),
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Case Studies", url: `${BASE}/case-studies` },
      { name: study.title, url: fullUrl },
    ]),
    buildImageObjectLd({
      name: study.visual.title,
      contentUrl: `${BASE}/seo-assets/${study.visual.assetSlug}.svg`,
      caption: study.visual.caption,
    }),
  ];

  return (
    <AuthorityPage
      schemas={schemas}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Case Studies", href: "/case-studies" },
        { label: study.title, href: study.path },
      ]}
      eyebrow={study.category}
      title={study.title}
      summary={study.summary}
      visual={study.visual}
      primaryCta={{ label: study.ctaLabel, href: study.ctaHref }}
      secondaryCta={{ label: "See More Case Studies", href: "/case-studies" }}
      metrics={[
        { label: "Market", value: study.market, note: "Local authority signal" },
        { label: "Result signal", value: study.resultSignal, note: "Planning model, not a live claim" },
        { label: "Category", value: study.category, note: "Internal link cluster" },
        { label: "Visual", value: study.visual.kind.replaceAll("_", " "), note: "Image metadata ready" },
      ]}
      sections={[
        { eyebrow: "Rollout", title: "How the campaign moves", items: study.rollout },
        { eyebrow: "Strategy", title: "Why it can work", items: study.strategy },
        { eyebrow: "Proof", title: "What buyers need to see", items: study.proofPoints },
      ]}
      proofPoints={study.proofPoints}
      links={study.internalLinks}
    />
  );
}
