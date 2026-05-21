import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthorityPage } from "@/components/seo/AuthorityPage";
import { VisualGallerySearch } from "@/components/seo/VisualGallerySearch";
import { getVisualGallery, listVisualGalleries } from "@/lib/seo/authority";
import {
  buildBreadcrumbLd,
  buildImageObjectLd,
  buildItemListLd,
  type JsonLd as JsonLdShape,
} from "@/lib/seo/schema";

export const dynamicParams = false;
export const revalidate = 86400;

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

type Props = { params: Promise<{ gallerySlug: string }> };

export function generateStaticParams() {
  return listVisualGalleries().map((gallery) => ({ gallerySlug: gallery.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gallerySlug } = await params;
  const gallery = getVisualGallery(gallerySlug);
  if (!gallery) return { title: "Not Found" };
  return {
    title: gallery.metaTitle,
    description: gallery.metaDescription,
    alternates: { canonical: `${BASE}${gallery.path}` },
    openGraph: {
      title: gallery.metaTitle,
      description: gallery.metaDescription,
      url: `${BASE}${gallery.path}`,
      images: [{ url: `${BASE}/seo-assets/${gallery.visual.assetSlug}.svg`, alt: gallery.visual.alt }],
    },
  };
}

export default async function GalleryRoute({ params }: Props) {
  const { gallerySlug } = await params;
  const gallery = getVisualGallery(gallerySlug);
  if (!gallery) notFound();

  const fullUrl = `${BASE}${gallery.path}`;
  const schemas: JsonLdShape[] = [
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Visuals", url: `${BASE}/visuals` },
      { name: gallery.title, url: fullUrl },
    ]),
    buildItemListLd({
      name: gallery.title,
      url: fullUrl,
      items: gallery.items.map((item) => ({ name: item.title, url: fullUrl })),
    }),
    buildImageObjectLd({
      name: gallery.visual.title,
      contentUrl: `${BASE}/seo-assets/${gallery.visual.assetSlug}.svg`,
      caption: gallery.visual.caption,
    }),
  ];

  return (
    <AuthorityPage
      schemas={schemas}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Visuals", href: "/visuals" },
        { label: gallery.title, href: gallery.path },
      ]}
      eyebrow={gallery.eyebrow}
      title={gallery.title}
      summary={gallery.summary}
      visual={gallery.visual}
      primaryCta={{ label: "Get My Proposal", href: "/get-started" }}
      secondaryCta={{ label: "All Galleries", href: "/visuals" }}
      metrics={[
        { label: "Visuals", value: String(gallery.items.length), note: "Searchable gallery items" },
        { label: "Categories", value: String(gallery.categories.length), note: gallery.categories.slice(0, 2).join(", ") },
        { label: "Locations", value: String(gallery.locations.length), note: gallery.locations.slice(0, 2).join(", ") },
        { label: "Image SEO", value: "Ready", note: "Stable filenames and alt text" },
      ]}
      sections={[
        { eyebrow: "Gallery", title: "Searchable visual proof", body: gallery.summary },
        { eyebrow: "Metadata", title: "Tagged for category and location", items: [...gallery.categories.slice(0, 3), ...gallery.locations.slice(0, 3)] },
        { eyebrow: "Reuse", title: "Built for outreach and proposals", body: "Gallery assets can support SEO pages, outreach packages, proposals, client portals, and creative review." },
      ]}
      proofPoints={gallery.categories}
      links={gallery.internalLinks}
    >
      <VisualGallerySearch gallery={gallery} />
    </AuthorityPage>
  );
}
