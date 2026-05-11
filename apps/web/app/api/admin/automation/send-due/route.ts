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
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/automation/send-due
// Processes all enrollments where next_send_at <= now.
// ACTUALLY sends via Twilio (SMS) or Mailgun (email) using agent identity.
// GET  /api/admin/automation/send-due — status check, returns pending count
// ─────────────────────────────────────────────────────────────────────────────

function renderTemplate(template: string, vars: Record<string, string>): string {
  return renderOwnerTemplate(template, vars);
}

function hashMessage(body: string): string {
  return crypto.createHash("sha256").update(body).digest("hex");
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

  if (manualApprovalMode) {
    return NextResponse.json({
      ok: false,
      reason: "manual_approval_mode",
      processed: 0,
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
    return NextResponse.json({ ok: false, reason: "system_paused", processed: 0 });
  }

  const now = new Date().toISOString();
  const envBatchLimit = Number.parseInt(process.env.OUTREACH_AUTOMATION_BATCH_LIMIT ?? "10", 10);
  const batchLimit = sysCtrl?.automation_batch_limit ?? envBatchLimit;

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
    .limit(Number.isFinite(batchLimit) && batchLimit > 0 ? batchLimit : 10);  // Conservative batch per cron run

  if (dueErr) return NextResponse.json({ error: dueErr.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ processed: 0, sent: 0, skipped: 0 });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const enrollment of [...due].sort(() => Math.random() - 0.5)) {
    const lead = enrollment.sales_leads as unknown as {
      id: string; business_name: string; contact_name: string | null;
      email: string | null; phone: string | null; city: string | null;
      category: string | null; do_not_contact: boolean; sms_opt_out: boolean;
      is_quarantined: boolean;
    };
    const sequence = enrollment.auto_sequences as unknown as {
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

    const sendChannel = sequence.channel === "sms" ? "sms" : "email";
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
        channel:  sendChannel,
        msg_hash: msgHash,
      });

    if (hashErr?.code === "23505") {
      // Duplicate message to same lead — skip
      skipped++;
      continue;
    }

    // ── ACTUALLY SEND ──────────────────────────────────────────────────────
    let sendResult: {
      success: boolean;
      externalId?: string;
      error?: string;
      provider?: string;
      testMode?: boolean;
    };

    // Add compliance footer
    const smsBody  = appendSmsCompliance(bodyRendered);
    const emailBodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <p>${bodyRendered.replace(/\n/g, "<br>")}</p>
      </div>
    `;
    const emailHtml = `
      ${appendEmailComplianceHtml(emailBodyHtml, toAddress)}
    `;

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
      await supabase.from("sales_events").insert({
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
        },
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

  return NextResponse.json({
    processed: due.length,
    sent,
    skipped,
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
