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
const REQUEST_TIMEOUT_MS = Number(process.env.MARKET_CAPTURE_SMOKE_TIMEOUT_MS ?? 30000);
const args = new Set(process.argv.slice(2));
const skipDbChecks = args.has("--skip-db-checks");

class SmokeFailure extends Error {}

function redactSecret(value) {
  return String(value).replace(/(sk|pk)_(live|test)_[^\s'",)]+/g, "$1_$2_***");
}

function safeError(err) {
  return {
    name: err?.name ?? "Error",
    type: err?.type ?? null,
    code: err?.code ?? null,
    statusCode: err?.statusCode ?? null,
    message: redactSecret(err?.message ?? "Unknown error"),
  };
}

process.on("uncaughtException", (err) => {
  if (err instanceof SmokeFailure) {
    process.exitCode = 1;
    return;
  }
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: "Market Capture live funnel smoke failed.",
        error: safeError(err),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});

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

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, message, ...details }, null, 2));
  throw new SmokeFailure(message);
}

function assert(condition, message, details = {}) {
  if (!condition) fail(message, details);
}

function normalizeBaseUrl(value) {
  return (value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function extractCheckoutSessionId(checkoutUrl) {
  try {
    const url = new URL(checkoutUrl);
    const id = url.pathname
      .split("/")
      .filter(Boolean)
      .find((part) => part.startsWith("cs_"));
    if (id) return id;
  } catch {
    // Fall through to regex fallback.
  }

  const match = checkoutUrl.match(/cs_(?:test|live)_[^#/?]+/);
  return match?.[0] ?? null;
}

function withTimeout(promise, label, timeoutMs = REQUEST_TIMEOUT_MS) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

async function fetchWithTimeout(url, init, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...(init ?? {}), signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") throw new Error(`${label} timed out after ${REQUEST_TIMEOUT_MS}ms.`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, init) {
  const res = await fetchWithTimeout(url, init, `Fetch ${url}`);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { res, text, data };
}

async function fetchText(url, init) {
  const res = await fetchWithTimeout(url, init, `Fetch ${url}`);
  const text = await res.text();
  return { res, text };
}

async function getExactCount(supabase, table, column, value) {
  const { count, error } = await withTimeout(
    supabase.from(table).select("id", { count: "exact", head: true }).eq(column, value),
    `${table} count`,
  );
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? 0;
}

async function getStripeWebhookHealth(stripe) {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const liveHomeReachEndpoints = endpoints.data.filter((endpoint) => {
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

  const eventSets = liveHomeReachEndpoints.map((endpoint) => new Set(endpoint.enabled_events));
  return {
    activeEndpointCount: liveHomeReachEndpoints.length,
    hasCheckoutCompleted: eventSets.some((events) => events.has("checkout.session.completed")),
    hasCheckoutExpired: eventSets.some((events) => events.has("checkout.session.expired")),
  };
}

async function runDbChecks({ env, email, marketCaptureLeadId, checkoutSessionId }) {
  if (skipDbChecks) {
    return { skipped: true, reason: "Skipped by --skip-db-checks." };
  }

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      skipped: true,
      reason: "Supabase env vars unavailable locally; API/page checks still ran.",
    };
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: lead, error: leadError } = await withTimeout(
    supabase
      .from("market_capture_leads")
      .select(
        "id, business_name, email, payment_status, status, monthly_management_fee, monthly_ad_budget, stripe_checkout_session_id, metadata",
      )
      .eq("email", email)
      .maybeSingle(),
    "market_capture_leads lookup",
  );

  if (leadError) throw new Error(`market_capture_leads lookup failed: ${leadError.message}`);
  assert(lead, "Market Capture lead was not found in Supabase.", { email });
  assert(lead.id === marketCaptureLeadId, "API lead id does not match Supabase lead id.", {
    apiLeadId: marketCaptureLeadId,
    dbLeadId: lead.id,
  });
  assert(Number(lead.monthly_management_fee) === REQUIRED_MANAGEMENT_FEE_CENTS, "Lead management fee is not $499.", {
    monthlyManagementFee: Number(lead.monthly_management_fee),
  });
  assert(
    String(lead.stripe_checkout_session_id) === checkoutSessionId,
    "Lead does not reference the created Stripe Checkout session.",
    {
      leadSessionId: lead.stripe_checkout_session_id,
      checkoutSessionId,
    },
  );
  assert(
    ["checkout_created", "payment_required"].includes(String(lead.payment_status)),
    "Unexpected lead payment status after live funnel smoke.",
    { paymentStatus: lead.payment_status },
  );
  assert(
    lead.metadata?.jobsite_halo?.enabled === true,
    "Jobsite Halo metadata was not stored on the Market Capture lead.",
    { jobsiteHalo: lead.metadata?.jobsite_halo ?? null },
  );
  assert(
    Array.isArray(lead.metadata?.jobsite_halo?.addresses) && lead.metadata.jobsite_halo.addresses.length === 2,
    "Jobsite Halo address list was not stored correctly.",
    { jobsiteHalo: lead.metadata?.jobsite_halo ?? null },
  );
  assert(
    lead.metadata?.neighborhood_saturation?.enabled === true,
    "Neighborhood Saturation metadata was not stored on the Market Capture lead.",
    { neighborhoodSaturation: lead.metadata?.neighborhood_saturation ?? null },
  );
  assert(
    Array.isArray(lead.metadata?.neighborhood_saturation?.areas) && lead.metadata.neighborhood_saturation.areas.length >= 3,
    "Neighborhood Saturation area list was not stored correctly.",
    { neighborhoodSaturation: lead.metadata?.neighborhood_saturation ?? null },
  );
  assert(
    Number(lead.metadata?.neighborhood_saturation?.score ?? 0) > 0,
    "Neighborhood Saturation score was not calculated.",
    { neighborhoodSaturation: lead.metadata?.neighborhood_saturation ?? null },
  );
  assert(
    lead.metadata?.competitor_area?.enabled === true,
    "Competitor Area metadata was not stored on the Market Capture lead.",
    { competitorArea: lead.metadata?.competitor_area ?? null },
  );
  assert(
    Array.isArray(lead.metadata?.competitor_area?.locations) && lead.metadata.competitor_area.locations.length === 2,
    "Competitor Area location list was not stored correctly.",
    { competitorArea: lead.metadata?.competitor_area ?? null },
  );
  assert(
    Number(lead.metadata?.competitor_area?.readinessScore ?? 0) > 0,
    "Competitor Area readiness score was not calculated.",
    { competitorArea: lead.metadata?.competitor_area ?? null },
  );
  assert(
    lead.metadata?.competitor_area?.policyWarnings?.length === 0,
    "Competitor Area smoke fixture produced policy warnings.",
    { competitorArea: lead.metadata?.competitor_area ?? null },
  );
  assert(
    lead.metadata?.event_area?.enabled === true,
    "Event Area metadata was not stored on the Market Capture lead.",
    { eventArea: lead.metadata?.event_area ?? null },
  );
  assert(
    Array.isArray(lead.metadata?.event_area?.locations) && lead.metadata.event_area.locations.length === 2,
    "Event Area location list was not stored correctly.",
    { eventArea: lead.metadata?.event_area ?? null },
  );
  assert(
    Number(lead.metadata?.event_area?.readinessScore ?? 0) > 0,
    "Event Area readiness score was not calculated.",
    { eventArea: lead.metadata?.event_area ?? null },
  );
  assert(
    lead.metadata?.event_area?.deadlineStatus === "feasible",
    "Event Area smoke fixture did not produce a feasible deadline status.",
    { eventArea: lead.metadata?.event_area ?? null },
  );
  assert(
    lead.metadata?.event_area?.policyWarnings?.length === 0,
    "Event Area smoke fixture produced policy warnings.",
    { eventArea: lead.metadata?.event_area ?? null },
  );
  assert(
    lead.metadata?.digital_direct_mail_bundle?.enabled === true,
    "Digital + Direct Mail bundle metadata was not stored on the Market Capture lead.",
    { digitalDirectMailBundle: lead.metadata?.digital_direct_mail_bundle ?? null },
  );
  assert(
    lead.metadata?.digital_direct_mail_bundle?.bundleSku === "market_capture_digital_mail_founder",
    "Digital + Direct Mail bundle SKU was not stored correctly.",
    { digitalDirectMailBundle: lead.metadata?.digital_direct_mail_bundle ?? null },
  );
  assert(
    Number(lead.metadata?.digital_direct_mail_bundle?.readinessScore ?? 0) > 0,
    "Digital + Direct Mail bundle readiness score was not calculated.",
    { digitalDirectMailBundle: lead.metadata?.digital_direct_mail_bundle ?? null },
  );

  const { data: pipeline, error: pipelineError } = await withTimeout(
    supabase
      .from("market_capture_pipeline")
      .select("id, stage, status, next_action")
      .eq("market_capture_lead_id", lead.id)
      .maybeSingle(),
    "market_capture_pipeline lookup",
  );

  if (pipelineError) throw new Error(`market_capture_pipeline lookup failed: ${pipelineError.message}`);
  assert(pipeline, "Market Capture pipeline record was not found.", { marketCaptureLeadId: lead.id });
  assert(
    String(pipeline.stage) === "payment_pending",
    "Pipeline did not move to payment_pending after Checkout creation.",
    { stage: pipeline.stage },
  );

  const [taskCount, draftCount] = await Promise.all([
    getExactCount(supabase, "market_capture_tasks", "market_capture_lead_id", lead.id),
    getExactCount(supabase, "market_capture_drafts", "market_capture_lead_id", lead.id),
  ]);

  assert(taskCount > 0, "Market Capture tasks were not generated.", { taskCount });
  assert(draftCount > 0, "Market Capture sales drafts were not generated.", { draftCount });

  return {
    skipped: false,
    lead: {
      id: lead.id,
      paymentStatus: lead.payment_status,
      status: lead.status,
      jobsiteHaloAddressCount: lead.metadata?.jobsite_halo?.addresses?.length ?? 0,
      neighborhoodSaturationAreaCount: lead.metadata?.neighborhood_saturation?.areas?.length ?? 0,
      neighborhoodSaturationScore: lead.metadata?.neighborhood_saturation?.score ?? 0,
      competitorAreaLocationCount: lead.metadata?.competitor_area?.locations?.length ?? 0,
      competitorAreaReadinessScore: lead.metadata?.competitor_area?.readinessScore ?? 0,
      eventAreaLocationCount: lead.metadata?.event_area?.locations?.length ?? 0,
      eventAreaReadinessScore: lead.metadata?.event_area?.readinessScore ?? 0,
      eventAreaDeadlineStatus: lead.metadata?.event_area?.deadlineStatus ?? null,
      digitalDirectMailBundleSku: lead.metadata?.digital_direct_mail_bundle?.bundleSku ?? null,
      digitalDirectMailReadinessScore: lead.metadata?.digital_direct_mail_bundle?.readinessScore ?? 0,
    },
    pipeline: {
      stage: pipeline.stage,
      status: pipeline.status,
      nextAction: pipeline.next_action,
    },
    taskCount,
    draftCount,
  };
}

const env = loadEnv();
const baseUrl = normalizeBaseUrl(env.LIVE_FUNNEL_BASE_URL ?? env.SMOKE_BASE_URL);
const startedAt = new Date();
const qaId = `${startedAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `qa+market-capture-${qaId}@home-reach.com`;
const businessName = `HomeReach QA Market Capture ${qaId}`;

assert(env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY is required to expire the Checkout smoke session safely.");
assert(env.STRIPE_SECRET_KEY.startsWith("sk_"), "STRIPE_SECRET_KEY must start with sk_.");

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
const webhookHealth = await withTimeout(getStripeWebhookHealth(stripe), "Stripe webhook health");
assert(
  webhookHealth.activeEndpointCount > 0,
  "No enabled HomeReach live Stripe webhook endpoint was found.",
  webhookHealth,
);
assert(
  webhookHealth.hasCheckoutCompleted,
  "HomeReach live Stripe webhook is not subscribed to checkout.session.completed.",
  webhookHealth,
);

const form = new FormData();
form.set("businessName", businessName);
form.set("contactName", "HomeReach QA");
form.set("email", email);
form.set("phone", "+10000000000");
form.set("website", "https://www.home-reach.com");
form.set("industry", "Roofing");
form.set("requestedPlan", "starter");
form.set("monthlyAdBudget", "1000");
form.append("objectives", "leads");
form.append("objectives", "event_promotion");
form.append("objectives", "neighborhood_saturation");
form.append("targetingTypes", "jobsite_halo");
form.append("targetingTypes", "neighborhood_saturation");
form.append("targetingTypes", "competitor_area");
form.append("targetingTypes", "event_area");
form.set(
  "targetArea",
  "Phase D QA live funnel target area. Internal smoke test only; do not contact this record.",
);
form.set(
  "jobsiteAddresses",
  "QA Jobsite Halo | 123 Smoke Test Ave, Akron OH | internal test only\nQA Backup Jobsite | 456 Smoke Test Blvd, Canton OH | internal test only",
);
form.set("jobsiteRadiusPreference", "1");
form.set("jobsiteProofNotes", "Internal smoke proof notes only. Do not use for outreach.");
form.set(
  "neighborhoodAreas",
  "QA Highland Area | Akron OH | primary | internal saturation test only\nQA Firestone Area | Akron OH | secondary | internal saturation test only",
);
form.set("neighborhoodZipCodes", "44303");
form.set(
  "neighborhoodRouteClusters",
  "QA Route Cluster | Main St to Oak Ave | primary | internal route cluster test only",
);
form.set(
  "neighborhoodSaturationGoal",
  "Internal QA saturation planning only. Do not use for outreach.",
);
form.set("neighborhoodDirectMailQuantity", "1000");
form.set("neighborhoodNotes", "Internal smoke notes only. Route counts must be verified before any quote.");
form.set(
  "competitorLocations",
  "QA Competitor One | 100 Competitor Ave, Akron OH | roofing | primary | internal geography-only visibility test\nQA Competitor Two | 200 Competitor Blvd, Canton OH | roofing | secondary | internal geography-only visibility test",
);
form.set("competitorRadiusPreference", "1");
form.set("competitorCampaignGoal", "Internal QA competitor-area visibility planning only.");
form.set("competitorComplianceAcknowledged", "true");
form.set(
  "eventLocations",
  "QA Event One | 300 Event Center Dr, Akron OH | 2026-07-15 | two weeks before event | primary | internal event visibility test\nQA Event Two | 400 Community Hall Rd, Canton OH | 2026-08-01 | week before event | secondary | internal event visibility test",
);
form.set("eventRadiusPreference", "2");
form.set("eventStartDate", "2026-07-15");
form.set("eventEndDate", "2026-07-15");
form.set("eventPromotionWindow", "Two weeks before event");
form.set("eventCampaignGoal", "Internal QA event-area visibility planning only.");
form.set("eventSourceConfirmed", "true");
form.set("eventComplianceAcknowledged", "true");
form.set("directMailPath", "Targeted Direct Mail");
form.set("directMailQuantity", "1000");
form.set("directMailFormat", "6x9 postcard");
form.set("directMailDropWindow", "Internal QA window only");
form.set("directMailTrackingDestination", "https://www.home-reach.com/market-capture");
form.set("directMailProofContact", "HomeReach QA <qa@home-reach.com>");
form.set("sameAreaForMail", "true");
form.set("directMailBundleNotes", "Internal bundle smoke only. Do not quote or mail.");
form.set("preferredStartDate", "2026-06-15");
form.set("campaignOffer", "Internal Phase D smoke test. No customer outreach.");
form.set("postcardAddon", "true");
form.set("landingPageNeeded", "false");
form.set("creativePackageNeeded", "false");
form.set("consent", "true");
form.set("compliance", "true");

const intake = await fetchJson(`${baseUrl}/api/market-capture/intake`, {
  method: "POST",
  body: form,
});

assert(intake.res.status === 201, "Market Capture intake did not return 201.", {
  status: intake.res.status,
  body: intake.data ?? intake.text.slice(0, 400),
});
assert(intake.data?.checkoutToken, "Intake response did not include a checkout token.");
assert(intake.data?.lead?.id, "Intake response did not include a Market Capture lead id.");

const checkoutToken = intake.data.checkoutToken;
const marketCaptureLeadId = intake.data.lead.id;

const summary = await fetchJson(
  `${baseUrl}/api/stripe/market-capture-checkout?token=${encodeURIComponent(checkoutToken)}`,
);
assert(summary.res.status === 200, "Checkout summary did not return 200.", {
  status: summary.res.status,
  body: summary.data ?? summary.text.slice(0, 400),
});
assert(summary.data?.lead?.businessName === businessName, "Checkout summary business name mismatch.");
assert(summary.data?.lead?.email === email, "Checkout summary email mismatch.");
assert(
  Number(summary.data?.lead?.monthlyManagementFee) === REQUIRED_MANAGEMENT_FEE_CENTS,
  "Checkout summary did not show $499/month management fee.",
  { monthlyManagementFee: summary.data?.lead?.monthlyManagementFee },
);
assert(summary.data?.lead?.stripeAvailable === true, "Stripe checkout is not available in the live funnel.");
assert(summary.data?.lead?.eligibleForCheckout === true, "Lead was not eligible for Checkout.");

const checkoutPage = await fetchText(
  `${baseUrl}/market-capture/checkout?token=${encodeURIComponent(checkoutToken)}`,
);
assert(checkoutPage.res.status === 200, "Checkout page did not return 200.", {
  status: checkoutPage.res.status,
});
assert(
  checkoutPage.text.includes("Market Capture") || checkoutPage.text.includes("payment"),
  "Checkout page response did not contain expected Market Capture payment copy.",
);

const createdCheckout = await fetchJson(`${baseUrl}/api/stripe/market-capture-checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ checkoutToken }),
});
assert(createdCheckout.res.status === 200, "Checkout create did not return 200.", {
  status: createdCheckout.res.status,
  body: createdCheckout.data ?? createdCheckout.text.slice(0, 400),
});
assert(createdCheckout.data?.url, "Checkout create response did not include a Stripe URL.");

