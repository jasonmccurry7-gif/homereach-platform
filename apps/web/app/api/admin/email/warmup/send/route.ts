import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@homereach/services/outreach";
import {
  WARMUP_SEED_EMAILS,
  getRampEntry,
  getSeedTemplate,
} from "@/lib/sales-engine/email-warmup-config";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/email/warmup/send
// Cron: daily at 7 AM UTC — runs warm-up sends for every active agent identity.
//
// Logic per agent:
//  1. Look up (or initialize) their warm-up state.
//  2. Calculate today's target and seed vs. real split.
//  3. Send seed emails first (jasonmccurry7@gmail.com, livetogivemarketing@gmail.com).
//  4. Fill remainder from real prospect pool (opted-in, not yet contacted today).
//  5. Log every send to email_warmup_log. Advance warmup_day.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader  = req.headers.get("authorization");
  const cronSecret  = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const now = new Date().toISOString();
  const summary = { agents_processed: 0, seeds_sent: 0, real_sent: 0, errors: 0 };

  // ── Load all active agent identities ────────────────────────────────────────
  const { data: identities } = await db
    .from("agent_identities")
    .select("agent_id, from_email, from_name, is_active")
    .eq("is_active", true);

  if (!identities?.length) {
    return NextResponse.json({ ok: true, message: "No active identities", summary });
  }

  for (const identity of identities) {
    try {
      // ── Get or initialize warm-up state ──────────────────────────────────
      let { data: state } = await db
        .from("email_warmup_state")
        .select("*")
        .eq("agent_id", identity.agent_id)
        .eq("from_email", identity.from_email)
        .maybeSingle();

      if (!state) {
        // First time — create state
        const { data: newState } = await db
          .from("email_warmup_state")
          .insert({
            agent_id:   identity.agent_id,
            from_email: identity.from_email,
            warmup_day: 1,
            is_active:  true,
            started_at: now,
          })
          .select()
          .single();
        state = newState;
      }

      if (!state || !state.is_active) continue;

      // ── Calculate today's targets ──────────────────────────────────────────
      const ramp         = getRampEntry(state.warmup_day);
      const seedCount    = Math.ceil(ramp.dailyTarget * ramp.seedRatio);
      const realCount    = ramp.dailyTarget - seedCount;

      // ── Send seed emails ───────────────────────────────────────────────────
      let seedsSent = 0;
      for (let i = 0; i < Math.min(seedCount, WARMUP_SEED_EMAILS.length * 2); i++) {
        const toEmail  = WARMUP_SEED_EMAILS[i % WARMUP_SEED_EMAILS.length]!;
        const template = getSeedTemplate(state.warmup_day, i);

        // Temporarily set agent's from address
        const savedFromEmail = process.env.MAILGUN_FROM_EMAIL;
        const savedFromName  = process.env.MAILGUN_FROM_NAME;
        process.env.MAILGUN_FROM_EMAIL = identity.from_email;
        process.env.MAILGUN_FROM_NAME  = identity.from_name ?? "HomeReach";

        const result = await sendEmail({
          to:      toEmail,
          subject: template.subject,
          html:    `<div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
            <p>${template.body}</p>
          </div>`,
          text:    template.body,
        });

        process.env.MAILGUN_FROM_EMAIL = savedFromEmail;
        process.env.MAILGUN_FROM_NAME  = savedFromName;

        await db.from("email_warmup_log").insert({
          state_id:   state.id,
          agent_id:   identity.agent_id,
          from_email: identity.from_email,
          to_email:   toEmail,
          subject:    template.subject,
          is_seed:    true,
          warmup_day: state.warmup_day,
          status:     result.success ? "sent" : "failed",
          mailgun_id: result.externalId ?? null,
          error:      result.error ?? null,
          sent_at:    result.success ? now : null,
        });

        if (result.success) { seedsSent++; summary.seeds_sent++; }
        else { summary.errors++; }
      }

      // ── Send real prospect emails (Days 4+) ────────────────────────────────
      let realSent = 0;
      if (realCount > 0) {
        // Pull prospects: has email, not do_not_contact, not quarantined
        // not contacted today, ordered by oldest first
        const todayStr = now.split("T")[0]!;
        const { data: prospects } = await db
          .from("sales_leads")
          .select("id, business_name, contact_name, email")
          .eq("do_not_contact", false)
          .eq("is_quarantined", false)
          .not("email", "is", null)
          .not("id", "in",
            // Exclude leads already emailed today by this agent
            db
              .from("email_warmup_log")
              .select("lead_id")
              .eq("agent_id", identity.agent_id)
              .gte("sent_at", `${todayStr}T00:00:00.000Z`)
              .neq("to_email", "")
          )
          .limit(realCount);

        for (const prospect of prospects ?? []) {
          if (!prospect.email) continue;
          const contactName = prospect.contact_name ?? prospect.business_name ?? "there";
          const template    = getSeedTemplate(state.warmup_day, realSent + seedsSent);

          const savedFromEmail = process.env.MAILGUN_FROM_EMAIL;
          const savedFromName  = process.env.MAILGUN_FROM_NAME;
          process.env.MAILGUN_FROM_EMAIL = identity.from_email;
          process.env.MAILGUN_FROM_NAME  = identity.from_name ?? "HomeReach";

          const result = await sendEmail({
            to:      prospect.email,
            subject: template.subject,
            html:    `<div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
              <p>${template.body}</p>
              <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">
                You're receiving this from HomeReach.
                <a href="https://home-reach.com/unsubscribe?email=${encodeURIComponent(prospect.email)}">Unsubscribe</a>
              </p>
            </div>`,
            text:    `${template.body}\n\nTo unsubscribe: https://home-reach.com/unsubscribe?email=${encodeURIComponent(prospect.email)}`,
          });

          process.env.MAILGUN_FROM_EMAIL = savedFromEmail;
          process.env.MAILGUN_FROM_NAME  = savedFromName;

          await db.from("email_warmup_log").insert({
            state_id:   state.id,
            agent_id:   identity.agent_id,
            from_email: identity.from_email,
            to_email:   prospect.email,
            subject:    template.subject,
            is_seed:    false,
            warmup_day: state.warmup_day,
            status:     result.success ? "sent" : "failed",
            mailgun_id: result.externalId ?? null,
            error:      result.error ?? null,
            sent_at:    result.success ? now : null,
          });

          if (result.success) { realSent++; summary.real_sent++; }
          else { summary.errors++; }
        }
      }

      // ── Advance warm-up day and update totals ──────────────────────────────
      await db
        .from("email_warmup_state")
        .update({
          warmup_day:  state.warmup_day + 1,
          total_sent:  (state.total_sent ?? 0) + seedsSent + realSent,
          last_run_at: now,
        })
        .eq("id", state.id);

      summary.agents_processed++;

    } catch (err) {
      console.error(`[warmup/send] agent ${identity.agent_id} error:`, err);
      summary.errors++;
    }
  }

  return NextResponse.json({ ok: true, summary });
}
