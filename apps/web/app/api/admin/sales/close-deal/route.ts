import { createServiceClient } from "@/lib/supabase/service";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { NextResponse } from "next/server";
import {
  appendEmailComplianceHtml,
  appendEmailComplianceText,
  appendSmsCompliance,
  getDefaultEmailIdentity,
  getOwnerIdentity,
  sendEmail,
  sendSms,
} from "@homereach/services/outreach";
import {
  auditDeliverabilityCopy,
  buildOutreachSourceAttribution,
} from "@/lib/sales-engine/outreach-governance";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sales/close-deal
// The "CLOSE THIS DEAL" one-tap button backend.
// Sends a final close message (SMS or email) with pricing and CTA.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CloseDealRequest {
  agent_id?: string;
  lead_id: string;
  channel: "sms" | "email";
  bundle_type?: "back" | "front" | "anchor";
  approval_id?: string;
  human_approved?: boolean;
}

interface Lead {
  id: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  category: string | null;
  business_name: string | null;
  contact_name: string | null;
  assigned_agent_id: string | null;
  do_not_contact?: boolean | null;
  sms_opt_out?: boolean | null;
  is_quarantined?: boolean | null;
  email_status?: string | null;
}

interface AgentIdentity {
  from_email: string;
  from_name: string;
  twilio_phone: string;
  reply_to_email?: string | null;
}

// ─── Twilio SMS Helper ────────────────────────────────────────────────────────

async function sendViaTwilio(
  to: string,
  from: string,
  body: string
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return {
        success: false,
        error: "Twilio credentials not configured",
      };
    }

    const form = new URLSearchParams();
    form.append("To", to);
    form.append("From", from);
    form.append("Body", body);

    const resp = await fetch(
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

    if (!resp.ok) {
      const detail = await resp.text();
      throw new Error(`Twilio ${resp.status}: ${detail}`);
    }

    const data = (await resp.json()) as { sid?: string };
    return { success: true, externalId: data.sid };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown SMS error";
    console.error("[sales/close-deal/sms]", error);
    return { success: false, error };
  }
}

// ─── Mailgun Email Helper ─────────────────────────────────────────────────────

async function sendViaMailgun(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromEmail: string;
  fromName: string;
}): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;

    if (!apiKey || !domain) {
      return {
        success: false,
        error: "Mailgun credentials not configured",
      };
    }

    const form = new URLSearchParams();
    form.set("from", `${options.fromName} <${options.fromEmail}>`);
    form.set("to", options.to);
    form.set("subject", options.subject);
    form.set("html", options.html);
    form.set("text", options.text);

    const resp = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      throw new Error(`Mailgun ${resp.status}: ${detail}`);
    }

    const data = (await resp.json()) as { id?: string };
    return { success: true, externalId: data.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown email error";
    console.error("[sales/close-deal/email]", error);
    return { success: false, error };
  }
}

// ─── Build Close Messages ─────────────────────────────────────────────────────

function buildCloseSmsMessage(
  firstName: string,
  agentName: string,
  city: string | null | undefined
): string {
  return `Hey ${firstName}, this is ${agentName}. Here are the current HomeReach package options for ${city || "your area"} so you can review the next step: https://home-reach.com/get-started

Pricing:
Back Spot: $200/mo
Front Spot: $250/mo
Anchor Spot: $600/mo

Packages include professional design, print coordination, mailing support, and category review. Reply with any questions or STOP to opt out.`;
}

