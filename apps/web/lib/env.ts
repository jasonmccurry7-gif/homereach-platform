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
  productionOnly?: boolean; // only required in hosted production
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
  {
    // Optional fixed recurring monthly Price for Market Capture Starter.
    // When missing, the checkout route falls back to safe dynamic price_data.
    key: "STRIPE_MARKET_CAPTURE_PRICE_ID",
    required: false,
    productionOnly: false,
  },
  {
    // Required for signed checkout/session handoff tokens used by public
    // targeted campaign and payment flows. Without this, public quote/checkout
    // paths can fail only after a customer submits a form.
    key: "CHECKOUT_TOKEN_SECRET",
    required: true,
    productionOnly: true,
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
    key: "POSTMARK_ACCOUNT_TOKEN",
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
  { key: "SERPAPI_API_KEY", required: false, productionOnly: false },
  { key: "SERP_API", required: false, productionOnly: false },
  { key: "HUNTER_API_KEY", required: false, productionOnly: false },
  { key: "HUNTER", required: false, productionOnly: false },
  { key: "NEXTAUTH_URL", required: false, productionOnly: false },
  { key: "OUTREACH_TWILIO_MESSAGING_SERVICE_SID", required: false, productionOnly: false },
  { key: "APEX_APPROVED_SENDERS", required: false, productionOnly: false },
  { key: "APEX_APPROVED_SENDER", required: false, productionOnly: false },
  { key: "GOOGLE_SEARCH_CONSOLE_SITE_URL", required: false, productionOnly: false },
  { key: "GOOGLE_SEARCH_CONSOLE_PROPERTY", required: false, productionOnly: false },
  { key: "GSC_SITE_URL", required: false, productionOnly: false },
  { key: "GA4_PROPERTY_ID", required: false, productionOnly: false },
  { key: "GOOGLE_ANALYTICS_PROPERTY_ID", required: false, productionOnly: false },
  { key: "NEXT_PUBLIC_GA_MEASUREMENT_ID", required: false, productionOnly: false },
  { key: "GOOGLE_APPLICATION_CREDENTIALS_JSON", required: false, productionOnly: false },
  { key: "GOOGLE_SERVICE_ACCOUNT_JSON", required: false, productionOnly: false },
  { key: "GOOGLE_SERVICE_ACCOUNT_EMAIL", required: false, productionOnly: false },
  { key: "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", required: false, productionOnly: false },
  { key: "GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL", required: false, productionOnly: false },
  { key: "GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY", required: false, productionOnly: false },
  { key: "GA4_CLIENT_EMAIL", required: false, productionOnly: false },
  { key: "GA4_PRIVATE_KEY", required: false, productionOnly: false },
  { key: "CANVA_CLIENT_ID", required: false, productionOnly: false },
  { key: "CANVA_CLIENT_SECRET", required: false, productionOnly: false },
  { key: "CANVA_REDIRECT_URI", required: false, productionOnly: false },
  { key: "CANVA_TOKEN_ENCRYPTION_KEY", required: false, productionOnly: false },
  { key: "CANVA_ACCESS_TOKEN", required: false, productionOnly: false },
  { key: "GOOGLE_BUSINESS_PROFILE_CLIENT_ID", required: false, productionOnly: false },
  { key: "GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET", required: false, productionOnly: false },
  { key: "GOOGLE_BUSINESS_PROFILE_REDIRECT_URI", required: false, productionOnly: false },
  { key: "GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY", required: false, productionOnly: false },
  { key: "GOOGLE_BUSINESS_PROFILE_ENABLE_PUBLISHING", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "AHREFS_API_TOKEN", required: false, productionOnly: false },
  { key: "SEMRUSH_API_KEY", required: false, productionOnly: false },
  { key: "MOZ_ACCESS_ID", required: false, productionOnly: false },
  { key: "DATAFORSEO_LOGIN", required: false, productionOnly: false },
  { key: "DATAFORSEO_PASSWORD", required: false, productionOnly: false },
  { key: "SEO_BACKLINK_PROVIDER_API_KEY", required: false, productionOnly: false },
  { key: "TAVILY_API_KEY", required: false, productionOnly: false },
  { key: "PROCUREMENT_WEB_SEARCH_ENDPOINT", required: false, productionOnly: false },
  { key: "OPCOPILOT_DOCUMENT_MODEL", required: false, productionOnly: false },
  { key: "SERPAPI_PAUSED", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_CANDIDATE_SERPAPI", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_CANDIDATE_SERPAPI_DEFAULT_SYNC", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "CANDIDATE_SERPAPI_MIN_REFRESH_HOURS", required: false, productionOnly: false },
  { key: "CANDIDATE_INTEL_WEBHOOK_SECRET", required: false, productionOnly: false },
  { key: "MAPBOX_ACCESS_TOKEN", required: false, productionOnly: false },
  { key: "SAM_GOV_API_KEY", required: false, productionOnly: false },
  { key: "SAM_GOV_OPPORTUNITIES_URL", required: false, productionOnly: false },
  { key: "USA_SPENDING_AWARD_URL", required: false, productionOnly: false },
  { key: "ENABLE_CONTRACTOS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_CONTRACTOS_PUBLIC_DASHBOARD", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_CONTRACTOS_DOCUMENT_ANALYZER", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_CONTRACTOS_AI_ANALYSIS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_CONTRACTOS_BILLING", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_GOV_CONTRACTS_SAM_SYNC", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "STRIPE_CONTRACTOS_WATCHTOWER_PRICE_ID", required: false, productionOnly: false },
  { key: "STRIPE_CONTRACTOS_WORKSPACE_PRICE_ID", required: false, productionOnly: false },
  { key: "STRIPE_CONTRACTOS_PROPOSAL_ASSIST_PRICE_ID", required: false, productionOnly: false },
  { key: "STRIPE_CONTRACTOS_MANAGED_BID_PRICE_ID", required: false, productionOnly: false },
  { key: "OPENAI_API_KEY", required: false, productionOnly: false },
  { key: "ANTHROPIC_API_KEY", required: false, productionOnly: false },
  { key: "GROUP_INTELLIGENCE_AI_ENABLED", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_MARKET_CAPTURE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_MARKET_CAPTURE_INTAKE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_MARKET_CAPTURE_PIPELINE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_MARKET_CAPTURE_PAYMENT", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_MARKET_CAPTURE_SALES_DASHBOARD", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_MARKET_CAPTURE_DRAFTS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_MARKET_CAPTURE_FULFILLMENT", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_MARKET_CAPTURE_CHECKLISTS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_MARKET_CAPTURE_APPROVALS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_MARKET_CAPTURE_REPORTING", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_MARKET_CAPTURE_ASSETS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_MARKET_CAPTURE_TEAM_TASKS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_MARKET_CAPTURE_CLIENT_PORTAL", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_AI_COO", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_AI_COO_QUEUE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_AI_COO_RECOMMENDATIONS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_AI_COO_DRAFTS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_AI_COO_SCORES", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_AI_COO_CLIENT_FEED", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_AI_COO_ADMIN_QUEUE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_BUSINESS_MEMORY", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_BUSINESS_MEMORY_TIMELINE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_BUSINESS_MEMORY_INSIGHTS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_BUSINESS_MEMORY_SEARCH", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_BUSINESS_MEMORY_CLIENT_VIEW", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_BUSINESS_MEMORY_ADMIN_VIEW", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_MEMORY_HEALTH_SCORE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_COST_CONTROL_ENGINE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_SUPPLIER_DIRECTORY", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_SAVINGS_TRACKER", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_COST_CONTROL_SCORE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_COST_CONTROL_REPORTING", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_COST_CONTROL_QUEUE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_REPUTATION_ENGINE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_REVIEW_CAMPAIGNS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_REFERRAL_CAMPAIGNS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_TESTIMONIAL_LIBRARY", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_REPUTATION_SCORE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_REPUTATION_REPORTING", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_REPUTATION_QUEUE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_GROWTH_INTELLIGENCE_ENGINE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_GROWTH_OPPORTUNITY_CARDS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_ADMIN_INTELLIGENCE_ENTRIES", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_GROWTH_SCORING", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_GROWTH_CLIENT_MATCHING", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_GROWTH_REPORTING", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_GROWTH_AI_DRAFTS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_META_DRAFTS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_GOOGLE_DRAFTS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_GEOCODING", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_TARGET_VALIDATION", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_REPORTING_IMPORTS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_ATTRIBUTION_LAYER", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_LAUNCH_PACKAGES", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_INTEGRATION_HEALTH", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_DIGITAL_TARGETING", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_GEOFENCE_INTAKE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_AD_API_LAUNCH", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_MANUAL_AD_LAUNCH_MODE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_CLIENT_GEOFENCE_DASHBOARD", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_AI_WEB_ASSISTANT", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_AI_WEB_ASSISTANT_DEMO", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_AI_WEB_ASSISTANT_WIDGET", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "META_ACCESS_TOKEN", required: false, productionOnly: false },
  { key: "META_MARKETING_API_ACCESS_TOKEN", required: false, productionOnly: false },
  { key: "META_AD_ACCOUNT_ID", required: false, productionOnly: false },
  { key: "META_BUSINESS_ID", required: false, productionOnly: false },
  { key: "GOOGLE_ADS_DEVELOPER_TOKEN", required: false, productionOnly: false },
  { key: "GOOGLE_ADS_CLIENT_ID", required: false, productionOnly: false },
  { key: "GOOGLE_ADS_CLIENT_SECRET", required: false, productionOnly: false },
  { key: "GOOGLE_ADS_REFRESH_TOKEN", required: false, productionOnly: false },
  { key: "GOOGLE_ADS_CUSTOMER_ID", required: false, productionOnly: false },
  { key: "GOOGLE_MAPS_API_KEY", required: false, productionOnly: false },

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
  { key: "ENABLE_HOME_REACH_OS", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_REVENUE_ENGINE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_CLIENT_COMMAND_CENTER", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_ADMIN_COMMAND_CENTER", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_DIRECT_MAIL_DIGITAL_BUNDLE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_SUPPLYFY_MODULE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_POLITICAL_MODULE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_REVIEW_ENGINE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_REFERRAL_ENGINE", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_AI_CAMPAIGN_BUILDER", required: false, productionOnly: false, validValues: ["true", "false"] },
  { key: "ENABLE_AI_REVENUE_OFFICER", required: false, productionOnly: false, validValues: ["true", "false"] },
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

function normalizeEnvValue(value: string | undefined): string | undefined {
  const normalized = value
    ?.replace(/^\uFEFF/, "")
    .replace(/^\u00EF\u00BB\u00BF/, "")
    .trim();
  if (!normalized) return normalized;
  if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
    return normalized.slice(1, -1).trim();
  }
  return normalized;
}

export function validateEnv(): void {
  // Only validate on the server
  if (typeof window !== "undefined") return;

  const isProduction =
    process.env.VERCEL_ENV === "production" ||
    process.env.HOMEREACH_ENFORCE_PRODUCTION_ENV === "true";
  const missing: string[] = [];
  const invalid: string[] = [];
  const dangers: string[] = [];

  for (const spec of ENV_SPECS) {
    const value = normalizeEnvValue(process.env[spec.key]);
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
    process.env.TWILIO_MESSAGING_SERVICE_SID ||
    process.env.OUTREACH_TWILIO_MESSAGING_SERVICE_SID;
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
