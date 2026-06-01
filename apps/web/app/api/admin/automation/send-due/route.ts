import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import {
  appendEmailComplianceHtml,
  appendEmailComplianceText,
  appendSmsCompliance,
  getDefaultEmailIdentity,
  getOutreachSafetyConfig,
  isWithinOutreachWindow,
  renderOwnerTemplate,
  sendSms,
  sendEmail,
} from "@homereach/services/outreach";
import { recordOutboundRevenueMessage } from "@/lib/revenue-messaging/outbound";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import {
  auditDeliverabilityCopy,
  buildAiOutputContent,
  buildOutreachSourceAttribution,
  evaluateAutomationLiveSendGate,
} from "@/lib/sales-engine/outreach-governance";
import {
  communicationPolicyMetadata,
  personaForEmail,
  personaTemplateVars,
} from "@/lib/revenue-messaging/personas";
import {
  evaluateOutboundReputation,
  logReputationDecision,
  type RevenueBusinessLine,
} from "@/lib/deliverability/reputation-control";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/automation/send-due
// Processes all enrollments where next_send_at <= now.
// Live sending is disabled unless explicit automation approval gates are set.
// GET  /api/admin/automation/send-due — status check, returns pending count
// ─────────────────────────────────────────────────────────────────────────────

function renderTemplate(template: string, vars: Record<string, string>): string {
  return renderOwnerTemplate(template, vars);
}

function hashMessage(body: string): string {
  return crypto.createHash("sha256").update(body).digest("hex");
}

function resolvePublicAppUrl() {
  const candidates = [
    process.env.OUTBOUND_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    "https://www.home-reach.com",
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
        return url.toString().replace(/\/+$/, "");
      }
    } catch {
      continue;
    }
  }
  return "https://www.home-reach.com";
}

const APP_URL = resolvePublicAppUrl();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeHttpUrl(value: string): boolean {
  if (!value || value.includes("{{")) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeOutboundUrl(value: string): string {
  if (!isSafeHttpUrl(value)) return value;
  try {
    const parsed = new URL(value);
    const isHomeReach =
      parsed.hostname === "home-reach.com" ||
      parsed.hostname === "www.home-reach.com";
    if (!isHomeReach) return value;

    if (parsed.pathname === "/political/candidate-agent" || parsed.pathname === "/political") {
      return publicPoliticalPlanUrl(parsed.searchParams.get("candidate") ?? "amy-acton");
    }

    parsed.hostname = "www.home-reach.com";
    return parsed.toString();
  } catch {
    return value;
  }
}

function linkifyEscapedText(value: string): string {
  const escaped = escapeHtml(value);
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => {
      const href = normalizeOutboundUrl(url.replace(/&amp;/g, "&"));
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;font-weight:700;text-decoration:underline;word-break:break-word;">${escapeHtml(href)}</a>`;
    },
  );
}

function firstUrlInLine(line: string): string | null {
  return line.match(/https?:\/\/[^\s<]+/)?.[0] ?? null;
}

function normalizeUrlForCompare(value: string) {
  return normalizeOutboundUrl(value).replace(/\/+$/, "");
}

function renderMobileCta(url: string, label = "Review the mobile campaign plan") {
  const href = escapeHtml(normalizeOutboundUrl(url));
  return `
    <div style="margin:18px 0 22px 0;">
      <a href="${href}" target="_blank" rel="noopener noreferrer" style="box-sizing:border-box;display:block;width:100%;max-width:380px;border-radius:14px;background:#dc2626;color:#ffffff;text-align:center;text-decoration:none;font-weight:800;font-size:16px;line-height:1.25;padding:16px 18px;">
        ${escapeHtml(label)}
      </a>
      <div style="margin-top:9px;font-size:12px;line-height:1.5;color:#64748b;word-break:break-word;">
        If the button does not open, copy this link:<br>
        <a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;font-weight:700;text-decoration:underline;">${href}</a>
      </div>
    </div>
  `;
}

