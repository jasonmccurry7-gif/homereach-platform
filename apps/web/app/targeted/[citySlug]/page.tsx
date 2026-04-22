// Public render route: /targeted/[citySlug]
// Type C (targeted route campaign) SEO page.
//
// Coexists with:
//   - app/targeted/page.tsx (the existing static marketing page at /targeted)
//   - app/(funnel)/targeted/start, /intake, /confirmed, /checkout (protected funnel)
// Static-route precedence means /targeted/start, /targeted/intake, etc. hit
// the funnel routes; only /targeted/{citySlug} resolves here.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedPageBySlug } from "@/lib/seo/registry";
import { getCityBySlug } from "@/lib/funnel/queries";
import { PageBlocks } from "@/components/seo/PageBlocks";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBreadcrumbLd, buildFaqPageLd, buildLocalBusinessLd, type JsonLd as JsonLdShape } from "@/lib/seo/schema";
import type { FaqBlock } from "@/lib/seo/blocks";

export const runtime = "nodejs";
export const revalidate = 300;

// Reserved citySlugs that MUST NOT resolve to this dynamic handler; they
// belong to the funnel group even though static-precedence usually handles
// this, we double-check to avoid accidental override.
const RESERVED_SLUGS = new Set(["start", "intake", "confirmed", "checkout"]);

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

type Props = { params: Promise<{ citySlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { citySlug } = await params;
  if (RESERVED_SLUGS.has(citySlug)) return { title: "Not Found" };
  const slug = `targeted/${citySlug}`;
  const page = await getPublishedPageBySlug(slug);
  if (!page) return { title: "Not Found" };
  return {
    title: page.title_tag ?? undefined,
    description: page.meta_description ?? undefined,
    alternates: { canonical: `${BASE}/${slug}` },
  };
}

export default async function TargetedCityPage({ params }: Props) {
  const { citySlug } = await params;
  if (RESERVED_SLUGS.has(citySlug)) notFound();
  const slug = `targeted/${citySlug}`;

  const page = await getPublishedPageBySlug(slug);
  if (!page) notFound();

  const city = await getCityBySlug(citySlug);
  if (!city) notFound();

  const srcParam = `seo_${page.id}`;
  const fullUrl = `${BASE}/${slug}`;

  const schemas: JsonLdShape[] = [
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Targeted Campaigns", url: `${BASE}/targeted` },
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
