import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendSms, sendEmail } from "@homereach/services/outreach";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sales/event
// Log agent action AND actually send if it's an outbound message.
// Agent dialer calls this. Twilio/Mailgun are invoked here.
// ─────────────────────────────────────────────────────────────────────────────

const SEND_ACTIONS = new Set(["text_sent","email_sent","facebook_sent","follow_up_sent","sms_sent","fb_message_sent"]);

export async function POST(request: Request) {
  try {
  const supabase = await createClient();
  const body = await request.json();
  const {
    agent_id, lead_id, action_type, channel, city, category,
    message, revenue_cents, metadata,
    // Optional: if caller provides these, we use them directly
    to_address,
    subject,
  } = body;

  if (!action_type) {
    return NextResponse.json({ error: "action_type required" }, { status: 400 });
  }

  let sendResult: { success: boolean; externalId?: string; error?: string } | null = null;
  let actualSent = false;

  // ── Actually send if it's an outbound action ───────────────────────────────
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

    if (lead?.do_not_contact) {
      return NextResponse.json({ error: "Lead is DNC. Cannot send." }, { status: 403 });
    }
    if (lead?.is_quarantined) {
      return NextResponse.json({ error: "Lead is quarantined. Cannot send." }, { status: 403 });
    }
    if (channel === "sms" && lead?.sms_opt_out) {
      return NextResponse.json({ error: "Lead has opted out of SMS." }, { status: 403 });
    }

    // Get agent identity
    let fromEmail = process.env.MAILGUN_FROM_EMAIL ?? null;
    let fromName  = process.env.MAILGUN_FROM_NAME  ?? "HomeReach";
    let agentPhone = process.env.TWILIO_PHONE_NUMBER ?? null;

    if (agent_id) {
      // Check agent pause
      const { data: agentPause } = await supabase
        .from("agent_pause_controls")
        .select("paused")
        .eq("agent_id", agent_id)
        .single();

      if (agentPause?.paused) {
        return NextResponse.json({ error: "Your account is paused. Contact admin." }, { status: 403 });
      }

      const { data: identity } = await supabase
        .from("agent_identities")
        .select("from_email, from_name, twilio_phone, is_active")
        .eq("agent_id", agent_id)
        .single();

      if (identity?.is_active) {
        if (identity.from_email) fromEmail = identity.from_email;
        if (identity.from_name)  fromName  = identity.from_name;
        if (identity.twilio_phone) agentPhone = identity.twilio_phone;
      }

      // Check daily rate limit
      const sendChannel = (channel === "sms") ? "sms" : "email";
      const { data: limitCheck } = await supabase.rpc("check_and_increment_send_count", {
        p_agent_id: agent_id,
        p_channel:  sendChannel,
      });
      const limit = limitCheck as { allowed: boolean; reason?: string; limit?: number; remaining?: number } | null;
      if (limit && !limit.allowed) {
        return NextResponse.json({
          error: `Daily ${sendChannel} limit reached (${limit.limit}/day). Try again tomorrow.`,
          limit_info: limit,
        }, { status: 429 });
      }

      // Message variation check — don't send identical message to same lead
      if (message && lead_id) {
        const msgHash = crypto.createHash("sha256").update(message).digest("hex");
        const { error: hashInsertErr } = await supabase
          .from("agent_message_hashes")
          .insert({ agent_id, lead_id, channel: sendChannel, msg_hash: msgHash });

        if (hashInsertErr?.code === "23505") {
          return NextResponse.json({
            error: "Identical message already sent to this lead. Please use a different variation.",
          }, { status: 400 });
        }
      }
    }

    // Determine destination
    const dest = to_address ??
      (channel === "sms" ? lead?.phone : lead?.email);

    if (!dest) {
      return NextResponse.json({
        error: `No ${channel} contact for this lead. Provide to_address or update lead contact info.`,
      }, { status: 400 });
    }

    // Send
    if (channel === "sms" || action_type === "text_sent" || action_type === "sms_sent") {
      const smsBody = message.includes("STOP") ? message : `${message}\n\nReply STOP to unsubscribe.`;
      sendResult = await sendSms({ to: dest, body: smsBody });
    } else if (channel === "email" || action_type === "email_sent") {
      const emailSubject = subject ?? `HomeReach — grow your business in ${city ?? "your area"}`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <p>${message.replace(/\n/g, "<br>")}</p>
          <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            You're receiving this because your business was identified as a match for HomeReach advertising.
            <a href="https://home-reach.com/unsubscribe?email=${encodeURIComponent(dest)}">Unsubscribe</a>
          </p>
        </div>
      `;
      const origEmail = process.env.MAILGUN_FROM_EMAIL;
      const origName  = process.env.MAILGUN_FROM_NAME;
      if (fromEmail) {
        process.env.MAILGUN_FROM_EMAIL = fromEmail;
        process.env.MAILGUN_FROM_NAME  = fromName;
      }
      sendResult = await sendEmail({ to: dest, subject: emailSubject, html: emailHtml, text: message, replyTo: fromEmail ?? undefined });
      process.env.MAILGUN_FROM_EMAIL = origEmail;
      process.env.MAILGUN_FROM_NAME  = origName;
    }

    actualSent = sendResult?.success ?? false;

    if (sendResult && !sendResult.success) {
      // Log failure but don't block — still record the attempt
      console.error(`[sales/event] send failed for lead ${lead_id}:`, sendResult.error);
    }
  }

  // ── Insert event record ────────────────────────────────────────────────────
  // Normalize to DB enum values (schema uses text_sent/facebook_sent)
  const actionTypeMap: Record<string, string> = {
    sms_sent:            "text_sent",
    fb_message_sent:     "facebook_sent",
    bad_number_marked:   "lead_skipped",
    invalid_email_marked:"lead_skipped",
    fb_group_post:       "facebook_sent",
  };
  const finalActionType = actionTypeMap[action_type] ?? action_type;
  const eventMetadata = {
    ...(metadata ?? {}),
    ...(sendResult ? { send_result: sendResult } : {}),
    ...(actualSent ? { actually_sent: true } : {}),
  };

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

  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });

  // ── Update lead status ────────────────────────────────────────────────────
  if (lead_id) {
    const updates: Record<string, unknown> = {};

    if (SEND_ACTIONS.has(action_type)) {
      updates.status = "contacted";
      updates.last_contacted_at = new Date().toISOString();
      updates.pipeline_stage = "contacted";
      await supabase.rpc("increment_lead_messages", { lead_uuid: lead_id });
    }
    if (["reply_received","fb_reply_received","conversation_started"].includes(action_type)) {
      updates.status = "replied";
      updates.last_reply_at = new Date().toISOString();
      updates.pipeline_stage = "replied";
      await supabase.rpc("increment_lead_replies", { lead_uuid: lead_id });
    }
    if (action_type === "payment_link_sent") {
      updates.status = "payment_sent";
      updates.pipeline_stage = "payment_sent";
    }
    if (action_type === "deal_closed") {
      updates.status = "closed";
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
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}
