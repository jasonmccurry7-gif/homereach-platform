import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow up to 60s for agent execution

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/command — APEX Mobile Command Center
//
// Jason texts +13306367984 (APEX private number) → Twilio POSTs here
// Executes synchronously and returns the full response in TwiML.
// setImmediate/background tasks don't work in Vercel serverless.
// ─────────────────────────────────────────────────────────────────────────────

function getApprovedSenders(): Set<string> {
  const extra = (process.env.APEX_APPROVED_SENDERS ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);
  return new Set(["+13302069639", "+13303044916", ...extra]);
}

function twimlMessage(text: string) {
  // Escape XML special chars
  const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Truncate to 1600 chars
  const body = safe.length > 1590 ? safe.slice(0, 1587) + "..." : safe;
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${body}</Message></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } }
  );
}

function twimlOk() {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } }
  );
}

export async function POST(req: Request) {
  try {
    const text   = await req.text();
    const params = new URLSearchParams(text);
    const from   = params.get("From") ?? "";
    const to     = params.get("To")   ?? "";
    const body   = (params.get("Body") ?? "").trim();

    console.log(`[APEX] SMS in: From=${from} To=${to} Body="${body}"`);

    // Security gate
    if (!getApprovedSenders().has(from)) {
      console.warn(`[APEX] Rejected: ${from}`);
      return twimlOk();
    }

    if (!body) return twimlOk();

    // APPROVE / DENY flow
    const upper = body.toUpperCase();
    if (upper.startsWith("APPROVE ")) {
      return twimlMessage(`✅ Approved. Executing: ${body.slice(8)}\n\nProcessing now...`);
    }
    if (upper === "DENY") {
      return twimlMessage("❌ Command denied. No action taken.");
    }

    // Execute APEX command and return result in TwiML
    const db     = createServiceClient();
    const result = await executeCommand(body, db);
    return twimlMessage(result);

  } catch (err) {
    console.error("[APEX] Error:", err);
    return twimlMessage("⚠️ APEX: Command failed — check Vercel logs.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// APEX Command Engine
// ─────────────────────────────────────────────────────────────────────────────

async function executeCommand(
  cmd: string,
  db: ReturnType<typeof createServiceClient>
): Promise<string> {
  const appUrl = "https://home-reach.com";
  const lower  = cmd.toLowerCase();
  const start  = Date.now();

  // Log it
  await db.from("apex_command_log").insert({
    sender: "system", command: cmd, status: "processing",
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  // ── Approval gate ─────────────────────────────────────────────────────────
  if (/\bpric(e|ing)\b|checkout|funnel|city.?launch|stripe.?change/.test(lower)) {
    await db.from("apex_command_log").update({ status: "awaiting_approval" })
      .eq("command", cmd).catch(() => {});
    return [
      "⚠️ APEX — CEO Approval Required",
      "",
      `Command: "${cmd}"`,
      "Category: High-risk change",
      "",
      `Reply: APPROVE ${cmd}`,
      "To cancel: DENY",
    ].join("\n");
  }

  // ── Agent routing ─────────────────────────────────────────────────────────
  const cronHeaders = {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${process.env.CRON_SECRET ?? ""}`,
  };

  const agents: { label: string; url: string; when: RegExp }[] = [
    { label: "Echo",       url: `${appUrl}/api/admin/agents/echo`,              when: /echo|send|outreach|message|text|email/ },
    { label: "Closer",     url: `${appUrl}/api/admin/agents/closer`,            when: /closer|follow.?up|convert|warm/ },
    { label: "Anchor",     url: `${appUrl}/api/admin/agents/anchor`,            when: /anchor|re.?engag|dead|cold/ },
    { label: "Scraper",    url: `${appUrl}/api/admin/agents/scraper`,           when: /scrape|lead|prospect|pull/ },
    { label: "Pulse",      url: `${appUrl}/api/admin/system/agents/pulse`,      when: /pulse|health|status|check|monitor/ },
    { label: "Ledger",     url: `${appUrl}/api/admin/system/agents/ledger`,     when: /ledger|revenue|money|report|earn/ },
    { label: "Kaizen",     url: `${appUrl}/api/admin/system/agents/kaizen`,     when: /kaizen|improv|optim|better/ },
    { label: "Prospector", url: `${appUrl}/api/admin/system/agents/prospector`, when: /prospector|pipeline|queue/ },
  ];

  const isAudit = /audit|what.?broken|full.?scan|run.?all|all.?agent/.test(lower);
  let toRun = isAudit
    ? agents.filter(a => /Pulse|Ledger|Kaizen|Prospector/.test(a.label))
    : agents.filter(a => a.when.test(lower));

  if (toRun.length === 0) {
    // Unknown command — run Pulse as status check
    toRun = agents.filter(a => a.label === "Pulse");
  }

  // ── Execute ───────────────────────────────────────────────────────────────
  const results: string[] = [];
  const errors:  string[] = [];

  for (const agent of toRun) {
    try {
      const res = await fetch(agent.url, {
        method: "POST",
        headers: cronHeaders,
        signal: AbortSignal.timeout(15000), // 15s per agent
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      results.push(`✓ ${agent.label}: ${summarize(data)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 50) : "failed";
      errors.push(`✗ ${agent.label}: ${msg}`);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const status  = errors.length === 0 ? "Complete" : results.length > 0 ? "Partial" : "Failed";

  const lines = [
    `⚡ APEX Report`,
    ``,
    `Command: "${cmd}"`,
    ``,
    `Agents: ${toRun.map(a => a.label).join(", ")}`,
    ``,
    ...results,
    ...errors,
    ``,
    `Status: ${status} (${elapsed}s)`,
  ];

  const response = lines.join("\n");

  await db.from("apex_command_log").update({
    status: status.toLowerCase(),
    response: response.slice(0, 2000),
    elapsed_ms: Date.now() - start,
  }).eq("command", cmd).catch(() => {});

  return response;
}

function summarize(data: Record<string, unknown>): string {
  if (data.summary && typeof data.summary === "object") {
    const s = data.summary as Record<string, number>;
    const parts = Object.entries(s).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`);
    return parts.length > 0 ? parts.slice(0, 4).join(", ") : "done";
  }
  if (data.status) return String(data.status).slice(0, 40);
  if (data.ok)     return "done";
  return "completed";
}
