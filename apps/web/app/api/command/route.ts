import { NextResponse } from "next/server";
import twilio from "twilio";
import { getOwnerIdentity } from "@homereach/services/outreach";
import { resolveEnvAlias } from "@/lib/app-url";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/command — APEX Mobile Command Center
//
// Jason texts +13306367984 (APEX private number) → Twilio POSTs here
// Executes synchronously and returns the full response in TwiML.
// setImmediate/background tasks don't work in Vercel serverless.
// ─────────────────────────────────────────────────────────────────────────────

function getApprovedSenders(): Set<string> {
  const extra = (resolveEnvAlias("APEX_APPROVED_SENDERS", "APEX_APPROVED_SENDER") ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);
  return new Set([getOwnerIdentity().cellPhone, ...extra]); // owner personal cell only
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

function validateTwilioCommandRequest(
  req: Request,
  params: URLSearchParams,
): { ok: boolean; reason?: string } {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const isProduction = process.env.NODE_ENV === "production";

  if (!authToken) {
    return isProduction
      ? { ok: false, reason: "TWILIO_AUTH_TOKEN is not configured" }
      : { ok: true };
  }

  const signature = req.headers.get("x-twilio-signature") ?? "";
  if (!signature) return { ok: false, reason: "missing Twilio signature" };

  const url = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/command`
    : req.url;

  const form: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    form[key] = value;
  }

  return twilio.validateRequest(authToken, signature, url, form)
    ? { ok: true }
    : { ok: false, reason: "invalid Twilio signature" };
}

// GET — liveness check (visit in browser to confirm endpoint is deployed)
export async function GET() {
  return new NextResponse(JSON.stringify({
    status: "APEX command line is live",
    apex_number: process.env.APEX_COMMAND_NUMBER ?? "not set",
    twilio_signature_required: process.env.NODE_ENV === "production",
  }), { headers: { "Content-Type": "application/json" } });
}

export async function POST(req: Request) {
  try {
    const text   = await req.text();
    const params = new URLSearchParams(text);
    const from   = params.get("From") ?? "";
    const to     = params.get("To")   ?? "";
    const body   = (params.get("Body") ?? "").trim();

    const signature = validateTwilioCommandRequest(req, params);
    if (!signature.ok) {
      console.warn(`[APEX] Rejected invalid webhook: ${signature.reason}`);
      await logPlatformAuditEvent({
        actorType: "webhook",
        actorLabel: "Twilio",
        module: "command",
        actionType: "apex_command_rejected",
        channel: "sms",
        provider: "twilio",
        resultStatus: "blocked",
        severity: "critical",
        message: "APEX command webhook rejected before sender authorization.",
        errorMessage: signature.reason,
        metadata: { from, to },
      });
      return new Response("Forbidden", { status: 403 });
    }

    console.log(`[APEX] SMS in: From=${from} To=${to}`);

    // Security gate
    if (!getApprovedSenders().has(from)) {
      console.warn(`[APEX] Rejected: ${from}`);
      await logPlatformAuditEvent({
        actorType: "webhook",
        actorLabel: "Twilio",
        module: "command",
        actionType: "apex_command_sender_rejected",
        channel: "sms",
        provider: "twilio",
        resultStatus: "blocked",
        severity: "high",
        message: "APEX command rejected because sender is not approved.",
        metadata: { from, to },
      });
      return twimlOk();
    }

    if (!body) return twimlOk();

    await logPlatformAuditEvent({
      actorType: "human",
      actorLabel: "Approved APEX SMS sender",
      module: "command",
      actionType: "apex_command_received",
      channel: "sms",
      provider: "twilio",
      resultStatus: "success",
      severity: "medium",
      message: "APEX command received from an approved sender.",
      metadata: { from, to, commandPreview: body.slice(0, 80) },
    });

    // APPROVE / DENY flow
    const upper = body.toUpperCase();
    if (upper.startsWith("APPROVE ")) {
      return twimlMessage(`✅ Approved. Executing: ${body.slice(8)}\n\nProcessing now...`);
    }
    if (upper === "DENY") {
      return twimlMessage("❌ Command denied. No action taken.");
    }

    // Execute APEX command and return result in TwiML
    const result = await executeCommand(body);
    return twimlMessage(result);

  } catch (err) {
    console.error("[APEX] Error:", err);
    return twimlMessage("⚠️ APEX: Command failed — check Vercel logs.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// APEX Command Engine
// ─────────────────────────────────────────────────────────────────────────────

async function executeCommand(cmd: string): Promise<string> {
  const appUrl = "https://home-reach.com";
  const lower  = cmd.toLowerCase();
  const start  = Date.now();

  // ── Approval gate ─────────────────────────────────────────────────────────
  if (/\bpric(e|ing)\b|checkout|funnel|city.?launch|stripe.?change/.test(lower)) {
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
    { label: "Pulse",      url: `${appUrl}/api/admin/system/agents/pulse`,      when: /pulse|health|status|check|monitor/ },
    { label: "Ledger",     url: `${appUrl}/api/admin/system/agents/ledger`,     when: /ledger|revenue|money|report|earn/ },
    { label: "Kaizen",     url: `${appUrl}/api/admin/system/agents/kaizen`,     when: /kaizen|improv|optim|better/ },
    { label: "Prospector", url: `${appUrl}/api/admin/system/agents/prospector`, when: /prospector|pipeline|queue|lead|prospect/ },
  ];

  const isAudit = /audit|what.?broken|full.?scan|run.?all|all.?agent/.test(lower);
  if (/serp|scrape|google.?maps|find.?leads|new.?leads|pull.?leads|search.?leads|source.?leads/.test(lower)) {
    return "SerpAPI scraper is manually paused. No search calls were made.";
  }

  if (/echo|send|outreach|message|text|email|closer|follow.?up|convert|warm|anchor|re.?engag|dead|cold/.test(lower)) {
    return [
      "APEX Review Mode",
      "",
      "Outbound, follow-up, retention, and reactivation agents are paused from SMS command execution.",
      "Open the Admin Command Center or AI Workforce queue to review, approve, and run these actions with audit logging.",
    ].join("\n");
  }

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
