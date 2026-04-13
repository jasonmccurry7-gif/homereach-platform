import { NextResponse } from "next/server";
import { db, cities, bundles, categories } from "@homereach/db";
import { eq, count } from "drizzle-orm";

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

export async function GET() {
  const checks: CheckResult[] = await Promise.all([

    // ── Database connectivity ──────────────────────────────────────────────
    runCheck("db_connectivity", async () => {
      await db.select({ n: count() }).from(cities).limit(1);
      return "Database reachable";
    }),

    // ── Cities seeded ─────────────────────────────────────────────────────
    runCheck("cities_seeded", async () => {
      const [{ n }] = await db.select({ n: count() }).from(cities).where(eq(cities.isActive, true));
      if (n === 0) throw new Error("No active cities found — funnel will show empty");
      return `${n} active cities`;
    }),

    // ── Bundles seeded ────────────────────────────────────────────────────
    runCheck("bundles_seeded", async () => {
      const [{ n }] = await db.select({ n: count() }).from(bundles).where(eq(bundles.isActive, true));
      if (n === 0) throw new Error("No active bundles — bundle selection page will be empty");
      return `${n} active bundles`;
    }),

    // ── Categories seeded ─────────────────────────────────────────────────
    runCheck("categories_seeded", async () => {
      const [{ n }] = await db.select({ n: count() }).from(categories).where(eq(categories.isActive, true));
      if (n === 0) throw new Error("No active categories — funnel step 2 will be empty");
      return `${n} active categories`;
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
  ]);

  // ── Determine overall status ─────────────────────────────────────────────
  const failed  = checks.filter((c) => c.status === "fail");
  const warned  = checks.filter((c) => c.status === "warn");

  // Revenue-impacting failures → RED
  const redChecks = ["db_connectivity", "env_stripe", "env_twilio", "bundles_seeded"];
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
