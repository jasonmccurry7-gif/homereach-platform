// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Startup Environment Validation
//
// CRITICAL: Import this at the top of the root layout (server side).
// The app will crash LOUDLY at startup if required env vars are missing,
// rather than silently serving broken pages to real users.
//
// This file MUST remain a plain module (no "use client").
// ─────────────────────────────────────────────────────────────────────────────

type EnvSpec = {
  key: string;
  required: boolean;
  productionOnly?: boolean; // only required when NODE_ENV === "production"
  validValues?: string[];   // if set, value must be one of these
  dangerIfSet?: string;     // if set, warn/error when this value is present in prod
};

const ENV_SPECS: EnvSpec[] = [
  // ── Database ────────────────────────────────────────────────────────────────
  {
    key: "DATABASE_URL_POOLED",
    required: true,
    productionOnly: false, // required in all envs when USE_MOCK_DB=false
  },
  {
    key: "DATABASE_URL",
    required: true,
    productionOnly: false,
  },

  // ── Supabase ────────────────────────────────────────────────────────────────
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    productionOnly: false,
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    productionOnly: false,
  },
  {
    // Required for supabase.auth.admin.inviteUserByEmail() in the Stripe webhook.
    // If missing, new business owners are never invited and the activation lifecycle
    // silently breaks after payment. Fatal in production; warn in development.
    key: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    productionOnly: true,
  },

  // ── Stripe ──────────────────────────────────────────────────────────────────
  {
    key: "STRIPE_SECRET_KEY",
    required: true,
    productionOnly: false,
  },
  {
    // Required in the browser — used for Stripe.js / Elements if ever added.
    // Currently used for any client-side Stripe integration and must be a
    // publishable key (pk_live_ or pk_test_). Validated here so deployment
    // without it fails loudly instead of silently breaking Stripe Elements.
    key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    required: true,
    productionOnly: false,
  },
  {
    key: "STRIPE_WEBHOOK_SECRET",
    required: true,
    productionOnly: true,
    dangerIfSet: "whsec_placeholder", // fail loudly if placeholder is still set
  },

  // ── Twilio ──────────────────────────────────────────────────────────────────
  {
    key: "TWILIO_ACCOUNT_SID",
    required: true,
    productionOnly: false,
  },
  {
    key: "TWILIO_AUTH_TOKEN",
    required: true,
    productionOnly: false,
  },

  // ── Mailgun (email provider) ──────────────────────────────────────────────────
  {
    key: "MAILGUN_API_KEY",
    required: false,
    productionOnly: true,
  },
  {
    key: "MAILGUN_DOMAIN",
    required: false,
    productionOnly: true,
  },
  {
    key: "MAILGUN_FROM_EMAIL",
    required: false,
    productionOnly: false,
  },

  // Owner / outbound identity
  {
    key: "OWNER_NAME",
    required: true,
    productionOnly: true,
  },
  {
    key: "OWNER_CELL_PHONE",
    required: true,
    productionOnly: true,
  },
  {
    key: "OUTREACH_SMS_FROM_NUMBER",
    required: false,
    productionOnly: false,
  },
  {
    key: "OWNER_PERSONAL_EMAIL",
    required: true,
    productionOnly: true,
  },
  {
    key: "OWNER_SECONDARY_EMAIL",
    required: true,
    productionOnly: true,
  },
  {
    key: "OWNER_DOMAIN_EMAIL",
    required: true,
    productionOnly: true,
  },
  {
    key: "DEFAULT_FROM_EMAIL",
    required: true,
    productionOnly: true,
  },
  {
    key: "DEFAULT_REPLY_TO_EMAIL",
    required: true,
    productionOnly: true,
  },
  {
    key: "EMAIL_PROVIDER",
    required: false,
    productionOnly: false,
    validValues: ["resend", "mailgun", "postmark"],
  },
  {
    key: "RESEND_API_KEY",
    required: false,
    productionOnly: false,
  },
  {
    key: "POSTMARK_API_TOKEN",
    required: false,
    productionOnly: false,
  },
  {
    key: "POSTMARK_FROM_EMAIL",
    required: false,
    productionOnly: false,
  },
  {
    key: "POSTMARK_FROM_NAME",
    required: false,
    productionOnly: false,
  },
  {
    key: "POSTMARK_MESSAGE_STREAM",
    required: false,
    productionOnly: false,
  },
  {
    key: "ENABLE_POSTMARK_WEBHOOK",
    required: false,
    productionOnly: false,
    validValues: ["true", "false"],
  },
  {
    key: "POSTMARK_WEBHOOK_USER",
    required: false,
    productionOnly: false,
  },
  {
    key: "POSTMARK_WEBHOOK_PASSWORD",
    required: false,
    productionOnly: false,
  },
  {
    key: "OUTREACH_TEST_MODE",
    required: false,
    productionOnly: false,
    validValues: ["true", "false"],
  },
  {
    key: "OUTREACH_MANUAL_APPROVAL_MODE",
    required: false,
    productionOnly: false,
    validValues: ["true", "false"],
  },
  {
    key: "OUTREACH_SMS_PROSPECTING_LIVE_ENABLED",
    required: false,
    productionOnly: false,
    validValues: ["true", "false"],
  },
  {
    key: "OUTREACH_EMAIL_ROTATION_ENABLED",
    required: false,
    productionOnly: false,
    validValues: ["true", "false"],
  },

  // ── Notifications ─────────────────────────────────────────────────────────────
  // Political candidate intelligence providers (optional, additive)
  { key: "FEC_API_KEY", required: false, productionOnly: false },
  { key: "GOOGLE_CIVIC_API_KEY", required: false, productionOnly: false },
  { key: "DEMOCRACY_WORKS_API_KEY", required: false, productionOnly: false },
  { key: "DEMOCRACY_WORKS_API_BASE_URL", required: false, productionOnly: false },
  { key: "BALLOTPEDIA_API_KEY", required: false, productionOnly: false },
  { key: "BALLOTPEDIA_CANDIDATES_ENDPOINT", required: false, productionOnly: false },
  { key: "STATE_SOS_FEED_CONFIG_JSON", required: false, productionOnly: false },
  { key: "STATE_BOE_FEED_CONFIG_JSON", required: false, productionOnly: false },
  { key: "MUNICIPAL_ELECTION_FEED_CONFIG_JSON", required: false, productionOnly: false },
  { key: "SERPAPI_KEY", required: false, productionOnly: false },
  { key: "ENABLE_CANDIDATE_SERPAPI", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_CANDIDATE_SERPAPI_DEFAULT_SYNC", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "CANDIDATE_SERPAPI_MIN_REFRESH_HOURS", required: false, productionOnly: false },
  { key: "CANDIDATE_INTEL_WEBHOOK_SECRET", required: false, productionOnly: false },
  { key: "MAPBOX_ACCESS_TOKEN", required: false, productionOnly: false },

  {
    // Canonical admin notification address. Used by nonprofit, intake, and targeted
    // routes to alert the operator of new leads, intake submissions, and applications.
    // If missing in production, all admin email notifications silently drop.
    key: "ADMIN_NOTIFICATION_EMAIL",
    required: true,
    productionOnly: true,
  },

  // ── App ──────────────────────────────────────────────────────────────────────
  {
    key: "NEXT_PUBLIC_APP_URL",
    required: true,
    productionOnly: true,
  },

  // ── Feature Flags ────────────────────────────────────────────────────────────
  {
    key: "USE_MOCK_DB",
    required: true,
    productionOnly: false,
    validValues: ["true", "false"],
    dangerIfSet: "true", // mock DB must never be enabled in production
  },
  {
    key: "ADMIN_DEV_BYPASS",
    required: false,
    productionOnly: false,
    dangerIfSet: "true", // warn/error if ADMIN_DEV_BYPASS=true in production
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Validation Runner
// ─────────────────────────────────────────────────────────────────────────────

export function validateEnv(): void {
  // Only validate on the server
  if (typeof window !== "undefined") return;

  const isProduction = process.env.NODE_ENV === "production";
  const missing: string[] = [];
  const invalid: string[] = [];
  const dangers: string[] = [];

  for (const spec of ENV_SPECS) {
    const value = process.env[spec.key];
    const shouldCheck = spec.required && (!spec.productionOnly || isProduction);

    // ── Missing required var ───────────────────────────────────────────────────
    if (shouldCheck && !value) {
      // USE_MOCK_DB has a special check — if absent we treat it as missing
      // (no silent default)
      missing.push(spec.key);
      continue;
    }

    // ── Invalid value ──────────────────────────────────────────────────────────
    if (value && spec.validValues && !spec.validValues.includes(value)) {
      invalid.push(`${spec.key}="${value}" (must be one of: ${spec.validValues.join(", ")})`);
    }

    // ── Dangerous value in production ─────────────────────────────────────────
    if (isProduction && spec.dangerIfSet && value === spec.dangerIfSet) {
      dangers.push(
        `${spec.key}=${spec.dangerIfSet} — this is DANGEROUS in production and exposes protected routes`
      );
    }
  }

  // ── Twilio: at least one sender required ──────────────────────────────────
  const hasTwilioSender =
    process.env.OUTREACH_SMS_FROM_NUMBER ||
    process.env.TWILIO_PHONE_NUMBER ||
    process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (process.env.TWILIO_ACCOUNT_SID && !hasTwilioSender) {
    missing.push("OUTREACH_SMS_FROM_NUMBER, TWILIO_PHONE_NUMBER, or TWILIO_MESSAGING_SERVICE_SID (at least one required)");
  }

  const emailProvider = (process.env.EMAIL_PROVIDER ?? "resend").toLowerCase();
  if (isProduction) {
    if (emailProvider === "resend" && !process.env.RESEND_API_KEY) {
      missing.push("RESEND_API_KEY (required when EMAIL_PROVIDER=resend)");
    }
    if (emailProvider === "mailgun") {
      if (!process.env.MAILGUN_API_KEY) missing.push("MAILGUN_API_KEY (required when EMAIL_PROVIDER=mailgun)");
      if (!process.env.MAILGUN_DOMAIN) missing.push("MAILGUN_DOMAIN (required when EMAIL_PROVIDER=mailgun)");
    }
    if (emailProvider === "postmark" && !process.env.POSTMARK_API_TOKEN) {
      missing.push("POSTMARK_API_TOKEN (required when EMAIL_PROVIDER=postmark)");
    }
    if (emailProvider === "postmark" && !process.env.POSTMARK_FROM_EMAIL) {
      missing.push("POSTMARK_FROM_EMAIL (required when EMAIL_PROVIDER=postmark)");
    }
    if (process.env.ENABLE_POSTMARK_WEBHOOK !== "false") {
      if (!process.env.POSTMARK_WEBHOOK_USER) missing.push("POSTMARK_WEBHOOK_USER (required when Postmark webhook is enabled)");
      if (!process.env.POSTMARK_WEBHOOK_PASSWORD) missing.push("POSTMARK_WEBHOOK_PASSWORD (required when Postmark webhook is enabled)");
    }
  }

  // ── Report dangers first (non-fatal in development, fatal in production) ───
  if (dangers.length > 0) {
    const msg = [
      "",
      "╔══════════════════════════════════════════════════════════════╗",
      "║  ⛔  HOMEREACH PRODUCTION SAFETY VIOLATION                  ║",
      "╚══════════════════════════════════════════════════════════════╝",
      "",
      "The following environment configuration is UNSAFE for production:",
      "",
      ...dangers.map((d) => `  ✗  ${d}`),
      "",
      "Fix these before running in production.",
      "",
    ].join("\n");

    if (isProduction) {
      throw new Error(msg);
    } else {
      console.error(msg);
    }
  }

  // ── Report missing / invalid vars ─────────────────────────────────────────
  if (missing.length > 0 || invalid.length > 0) {
    const lines = [
      "",
      "╔══════════════════════════════════════════════════════════════╗",
      "║  ⛔  HOMEREACH MISSING / INVALID ENVIRONMENT VARIABLES      ║",
      "╚══════════════════════════════════════════════════════════════╝",
      "",
    ];

    if (missing.length > 0) {
      lines.push("Missing required variables:");
      lines.push(...missing.map((k) => `  ✗  ${k}`));
      lines.push("");
    }

    if (invalid.length > 0) {
      lines.push("Invalid values:");
      lines.push(...invalid.map((k) => `  ✗  ${k}`));
      lines.push("");
    }

    lines.push(
      "The application cannot start safely without these variables.",
      "Set them in your .env.local (development) or Vercel environment (production).",
      ""
    );

    const msg = lines.join("\n");
    throw new Error(msg);
  }

  // ── All good ──────────────────────────────────────────────────────────────
  if (!isProduction) {
    console.log("[env] ✅ All environment variables validated successfully");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick accessors (throw if missing at call time)
// ─────────────────────────────────────────────────────────────────────────────

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`[env] Required environment variable "${key}" is not set`);
  return value;
}

export function isProductionMode(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isMockDb(): boolean {
  const val = process.env.USE_MOCK_DB;
  if (!val) {
    throw new Error(
      '[env] USE_MOCK_DB is not set. This variable is required and must be explicitly set to "true" (development) or "false" (production). There is no default to prevent silent data issues.'
    );
  }
  return val === "true";
}
