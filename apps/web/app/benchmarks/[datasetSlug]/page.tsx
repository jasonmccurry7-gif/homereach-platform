import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthorityPage } from "@/components/seo/AuthorityPage";
import { getAuthorityDataset, listAuthorityDatasets } from "@/lib/seo/authority";
import {
  buildArticleLd,
  buildBreadcrumbLd,
  buildDatasetLd,
  buildImageObjectLd,
  type JsonLd as JsonLdShape,
} from "@/lib/seo/schema";

export const dynamicParams = false;
export const revalidate = 86400;

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

type Props = { params: Promise<{ datasetSlug: string }> };

export function generateStaticParams() {
  return listAuthorityDatasets().map((dataset) => ({ datasetSlug: dataset.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { datasetSlug } = await params;
  const dataset = getAuthorityDataset(datasetSlug);
  if (!dataset) return { title: "Not Found" };
  return {
    title: dataset.metaTitle,
    description: dataset.metaDescription,
    alternates: { canonical: `${BASE}${dataset.path}` },
    openGraph: {
      title: dataset.metaTitle,
      description: dataset.metaDescription,
      url: `${BASE}${dataset.path}`,
      images: [{ url: `${BASE}/seo-assets/${dataset.visual.assetSlug}.svg`, alt: dataset.visual.alt }],
    },
  };
}

export default async function DatasetRoute({ params }: Props) {
  const { datasetSlug } = await params;
  const dataset = getAuthorityDataset(datasetSlug);
  if (!dataset) notFound();

  const fullUrl = `${BASE}${dataset.path}`;
  const schemas: JsonLdShape[] = [
    buildArticleLd({
      headline: dataset.title,
      description: dataset.summary,
      url: fullUrl,
      image: `${BASE}/seo-assets/${dataset.visual.assetSlug}.svg`,
      dateModified: new Date().toISOString(),
    }),
    buildDatasetLd({
      name: dataset.title,
      description: dataset.summary,
      url: fullUrl,
      keywords: dataset.useCases,
    }),
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Benchmarks", url: `${BASE}/benchmarks` },
      { name: dataset.title, url: fullUrl },
    ]),
    buildImageObjectLd({
      name: dataset.visual.title,
      contentUrl: `${BASE}/seo-assets/${dataset.visual.assetSlug}.svg`,
      caption: dataset.visual.caption,
    }),
  ];

  return (
    <AuthorityPage
      schemas={schemas}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Benchmarks", href: "/benchmarks" },
        { label: dataset.title, href: dataset.path },
      ]}
      eyebrow={dataset.eyebrow}
      title={dataset.title}
      summary={dataset.summary}
      visual={dataset.visual}
      primaryCta={{ label: "Get My Proposal", href: "/get-started" }}
      secondaryCta={{ label: "All Benchmarks", href: "/benchmarks" }}
      metrics={dataset.metrics}
      sections={[
        { eyebrow: "Methodology", title: "How to read this dataset", items: dataset.methodology },
        { eyebrow: "Use cases", title: "Where this benchmark helps", items: dataset.useCases },
        { eyebrow: "Review", title: "Keep claims production-safe", body: "Benchmarks are planning assets. Live claims should be connected to approved analytics, campaign outcomes, or supplier data before publication." },
      ]}
      proofPoints={dataset.useCases}
      links={dataset.internalLinks}
    />
  );
}
