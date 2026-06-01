import { NextRequest, NextResponse } from "next/server";
import { listSeoKeywordTargets } from "@/lib/seo/authority";
import {
  getGa4PropertyId,
  getSearchConsoleSiteUrl,
  getSerpApiKey,
  hasAnalyticsReportingCredentials,
  hasBacklinkProviderCredentials,
  hasGoogleSearchConsoleCredentials,
  hasRankTrackerCredentials,
  type SeoConnectorKey,
  type SeoConnectorStatusValue,
} from "@/lib/seo/connectors";
import { getGoogleAccessToken } from "@/lib/seo/google-api";
import { requireAdmin, seoFlagGate } from "@/lib/seo/guards";
import { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

const VALID_SOURCES = new Set<SeoConnectorKey>([
  "google_search_console",
  "analytics_attribution",
  "backlink_referring_domains",
  "rank_tracker",
]);

export async function POST(request: NextRequest) {
  const gate = seoFlagGate();
  if (gate) return gate;

  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => ({}))) as { sourceKey?: SeoConnectorKey; limit?: number };
  const sourceKey = body.sourceKey;
  if (!sourceKey || !VALID_SOURCES.has(sourceKey)) {
    return NextResponse.json({ ok: false, error: "Invalid SEO connector source." }, { status: 400 });
  }

  await markConnector(admin.supa, sourceKey, "ready", { last_error: null, last_sync_at: new Date().toISOString() });

  try {
    if (sourceKey === "google_search_console") {
      return NextResponse.json(await importSearchConsole(admin.supa));
    }
    if (sourceKey === "analytics_attribution") {
      return NextResponse.json(await importGa4Analytics(admin.supa));
    }
    if (sourceKey === "rank_tracker") {
      return NextResponse.json(await importSerpApiRanks(admin.supa, body.limit ?? 12));
    }
    return NextResponse.json(await importBacklinkProvider(admin.supa), { status: 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SEO connector import failed.";
    await markConnector(admin.supa, sourceKey, "error", {
      last_error: message,
      last_sync_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: false, sourceKey, error: message }, { status: 500 });
  }
}

async function importSearchConsole(supa: ServiceClient) {
  if (!hasGoogleSearchConsoleCredentials()) {
    await markConnector(supa, "google_search_console", "needs_credentials", {
      last_error: "Missing Search Console site URL/property or Google service account credentials.",
    });
    return {
      ok: false,
      sourceKey: "google_search_console",
      status: "needs_credentials",
      neededEnv: [
        "GOOGLE_SEARCH_CONSOLE_SITE_URL",
        "GOOGLE_APPLICATION_CREDENTIALS_JSON or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
      ],
    };
  }

  const siteUrl = getSearchConsoleSiteUrl();
  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/webmasters.readonly");
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 28 * 24 * 60 * 60 * 1000);
  const response = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: toDate(startDate),
        endDate: toDate(endDate),
        dimensions: ["page", "query", "country", "device"],
        rowLimit: 25000,
      }),
      cache: "no-store",
    },
  );
  const payload = (await response.json()) as {
    rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(payload.error?.message || "Search Console import failed.");

  const rows = (payload.rows ?? []).map((row) => {
    const [page, query, country, device] = row.keys ?? [];
    return {
      report_date: toDate(endDate),
      page_path: normalizePagePath(page),
      query: query ?? "",
      country: country ?? "",
      device: device ?? "",
      clicks: Math.round(row.clicks ?? 0),
      impressions: Math.round(row.impressions ?? 0),
      ctr: row.ctr ?? 0,
      position: row.position ?? null,
      source: "google_search_console",
      raw_payload: row,
    };
  });

  if (rows.length > 0) {
    const { error } = await supa.from("seo_search_console_daily").upsert(rows, {
      onConflict: "report_date,page_path,query,country,device",
    });
    if (error) throw new Error(error.message);
  }

  await markConnector(supa, "google_search_console", rows.length > 0 ? "connected" : "needs_data", {
    row_count: rows.length,
    last_error: null,
    last_success_at: new Date().toISOString(),
    last_sync_at: new Date().toISOString(),
  });

  return { ok: true, sourceKey: "google_search_console", imported: rows.length };
}

async function importGa4Analytics(supa: ServiceClient) {
  if (!hasAnalyticsReportingCredentials()) {
    await markConnector(supa, "analytics_attribution", "needs_credentials", {
      last_error: "Missing GA4 property ID or Google service account credentials.",
    });
    return {
      ok: false,
      sourceKey: "analytics_attribution",
      status: "needs_credentials",
      neededEnv: [
        "GA4_PROPERTY_ID",
        "GOOGLE_APPLICATION_CREDENTIALS_JSON or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
      ],
    };
  }

  const property = getGa4PropertyId().replace(/^properties\//, "");
  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/analytics.readonly");
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
      dimensions: [{ name: "pagePath" }, { name: "sessionSource" }, { name: "sessionMedium" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "engagedSessions" }, { name: "keyEvents" }],
      limit: "10000",
    }),
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(payload.error?.message || "GA4 import failed.");

  const today = toDate(new Date());
  const rows = (payload.rows ?? []).map((row) => {
    const dimensions = row.dimensionValues ?? [];
    const metrics = row.metricValues ?? [];
    return {
      report_date: today,
      page_path: normalizePagePath(dimensions[0]?.value),
      source: dimensions[1]?.value ?? "organic",
      medium: dimensions[2]?.value ?? "organic",
      sessions: toInteger(metrics[0]?.value),
      users_count: toInteger(metrics[1]?.value),
      engaged_sessions: toInteger(metrics[2]?.value),
      conversions: toInteger(metrics[3]?.value),
      raw_payload: row,
    };
  });

  if (rows.length > 0) {
    const { error } = await supa.from("seo_page_analytics_daily").upsert(rows, {
      onConflict: "report_date,page_path,source,medium",
    });
    if (error) throw new Error(error.message);
  }

  await markConnector(supa, "analytics_attribution", rows.length > 0 ? "connected" : "needs_data", {
    row_count: rows.length,
    last_error: null,
    last_success_at: new Date().toISOString(),
    last_sync_at: new Date().toISOString(),
  });

  return { ok: true, sourceKey: "analytics_attribution", imported: rows.length };
}

