import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const Stripe = requireFromWeb("stripe");
const { createClient } = requireFromWeb("@supabase/supabase-js");

const REQUIRED_MANAGEMENT_FEE_CENTS = 49900;
const DEFAULT_BASE_URL = "https://www.home-reach.com";
const LOOKBACK_DAYS = Number(process.env.MARKET_CAPTURE_MONITOR_DAYS ?? 7);

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
    env[key] = value;
  }

  return env;
}

function loadEnv() {
  return {
    ...parseEnvFile(path.join(rootDir, ".env")),
    ...parseEnvFile(path.join(rootDir, ".env.local")),
    ...parseEnvFile(path.join(rootDir, "apps/web/.env.local")),
    ...process.env,
  };
}

function normalizeBaseUrl(value) {
  return (value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = String(row[key] ?? "unknown");
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function isQaLead(lead) {
  const email = String(lead.email ?? "").toLowerCase();
  const businessName = String(lead.business_name ?? "").toLowerCase();
  return email.startsWith("qa+") || businessName.includes("homereach qa");
}

async function routeStatus(baseUrl, route) {
  try {
    const res = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
    return { route, status: res.status, ok: res.status >= 200 && res.status < 400 };
  } catch (err) {
    return { route, status: null, ok: false, error: err instanceof Error ? err.message : "Fetch failed" };
  }
}

async function getStripeWebhookHealth(stripe) {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const homeReachEndpoints = endpoints.data.filter((endpoint) => {
    try {
      const url = new URL(endpoint.url);
      return (
        endpoint.status === "enabled" &&
        endpoint.livemode === true &&
        url.pathname === "/api/webhooks/stripe" &&
        ["home-reach.com", "www.home-reach.com"].includes(url.hostname)
      );
    } catch {
      return false;
    }
  });

  return {
    activeEndpointCount: homeReachEndpoints.length,
    hasCheckoutCompleted: homeReachEndpoints.some((endpoint) =>
      endpoint.enabled_events.includes("checkout.session.completed"),
    ),
    hasCheckoutExpired: homeReachEndpoints.some((endpoint) =>
      endpoint.enabled_events.includes("checkout.session.expired"),
    ),
  };
}

async function getRecentMarketCaptureSessions(stripe, sinceSeconds) {
  const sessions = await stripe.checkout.sessions.list({
    limit: 100,
    created: { gte: sinceSeconds },
  });

  return sessions.data.filter((session) => session.metadata?.type === "market_capture_management");
}

async function requireSupabase(supabase, label, operation) {
  const { data, error, count } = await operation;
  if (error) throw new Error(`${label} failed: ${error.message}`);
  return { data: data ?? [], count: count ?? null };
}

const env = loadEnv();
const baseUrl = normalizeBaseUrl(env.MARKET_CAPTURE_MONITOR_BASE_URL ?? env.SMOKE_BASE_URL);
const critical = [];
const warnings = [];
const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
const sinceSeconds = Math.floor(since.getTime() / 1000);

for (const [key, expected] of [
  ["ENABLE_MARKET_CAPTURE", "true"],
  ["ENABLE_MARKET_CAPTURE_INTAKE", "true"],
  ["ENABLE_MARKET_CAPTURE_PIPELINE", "true"],
  ["ENABLE_MARKET_CAPTURE_PAYMENT", "true"],
]) {
  if (String(env[key]).toLowerCase() !== expected) {
    critical.push(`${key} is not ${expected}.`);
  }
}

if (String(env.ENABLE_AD_API_LAUNCH).toLowerCase() === "true") {
  critical.push("ENABLE_AD_API_LAUNCH is true. Market Capture MVP should remain manual-launch only.");
}

if (!env.STRIPE_SECRET_KEY) critical.push("STRIPE_SECRET_KEY is missing.");
if (!env.STRIPE_MARKET_CAPTURE_PRICE_ID) critical.push("STRIPE_MARKET_CAPTURE_PRICE_ID is missing.");
if (!env.NEXT_PUBLIC_SUPABASE_URL) critical.push("NEXT_PUBLIC_SUPABASE_URL is missing.");
if (!env.SUPABASE_SERVICE_ROLE_KEY) critical.push("SUPABASE_SERVICE_ROLE_KEY is missing.");

let stripeSummary = null;
let webhookHealth = null;
let recentSessions = [];
if (env.STRIPE_SECRET_KEY && env.STRIPE_MARKET_CAPTURE_PRICE_ID) {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
  const [account, price, health, sessions] = await Promise.all([
    stripe.accounts.retrieve(),
    stripe.prices.retrieve(env.STRIPE_MARKET_CAPTURE_PRICE_ID, { expand: ["product"] }),
    getStripeWebhookHealth(stripe),
    getRecentMarketCaptureSessions(stripe, sinceSeconds),
  ]);

  const product = typeof price.product === "object" ? price.product : null;
  stripeSummary = {
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    priceId: price.id,
    priceActive: price.active,
    priceLivemode: price.livemode,
    unitAmount: price.unit_amount,
    interval: price.recurring?.interval ?? null,
    productName: product?.name ?? null,
  };
  webhookHealth = health;
  recentSessions = sessions.map((session) => ({
    id: session.id,
    status: session.status,
    paymentStatus: session.payment_status,
    clientReferenceId: session.client_reference_id,
    created: new Date(session.created * 1000).toISOString(),
  }));

  if (!account.charges_enabled) critical.push("Stripe charges are not enabled.");
  if (!price.active) critical.push("Market Capture Stripe Price is not active.");
  if (price.unit_amount !== REQUIRED_MANAGEMENT_FEE_CENTS) {
    critical.push(`Market Capture Stripe Price is not ${REQUIRED_MANAGEMENT_FEE_CENTS} cents.`);
  }
  if (price.recurring?.interval !== "month") critical.push("Market Capture Stripe Price is not monthly.");
  if (!health.hasCheckoutCompleted) critical.push("Stripe webhook missing checkout.session.completed.");
  if (!health.hasCheckoutExpired) critical.push("Stripe webhook missing checkout.session.expired.");
}

const routes = await Promise.all(
  ["/", "/market-capture", "/market-capture/intake", "/political", "/targeted"].map((route) =>
    routeStatus(baseUrl, route),
  ),
);
for (const route of routes) {
  if (!route.ok) critical.push(`${route.route} returned ${route.status ?? "no response"}.`);
}

let marketCapture = null;
if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const leadsResult = await requireSupabase(
    supabase,
    "Market Capture leads query",
    supabase
      .from("market_capture_leads")
      .select("id, email, business_name, payment_status, status, created_at, monthly_management_fee, stripe_checkout_session_id")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(500),
  );
  const leads = leadsResult.data;
  const leadIds = leads.map((lead) => lead.id);
  const nonQaLeads = leads.filter((lead) => !isQaLead(lead));

  const [pipelineResult, taskResult, campaignResult] =
    leadIds.length > 0
      ? await Promise.all([
          requireSupabase(
            supabase,
            "Market Capture pipeline query",
            supabase
              .from("market_capture_pipeline")
              .select("id, market_capture_lead_id, stage, status, next_action, updated_at")
              .in("market_capture_lead_id", leadIds)
              .limit(500),
          ),
          requireSupabase(
            supabase,
            "Market Capture task query",
            supabase
              .from("market_capture_tasks")
              .select("id, market_capture_lead_id, title, status, due_date")
              .in("market_capture_lead_id", leadIds)
              .limit(1000),
          ),
          requireSupabase(
            supabase,
            "Market Capture campaign query",
            supabase
              .from("market_capture_campaigns")
              .select("id, market_capture_lead_id, campaign_status, launch_status, payment_status, created_at")
              .in("market_capture_lead_id", leadIds)
              .limit(500),
          ),
        ])
      : [
          { data: [] },
          { data: [] },
          { data: [] },
        ];

  const now = Date.now();
  const openOverdueTasks = taskResult.data.filter((task) => {
    if (!["open", "in_progress", "blocked"].includes(String(task.status))) return false;
    if (!task.due_date) return false;
    return new Date(task.due_date).getTime() < now;
  });

  marketCapture = {
    lookbackDays: LOOKBACK_DAYS,
    totalLeads: leads.length,
    qaLeads: leads.length - nonQaLeads.length,
    nonQaLeads: nonQaLeads.length,
    leadsByPaymentStatus: countBy(leads, "payment_status"),
    leadsByStatus: countBy(leads, "status"),
    pipelineByStage: countBy(pipelineResult.data, "stage"),
    generatedTaskCount: taskResult.data.length,
    openOverdueTaskCount: openOverdueTasks.length,
    campaignCount: campaignResult.data.length,
    recentNonQaLeadSamples: nonQaLeads.slice(0, 5).map((lead) => ({
      id: lead.id,
      businessName: lead.business_name,
      paymentStatus: lead.payment_status,
      status: lead.status,
      createdAt: lead.created_at,
    })),
  };

  if (leads.length > 0 && pipelineResult.data.length === 0) {
    critical.push("Recent Market Capture leads exist but no pipeline records were found.");
  }
  if (leads.length > 0 && taskResult.data.length === 0) {
    critical.push("Recent Market Capture leads exist but no sales tasks were found.");
  }
  if (openOverdueTasks.length > 0) {
    warnings.push(`${openOverdueTasks.length} Market Capture tasks are open and overdue.`);
  }
  if (nonQaLeads.length === 0) {
    warnings.push("No non-QA Market Capture leads found in the lookback window yet.");
  }
}

const sessionSummary = {
  totalRecentMarketCaptureSessions: recentSessions.length,
  byStatus: countBy(recentSessions, "status"),
  byPaymentStatus: countBy(recentSessions, "paymentStatus"),
};

const result = {
  ok: critical.length === 0,
  phase: "E_market_capture_go_live_monitor",
  baseUrl,
  checkedAt: new Date().toISOString(),
  critical,
  warnings,
  routes,
  stripe: stripeSummary,
  webhookHealth,
  checkoutSessions: sessionSummary,
  marketCapture,
};

console.log(JSON.stringify(result, null, 2));
if (critical.length > 0) process.exit(1);
