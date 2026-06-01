import { createServiceClient } from "@/lib/supabase/service";
import { listSeoKeywordTargets, type SeoKeywordTarget } from "@/lib/seo/authority";

export type SeoConnectorKey =
  | "google_search_console"
  | "analytics_attribution"
  | "backlink_referring_domains"
  | "rank_tracker";

export type SeoConnectorStatusValue =
  | "connected"
  | "ready"
  | "needs_credentials"
  | "needs_data"
  | "warning"
  | "error"
  | "paused";

export type SeoConnectorStatus = {
  sourceKey: SeoConnectorKey;
  label: string;
  provider: string;
  status: SeoConnectorStatusValue;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  freshnessHours: number;
  rowCount: number;
  metadata: Record<string, unknown>;
  envReady: boolean;
  needs: string[];
  nextAction: string;
};

export type SeoPerformanceRow = {
  url: string;
  targetKeyword: string;
  currentRanking: string;
  rankingChange: string;
  impressions: string;
  clicks: string;
  ctr: string;
  visitors: string;
  conversions: string;
  bounceRate: string;
  avgTime: string;
  backlinks: string;
  internalLinks: string;
  health: string;
};

export type SeoConnectorSnapshot = {
  connectors: SeoConnectorStatus[];
  connectedDataSources: string[];
  missingDataSources: string[];
  warningDataSources: string[];
  connectorMetricCount: number;
  measuredMetricCount: number;
  lastUpdated: string;
  performanceRows: SeoPerformanceRow[];
};

type ConnectorRow = {
  source_key: SeoConnectorKey;
  label: string;
  provider: string;
  status: SeoConnectorStatusValue;
  last_sync_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  freshness_hours: number | null;
  row_count: number | null;
  metadata: Record<string, unknown> | null;
};

const CONNECTOR_DEFINITIONS: Record<
  SeoConnectorKey,
  {
    label: string;
    provider: string;
    freshnessHours: number;
    needs: string[];
    nextAction: string;
  }
> = {
  google_search_console: {
    label: "Google Search Console",
    provider: "google",
    freshnessHours: 24,
    needs: ["Verified property", "Search Console API credentials", "Sitemap submitted"],
    nextAction: "Connect a verified Search Console property and run the first search performance sync.",
  },
  analytics_attribution: {
    label: "GA4 or Server Analytics",
    provider: "google_analytics_or_server",
    freshnessHours: 24,
    needs: ["GA4 Data API or server analytics", "Organic lead events", "Landing page attribution"],
    nextAction: "Connect analytics reporting and map organic visitors to leads, proposals, calls, and payments.",
  },
  backlink_referring_domains: {
    label: "Backlink and Referring Domains",
    provider: "ahrefs_semrush_moz_dataforseo_or_import",
    freshnessHours: 168,
    needs: ["Backlink provider API", "Referring domain snapshots", "Lost-link monitoring"],
    nextAction: "Connect Ahrefs, Semrush, Moz, DataForSEO, or another approved backlink provider.",
  },
  rank_tracker: {
    label: "Rank Tracker",
    provider: "serpapi_or_dataforseo",
    freshnessHours: 24,
    needs: ["SERP API credentials", "Keyword target list", "Daily rank snapshots"],
    nextAction: "Run a rank tracker sync for the priority HomeReach keyword targets.",
  },
};

export async function getSeoConnectorSnapshot(): Promise<SeoConnectorSnapshot> {
  const supa = createServiceClient();
  const [dbRows, rowCounts, performanceRows] = await Promise.all([
    safeSelectConnectorRows(supa),
    getConnectorRowCounts(supa),
    buildSeoPerformanceRows(supa, listSeoKeywordTargets()),
  ]);

  const dbByKey = new Map((dbRows ?? []).map((row) => [row.source_key, row]));
  const connectors = (Object.keys(CONNECTOR_DEFINITIONS) as SeoConnectorKey[]).map((key) =>
    resolveConnector(key, dbByKey.get(key), rowCounts[key] ?? 0),
  );

  return {
    connectors,
    connectedDataSources: connectors
      .filter((connector) => connector.status === "connected" || connector.status === "ready")
      .map((connector) => connector.label),
    missingDataSources: connectors
      .filter((connector) => connector.status === "needs_credentials" || connector.status === "needs_data")
      .map((connector) => connector.label),
    warningDataSources: connectors
      .filter((connector) => connector.status === "warning" || connector.status === "error" || connector.status === "paused")
      .map((connector) => connector.label),
    connectorMetricCount: connectors.length,
    measuredMetricCount: connectors.filter((connector) => connector.status === "connected").length,
    lastUpdated: new Date().toISOString(),
    performanceRows,
  };
}

export function hasGoogleSearchConsoleCredentials() {
  return Boolean(getSearchConsoleSiteUrl() && getGoogleServiceAccountCredentials());
}

