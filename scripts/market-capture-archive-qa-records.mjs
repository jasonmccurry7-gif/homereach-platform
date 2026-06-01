import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const lookbackDays = Number(process.env.MARKET_CAPTURE_QA_ARCHIVE_DAYS ?? 30);

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

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, message, ...details }, null, 2));
  process.exit(1);
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
    notes.includes("internal phase") ||
    targetArea.includes("internal smoke test") ||
    targetArea.includes("internal test only")
  );
}

async function checked(label, operation) {
  const { data, error, count } = await operation;
  if (error) throw new Error(`${label} failed: ${error.message}`);
  return { data: data ?? [], count: count ?? null };
}

const env = loadEnv();
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  fail("Supabase service env vars are required to archive QA records.");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
const now = new Date().toISOString();

const { data: leads } = await checked(
  "Market Capture QA lead lookup",
  supabase
    .from("market_capture_leads")
    .select("id, business_name, email, notes, target_area, status, payment_status, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000),
);

const qaLeads = leads.filter(isQaLead);
const leadIds = qaLeads.map((lead) => lead.id);

if (leadIds.length === 0) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        archivedLeadCount: 0,
        message: "No QA Market Capture records found in the lookback window.",
      },
      null,
      2,
    ),
  );
} else if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        wouldArchiveLeadCount: leadIds.length,
        leads: qaLeads.map((lead) => ({
          id: lead.id,
          businessName: lead.business_name,
          email: lead.email,
          status: lead.status,
          paymentStatus: lead.payment_status,
          createdAt: lead.created_at,
        })),
      },
      null,
      2,
    ),
  );
} else {
  const archiveNote = "Archived QA smoke-test record after production verification. No customer action required.";

  const [taskUpdate, pipelineUpdate, leadUpdate, campaignUpdate, noteInsert] = await Promise.all([
    supabase
      .from("market_capture_tasks")
      .update({
        status: "cancelled",
        completed_at: now,
        updated_at: now,
        notes: archiveNote,
      })
      .in("market_capture_lead_id", leadIds)
      .in("status", ["open", "in_progress", "blocked"]),
    supabase
      .from("market_capture_pipeline")
      .update({
        status: "archived",
        next_action: "Archived QA smoke-test record",
        notes: archiveNote,
        last_activity_at: now,
        updated_at: now,
      })
      .in("market_capture_lead_id", leadIds),
    supabase
      .from("market_capture_leads")
      .update({
        status: "archived",
        updated_at: now,
      })
      .in("id", leadIds),
    supabase
      .from("market_capture_campaigns")
      .update({
        campaign_status: "closed",
        launch_status: "complete",
        next_best_action: "Archived QA smoke-test record",
        notes: archiveNote,
        updated_at: now,
      })
      .in("market_capture_lead_id", leadIds),
    supabase.from("market_capture_notes").insert(
      leadIds.map((leadId) => ({
        market_capture_lead_id: leadId,
        author: "phase_e_monitor",
        note_type: "activity",
        content: archiveNote,
        metadata: { archived_at: now, reason: "qa_smoke_test_cleanup" },
      })),
    ),
  ]);

  const error =
    taskUpdate.error ??
    pipelineUpdate.error ??
    leadUpdate.error ??
    campaignUpdate.error ??
    noteInsert.error;
  if (error) {
    fail("QA archive update failed.", { error: error.message });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        archivedLeadCount: leadIds.length,
        archivedLeadIds: leadIds,
        taskStatus: "cancelled",
        leadStatus: "archived",
        pipelineStatus: "archived",
      },
      null,
      2,
    ),
  );
}
