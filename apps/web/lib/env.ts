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
    required: true,
    productionOnly: true,
  },
  {
    key: "MAILGUN_DOMAIN",
    required: true,
    productionOnly: true,
  },
  {
    key: "MAILGUN_FROM_EMAIL",
    required: false,
    productionOnly: false,
  },

  // ── Notifications ─────────────────────────────────────────────────────────────
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
    process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (process.env.TWILIO_ACCOUNT_SID && !hasTwilioSender) {
    missing.push("TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID (at least one required)");
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
