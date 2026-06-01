import type { Metadata } from "next";
import Link from "next/link";
import { AuthorityPage } from "@/components/seo/AuthorityPage";
import { listAuthorityDatasets } from "@/lib/seo/authority";
import { buildBreadcrumbLd, buildItemListLd, type JsonLd as JsonLdShape } from "@/lib/seo/schema";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

export const metadata: Metadata = {
  title: "Direct Mail, Political Mail, and Campaign Benchmarks | HomeReach",
  description:
    "HomeReach benchmark datasets for campaign mail, route density, postcard costs, local advertising, and procurement savings planning.",
  alternates: { canonical: `${BASE}/benchmarks` },
};

export default function BenchmarksHub() {
  const datasets = listAuthorityDatasets();
  const hero = datasets[0]!;
  const schemas: JsonLdShape[] = [
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Benchmarks", url: `${BASE}/benchmarks` },
    ]),
    buildItemListLd({
      name: "HomeReach Authority Benchmark Datasets",
      url: `${BASE}/benchmarks`,
      items: datasets.map((dataset) => ({ name: dataset.title, url: `${BASE}${dataset.path}` })),
    }),
  ];

  return (
    <AuthorityPage
      schemas={schemas}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Benchmarks", href: "/benchmarks" },
      ]}
      eyebrow="Authority datasets"
      title="Benchmark pages that compound HomeReach authority"
      summary="Proprietary benchmark pages support backlinks, citations, AI search visibility, proposal education, and future case studies without exposing internal admin controls."
      visual={hero.visual}
      primaryCta={{ label: "Get My Proposal", href: "/get-started" }}
      secondaryCta={{ label: "See Tools", href: "/tools" }}
      metrics={[
        { label: "Datasets", value: String(datasets.length), note: "Campaign, route, postcard, local, procurement" },
        { label: "SEO role", value: "Citable", note: "Structured facts and methodology" },
        { label: "Visuals", value: "Included", note: "Dashboard and proposal graphics" },
        { label: "Claims", value: "Reviewed", note: "No unverified live performance claims" },
      ]}
      sections={[
        { eyebrow: "Authority", title: "Datasets make HomeReach citable", body: "Benchmarks give other pages a reason to reference HomeReach beyond a sales pitch." },
        { eyebrow: "AI search", title: "Clear facts and methodology", body: "Structured metrics, methodology, and use cases help AI systems understand what the dataset means." },
        { eyebrow: "Revenue", title: "Benchmarks feed proposals", body: "Each dataset connects to tools, case studies, proposals, and internal SEO recommendations." },
      ]}
      proofPoints={["Structured metrics", "Methodology notes", "Internal links into tools and proposals"]}
      links={datasets.map((dataset) => ({ label: dataset.title, href: dataset.path }))}
    >
      <section className="bg-slate-950 px-4 py-16 text-white lg:px-6">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-5">
          {datasets.map((dataset) => (
            <Link key={dataset.slug} href={dataset.path} className="rounded-lg border border-white/10 bg-white/[0.06] p-5 transition hover:bg-white hover:text-slate-950">
              <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{dataset.eyebrow}</p>
              <h2 className="mt-3 text-xl font-black">{dataset.title}</h2>
              <p className="mt-3 text-sm leading-7 opacity-80">{dataset.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </AuthorityPage>
  );
}
