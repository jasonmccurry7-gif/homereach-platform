import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
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
import type { SeoConnectorKey, SeoConnectorStatusValue } from "@/lib/seo/connectors";
import { getAutonomousSeoStrategy } from "@/lib/seo/autonomous-strategy";
import { getSeoSuccessSnapshot, type SeoSuccessSnapshot, type SeoSuccessStatus } from "@/lib/seo/success";
import { SeoConnectorActions } from "./seo-connector-actions";

export const metadata: Metadata = {
  title: "SEO Command Center - HomeReach Admin",
};

export default async function SeoCommandCenterPage() {
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
  const success = await getSeoSuccessSnapshot();
  const autonomousStrategy = getAutonomousSeoStrategy();
  const connectorRows = buildConnectorRows(success);
  const readinessTone = getReadinessTone(success.readinessScore, success.missingDataSources.length);
  const connectorBlockedMetrics = success.metrics.filter((metric) => metric.status === "needs_connector").length;
  const performanceRows = success.connectorSnapshot.performanceRows;
  const analyticsReadinessRows = buildAnalyticsReadinessRows(success);

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
                SEO success and authority readiness
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
                A review-first SEO module for geographic authority, political SEO, visual assets, case studies, calculators,
                datasets, keyword targets, and the inbound lead flywheel. The primary admin command layer stays HomeReach OS.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ActionLink href="/ohio" label="Open Ohio hub" />
                <ActionLink href="/political-mail" label="Political mail hub" />
                <ActionLink href="/answers" label="Answers hub" />
                <ActionLink href="/llms.txt" label="LLMs.txt" />
                <ActionLink href="/robots.txt" label="Robots" />
                <ActionLink href="/image-sitemap.xml" label="Image sitemap" />
                <ActionLink href="/admin/os" label="HomeReach OS" />
              </div>
            </div>
            <div className={`rounded-lg border p-5 ${readinessTone.panel}`}>
              <p className="text-xs font-black uppercase tracking-[0.16em]">Success reporting state</p>
              <p className="mt-2 text-2xl font-black text-white">{readinessTone.label}</p>
              <p className="mt-3 text-sm leading-7">
                Authority foundations are visible now. Live rankings, impressions, clicks, and organic lead attribution stay connector-gated until Search Console and analytics are connected.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <DarkMetric label="Connector gaps" value={success.missingDataSources.length} />
                <DarkMetric label="Pending metrics" value={connectorBlockedMetrics} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
          <MetricCard label="Authority routes" value={snapshot.totals.publicAuthorityRoutes} note="Crawlable public authority paths" />
          <MetricCard label="Political pages" value={snapshot.totals.politicalPages} note="Political mail and campaign cluster" />
          <MetricCard label="Visual assets" value={snapshot.totals.visualAssets} note="Image metadata and sitemap coverage" />
          <MetricCard label="Interactive tools" value={snapshot.totals.interactiveTools} note="Dwell-time and lead assets" />
          <MetricCard label="Keyword targets" value={snapshot.totals.keywordTargets} note="Tracked opportunity list" />
          <MetricCard label="Legacy local pages" value={success.legacyLocalRouteCount} note="Indexed city-category routes under the legacy slug handler" />
          <MetricCard label="AEO surfaces" value={success.answerEngineSurfaceCount} note="Public answer, service, tool, and crawler guidance pages" />
          <MetricCard label="Rank targets" value={autonomousStrategy.rankTargets.length} note="Core product pages with mapped intent and next actions" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Panel title="Autonomous Ranking Strategy" icon={<Sparkles className="h-5 w-5" />}>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">Objective</p>
              <p className="mt-2 text-sm leading-7 text-blue-950">{autonomousStrategy.objective}</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {autonomousStrategy.rankTargets.slice(0, 8).map((target) => (
                <Link
                  key={`${target.product}-${target.path}`}
                  href={target.path}
                  className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-lg"
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{target.intent}</p>
                  <h2 className="mt-2 text-base font-black text-slate-950">{target.product}</h2>
                  <p className="mt-2 text-sm font-semibold text-blue-700">{target.primaryKeyword}</p>
                  <p className="mt-3 text-xs leading-5 text-slate-600">{target.autonomousNextMove}</p>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Twice-Daily SEO Agent Loop" icon={<Clock3 className="h-5 w-5" />}>
            <div className="grid gap-3">
              {autonomousStrategy.operatingLanes.slice(0, 2).map((lane) => (
                <div key={lane.lane} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-slate-950">{lane.lane}</p>
                      <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-blue-700">{lane.cadence}</p>
                    </div>
                    <StatusBadge status="ready" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{lane.mission}</p>
                  <div className="mt-3 grid gap-2">
                    {lane.autonomousWork.slice(0, 3).map((item) => (
                      <div key={item} className="flex gap-2 text-xs leading-5 text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
          <div className="rounded-lg bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/10">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-200">SEO Success Visibility</p>
            <div className="mt-5 flex items-end gap-3">
              <p className="text-6xl font-black">{success.readinessScore}</p>
              <p className="pb-2 text-sm font-black uppercase tracking-[0.12em] text-slate-400">readiness score</p>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              This is a visibility readiness score, not a ranking claim. Connect Search Console and analytics to turn readiness into measured traffic, click, lead, and proposal reporting.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <DarkMetric label="Crawlable routes" value={success.crawlableRouteCount} />
              <DarkMetric label="Service pages" value={success.servicePageCount} />
              <DarkMetric label="Authority URLs" value={success.authorityRouteCount} />
              <DarkMetric label="Image assets" value={success.imageAssetCount} />
            </div>
          </div>

          <Panel title="Measured Success Signals" icon={<BarChart3 className="h-5 w-5" />}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {success.metrics.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">{metric.value}</p>
                    </div>
                    <StatusBadge status={metric.status} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{metric.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <DataSourceCard title="Connected data sources" items={success.connectedDataSources} positive />
              <DataSourceCard title="Still needed for true performance reporting" items={success.missingDataSources} />
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Connector Truth Table" icon={<Clock3 className="h-5 w-5" />}>
            <div className="grid gap-3 md:grid-cols-2">
              {connectorRows.map((row) => (
                <div key={row.label} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{row.label}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{row.source}</p>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{row.detail}</p>
                  {row.rowCount !== undefined || row.lastSyncAt ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <MiniReadout label="Rows" value={row.rowCount ?? 0} />
                      <MiniReadout label="Last sync" value={formatDate(row.lastSyncAt)} />
                    </div>
                  ) : null}
                  {row.sourceKey ? <SeoConnectorActions sourceKey={row.sourceKey} /> : null}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Success Readout Model" icon={<ShieldCheck className="h-5 w-5" />}>
            <div className="grid gap-3 md:grid-cols-3">
              <ReadoutCard
                label="Live now"
                value={`${success.crawlableRouteCount} URLs`}
                detail="Crawlable routes, service pages, authority routes, sitemap entries, image metadata, and structured page inventory."
                status="live"
              />
              <ReadoutCard
                label="Connector-gated"
                value={`${connectorBlockedMetrics} metrics`}
                detail="Rankings, impressions, clicks, CTR, organic conversions, and page-level lead attribution are not reported as measured until connected."
                status={connectorBlockedMetrics > 0 ? "needs_connector" : "ready"}
              />
              <ReadoutCard
                label="Approval-gated"
                value={snapshot.mode}
                detail="AI recommendations can prepare briefs, metadata, links, and copy. Public SEO changes still need human approval."
                status="needs_review"
              />
            </div>
          </Panel>
        </section>

        <Panel title="Technical SEO Health" icon={<ShieldCheck className="h-5 w-5" />}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {success.technicalChecks.map((check) => (
              <div key={check.label} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-slate-950">{check.label}</p>
                  <StatusBadge status={check.status} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{check.detail}</p>
                {check.ownerAction ? (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
                    Owner action: {check.ownerAction}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {success.nextActions.map((action) => (
            <div key={action.title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-blue-700">
                {action.impact}
              </span>
              <p className="mt-3 font-black text-slate-950">{action.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{action.detail}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Analytics Readiness" icon={<BarChart3 className="h-5 w-5" />}>
            <div className="grid gap-3">
              {analyticsReadinessRows.map((item) => (
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

        <Panel title="Priority Pages To Watch For Revenue" icon={<Search className="h-5 w-5" />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  {["Path", "Keyword", "Cluster", "Priority", "Status", "Next Action"].map((heading) => (
                    <th key={heading} className="border-b border-slate-200 px-3 py-3 font-black">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {success.topPages.map((page) => (
                  <tr key={`${page.path}-${page.keyword}`} className="align-top">
                    <td className="border-b border-slate-100 px-3 py-3 font-bold text-blue-700">
                      <Link href={page.path}>{page.path}</Link>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-950">{page.keyword}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{page.cluster}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{page.priority}</td>
                    <td className="border-b border-slate-100 px-3 py-3"><StatusBadge status={page.status} /></td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{page.nextAction}</td>
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

function getReadinessTone(score: number, missingConnectors: number) {
  if (missingConnectors > 0) {
    return {
      label: "Authority ready, measurement pending",
      panel: "border-amber-300/25 bg-amber-300/10 text-amber-50",
    };
  }
  if (score >= 90) {
    return {
      label: "Measurement-ready",
      panel: "border-emerald-300/25 bg-emerald-300/10 text-emerald-50",
    };
  }
  return {
    label: "Needs review before scale",
    panel: "border-blue-300/25 bg-blue-300/10 text-blue-50",
  };
}

type ConnectorTruthRow = {
  label: string;
  source: string;
  status: SeoSuccessStatus;
  detail: string;
  sourceKey?: SeoConnectorKey;
  rowCount?: number;
  lastSyncAt?: string | null;
};

function buildConnectorRows(success: SeoSuccessSnapshot): ConnectorTruthRow[] {
  const connectorRows = success.connectorSnapshot.connectors.map((connector) => ({
    label: connector.label,
    source: connector.provider,
    sourceKey: connector.sourceKey as SeoConnectorKey,
    status: connectorStatusToSuccessStatus(connector.status),
    rowCount: connector.rowCount,
    lastSyncAt: connector.lastSyncAt ?? connector.lastSuccessAt,
    detail:
      connector.status === "connected"
        ? `${connector.rowCount} rows are available. ${connector.nextAction}`
        : connector.status === "ready"
          ? `Credentials look present. ${connector.nextAction}`
          : connector.status === "paused"
            ? `${connector.label} is paused. ${connector.lastError ?? connector.nextAction}`
            : connector.lastError
              ? `${connector.nextAction} Latest issue: ${connector.lastError}`
              : connector.nextAction,
  }));

  return [
    {
      label: "SEO authority registry",
      source: "Internal HomeReach registry",
      status: "live" as SeoSuccessStatus,
      detail: "Public authority paths, page types, clusters, internal link targets, and quality rules are loaded from the existing SEO registry.",
    },
    {
      label: "Sitemap coverage",
      source: "/sitemap.xml and /image-sitemap.xml",
      status: "live" as SeoSuccessStatus,
      detail: "Core public routes, services, authority pages, and image assets are available for crawl discovery after deploy.",
    },
    ...connectorRows,
  ];
}

function connectorStatusToSuccessStatus(status: SeoConnectorStatusValue): SeoSuccessStatus {
  if (status === "connected") return "live";
  if (status === "ready") return "ready";
  if (status === "warning" || status === "error" || status === "paused") return "needs_review";
  return "needs_connector";
}

function buildAnalyticsReadinessRows(success: SeoSuccessSnapshot) {
  return [
    ...success.connectorSnapshot.connectors.map((connector) => ({
      label: connector.label,
      status: connector.status.replaceAll("_", " "),
      nextAction: connector.nextAction,
    })),
    { label: "Image sitemap", status: "active", nextAction: "Replace generated placeholders with approved Canva/Figma visuals over time." },
    { label: "Human publishing review", status: "required", nextAction: "Keep AI content in draft and approval workflows before publish." },
  ];
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

function ReadoutCard({
  detail,
  label,
  status,
  value,
}: {
  detail: string;
  label: string;
  status: SeoSuccessStatus;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

function DarkMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function MiniReadout({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-black text-slate-950">{value}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: SeoSuccessStatus }) {
  const styles: Record<SeoSuccessStatus, string> = {
    live: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    ready: "bg-blue-50 text-blue-700 ring-blue-200",
    needs_connector: "bg-amber-50 text-amber-800 ring-amber-200",
    needs_review: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  const labels: Record<SeoSuccessStatus, string> = {
    live: "Live",
    ready: "Ready",
    needs_connector: "Needs connector",
    needs_review: "Needs review",
  };

  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ring-1 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function DataSourceCard({ title, items, positive = false }: { title: string; items: string[]; positive?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className={
              positive
                ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700"
                : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800"
            }
          >
            {item}
          </span>
        ))}
      </div>
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
