import { listGrowthServiceModules } from "@/lib/growth-execution/services";
import {
  getAuthorityClusters,
  listAllAuthorityRoutes,
  listSeoKeywordTargets,
  listSeoVisualAssets,
} from "@/lib/seo/authority";
import { isSeoLegacyRedirectEnabled } from "@/lib/seo/env";
import { listLegacyCityCategoryPages } from "@/lib/seo/legacy-local-pages";
import { getSeoConnectorSnapshot, type SeoConnectorSnapshot, type SeoConnectorStatusValue } from "@/lib/seo/connectors";
import { listMainProductSeoTargets } from "@/lib/seo/product-seo";

export type SeoSuccessStatus = "live" | "ready" | "needs_connector" | "needs_review";

export type SeoSuccessMetric = {
  label: string;
  value: string | number;
  status: SeoSuccessStatus;
  detail: string;
};

export type SeoTechnicalCheck = {
  label: string;
  status: SeoSuccessStatus;
  detail: string;
  ownerAction?: string;
};

export type SeoSuccessPageRow = {
  path: string;
  keyword: string;
  cluster: string;
  priority: string;
  status: SeoSuccessStatus;
  nextAction: string;
};

export type SeoSuccessSnapshot = {
  readinessScore: number;
  lastUpdated: string;
  crawlableRouteCount: number;
  servicePageCount: number;
  authorityRouteCount: number;
  imageAssetCount: number;
  legacyLocalRouteCount: number;
  answerEngineSurfaceCount: number;
  connectedDataSources: string[];
  missingDataSources: string[];
  metrics: SeoSuccessMetric[];
  technicalChecks: SeoTechnicalCheck[];
  topPages: SeoSuccessPageRow[];
  connectorSnapshot: SeoConnectorSnapshot;
  nextActions: Array<{ title: string; impact: "critical" | "high" | "medium"; detail: string }>;
};

const CORE_PUBLIC_ROUTES = [
  "/",
  "/answers",
  "/llms.txt",
  "/shared-postcards",
  "/targeted",
  "/political",
  "/political-mail",
  "/campaign-mail",
  "/inventory-purchasing",
  "/operations-copilot",
  "/property-intelligence",
  "/services",
  "/ohio",
  "/case-studies",
  "/tools",
  "/learn",
  "/insights",
  "/visuals",
  "/benchmarks",
] as const;

const ANSWER_ENGINE_SURFACES = [
  "/answers",
  "/llms.txt",
  "/services",
  "/learn",
  "/tools",
  "/insights",
  "/visuals",
  "/benchmarks",
] as const;

