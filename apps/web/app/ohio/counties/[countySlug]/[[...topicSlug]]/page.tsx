import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthorityPage } from "@/components/seo/AuthorityPage";
import {
  getCountyAuthorityPage,
  listCountyAuthorityPages,
  ohioAuthorityCounties,
  seoAuthorityTopics,
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
  params: Promise<{ countySlug: string; topicSlug?: string[] }>;
};

export function generateStaticParams() {
  return [
    ...ohioAuthorityCounties.map((county) => ({ countySlug: county.slug, topicSlug: [] })),
    ...listCountyAuthorityPages()
      .filter((page) => page.topic)
      .map((page) => ({
        countySlug: page.county.slug,
        topicSlug: [page.topic?.slug ?? ""],
      })),
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countySlug, topicSlug } = await params;
  const page = getCountyAuthorityPage(countySlug, getTopicSlug(topicSlug));
  if (!page) return { title: "Not Found" };

  const imageUrl = `${BASE}/seo-assets/${page.visual.assetSlug}.svg`;
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `${BASE}${page.path}` },
    keywords: [
      `${page.county.name} direct mail`,
      `${page.county.name} political mail`,
      page.topic?.primaryKeyword,
      ...(page.topic?.supportingKeywords ?? []),
    ].filter(Boolean) as string[],
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url: `${BASE}${page.path}`,
      images: [{ url: imageUrl, alt: page.visual.alt }],
    },
  };
}

export default async function CountyAuthorityRoute({ params }: Props) {
  const { countySlug, topicSlug } = await params;
  const page = getCountyAuthorityPage(countySlug, getTopicSlug(topicSlug));
  if (!page) notFound();

  const fullUrl = `${BASE}${page.path}`;
  const schemas: JsonLdShape[] = [
    buildServiceLd({
      name: page.topic?.serviceName ?? `${page.county.name} direct mail and campaign advertising`,
      description: page.metaDescription,
      city: page.county.seat,
      category: page.topic?.label ?? "County direct mail and campaign advertising",
      url: fullUrl,
    }),
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Ohio", url: `${BASE}/ohio` },
      { name: "Counties", url: `${BASE}/ohio` },
      { name: page.county.name, url: `${BASE}/ohio/counties/${page.county.slug}` },
      ...(page.topic ? [{ name: page.topic.label, url: fullUrl }] : []),
    ]),
    buildLocalBusinessLd({
      name: "HomeReach",
      url: fullUrl,
      city: page.county.seat,
      region: "OH",
      areaServed: `${page.county.name}, Ohio`,
    }),
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
        { label: "Ohio", href: "/ohio" },
        { label: page.county.name, href: `/ohio/counties/${page.county.slug}` },
      ]}
      eyebrow={page.eyebrow}
      title={page.h1}
      summary={page.intro}
      visual={page.visual}
      primaryCta={{ label: page.topic?.ctaLabel ?? "Get My Proposal", href: page.topic?.ctaHref ?? "/get-started" }}
      secondaryCta={{ label: "See Ohio Hub", href: "/ohio" }}
      metrics={[
        { label: "County seat", value: page.county.seat, note: page.county.region },
        { label: "Page type", value: page.pageType === "county" ? "County hub" : "County topic", note: "Long-tail geographic authority" },
        { label: "Visual proof", value: page.visual.kind.replaceAll("_", " "), note: "Image sitemap and metadata ready" },
        { label: "Review mode", value: "Human", note: "No auto-published thin AI content" },
      ]}
      sections={[
        { eyebrow: "County strategy", title: "Local context first", body: page.strategy[0], items: page.strategy.slice(1) },
        { eyebrow: "Proof", title: "Visual and operational signals", items: page.proofPoints },
        {
          eyebrow: "AI search",
          title: "Structured for answers",
          body: "County pages use concise explanations, FAQ schema, image metadata, and internal links so buyers and AI search systems can understand the page quickly.",
        },
      ]}
      proofPoints={page.proofPoints}
      faqs={page.faqs}
      links={page.internalLinks}
    />
  );
}

function getTopicSlug(topicSlug?: string[] | null) {
  const slug = topicSlug?.[0] ?? null;
  return slug && seoAuthorityTopics.some((topic) => topic.slug === slug) ? slug : null;
}
