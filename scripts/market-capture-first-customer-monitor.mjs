import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const Stripe = requireFromWeb("stripe");
const { createClient } = requireFromWeb("@supabase/supabase-js");

const LOOKBACK_DAYS = Number(process.env.MARKET_CAPTURE_FIRST_CUSTOMER_DAYS ?? 30);
const VALID_MANAGEMENT_FEES = new Set([49900, 74900, 99900]);

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

function isQaLead(lead) {
  const email = String(lead.email ?? "").toLowerCase();
  const businessName = String(lead.business_name ?? "").toLowerCase();
  const notes = String(lead.notes ?? "").toLowerCase();
  const targetArea = String(lead.target_area ?? "").toLowerCase();
  return (
    email.startsWith("qa+") ||
    businessName.includes("homereach qa") ||
    notes.includes("smoke test") ||
    targetArea.includes("internal smoke test") ||
    targetArea.includes("internal test only")
  );
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = String(row[key] ?? "unknown");
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

async function checked(label, operation) {
  const { data, error, count } = await operation;
  if (error) throw new Error(`${label} failed: ${error.message}`);
  return { data: data ?? [], count: count ?? null };
}

const env = loadEnv();
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase service env vars are required for the first customer monitor.");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
  : null;
const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
const critical = [];
const warnings = [];

const { data: leads } = await checked(
  "Market Capture lead lookup",
  supabase
    .from("market_capture_leads")
    .select(
      "id, business_name, contact_name, email, phone, industry, status, payment_status, monthly_management_fee, monthly_ad_budget, stripe_checkout_session_id, stripe_subscription_id, stripe_customer_id, paid_at, target_area, notes, created_at, updated_at",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500),
);

const realLeads = leads.filter((lead) => !isQaLead(lead));
const latestLead = realLeads[0] ?? null;

if (!latestLead) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        phase: "F_first_customer_readiness",
        status: "waiting_for_first_customer",
        lookbackDays: LOOKBACK_DAYS,
        realLeadCount: 0,
        qaLeadCount: leads.length - realLeads.length,
        nextAction: "Ready to monitor the first real Market Capture intake and payment handoff.",
      },
      null,
      2,
    ),
  );
} else {
  if (!VALID_MANAGEMENT_FEES.has(Number(latestLead.monthly_management_fee))) {
    warnings.push("Latest real lead has a non-standard management fee; review before payment handoff.");
  }

const [pipelineResult, taskResult, campaignResult, notesResult] = await Promise.all([
  checked(
    "Market Capture pipeline lookup",
    supabase
      .from("market_capture_pipeline")
      .select("id, stage, status, next_action, last_activity_at, updated_at")
      .eq("market_capture_lead_id", latestLead.id)
      .limit(1),
  ),
  checked(
    "Market Capture task lookup",
    supabase
      .from("market_capture_tasks")
      .select("id, title, status, due_date, completed_at, updated_at")
      .eq("market_capture_lead_id", latestLead.id)
      .limit(100),
  ),
  checked(
    "Market Capture campaign lookup",
    supabase
      .from("market_capture_campaigns")
      .select("id, campaign_name, campaign_status, launch_status, payment_status, approval_status, creative_status, direct_mail_status, next_best_action, created_at, updated_at")
      .eq("market_capture_lead_id", latestLead.id)
      .limit(1),
  ),
  checked(
    "Market Capture notes lookup",
    supabase
      .from("market_capture_notes")
      .select("id, note_type, content, author, created_at")
      .eq("market_capture_lead_id", latestLead.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ),
]);

const pipeline = pipelineResult.data[0] ?? null;
const campaign = campaignResult.data[0] ?? null;

if (!pipeline) critical.push("Latest real lead has no pipeline record.");
if (taskResult.data.length === 0) critical.push("Latest real lead has no generated sales tasks.");

let stripeSession = null;
if (stripe && latestLead.stripe_checkout_session_id) {
  const session = await stripe.checkout.sessions.retrieve(latestLead.stripe_checkout_session_id);
  stripeSession = {
    id: session.id,
    status: session.status,
    paymentStatus: session.payment_status,
    mode: session.mode,
    clientReferenceId: session.client_reference_id,
    customerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
    subscriptionId:
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
  };
  if (session.client_reference_id !== latestLead.id) {
    critical.push("Stripe Checkout Session client reference does not match the Market Capture lead.");
  }
}

if (latestLead.payment_status === "checkout_created" && !latestLead.stripe_checkout_session_id) {
  critical.push("Latest real lead is checkout_created but has no Stripe Checkout Session id.");
}

if (latestLead.payment_status === "paid") {
  if (!latestLead.stripe_subscription_id && !stripeSession?.subscriptionId) {
    critical.push("Paid lead has no Stripe subscription id.");
  }
  if (!campaign) {
    critical.push("Paid lead has no fulfillment campaign record.");
  }
  if (pipeline && !["closed_won", "ready_for_fulfillment", "campaign_setup"].includes(String(pipeline.stage))) {
    warnings.push("Paid lead pipeline stage should be reviewed for fulfillment handoff.");
  }
}

const openTasks = taskResult.data.filter((task) => ["open", "in_progress", "blocked"].includes(String(task.status)));
const overdueTasks = openTasks.filter((task) => task.due_date && new Date(task.due_date).getTime() < Date.now());
if (overdueTasks.length > 0) warnings.push(`${overdueTasks.length} tasks are overdue for the latest real lead.`);

const recommendedNextAction =
  latestLead.payment_status === "payment_required"
    ? "Send or confirm the payment path when the prospect is ready."
    : latestLead.payment_status === "checkout_created"
      ? "Confirm whether the prospect completed Stripe Checkout or needs payment follow-up."
      : latestLead.payment_status === "paid"
        ? "Verify fulfillment campaign setup and client launch handoff."
        : "Review latest lead state and choose the next sales action.";

const result = {
  ok: critical.length === 0,
  phase: "F_first_customer_readiness",
  status: critical.length === 0 ? "ready" : "needs_attention",
  lookbackDays: LOOKBACK_DAYS,
  critical,
  warnings,
  realLeadCount: realLeads.length,
  latestLead: {
    id: latestLead.id,
    businessName: latestLead.business_name,
    contactName: latestLead.contact_name,
    email: latestLead.email,
    industry: latestLead.industry,
    status: latestLead.status,
    paymentStatus: latestLead.payment_status,
    monthlyManagementFee: latestLead.monthly_management_fee,
    monthlyAdBudget: latestLead.monthly_ad_budget,
    createdAt: latestLead.created_at,
    paidAt: latestLead.paid_at,
  },
  pipeline,
  tasks: {
    total: taskResult.data.length,
    byStatus: countBy(taskResult.data, "status"),
    open: openTasks.length,
    overdue: overdueTasks.length,
  },
  campaign,
  stripeSession,
  recentNotes: notesResult.data,
  recommendedNextAction,
};

console.log(JSON.stringify(result, null, 2));
if (critical.length > 0) process.exit(1);
}