function renderAutomationEmailHtml(
  body: string,
  options: { primaryCtaUrl?: string | null; primaryCtaLabel?: string } = {},
): string {
  const lines = body.split(/\r?\n/);
  const primaryCtaUrl = options.primaryCtaUrl
    ? normalizeOutboundUrl(options.primaryCtaUrl)
    : null;
  let primaryCtaRendered = false;
  const rendered = lines
    .map((line) => {
      const imageMatch = line.trim().match(/^\[\[image:(.+?)(?:\|(.+?))?\]\]$/);
      if (imageMatch) {
        const src = imageMatch[1]?.trim() ?? "";
        if (!isSafeHttpUrl(src)) return "";
        const alt = imageMatch[2]?.trim() || "HomeReach campaign plan visual";
        const image = `<img src="${escapeHtml(normalizeOutboundUrl(src))}" alt="${escapeHtml(alt)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:14px;border:1px solid #dbe4f0;" />`;
        return `
          <div style="margin:22px 0;">
            ${
              primaryCtaUrl
                ? `<a href="${escapeHtml(primaryCtaUrl)}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;">${image}</a>`
                : image
            }
          </div>
        `;
      }
      if (!line.trim()) return '<div style="height:12px;line-height:12px;">&nbsp;</div>';

      const lineUrl = firstUrlInLine(line);
      const normalizedLineUrl = lineUrl ? normalizeOutboundUrl(lineUrl) : null;
      const isPrimaryCtaLine =
        primaryCtaUrl &&
        normalizedLineUrl &&
        normalizeUrlForCompare(normalizedLineUrl) === normalizeUrlForCompare(primaryCtaUrl);
      const isPoliticalPlanLine =
        normalizedLineUrl &&
        /\/political(\?|#|$)/.test(
          new URL(normalizedLineUrl).pathname +
            new URL(normalizedLineUrl).search +
            new URL(normalizedLineUrl).hash,
        );

      if ((isPrimaryCtaLine || isPoliticalPlanLine) && normalizedLineUrl) {
        const intro = line.replace(lineUrl ?? "", "").replace(/:\s*$/, "").trim();
        const introHtml = intro ? `<div style="margin:0 0 8px 0;">${escapeHtml(intro)}</div>` : "";
        primaryCtaRendered = primaryCtaRendered || Boolean(isPrimaryCtaLine);
        return `${introHtml}${renderMobileCta(primaryCtaUrl ?? normalizedLineUrl, options.primaryCtaLabel)}`;
      }

      return `<div style="margin:0 0 8px 0;">${linkifyEscapedText(line)}</div>`;
    })
    .join("\n");
  const fallbackCta =
    primaryCtaUrl && !primaryCtaRendered
      ? renderMobileCta(primaryCtaUrl, options.primaryCtaLabel)
      : "";

  return `
    <div style="box-sizing:border-box;font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:18px 14px;color:#172033;line-height:1.58;font-size:15px;">
      ${rendered}
      ${fallbackCta}
    </div>
  `;
}

function toTemplateValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

function normalizeMetadata(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const templateValue = toTemplateValue(raw);
    if (templateValue !== null) output[key] = templateValue;
  }
  return output;
}

type AutomationLead = {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state?: string | null;
  category: string | null;
  website?: string | null;
  notes?: string | null;
  outreach_metadata?: unknown;
  do_not_contact: boolean;
  sms_opt_out: boolean;
  is_quarantined: boolean;
  email_status?: string | null;
};