export function hasAnalyticsReportingCredentials() {
  return Boolean(
    (process.env.GA4_PROPERTY_ID || process.env.GOOGLE_ANALYTICS_PROPERTY_ID) &&
      getGoogleServiceAccountCredentials(),
  );
}

export function hasBacklinkProviderCredentials() {
  return Boolean(
    process.env.AHREFS_API_TOKEN ||
      process.env.SEMRUSH_API_KEY ||
      process.env.MOZ_ACCESS_ID ||
      process.env.DATAFORSEO_LOGIN ||
      process.env.SEO_BACKLINK_PROVIDER_API_KEY,
  );
}

export function hasRankTrackerCredentials() {
  return Boolean(
    getSerpApiKey() ||
      (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD),
  );
}

export function getSearchConsoleSiteUrl() {
  return (
    process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL ||
    process.env.GOOGLE_SEARCH_CONSOLE_PROPERTY ||
    process.env.GSC_SITE_URL ||
    ""
  );
}

export function getGa4PropertyId() {
  return process.env.GA4_PROPERTY_ID || process.env.GOOGLE_ANALYTICS_PROPERTY_ID || "";
}

export function getSerpApiKey() {
  if (process.env.SERPAPI_PAUSED === "true") return "";
  return process.env.SERPAPI_KEY || process.env.SERP_API || process.env.SERPAPI_API_KEY || "";
}

function resolveConnector(key: SeoConnectorKey, dbRow: ConnectorRow | undefined, rowCount: number): SeoConnectorStatus {
  const definition = CONNECTOR_DEFINITIONS[key];
  const envReady = getEnvReady(key);
  const freshnessHours = dbRow?.freshness_hours ?? definition.freshnessHours;
  const lastSuccessAt = dbRow?.last_success_at ?? null;
  const isStale = Boolean(
    rowCount > 0 &&
      lastSuccessAt &&
      Date.now() - new Date(lastSuccessAt).getTime() > freshnessHours * 60 * 60 * 1000,
  );
  const baseStatus = dbRow?.status ?? "needs_credentials";
  const status: SeoConnectorStatusValue =
    baseStatus === "paused"
      ? "paused"
      : baseStatus === "error"
        ? "error"
        : rowCount > 0 && isStale
          ? "warning"
          : rowCount > 0
            ? "connected"
            : envReady
              ? "ready"
              : "needs_credentials";

  return {
    sourceKey: key,
    label: dbRow?.label ?? definition.label,
    provider: dbRow?.provider ?? definition.provider,
    status,
    lastSyncAt: dbRow?.last_sync_at ?? null,
    lastSuccessAt,
    lastError: dbRow?.last_error ?? null,
    freshnessHours,
    rowCount,
    metadata: dbRow?.metadata ?? {},
    envReady,
    needs: definition.needs,
    nextAction:
      status === "connected"
        ? "Fresh data is available for measured SEO reporting."
        : status === "ready"
          ? "Credentials are present. Run the first import to turn this into measured reporting."
          : definition.nextAction,
  };
}

function getEnvReady(key: SeoConnectorKey) {
  if (key === "google_search_console") return hasGoogleSearchConsoleCredentials();
  if (key === "analytics_attribution") return hasAnalyticsReportingCredentials();
  if (key === "backlink_referring_domains") return hasBacklinkProviderCredentials();
  return hasRankTrackerCredentials();
}

async function safeSelectConnectorRows(supa: ReturnType<typeof createServiceClient>) {
  const { data, error } = await supa.from("seo_connector_statuses").select("*");
  if (error || !data) return [];
  return data as ConnectorRow[];
}

async function getConnectorRowCounts(supa: ReturnType<typeof createServiceClient>) {
  const [gsc, analytics, attributionEvents, backlinks, ranks] = await Promise.all([
    countRows(supa, "seo_search_console_daily"),
    countRows(supa, "seo_page_analytics_daily"),
    countRows(supa, "seo_attribution_events"),
    countRows(supa, "seo_backlink_snapshots"),
    countRows(supa, "seo_rank_snapshots"),
  ]);
  return {
    google_search_console: gsc,
    analytics_attribution: analytics + attributionEvents,
    backlink_referring_domains: backlinks,
    rank_tracker: ranks,
  } satisfies Record<SeoConnectorKey, number>;
}

