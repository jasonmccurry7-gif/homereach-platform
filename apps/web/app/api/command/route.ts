import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/command — APEX Mobile Command Center
//
// Jason texts +13306367984 (APEX private number) → Twilio POSTs here
// → Security check → APEX interprets → Agents execute → SMS response
// ─────────────────────────────────────────────────────────────────────────────

// ── Approved senders — checked at request time (not module level) ────────────
function getApprovedSenders(): Set<string> {
  const extra = (process.env.APEX_APPROVED_SENDERS ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);
  return new Set(["+13302069639", "+13303044916", ...extra]); // Jason's personal cell + work
}

// ── Send SMS via Twilio ───────────────────────────────────────────────────────
async function sendSms(to: string, body: string): Promise<void> {
  const sid    = process.env.TWILIO_ACCOUNT_SID;
  const token  = process.env.TWILIO_AUTH_TOKEN;
  const from   = process.env.APEX_COMMAND_NUMBER ?? process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) {
    console.error("[APEX] Missing Twilio credentials");
    return;
  }
  // Truncate to 1600 chars (SMS limit)
  const truncated = body.length > 1600 ? body.slice(0, 1590) + "…" : body;
  const form = new URLSearchParams({ To: to, From: from, Body: truncated });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method:  "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error("[APEX] SMS send failed:", err);
  }
}

