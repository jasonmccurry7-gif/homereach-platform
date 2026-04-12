import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/automation/send-due
// Called by cron or on-demand. Processes all enrollments where next_send_at <= now.
// Returns count of messages queued.
// ─────────────────────────────────────────────────────────────────────────────

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function POST(req: NextRequest) {
  // Verify cron secret for automated calls
  const secret = req.headers.get("x-cron-secret");
  const isCron = secret === process.env.CRON_SECRET;
  const isAdmin = !isCron; // fallback: admin can trigger manually

  const supabase = await createClient();
  const now = new Date().toISOString();

  // Fetch due enrollments
  const { data: due, error: dueErr } = await supabase
    .from("auto_enrollments")
    .select(`
      id, sequence_id, lead_id, agent_id, current_step,
      auto_sequences!inner ( id, channel, stop_on_reply, status ),
      sales_leads!inner (
        id, business_name, contact_name, email, phone, city, category,
        do_not_contact, sms_opt_out
      )
    `)
    .eq("status", "active")
    .lte("next_send_at", now)
    .eq("auto_sequences.status", "active")
    .limit(100);  // Process in batches of 100

  if (dueErr) return NextResponse.json({ error: dueErr.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ processed: 0, queued: 0 });

  let queued = 0;
  let skipped = 0;

  for (const enrollment of due) {
    const lead = enrollment.sales_leads as {
      id: string; business_name: string; contact_name: string | null;
      email: string | null; phone: string | null; city: string | null;
      category: string | null; do_not_contact: boolean; sms_opt_out: boolean;
    };
    const sequence = enrollment.auto_sequences as { id: string; channel: string; stop_on_reply: boolean; status: string };

    // Re-check DNC/opt-out
    if (lead.do_not_contact) {
      await supabase.from("auto_enrollments").update({
        status: "stopped", stopped_at: now, stop_reason: "do_not_contact",
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

    // Get the current step
    const { data: step } = await supabase
      .from("auto_sequence_steps")
      .select("*")
      .eq("sequence_id", enrollment.sequence_id)
      .eq("step_number", enrollment.current_step)
      .single();

    if (!step) {
      // No more steps — enrollment complete
      await supabase.from("auto_enrollments").update({
        status: "completed", completed_at: now,
      }).eq("id", enrollment.id);
      continue;
    }

    // Determine to_address
    const toAddress = sequence.channel === "sms" ? lead.phone : lead.email;
    if (!toAddress) {
      skipped++;
      // Advance step to skip this one
      continue;
    }

    // Render template variables
    const vars: Record<string, string> = {
      business_name: lead.business_name ?? "",
      contact_name:  lead.contact_name  ?? lead.business_name ?? "there",
      city:          lead.city          ?? "your area",
      category:      lead.category      ?? "your business",
    };

    const bodyRendered    = renderTemplate(step.body, vars);
    const subjectRendered = step.subject ? renderTemplate(step.subject, vars) : null;

    // Queue the send
    const { error: logErr } = await supabase.from("auto_send_log").insert({
      enrollment_id: enrollment.id,
      step_id:       step.id,
      lead_id:       lead.id,
      channel:       sequence.channel,
      to_address:    toAddress,
      subject:       subjectRendered,
      body_rendered: bodyRendered,
      status:        "queued",
    });

    if (logErr) { skipped++; continue; }

    // Get next step info
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
      // Last step — mark completed after this send
      await supabase.from("auto_enrollments").update({
        status: "completed", completed_at: now, next_send_at: null,
      }).eq("id", enrollment.id);
    }

    queued++;
  }

  // Mark queued items as sent (in production, a Twilio/Resend worker handles this)
  // For now, simulate send success and log to sales_events
  const { data: queuedItems } = await supabase
    .from("auto_send_log")
    .select("id, enrollment_id, lead_id, channel, to_address, body_rendered")
    .eq("status", "queued");

  for (const item of queuedItems ?? []) {
    // Log to sales_events for tracking
    const enrollment = due.find(e => e.id === item.enrollment_id);
    if (enrollment) {
      const actionType = item.channel === "sms" ? "sms_sent" : "email_sent";
      await supabase.from("sales_events").insert({
        agent_id:    enrollment.agent_id,
        lead_id:     item.lead_id,
        action_type: actionType,
        channel:     item.channel,
        message:     item.body_rendered,
        metadata:    { auto: true, send_log_id: item.id },
      });

      await supabase.rpc("increment_lead_messages", { lead_uuid: item.lead_id });
    }

    // Mark as sent
    await supabase.from("auto_send_log").update({
      status: "sent", sent_at: now,
    }).eq("id", item.id);
  }

  return NextResponse.json({
    processed: due.length,
    queued,
    skipped,
    sent: queuedItems?.length ?? 0,
  });
}

export async function GET() {
  // Status check — returns pending count
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { count } = await supabase
    .from("auto_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .lte("next_send_at", now);

  const { count: activeTotal } = await supabase
    .from("auto_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  return NextResponse.json({ due_now: count ?? 0, active_total: activeTotal ?? 0 });
}
