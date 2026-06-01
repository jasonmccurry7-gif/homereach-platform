import { createServiceClient } from "@/lib/supabase/service";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  appendEmailComplianceHtml,
  appendEmailComplianceText,
  appendSmsCompliance,
  getDefaultEmailIdentity,
  renderOwnerTemplate,
  sendEmail,
  sendSms,
} from "@homereach/services/outreach";
import { recordOutboundRevenueMessage } from "@/lib/revenue-messaging/outbound";
import {
  auditDeliverabilityCopy,
  buildOutreachSourceAttribution,
  evaluateOutboundApprovalGate,
} from "@/lib/sales-engine/outreach-governance";
import {
  evaluateOutboundReputation,
  logReputationDecision,
  type OutreachChannel,
  type RevenueBusinessLine,
  type ReputationResult,
} from "@/lib/deliverability/reputation-control";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sales/event
// Log agent action AND actually send if it's an outbound message.
// Uses service-role client to bypass RLS entirely.
// ─────────────────────────────────────────────────────────────────────────────

const SEND_ACTIONS = new Set([
  "text_sent", "email_sent", "facebook_sent", "follow_up_sent",
  "sms_sent", "fb_message_sent",
]);

type OutreachSystemControls = {
  all_paused?: boolean;
  sms_paused?: boolean;
  email_paused?: boolean;
  facebook_paused?: boolean;
  outreach_test_mode?: boolean;
  manual_approval_mode?: boolean;
  sms_prospecting_live_enabled?: boolean;
};

type SalesEventMetadata = Record<string, unknown>;

function metadataObject(value: unknown): SalesEventMetadata {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SalesEventMetadata)
    : {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function inferRevenueBusinessLine(
  category: unknown,
  metadata: unknown,
): RevenueBusinessLine {
  const data = metadataObject(metadata);
  const haystack = `${category ?? ""} ${data.business_line ?? ""} ${data.campaign_type ?? ""} ${data.workflow ?? ""}`;
  if (/\bpolitical|campaign|candidate|governor|senate|attorney general\b/i.test(haystack)) {
    return "political";
  }
  if (/\bprocurement|inventory|supplier|vendor|savings\b/i.test(haystack)) {
    return "inventory_procurement";
  }
  return "targeted_mailing";
}

async function verifyPoliticalApprovalQueueSend(args: {
  supabase: ReturnType<typeof createServiceClient>;
  metadata: unknown;
  leadId: string;
  channel: "sms" | "email" | "facebook";
}) {
  const data = metadataObject(args.metadata);
  const approvalId = firstString(
    data.revenue_approval_id,
    data.approval_id,
    data.approvalId,
    data.approval_queue_id,
  );

  if (!approvalId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Political outbound sends must use an approved revenue_message_approval_queue item.",
          approval_status: "needs_review",
          next_action: "Create or approve the political outreach draft in Revenue Operations, then send from the approval queue.",
        },
        { status: 409 },
      ),
    };
  }

  const { data: approval, error } = await args.supabase
    .from("revenue_message_approval_queue")
    .select("id,business_line,channel,status,message_body,metadata")
    .eq("id", approvalId)
    .maybeSingle<{
      id: string;
      business_line: string | null;
      channel: string | null;
      status: string | null;
      message_body: string | null;
      metadata: Record<string, unknown> | null;
    }>();

  if (error) {
    return { ok: false as const, response: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  if (!approval) {
    return { ok: false as const, response: NextResponse.json({ error: "Political approval item not found." }, { status: 404 }) };
  }
  if (approval.business_line !== "political" || approval.status !== "approved") {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Political approval item must be approved before sending.",
          approval_status: approval.status,
        },
        { status: 409 },
      ),
    };
  }
  const expectedChannel = args.channel === "facebook" ? "facebook_dm" : args.channel;
  if (approval.channel && approval.channel !== expectedChannel) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: `Political approval item is for ${approval.channel}, not ${expectedChannel}.` },
        { status: 409 },
      ),
    };
  }
  const approvalMetadata = metadataObject(approval.metadata);
  const approvedLeadId = firstString(approvalMetadata.lead_id, approvalMetadata.source_id);
  if (approvedLeadId && approvedLeadId !== args.leadId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Political approval item does not match this lead." },
        { status: 409 },
      ),
    };
  }

  return { ok: true as const, approvalId };
}

