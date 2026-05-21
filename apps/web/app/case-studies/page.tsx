import type { Metadata } from "next";
import Link from "next/link";
import { AuthorityPage } from "@/components/seo/AuthorityPage";
import { listSeoCaseStudies } from "@/lib/seo/authority";
import { buildBreadcrumbLd, buildItemListLd, type JsonLd as JsonLdShape } from "@/lib/seo/schema";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

export const metadata: Metadata = {
  title: "Direct Mail and Campaign Case Studies | HomeReach",
  description:
    "HomeReach case studies for direct mail, shared postcards, political mail, neighborhood saturation, route planning, and campaign execution.",
  alternates: { canonical: `${BASE}/case-studies` },
};

export default function CaseStudiesHub() {
  const studies = listSeoCaseStudies();
  const hero = studies[0]!;
  const schemas: JsonLdShape[] = [
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Case Studies", url: `${BASE}/case-studies` },
    ]),
    buildItemListLd({
      name: "HomeReach Case Studies",
      url: `${BASE}/case-studies`,
      items: studies.map((study) => ({ name: study.title, url: `${BASE}${study.path}` })),
    }),
  ];

  return (
    <AuthorityPage
      schemas={schemas}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Case Studies", href: "/case-studies" },
      ]}
      eyebrow="Authority case studies"
      title="Case studies that turn campaigns into proof and stronger SEO"
      summary="A public trust layer for route plans, postcard visuals, rollout timelines, and campaign examples. These pages support rankings, backlinks, proposals, and future sales follow-up."
      visual={hero.visual}
      primaryCta={{ label: "Get My Proposal", href: "/get-started" }}
      secondaryCta={{ label: "See Tools", href: "/tools" }}
      metrics={[
        { label: "Case studies", value: String(studies.length), note: "Built from campaign and proposal patterns" },
        { label: "SEO role", value: "Trust", note: "Backlinks, proof, and conversion support" },
        { label: "Visuals", value: "Included", note: "Maps, postcards, dashboards, and proposals" },
        { label: "Review", value: "Required", note: "Real results should be approved before publishing" },
      ]}
      sections={[
        { eyebrow: "Trust", title: "Show the work visually", body: "Case studies help buyers understand route choices, mail waves, creative, and the next action before they talk to sales." },
        { eyebrow: "SEO", title: "Proof creates authority", body: "Each case study links back into city, county, industry, political, and tool pages so the whole authority graph gets stronger." },
        { eyebrow: "Operations", title: "Results stay grounded", body: "Public examples should use approved visuals, campaign-safe claims, and operational explanations instead of thin AI copy." },
      ]}
      proofPoints={["Map and rollout visuals", "Proposal-ready proof", "Internal links into revenue pages"]}
      links={studies.map((study) => ({ label: study.title, href: study.path }))}
    >
      <section className="bg-slate-950 px-4 py-16 text-white lg:px-6">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4">
          {studies.map((study) => (
            <Link key={study.slug} href={study.path} className="rounded-lg border border-white/10 bg-white/[0.06] p-5 transition hover:bg-white hover:text-slate-950">
              <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{study.category}</p>
              <h2 className="mt-3 text-xl font-black">{study.title}</h2>
              <p className="mt-3 text-sm leading-7 opacity-80">{study.summary}</p>
              <p className="mt-4 text-sm font-black">{study.resultSignal}</p>
            </Link>
          ))}
        </div>
      </section>
    </AuthorityPage>
  );
}
