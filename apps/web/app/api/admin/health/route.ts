import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/health
// System health check — called by monitoring schedule and CEO dashboard.
// Returns GREEN / YELLOW / RED with per-check breakdown.
//
// GREEN  = all critical paths passing
// YELLOW = non-revenue issues detected
// RED    = revenue-impacting failure
// ─────────────────────────────────────────────────────────────────────────────

type CheckResult = {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
  ms: number;
};

async function runCheck(
  name: string,
  fn: () => Promise<string>
): Promise<CheckResult> {
  const start = Date.now();
  try {
    const message = await fn();
    return { name, status: "pass", message, ms: Date.now() - start };
  } catch (err) {
    return {
      name,
      status: "fail",
      message: err instanceof Error ? err.message : String(err),
      ms: Date.now() - start,
    };
  }
}

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function missingEnv(names: string[]) {
  return names.filter((name) => !hasEnv(name));
}

function readinessCheck(
  name: string,
  required: string[],
  readyMessage: string,
  blockedMessage: (missing: string[]) => string
): CheckResult {
  const start = Date.now();
  const missing = missingEnv(required);
  return {
    name,
    status: missing.length === 0 ? "pass" : "warn",
    message: missing.length === 0 ? readyMessage : blockedMessage(missing),
    ms: Date.now() - start,
  };
}

export async function GET() {
  const supabase = createServiceClient();

  const checks: CheckResult[] = await Promise.all([

    // ── Database connectivity ──────────────────────────────────────────────
    runCheck("db_connectivity", async () => {
      const { error } = await supabase.from("cities").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return "Database reachable";
    }),

    // ── Cities seeded ─────────────────────────────────────────────────────
    runCheck("cities_seeded", async () => {
      const { count, error } = await supabase
        .from("cities").select("id", { count: "exact", head: true }).eq("is_active", true);
      if (error) throw new Error(error.message);
      if (!count || count === 0) throw new Error("No active cities found — funnel will show empty");
      return `${count} active cities`;
    }),

    // ── Bundles seeded ────────────────────────────────────────────────────
    runCheck("bundles_seeded", async () => {
      const { count, error } = await supabase
        .from("bundles").select("id", { count: "exact", head: true }).eq("is_active", true);
      if (error) throw new Error(error.message);
      if (!count || count === 0) throw new Error("No active bundles — bundle selection page will be empty");
      return `${count} active bundles`;
    }),

    // ── Categories seeded ─────────────────────────────────────────────────
    runCheck("categories_seeded", async () => {
      const { count, error } = await supabase
        .from("categories").select("id", { count: "exact", head: true }).eq("is_active", true);
      if (error) throw new Error(error.message);
      if (!count || count === 0) throw new Error("No active categories — funnel step 2 will be empty");
      return `${count} active categories`;
    }),

    // ── Sales leads present ───────────────────────────────────────────────
    runCheck("leads_seeded", async () => {
      const { count, error } = await supabase
        .from("sales_leads").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return `${count ?? 0} total leads in CRM`;
    }),

    // ── Env vars: Stripe ──────────────────────────────────────────────────
    runCheck("env_stripe", async () => {
      if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY missing");
      if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET missing");
      return "Stripe env vars present";
    }),

    // ── Env vars: Twilio ──────────────────────────────────────────────────
    runCheck("env_twilio", async () => {
      if (!process.env.TWILIO_ACCOUNT_SID) throw new Error("TWILIO_ACCOUNT_SID missing");
      if (!process.env.TWILIO_AUTH_TOKEN) throw new Error("TWILIO_AUTH_TOKEN missing");
      return "Twilio env vars present";
    }),

    // ── Env vars: Mailgun ─────────────────────────────────────────────────
    runCheck("env_mailgun", async () => {
      if (!process.env.MAILGUN_API_KEY) throw new Error("MAILGUN_API_KEY missing");
      if (!process.env.MAILGUN_DOMAIN) throw new Error("MAILGUN_DOMAIN missing");
      return "Mailgun env vars present";
    }),

    // ── Env vars: Supabase ────────────────────────────────────────────────
    runCheck("env_supabase", async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing");
      if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY missing");
      return "Supabase env vars present";
    }),

    runCheck("env_postmark", async () => {
      if (!process.env.POSTMARK_API_TOKEN) throw new Error("POSTMARK_API_TOKEN missing");
      if (!process.env.POSTMARK_FROM_EMAIL) throw new Error("POSTMARK_FROM_EMAIL missing");
      if (process.env.ENABLE_POSTMARK_WEBHOOK !== "false") {
        if (!process.env.POSTMARK_WEBHOOK_USER) throw new Error("POSTMARK_WEBHOOK_USER missing");
        if (!process.env.POSTMARK_WEBHOOK_PASSWORD) throw new Error("POSTMARK_WEBHOOK_PASSWORD missing");
      }
      return "Postmark sending and webhook env vars present";
    }),

    readinessCheck(
      "env_openai",
      ["OPENAI_API_KEY"],
      "OpenAI API key present for live AI drafting.",
      (missing) => `AI drafting can use deterministic fallbacks until ${missing.join(", ")} is configured.`
    ),

    readinessCheck(
      "env_sam_gov",
      ["SAM_GOV_API_KEY"],
      "SAM.gov API key present for government contract opportunity sync.",
      (missing) => `SAM.gov sync remains disabled until ${missing.join(", ")} is configured.`
    ),

    readinessCheck(
      "env_canva",
      ["CANVA_CLIENT_ID", "CANVA_CLIENT_SECRET", "CANVA_REDIRECT_URI", "CANVA_TOKEN_ENCRYPTION_KEY"],
      "Canva OAuth env vars present for connected creative workflows.",
      (missing) => `Canva stays in manual/template mode until ${missing.join(", ")} is configured.`
    ),

    readinessCheck(
      "env_google_business_profile",
      [
        "GOOGLE_BUSINESS_PROFILE_CLIENT_ID",
        "GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET",
        "GOOGLE_BUSINESS_PROFILE_REDIRECT_URI",
        "GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY",
      ],
      "Google Business Profile OAuth env vars present for connected local visibility sync.",
      (missing) => `Google Business Profile remains draft/manual until ${missing.join(", ")} is configured.`
    ),

    readinessCheck(
      "env_meta_connected_publishing",
      ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI", "META_TOKEN_ENCRYPTION_KEY"],
      "Meta OAuth env vars present for approval-gated connected publishing.",
      (missing) => `Meta connected publishing stays disabled or manual until ${missing.join(", ")} is configured.`
    ),
  ]);

  // ── Determine overall status ─────────────────────────────────────────────
  const failed  = checks.filter((c) => c.status === "fail");
  const warned  = checks.filter((c) => c.status === "warn");

  // Revenue-impacting failures → RED
  const redChecks = ["db_connectivity", "env_stripe", "env_twilio", "bundles_seeded", "leads_seeded"];
  const isRed = failed.some((c) => redChecks.includes(c.name));

  const overall: "GREEN" | "YELLOW" | "RED" =
    isRed ? "RED" :
    failed.length > 0 ? "YELLOW" :
    warned.length > 0 ? "YELLOW" :
    "GREEN";

  return NextResponse.json({
    status: overall,
    timestamp: new Date().toISOString(),
    summary: {
      total:  checks.length,
      passed: checks.filter((c) => c.status === "pass").length,
      failed: failed.length,
      warned: warned.length,
    },
    checks,
    failedChecks:  failed.map((c) => ({ name: c.name, message: c.message })),
  });
}
