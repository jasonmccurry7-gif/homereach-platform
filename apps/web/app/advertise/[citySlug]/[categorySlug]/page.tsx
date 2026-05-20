// Public render route: /advertise/[citySlug]/[categorySlug]
// Type A (city + category) SEO page.
//
// Reads the published seo_pages row by slug. 404 when flag off, not found,
// or not published. Emits per-page JSON-LD (Service + Breadcrumb + FAQPage
// when an FAQ block is present). ISR 5min via `revalidate`.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedPageBySlug } from "@/lib/seo/registry";
import { getCityBySlug, getCategoryBySlug } from "@/lib/funnel/queries";
import { PageBlocks } from "@/components/seo/PageBlocks";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildServiceLd, buildBreadcrumbLd, buildFaqPageLd, buildLocalBusinessLd, type JsonLd as JsonLdShape } from "@/lib/seo/schema";
import type { FaqBlock } from "@/lib/seo/blocks";

export const runtime = "nodejs";
export const revalidate = 300;

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

type Props = { params: Promise<{ citySlug: string; categorySlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { citySlug, categorySlug } = await params;
  const slug = `advertise/${citySlug}/${categorySlug}`;
  const page = await getPublishedPageBySlug(slug);
  if (!page) return { title: "Not Found" };
  return {
    title: page.title_tag ?? undefined,
    description: page.meta_description ?? undefined,
    alternates: {
      canonical: `${BASE}/${slug}`,
    },
  };
}

export default async function AdvertiseCityCategoryPage({ params }: Props) {
  const { citySlug, categorySlug } = await params;
  const slug = `advertise/${citySlug}/${categorySlug}`;

  const page = await getPublishedPageBySlug(slug);
  if (!page) notFound();

  const [city, category] = await Promise.all([
    getCityBySlug(citySlug),
    getCategoryBySlug(categorySlug),
  ]);
  if (!city || !category) notFound();

  const srcParam = `seo_${page.id}`;
  const fullUrl = `${BASE}/${slug}`;

  // Build per-page JSON-LD
  const schemas: JsonLdShape[] = [
    buildServiceLd({
      name: page.title_tag ?? `${category.name} Advertising in ${city.name}`,
      description: page.meta_description ?? "",
      city: city.name,
      category: category.name,
      url: fullUrl,
    }),
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Advertise", url: `${BASE}/advertise` },
      { name: city.name, url: `${BASE}/advertise/${city.slug}` },
      { name: category.name, url: fullUrl },
    ]),
    buildLocalBusinessLd({
      name: "HomeReach",
      url: fullUrl,
      city: city.name,
      region: city.state,
      areaServed: `${city.name}, ${city.state}`,
    }),
  ];

  const faqBlock = page.content_blocks.find((b) => b.kind === "faq") as FaqBlock | undefined;
  if (faqBlock && faqBlock.data?.pairs && faqBlock.data.pairs.length > 0) {
    schemas.push(buildFaqPageLd(faqBlock.data.pairs));
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <JsonLd schemas={schemas} />
      <PageBlocks
        blocks={page.content_blocks}
        context={{
          cityId: city.id,
          categoryId: category.id,
          cityName: city.name,
          categoryName: category.name,
          srcParam,
        }}
      />
    </main>
  );
}