const checkoutUrl = String(createdCheckout.data.url);
const checkoutHost = new URL(checkoutUrl).host;
assert(checkoutHost === "checkout.stripe.com", "Checkout URL did not point to Stripe Checkout.", {
  checkoutHost,
});

const checkoutSessionId = extractCheckoutSessionId(checkoutUrl);
assert(checkoutSessionId, "Could not extract Stripe Checkout Session id from the Checkout URL.");

const checkoutSession = await withTimeout(
  stripe.checkout.sessions.retrieve(checkoutSessionId),
  "Stripe Checkout Session retrieval",
);
assert(checkoutSession.mode === "subscription", "Checkout Session was not a subscription session.", {
  checkoutSessionId,
  mode: checkoutSession.mode,
});
assert(checkoutSession.payment_status !== "paid", "Checkout Session was already marked paid before smoke expiration.", {
  checkoutSessionId,
  paymentStatus: checkoutSession.payment_status,
});
assert(checkoutSession.client_reference_id === marketCaptureLeadId, "Checkout Session client reference mismatch.", {
  checkoutSessionId,
});
assert(
  checkoutSession.metadata?.type === "market_capture_management",
  "Checkout Session metadata was missing Market Capture type.",
  { checkoutSessionId },
);
assert(
  String(checkoutSession.success_url ?? "").includes("/market-capture/status?token="),
  "Checkout Session success URL did not route back to Market Capture status.",
  { checkoutSessionId },
);
assert(
  String(checkoutSession.cancel_url ?? "").includes("/market-capture/checkout?token="),
  "Checkout Session cancel URL did not route back to Market Capture checkout.",
  { checkoutSessionId },
);

