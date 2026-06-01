import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const Stripe = requireFromWeb("stripe");

const args = new Set(process.argv.slice(2));
const createExpireCheckout = args.has("--create-expire-checkout");
const allowLiveCheckoutDryRun = args.has("--allow-live");

const REQUIRED_PRICE = {
  amount: 49900,
  currency: "usd",
  interval: "month",
  productNamePattern: /market\s*capture/i,
};

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
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: "Stripe Market Capture verification failed.",
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

function keyMode(value, prefix) {
  if (value?.startsWith(`${prefix}_live_`)) return "live";
  if (value?.startsWith(`${prefix}_test_`)) return "test";
  return "unknown";
}

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, message, ...details }, null, 2));
  process.exit(1);
}

function assert(condition, message, details = {}) {
  if (!condition) fail(message, details);
}

function publicPriceSummary(price) {
  const product = typeof price.product === "object" ? price.product : null;
  return {
    id: price.id,
    active: price.active,
    livemode: price.livemode,
    currency: price.currency,
    unitAmount: price.unit_amount,
    interval: price.recurring?.interval ?? null,
    productName: product?.name ?? null,
    productActive: product?.active ?? null,
  };
}

const env = loadEnv();
const secretKey = env.STRIPE_SECRET_KEY;
const publishableKey = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const priceId = env.STRIPE_MARKET_CAPTURE_PRICE_ID;

assert(secretKey, "STRIPE_SECRET_KEY is missing.");
assert(secretKey.startsWith("sk_"), "STRIPE_SECRET_KEY must start with sk_.", {
  prefix: secretKey.slice(0, 3),
});
assert(publishableKey, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing.");
assert(publishableKey.startsWith("pk_"), "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_.", {
  prefix: publishableKey.slice(0, 3),
});
assert(priceId, "STRIPE_MARKET_CAPTURE_PRICE_ID is missing.");
assert(priceId.startsWith("price_"), "STRIPE_MARKET_CAPTURE_PRICE_ID must start with price_.");

const secretMode = keyMode(secretKey, "sk");
const publishableMode = keyMode(publishableKey, "pk");
assert(secretMode !== "unknown", "STRIPE_SECRET_KEY mode must be live or test.");
assert(publishableMode !== "unknown", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY mode must be live or test.");
assert(secretMode === publishableMode, "Stripe secret and publishable keys must use the same mode.", {
  secretMode,
  publishableMode,
});

const stripe = new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" });

const account = await stripe.accounts.retrieve();
const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
const product = typeof price.product === "object" ? price.product : null;
const priceSummary = publicPriceSummary(price);

assert(price.active, "Configured Market Capture Stripe Price is not active.", { price: priceSummary });
assert(price.livemode === (secretMode === "live"), "Configured Stripe Price mode does not match the key mode.", {
  secretMode,
  price: priceSummary,
});
assert(price.currency === REQUIRED_PRICE.currency, "Configured Stripe Price must be USD.", { price: priceSummary });
assert(price.unit_amount === REQUIRED_PRICE.amount, "Configured Stripe Price must be $499.00.", {
  expectedAmount: REQUIRED_PRICE.amount,
  price: priceSummary,
});
assert(price.recurring?.interval === REQUIRED_PRICE.interval, "Configured Stripe Price must recur monthly.", {
  price: priceSummary,
});
assert(product?.active !== false, "Configured Stripe Product is inactive.", { price: priceSummary });
assert(
  REQUIRED_PRICE.productNamePattern.test(product?.name ?? ""),
  "Configured Stripe Product should be named for Market Capture.",
  { price: priceSummary },
);

let checkoutDryRun = null;
if (createExpireCheckout) {
  assert(
    secretMode !== "live" || allowLiveCheckoutDryRun,
    "Refusing to create a live Checkout Session without --allow-live.",
  );

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      client_reference_id: `market-capture-smoke-${Date.now()}`,
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        type: "market_capture_management",
        smoke_test: "true",
        created_by: "homereach_phase_c",
      },
      subscription_data: {
        metadata: {
          type: "market_capture_management",
          smoke_test: "true",
          created_by: "homereach_phase_c",
        },
      },
      success_url: "https://www.home-reach.com/market-capture/status?smoke=success",
      cancel_url: "https://www.home-reach.com/market-capture/checkout?smoke=cancel",
    },
    {
      idempotencyKey: `market-capture-live-smoke:${price.id}:${crypto.randomUUID()}`,
    },
  );

  const expired = await stripe.checkout.sessions.expire(session.id);
  checkoutDryRun = {
    sessionId: session.id,
    createdStatus: session.status,
    expiredStatus: expired.status,
    mode: session.mode,
    paymentStatus: expired.payment_status,
  };
}

console.log(
  JSON.stringify(
    {
      ok: true,
      stripeMode: secretMode,
      account: {
        id: account.id,
        country: account.country,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      },
      price: priceSummary,
      checkoutDryRun,
    },
    null,
    2,
  ),
);
