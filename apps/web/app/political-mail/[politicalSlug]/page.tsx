import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthorityPage } from "@/components/seo/AuthorityPage";
import { getPoliticalAuthorityPage, listPoliticalAuthorityPages } from "@/lib/seo/authority";
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
  params: Promise<{ politicalSlug: string }>;
};

export function generateStaticParams() {
  return listPoliticalAuthorityPages().map((page) => ({ politicalSlug: page.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { politicalSlug } = await params;
  const page = getPoliticalAuthorityPage(politicalSlug);
  if (!page) return { title: "Not Found" };
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `${BASE}${page.path}` },
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url: `${BASE}${page.path}`,
      images: [{ url: `${BASE}/seo-assets/${page.visual.assetSlug}.svg`, alt: page.visual.alt }],
    },
  };
}

export default async function PoliticalAuthorityRoute({ params }: Props) {
  const { politicalSlug } = await params;
  const page = getPoliticalAuthorityPage(politicalSlug);
  if (!page) notFound();

  const fullUrl = `${BASE}${page.path}`;
  const schemas: JsonLdShape[] = [
    buildArticleLd({
      headline: page.title,
      description: page.summary,
      url: fullUrl,
      image: `${BASE}/seo-assets/${page.visual.assetSlug}.svg`,
      dateModified: new Date().toISOString(),
    }),
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Political Mail", url: `${BASE}/political-mail` },
      { name: page.title, url: fullUrl },
    ]),
    buildFaqPageLd(page.faqs),
    buildImageObjectLd({
      name: page.visual.title,
      contentUrl: `${BASE}/seo-assets/${page.visual.assetSlug}.svg`,
      caption: page.visual.caption,
    }),
  ];

  return (
    <AuthorityPage
      schemas={schemas}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Political Mail", href: "/political-mail" },
        { label: page.title, href: page.path },
      ]}
      eyebrow={page.eyebrow}
      title={page.h1}
      summary={page.summary}
      visual={page.visual}
      primaryCta={{ label: page.ctaLabel, href: page.ctaHref }}
      secondaryCta={{ label: "See Political Gallery", href: "/visuals/political-postcard-gallery" }}
      metrics={[
        { label: "Page type", value: page.pageType.replaceAll("_", " "), note: "Political topical cluster" },
        { label: "Audience", value: "Campaigns", note: "Candidates, managers, consultants, committees" },
        { label: "Visual", value: "Mockup", note: "Political mail visual proof" },
        { label: "Safety", value: "Neutral", note: "No individual political inference" },
      ]}
      sections={[
        { eyebrow: "Audience", title: "Who this is built for", body: page.audience },
        { eyebrow: "Strategy", title: "How the page earns trust", items: page.strategy },
        { eyebrow: "Proof", title: "What makes it useful", items: page.proofPoints },
      ]}
      proofPoints={page.proofPoints}
      faqs={page.faqs}
      links={page.internalLinks}
    />
  );
}