const expiredSession = await withTimeout(
  stripe.checkout.sessions.expire(checkoutSessionId),
  "Stripe Checkout Session expiration",
);
assert(expiredSession.status === "expired", "Checkout Session was not expired cleanly.", {
  checkoutSessionId,
  status: expiredSession.status,
  paymentStatus: expiredSession.payment_status,
});
assert(expiredSession.payment_status !== "paid", "Checkout smoke unexpectedly produced a paid session.", {
  checkoutSessionId,
  paymentStatus: expiredSession.payment_status,
});

const statusPage = await fetchText(`${baseUrl}/market-capture/status?token=${encodeURIComponent(checkoutToken)}`);
assert(statusPage.res.status === 200, "Status page did not return 200.", { status: statusPage.res.status });
assert(statusPage.text.includes(businessName), "Status page did not render the QA business name.");

let dbChecks;
try {
  dbChecks = await withTimeout(
    runDbChecks({
      env,
      email,
      marketCaptureLeadId,
      checkoutSessionId,
    }),
    "Supabase live funnel verification",
  );
} catch (err) {
  fail(err instanceof Error ? err.message : "Supabase verification failed.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      phase: "D_live_funnel_verification",
      baseUrl,
      createdQaLead: {
        id: marketCaptureLeadId,
        email,
        businessName,
      },
      checkout: {
        host: checkoutHost,
        sessionId: checkoutSessionId,
        status: expiredSession.status,
        paymentStatus: expiredSession.payment_status,
      },
      summary: {
        monthlyManagementFee: summary.data.lead.monthlyManagementFee,
        monthlyAdBudget: summary.data.lead.monthlyAdBudget,
        stripeAvailable: summary.data.lead.stripeAvailable,
      },
      webhookHealth: {
        ...webhookHealth,
        warning: webhookHealth.hasCheckoutExpired
          ? null
          : "checkout.session.expired is not enabled on the live HomeReach webhook endpoint.",
      },
      dbChecks,
    },
    null,
    2,
  ),
);