async function countRows(supa: ReturnType<typeof createServiceClient>, table: string) {
  const { count, error } = await supa.from(table).select("*", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

async function buildSeoPerformanceRows(
  supa: ReturnType<typeof createServiceClient>,
  keywordTargets: SeoKeywordTarget[],
): Promise<SeoPerformanceRow[]> {
  const [searchRows, analyticsRows, rankRows, backlinkRows] = await Promise.all([
    safeLatestRows(supa, "seo_search_console_daily", "report_date", 500),
    safeLatestRows(supa, "seo_page_analytics_daily", "report_date", 500),
    safeLatestRows(supa, "seo_rank_snapshots", "snapshot_date", 500),
    safeLatestRows(supa, "seo_backlink_snapshots", "snapshot_date", 500),
  ]);

  const searchByPath = aggregateSearchRows(searchRows);
  const analyticsByPath = aggregateAnalyticsRows(analyticsRows);
  const rankByTarget = new Map<string, Record<string, unknown>>();
  for (const row of rankRows) {
    const key = `${row.page_path ?? ""}|${row.keyword ?? ""}`;
    if (!rankByTarget.has(key)) rankByTarget.set(key, row);
  }
  const backlinksByPath = aggregateBacklinkRows(backlinkRows);

  return keywordTargets.map((keyword) => {
    const search = searchByPath.get(keyword.targetPath);
    const analytics = analyticsByPath.get(keyword.targetPath);
    const rank = rankByTarget.get(`${keyword.targetPath}|${keyword.keyword}`);
    const rankPosition = asNumber(rank?.rank_position);
    const previousPosition = asNumber(rank?.previous_position);
    const hasRankSnapshot = Boolean(rank);
    const rankingChange =
      rankPosition && previousPosition
        ? `${previousPosition - rankPosition > 0 ? "+" : ""}${previousPosition - rankPosition}`
        : rankPosition
          ? "New"
          : hasRankSnapshot
            ? "No top-20 match"
            : "Pending";

    return {
      url: keyword.targetPath,
      targetKeyword: keyword.keyword,
      currentRanking: rankPosition ? `#${rankPosition}` : hasRankSnapshot ? "Not top 20" : "Awaiting sync",
      rankingChange,
      impressions: search ? formatNumber(search.impressions) : "Awaiting GSC",
      clicks: search ? formatNumber(search.clicks) : "Awaiting GSC",
      ctr: search ? `${(search.ctr * 100).toFixed(1)}%` : "Awaiting GSC",
      visitors: analytics ? formatNumber(analytics.sessions) : "Awaiting analytics",
      conversions: analytics ? formatNumber(analytics.conversions + analytics.leads + analytics.proposals + analytics.calls) : "Awaiting analytics",
      bounceRate: "Not imported",
      avgTime: "Not imported",
      backlinks: formatNumber(backlinksByPath.get(keyword.targetPath) ?? 0),
      internalLinks: "Ready",
      health: keyword.priority === "critical" ? "Priority" : rankPosition ? "Measured" : hasRankSnapshot ? "Watch" : "Ready",
    };
  });
}

async function safeLatestRows(
  supa: ReturnType<typeof createServiceClient>,
  table: string,
  dateColumn: string,
  limit: number,
) {
  const { data, error } = await supa.from(table).select("*").order(dateColumn, { ascending: false }).limit(limit);
  if (error || !data) return [] as Record<string, unknown>[];
  return data as Record<string, unknown>[];
}

function aggregateSearchRows(rows: Record<string, unknown>[]) {
  const map = new Map<string, { impressions: number; clicks: number; ctr: number }>();
  for (const row of rows) {
    const path = String(row.page_path ?? "");
    if (!path) continue;
    const current = map.get(path) ?? { impressions: 0, clicks: 0, ctr: 0 };
    current.impressions += asNumber(row.impressions) ?? 0;
    current.clicks += asNumber(row.clicks) ?? 0;
    current.ctr = current.impressions > 0 ? current.clicks / current.impressions : 0;
    map.set(path, current);
  }
  return map;
}

function aggregateAnalyticsRows(rows: Record<string, unknown>[]) {
  const map = new Map<string, { sessions: number; conversions: number; leads: number; proposals: number; calls: number }>();
  for (const row of rows) {
    const path = String(row.page_path ?? "");
    if (!path) continue;
    const current = map.get(path) ?? { sessions: 0, conversions: 0, leads: 0, proposals: 0, calls: 0 };
    current.sessions += asNumber(row.sessions) ?? 0;
    current.conversions += asNumber(row.conversions) ?? 0;
    current.leads += asNumber(row.leads) ?? 0;
    current.proposals += asNumber(row.proposals) ?? 0;
    current.calls += asNumber(row.calls) ?? 0;
    map.set(path, current);
  }
  return map;
}

function aggregateBacklinkRows(rows: Record<string, unknown>[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const path = String(row.page_path ?? "");
    if (!path) continue;
    map.set(path, (map.get(path) ?? 0) + 1);
  }
  return map;
}

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getGoogleServiceAccountCredentials() {
  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) return json;
  const email =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL ||
    process.env.GA4_CLIENT_EMAIL;
  const key =
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    process.env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY ||
    process.env.GA4_PRIVATE_KEY;
  return email && key ? `${email}:${key.slice(0, 12)}` : "";
}
