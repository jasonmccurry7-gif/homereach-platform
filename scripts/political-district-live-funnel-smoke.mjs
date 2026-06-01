import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

const DEFAULT_BASE_URL = "https://www.home-reach.com";
const REQUEST_TIMEOUT_MS = Number(process.env.POLITICAL_DISTRICT_SMOKE_TIMEOUT_MS ?? 30000);

class SmokeFailure extends Error {}

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

function extractServerActionName(html) {
  const match = html.match(/name="(\$ACTION_ID_[^"]+)"/);
  return match?.[1] ?? null;
}

function extractRefFromLocation(location) {
  if (!location) return null;
  try {
    const url = new URL(location, "https://www.home-reach.com");
    return url.searchParams.get("ref");
  } catch {
    return null;
  }
}

async function runDbChecks({ env, email, ref }) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      skipped: true,
      reason: "Supabase env vars unavailable locally; route and form checks still ran.",
    };
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let query = supabase
    .from("political_outreach_leads")
    .select("id, contact_email, status, do_not_contact, strategy_snapshot, notes")
    .eq("contact_email", email)
    .order("created_at", { ascending: false })
    .limit(1);

  if (ref) {
    query = supabase
      .from("political_outreach_leads")
      .select("id, contact_email, status, do_not_contact, strategy_snapshot, notes")
      .eq("id", ref)
      .limit(1);
  }

  const { data, error } = await query;
  if (error) throw new Error(`political_outreach_leads lookup failed: ${error.message}`);
  const lead = data?.[0];
  assert(lead, "Political outreach lead was not found in Supabase.", { email, ref });

  const metadata = lead.strategy_snapshot?.political_district_saturation;
  assert(metadata?.enabled === true, "Political District Saturation metadata was not saved.", {
    strategySnapshot: lead.strategy_snapshot ?? null,
  });
  assert(
    Array.isArray(metadata.geographies) && metadata.geographies.length >= 1,
    "Political District Saturation geographies were not saved.",
    { metadata },
  );
  assert(
    Number(metadata.readinessScore ?? 0) >= 85,
    "Political District Saturation readiness score is too low for the smoke fixture.",
    { metadata },
  );
  assert(metadata.deadlineStatus === "feasible", "Political District deadline status was not feasible.", {
    metadata,
  });
  assert(
    Array.isArray(metadata.policyWarnings) && metadata.policyWarnings.length === 0,
    "Political District smoke fixture produced policy warnings.",
    { metadata },
  );
  assert(
    lead.notes?.includes("Political District Saturation") || lead.notes?.includes("political"),
    "Political District summary was not attached to notes.",
    { notes: lead.notes },
  );

  await supabase
    .from("political_outreach_leads")
    .update({
      status: "disqualified",
      do_not_contact: true,
      notes: `${lead.notes ?? ""}\n\nQA smoke archived: Political District Saturation live funnel verification.`,
    })
    .eq("id", lead.id);

  return {
    skipped: false,
    lead: {
      id: lead.id,
      status: "disqualified",
      geographyCount: metadata.geographies.length,
      readinessScore: metadata.readinessScore,
      deadlineStatus: metadata.deadlineStatus,
      policyWarningCount: metadata.policyWarnings.length,
    },
  };
}

async function main() {
  const env = loadEnv();
  const baseUrl = normalizeBaseUrl(env.POLITICAL_DISTRICT_SMOKE_BASE_URL ?? env.SMOKE_BASE_URL);
  const qaId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `qa+political-district-${qaId}@home-reach.com`;
  const planUrl = `${baseUrl}/political/plan`;

  const page = await fetchWithTimeout(planUrl, { method: "GET", redirect: "manual" }, "Political plan page");
  const html = await page.text();
  assert(page.status === 200, "Political plan page did not return 200.", { status: page.status });
  assert(
    html.includes("Political District Saturation details"),
    "Political plan page does not include Political District Saturation details.",
  );

  const actionName = extractServerActionName(html);
  assert(actionName, "Could not find Next.js server action id on political plan page.");

  const form = new FormData();
  form.set(actionName, "");
  form.set("contactName", "HomeReach Political QA");
  form.set("contactEmail", email);
  form.set("contactPhone", "+10000000000");
  form.set("organizationName", "HomeReach QA Committee");
  form.set("candidateName", "HomeReach QA Candidate");
  form.set("officeSought", "City Council");
  form.set("state", "OH");
  form.set("geographyType", "district");
  form.set("geographyValue", "QA District 9");
  form.set("districtType", "local");
  form.set("electionDate", "2026-11-03");
  form.set("budgetEstimate", "2500");
  form.set("desiredDropCount", "2");
  form.set("targetGeographies", "QA District 9 | district | board of elections smoke fixture | primary | internal geography-only test");
  form.set("districtSource", "Board of elections smoke fixture");
  form.set("dropWindow", "Two weeks before election day");
  form.set("mailQuantityEstimate", "10000");
  form.set("campaignAudienceSource", "geography_only");
  form.set("campaignDisclaimerStatus", "needs_review");
  form.set("districtSourceConfirmed", "on");
  form.set("politicalComplianceAcknowledged", "on");
  form.set("noSensitiveTargetingAcknowledged", "on");
  form.set("notes", "Internal QA political district saturation smoke test. Do not contact this record.");
  form.set("consentMarketing", "on");
  form.set("plannerIntent", "request_review");

  const submitted = await fetchWithTimeout(
    planUrl,
    {
      method: "POST",
      body: form,
      redirect: "manual",
    },
    "Political plan submit",
  );
  const location = submitted.headers.get("location");
  assert(
    [303, 302, 307].includes(submitted.status) && Boolean(location?.includes("/political/thanks")),
    "Political plan form did not redirect to the thanks page.",
    {
      status: submitted.status,
      location,
      body: (await submitted.text()).slice(0, 400),
    },
  );

  const ref = extractRefFromLocation(location);
  const dbChecks = await runDbChecks({ env, email, ref });

  console.log(
    JSON.stringify(
      {
        ok: true,
        phase: "political_district_saturation_live_funnel",
        baseUrl,
        planPage: { status: page.status },
        submit: { status: submitted.status, location, ref },
        dbChecks,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  if (error instanceof SmokeFailure) {
    process.exitCode = 1;
    return;
  }

  console.error(
    JSON.stringify(
      {
        ok: false,
        message: "Political District Saturation live funnel smoke failed.",
        error: {
          name: error?.name ?? "Error",
          message: error?.message ?? String(error),
        },
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
