import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sales/event
// Log agent action AND actually send if it's an outbound message.
// Uses service-role client to bypass RLS entirely.
// ─────────────────────────────────────────────────────────────────────────────

const SEND_ACTIONS = new Set([
  "text_sent", "email_sent", "facebook_sent", "follow_up_sent",
  "sms_sent", "fb_message_sent",
]);

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
    const supabase = createServiceClient();
    const body = await request.json();

    const {
      agent_id, lead_id, action_type, channel, city, category,
      message, revenue_cents, metadata,
      to_address, subject,
    } = body;

    if (!action_type) {
      return NextResponse.json({ error: "action_type required" }, { status: 400 });
    }

    let sendResult: { success: boolean; externalId?: string; error?: string } | null = null;
    let actualSent = false;

    // ── Actually send outbound messages ─────────────────────────────────────
    if (SEND_ACTIONS.has(action_type) && lead_id && message) {
      // Check system pause
      const { data: sysCtrl } = await supabase
        .from("system_controls")
        .select("all_paused")
        .eq("id", 1)
        .single();

      if (sysCtrl?.all_paused) {
        return NextResponse.json({ error: "System is paused. Cannot send." }, { status: 403 });
      }

      // Get lead contact info
      const { data: lead } = await supabase
        .from("sales_leads")
        .select("phone, email, do_not_contact, sms_opt_out, is_quarantined, business_name")
        .eq("id", lead_id)
        .single();

      if (lead?.do_not_contact)
        return NextResponse.json({ error: "Lead is DNC. Cannot send." }, { status: 403 });
      if (lead?.is_quarantined)
        return NextResponse.json({ error: "Lead is quarantined. Cannot send." }, { status: 403 });
      if (channel === "sms" && lead?.sms_opt_out)
        return NextResponse.json({ error: "Lead has opted out of SMS." }, { status: 403 });

      // Resolve agent identity (from DB, fallback to env vars)
      let fromEmail    = process.env.MAILGUN_FROM_EMAIL ?? "jason@home-reach.com";
      let fromName     = "HomeReach";
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
          .select("from_email, from_name, twilio_phone, is_active")
          .eq("agent_id", agent_id)
          .maybeSingle();

        if (identity?.is_active) {
          if (identity.from_email)  fromEmail  = identity.from_email;
          if (identity.from_name)   fromName   = identity.from_name;
          if (identity.twilio_phone) agentPhone = identity.twilio_phone;
        }

        // Daily rate limit check
        const sendChannel = channel === "sms" ? "sms" : "email";
        const { data: limitCheck } = await supabase.rpc("check_and_increment_send_count", {
          p_agent_id: agent_id,
          p_channel:  sendChannel,
        });
        const limit = limitCheck as { allowed: boolean; reason?: string; limit?: number } | null;
        if (limit && !limit.allowed) {
          return NextResponse.json({
            error: `Daily ${sendChannel} limit reached (${limit.limit}/day). Try again tomorrow.`,
            limit_info: limit,
          }, { status: 429 });
        }
        // Note: dedup hash is inserted AFTER successful send (see below)
      }

      // Resolve destination address
      const dest = to_address ?? (channel === "sms" ? lead?.phone : lead?.email);
      if (!dest) {
        return NextResponse.json({
          error: `No ${channel} contact info for this lead.`,
        }, { status: 400 });
      }

      // Send
      const isSms = channel === "sms" || action_type === "text_sent" || action_type === "sms_sent";
      const isEmail = channel === "email" || action_type === "email_sent";

      if (isSms) {
        const smsBody = message.includes("STOP")
          ? message
          : `${message}\n\nReply STOP to unsubscribe.`;
        sendResult = await sendViaTwilio(dest, agentPhone, smsBody);
      } else if (isEmail) {
        const emailSubject = subject ?? `HomeReach — grow your business in ${city ?? "your area"}`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
            <p>${message.replace(/\n/g, "<br>")}</p>
            <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">
              You're receiving this because your business was identified as a match for HomeReach advertising.
              <a href="https://home-reach.com/unsubscribe?email=${encodeURIComponent(dest)}">Unsubscribe</a>
            </p>
          </div>
        `;
        sendResult = await sendViaMailgun({
          to:        dest,
          subject:   emailSubject,
          html:      emailHtml,
          text:      message,
          fromEmail,
          fromName,
          replyTo:   fromEmail,
        });
      }

      actualSent = sendResult?.success ?? false;

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
      send_error: sendResult?.success === false ? sendResult.error : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sales/event] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