async function importSerpApiRanks(
  supa: ServiceClient,
  rawLimit: number,
) {
  if (!hasRankTrackerCredentials()) {
    await markConnector(supa, "rank_tracker", process.env.SERPAPI_PAUSED === "true" ? "paused" : "needs_credentials", {
      last_error: process.env.SERPAPI_PAUSED === "true" ? "SERPAPI_PAUSED is true." : "Missing SERPAPI_KEY, SERP_API, or DATAFORSEO credentials.",
    });
    return {
      ok: false,
      sourceKey: "rank_tracker",
      status: process.env.SERPAPI_PAUSED === "true" ? "paused" : "needs_credentials",
      neededEnv: ["SERPAPI_KEY or SERP_API"],
    };
  }

  const apiKey = getSerpApiKey();
  const limit = Math.max(1, Math.min(25, Number(rawLimit) || 12));
  const targets = listSeoKeywordTargets().slice(0, limit);
  const today = toDate(new Date());
  const rows = [];

  for (const target of targets) {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", target.keyword);
    url.searchParams.set("location", "Ohio, United States");
    url.searchParams.set("google_domain", "google.com");
    url.searchParams.set("gl", "us");
    url.searchParams.set("hl", "en");
    url.searchParams.set("num", "20");
    url.searchParams.set("api_key", apiKey);

    const response = await fetch(url, { cache: "no-store" });
    const payload = (await response.json()) as {
      organic_results?: Array<{ position?: number; link?: string; displayed_link?: string; title?: string }>;
      error?: string;
    };
    if (!response.ok || payload.error) throw new Error(payload.error || `Rank import failed for ${target.keyword}.`);

    const match = (payload.organic_results ?? []).find((result) => {
      const link = result.link ?? result.displayed_link ?? "";
      return link.includes("home-reach.com") || link.includes("homereach");
    });

    rows.push({
      snapshot_date: today,
      page_path: target.targetPath,
      keyword: target.keyword,
      location: "Ohio, United States",
      device: "desktop",
      rank_position: match?.position ?? null,
      previous_position: null,
      search_engine: "google",
      provider: "serpapi",
      raw_payload: {
        matched: match ?? null,
        result_count: payload.organic_results?.length ?? 0,
      },
    });
  }

  if (rows.length > 0) {
    const { error } = await supa.from("seo_rank_snapshots").upsert(rows, {
      onConflict: "snapshot_date,page_path,keyword,location,device,search_engine",
    });
    if (error) throw new Error(error.message);
  }

  await markConnector(supa, "rank_tracker", rows.length > 0 ? "connected" : "needs_data", {
    row_count: rows.length,
    last_error: null,
    last_success_at: new Date().toISOString(),
    last_sync_at: new Date().toISOString(),
  });

  return { ok: true, sourceKey: "rank_tracker", imported: rows.length };
}

async function importBacklinkProvider(supa: ServiceClient) {
  if (!hasBacklinkProviderCredentials()) {
    await markConnector(supa, "backlink_referring_domains", "needs_credentials", {
      last_error: "Missing backlink provider credentials.",
    });
    return {
      ok: false,
      sourceKey: "backlink_referring_domains",
      status: "needs_credentials",
      neededEnv: ["AHREFS_API_TOKEN, SEMRUSH_API_KEY, MOZ credentials, or DATAFORSEO credentials"],
    };
  }

  await markConnector(supa, "backlink_referring_domains", "ready", {
    last_error: "Provider credentials detected. Add the selected provider adapter before importing backlink rows.",
  });
  return {
    ok: false,
    sourceKey: "backlink_referring_domains",
    status: "ready",
    error: "Backlink provider credentials are present, but provider-specific import mapping has not been selected yet.",
  };
}

async function markConnector(
  supa: ServiceClient,
  sourceKey: SeoConnectorKey,
  status: SeoConnectorStatusValue,
  patch: Record<string, unknown> = {},
) {
  const labels: Record<SeoConnectorKey, string> = {
    google_search_console: "Google Search Console",
    analytics_attribution: "GA4 or Server Analytics",
    backlink_referring_domains: "Backlink and Referring Domains",
    rank_tracker: "Rank Tracker",
  };
  const providers: Record<SeoConnectorKey, string> = {
    google_search_console: "google",
    analytics_attribution: "google_analytics_or_server",
    backlink_referring_domains: "ahrefs_semrush_moz_dataforseo_or_import",
    rank_tracker: "serpapi_or_dataforseo",
  };

  await supa.from("seo_connector_statuses").upsert(
    {
      source_key: sourceKey,
      label: labels[sourceKey],
      provider: providers[sourceKey],
      status,
      updated_at: new Date().toISOString(),
      ...patch,
    },
    { onConflict: "source_key" },
  );
}

function normalizePagePath(value?: string | null) {
  if (!value) return "/";
  try {
    const parsed = new URL(value, "https://home-reach.com");
    return parsed.pathname || "/";
  } catch {
    return value.startsWith("/") ? value : `/${value}`;
  }
}

function toDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toInteger(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}