type SendLimitResult = {
  allowed?: boolean;
  reason?: string;
  limit?: number;
  remaining?: number;
  sent?: number;
} | null;

// ─── Direct Twilio SMS (supports per-agent from number) ───────────────────────
async function sendViaTwilio(
  to: string,
  from: string,
  body: string
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken)
      return { success: false, error: "Twilio credentials not configured" };

    const form = new URLSearchParams();
    form.append("To",   to);
    form.append("From", from);
    form.append("Body", body);

    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method:  "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      }
    );

    if (!resp.ok) {
      const detail = await resp.text();
      throw new Error(`Twilio ${resp.status}: ${detail}`);
    }
    const data = await resp.json() as { sid?: string };
    return { success: true, externalId: data.sid };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown SMS error";
    console.error("[sales/event/sms]", error);
    return { success: false, error };
  }
}

// ─── Direct Mailgun Email (supports per-agent from email) ─────────────────────
async function sendViaMailgun(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
}): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    if (!apiKey || !domain)
      return { success: false, error: "Mailgun credentials not configured" };

    const form = new URLSearchParams();
    form.set("from",    `${options.fromName} <${options.fromEmail}>`);
    form.set("to",      options.to);
    form.set("subject", options.subject);
    form.set("html",    options.html);
    form.set("text",    options.text);
    if (options.replyTo) form.set("h:Reply-To", options.replyTo);

    const resp = await fetch(
      `https://api.mailgun.net/v3/${domain}/messages`,
      {
        method:  "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      }
    );

    if (!resp.ok) {
      const detail = await resp.text();
      throw new Error(`Mailgun ${resp.status}: ${detail}`);
    }
    const data = await resp.json() as { id?: string };
    return { success: true, externalId: data.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown email error";
    console.error("[sales/event/email]", error);
    return { success: false, error };
  }
}

