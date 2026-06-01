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
const REQUEST_TIMEOUT_MS = Number(process.env.SHARED_POSTCARDS_SMOKE_TIMEOUT_MS ?? 30000);
const args = new Set(process.argv.slice(2));
const skipDbChecks = args.has("--skip-db-checks");
const skipStripeChecks = args.has("--skip-stripe-checks");

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
        message: "Shared Postcards live funnel smoke failed.",
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

async function selectBundles(supabase) {
  const withPriceColumns = await withTimeout(
    supabase
      .from("bundles")
      .select("id, name, slug, price, standard_price, founding_price, metadata, is_active")
      .eq("is_active", true)
      .order("price", { ascending: true }),
    "active bundles lookup",
  );

  if (!withPriceColumns.error) return withPriceColumns.data ?? [];

  const fallback = await withTimeout(
    supabase
      .from("bundles")
      .select("id, name, slug, price, metadata, is_active")
      .eq("is_active", true)
      .order("price", { ascending: true }),
    "active bundles fallback lookup",
  );

  if (fallback.error) throw new Error(`active bundles lookup failed: ${fallback.error.message}`);
  return fallback.data ?? [];
}

async function findAvailablePair({ baseUrl, cities, categories }) {
  for (const city of cities) {
    for (const category of categories) {
      const url = `${baseUrl}/api/spots/availability?cityId=${encodeURIComponent(city.id)}&categoryId=${encodeURIComponent(category.id)}`;
      const availability = await fetchJson(url);
      if (availability.res.status !== 200) continue;
      if (availability.data?.available === true) {
        return { city, category, availability: availability.data };
      }
    }
  }

  return null;
}

async function runDbChecks({ env, baseUrl }) {
  if (skipDbChecks) {
    return { skipped: true, reason: "Skipped by --skip-db-checks." };
  }

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      skipped: true,
      reason: "Supabase env vars unavailable locally; route and API checks still ran.",
    };
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [citiesResult, categoriesResult, bundles] = await Promise.all([
    withTimeout(
      supabase
        .from("cities")
        .select("id, name, state, slug, is_active, founding_eligible")
        .eq("is_active", true)
        .order("name"),
      "active cities lookup",
    ),
    withTimeout(
      supabase
        .from("categories")
        .select("id, name, slug, is_active")
        .eq("is_active", true)
        .order("name"),
      "active categories lookup",
    ),
    selectBundles(supabase),
  ]);

  if (citiesResult.error) throw new Error(`active cities lookup failed: ${citiesResult.error.message}`);
  if (categoriesResult.error) throw new Error(`active categories lookup failed: ${categoriesResult.error.message}`);

  const cities = citiesResult.data ?? [];
  const categories = categoriesResult.data ?? [];

  assert(cities.length > 0, "No active Shared Postcard cities found.");
  assert(categories.length > 0, "No active Shared Postcard categories found.");
  assert(bundles.length > 0, "No active Shared Postcard bundles found.");

  const preferredBundle =
    bundles.find((bundle) => bundle.slug === "back-feature") ??
    bundles.find((bundle) => bundle.slug === "front-feature") ??
    bundles[0];
  const availablePair = await findAvailablePair({ baseUrl, cities, categories });
  assert(availablePair, "No available city/category pair found for Shared Postcards.", {
    activeCities: cities.length,
    activeCategories: categories.length,
    activeBundles: bundles.length,
  });

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [staleAssignments, staleOrders, staleAiSessions] = await Promise.all([
    withTimeout(
      supabase
        .from("spot_assignments")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .lt("created_at", cutoff),
      "stale spot assignments lookup",
    ),
    withTimeout(
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .not("stripe_checkout_session_id", "is", null)
        .lt("created_at", cutoff),
      "stale shared checkout orders lookup",
    ),
    withTimeout(
      supabase
        .from("ai_intake_sessions")
        .select("id", { count: "exact", head: true })
        .in("status", ["confirmed", "checkout_created"])
        .lt("updated_at", cutoff),
      "stale AI intake sessions lookup",
    ),
  ]);

  if (staleAssignments.error) throw new Error(`stale spot assignments lookup failed: ${staleAssignments.error.message}`);
  if (staleOrders.error) throw new Error(`stale shared checkout orders lookup failed: ${staleOrders.error.message}`);
  if (staleAiSessions.error) throw new Error(`stale AI intake sessions lookup failed: ${staleAiSessions.error.message}`);

  assert((staleAssignments.count ?? 0) === 0, "Stale pending spot assignments are locking inventory.", {
    stalePendingSpotAssignments: staleAssignments.count,
  });
  assert((staleOrders.count ?? 0) === 0, "Stale pending Shared Postcard checkout orders need cleanup.", {
    stalePendingCheckoutOrders: staleOrders.count,
  });
  assert((staleAiSessions.count ?? 0) === 0, "Stale confirmed AI intake sessions need cleanup.", {
    staleConfirmedAiSessions: staleAiSessions.count,
  });

  return {
    skipped: false,
    activeCities: cities.length,
    activeCategories: categories.length,
    activeBundles: bundles.map((bundle) => ({
      id: bundle.id,
      name: bundle.name,
      slug: bundle.slug,
      price: bundle.price,
      standardPrice: bundle.standard_price ?? null,
      foundingPrice: bundle.founding_price ?? null,
    })),
    selectedCity: {
      id: availablePair.city.id,
      name: `${availablePair.city.name}, ${availablePair.city.state}`,
      slug: availablePair.city.slug,
      foundingEligible: Boolean(availablePair.city.founding_eligible),
    },
    selectedCategory: {
      id: availablePair.category.id,
      name: availablePair.category.name,
      slug: availablePair.category.slug,
    },
    selectedBundle: {
      id: preferredBundle.id,
      name: preferredBundle.name,
      slug: preferredBundle.slug,
      price: preferredBundle.price,
    },
    availability: availablePair.availability,
    staleChecks: {
      pendingSpotAssignmentsOlderThan24h: staleAssignments.count ?? 0,
      pendingOrdersOlderThan24h: staleOrders.count ?? 0,
      confirmedAiSessionsOlderThan24h: staleAiSessions.count ?? 0,
    },
  };
}

