// Public render route: /advertise/[citySlug]
// Type B (city-only availability) SEO page.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedPageBySlug } from "@/lib/seo/registry";
import { getCityBySlug } from "@/lib/funnel/queries";
import { PageBlocks } from "@/components/seo/PageBlocks";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBreadcrumbLd, buildLocalBusinessLd, buildFaqPageLd, type JsonLd as JsonLdShape } from "@/lib/seo/schema";
import type { FaqBlock } from "@/lib/seo/blocks";

export const runtime = "nodejs";
export const revalidate = 300;

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

type Props = { params: Promise<{ citySlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { citySlug } = await params;
  const slug = `advertise/${citySlug}`;
  const page = await getPublishedPageBySlug(slug);
  if (!page) return { title: "Not Found" };
  return {
    title: page.title_tag ?? undefined,
    description: page.meta_description ?? undefined,
    alternates: { canonical: `${BASE}/${slug}` },
  };
}

export default async function AdvertiseCityPage({ params }: Props) {
  const { citySlug } = await params;
  const slug = `advertise/${citySlug}`;

  const page = await getPublishedPageBySlug(slug);
  if (!page) notFound();

  const city = await getCityBySlug(citySlug);
  if (!city) notFound();

  const srcParam = `seo_${page.id}`;
  const fullUrl = `${BASE}/${slug}`;

  const schemas: JsonLdShape[] = [
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Advertise", url: `${BASE}/advertise` },
      { name: city.name, url: fullUrl },
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
          categoryId: null,
          cityName: city.name,
          categoryName: null,
          srcParam,
        }}
      />
    </main>
  );
}
