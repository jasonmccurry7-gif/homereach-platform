import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendSms, sendEmail } from "@homereach/services/outreach";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/automation/send-due
// Processes all enrollments where next_send_at <= now.
// ACTUALLY sends via Twilio (SMS) or Mailgun (email) using agent identity.
// GET  /api/admin/automation/send-due — status check, returns pending count
// ─────────────────────────────────────────────────────────────────────────────

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function hashMessage(body: string): string {
  return crypto.createHash("sha256").update(body).digest("hex");
}

export async function POST(req: NextRequest) {
  // Allow cron or admin to trigger
  const secret = req.headers.get("x-cron-secret");
  const isCron = secret === process.env.CRON_SECRET;
  const supabase = await createClient();

  // Check system pause
  const { data: sysCtrl } = await supabase
    .from("system_controls")
    .select("all_paused")
    .eq("id", 1)
    .single();

  if (sysCtrl?.all_paused) {
    return NextResponse.json({ ok: false, reason: "system_paused", processed: 0 });
  }

  const now = new Date().toISOString();

  // Fetch due enrollments (active, sequence active, not paused agent)
  const { data: due, error: dueErr } = await supabase
    .from("auto_enrollments")
    .select(`
      id, sequence_id, lead_id, agent_id, current_step,
      auto_sequences!inner ( id, channel, stop_on_reply, status ),
      sales_leads!inner (
        id, business_name, contact_name, email, phone, city, category,
        do_not_contact, sms_opt_out, is_quarantined
      )
    `)
    .eq("status", "active")
    .lte("next_send_at", now)
    .eq("auto_sequences.status", "active")
    .limit(50);  // Batch of 50 per run

  if (dueErr) return NextResponse.json({ error: dueErr.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ processed: 0, sent: 0, skipped: 0 });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const enrollment of due) {
    const lead = enrollment.sales_leads as {
      id: string; business_name: string; contact_name: string | null;
      email: string | null; phone: string | null; city: string | null;
      category: string | null; do_not_contact: boolean; sms_opt_out: boolean;
      is_quarantined: boolean;
    };
    const sequence = enrollment.auto_sequences as {
      id: string; channel: string; stop_on_reply: boolean; status: string;
    };

    // Safety checks
    if (lead.do_not_contact || lead.is_quarantined) {
      await supabase.from("auto_enrollments").update({
        status: "stopped", stopped_at: now,
        stop_reason: lead.do_not_contact ? "do_not_contact" : "quarantined",
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
    if (!fromEmail) fromEmail = process.env.MAILGUN_FROM_EMAIL ?? null;
    if (!fromName)  fromName  = process.env.MAILGUN_FROM_NAME  ?? "HomeReach";
    if (!twilioPhone) twilioPhone = process.env.TWILIO_PHONE_NUMBER ?? null;

    // Check agent daily send limit
    if (agentId) {
      const { data: limitCheck } = await supabase.rpc("check_and_increment_send_count", {
        p_agent_id: agentId,
        p_channel:  sequence.channel,
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
    const vars: Record<string, string> = {
      business_name: lead.business_name ?? "",
      contact_name:  lead.contact_name  ?? lead.business_name ?? "there",
      city:          lead.city          ?? "your area",
      category:      lead.category      ?? "your business",
    };
    const bodyRendered    = renderTemplate(step.body, vars);
    const subjectRendered = step.subject ? renderTemplate(step.subject, vars) : "HomeReach — grow your business";

    // Check message hash (prevent identical repeat sends to same lead)
    const msgHash = hashMessage(bodyRendered);
    const { error: hashErr } = await supabase
      .from("agent_message_hashes")
      .insert({
        agent_id: agentId ?? process.env.ADMIN_SYSTEM_USER_ID,
        lead_id:  lead.id,
        channel:  sequence.channel,
        msg_hash: msgHash,
      });

    if (hashErr?.code === "23505") {
      // Duplicate message to same lead — skip
      skipped++;
      continue;
    }

    // ── ACTUALLY SEND ──────────────────────────────────────────────────────
    let sendResult: { success: boolean; externalId?: string; error?: string };

    // Add compliance footer
    const smsBody  = `${bodyRendered}\n\nReply STOP to unsubscribe.`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <p>${bodyRendered.replace(/\n/g, "<br>")}</p>
        <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
          You're receiving this because your business was identified as a match for HomeReach advertising.
          <a href="https://home-reach.com/unsubscribe?email=${encodeURIComponent(toAddress)}">Unsubscribe</a>
        </p>
      </div>
    `;

    if (sequence.channel === "sms") {
      sendResult = await sendSms({ to: toAddress, body: smsBody });
    } else {
      // Use agent's from_email if available, else fallback
      const emailFrom = fromEmail!;
      const overrideEnv = fromEmail ? {
        ...process.env,
        MAILGUN_FROM_EMAIL: emailFrom,
        MAILGUN_FROM_NAME:  fromName ?? "HomeReach",
      } : {};
      // Temporarily patch env for this send (Mailgun reads from process.env)
      const origEmail = process.env.MAILGUN_FROM_EMAIL;
      const origName  = process.env.MAILGUN_FROM_NAME;
      if (fromEmail) {
        process.env.MAILGUN_FROM_EMAIL = fromEmail;
        process.env.MAILGUN_FROM_NAME  = fromName ?? "HomeReach";
      }
      sendResult = await sendEmail({
        to:      toAddress,
        subject: subjectRendered,
        html:    emailHtml,
        text:    smsBody,
        replyTo: fromEmail ?? undefined,
      });
      if (fromEmail) {
        process.env.MAILGUN_FROM_EMAIL = origEmail;
        process.env.MAILGUN_FROM_NAME  = origName;
      }
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
      await supabase.from("sales_events").insert({
        agent_id:    agentId,
        lead_id:     lead.id,
        action_type: sequence.channel === "sms" ? "sms_sent" : "email_sent",
        channel:     sequence.channel,
        city:        lead.city,
        category:    lead.category,
        message:     bodyRendered,
        metadata:    { auto: true, sequence_id: enrollment.sequence_id, external_id: sendResult.externalId },
      });
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
      const nextSendAt = new Date(Date.now() + nextStep.delay_hours * 60 * 60 * 1000).toISOString();
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

  return NextResponse.json({
    processed: due.length,
    sent,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}

export async function GET() {
  const supabase = await createClient();
  const now = new Date().toISOString();

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
  });
}