async function assertRouteText(baseUrl, pathName, expected, options = {}) {
  const result = await fetchText(`${baseUrl}${pathName}`, { redirect: options.redirect ?? "follow" });
  const allowed = options.allowedStatuses ?? [200];
  assert(allowed.includes(result.res.status), `${pathName} returned unexpected status.`, {
    status: result.res.status,
  });
  if (expected) {
    assert(result.text.includes(expected), `${pathName} did not contain expected copy.`, {
      expected,
      status: result.res.status,
    });
  }
  return { path: pathName, status: result.res.status };
}

async function runRouteAndApiChecks({ baseUrl, dbChecks }) {
  const checks = [];

  checks.push(await assertRouteText(baseUrl, "/shared-postcards", "Shared Postcards"));
  checks.push(await assertRouteText(baseUrl, "/get-started", "Choose"));

  if (!dbChecks?.selectedCity || !dbChecks?.selectedCategory || !dbChecks?.selectedBundle) {
    return { checks, dynamicChecksSkipped: true };
  }

  const { selectedCity, selectedCategory, selectedBundle } = dbChecks;
  const cityPath = `/get-started/${selectedCity.slug}`;
  const categoryPath = `/get-started/${selectedCity.slug}/${selectedCategory.slug}`;
  const checkoutPath = `${categoryPath}/checkout?bundle=${encodeURIComponent(selectedBundle.id)}`;

  checks.push(await assertRouteText(baseUrl, cityPath, selectedCity.name.split(",")[0]));
  checks.push(await assertRouteText(baseUrl, categoryPath, selectedCategory.name));
  checks.push(await assertRouteText(baseUrl, checkoutPath, "Confirm your spot"));

  const success = await fetchText(`${baseUrl}/checkout/success?session_id=cs_test_smoke`, {
    redirect: "follow",
  });
  assert(success.res.status === 200, "/checkout/success did not return 200.", { status: success.res.status });
  assert(!success.text.includes("Your spot is confirmed"), "Success page still over-confirms unpaid checkout state.");
  checks.push({ path: "/checkout/success?session_id=cs_test_smoke", status: success.res.status });

  const admin = await fetchText(`${baseUrl}/admin/spots`, { redirect: "manual" });
  assert([200, 302, 303, 307, 308, 401, 403].includes(admin.res.status), "/admin/spots did not gate or load cleanly.", {
    status: admin.res.status,
  });
  checks.push({ path: "/admin/spots", status: admin.res.status });

  const resolve = await fetchJson(
    `${baseUrl}/api/spots/resolve?citySlug=${encodeURIComponent(selectedCity.slug)}&categorySlug=${encodeURIComponent(selectedCategory.slug)}`,
  );
  assert(resolve.res.status === 200, "/api/spots/resolve did not return 200.", {
    status: resolve.res.status,
    body: resolve.data ?? resolve.text.slice(0, 400),
  });
  assert(resolve.data?.cityId === selectedCity.id, "Resolved city id mismatch.", resolve.data ?? {});
  assert(resolve.data?.categoryId === selectedCategory.id, "Resolved category id mismatch.", resolve.data ?? {});
  checks.push({ path: "/api/spots/resolve", status: resolve.res.status });

  const availability = await fetchJson(
    `${baseUrl}/api/spots/availability?cityId=${encodeURIComponent(selectedCity.id)}&categoryId=${encodeURIComponent(selectedCategory.id)}`,
  );
  assert(availability.res.status === 200, "/api/spots/availability did not return 200.", {
    status: availability.res.status,
    body: availability.data ?? availability.text.slice(0, 400),
  });
  assert(availability.data?.available === true, "Selected Shared Postcard city/category is not available.", {
    availability: availability.data,
  });
  checks.push({ path: "/api/spots/availability", status: availability.res.status });

  const unauthorizedCheckout = await fetchJson(`${baseUrl}/api/spots/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bundleId: selectedBundle.id,
      cityId: selectedCity.id,
      categoryId: selectedCategory.id,
      businessName: "HomeReach QA Shared Postcard Smoke",
      citySlug: selectedCity.slug,
      categorySlug: selectedCategory.slug,
      addons: [],
    }),
  });
  assert(unauthorizedCheckout.res.status === 401, "Unauthenticated shared checkout did not require auth.", {
    status: unauthorizedCheckout.res.status,
    body: unauthorizedCheckout.data ?? unauthorizedCheckout.text.slice(0, 400),
  });
  checks.push({ path: "/api/spots/checkout unauthenticated", status: unauthorizedCheckout.res.status });

  const aiIntakePage = await fetchText(`${baseUrl}/shared-postcards/ai-intake`, { redirect: "follow" });
  assert([200, 404].includes(aiIntakePage.res.status), "AI intake page returned unexpected status.", {
    status: aiIntakePage.res.status,
  });
  checks.push({ path: "/shared-postcards/ai-intake", status: aiIntakePage.res.status });

  const aiIntakeApi = await fetchJson(`${baseUrl}/api/ai-intake/shared-postcards`);
  assert([200, 404].includes(aiIntakeApi.res.status), "AI intake API returned unexpected status.", {
    status: aiIntakeApi.res.status,
    body: aiIntakeApi.data ?? aiIntakeApi.text.slice(0, 400),
  });
  if (aiIntakeApi.res.status === 200) {
    assert(Array.isArray(aiIntakeApi.data?.options?.cities), "AI intake API did not return city options.");
    assert(Array.isArray(aiIntakeApi.data?.options?.categories), "AI intake API did not return category options.");
  }
  checks.push({ path: "/api/ai-intake/shared-postcards", status: aiIntakeApi.res.status });

  return { checks, dynamicChecksSkipped: false };
}

async function runStripeChecks(env) {
  if (skipStripeChecks) {
    return { skipped: true, reason: "Skipped by --skip-stripe-checks." };
  }

  if (!env.STRIPE_SECRET_KEY) {
    return { skipped: true, reason: "STRIPE_SECRET_KEY unavailable locally; webhook health was not checked." };
  }

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
  assert(
    webhookHealth.hasCheckoutExpired,
    "HomeReach live Stripe webhook is not subscribed to checkout.session.expired.",
    webhookHealth,
  );

  return { skipped: false, ...webhookHealth };
}

const env = loadEnv();
const baseUrl = normalizeBaseUrl(
  env.SHARED_POSTCARDS_SMOKE_BASE_URL ?? env.LIVE_FUNNEL_BASE_URL ?? env.SMOKE_BASE_URL,
);

let dbChecks;
try {
  dbChecks = await runDbChecks({ env, baseUrl });
} catch (error) {
  fail(error instanceof Error ? error.message : "Shared Postcards database smoke failed.");
}

const routeAndApiChecks = await runRouteAndApiChecks({ baseUrl, dbChecks });
const stripeChecks = await runStripeChecks(env);

console.log(
  JSON.stringify(
    {
      ok: true,
      service: "shared-postcards",
      baseUrl,
      dbChecks,
      routeAndApiChecks,
      stripeChecks,
    },
    null,
    2,
  ),
);