type AutomationSequence = {
  id: string;
  channel: string;
  stop_on_reply: boolean;
  status: string;
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isPoliticalLead(input: {
  business_name: string | null;
  category: string | null;
  outreach_metadata?: unknown;
}): boolean {
  const metadata = normalizeMetadata(input.outreach_metadata);
  const haystack = [
    input.business_name,
    input.category,
    metadata.candidate_name,
    metadata.candidate,
    metadata.office_sought,
    metadata.office,
    metadata.political_plan_url,
    metadata.political_options_image_url,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\bpolitical\b|\bcandidate\b|\bcampaign\b|\bgovernor\b|\bsenate\b|\battorney general\b|\bsecretary of state\b|\bauditor\b|\btreasurer\b|\bmayor\b|\bcity council\b|\bschool board\b|\bcommissioner\b|\bjudicial\b|\bjudge\b|\bsheriff\b/.test(
    haystack,
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function publicPoliticalPlanUrl(candidateSlug: string): string {
  const url = new URL("/political", APP_URL);
  url.searchParams.set("candidate", candidateSlug);
  url.searchParams.set("utm_source", "political_email");
  url.searchParams.set("utm_medium", "email");
  url.hash = "campaign-options";
  return url.toString();
}

function normalizePoliticalPlanUrl(value: string | null | undefined, candidateSlug: string): string {
  if (!value) return publicPoliticalPlanUrl(candidateSlug);
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const isHomeReach = host === "home-reach.com" || host === "www.home-reach.com";
    if (!isHomeReach) return value;
    if (parsed.pathname === "/political/candidate-agent" || parsed.pathname === "/political") {
      return publicPoliticalPlanUrl(
        parsed.searchParams.get("candidate") ?? candidateSlug,
      );
    }
    return value.replace("https://home-reach.com", "https://www.home-reach.com");
  } catch {
    return publicPoliticalPlanUrl(candidateSlug);
  }
}

function firstValue(...values: Array<string | null | undefined>): string | null {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? null;
}

function buildAutomationVars(input: {
  lead: {
    business_name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    state?: string | null;
    category: string | null;
    website?: string | null;
    notes?: string | null;
    outreach_metadata?: unknown;
  };
  fromName: string | null;
  fromEmail?: string | null;
}): Record<string, string> {
  const metadata = normalizeMetadata(input.lead.outreach_metadata);
  const candidateName = firstValue(
    metadata.candidate_name,
    metadata.candidate,
    input.lead.category?.toLowerCase().includes("political") ? input.lead.business_name : null,
  ) ?? "the campaign";
  const candidateSlug = firstValue(metadata.candidate_slug, slugify(candidateName)) ?? "amy-acton";
  const politicalPlanUrl = normalizePoliticalPlanUrl(
    firstValue(metadata.political_plan_url, metadata.plan_url),
    candidateSlug,
  );
  const politicalOptionsImageUrl =
    firstValue(metadata.political_options_image_url, metadata.options_image_url) ??
    `${APP_URL}/api/political/candidate-options-image?candidate=${encodeURIComponent(candidateSlug)}`;
  const persona = personaForEmail(input.fromEmail);
  const personaVars = personaTemplateVars(persona, {
    seed: `${input.fromEmail ?? ""}:${input.lead.business_name}:${candidateSlug}:${input.lead.email ?? input.lead.phone ?? ""}`,
    candidateName,
    businessName: input.lead.business_name,
  });

  return {
    business_name: input.lead.business_name ?? "",
    contact_name: input.lead.contact_name ?? "there",
    city: input.lead.city ?? "your area",
    state: input.lead.state ?? "OH",
    category: input.lead.category ?? "your business",
    website: input.lead.website ?? "",
    sender_name: input.fromName ?? "HomeReach",
    sender_email: input.fromEmail ?? "",
    candidate_name: candidateName,
    candidate_slug: candidateSlug,
    office_sought: firstValue(metadata.office_sought, metadata.office, "the campaign") ?? "the campaign",
    political_plan_url: politicalPlanUrl,
    political_options_image_url: politicalOptionsImageUrl,
    option_a_title: metadata.option_a_title ?? "Foundation Mail Plan",
    option_b_title: metadata.option_b_title ?? "County/Metro Concentration",
    option_c_title: metadata.option_c_title ?? "Balanced Geography Plan",
    option_d_title: metadata.option_d_title ?? "Final-Window Turnout Plan",
    procurement_intake_url:
      firstValue(metadata.procurement_intake_url, metadata.savings_audit_url) ??
      `${APP_URL}/operations-copilot`,
    procurement_demo_url:
      firstValue(metadata.procurement_demo_url, metadata.dashboard_url) ??
      `${APP_URL}/operations-copilot`,
    savings_audit_url:
      firstValue(metadata.savings_audit_url, metadata.procurement_intake_url) ??
      `${APP_URL}/operations-copilot`,
    dashboard_url:
      firstValue(metadata.dashboard_url, metadata.procurement_demo_url) ??
      `${APP_URL}/operations-copilot`,
    ...metadata,
    ...personaVars,
  };
}

type OutreachSystemControls = {
  all_paused?: boolean;
  sms_paused?: boolean;
  email_paused?: boolean;
  outreach_test_mode?: boolean;
  manual_approval_mode?: boolean;
  sms_prospecting_live_enabled?: boolean;
  automation_batch_limit?: number;
  default_time_zone?: string;
  weekday_only?: boolean;
  business_start_minutes?: number;
  business_end_minutes?: number;
};

export async function POST(req: NextRequest) {
  try {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const supabase = createServiceClient();
  const safety = getOutreachSafetyConfig();

  const { data: sysCtrlRaw } = await supabase
    .from("system_controls")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  const sysCtrl = sysCtrlRaw as OutreachSystemControls | null;
  const testMode = Boolean(sysCtrl?.outreach_test_mode ?? safety.testMode);
  const manualApprovalMode = Boolean(sysCtrl?.manual_approval_mode ?? safety.manualApprovalMode);
  const automationGate = evaluateAutomationLiveSendGate({ testMode, manualApprovalMode });

  if (!automationGate.allowed) {
    await logPlatformAuditEvent({
      actorType: "system",
      module: "automation",
      actionType: "send_due_blocked",
      resultStatus: "blocked",
      approvalState: "needs_review",
      severity: "medium",
      message: "Automation send-due was kept in review-only mode.",
      metadata: {
        reason: automationGate.reason,
        approval_gate: automationGate,
      },
    });
    return NextResponse.json({
      ok: false,
      reason: automationGate.reason,
      approval_gate: automationGate,
      approval_status: automationGate.approval_status,
      next_action: "Review due outreach drafts and approve one-to-one sends from the admin workflow.",
      processed: 0,
      sent: 0,
      autonomous_mass_sending_enabled: false,
    });
  }

  if (!testMode && !isWithinOutreachWindow(
    new Date(),
    sysCtrl?.default_time_zone ?? safety.defaultTimeZone,
    {
      weekdayOnly: sysCtrl?.weekday_only ?? safety.weekdayOnly,
      businessStartMinutes: sysCtrl?.business_start_minutes ?? safety.businessStartMinutes,
      businessEndMinutes: sysCtrl?.business_end_minutes ?? safety.businessEndMinutes,
    },
  )) {
    await logPlatformAuditEvent({
      actorType: "system",
      module: "automation",
      actionType: "send_due_skipped",
      resultStatus: "skipped",
      severity: "info",
      message: "Automation send-due skipped outside outreach window.",
      metadata: {
        reason: "outside_outreach_window",
        timezone: sysCtrl?.default_time_zone ?? safety.defaultTimeZone,
      },
    });
    return NextResponse.json({
      ok: false,
      reason: "outside_outreach_window",
      processed: 0,
      window: {
        timezone: sysCtrl?.default_time_zone ?? safety.defaultTimeZone,
        weekday_only: sysCtrl?.weekday_only ?? safety.weekdayOnly,
        start_minutes: sysCtrl?.business_start_minutes ?? safety.businessStartMinutes,
        end_minutes: sysCtrl?.business_end_minutes ?? safety.businessEndMinutes,
      },
    });
  }

  if (sysCtrl?.all_paused) {
    await logPlatformAuditEvent({
      actorType: "system",
      module: "automation",
      actionType: "send_due_blocked",
      resultStatus: "blocked",
      severity: "high",
      message: "Automation send-due was blocked by global system pause.",
      metadata: { reason: "system_paused" },
    });
    return NextResponse.json({ ok: false, reason: "system_paused", processed: 0 });
  }

  const now = new Date().toISOString();
  const envBatchLimit = Number.parseInt(process.env.OUTREACH_AUTOMATION_BATCH_LIMIT ?? "10", 10);
  const batchLimit = sysCtrl?.automation_batch_limit ?? envBatchLimit;
  const politicalOnlyMode = process.env.OUTREACH_POLITICAL_ONLY_MODE !== "false";
  const dueFetchLimit =
    politicalOnlyMode && Number.isFinite(batchLimit) && batchLimit > 0
      ? Math.min(batchLimit * 10, 100)
      : batchLimit;

  // Fetch due enrollments (active, sequence active, not paused agent)
  const { data: due, error: dueErr } = await supabase
    .from("auto_enrollments")
    .select(`
      id, sequence_id, lead_id, agent_id, current_step,
      auto_sequences!inner ( id, channel, stop_on_reply, status ),
      sales_leads!inner (
        id, business_name, contact_name, email, phone, city, state, category,
        website, notes, outreach_metadata,
        do_not_contact, sms_opt_out, is_quarantined, email_status
      )
    `)
    .eq("status", "active")
    .lte("next_send_at", now)
    .eq("auto_sequences.status", "active")
    .limit(Number.isFinite(dueFetchLimit) && dueFetchLimit > 0 ? dueFetchLimit : 10);  // Conservative batch per cron run

  if (dueErr) return NextResponse.json({ error: dueErr.message }, { status: 500 });
  if (!due?.length) {
    await logPlatformAuditEvent({
      actorType: "system",
      module: "automation",
      actionType: "send_due_noop",
      resultStatus: "skipped",
      severity: "info",
      message: "Automation send-due found no active due enrollments.",
    });
    return NextResponse.json({ processed: 0, sent: 0, skipped: 0 });
  }

  const dueToProcess = politicalOnlyMode
    ? due
        .filter((enrollment) => {
          const lead = unwrapRelation(
            enrollment.sales_leads as unknown as AutomationLead | AutomationLead[] | null,
          );
          return lead ? isPoliticalLead(lead) : false;
        })
        .slice(0, Number.isFinite(batchLimit) && batchLimit > 0 ? batchLimit : 10)
    : due;

  if (!dueToProcess.length) {
    await logPlatformAuditEvent({
      actorType: "system",
      module: "automation",
      actionType: "send_due_noop",
      resultStatus: "skipped",
      severity: "info",
      message: "Automation send-due found due enrollments, but political-only throttle mode skipped non-political leads.",
      metadata: {
        political_only_mode: politicalOnlyMode,
        due_checked: due.length,
      },
    });
    return NextResponse.json({
      processed: 0,
      sent: 0,
      skipped: due.length,
      political_only_mode: politicalOnlyMode,
      message: "Political-only throttle mode is active; no political enrollments were due.",
    });
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const enrollment of [...dueToProcess].sort(() => Math.random() - 0.5)) {
    const lead = unwrapRelation(
      enrollment.sales_leads as unknown as AutomationLead | AutomationLead[] | null,
    );
    const sequence = unwrapRelation(
      enrollment.auto_sequences as unknown as AutomationSequence | AutomationSequence[] | null,
    );

    if (!lead || !sequence) {
      skipped++;
      continue;
    }

    // Safety checks
    if (lead.do_not_contact || lead.is_quarantined) {
      await supabase.from("auto_enrollments").update({
        status: "stopped", stopped_at: now,
        stop_reason: lead.do_not_contact ? "do_not_contact" : "quarantined",
      }).eq("id", enrollment.id);
      skipped++;
      continue;
    }
    if (
      sequence.channel === "email" &&
      ["bounced_permanent", "complained", "unsubscribed"].includes(lead.email_status ?? "")
    ) {
      await supabase.from("auto_enrollments").update({
        status: "stopped",
        stopped_at: now,
        stop_reason: `email_status_${lead.email_status}`,
      }).eq("id", enrollment.id);
      skipped++;
      continue;
    }
    if (sequence.channel === "sms" && lead.sms_opt_out) {
      await supabase.from("auto_enrollments").update({
        status: "stopped", stopped_at: now, stop_reason: "sms_opt_out",
      }).eq("id", enrollment.id);
      skipped++;
      continue;
    }

    const sendChannel: "sms" | "email" = sequence.channel === "sms" ? "sms" : "email";
    if (sendChannel === "sms" && sysCtrl?.sms_paused) {
      skipped++;
      continue;
    }
    if (sendChannel === "email" && sysCtrl?.email_paused) {
      skipped++;
      continue;
    }
    if (
      sendChannel === "sms" &&
      !testMode &&
      !(sysCtrl?.sms_prospecting_live_enabled ?? safety.smsProspectingLiveEnabled)
    ) {
      skipped++;
      continue;
    }

    // Get agent identity
    const agentId = enrollment.agent_id;
    let fromEmail: string | null = null;
    let fromName: string | null = null;
    let twilioPhone: string | null = null;

    if (agentId) {
      const { data: identity } = await supabase
        .from("agent_identities")
        .select("from_email, from_name, twilio_phone, is_active")
        .eq("agent_id", agentId)
        .single();

      if (identity?.is_active) {
        fromEmail = identity.from_email;
        fromName  = identity.from_name;
        twilioPhone = identity.twilio_phone;
      }
    }

    // Fallback to system defaults
    const defaultEmail = getDefaultEmailIdentity({ fromEmail, fromName });
    if (!fromEmail) fromEmail = defaultEmail.fromEmail;
    if (!fromName)  fromName  = defaultEmail.fromName;
    if (!twilioPhone) twilioPhone = process.env.TWILIO_PHONE_NUMBER ?? null;

    // Check agent daily send limit
    if (agentId && !testMode) {
      const { data: limitCheck } = await supabase.rpc("check_and_increment_send_count", {
        p_agent_id: agentId,
        p_channel:  sendChannel,
      });
      const check = limitCheck as { allowed: boolean; reason?: string } | null;
      if (check && !check.allowed) {
        skipped++;
        continue;  // Hit daily limit — try again tomorrow
      }
    }

    // Get current step
    const { data: step } = await supabase
      .from("auto_sequence_steps")
      .select("*")
      .eq("sequence_id", enrollment.sequence_id)
      .eq("step_number", enrollment.current_step)
      .single();

    if (!step) {
      await supabase.from("auto_enrollments").update({
        status: "completed", completed_at: now,
      }).eq("id", enrollment.id);
      continue;
    }

    // Determine to_address
    const toAddress = sequence.channel === "sms" ? lead.phone : lead.email;
    if (!toAddress) { skipped++; continue; }

    // Render template
    const vars = buildAutomationVars({ lead, fromName, fromEmail });
    const bodyRendered    = renderTemplate(step.body, vars);
    const subjectRendered = step.subject ? renderTemplate(step.subject, vars) : (vars.persona_subject || "HomeReach - grow your business");
    const sourceAttribution = buildOutreachSourceAttribution({
      workflow: "admin_automation_send_due",
      channel: sendChannel,
      lead,
      destination: toAddress,
      templateId: `auto_sequence_${enrollment.sequence_id}_step_${enrollment.current_step}`,
      action: "Automation due-send candidate",
      nextAction: "Human approval required before autonomous outreach can proceed.",
      approvalStatus: automationGate.approval_status,
      sources: ["auto_enrollments", "auto_sequences", "auto_sequence_steps", "system_controls"],
      extraInputs: {
        enrollment_id: enrollment.id,
        sequence_id: enrollment.sequence_id,
        step_id: step.id,
        current_step: enrollment.current_step,
      },
    });
    const deliverability = auditDeliverabilityCopy(
      sendChannel === "email" ? `${subjectRendered}\n\n${bodyRendered}` : bodyRendered,
      sendChannel,
    );
    const revenueBusinessLine: RevenueBusinessLine = isPoliticalLead(lead)
      ? "political"
      : String(lead.category ?? "").toLowerCase().includes("procurement")
        ? "inventory_procurement"
        : "targeted_mailing";
    const leadMetadata = normalizeMetadata(lead.outreach_metadata);
    const reputationInput = {
      supabase,
      senderEmail: fromEmail,
      senderName: fromName,
      channel: sendChannel,
      recipient: toAddress,
      businessLine: revenueBusinessLine,
      sourceSystem: "sales_leads",
      sourceId: lead.id,
      subject: sendChannel === "email" ? subjectRendered : null,
      body: bodyRendered,
      templateKey: `auto_sequence_${enrollment.sequence_id}_step_${enrollment.current_step}`,
      humanApproved: false,
      autonomous: true,
      recipientSource: revenueBusinessLine === "political" ? "public_campaign_contact" as const : "unknown" as const,
      smsConsent: Boolean(leadMetadata.sms_consent || leadMetadata.opt_in_source || leadMetadata.requested_follow_up),
      smsPurpose: sendChannel === "sms" ? "marketing" as const : undefined,
      deliverabilityStatus: deliverability.status,
      deliverabilityFlags: deliverability.flags,
      metadata: {
        enrollment_id: enrollment.id,
        sequence_id: enrollment.sequence_id,
        step_id: step.id,
        political_only_mode: politicalOnlyMode,
        approval_gate: automationGate,
      },
    };
    const reputation = await evaluateOutboundReputation(reputationInput);
    await logReputationDecision(supabase, reputationInput, reputation);

    if (!reputation.allowed) {
      await supabase.from("auto_send_log").insert({
        enrollment_id: enrollment.id,
        step_id:       step.id,
        lead_id:       lead.id,
        channel:       sequence.channel,
        to_address:    toAddress,
        subject:       sequence.channel === "email" ? subjectRendered : null,
        body_rendered: bodyRendered,
        status:        "skipped",
        sent_at:       null,
        error:         `reputation_blocked: ${reputation.decision} (${reputation.level}/${reputation.score})`,
      });
      try {
        await supabase.from("ai_outputs").insert({
          title: `Outreach draft reputation review: ${lead.business_name}`,
          agent_name: "Revenue Integrity Agent",
          workflow: "admin_automation_send_due",
          output_type: "risk_review",
          content: buildAiOutputContent({
            channel: sendChannel,
            subject: sendChannel === "email" ? subjectRendered : null,
            body: bodyRendered,
            cta: reputation.recommendedAction,
            complianceNotes: [...reputation.blockers, ...reputation.warnings],
            sourceAttribution,
          }),
          data_sources: sourceAttribution.sources_referenced,
          prompt_sop_name: "skills/outreach/SKILL.md",
          approval_status: "needs_review",
          verification_status: "needs_review",
          metadata: {
            source_attribution: sourceAttribution,
            deliverability,
            reputation,
            approval_gate: automationGate,
          },
        });
      } catch (draftError) {
        console.warn("[automation/send-due] reputation AI output log skipped:", draftError);
      }
      skipped++;
      continue;
    }

    if (deliverability.status === "blocked") {
      await supabase.from("auto_send_log").insert({
        enrollment_id: enrollment.id,
        step_id:       step.id,
        lead_id:       lead.id,
        channel:       sequence.channel,
        to_address:    toAddress,
        subject:       sequence.channel === "email" ? subjectRendered : null,
        body_rendered: bodyRendered,
        status:        "skipped",
        sent_at:       null,
        error:         `deliverability_blocked: ${deliverability.flags.join(",")}`,
      });
      try {
        await supabase.from("ai_outputs").insert({
          title: `Outreach draft blocked: ${lead.business_name}`,
          agent_name: "Outreach Agent",
          workflow: "admin_automation_send_due",
          output_type: "draft",
          content: buildAiOutputContent({
            channel: sendChannel,
            subject: sendChannel === "email" ? subjectRendered : null,
            body: bodyRendered,
            cta: "Revise copy, verify claims, and keep as needs_review.",
            complianceNotes: deliverability.notes,
            sourceAttribution,
          }),
          data_sources: sourceAttribution.sources_referenced,
          prompt_sop_name: "skills/outreach/SKILL.md",
          approval_status: "needs_review",
          verification_status: "needs_review",
          metadata: {
            source_attribution: sourceAttribution,
            deliverability,
            reputation,
            approval_gate: automationGate,
          },
        });
      } catch (draftError) {
        console.warn("[automation/send-due] blocked AI output log skipped:", draftError);
      }
      skipped++;
      continue;
    }

    // Check message hash (prevent identical repeat sends to same lead)
    const msgHash = hashMessage(bodyRendered);
    const { error: hashErr } = await supabase
      .from("agent_message_hashes")
      .insert({
        agent_id: agentId ?? process.env.ADMIN_SYSTEM_USER_ID,
        lead_id:  lead.id,
        channel:  sendChannel,
        msg_hash: msgHash,
      });

    if (hashErr?.code === "23505") {
      // Duplicate message to same lead — skip
      skipped++;
      continue;
    }

    // Live send only after explicit automation approval gates pass.
    let sendResult: {
      success: boolean;
      externalId?: string;
      error?: string;
      provider?: string;
      testMode?: boolean;
    };

    // Add compliance footer
    const smsBody  = appendSmsCompliance(bodyRendered);
    const emailBodyHtml = renderAutomationEmailHtml(bodyRendered, {
      primaryCtaUrl: vars.political_plan_url,
      primaryCtaLabel: "Review the mobile campaign plan",
    });
    const emailHtml = appendEmailComplianceHtml(emailBodyHtml, toAddress);

    if (sequence.channel === "sms") {
      sendResult = await sendSms({
        to: toAddress,
        body: smsBody,
        fromNumber: twilioPhone ?? undefined,
        intent: "prospecting",
        testMode,
      });
    } else {
      sendResult = await sendEmail({
        to:      toAddress,
        subject: subjectRendered,
        html:    emailHtml,
        text:    appendEmailComplianceText(bodyRendered, toAddress),
        fromEmail: fromEmail ?? undefined,
        fromName: fromName ?? undefined,
        replyTo: defaultEmail.replyTo,
        messageStream: process.env.POSTMARK_BROADCAST_MESSAGE_STREAM ?? process.env.POSTMARK_MESSAGE_STREAM ?? "outbound",
        tags: [
          String(lead.category ?? "").toLowerCase().includes("political")
            ? "political_outreach"
            : "growth_outreach",
        ],
        metadata: {
          lead_id: lead.id,
          sequence_id: enrollment.sequence_id,
          enrollment_id: enrollment.id,
          step_id: step.id,
          sender_email: fromEmail ?? "",
          sender_name: fromName ?? "",
          category: lead.category ?? "",
          communication_persona: vars.communication_persona ?? "",
          communication_policy: JSON.stringify(communicationPolicyMetadata(personaForEmail(fromEmail))),
          reputation_score: String(reputation.score),
          reputation_level: reputation.level,
          reputation_decision: reputation.decision,
        },
        intent: "prospecting",
        testMode,
      });
    }

    // Log result
    const sendStatus = sendResult.success ? "sent" : "failed";
    await supabase.from("auto_send_log").insert({
      enrollment_id: enrollment.id,
      step_id:       step.id,
      lead_id:       lead.id,
      channel:       sequence.channel,
      to_address:    toAddress,
      subject:       sequence.channel === "email" ? subjectRendered : null,
      body_rendered: bodyRendered,
      status:        sendStatus,
      sent_at:       sendResult.success ? now : null,
      error:         sendResult.error ?? null,
    });

    if (sendResult.success) {
      // Log to sales_events for tracking + leaderboard
      const { data: salesEvent } = await supabase.from("sales_events").insert({
        agent_id:    agentId,
        lead_id:     lead.id,
        action_type: sequence.channel === "sms" ? "sms_sent" : "email_sent",
        channel:     sequence.channel,
        city:        lead.city,
        category:    lead.category,
        message:     bodyRendered,
        metadata:    {
          auto: true,
          sequence_id: enrollment.sequence_id,
          external_id: sendResult.externalId,
          provider: sendResult.provider,
          test_mode: sendResult.testMode ?? false,
          approval_status: automationGate.approval_status,
          approval_gate: automationGate,
          source_attribution: sourceAttribution,
          deliverability,
          reputation,
          communication_persona: vars.communication_persona,
          communication_policy: communicationPolicyMetadata(personaForEmail(fromEmail)),
        },
      }).select("id").maybeSingle();
      try {
        await recordOutboundRevenueMessage({
          businessLine: revenueBusinessLine,
          sourceSystem: "sales_leads",
          sourceId: lead.id,
          channel: sequence.channel === "sms" ? "sms" : "email",
          to: toAddress,
          subject: sequence.channel === "email" ? subjectRendered : null,
          body: bodyRendered,
          provider: sendResult.provider ?? null,
          providerMessageId: sendResult.externalId ?? null,
          city: lead.city,
          category: lead.category,
          assignedTo: agentId ?? null,
          metadata: {
            auto: true,
            sequence_id: enrollment.sequence_id,
            enrollment_id: enrollment.id,
            step_id: step.id,
            sales_event_id: salesEvent?.id ?? null,
            test_mode: sendResult.testMode ?? false,
            logged_from: "admin_automation_send_due",
            political_only_mode: politicalOnlyMode,
            approval_status: automationGate.approval_status,
            source_attribution: sourceAttribution,
            deliverability,
            reputation,
            communication_persona: vars.communication_persona,
            communication_policy: communicationPolicyMetadata(personaForEmail(fromEmail)),
          },
        });
      } catch (revenueLogError) {
        console.warn("[automation/send-due] revenue messaging outbound log skipped:", revenueLogError);
      }
      await supabase.rpc("increment_lead_messages", { lead_uuid: lead.id });
      sent++;
    } else {
      errors.push(`${lead.business_name}: ${sendResult.error}`);
      skipped++;
    }

    // Advance to next step
    const { data: nextStep } = await supabase
      .from("auto_sequence_steps")
      .select("step_number, delay_hours")
      .eq("sequence_id", enrollment.sequence_id)
      .eq("step_number", enrollment.current_step + 1)
      .single();

    if (nextStep) {
      const jitterMinutes = Math.floor(Math.random() * 45) + 5;
      const nextSendAt = new Date(
        Date.now() + nextStep.delay_hours * 60 * 60 * 1000 + jitterMinutes * 60 * 1000,
      ).toISOString();
      await supabase.from("auto_enrollments").update({
        current_step: nextStep.step_number,
        next_send_at: nextSendAt,
      }).eq("id", enrollment.id);
    } else {
      await supabase.from("auto_enrollments").update({
        status: "completed", completed_at: now, next_send_at: null,
      }).eq("id", enrollment.id);
    }
  }

  await logPlatformAuditEvent({
    actorType: "system",
    module: "automation",
    actionType: "send_due_processed",
    resultStatus: errors.length > 0 ? "warning" : "success",
    severity: errors.length > 0 ? "medium" : "info",
    message: `Automation send-due processed ${dueToProcess.length} enrollment${dueToProcess.length === 1 ? "" : "s"}.`,
    metadata: {
      processed: dueToProcess.length,
      due_checked: due.length,
      political_only_mode: politicalOnlyMode,
      sent,
      skipped,
      errors,
      approval_gate: automationGate,
    },
  });

  return NextResponse.json({
    processed: dueToProcess.length,
    due_checked: due.length,
    sent,
    skipped,
    political_only_mode: politicalOnlyMode,
    approval_gate: automationGate,
    errors: errors.length > 0 ? errors : undefined,
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}

export async function GET(req: NextRequest) {
  try {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: controls } = await supabase
    .from("system_controls")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const { count: dueNow } = await supabase
    .from("auto_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .lte("next_send_at", now);

  const { count: activeTotal } = await supabase
    .from("auto_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  // Sender health
  const { data: health } = await supabase
    .from("v_sender_health" as never)
    .select("agent_id, from_email, emails_sent_today, sms_sent_today, email_daily_limit, sms_daily_limit, health_status");

  return NextResponse.json({
    due_now: dueNow ?? 0,
    active_total: activeTotal ?? 0,
    sender_health: health ?? [],
    controls,
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}