// ─── Main Handler ──────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const guard = await requireAdminOrSalesAgent();
    if (!guard.ok) return guard.response;
    const user = guard.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const isSalesAgent = user.app_metadata?.user_role === "sales_agent";

    const supabase = createServiceClient();
    const body = await request.json();

    let {
      agent_id, lead_id, action_type, channel, city, category,
      message, revenue_cents, metadata,
      to_address, subject,
    } = body;

    if (isSalesAgent) {
      agent_id = user.id;
    }

    if (!action_type) {
      return NextResponse.json({ error: "action_type required" }, { status: 400 });
    }

    if (isSalesAgent && lead_id) {
      const { data: leadOwner, error: leadOwnerError } = await supabase
        .from("sales_leads")
        .select("assigned_agent_id")
        .eq("id", lead_id)
        .maybeSingle();

      if (leadOwnerError) {
        return NextResponse.json({ error: leadOwnerError.message }, { status: 500 });
      }
      if (!leadOwner) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
      if (leadOwner.assigned_agent_id && leadOwner.assigned_agent_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    let sendResult: {
      success: boolean;
      externalId?: string;
      error?: string;
      provider?: string;
      testMode?: boolean;
    } | null = null;
    let sendLimit: SendLimitResult = null;
    let actualSent = false;
    let approvalGate: ReturnType<typeof evaluateOutboundApprovalGate> | null = null;
    let sourceAttribution: ReturnType<typeof buildOutreachSourceAttribution> | null = null;
    let deliverability: ReturnType<typeof auditDeliverabilityCopy> | null = null;
    let reputation: ReputationResult | null = null;
    let resolvedBusinessLine: RevenueBusinessLine = inferRevenueBusinessLine(category, metadata);
    let outboundRevenueLog: {
      channel: "sms" | "email" | "facebook_dm";
      to: string;
      subject?: string | null;
      body: string;
      provider?: string | null;
      providerMessageId?: string | null;
      metadata?: Record<string, unknown>;
    } | null = null;

    // ── Actually send outbound messages ─────────────────────────────────────
    if (SEND_ACTIONS.has(action_type) && lead_id && message) {
      // Check system pause
      const { data: sysCtrlRaw } = await supabase
        .from("system_controls")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      const sysCtrl = sysCtrlRaw as OutreachSystemControls | null;
      const testMode = Boolean(sysCtrl?.outreach_test_mode);

      if (sysCtrl?.all_paused) {
        return NextResponse.json({ error: "System is paused. Cannot send." }, { status: 403 });
      }
      const outboundChannel =
        channel === "sms" || action_type === "text_sent" || action_type === "sms_sent"
          ? "sms"
          : channel === "facebook" || action_type === "facebook_sent" || action_type === "fb_message_sent"
            ? "facebook"
            : "email";
      resolvedBusinessLine = inferRevenueBusinessLine(category, metadata);
      if (resolvedBusinessLine === "political") {
        const politicalApproval = await verifyPoliticalApprovalQueueSend({
          supabase,
          metadata,
          leadId: lead_id,
          channel: outboundChannel,
        });
        if (!politicalApproval.ok) return politicalApproval.response;
      }

      if (outboundChannel === "sms" && sysCtrl?.sms_paused) {
        return NextResponse.json({ error: "SMS outreach is paused." }, { status: 403 });
      }
      if (outboundChannel === "email" && sysCtrl?.email_paused) {
        return NextResponse.json({ error: "Email outreach is paused." }, { status: 403 });
      }
      if (outboundChannel === "facebook" && sysCtrl?.facebook_paused) {
        return NextResponse.json({ error: "Facebook outreach is paused." }, { status: 403 });
      }
      if (
        outboundChannel === "sms" &&
        !testMode &&
        !(sysCtrl?.sms_prospecting_live_enabled ?? false)
      ) {
        return NextResponse.json({
          error: "Prospecting SMS live sending is disabled until Twilio/A2P approval is confirmed.",
        }, { status: 403 });
      }

      approvalGate = evaluateOutboundApprovalGate({
        metadata,
        channel: outboundChannel,
        actionType: action_type,
        isAuthenticatedHuman: true,
      });

      if (!approvalGate.allowed) {
        return NextResponse.json({
          error: approvalGate.reason,
          approval_status: approvalGate.approval_status,
          approval_gate: approvalGate,
          next_action: "Save the draft to AI Outputs or approve this one-to-one message before sending.",
        }, { status: 409 });
      }

      // Get lead contact info
      const { data: lead } = await supabase
        .from("sales_leads")
        .select("phone, email, email_status, do_not_contact, sms_opt_out, is_quarantined, business_name, assigned_agent_id")
        .eq("id", lead_id)
        .single();

      if (isSalesAgent && lead?.assigned_agent_id && lead.assigned_agent_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (lead?.do_not_contact)
        return NextResponse.json({ error: "Lead is DNC. Cannot send." }, { status: 403 });
      if (lead?.is_quarantined)
        return NextResponse.json({ error: "Lead is quarantined. Cannot send." }, { status: 403 });
      if (outboundChannel === "sms" && lead?.sms_opt_out)
        return NextResponse.json({ error: "Lead has opted out of SMS." }, { status: 403 });
      if (
        outboundChannel === "email" &&
        ["bounced_permanent", "complained", "unsubscribed"].includes(String(lead?.email_status ?? "").toLowerCase())
      ) {
        return NextResponse.json({ error: "Lead email is suppressed." }, { status: 403 });
      }

      // Resolve agent identity (from DB, fallback to env vars)
      const defaultEmailIdentity = getDefaultEmailIdentity();
      let fromEmail    = defaultEmailIdentity.fromEmail;
      let fromName     = defaultEmailIdentity.fromName;
      let replyToEmail = defaultEmailIdentity.replyTo;
      let agentPhone   = process.env.TWILIO_PHONE_NUMBER ?? "";

      if (agent_id) {
        // Check agent pause
        const { data: agentPause } = await supabase
          .from("agent_pause_controls")
          .select("paused")
          .eq("agent_id", agent_id)
          .maybeSingle();

        if (agentPause?.paused)
          return NextResponse.json({ error: "Your account is paused." }, { status: 403 });

        const { data: identity } = await supabase
          .from("agent_identities")
          .select("from_email, from_name, reply_to_email, twilio_phone, is_active")
          .eq("agent_id", agent_id)
          .maybeSingle();

        if (identity?.is_active) {
          if (identity.from_email)  fromEmail  = identity.from_email;
          if (identity.from_name)   fromName   = identity.from_name;
          if (identity.reply_to_email) replyToEmail = identity.reply_to_email;
          if (identity.twilio_phone) agentPhone = identity.twilio_phone;
        }
        // Note: rate-limit counters and dedup hashes are consumed only after
        // approval, suppression, deliverability, and reputation gates pass.
      }

      // Resolve destination address
      const dest = to_address ?? (outboundChannel === "sms" ? lead?.phone : lead?.email);
      if (!dest) {
        return NextResponse.json({
          error: `No ${outboundChannel} contact info for this lead.`,
        }, { status: 400 });
      }

      // Send
      const isSms = outboundChannel === "sms";
      const isEmail = outboundChannel === "email";
      let outboundSubject: string | null = null;
      message = renderOwnerTemplate(message, {
        business_name: lead?.business_name ?? "",
        city: city ?? "",
        category: category ?? "",
      });
      sourceAttribution = buildOutreachSourceAttribution({
        workflow: "admin_sales_event",
        channel: outboundChannel,
        lead: {
          id: lead_id,
          business_name: lead?.business_name ?? "",
          city,
          category,
          status: undefined,
          email_status: lead?.email_status ?? null,
          sms_opt_out: lead?.sms_opt_out ?? null,
          do_not_contact: lead?.do_not_contact ?? null,
          is_quarantined: lead?.is_quarantined ?? null,
        },
        destination: dest,
        templateId: String(metadata?.template_id ?? metadata?.templateId ?? action_type),
        action: action_type,
        nextAction: "If sent, monitor for reply speed; otherwise keep the draft in needs_review.",
        approvalStatus: approvalGate?.approval_status ?? "approved",
        sources: ["sales_events", "sales_leads", "agent_identities", "system_controls"],
      });
      deliverability = auditDeliverabilityCopy(
        isEmail ? `${subject ?? ""}\n\n${message}` : message,
        outboundChannel,
      );
      if (deliverability.status === "blocked" && approvalGate?.autonomous) {
        return NextResponse.json({
          error: "Deliverability guard blocked an autonomous outbound message with unsupported claims.",
          approval_status: "needs_review",
          deliverability,
          source_attribution: sourceAttribution,
        }, { status: 422 });
      }
      const reputationChannel: OutreachChannel = isSms ? "sms" : isEmail ? "email" : "facebook_dm";
      const evaluatedSubject = isEmail
        ? (subject ?? `HomeReach - grow your business in ${city ?? "your area"}`)
        : null;
      const reputationInput = {
        supabase,
        senderEmail: fromEmail,
        senderName: fromName,
        channel: reputationChannel,
        recipient: dest,
        businessLine: resolvedBusinessLine,
        sourceSystem: "sales_leads",
        sourceId: lead_id,
        subject: evaluatedSubject,
        body: message,
        templateKey: String(metadata?.template_id ?? metadata?.templateId ?? action_type),
        humanApproved: approvalGate?.approval_status === "approved",
        autonomous: Boolean(approvalGate?.autonomous),
        recipientSource: resolvedBusinessLine === "political" ? "public_campaign_contact" as const : "unknown" as const,
        smsConsent: Boolean(metadata?.sms_consent || metadata?.opt_in_source || metadata?.requested_follow_up),
        smsPurpose: isSms ? "marketing" as const : undefined,
        deliverabilityStatus: deliverability.status,
        deliverabilityFlags: deliverability.flags,
        metadata: {
          action_type,
          approval_gate: approvalGate,
          source_attribution: sourceAttribution,
        },
      };
      reputation = await evaluateOutboundReputation(reputationInput);
      await logReputationDecision(supabase, reputationInput, reputation);

      if (!reputation.allowed) {
        return NextResponse.json({
          error: "Reputation control blocked this outbound action.",
          approval_status: "needs_review",
          deliverability,
          reputation,
          source_attribution: sourceAttribution,
        }, { status: 409 });
      }

      if (agent_id && !testMode && outboundChannel !== "facebook") {
        const sendChannel = outboundChannel === "sms" ? "sms" : "email";
        const { data: limitCheck, error: limitError } = await supabase.rpc("check_and_increment_send_count", {
          p_agent_id: agent_id,
          p_channel: sendChannel,
        });
        if (limitError) {
          return NextResponse.json({ error: limitError.message }, { status: 500 });
        }
        sendLimit = limitCheck as SendLimitResult;
        if (sendLimit?.allowed === false) {
          return NextResponse.json({
            error: `Daily ${sendChannel} limit reached (${sendLimit.limit ?? "configured cap"}/day). Try again tomorrow.`,
            limit_info: sendLimit,
          }, { status: 429 });
        }
      }

      if (isSms) {
        const smsBody = appendSmsCompliance(message);
        sendResult = await sendSms({
          to: dest,
          body: smsBody,
          fromNumber: agentPhone || undefined,
          intent: "prospecting",
          testMode,
        });
      } else if (isEmail) {
        const emailSubject = evaluatedSubject ?? `HomeReach - grow your business in ${city ?? "your area"}`;
        outboundSubject = emailSubject;
        const emailContentHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
            <p>${message.replace(/\n/g, "<br>")}</p>
          </div>
        `;
        sendResult = await sendEmail({
          to:        dest,
          subject:   emailSubject,
          html:      appendEmailComplianceHtml(emailContentHtml, dest),
          text:      appendEmailComplianceText(message, dest),
          fromEmail,
          fromName,
          replyTo:   replyToEmail,
          intent:    "prospecting",
          testMode,
        });
      }

      actualSent = sendResult?.success ?? false;
      if (actualSent && (isSms || isEmail)) {
        outboundRevenueLog = {
          channel: isSms ? "sms" : "email",
          to: dest,
          subject: outboundSubject,
          body: message,
          provider: sendResult?.provider ?? null,
          providerMessageId: sendResult?.externalId ?? null,
          metadata: {
            sales_action_type: action_type,
            test_mode: sendResult?.testMode ?? testMode,
            approval_status: approvalGate?.approval_status ?? "approved",
            source_attribution: sourceAttribution,
            deliverability,
            reputation,
          },
        };
      }

      if (sendResult && !sendResult.success) {
        console.error(`[sales/event] send failed for lead ${lead_id}:`, sendResult.error);
      }

      // ── Dedup hash: only record AFTER successful send ────────────────────
      if (actualSent && agent_id && message && lead_id) {
        const msgHash = crypto.createHash("sha256").update(message).digest("hex");
        try {
          await supabase
            .from("agent_message_hashes")
            .insert({ agent_id, lead_id, message_hash: msgHash });
        } catch { /* non-critical — ignore duplicates */ }
      }
    }

    // ── Normalize action_type to DB enum ──────────────────────────────────────
    const actionTypeMap: Record<string, string> = {
      sms_sent:             "text_sent",
      fb_message_sent:      "facebook_sent",
      bad_number_marked:    "lead_skipped",
      invalid_email_marked: "lead_skipped",
      fb_group_post:        "facebook_sent",
      email_sent:           "text_sent", // map email_sent → text_sent as fallback if needed
    };
    // email_sent is valid, keep it. Only map the non-standard ones.
    const DB_VALID_ACTIONS = new Set([
      "text_sent", "email_sent", "facebook_sent", "follow_up_sent",
      "deal_closed", "lead_skipped", "payment_link_sent",
      "reply_received", "conversation_started",
    ]);
    const finalActionType = DB_VALID_ACTIONS.has(action_type)
      ? action_type
      : (actionTypeMap[action_type] ?? action_type);

    const eventMetadata = {
      ...(metadata ?? {}),
      ...(sendResult ? { send_result: sendResult } : {}),
      ...(actualSent ? { actually_sent: true } : {}),
      ...(sendResult?.provider ? { provider: sendResult.provider } : {}),
      ...(sendResult?.testMode ? { test_mode: true } : {}),
      ...(approvalGate ? { approval_gate: approvalGate, approval_status: approvalGate.approval_status } : {}),
      ...(sourceAttribution ? { source_attribution: sourceAttribution } : {}),
      ...(deliverability ? { deliverability } : {}),
      ...(reputation ? { reputation } : {}),
      ...(sendLimit ? { send_limit: sendLimit } : {}),
    };

    // ── Insert sales_event ────────────────────────────────────────────────────
    const { data: event, error: eventError } = await supabase
      .from("sales_events")
      .insert({
        agent_id,
        lead_id,
        action_type: finalActionType,
        channel,
        city,
        category,
        message,
        revenue_cents,
        metadata: eventMetadata,
      })
      .select()
      .single();

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 });
    }

    if (actualSent && lead_id && outboundRevenueLog) {
      try {
        await recordOutboundRevenueMessage({
          businessLine: resolvedBusinessLine,
          sourceSystem: "sales_leads",
          sourceId: lead_id,
          channel: outboundRevenueLog.channel,
          to: outboundRevenueLog.to,
          subject: outboundRevenueLog.subject,
          body: outboundRevenueLog.body,
          provider: outboundRevenueLog.provider,
          providerMessageId: outboundRevenueLog.providerMessageId,
          city,
          category,
          assignedTo: agent_id ?? null,
          metadata: {
            ...(outboundRevenueLog.metadata ?? {}),
            sales_event_id: event.id,
            logged_from: "admin_sales_event",
            reputation,
          },
        });
      } catch (revenueLogError) {
        console.warn("[sales/event] revenue messaging outbound log skipped:", revenueLogError);
      }
    }

    // ── Update lead status ────────────────────────────────────────────────────
    if (lead_id) {
      const updates: Record<string, unknown> = {};

      if (SEND_ACTIONS.has(action_type)) {
        updates.status            = "contacted";
        updates.last_contacted_at = new Date().toISOString();
        updates.pipeline_stage    = "contacted";
        // Increment message count — non-critical, swallow errors
        try { await supabase.rpc("increment_lead_messages", { lead_uuid: lead_id }); } catch {}
      }

      if (["reply_received", "fb_reply_received", "conversation_started"].includes(action_type)) {
        updates.status         = "replied";
        updates.last_reply_at  = new Date().toISOString();
        updates.pipeline_stage = "replied";
        // Increment reply count — non-critical, swallow errors
        try { await supabase.rpc("increment_lead_replies", { lead_uuid: lead_id }); } catch {}
      }

      if (action_type === "payment_link_sent") {
        updates.status         = "payment_sent";
        updates.pipeline_stage = "payment_sent";
      }
      if (action_type === "deal_closed") {
        updates.status         = "closed";
        updates.pipeline_stage = "closed_won";
      }
      if (action_type === "follow_up_sent") {
        updates.next_follow_up_at = null;
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from("sales_leads").update(updates).eq("id", lead_id);
      }
    }

    return NextResponse.json({
      event,
      sent: actualSent,
      approval_status: approvalGate?.approval_status ?? (SEND_ACTIONS.has(action_type) ? "approved" : "not_required"),
      source_attribution: sourceAttribution,
      deliverability,
      send_error: sendResult?.success === false ? sendResult.error : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sales/event] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
