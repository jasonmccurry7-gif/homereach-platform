import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sales/close-deal
// The "CLOSE THIS DEAL" one-tap button backend.
// Sends a final close message (SMS or email) with pricing and CTA.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CloseDealRequest {
  agent_id: string;
  lead_id: string;
  channel: "sms" | "email";
  bundle_type?: "back" | "front" | "anchor";
}

interface Lead {
  id: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  category: string | null;
  business_name: string | null;
  contact_name: string | null;
}

interface AgentIdentity {
  from_email: string;
  from_name: string;
  twilio_phone: string;
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
  return `Hey ${firstName}, this is ${agentName} — wanted to lock in your spot before someone else grabs it. Here's everything you need to get started: https://home-reach.com/get-started

Pricing:
• Back Spot: $200/mo (6 available)
• Front Spot: $250/mo (3 available)
• Anchor Spot: $600/mo (1 available — exclusive)

All include 2,500+ homeowners in ${city || "your area"}, professional design, and category exclusivity. Takes 3 minutes to lock in. Reply STOP to opt out.`;
}

function buildCloseEmailMessage(
  firstName: string,
  agentName: string,
  agentEmail: string,
  city: string | null | undefined
): { subject: string; html: string; text: string } {
  const subject = `Your ${city || "local"} spot — lock it in today, ${firstName}`;

  const text = `Hi ${firstName},

I wanted to personally reach out with an exclusive opportunity to grow your ${city ? `${city}-based ` : ""}business.

We're offering limited advertising spots in your category with guaranteed access to 2,500+ local homeowners. Here's what's available:

• Back Spot: $200/mo (6 available)
• Front Spot: $250/mo (3 available)
• Anchor Spot: $600/mo (1 available — exclusive)

All packages include professional design, category exclusivity, and direct homeowner access.

Ready to lock in your spot? Visit: https://home-reach.com/get-started

It takes just 3 minutes to secure your position before another business in your category claims it.

Looking forward to working with you!

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
          <p>I wanted to personally reach out with an exclusive opportunity to grow your ${city ? `<strong>${city}</strong>-based ` : ""}business.</p>
        </div>

        <div class="opportunity">
          <p><strong>We're offering limited advertising spots in your category with guaranteed access to 2,500+ local homeowners.</strong></p>
        </div>

        <div class="pricing">
          <h3>Available Packages:</h3>
          <div class="price-item">
            <span class="price-label">• Back Spot</span>
            <span class="price-value">$200/mo</span>
          </div>
          <p style="margin: 4px 0; font-size: 13px; color: #666;">6 available</p>

          <div class="price-item">
            <span class="price-label">• Front Spot</span>
            <span class="price-value">$250/mo</span>
          </div>
          <p style="margin: 4px 0; font-size: 13px; color: #666;">3 available</p>

          <div class="price-item">
            <span class="price-label">• Anchor Spot</span>
            <span class="price-value">$600/mo</span>
          </div>
          <p style="margin: 4px 0; font-size: 13px; color: #666;">1 available — exclusive</p>
        </div>

        <p><strong>What's Included:</strong></p>
        <ul>
          <li>2,500+ local homeowners in ${city || "your area"}</li>
          <li>Professional design & setup</li>
          <li>Category exclusivity</li>
        </ul>

        <p class="scarcity">⚡ Only a few spots remaining in ${city || "your area"}. Lock yours in today.</p>

        <a href="https://home-reach.com/get-started" class="cta">Lock In Your Spot</a>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">It takes just 3 minutes to secure your position before another business claims it.</p>

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
    const supabase = createServiceClient();
    const body = (await request.json()) as CloseDealRequest;

    const { agent_id, lead_id, channel, bundle_type = "back" } = body;

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
        "id, phone, email, city, category, business_name, contact_name"
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
      .select("from_email, from_name, twilio_phone")
      .eq("agent_id", agent_id)
      .eq("is_active", true)
      .single();

    if (agentError || !agentIdentity) {
      return NextResponse.json(
        {
          error: `Agent identity not found: ${agentError?.message || "unknown error"}`,
        },
        { status: 404 }
      );
    }

    const agent = agentIdentity as AgentIdentity;
    const firstName = typedLead.contact_name
      ? typedLead.contact_name.split(" ")[0]
      : "there";

    // ── Build and send message ────────────────────────────────────────────────
    let closedMessage = "";
    let sendResult: { success: boolean; externalId?: string; error?: string };

    if (channel === "sms") {
      closedMessage = buildCloseSmsMessage(firstName, agent.from_name, typedLead.city);
      sendResult = await sendViaTwilio(
        typedLead.phone!,
        agent.twilio_phone,
        closedMessage
      );
    } else {
      const emailData = buildCloseEmailMessage(
        firstName,
        agent.from_name,
        agent.from_email,
        typedLead.city
      );
      closedMessage = emailData.text;
      sendResult = await sendViaMailgun({
        to: typedLead.email!,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        fromEmail: agent.from_email,
        fromName: agent.from_name,
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
        twilio_sid: sendResult.externalId,
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
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sales/close-deal] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
