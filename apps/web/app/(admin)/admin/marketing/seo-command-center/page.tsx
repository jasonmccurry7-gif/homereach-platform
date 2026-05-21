import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  LineChart,
  Link2,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  authorityQualityRules,
  getAuthorityClusters,
  getSeoCommandCenterSnapshot,
  getTopAuthorityOpportunities,
  listAllAuthorityRoutes,
  listAuthorityDatasets,
  listAuthorityInsights,
  listInteractiveSeoTools,
  listSeoCaseStudies,
  listSeoKeywordTargets,
  listVisualGalleries,
} from "@/lib/seo/authority";

export const metadata: Metadata = {
  title: "SEO Command Center - HomeReach Admin",
};

export default function SeoCommandCenterPage() {
  const snapshot = getSeoCommandCenterSnapshot();
  const clusters = getAuthorityClusters();
  const routes = listAllAuthorityRoutes();
  const keywordTargets = listSeoKeywordTargets();
  const topPages = getTopAuthorityOpportunities(8);
  const caseStudies = listSeoCaseStudies();
  const tools = listInteractiveSeoTools();
  const insights = listAuthorityInsights();
  const galleries = listVisualGalleries();
  const datasets = listAuthorityDatasets();

  const performanceRows = keywordTargets.map((keyword, index) => ({
    url: keyword.targetPath,
    targetKeyword: keyword.keyword,
    currentRanking: "Connect GSC",
    rankingChange: "Pending",
    impressions: "Pending",
    clicks: "Pending",
    ctr: "Pending",
    visitors: "Pending",
    conversions: "Connect analytics",
    bounceRate: "Pending",
    avgTime: "Pending",
    backlinks: index % 2 === 0 ? "Opportunity" : "Monitor",
    internalLinks: "Ready",
    health: keyword.priority === "critical" ? "Priority" : "Good",
  }));

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-lg bg-slate-950 text-white shadow-2xl shadow-slate-950/20">
          <div className="grid gap-8 p-6 lg:grid-cols-[1fr_0.45fr] lg:p-8">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                Admin - Marketing - SEO Command Center
              </p>
              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight">
                AI-powered SEO authority engine
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
                A review-first command center for geographic authority, political SEO, visual assets, case studies, calculators, datasets, keyword targets, and the inbound lead flywheel.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ActionLink href="/ohio" label="Open Ohio hub" />
                <ActionLink href="/political-mail" label="Political mail hub" />
                <ActionLink href="/image-sitemap.xml" label="Image sitemap" />
              </div>
            </div>
            <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">Publishing mode</p>
              <p className="mt-2 text-2xl font-black text-white">{snapshot.mode}</p>
              <p className="mt-3 text-sm leading-7 text-emerald-50">
                AI can recommend pages, internal links, visuals, metadata, and improvements. Publishing remains human-approved.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Authority routes" value={snapshot.totals.publicAuthorityRoutes} note="Crawlable public authority paths" />
          <MetricCard label="Political pages" value={snapshot.totals.politicalPages} note="Political mail and campaign cluster" />
          <MetricCard label="Visual assets" value={snapshot.totals.visualAssets} note="Image metadata and sitemap coverage" />
          <MetricCard label="Interactive tools" value={snapshot.totals.interactiveTools} note="Dwell-time and lead assets" />
          <MetricCard label="Keyword targets" value={snapshot.totals.keywordTargets} note="Tracked opportunity list" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Analytics Readiness" icon={<BarChart3 className="h-5 w-5" />}>
            <div className="grid gap-3">
              {snapshot.analyticsReadiness.map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-slate-950">{item.label}</p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.nextAction}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="AI SEO Recommendations" icon={<Sparkles className="h-5 w-5" />}>
            <div className="grid gap-3">
              {snapshot.opportunityQueue.slice(0, 7).map((item) => (
                <div key={`${item.title}-${item.targetPath}`} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{item.title}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-blue-700">{item.area}</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">{item.impact}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.nextAction}</p>
                  <Link href={item.targetPath} className="mt-3 inline-flex items-center gap-2 text-sm font-black text-blue-700">
                    Open target <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {clusters.map((cluster) => (
            <Link key={cluster.name} href={cluster.href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-lg">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{cluster.name}</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{cluster.count}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{cluster.detail}</p>
            </Link>
          ))}
        </section>

        <Panel title="SEO Page Performance Table" icon={<LineChart className="h-5 w-5" />}>
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  {["URL", "Keyword", "Rank", "Change", "Impressions", "Clicks", "CTR", "Visitors", "Conversions", "Bounce", "Time", "Backlinks", "Links", "Health"].map((heading) => (
                    <th key={heading} className="border-b border-slate-200 px-3 py-3 font-black">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {performanceRows.map((row) => (
                  <tr key={row.url} className="align-top">
                    <td className="border-b border-slate-100 px-3 py-3 font-bold text-blue-700">
                      <Link href={row.url}>{row.url}</Link>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-900">{row.targetKeyword}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{row.currentRanking}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{row.rankingChange}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{row.impressions}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{row.clicks}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{row.ctr}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{row.visitors}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{row.conversions}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{row.bounceRate}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{row.avgTime}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{row.backlinks}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{row.internalLinks}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{row.health}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Keyword Tracking" icon={<Search className="h-5 w-5" />}>
            <div className="grid gap-3">
              {keywordTargets.map((keyword) => (
                <div key={keyword.keyword} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-slate-950">{keyword.keyword}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{keyword.priority}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{keyword.opportunity}</p>
                  <Link href={keyword.targetPath} className="mt-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                    {keyword.cluster} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Flywheel Inventory" icon={<Link2 className="h-5 w-5" />}>
            <InventoryRow label="Case studies" value={caseStudies.length} href="/case-studies" />
            <InventoryRow label="Interactive tools" value={tools.length} href="/tools" />
            <InventoryRow label="Insights" value={insights.length} href="/insights" />
            <InventoryRow label="Visual galleries" value={galleries.length} href="/visuals" />
            <InventoryRow label="Benchmark datasets" value={datasets.length} href="/benchmarks" />
            <InventoryRow label="Authority routes" value={routes.length} href="/sitemap.xml" />
          </Panel>

          <Panel title="Quality Guardrails" icon={<ShieldCheck className="h-5 w-5" />}>
            <div className="grid gap-3">
              {authorityQualityRules.map((rule) => (
                <div key={rule} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <p className="text-sm leading-6 text-slate-700">{rule}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <Panel title="Top Authority Pages To Improve Next" icon={<Sparkles className="h-5 w-5" />}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {topPages.map((page) => (
              <Link key={page.path} href={page.path} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-lg">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{page.pageType.replaceAll("_", " ")}</p>
                <p className="mt-2 text-base font-black text-slate-950">{page.h1}</p>
                <p className="mt-3 text-xs leading-5 text-slate-600">{page.metaDescription}</p>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: number | string; note: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{note}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-slate-950">
        <span className="rounded-lg bg-blue-50 p-2 text-blue-700">{icon}</span>
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white hover:text-slate-950">
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function InventoryRow({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="mb-3 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 transition hover:border-blue-200">
      <span className="text-sm font-black text-slate-950">{label}</span>
      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-sm font-black text-blue-700">{value}</span>
    </Link>
  );
}
