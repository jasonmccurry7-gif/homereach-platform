import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/command
// APEX Mobile Command Center — Twilio webhook for the private command line.
//
// ARCHITECTURE:
//   Jason's phone → Twilio APEX number (+13306367984)
//   → POST /api/command
//   → Security check (whitelist)
//   → APEX interpretation + expansion
//   → Agent dispatch + execution
//   → SMS response via Twilio
//
// CRITICAL: Only the APEX number routes here.
//   Customer/lead messages use the public number → separate handlers.
// ─────────────────────────────────────────────────────────────────────────────

// ── Approved senders (whitelist) ─────────────────────────────────────────────
// Jason's number always allowed. Add others via APEX_APPROVED_SENDERS env.
const APPROVED_SENDERS = new Set([
  "+13303044916", // Jason McCurry
  ...((process.env.APEX_APPROVED_SENDERS ?? "").split(",").map(s => s.trim()).filter(Boolean)),
]);

// ── Twilio SMS sender ─────────────────────────────────────────────────────────
async function sendSms(to: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.APEX_COMMAND_NUMBER ?? process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !from) return;

  const form = new URLSearchParams();
  form.append("To",   to);
  form.append("From", from);
  form.append("Body", body);

  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );
}

// ── TwiML empty response (prevents Twilio from returning an error) ────────────
function twimlOk() {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let fromNumber = "";
  let messageBody = "";

  try {
    // Parse Twilio form POST
    const text = await req.text();
    const params = new URLSearchParams(text);
    fromNumber  = params.get("From") ?? "";
    messageBody = (params.get("Body") ?? "").trim();
    const toNumber = params.get("To") ?? "";

    // ── Security: verify sender is whitelisted ────────────────────────────────
    if (!APPROVED_SENDERS.has(fromNumber)) {
      console.warn(`[APEX] Rejected command from unauthorized number: ${fromNumber}`);
      // Silent reject — no response to unknown senders
      return twimlOk();
    }

    // ── Verify this is the APEX command number ────────────────────────────────
    const apexNumber = process.env.APEX_COMMAND_NUMBER;
    if (apexNumber && toNumber && toNumber !== apexNumber) {
      // Message came in on the customer number — not for APEX
      return twimlOk();
    }

    if (!messageBody) return twimlOk();

    // ── Log command ───────────────────────────────────────────────────────────
    const db = createServiceClient();
    await db.from("apex_command_log").insert({
      sender:    fromNumber,
      command:   messageBody,
      status:    "received",
      timestamp: new Date().toISOString(),
    }).then(() => {}).catch(() => {}); // non-blocking

    // ── Send immediate acknowledgement ────────────────────────────────────────
    await sendSms(fromNumber, `⚡ APEX received: "${messageBody}"\nProcessing...`);

    // ── Route to APEX for interpretation and execution ────────────────────────
    // Run async — response will be sent back via SMS when complete
    executeApexCommand(messageBody, fromNumber, db).catch(err => {
      console.error("[APEX] execution error:", err);
      sendSms(fromNumber, "Command received but execution failed — check system").catch(() => {});
    });

    return twimlOk();

  } catch (err) {
    console.error("[APEX command] error:", err);
    if (fromNumber && APPROVED_SENDERS.has(fromNumber)) {
      await sendSms(fromNumber, "Command received but execution failed — check system").catch(() => {});
    }
    return twimlOk();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// APEX Command Execution Engine
// ─────────────────────────────────────────────────────────────────────────────

async function executeApexCommand(
  command: string,
  replyTo: string,
  db: ReturnType<typeof createServiceClient>
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";
  const start  = Date.now();

  // ── Step 1: Classify command ──────────────────────────────────────────────
  const classification = classifyCommand(command);

  // ── Step 2: Check if approval required ───────────────────────────────────
  if (classification.requiresApproval) {
    await sendSms(replyTo,
      `⚠️ APEX — Approval Required\n\nCommand: ${command}\n\nThis action (${classification.category}) requires CEO approval.\n\nReply: APPROVE ${command}\nOr: DENY`
    );

    await db.from("apex_command_log").upsert({
      sender:    replyTo,
      command,
      status:    "awaiting_approval",
      category:  classification.category,
      timestamp: new Date().toISOString(),
    }).catch(() => {});
    return;
  }

  // ── Step 3: Expand command into full execution plan ───────────────────────
  const plan = await expandCommand(command, classification, appUrl);

  // ── Step 4: Execute agents ────────────────────────────────────────────────
  const results: string[] = [];
  const errors:  string[] = [];

  for (const agentTask of plan.agentTasks) {
    try {
      const result = await executeAgentTask(agentTask, appUrl);
      results.push(`✓ ${agentTask.agent}: ${result}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      errors.push(`✗ ${agentTask.agent}: ${msg}`);
    }
  }

  const elapsed  = ((Date.now() - start) / 1000).toFixed(1);
  const status   = errors.length === 0 ? "Complete" :
                   results.length === 0 ? "Failed" : "Partial";

  // ── Step 5: Build SMS response ────────────────────────────────────────────
  const lines: string[] = [
    `⚡ APEX Report`,
    ``,
    `Command: ${command}`,
    ``,
    `Interpretation: ${plan.interpretation}`,
    ``,
    `Agents: ${plan.agentTasks.map(t => t.agent).join(", ")}`,
    ``,
    `Actions:`,
    ...results,
    ...errors,
  ];

  if (plan.outcome) {
    lines.push(``, `Result: ${plan.outcome}`);
  }

  if (plan.risks?.length) {
    lines.push(``, `Risks: ${plan.risks.join("; ")}`);
  }

  lines.push(``, `Status: ${status} (${elapsed}s)`);

  // Split into chunks if too long (SMS limit ~1600 chars)
  const fullMsg = lines.join("\n");
  const chunks  = chunkSms(fullMsg, 1400);
  for (const chunk of chunks) {
    await sendSms(replyTo, chunk);
  }

  // Log completion
  await db.from("apex_command_log").upsert({
    sender:    replyTo,
    command,
    status:    status.toLowerCase(),
    category:  classification.category,
    response:  fullMsg.slice(0, 2000),
    elapsed_ms: Date.now() - start,
    timestamp: new Date().toISOString(),
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Classification
// ─────────────────────────────────────────────────────────────────────────────

interface Classification {
  category:         string;
  requiresApproval: boolean;
  urgency:          "high" | "medium" | "low";
  keywords:         string[];
}

function classifyCommand(cmd: string): Classification {
  const lower = cmd.toLowerCase();
  const words = lower.split(/\s+/);

  // Approval-required categories
  const needsApproval =
    /pric|checkout|funnel|webhook|automat|city launch|go.live|deploy|stripe|launch|architect/.test(lower);

  // Category detection
  const category =
    /audit|health|broken|bug|fix|error|status/.test(lower)           ? "System Health" :
    /revenue|money|deal|close|payment|stripe/.test(lower)            ? "Revenue" :
    /lead|prospect|scrape|pipeline|outreach|send|text|email/.test(lower) ? "Outreach" :
    /report|stats|numbers|how many|summary|leaderboard/.test(lower)  ? "Reporting" :
    /city|launch|expand|market|new city/.test(lower)                 ? "Expansion" :
    /pric|found|standard|bundle|spot/.test(lower)                    ? "Pricing" :
    /crm|data|contact|clean|dedup/.test(lower)                       ? "CRM" :
    /kaizen|improve|optimize|better/.test(lower)                     ? "Improvement" :
    "General";

  const urgency =
    /urgent|now|immediately|asap|broken|down|fix/.test(lower) ? "high" :
    /today|push|more|increase/.test(lower)                    ? "medium" : "low";

  return { category, requiresApproval: needsApproval, urgency, keywords: words };
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Expansion Engine
// ─────────────────────────────────────────────────────────────────────────────

interface AgentTask {
  agent:   string;
  action:  string;
  apiPath: string;
  method:  string;
  body?:   Record<string, unknown>;
}

interface ExecutionPlan {
  interpretation: string;
  agentTasks:     AgentTask[];
  outcome?:       string;
  risks?:         string[];
}

async function expandCommand(
  cmd: string,
  classification: Classification,
  appUrl: string
): Promise<ExecutionPlan> {
  const lower = cmd.toLowerCase();

  // ── Pattern-based expansion ───────────────────────────────────────────────

  // "audit" / "what's broken" / "system status"
  if (/audit|what.s broken|system status|health check/.test(lower)) {
    return {
      interpretation: "Full system health audit across all agents and pipelines",
      agentTasks: [
        { agent: "Pulse",      action: "System health scan",     apiPath: "/api/admin/system/agents/pulse",      method: "POST" },
        { agent: "Ledger",     action: "Revenue intelligence",   apiPath: "/api/admin/system/agents/ledger",     method: "POST" },
        { agent: "Kaizen",     action: "Improvement analysis",   apiPath: "/api/admin/system/agents/kaizen",     method: "POST" },
        { agent: "Prospector", action: "Pipeline check",         apiPath: "/api/admin/system/agents/prospector", method: "POST" },
      ],
      outcome: "Full audit initiated — results will arrive shortly",
      risks:   [],
    };
  }

  // "run echo" / "send messages" / "start outreach"
  if (/run echo|send message|start outreach|outreach|blast/.test(lower)) {
    return {
      interpretation: "Trigger Echo agent to send outbound SMS and email to queued leads",
      agentTasks: [
        { agent: "Echo", action: "Outbound messaging run", apiPath: "/api/admin/agents/echo", method: "POST" },
      ],
      outcome: "Echo initiated — messages queued for delivery",
    };
  }

  // "scrape leads" / "get more leads" / "run scraper" / push [city]
  if (/scrape|more lead|run scraper|lead|prospect|push/.test(lower)) {
    const cityMatch = cmd.match(/push\s+(\w+)/i);
    return {
      interpretation: cityMatch
        ? `Scrape and prioritize new leads for ${cityMatch[1]}`
        : "Run full SerpAPI lead scraper across all cities",
      agentTasks: [
        { agent: "Prospector Scraper", action: "Lead generation run", apiPath: "/api/admin/agents/scraper", method: "POST" },
      ],
      outcome: "Scraper triggered — new leads being added",
    };
  }

  // "report" / "stats" / "numbers" / "how are we doing"
  if (/report|stats|numbers|how are we|summary|leaderboard|revenue/.test(lower)) {
    return {
      interpretation: "Generate full performance report — pipeline, revenue, agent activity",
      agentTasks: [
        { agent: "Ledger", action: "Revenue + pipeline report", apiPath: "/api/admin/system/agents/ledger", method: "POST" },
      ],
      outcome: "Report being generated",
    };
  }

  // "run closer" / "follow up" / "convert"
  if (/closer|follow.?up|convert|warm lead/.test(lower)) {
    return {
      interpretation: "Activate Closer agent to follow up with warm leads and move them to payment",
      agentTasks: [
        { agent: "Closer", action: "Revenue activation", apiPath: "/api/admin/agents/closer", method: "POST" },
      ],
      outcome: "Closer running — warm leads being contacted",
    };
  }

  // "kaizen" / "optimize" / "improve"
  if (/kaizen|optim|improv|better/.test(lower)) {
    return {
      interpretation: "Run Kaizen continuous improvement cycle",
      agentTasks: [
        { agent: "Kaizen", action: "Improvement analysis", apiPath: "/api/admin/system/agents/kaizen", method: "POST" },
      ],
      outcome: "Kaizen analysis running",
    };
  }

  // "anchor" / "re-engage" / "dead leads" / "cold leads"
  if (/anchor|re.?engag|dead lead|cold lead/.test(lower)) {
    return {
      interpretation: "Run Anchor agent to re-engage cold and dormant leads",
      agentTasks: [
        { agent: "Anchor", action: "Lead re-engagement", apiPath: "/api/admin/agents/anchor", method: "POST" },
      ],
      outcome: "Anchor re-engaging cold pipeline",
    };
  }

  // "run all" / "full send" / "activate everything"
  if (/run all|full send|activate|everything/.test(lower)) {
    return {
      interpretation: "Full system activation — Echo, Closer, Prospector, Pulse",
      agentTasks: [
        { agent: "Pulse",      action: "System health",   apiPath: "/api/admin/system/agents/pulse",      method: "POST" },
        { agent: "Echo",       action: "Outbound sends",  apiPath: "/api/admin/agents/echo",              method: "POST" },
        { agent: "Closer",     action: "Follow-ups",      apiPath: "/api/admin/agents/closer",            method: "POST" },
        { agent: "Prospector", action: "Pipeline check",  apiPath: "/api/admin/system/agents/prospector", method: "POST" },
      ],
      outcome: "All core agents activated",
      risks:   ["High message volume — monitor delivery rates"],
    };
  }

  // Default: general status check
  return {
    interpretation: `General APEX directive: "${cmd}" — running system check`,
    agentTasks: [
      { agent: "Pulse", action: "System status check", apiPath: "/api/admin/system/agents/pulse", method: "POST" },
    ],
    outcome: "Status check initiated",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Task Executor
// ─────────────────────────────────────────────────────────────────────────────

async function executeAgentTask(task: AgentTask, appUrl: string): Promise<string> {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const url = `${appUrl}${task.apiPath}`;

  const res = await fetch(url, {
    method:  task.method,
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${cronSecret}`,
    },
    body: task.body ? JSON.stringify(task.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`);
  }

  const data = await res.json().catch(() => ({})) as Record<string, unknown>;

  // Extract meaningful result summary
  if (data.summary) {
    const s = data.summary as Record<string, number>;
    return Object.entries(s)
      .filter(([, v]) => typeof v === "number" && v > 0)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ") || "completed";
  }
  if (data.status) return String(data.status);
  return "completed";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function chunkSms(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  let part = 1;
  while (remaining.length > 0) {
    let chunk = remaining.slice(0, maxLen);
    // Try to break at newline
    const lastNl = chunk.lastIndexOf("\n");
    if (lastNl > maxLen * 0.7) chunk = remaining.slice(0, lastNl);
    chunks.push(`(${part}) ${chunk.trim()}`);
    remaining = remaining.slice(chunk.length).trim();
    part++;
  }
  return chunks;
}