export async function getSeoSuccessSnapshot(): Promise<SeoSuccessSnapshot> {
  const authorityRoutes = listAllAuthorityRoutes();
  const serviceRoutes = listGrowthServiceModules().filter((service) => service.publicExposure !== "admin_only");
  const mainProductTargets = listMainProductSeoTargets(serviceRoutes);
  const imageAssets = listSeoVisualAssets();
  const keywordTargets = listSeoKeywordTargets();
  const clusters = getAuthorityClusters();
  const legacyLocalRouteCount = listLegacyCityCategoryPages().length;
  const answerEngineSurfaceCount = ANSWER_ENGINE_SURFACES.length;
  const connectorSnapshot = await getSeoConnectorSnapshot();
  const connectedDataSources = getConnectedDataSources(connectorSnapshot);
  const missingDataSources = getMissingDataSources(connectorSnapshot);
  const searchConsole = connectorSnapshot.connectors.find((connector) => connector.sourceKey === "google_search_console");
  const analytics = connectorSnapshot.connectors.find((connector) => connector.sourceKey === "analytics_attribution");
  const searchConsoleStatus = toSuccessStatus(searchConsole?.status);
  const analyticsStatus = toSuccessStatus(analytics?.status);

  const crawlableRouteCount = new Set([
    ...CORE_PUBLIC_ROUTES,
    ...serviceRoutes.map((service) => service.publicPath),
    ...authorityRoutes.map((route) => route.path),
  ]).size;

  const readinessScore = Math.min(
    100,
    58 +
      Math.min(18, Math.floor(authorityRoutes.length / 18)) +
      Math.min(8, Math.floor(imageAssets.length / 28)) +
      Math.min(8, serviceRoutes.length) +
      connectedDataSources.length * 3 +
      connectorSnapshot.measuredMetricCount * 3,
  );

  return {
    readinessScore,
    lastUpdated: connectorSnapshot.lastUpdated,
    crawlableRouteCount,
    servicePageCount: serviceRoutes.length,
    authorityRouteCount: authorityRoutes.length,
    imageAssetCount: imageAssets.length,
    legacyLocalRouteCount,
    answerEngineSurfaceCount,
    connectedDataSources,
    missingDataSources,
    metrics: [
      {
        label: "Crawlable SEO routes",
        value: crawlableRouteCount,
        status: "live",
        detail: "Public routes represented through product pages, service pages, and authority pages.",
      },
      {
        label: "Authority clusters",
        value: clusters.length,
        status: "live",
        detail: "Geographic, political, county, educational, visual, and trust-building clusters.",
      },
      {
        label: "Image SEO assets",
        value: imageAssets.length,
        status: "live",
        detail: "Visual assets exposed through image sitemap metadata.",
      },
      {
        label: "Legacy local routes",
        value: legacyLocalRouteCount,
        status: "live",
        detail: "Indexed city-category pages now share schema, FAQ answers, and internal links while redirect consolidation stays approval-gated.",
      },
      {
        label: "Answer-engine surfaces",
        value: answerEngineSurfaceCount,
        status: "live",
        detail: "Answers, llms.txt, services, tools, insights, visuals, and benchmarks give LLMs crawlable public summaries.",
      },
      {
        label: "Main product targets",
        value: mainProductTargets.length,
        status: "live",
        detail: "Primary product keywords and answer summaries are mapped to public HomeReach offer pages.",
      },
      {
        label: "Search Console performance",
        value: metricValue(searchConsole?.status),
        status: searchConsoleStatus,
        detail:
          searchConsole?.status === "connected"
            ? `${searchConsole.rowCount} imported Search Console rows are available for page, query, impression, click, CTR, and position reporting.`
            : searchConsole?.nextAction ?? "Connect Search Console before presenting live rankings, impressions, or CTR as measured success.",
      },
      {
        label: "SEO lead attribution",
        value: metricValue(analytics?.status),
        status: analyticsStatus,
        detail:
          analytics?.status === "connected"
            ? `${analytics.rowCount} analytics rows are available for organic landing page attribution.`
            : analytics?.nextAction ?? "Connect analytics before tying organic visits to leads, proposals, calls, payments, or revenue.",
      },
    ],
    technicalChecks: [
      {
        label: "Sitemap coverage",
        status: "live",
        detail: "Sitemap now includes core product routes, service routes, authority routes, and published SEO engine pages.",
      },
      {
        label: "Image sitemap",
        status: "live",
        detail: "Image metadata is exposed for authority visuals at /image-sitemap.xml.",
      },
      {
        label: "Robots protection",
        status: "live",
        detail: "Admin, API, dashboard, auth, intake, and checkout surfaces are blocked from crawling.",
      },
      {
        label: "Brand schema",
        status: "live",
        detail: "Organization, WebSite, navigation, service catalog, service pages, FAQ, image, article, and dataset schema are available where relevant.",
      },
      {
        label: "LLM guidance",
        status: "live",
        detail: "llms.txt points answer engines to public HomeReach pages, service pages, and crawl-safe summaries.",
      },
      {
        label: "Legacy route consolidation",
        status: isSeoLegacyRedirectEnabled() ? "ready" : "needs_review",
        detail: isSeoLegacyRedirectEnabled()
          ? "Legacy city-category pages now precheck and redirect to published /advertise/* pages when a canonical SEO page exists."
          : "Legacy city-category pages now emit schema, FAQ answers, and internal links. Redirect consolidation to /advertise/* still needs human approval before the env flag is enabled.",
        ownerAction: isSeoLegacyRedirectEnabled()
          ? undefined
          : "Review published /advertise/* coverage, approve consolidation, then enable ENABLE_SEO_LEGACY_REDIRECT.",
      },
      {
        label: "Ranking data",
        status: searchConsoleStatus,
        detail:
          searchConsole?.status === "connected"
            ? "Search Console data exists in the SEO performance layer."
            : searchConsole?.nextAction ?? "Connect Google Search Console before presenting live rankings, impressions, or CTR as measured success.",
        ownerAction: searchConsole?.status === "connected" ? undefined : searchConsole?.needs.join("; "),
      },
      {
        label: "Conversion data",
        status: analyticsStatus,
        detail:
          analytics?.status === "connected"
            ? "Organic traffic attribution data exists in the SEO performance layer."
            : analytics?.nextAction ?? "Connect GA4 or server analytics to show organic leads, proposals, and booked calls by page.",
        ownerAction: analytics?.status === "connected" ? undefined : analytics?.needs.join("; "),
      },
    ],
    topPages: [
      ...mainProductTargets.map((target) => ({
        path: target.path,
        keyword: target.primaryKeyword,
        cluster: "Main product",
        priority: "critical",
        status: "ready" as const,
        nextAction: "Connect Search Console and conversion attribution, then test title, FAQ, CTA, and internal links from this product page.",
      })),
      ...keywordTargets.slice(0, 12).map((target) => ({
        path: target.targetPath,
        keyword: target.keyword,
        cluster: target.cluster,
        priority: target.priority,
        status: (target.priority === "critical" ? "needs_review" : "ready") as SeoSuccessStatus,
        nextAction: target.nextAction,
      })),
    ].slice(0, 16),
    connectorSnapshot,
    nextActions: [
      {
        title: "Submit verified sitemaps",
        impact: "critical",
        detail: "Submit /sitemap.xml and /image-sitemap.xml in Google Search Console after deploy.",
      },
      {
        title: "Review legacy route consolidation",
        impact: "high",
        detail: "Approve the optional /[slug] to /advertise/* redirect after checking published page coverage and canonical intent.",
      },
      {
        title: "Connect organic conversion attribution",
        impact: "critical",
        detail: "Track organic landing page to lead, quote, proposal, booked call, and payment events.",
      },
      {
        title: "Monitor top 12 revenue pages weekly",
        impact: "high",
        detail: "Use the priority table for title/meta testing, internal links, CTAs, and visual refreshes.",
      },
      {
        title: "Attach proof as campaigns mature",
        impact: "high",
        detail: "Approved case studies, maps, postcards, screenshots, and testimonials should reinforce authority pages.",
      },
    ],
  };
}

function getConnectedDataSources(connectorSnapshot: SeoConnectorSnapshot) {
  return [
    ...connectorSnapshot.connectedDataSources,
    "SEO authority registry",
    "Sitemap",
    "Image sitemap",
  ];
}

function getMissingDataSources(connectorSnapshot: SeoConnectorSnapshot) {
  return [...connectorSnapshot.missingDataSources, ...connectorSnapshot.warningDataSources];
}

function toSuccessStatus(status?: SeoConnectorStatusValue): SeoSuccessStatus {
  if (status === "connected") return "live";
  if (status === "ready") return "ready";
  if (status === "warning" || status === "error" || status === "paused") return "needs_review";
  return "needs_connector";
}

function metricValue(status?: SeoConnectorStatusValue) {
  if (status === "connected") return "Live";
  if (status === "ready") return "Ready";
  if (status === "warning") return "Stale";
  if (status === "error") return "Error";
  if (status === "paused") return "Paused";
  return "Needed";
}
