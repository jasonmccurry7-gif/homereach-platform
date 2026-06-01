import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const Stripe = requireFromWeb("stripe");
const { createClient } = requireFromWeb("@supabase/supabase-js");

const DEFAULT_BASE_URL = "https://www.home-reach.com";
const REQUEST_TIMEOUT_MS = Number(process.env.TARGETED_DIRECT_MAIL_SMOKE_TIMEOUT_MS ?? 30000);
const EXPECTED_HOMES_COUNT = 2500;
const EXPECTED_PRICE_CENTS = 182500;
const args = new Set(process.argv.slice(2));
const skipDbChecks = args.has("--skip-db-checks");

class SmokeFailure extends Error {}

function redactSecret(value) {
  return String(value).replace(/(sk|pk)_(live|test)_[^\s'",)]+/g, "$1_$2_***");
}

function safeError(error) {
  return {
    name: error?.name ?? "Error",
    type: error?.type ?? null,
    code: error?.code ?? null,
    statusCode: error?.statusCode ?? null,
    message: redactSecret(error?.message ?? "Unknown error"),
  };
}

process.on("uncaughtException", (error) => {
  if (error instanceof SmokeFailure) {
    process.exitCode = 1;
    return;
  }

  console.error(
    JSON.stringify(
      {
        ok: false,
        message: "Targeted Direct Mail live funnel smoke failed.",
        error: safeError(error),
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

function normalizeBaseUrl(value) {
  return (value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, message, ...details }, null, 2));
  throw new SmokeFailure(message);
}

function assert(condition, message, details = {}) {
  if (!condition) fail(message, details);
}

async function withTimeout(promise, label, timeoutMs = REQUEST_TIMEOUT_MS) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

async function fetchWithTimeout(url, init, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...(init ?? {}), signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`${label} timed out after ${REQUEST_TIMEOUT_MS}ms.`);
    throw new Error(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url, init) {
  const res = await fetchWithTimeout(url, init, `Fetch ${url}`);
  const text = await res.text();
  return { res, text };
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

async function runDbChecks({ env, email, leadId, campaignId, checkoutSessionId }) {
  if (skipDbChecks) {
    return { skipped: true, reason: "Skipped by --skip-db-checks." };
  }

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      skipped: true,
      reason: "Supabase env vars unavailable locally; route, API, and Stripe checks still ran.",
    };
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: lead, error: leadError } = await withTimeout(
    supabase
      .from("leads")
      .select("id, email, status, notes, intake_token, intake_submitted_at")
      .eq("id", leadId)
      .maybeSingle(),
    "leads lookup",
  );
  if (leadError) throw new Error(`leads lookup failed: ${leadError.message}`);
  assert(lead, "Targeted lead was not found in Supabase.", { email, leadId });
  assert(lead.email === email, "Targeted lead email mismatch.", { email, dbEmail: lead.email });
  assert(lead.status === "intake_complete", "Targeted lead did not move to intake_complete.", {
    status: lead.status,
  });

  const { data: campaign, error: campaignError } = await withTimeout(
    supabase
      .from("targeted_route_campaigns")
      .select(
        "id, lead_id, email, status, design_status, mailing_status, homes_count, price_cents, stripe_checkout_session_id, target_area_notes, notes",
      )
      .eq("id", campaignId)
      .maybeSingle(),
    "targeted_route_campaigns lookup",
  );
  if (campaignError) throw new Error(`targeted_route_campaigns lookup failed: ${campaignError.message}`);
  assert(campaign, "Targeted campaign was not found in Supabase.", { campaignId });
  assert(campaign.lead_id === leadId, "Targeted campaign did not link back to the lead.", {
    campaignLeadId: campaign.lead_id,
    leadId,
  });
  assert(Number(campaign.homes_count) === EXPECTED_HOMES_COUNT, "Targeted campaign household count mismatch.", {
    homesCount: campaign.homes_count,
  });
  assert(Number(campaign.price_cents) === EXPECTED_PRICE_CENTS, "Targeted campaign price mismatch.", {
    priceCents: campaign.price_cents,
  });
  assert(
    campaign.stripe_checkout_session_id === checkoutSessionId,
    "Targeted campaign did not store the Stripe Checkout session id.",
    {
      storedSessionId: campaign.stripe_checkout_session_id,
      checkoutSessionId,
    },
  );
  assert(
    String(campaign.target_area_notes ?? "").includes("QA route cluster"),
    "Targeted campaign route notes were not stored.",
    { targetAreaNotes: campaign.target_area_notes },
  );

  const archiveNote = "QA smoke archived: Targeted Direct Mail live funnel verification. Do not contact.";
  await supabase
    .from("targeted_route_campaigns")
    .update({
      status: "cancelled",
      notes: `${campaign.notes ?? ""}\n\n${archiveNote}`,
    })
    .eq("id", campaign.id);

  await supabase
    .from("leads")
    .update({
      status: "review_requested",
      review_requested: true,
      review_requested_at: new Date().toISOString(),
      notes: `${lead.notes ?? ""}\n\n${archiveNote}`,
    })
    .eq("id", lead.id);

  return {
    skipped: false,
    lead: {
      id: lead.id,
      status: "review_requested",
    },
    campaign: {
      id: campaign.id,
      status: "cancelled",
      homesCount: Number(campaign.homes_count),
      priceCents: Number(campaign.price_cents),
    },
  };
}

async function main() {
  const env = loadEnv();
  const baseUrl = normalizeBaseUrl(env.TARGETED_DIRECT_MAIL_SMOKE_BASE_URL ?? env.SMOKE_BASE_URL);
  const qaId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `qa+targeted-direct-mail-${qaId}@home-reach.com`;
  const businessName = `HomeReach QA Targeted Direct Mail ${qaId}`;

  assert(env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY is required to expire the Checkout smoke session safely.");
  assert(env.STRIPE_SECRET_KEY.startsWith("sk_"), "STRIPE_SECRET_KEY must start with sk_.");

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
  const webhookHealth = await withTimeout(getStripeWebhookHealth(stripe), "Stripe webhook health");
  assert(webhookHealth.activeEndpointCount >= 1, "No enabled live Stripe webhook endpoint points to HomeReach.", webhookHealth);
  assert(
    webhookHealth.hasCheckoutCompleted,
    "HomeReach live Stripe webhook is not subscribed to checkout.session.completed.",
    webhookHealth,
  );

  const landing = await fetchText(`${baseUrl}/targeted`, { redirect: "manual" });
  assert(landing.res.status === 200, "Targeted landing page did not return 200.", { status: landing.res.status });
  assert(
    landing.text.includes("Own the neighborhoods") || landing.text.includes("Neighborhood"),
    "Targeted landing page did not include expected sales copy.",
  );

  const startPage = await fetchText(`${baseUrl}/targeted/start`, { redirect: "manual" });
  assert(startPage.res.status === 200, "Targeted start page did not return 200.", { status: startPage.res.status });
  assert(startPage.text.includes("Request a territory review"), "Targeted start page missing territory review copy.");

  const intakePage = await fetchText(`${baseUrl}/targeted/intake`, { redirect: "manual" });
  assert(intakePage.res.status === 200, "Targeted intake page did not return 200.", { status: intakePage.res.status });
  assert(
    intakePage.text.includes("Targeted") || intakePage.text.includes("/_next/static/"),
    "Targeted intake page did not render an application shell.",
  );

  const createdLead = await fetchJson(`${baseUrl}/api/targeted/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "HomeReach Targeted QA",
      businessName,
      email,
      city: "Medina, OH",
      source: "web",
      notes: "Internal QA Targeted Direct Mail smoke test. Do not contact.",
    }),
  });
  assert(createdLead.res.status === 201, "Targeted lead create did not return 201.", {
    status: createdLead.res.status,
    body: createdLead.data ?? createdLead.text.slice(0, 400),
  });
  assert(createdLead.data?.lead?.id, "Targeted lead create response did not include lead id.");
  assert(createdLead.data?.lead?.intakeToken, "Targeted lead create response did not include intake token.");

  const leadId = createdLead.data.lead.id;
  const intakeToken = createdLead.data.lead.intakeToken;
  const intake = await fetchJson(`${baseUrl}/api/targeted/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intakeToken,
      businessName,
      contactName: "HomeReach Targeted QA",
      email,
      businessAddress: "100 QA Main St, Medina, OH",
      targetCity: "Medina, OH",
      targetAreaNotes:
        "QA route cluster around high-value homeowner streets near Medina Square. Internal smoke only.",
      notes: "Selected package: High-Value Homeowner Reach\nCustomer notes: QA smoke, do not contact.",
      homesCount: EXPECTED_HOMES_COUNT,
      priceCents: 1,
    }),
  });
  assert(intake.res.status === 201, "Targeted intake did not return 201.", {
    status: intake.res.status,
    body: intake.data ?? intake.text.slice(0, 400),
  });
  assert(intake.data?.checkoutToken, "Targeted intake response did not include checkout token.");
  assert(intake.data?.campaign?.id, "Targeted intake response did not include campaign id.");

  const checkoutToken = intake.data.checkoutToken;
  const campaignId = intake.data.campaign.id;
  const summary = await fetchJson(
    `${baseUrl}/api/stripe/targeted-checkout?token=${encodeURIComponent(checkoutToken)}`,
  );
  assert(summary.res.status === 200, "Targeted checkout summary did not return 200.", {
    status: summary.res.status,
    body: summary.data ?? summary.text.slice(0, 400),
  });
  assert(summary.data?.campaign?.id === campaignId, "Targeted checkout summary campaign id mismatch.");
  assert(summary.data?.campaign?.eligibleForCheckout === true, "Targeted campaign was not checkout eligible.");
  assert(Number(summary.data?.campaign?.homesCount) === EXPECTED_HOMES_COUNT, "Checkout summary household mismatch.");
  assert(Number(summary.data?.campaign?.priceCents) === EXPECTED_PRICE_CENTS, "Checkout summary price mismatch.");

  const checkoutPage = await fetchText(`${baseUrl}/targeted/checkout?token=${encodeURIComponent(checkoutToken)}`);
  assert(checkoutPage.res.status === 200, "Targeted checkout page did not return 200.", {
    status: checkoutPage.res.status,
  });
  assert(
    checkoutPage.text.includes("Targeted") || checkoutPage.text.includes("/_next/static/"),
    "Targeted checkout page did not render an application shell.",
  );

  const createdCheckout = await fetchJson(`${baseUrl}/api/stripe/targeted-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkoutToken }),
  });
  assert(createdCheckout.res.status === 200, "Targeted Checkout create did not return 200.", {
    status: createdCheckout.res.status,
    body: createdCheckout.data ?? createdCheckout.text.slice(0, 400),
  });
  assert(createdCheckout.data?.url, "Targeted Checkout create response did not include a Stripe URL.");

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
  assert(checkoutSession.mode === "payment", "Targeted Checkout Session was not a payment session.", {
    checkoutSessionId,
    mode: checkoutSession.mode,
  });
  assert(checkoutSession.payment_status !== "paid", "Targeted Checkout Session was already marked paid.", {
    checkoutSessionId,
    paymentStatus: checkoutSession.payment_status,
  });
  assert(checkoutSession.client_reference_id === campaignId, "Checkout Session client reference mismatch.", {
    checkoutSessionId,
    clientReferenceId: checkoutSession.client_reference_id,
    campaignId,
  });
  assert(
    checkoutSession.metadata?.type === "targeted_route_campaign",
    "Checkout Session metadata was missing targeted route type.",
    { checkoutSessionId },
  );
  assert(
    Number(checkoutSession.amount_total) === EXPECTED_PRICE_CENTS,
    "Checkout Session amount did not match the selected Targeted Direct Mail tier.",
    { checkoutSessionId, amountTotal: checkoutSession.amount_total },
  );
  assert(
    String(checkoutSession.success_url ?? "").includes("/targeted/confirmed?campaign="),
    "Checkout Session success URL did not route back to targeted confirmation.",
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

  const confirmationPage = await fetchText(`${baseUrl}/targeted/confirmed?campaign=${campaignId}`);
  assert(confirmationPage.res.status === 200, "Targeted confirmation page did not return 200.", {
    status: confirmationPage.res.status,
  });
  assert(
    !confirmationPage.text.includes("Payment is confirmed."),
    "Targeted confirmation page still overstates unverified payment status.",
  );

  const dbChecks = await withTimeout(
    runDbChecks({ env, email, leadId, campaignId, checkoutSessionId }),
    "Supabase targeted funnel verification",
    REQUEST_TIMEOUT_MS * 3,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        message: "Targeted Direct Mail live funnel smoke passed.",
        baseUrl,
        lead: {
          id: leadId,
          email,
          businessName,
        },
        campaign: {
          id: campaignId,
          homesCount: EXPECTED_HOMES_COUNT,
          priceCents: EXPECTED_PRICE_CENTS,
        },
        checkout: {
          host: checkoutHost,
          sessionId: checkoutSessionId,
          status: expiredSession.status,
          paymentStatus: expiredSession.payment_status,
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
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: "Targeted Direct Mail live funnel smoke failed.",
        error: safeError(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