function buildCloseEmailMessage(
  firstName: string,
  agentName: string,
  agentEmail: string,
  city: string | null | undefined
): { subject: string; html: string; text: string } {
  const subject = `HomeReach package details for ${city || "your area"}, ${firstName}`;

  const text = `Hi ${firstName},

I wanted to send the current HomeReach package details for your ${city ? `${city}-based ` : ""}business so you can review the next step clearly.

Here are the current package options:

Back Spot: $200/mo
Front Spot: $250/mo
Anchor Spot: $600/mo

Packages include professional design, print coordination, mailing support, and category review.

If you want to move forward, visit: https://home-reach.com/get-started

Reply with any questions and I can help you review the right option.

Thanks,

${agentName}
HomeReach
${agentEmail}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { margin-bottom: 30px; }
        .header h1 { font-size: 24px; margin: 0; color: #222; }
        .opportunity { background: #f5f5f5; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; }
        .pricing { margin: 30px 0; }
        .price-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e0e0e0; }
        .price-item:last-child { border-bottom: none; }
        .price-label { font-weight: 500; }
        .price-value { color: #0066cc; font-weight: bold; }
        .cta { display: inline-block; background: #0066cc; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 30px 0; }
        .cta:hover { background: #0052a3; }
        .footer { border-top: 1px solid #e0e0e0; padding-top: 20px; font-size: 12px; color: #666; }
        .scarcity { color: #d32f2f; font-weight: bold; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <p>Hi ${firstName},</p>
          <p>I wanted to send the current HomeReach package details for your ${city ? `<strong>${city}</strong>-based ` : ""}business so you can review the next step clearly.</p>
        </div>

        <div class="opportunity">
          <p><strong>Packages include professional design, print coordination, mailing support, and category review.</strong></p>
        </div>

        <div class="pricing">
          <h3>Available Packages:</h3>
          <div class="price-item">
            <span class="price-label">• Back Spot</span>
            <span class="price-value">$200/mo</span>
          </div>
          <p style="margin: 4px 0; font-size: 13px; color: #666;">Availability is reviewed before launch.</p>

          <div class="price-item">
            <span class="price-label">• Front Spot</span>
            <span class="price-value">$250/mo</span>
          </div>
          <p style="margin: 4px 0; font-size: 13px; color: #666;">Availability is reviewed before launch.</p>

          <div class="price-item">
            <span class="price-label">• Anchor Spot</span>
            <span class="price-value">$600/mo</span>
          </div>
          <p style="margin: 4px 0; font-size: 13px; color: #666;">Availability is reviewed before launch.</p>
        </div>

        <p><strong>What's Included:</strong></p>
        <ul>
          <li>Professional design and setup</li>
          <li>Print and mailing coordination</li>
          <li>Category review before launch</li>
        </ul>

        <a href="https://home-reach.com/get-started" class="cta">Review The Next Step</a>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">Reply with any questions and I can help you review the right option.</p>

        <div class="footer">
          <p style="margin: 10px 0;">Looking forward to working with you!</p>
          <p style="margin: 10px 0;">
            <strong>${agentName}</strong><br>
            HomeReach<br>
            <a href="mailto:${agentEmail}" style="color: #0066cc;">${agentEmail}</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html, text };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const guard = await requireAdminOrSalesAgent();
    if (!guard.ok) return guard.response;
    const user = guard.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const isSalesAgent = user.app_metadata?.user_role === "sales_agent";

    const supabase = createServiceClient();
    const body = (await request.json()) as CloseDealRequest;

    let { agent_id, lead_id, channel, bundle_type = "back" } = body;

    if (isSalesAgent) {
      agent_id = user.id;
    }

    // ── Validate request ──────────────────────────────────────────────────────
    if (!agent_id || !lead_id || !channel) {
      return NextResponse.json(
        {
          error: "Missing required fields: agent_id, lead_id, channel",
        },
        { status: 400 }
      );
    }

    // ── Load lead ─────────────────────────────────────────────────────────────
    const { data: lead, error: leadError } = await supabase
      .from("sales_leads")
      .select(
        "id, phone, email, city, category, business_name, contact_name, assigned_agent_id, do_not_contact, sms_opt_out, is_quarantined, email_status"
      )
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        {
          error: `Lead not found: ${leadError?.message || "unknown error"}`,
        },
        { status: 404 }
      );
    }

    const typedLead = lead as Lead;

    if (isSalesAgent && typedLead.assigned_agent_id && typedLead.assigned_agent_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (typedLead.do_not_contact || typedLead.is_quarantined) {
      return NextResponse.json(
        {
          error: "Lead is blocked for outbound contact",
          reason: typedLead.do_not_contact ? "do_not_contact" : "quarantined",
        },
        { status: 409 }
      );
    }

    if (channel === "sms" && typedLead.sms_opt_out) {
      return NextResponse.json({ error: "Lead has opted out of SMS", reason: "sms_opt_out" }, { status: 409 });
    }

    if (
      channel === "email" &&
      ["bounced_permanent", "complained", "unsubscribed"].includes(String(typedLead.email_status ?? "").toLowerCase())
    ) {
      return NextResponse.json({ error: "Lead email is suppressed", reason: "email_suppressed" }, { status: 409 });
    }

    // ── Verify contact method exists ──────────────────────────────────────────
    if (channel === "sms" && !typedLead.phone) {
      return NextResponse.json(
        {
          error: "No phone number available for SMS send",
        },
        { status: 400 }
      );
    }

    if (channel === "email" && !typedLead.email) {
      return NextResponse.json(
        {
          error: "No email available for email send",
        },
        { status: 400 }
      );
    }

    // ── Load agent identity ───────────────────────────────────────────────────
    const { data: agentIdentity, error: agentError } = await supabase
      .from("agent_identities")
      .select("from_email, from_name, reply_to_email, twilio_phone")
      .eq("agent_id", agent_id)
      .eq("is_active", true)
      .maybeSingle();

    if (agentError) {
      return NextResponse.json({ error: agentError.message }, { status: 500 });
    }

    const owner = getOwnerIdentity();
    const defaultEmail = getDefaultEmailIdentity();
    const agent = {
      from_email: agentIdentity?.from_email ?? defaultEmail.fromEmail,
      from_name: agentIdentity?.from_name ?? owner.name,
      reply_to_email: agentIdentity?.reply_to_email ?? defaultEmail.replyTo,
      twilio_phone: agentIdentity?.twilio_phone ?? process.env.TWILIO_PHONE_NUMBER ?? owner.cellPhone,
    } as AgentIdentity;
    const firstName = typedLead.contact_name?.split(" ")[0] ?? "there";

    // ── Build and send message ────────────────────────────────────────────────
    let closedMessage = "";
    let emailSubject: string | null = null;
    let emailHtml: string | null = null;
    let sendResult: { success: boolean; externalId?: string; error?: string; provider?: string; testMode?: boolean };

    if (channel === "sms") {
      closedMessage = buildCloseSmsMessage(firstName, agent.from_name, typedLead.city);
      closedMessage = appendSmsCompliance(closedMessage);
    } else {
      const emailData = buildCloseEmailMessage(
        firstName,
        agent.from_name,
        agent.from_email,
        typedLead.city
      );
      closedMessage = emailData.text;
      emailSubject = emailData.subject;
      emailHtml = emailData.html;
    }

    const sourceAttribution = buildOutreachSourceAttribution({
      workflow: "admin_sales_close_deal",
      channel,
      lead: typedLead,
      destination: channel === "sms" ? typedLead.phone : typedLead.email,
      templateId: `close_deal_${bundle_type}_safe_v2`,
      action: "Close-deal checkout draft",
      nextAction: "Review pricing-sensitive copy and approve before one-to-one send.",
      approvalStatus: body.approval_id || body.human_approved ? "approved" : "needs_review",
      sources: ["sales_leads", "agent_identities", "ai_outputs"],
      extraInputs: {
        bundle_type,
        approval_id: body.approval_id ?? null,
      },
    });
    const deliverability = auditDeliverabilityCopy(
      channel === "email" ? `${emailSubject ?? ""}\n\n${closedMessage}` : closedMessage,
      channel,
    );
    if (deliverability.status === "blocked") {
      return NextResponse.json({
        sent: false,
        approval_status: "needs_review",
        reason: "Close-deal copy contains unsupported claims and must be revised before sending.",
        source_attribution: sourceAttribution,
        deliverability,
      }, { status: 422 });
    }

    const oneTapLiveEnabled = process.env.CLOSE_DEAL_ONE_TAP_LIVE_ENABLED === "true";
    const hasApprovedOutput = Boolean(body.approval_id);
    const hasEnvBackedHumanApproval = oneTapLiveEnabled && body.human_approved === true;

    if (!hasApprovedOutput && !hasEnvBackedHumanApproval) {
      await supabase.from("sales_events").insert({
        agent_id,
        lead_id,
        action_type: "lead_loaded",
        channel,
        city: typedLead.city,
        category: typedLead.category,
        message: closedMessage,
        metadata: {
          bundle_type,
          approval_status: "needs_review",
          workflow: "close_deal_draft",
          live_send_blocked: true,
          reason: "explicit_approval_required",
          source_attribution: sourceAttribution,
          deliverability,
        },
      });

      return NextResponse.json(
        {
          sent: false,
          requires_approval: true,
          approval_status: "needs_review",
          reason: "Close-deal messages include pricing and conversion language, so HomeReach requires explicit approval before live send.",
          draft: {
            channel,
            subject: emailSubject,
            body: closedMessage,
          },
          source_attribution: sourceAttribution,
          deliverability,
          next_action: "Review the draft, approve it in the AI/output approval workflow, then resend with approval_id.",
        },
        { status: 202 }
      );
    }

    if (body.approval_id) {
      const { data: approval, error: approvalError } = await supabase
        .from("ai_outputs")
        .select("id, approval_status, verification_status")
        .eq("id", body.approval_id)
        .maybeSingle();

      if (approvalError || approval?.approval_status !== "approved") {
        return NextResponse.json(
          {
            error: "Approved AI output is required before sending this close-deal message",
            approval_status: approval?.approval_status ?? "missing",
          },
          { status: 409 }
        );
      }
    }

    const { data: systemControls } = await supabase
      .from("system_controls")
      .select("all_paused,sms_paused,email_paused,outreach_test_mode")
      .eq("id", 1)
      .maybeSingle();
    const channelPaused = channel === "sms" ? Boolean(systemControls?.sms_paused) : Boolean(systemControls?.email_paused);

    if (systemControls?.all_paused || channelPaused || systemControls?.outreach_test_mode) {
      const reason = systemControls?.all_paused
        ? "global_system_pause"
        : channelPaused
          ? `${channel}_channel_pause`
          : "outreach_test_mode";
      await logPlatformAuditEvent({
        actorType: "human",
        module: "sales_outreach",
        actionType: "close_deal_send_blocked",
        entityType: "sales_lead",
        entityId: lead_id,
        channel,
        resultStatus: "blocked",
        approvalState: hasApprovedOutput || hasEnvBackedHumanApproval ? "approved" : "needs_review",
        severity: "high",
        message: `Close-deal ${channel} send blocked by ${reason}.`,
        metadata: { reason, approval_id: body.approval_id ?? null },
      });

      return NextResponse.json({
        sent: false,
        approval_status: hasApprovedOutput || hasEnvBackedHumanApproval ? "approved" : "needs_review",
        reason: `Close-deal send blocked by ${reason}.`,
        source_attribution: sourceAttribution,
        deliverability,
      }, { status: 423 });
    }

    if (channel === "sms") {
      sendResult = await sendSms({
        to: typedLead.phone!,
        fromNumber: agent.twilio_phone,
        body: closedMessage,
        intent: "follow_up",
      });
    } else {
      sendResult = await sendEmail({
        to: typedLead.email!,
        subject: emailSubject ?? "HomeReach next steps",
        html: appendEmailComplianceHtml(emailHtml ?? "", typedLead.email ?? undefined),
        text: appendEmailComplianceText(closedMessage, typedLead.email ?? undefined),
        fromEmail: agent.from_email,
        fromName: agent.from_name,
        replyTo: agent.reply_to_email ?? undefined,
        intent: "follow_up",
      });
    }

    if (!sendResult.success) {
      console.error(
        `[sales/close-deal] Failed to send ${channel} to ${lead_id}:`,
        sendResult.error
      );
      return NextResponse.json(
        {
          error: `Failed to send ${channel}: ${sendResult.error}`,
        },
        { status: 500 }
      );
    }

    // ── Log to sales_events ───────────────────────────────────────────────────
    await supabase.from("sales_events").insert({
      agent_id,
      lead_id,
      action_type: channel === "sms" ? "text_sent" : "email_sent",
      channel,
      city: typedLead.city,
      category: typedLead.category,
      message: closedMessage,
      metadata: {
        bundle_type,
        approval_id: body.approval_id ?? null,
        approval_status: body.approval_id ? "approved" : "env_human_approved",
        external_id: sendResult.externalId,
        provider: sendResult.provider,
        test_mode: sendResult.testMode ?? false,
        source_attribution: sourceAttribution,
        deliverability,
      },
    });

    // ── Update lead status ────────────────────────────────────────────────────
    await supabase
      .from("sales_leads")
      .update({
        status: "payment_sent",
        last_contacted_at: new Date().toISOString(),
        pipeline_stage: "payment_sent",
      })
      .eq("id", lead_id);

    return NextResponse.json({
      sent: true,
      message_sent: closedMessage,
      channel,
      source_attribution: sourceAttribution,
      deliverability,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sales/close-deal] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
