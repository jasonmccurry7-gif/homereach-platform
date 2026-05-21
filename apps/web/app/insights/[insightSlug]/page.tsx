import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthorityPage } from "@/components/seo/AuthorityPage";
import { getAuthorityInsight, listAuthorityInsights } from "@/lib/seo/authority";
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

type Props = { params: Promise<{ insightSlug: string }> };

export function generateStaticParams() {
  return listAuthorityInsights().map((insight) => ({ insightSlug: insight.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { insightSlug } = await params;
  const insight = getAuthorityInsight(insightSlug);
  if (!insight) return { title: "Not Found" };
  return {
    title: insight.metaTitle,
    description: insight.metaDescription,
    alternates: { canonical: `${BASE}${insight.path}` },
    openGraph: {
      title: insight.metaTitle,
      description: insight.metaDescription,
      url: `${BASE}${insight.path}`,
      images: [{ url: `${BASE}/seo-assets/${insight.visual.assetSlug}.svg`, alt: insight.visual.alt }],
    },
  };
}

export default async function InsightRoute({ params }: Props) {
  const { insightSlug } = await params;
  const insight = getAuthorityInsight(insightSlug);
  if (!insight) notFound();

  const fullUrl = `${BASE}${insight.path}`;
  const schemas: JsonLdShape[] = [
    buildArticleLd({
      headline: insight.title,
      description: insight.summary,
      url: fullUrl,
      image: `${BASE}/seo-assets/${insight.visual.assetSlug}.svg`,
      dateModified: new Date().toISOString(),
    }),
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Insights", url: `${BASE}/insights` },
      { name: insight.title, url: fullUrl },
    ]),
    buildFaqPageLd(insight.faqs),
    buildImageObjectLd({
      name: insight.visual.title,
      contentUrl: `${BASE}/seo-assets/${insight.visual.assetSlug}.svg`,
      caption: insight.visual.caption,
    }),
  ];

  return (
    <AuthorityPage
      schemas={schemas}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Insights", href: "/insights" },
        { label: insight.title, href: insight.path },
      ]}
      eyebrow={insight.eyebrow}
      title={insight.title}
      summary={insight.summary}
      visual={insight.visual}
      primaryCta={{ label: "Get My Custom Plan", href: "/get-started" }}
      secondaryCta={{ label: "All Insights", href: "/insights" }}
      metrics={[
        { label: "Signals", value: String(insight.signals.length), note: "Operational observations" },
        { label: "Recommendations", value: String(insight.recommendations.length), note: "Actionable next steps" },
        { label: "Schema", value: "Article", note: "FAQ and image metadata included" },
        { label: "AI search", value: "Structured", note: "Concise answer sections" },
      ]}
      sections={[
        { eyebrow: "Signals", title: "What to watch", items: insight.signals },
        { eyebrow: "Recommendations", title: "What to do next", items: insight.recommendations },
        { eyebrow: "Authority", title: "Why this supports SEO", body: "This insight connects public education with internal links, visual proof, datasets, and conversion paths." },
      ]}
      proofPoints={insight.signals}
      faqs={insight.faqs}
      links={insight.internalLinks}
    />
  );
}
