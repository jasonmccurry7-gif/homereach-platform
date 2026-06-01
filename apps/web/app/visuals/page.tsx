import type { Metadata } from "next";
import Link from "next/link";
import { AuthorityPage } from "@/components/seo/AuthorityPage";
import { listVisualGalleries } from "@/lib/seo/authority";
import { buildBreadcrumbLd, buildItemListLd, type JsonLd as JsonLdShape } from "@/lib/seo/schema";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

export const metadata: Metadata = {
  title: "Postcard, Map, and Campaign Visual Galleries | HomeReach",
  description:
    "Searchable HomeReach visual galleries for political postcards, shared postcards, campaign maps, proposal visuals, and direct mail proof assets.",
  alternates: { canonical: `${BASE}/visuals` },
};

export default function VisualsHub() {
  const galleries = listVisualGalleries();
  const hero = galleries[0]!;
  const schemas: JsonLdShape[] = [
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Visuals", url: `${BASE}/visuals` },
    ]),
    buildItemListLd({
      name: "HomeReach Visual SEO Galleries",
      url: `${BASE}/visuals`,
      items: galleries.map((gallery) => ({ name: gallery.title, url: `${BASE}${gallery.path}` })),
    }),
  ];

  return (
    <AuthorityPage
      schemas={schemas}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Visuals", href: "/visuals" },
      ]}
      eyebrow="Visual SEO"
      title="Searchable galleries for postcards, maps, proposals, and campaign visuals"
      summary="Visual galleries let buyers inspect value before they buy while giving HomeReach optimized image metadata, internal links, and authority-building visual proof."
      visual={hero.visual}
      primaryCta={{ label: "Get My Proposal", href: "/get-started" }}
      secondaryCta={{ label: "See Political Mail", href: "/political-mail" }}
      metrics={[
        { label: "Galleries", value: String(galleries.length), note: "Political, shared, maps, and proposals" },
        { label: "Metadata", value: "Ready", note: "Alt text and image sitemap support" },
        { label: "Search", value: "Enabled", note: "Category and location filtering" },
        { label: "Design handoff", value: "Planned", note: "Canva and Figma workflows" },
      ]}
      sections={[
        { eyebrow: "Visual authority", title: "Show value before the pitch", body: "Galleries turn postcards, maps, dashboards, and proposal visuals into inspectable proof." },
        { eyebrow: "Image SEO", title: "Metadata and sitemap coverage", body: "Stable filenames, descriptive alt text, captions, and image sitemap entries support visual search." },
        { eyebrow: "Creative operations", title: "Ready for Canva and Figma", body: "Approved visuals can replace generated placeholders while preserving URLs and metadata." },
      ]}
      proofPoints={["Searchable visual galleries", "Optimized image metadata", "Proposal and outreach reuse"]}
      links={galleries.map((gallery) => ({ label: gallery.title, href: gallery.path }))}
    >
      <section className="bg-slate-950 px-4 py-16 text-white lg:px-6">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4">
          {galleries.map((gallery) => (
            <Link key={gallery.slug} href={gallery.path} className="rounded-lg border border-white/10 bg-white/[0.06] p-5 transition hover:bg-white hover:text-slate-950">
              <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{gallery.eyebrow}</p>
              <h2 className="mt-3 text-xl font-black">{gallery.title}</h2>
              <p className="mt-3 text-sm leading-7 opacity-80">{gallery.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </AuthorityPage>
  );
}