function twimlOk() {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main webhook handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let fromNumber = "";

  try {
    const text   = await req.text();
    const params = new URLSearchParams(text);
    fromNumber   = params.get("From") ?? "";
    const toNumber    = params.get("To") ?? "";
    const messageBody = (params.get("Body") ?? "").trim();

    // Debug log — always log incoming requests
    console.log(`[APEX] Incoming SMS: From=${fromNumber} To=${toNumber} Body="${messageBody}"`);

    // Security: check approved senders
    const approved = getApprovedSenders();
    if (!approved.has(fromNumber)) {
      console.warn(`[APEX] REJECTED from ${fromNumber} — not whitelisted`);
      return twimlOk(); // silent reject
    }

    if (!messageBody) return twimlOk();

    // Handle APPROVE/DENY responses
    const upper = messageBody.toUpperCase();
    if (upper.startsWith("APPROVE ") || upper === "DENY") {
      await sendSms(fromNumber, upper.startsWith("APPROVE")
        ? `✅ Approved. Executing: ${messageBody.slice(8)}`
        : "❌ Command denied. No action taken."
      );
      return twimlOk();
    }

    // Acknowledge immediately
    await sendSms(fromNumber, `⚡ APEX online. Processing: "${messageBody}"`);

    // Execute async — don't block the Twilio webhook response
    const db = createServiceClient();
    setImmediate(() => {
      executeCommand(messageBody, fromNumber, db).catch(err => {
        console.error("[APEX] execution error:", err);
        sendSms(fromNumber, `⚠️ Command received but execution failed.\nCommand: "${messageBody}"\nCheck Vercel logs.`).catch(() => {});
      });
    });

    return twimlOk();

  } catch (err) {
    console.error("[APEX] Handler error:", err);
    if (fromNumber) {
      await sendSms(fromNumber, "Command received but execution failed — check system").catch(() => {});
    }
    return twimlOk();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// APEX Command Engine
// ─────────────────────────────────────────────────────────────────────────────

async function executeCommand(
  cmd: string,
  replyTo: string,
  db: ReturnType<typeof createServiceClient>
): Promise<void> {
  const appUrl = "https://home-reach.com"; // always use production URL
  const start  = Date.now();
  const lower  = cmd.toLowerCase();

  // Log command
  await db.from("apex_command_log").insert({
    sender: replyTo, command: cmd, status: "processing",
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  // ── Approval gate ─────────────────────────────────────────────────────────
  if (/pric|checkout|funnel|stripe|city.?launch|webhook|automat.*change/.test(lower)) {
    await sendSms(replyTo,
      `⚠️ APEX — CEO Approval Required\n\nCommand: "${cmd}"\nCategory: High-risk change\n\nReply: APPROVE ${cmd}\nTo cancel: DENY`
    );
    await db.from("apex_command_log").update({ status: "awaiting_approval" })
      .eq("command", cmd).eq("sender", replyTo).catch(() => {});
    return;
  }

  // ── Command routing ───────────────────────────────────────────────────────
  const cronHeaders = {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${process.env.CRON_SECRET ?? ""}`,
  };

  const routes: { label: string; url: string; when: RegExp }[] = [
    { label: "Echo (outbound messaging)",    url: `${appUrl}/api/admin/agents/echo`,              when: /echo|send|outreach|message|text|email/ },
    { label: "Closer (follow-ups)",          url: `${appUrl}/api/admin/agents/closer`,            when: /closer|follow.?up|convert|warm/ },
    { label: "Anchor (re-engagement)",       url: `${appUrl}/api/admin/agents/anchor`,            when: /anchor|re.?engag|dead|cold/ },
    { label: "Scraper (lead generation)",    url: `${appUrl}/api/admin/agents/scraper`,           when: /scrape|lead|prospect|pull|more.?lead/ },
    { label: "Pulse (system health)",        url: `${appUrl}/api/admin/system/agents/pulse`,      when: /pulse|health|status|check|monitor/ },
    { label: "Ledger (revenue)",             url: `${appUrl}/api/admin/system/agents/ledger`,     when: /ledger|revenue|money|report|earn/ },
    { label: "Kaizen (improvement)",         url: `${appUrl}/api/admin/system/agents/kaizen`,     when: /kaizen|improv|optim|better|fix/ },
    { label: "Prospector (pipeline)",        url: `${appUrl}/api/admin/system/agents/prospector`, when: /prospector|pipeline|queue|low.?lead/ },
  ];

  // "audit" / "run all" → run multiple
  const isAudit  = /audit|what.?broken|full.?scan|all.?agent|run.?all/.test(lower);
  const isReport = /report|stats|number|summary|how.?are|revenue/.test(lower);

  let agentsToRun: typeof routes = [];

  if (isAudit) {
    agentsToRun = routes.filter(r => /pulse|ledger|kaizen|prospector/.test(r.url));
  } else if (isReport) {
    agentsToRun = routes.filter(r => /ledger/.test(r.url));
  } else {
    // Match by keyword
    agentsToRun = routes.filter(r => r.when.test(lower));
    // Default: pulse status check
    if (agentsToRun.length === 0) {
      agentsToRun = routes.filter(r => /pulse/.test(r.url));
    }
  }

  // ── Execute agents ────────────────────────────────────────────────────────
  const results: string[] = [];
  const errors:  string[] = [];

  for (const agent of agentsToRun) {
    try {
      const res = await fetch(agent.url, { method: "POST", headers: cronHeaders });
      if (!res.ok) {
        errors.push(`✗ ${agent.label}: HTTP ${res.status}`);
        continue;
      }
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      const summary = extractSummary(data);
      results.push(`✓ ${agent.label}: ${summary}`);
    } catch (err) {
      errors.push(`✗ ${agent.label}: ${err instanceof Error ? err.message.slice(0, 60) : "failed"}`);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const status  = errors.length === 0 ? "Complete" : results.length > 0 ? "Partial" : "Failed";

  // ── Build SMS response ────────────────────────────────────────────────────
  const interpretation = interpretCommand(cmd, agentsToRun.map(a => a.label));

  const lines = [
    `⚡ APEX Report`,
    ``,
    `Command: "${cmd}"`,
    `Interpretation: ${interpretation}`,
    ``,
    `Agents (${agentsToRun.length}):`,
    ...agentsToRun.map(a => `• ${a.label}`),
    ``,
    `Actions:`,
    ...results,
    ...errors,
    ``,
    `Status: ${status} (${elapsed}s)`,
  ];

  // Split long responses into multiple SMS
  const fullMsg = lines.join("\n");
  const chunks = chunkMessage(fullMsg, 1400);
  for (const chunk of chunks) await sendSms(replyTo, chunk);

  // Update log
  await db.from("apex_command_log").update({
    status:    status.toLowerCase(),
    response:  fullMsg.slice(0, 2000),
    elapsed_ms: Date.now() - start,
  }).eq("command", cmd).eq("sender", replyTo).catch(() => {});
}

function extractSummary(data: Record<string, unknown>): string {
  if (data.summary && typeof data.summary === "object") {
    const s = data.summary as Record<string, number>;
    const parts = Object.entries(s).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`);
    return parts.length > 0 ? parts.join(", ") : "done";
  }
  if (data.status) return String(data.status);
  if (data.ok)     return "done";
  return "completed";
}

function interpretCommand(cmd: string, agents: string[]): string {
  const lower = cmd.toLowerCase();
  if (/audit|scan/.test(lower))           return "Full system audit across all core agents";
  if (/push.*medina|push.*wooster/.test(lower)) return `Aggressive outreach in ${cmd.split(" ")[1]}`;
  if (/report|stats/.test(lower))         return "Revenue and pipeline intelligence report";
  if (/echo|send|outreach/.test(lower))   return "Outbound messaging run via Echo";
  if (/fix|broken/.test(lower))           return "System scan and diagnostic check";
  if (agents.length === 1)                return `Delegated to ${agents[0]}`;
  return `Orchestrating ${agents.length} agents`;
}

function chunkMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  let i = 1;
  while (remaining.length > 0) {
    const cut = remaining.slice(0, maxLen);
    const nl  = cut.lastIndexOf("\n");
    const chunk = nl > maxLen * 0.6 ? remaining.slice(0, nl) : cut;
    chunks.push(i > 1 ? `(${i}) ${chunk.trim()}` : chunk.trim());
    remaining = remaining.slice(chunk.length).trimStart();
    i++;
  }
  return chunks;
}
