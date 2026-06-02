import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

const HARDENING_DATE = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const APPROVAL_GATE =
  "Human approval required before outbound, publishing, bidding, pricing, payment, procurement, political, legal, or external-platform action.";

const hardeningAssignments = [
  {
    area: "orchestration",
    assignedAgent: "Orchestrator Agent",
    priority: "high",
    expectedOutput:
      "System dependency map, duplicate-system check, approval-gate verification, and phase-by-phase hardening queue.",
  },
  {
    area: "qa-system-health",
    assignedAgent: "QA / System Health Agent",
    priority: "high",
    expectedOutput:
      "Route, button, form, auth, mobile, API guard, loading state, error state, and smoke-test hardening report.",
  },
  {
    area: "revenue-integrity",
    assignedAgent: "Data / Revenue Agent",
    priority: "high",
    expectedOutput:
      "Revenue-path audit covering Stripe, intake, proposals, follow-up tasks, attribution, and stuck deal risks.",
  },
  {
    area: "outreach-deliverability",
    assignedAgent: "Outreach Agent",
    priority: "high",
    expectedOutput:
      "Email/SMS/DM approval, opt-out, suppression, throttling, sender variation, and A2P readiness hardening report.",
  },
  {
    area: "follow-up-recovery",
    assignedAgent: "Follow-Up Agent",
    priority: "medium",
    expectedOutput:
      "Stale opportunity queue, safe follow-up recommendations, approval notes, and sender-persona variation checks.",
  },
  {
    area: "political-compliance",
    assignedAgent: "Political Campaign Agent",
    priority: "high",
    expectedOutput:
      "Political dashboard compliance audit, candidate-agent activation plan, map/strategy QA, and no-prohibited-targeting verification.",
  },
  {
    area: "procurement-supplyfy",
    assignedAgent: "Procurement / Supplyfy Agent",
    priority: "high",
    expectedOutput:
      "Supplyfy data activation plan, smart-buy approval gate audit, savings math verification, and vendor/order safety report.",
  },
  {
    area: "sam-gov-contracts",
    assignedAgent: "SAM.gov Contract Agent",
    priority: "high",
    expectedOutput:
      "SAM.gov sync, bid room, subcontractor, compliance checklist, and no-autonomous-submission hardening report.",
  },
  {
    area: "technical-seo",
    assignedAgent: "Technical SEO Agent",
    priority: "medium",
    expectedOutput:
      "Crawlability, metadata, structured data, internal linking, sitemap, canonical, and public route SEO hardening list.",
  },
  {
    area: "local-seo-authority",
    assignedAgent: "Local SEO Authority Agent",
    priority: "medium",
    expectedOutput:
      "Local visibility, GBP, reputation, listings, city/service-page, and no-fake-local-claim hardening report.",
  },
  {
    area: "content-growth",
    assignedAgent: "Content Strategy Agent",
    priority: "medium",
    expectedOutput:
      "Content performance, hook memory, pain point library, repurposing, and organic-to-paid approval hardening plan.",
  },
  {
    area: "creative-copy",
    assignedAgent: "Creative Copy Agent",
    priority: "medium",
    expectedOutput:
      "Public offer copy, CTA consistency, claim discipline, approval-ready creative copy, and emotional positioning audit.",
  },
  {
    area: "design-ux",
    assignedAgent: "Design Brief Agent",
    priority: "medium",
    expectedOutput:
      "Premium UI, mobile layout, visual hierarchy, dashboard simplicity, and approval-flow design hardening notes.",
  },
  {
    area: "ai-memory-assets",
    assignedAgent: "Research Agent",
    priority: "medium",
    expectedOutput:
      "AI Assets, business context, source examples, prompt chains, output review, and memory-source quality audit.",
  },
  {
    area: "agent-execution",
    assignedAgent: "QA / System Health Agent",
    priority: "high",
    expectedOutput:
      "Agent mini-apps, execution queue, connector permissions, activity ledger, and human takeover hardening report.",
  },
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value.replace(/^\uFEFF/, "").trim();
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

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function createSupabase(env) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function deploy() {
  const env = loadEnv();
  const supabase = createSupabase(env);
  if (!supabase) {
    console.log(JSON.stringify({ ok: false, reason: "Supabase service env unavailable." }, null, 2));
    process.exitCode = 1;
    return;
  }

  const created = [];
  const skipped = [];

  for (const assignment of hardeningAssignments) {
    const taskId = `HARDEN-${HARDENING_DATE}-${slug(assignment.area)}`;
    const { data: existing, error: existingError } = await supabase
      .from("ai_workforce_tasks")
      .select("id,task_id,status")
      .eq("task_id", taskId)
      .maybeSingle();

    if (existingError) {
      skipped.push({ taskId, reason: existingError.message });
      continue;
    }
    if (existing) {
      skipped.push({ taskId, reason: `already_exists:${existing.status}` });
      continue;
    }

    const insertPayload = {
      task_id: taskId,
      workflow_name: "Full Scale Hardening Agent Sweep",
      requestor: "HomeReach Orchestrator Agent",
      assigned_agent: assignment.assignedAgent,
      priority: assignment.priority,
      status: "assigned",
      input_path: "AGENTS.md; ai-workforce/reports; existing dashboard/API/database state",
      input_data: {
        hardening_area: assignment.area,
        approval_gate: APPROVAL_GATE,
        no_external_action_taken: true,
        safe_scope:
          "Audit, summarize, recommend, draft, verify, and prepare review-ready actions only. Do not execute customer-facing or external actions.",
      },
      expected_output: assignment.expectedOutput,
      dependencies: [
        "AGENTS.md approval rules",
        "AI Assets Command Center",
        "Existing dashboards and ledgers",
        "Human approval gate",
        "Current full-system audit report",
      ],
      approval_required: true,
      related_opportunity: assignment.area,
      completion_notes:
        "Created by deploy-hardening-agent-sweep. Internal review task only; no outbound, publishing, payments, bids, orders, or political messages were executed.",
    };

    const { data: inserted, error: insertError } = await supabase
      .from("ai_workforce_tasks")
      .insert(insertPayload)
      .select("id,task_id,assigned_agent,status")
      .single();

    if (insertError || !inserted) {
      skipped.push({ taskId, reason: insertError?.message ?? "insert_failed" });
      continue;
    }

    await supabase.from("ai_workforce_activity_logs").insert({
      task_id: inserted.id,
      task_public_id: inserted.task_id,
      agent_name: "Orchestrator Agent",
      event_type: "hardening_agent_deployed",
      status: "assigned",
      summary: `Assigned ${inserted.assigned_agent} to full-scale hardening area: ${assignment.area}.`,
      details: {
        assignment,
        approval_gate: APPROVAL_GATE,
        no_external_action_taken: true,
      },
      approval_status: "needs_review",
    });

    created.push(inserted);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        runDate: HARDENING_DATE,
        created,
        skippedExistingOrFailed: skipped,
      },
      null,
      2,
    ),
  );
}

await deploy();
