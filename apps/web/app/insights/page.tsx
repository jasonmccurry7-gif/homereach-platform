import type { Metadata } from "next";
import Link from "next/link";
import { AuthorityPage } from "@/components/seo/AuthorityPage";
import { listAuthorityInsights } from "@/lib/seo/authority";
import { buildBreadcrumbLd, buildItemListLd, type JsonLd as JsonLdShape } from "@/lib/seo/schema";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

export const metadata: Metadata = {
  title: "Direct Mail, Political Mail, and Local Marketing Insights | HomeReach",
  description:
    "HomeReach authority insights on Ohio campaign mail, county saturation marketing, local advertising trends, and AI-search-ready direct mail content.",
  alternates: { canonical: `${BASE}/insights` },
};

export default function InsightsHub() {
  const insights = listAuthorityInsights();
  const hero = insights[0]!;
  const schemas: JsonLdShape[] = [
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Insights", url: `${BASE}/insights` },
    ]),
    buildItemListLd({
      name: "HomeReach Authority Insights",
      url: `${BASE}/insights`,
      items: insights.map((insight) => ({ name: insight.title, url: `${BASE}${insight.path}` })),
    }),
  ];

  return (
    <AuthorityPage
      schemas={schemas}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Insights", href: "/insights" },
      ]}
      eyebrow="Authority center"
      title="Operational insights, not a generic blog"
      summary="A public authority center for what HomeReach is seeing in direct mail, political mail, county marketing, local advertising, visual SEO, and AI search optimization."
      visual={hero.visual}
      primaryCta={{ label: "Get My Custom Plan", href: "/get-started" }}
      secondaryCta={{ label: "See Benchmarks", href: "/benchmarks" }}
      metrics={[
        { label: "Insights", value: String(insights.length), note: "Strategic, visual, and operational" },
        { label: "SEO role", value: "Authority", note: "Answer-first content and internal links" },
        { label: "AI search", value: "Ready", note: "FAQs, structure, and citations" },
        { label: "Homepage", value: "Clean", note: "Insights live in their own center" },
      ]}
      sections={[
        { eyebrow: "Positioning", title: "Insights with operating depth", body: "Each insight is tied to a real HomeReach workflow: maps, mail, proposals, calculators, galleries, datasets, or campaign execution." },
        { eyebrow: "AI search", title: "Structured for citation", body: "The content uses concise explanations, FAQs, internal links, and visual metadata so AI search systems can understand the answer." },
        { eyebrow: "Conversion", title: "Every insight leads somewhere", body: "Insights route readers to proposals, calculators, case studies, visual galleries, political pages, or benchmarks." },
      ]}
      proofPoints={["Operational insight center", "AI-search-ready structure", "Internal links into revenue pages"]}
      links={insights.map((insight) => ({ label: insight.title, href: insight.path }))}
    >
      <section className="bg-slate-950 px-4 py-16 text-white lg:px-6">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4">
          {insights.map((insight) => (
            <Link key={insight.slug} href={insight.path} className="rounded-lg border border-white/10 bg-white/[0.06] p-5 transition hover:bg-white hover:text-slate-950">
              <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{insight.eyebrow}</p>
              <h2 className="mt-3 text-xl font-black">{insight.title}</h2>
              <p className="mt-3 text-sm leading-7 opacity-80">{insight.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </AuthorityPage>
  );
}
