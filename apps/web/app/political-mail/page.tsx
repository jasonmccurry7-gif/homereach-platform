import type { Metadata } from "next";
import Link from "next/link";
import { AuthorityPage } from "@/components/seo/AuthorityPage";
import { listPoliticalAuthorityPages } from "@/lib/seo/authority";
import { buildBreadcrumbLd, buildItemListLd, type JsonLd as JsonLdShape } from "@/lib/seo/schema";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

export const metadata: Metadata = {
  title: "Political Mail Ohio and Campaign Postcards | HomeReach",
  description:
    "HomeReach political mail authority center for Ohio campaign postcards, county campaign mail, judicial mail, sheriff campaigns, GOTV postcards, and political direct mail strategy.",
  alternates: { canonical: `${BASE}/political-mail` },
};

export default function PoliticalMailHub() {
  const pages = listPoliticalAuthorityPages();
  const hero = pages[0]!;
  const schemas: JsonLdShape[] = [
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Political Mail", url: `${BASE}/political-mail` },
    ]),
    buildItemListLd({
      name: "HomeReach Political Mail Authority Pages",
      url: `${BASE}/political-mail`,
      items: pages.map((page) => ({ name: page.title, url: `${BASE}${page.path}` })),
    }),
  ];

  return (
    <AuthorityPage
      schemas={schemas}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Political Mail", href: "/political-mail" },
      ]}
      eyebrow="Political SEO authority"
      title="Ohio political mail, campaign postcards, and direct mail strategy"
      summary="A public authority center for campaign mail buyers. It explains strategy, visuals, geography, and next steps while outreach, targeting, approvals, and execution stay inside the admin system."
      visual={hero.visual}
      primaryCta={{ label: "Plan Political Mail", href: "/political" }}
      secondaryCta={{ label: "See Postcard Gallery", href: "/visuals/political-postcard-gallery" }}
      metrics={[
        { label: "Authority pages", value: String(pages.length), note: "Statewide, county, office, and campaign type pages" },
        { label: "Compliance posture", value: "Neutral", note: "Geography and logistics only" },
        { label: "Visual SEO", value: "Active", note: "Political mockups and image metadata" },
        { label: "Primary CTA", value: "Plan", note: "Routes into political campaign workflow" },
      ]}
      sections={[
        {
          eyebrow: "Political authority",
          title: "Built for campaign intent",
          body: "The cluster targets campaign managers, candidates, consultants, issue committees, and county parties looking for direct mail execution.",
        },
        {
          eyebrow: "Visual proof",
          title: "Mockups, maps, and rollout logic",
          body: "Every political page can connect to postcard galleries, county maps, campaign estimators, and benchmark datasets.",
        },
        {
          eyebrow: "Safety",
          title: "No individual belief inference",
          body: "Political SEO stays focused on geography, office level, campaign logistics, creative concepts, and public-facing message strategy.",
        },
      ]}
      proofPoints={["Campaign-safe political SEO cluster", "Office and campaign-type pages", "Visual assets and image sitemap coverage"]}
      links={pages.slice(0, 8).map((page) => ({ label: page.title, href: page.path }))}
    >
      <section className="bg-slate-950 px-4 py-16 text-white lg:px-6">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {pages.map((page) => (
            <Link key={page.slug} href={page.path} className="rounded-lg border border-white/10 bg-white/[0.06] p-5 transition hover:bg-white hover:text-slate-950">
              <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{page.pageType.replaceAll("_", " ")}</p>
              <h2 className="mt-3 text-xl font-black">{page.title}</h2>
              <p className="mt-3 text-sm leading-7 opacity-80">{page.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </AuthorityPage>
  );
}
