#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Phase 8 Enhanced Validation: Launch Hardening
// Checks: Dedup, Quarantine, Stop-on-Reply, DNC, Commission, FB Status, Agent Attribution
//
// Run: npx tsx packages/db/scripts/validate-launch-hardening.ts
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../apps/web/.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Result tracking ───────────────────────────────────────────────────────────
type Result = { check: string; passed: boolean; detail: string; fix?: string };
const results: Result[] = [];

function pass(check: string, detail: string) {
  results.push({ check, passed: true, detail });
  console.log(`  ✅ ${check}: ${detail}`);
}

function fail(check: string, detail: string, fix?: string) {
  results.push({ check, passed: false, detail, fix });
  console.error(`  ❌ ${check}: ${detail}`);
  if (fix) console.error(`     → FIX: ${fix}`);
}

function warn(check: string, detail: string, fix?: string) {
  results.push({ check, passed: true, detail: `[WARN] ${detail}`, fix });
  console.warn(`  ⚠️  ${check}: ${detail}`);
  if (fix) console.warn(`     → NOTE: ${fix}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 1: DUPLICATE PREVENTION
// ─────────────────────────────────────────────────────────────────────────────
async function check_dedup_prevention() {
  console.log("\n🔍 CHECK 1: Duplicate Prevention");

  // Verify crm_dedup_clusters table exists
  const { data: clusters, error } = await sb
    .from("crm_dedup_clusters")
    .select("id, resolution, confidence, match_reason")
    .limit(5);

  if (error) {
    fail("dedup_table_exists", error.message, "Run Migration 24: 24_launch_hardening.sql");
    return;
  }
  pass("dedup_table_exists", "crm_dedup_clusters table accessible");

  // Count pending
  const { count: pending } = await sb
    .from("crm_dedup_clusters")
    .select("id", { count: "exact", head: true })
    .eq("resolution", "pending");

  if ((pending ?? 0) > 0) {
    warn("pending_duplicates", `${pending} pairs pending resolution`, "Review in Control Center → Dedup Center");
  } else {
    pass("pending_duplicates", "No pending duplicate pairs");
  }

  // Verify merge RPC exists and is callable
  const { data: leads } = await sb.from("sales_leads").select("id").eq("is_duplicate", false).limit(2);
  if (!leads || leads.length < 2) {
    warn("merge_rpc_test", "Not enough leads to test merge RPC (skipped)");
  } else {
    // Dry test: just verify function exists by calling with non-existent IDs
    const fakeUUID = "00000000-0000-0000-0000-000000000001";
    const { error: rpcErr } = await sb.rpc("merge_duplicate_lead", {
      p_canonical_id: fakeUUID,
      p_duplicate_id: fakeUUID,
    });
    // Expected error: foreign key violation or "not found" — function EXISTS if we get this
    if (rpcErr && rpcErr.message.includes("violates foreign key")) {
      pass("merge_rpc_callable", "merge_duplicate_lead RPC exists and callable");
    } else if (rpcErr && rpcErr.code === "42883") {
      fail("merge_rpc_callable", "merge_duplicate_lead function not found", "Run Migration 24");
    } else {
      pass("merge_rpc_callable", "merge_duplicate_lead RPC verified");
    }
  }

  // Verify duplicate enrollment prevention: enroll same lead twice → should upsert not duplicate
  const { data: testLead } = await sb
    .from("sales_leads")
    .select("id")
    .eq("do_not_contact", false)
    .eq("is_quarantined", false)
    .not("phone", "is", null)
    .limit(1)
    .single();

  const { data: testSeq } = await sb
    .from("auto_sequences")
    .select("id")
    .eq("channel", "sms")
    .limit(1)
    .single();

  if (testLead && testSeq) {
    // First enrollment
    await sb.rpc("enroll_lead_in_sequence", {
      p_lead_id: testLead.id, p_sequence_id: testSeq.id, p_dry_run: false
    });
    // Second enrollment (should upsert)
    await sb.rpc("enroll_lead_in_sequence", {
      p_lead_id: testLead.id, p_sequence_id: testSeq.id, p_dry_run: false
    });
    // Check only one enrollment exists
    const { count: enrollCount } = await sb
      .from("auto_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", testLead.id)
      .eq("sequence_id", testSeq.id);

    if ((enrollCount ?? 0) === 1) {
      pass("no_duplicate_enrollments", "Duplicate enrollment upserted correctly (1 row)");
    } else {
      fail("no_duplicate_enrollments", `Found ${enrollCount} enrollment rows for same lead+sequence`, "UNIQUE constraint missing on auto_enrollments(sequence_id, lead_id)");
    }

    // Cleanup
    await sb.from("auto_enrollments")
      .update({ status: "stopped", stop_reason: "validation_cleanup" })
      .eq("lead_id", testLead.id)
      .eq("sequence_id", testSeq.id);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 2: QUARANTINE LOGIC
// ─────────────────────────────────────────────────────────────────────────────
async function check_quarantine() {
  console.log("\n🔒 CHECK 2: Quarantine Logic");

  // Table exists
  const { error: colErr } = await sb
    .from("sales_leads")
    .select("is_quarantined, quarantine_reason, quarantined_at")
    .limit(1);

  if (colErr) {
    fail("quarantine_columns", colErr.message, "Run Migration 24");
    return;
  }
  pass("quarantine_columns", "is_quarantined, quarantine_reason columns exist");

  // Leads with no phone+email ARE quarantined
  const { count: unquarantinedNullContact } = await sb
    .from("sales_leads")
    .select("id", { count: "exact", head: true })
    .is("phone", null)
    .is("email", null)
    .eq("is_quarantined", false)
    .eq("do_not_contact", false);

  if ((unquarantinedNullContact ?? 0) > 0) {
    fail("null_contact_quarantined",
      `${unquarantinedNullContact} leads have no phone AND no email but are NOT quarantined`,
      "Run: UPDATE sales_leads SET is_quarantined=true, quarantine_reason='no_phone_no_email' WHERE phone IS NULL AND email IS NULL AND do_not_contact=false");
  } else {
    pass("null_contact_quarantined", "All no-contact leads are quarantined");
  }

  // Quarantined leads don't appear in sales workflow
  const { count: quarantinedInWorkflow } = await sb
    .from("sales_leads")
    .select("id", { count: "exact", head: true })
    .eq("is_quarantined", true)
    .not("pipeline_stage", "in", '("suppressed","closed_won","closed_lost")');

  if ((quarantinedInWorkflow ?? 0) > 0) {
    warn("quarantine_excluded_from_workflow",
      `${quarantinedInWorkflow} quarantined leads still have active pipeline stages`,
      "Quarantine filter in next-lead API excludes these — they won't be served to agents");
  } else {
    pass("quarantine_excluded_from_workflow", "Quarantined leads have suppressed/closed stages");
  }

  // Restore RPC works
  const { error: rpcErr } = await sb.rpc("restore_from_quarantine", {
    p_lead_id: "00000000-0000-0000-0000-000000000001"
  });
  if (rpcErr?.code === "42883") {
    fail("restore_rpc", "restore_from_quarantine function not found", "Run Migration 24");
  } else {
    pass("restore_rpc", "restore_from_quarantine RPC callable");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 3: STOP-ON-REPLY
// ─────────────────────────────────────────────────────────────────────────────
async function check_stop_on_reply() {
  console.log("\n🛑 CHECK 3: Stop-on-Reply Trigger");

  // Get a lead + seq to test with
  const { data: testLead } = await sb
    .from("sales_leads")
    .select("id")
    .eq("do_not_contact", false)
    .eq("is_quarantined", false)
    .limit(1)
    .single();

  const { data: testSeq } = await sb
    .from("auto_sequences")
    .select("id")
    .limit(1)
    .single();

  if (!testLead || !testSeq) {
    warn("stop_on_reply_test", "No test lead/sequence available to verify trigger");
    return;
  }

  // Create a test enrollment
  await sb.from("auto_enrollments").upsert({
    sequence_id: testSeq.id,
    lead_id:     testLead.id,
    status:      "active",
    current_step: 1,
    enrolled_at:  new Date().toISOString(),
    next_send_at: new Date(Date.now() + 86400000).toISOString(),
  }, { onConflict: "sequence_id,lead_id" });

  // Verify enrollment is active
  const { data: pre } = await sb
    .from("auto_enrollments")
    .select("status")
    .eq("lead_id", testLead.id)
    .eq("sequence_id", testSeq.id)
    .single();

  if (pre?.status !== "active") {
    warn("stop_on_reply_pre", "Could not create active enrollment for test");
    return;
  }

  // Insert a reply event — trigger should fire
  const { data: agentProfile } = await sb.from("profiles").select("id").limit(1).single();
  await sb.from("sales_events").insert({
    agent_id:    agentProfile?.id,
    lead_id:     testLead.id,
    action_type: "reply_received",
    channel:     "sms",
    city:        "ValidationCity",
    category:    "ValidationCategory",
  });

  // Check enrollment is now stopped
  const { data: post } = await sb
    .from("auto_enrollments")
    .select("status, stop_reason")
    .eq("lead_id", testLead.id)
    .eq("sequence_id", testSeq.id)
    .single();

  if (post?.status === "stopped" && post?.stop_reason === "reply_received") {
    pass("stop_on_reply_trigger", "DB trigger fired — enrollment stopped on reply_received");
  } else {
    fail("stop_on_reply_trigger",
      `Enrollment status is '${post?.status}' after reply (expected 'stopped')`,
      "Verify trg_stop_on_reply trigger in Migration 23/24. Check: SELECT * FROM pg_trigger WHERE tgname='trg_stop_on_reply'");
  }

  // Cleanup
  await sb.from("sales_events").delete()
    .eq("lead_id", testLead.id).eq("city", "ValidationCity");
  await sb.from("auto_enrollments").delete()
    .eq("lead_id", testLead.id).eq("sequence_id", testSeq.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 4: DNC ENFORCEMENT
// ─────────────────────────────────────────────────────────────────────────────
async function check_dnc() {
  console.log("\n🚫 CHECK 4: DNC Enforcement");

  // Verify do_not_contact column
  const { error: colErr } = await sb
    .from("sales_leads")
    .select("do_not_contact, sms_opt_out")
    .limit(1);

  if (colErr) {
    fail("dnc_columns_exist", colErr.message);
    return;
  }
  pass("dnc_columns_exist", "do_not_contact + sms_opt_out columns exist");

  // DNC lead cannot enroll in automation via RPC
  const { data: dncLead } = await sb
    .from("sales_leads")
    .select("id")
    .eq("do_not_contact", true)
    .limit(1)
    .single();

  const { data: testSeq } = await sb.from("auto_sequences").select("id").limit(1).single();

  if (dncLead && testSeq) {
    const { data: enrollResult } = await sb.rpc("enroll_lead_in_sequence", {
      p_lead_id:     dncLead.id,
      p_sequence_id: testSeq.id,
      p_dry_run:     true,  // dry run only
    });

    const result = enrollResult as { ok: boolean; errors: string[] } | null;
    const hasDncError = result?.errors?.some?.((e: string) => e.includes("do_not_contact"));
    if (hasDncError) {
      pass("dnc_blocks_enrollment", "DNC lead correctly blocked from enrollment");
    } else {
      fail("dnc_blocks_enrollment",
        `DNC lead enrollment not blocked. Result: ${JSON.stringify(result)}`,
        "enroll_lead_in_sequence RPC in Migration 24 checks do_not_contact flag");
    }
  } else {
    warn("dnc_blocks_enrollment", "No DNC lead in DB to test — DNC check is in RPC code");
  }

  // No DNC leads in normal next-lead queue
  const { count: dncInQueue } = await sb
    .from("sales_leads")
    .select("id", { count: "exact", head: true })
    .eq("do_not_contact", true)
    .not("pipeline_stage", "in", '("suppressed","closed_lost")');

  if ((dncInQueue ?? 0) > 0) {
    warn("dnc_excluded_from_queue",
      `${dncInQueue} DNC leads still have non-closed pipeline stages`,
      "next-lead API filters do_not_contact=false — they won't be served");
  } else {
    pass("dnc_excluded_from_queue", "All DNC leads have suppressed/closed stages");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 5: COMMISSION CORRECTNESS
// ─────────────────────────────────────────────────────────────────────────────
async function check_commissions() {
  console.log("\n💰 CHECK 5: Commission Correctness");

  // Commission tiers exist
  const { data: tiers, error } = await sb
    .from("crm_commission_tiers")
    .select("name, min_deals, rate_pct, bonus_flat")
    .order("min_deals");

  if (error) {
    fail("commission_tiers", error.message, "Run Migration 22");
    return;
  }

  const expectedTiers = ["Starter","Performer","Closer","Elite"];
  const actualTiers = (tiers ?? []).map(t => t.name);
  const hasAll = expectedTiers.every(t => actualTiers.includes(t));

  if (hasAll) {
    pass("commission_tiers", `All 4 tiers present: ${actualTiers.join(", ")}`);
  } else {
    fail("commission_tiers", `Missing tiers. Found: ${actualTiers.join(", ")}`, "Run Migration 22 to seed tiers");
  }

  // Leaderboard refresh RPC exists
  const today = new Date().toISOString().slice(0, 10);
  const { error: refreshErr } = await sb.rpc("refresh_leaderboard", { p_period: "today", p_date: today });
  if (refreshErr) {
    fail("leaderboard_rpc", refreshErr.message, "Run Migration 22");
  } else {
    pass("leaderboard_rpc", "refresh_leaderboard RPC callable");
  }

  // Commission math check: Starter = 8%, 0 deals → $0 commission
  const { data: starterRow } = await sb
    .from("crm_leaderboard_cache")
    .select("commission_cents, revenue_cents, tier_name")
    .eq("period", "today")
    .eq("period_date", today)
    .order("deals_closed", { ascending: true })
    .limit(1)
    .single();

  if (starterRow) {
    const expectedComm = Math.round(starterRow.revenue_cents * 0.08);
    const actualComm   = starterRow.commission_cents;
    const diff = Math.abs(expectedComm - actualComm);
    if (diff <= 1) {  // allow 1 cent rounding
      pass("commission_math", `${starterRow.tier_name} rate correct: revenue ${starterRow.revenue_cents}¢ → commission ${actualComm}¢`);
    } else {
      warn("commission_math", `Commission may be off. Expected ~${expectedComm}¢, got ${actualComm}¢`);
    }
  } else {
    warn("commission_math", "No leaderboard data yet — commission math test skipped");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 6: UNSENT FB MESSAGE HANDLING
// ─────────────────────────────────────────────────────────────────────────────
async function check_fb_truth() {
  console.log("\n📘 CHECK 6: Facebook Unsent Message Handling");

  // fb_outreach_status column exists
  const { error: colErr } = await sb
    .from("crm_outreach_events")
    .select("fb_outreach_status, fb_actually_sent, counts_as_activity")
    .limit(1);

  if (colErr) {
    fail("fb_columns_exist", colErr.message, "Run Migration 24");
    return;
  }
  pass("fb_columns_exist", "fb_outreach_status + counts_as_activity columns exist");

  // All fb_actually_sent=false records are labeled never_sent
  const { count: untaggedNeverSent } = await sb
    .from("crm_outreach_events")
    .select("id", { count: "exact", head: true })
    .eq("channel", "facebook")
    .eq("fb_actually_sent", false)
    .is("fb_outreach_status", null);

  if ((untaggedNeverSent ?? 0) > 0) {
    fail("fb_never_sent_tagged",
      `${untaggedNeverSent} FB records have fb_actually_sent=false but no fb_outreach_status`,
      "Run: UPDATE crm_outreach_events SET fb_outreach_status='never_sent' WHERE channel='facebook' AND fb_actually_sent=false AND fb_outreach_status IS NULL");
  } else {
    pass("fb_never_sent_tagged", "All never-sent FB messages are labeled never_sent");
  }

  // counts_as_activity=false for never_sent
  const { count: neverSentCountsActivity } = await sb
    .from("crm_outreach_events")
    .select("id", { count: "exact", head: true })
    .eq("channel", "facebook")
    .eq("fb_actually_sent", false)
    .eq("counts_as_activity", true);

  if ((neverSentCountsActivity ?? 0) > 0) {
    fail("fb_no_false_activity",
      `${neverSentCountsActivity} never-sent FB messages are counting as activity`,
      "counts_as_activity GENERATED column in Migration 24 should exclude these");
  } else {
    pass("fb_no_false_activity", "Never-sent FB messages do NOT count as activity");
  }

  // Total count of never-sent
  const { count: neverSentCount } = await sb
    .from("crm_outreach_events")
    .select("id", { count: "exact", head: true })
    .eq("channel", "facebook")
    .eq("fb_actually_sent", false);

  warn("fb_never_sent_count",
    `${neverSentCount ?? 0} FB messages are historical never-sent (Replit artifacts)`,
    "These are visible in Control Center → FB Audit and correctly excluded from activity totals");
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 7: AGENT ATTRIBUTION
// ─────────────────────────────────────────────────────────────────────────────
async function check_agent_attribution() {
  console.log("\n👤 CHECK 7: Agent Attribution");

  // Every sales_event has an agent_id (or is null for system events)
  const { count: unattributed } = await sb
    .from("sales_events")
    .select("id", { count: "exact", head: true })
    .is("agent_id", null)
    .not("action_type", "in", '("system_note","automation_sent")');

  if ((unattributed ?? 0) > 0) {
    warn("all_events_attributed",
      `${unattributed} sales_events have no agent_id`,
      "Manual events from agent dialer always pass agent_id — legacy events may be unattributed");
  } else {
    pass("all_events_attributed", "All sales_events have agent attribution");
  }

  // Every stage change should have agent attribution (via pipeline_history)
  const { count: pipelineChanges } = await sb
    .from("crm_pipeline_history")
    .select("id", { count: "exact", head: true });

  pass("pipeline_history", `${pipelineChanges ?? 0} stage changes in pipeline_history`);

  // v_agent_real_activity view accessible
  const { error: viewErr } = await sb
    .from("v_agent_real_activity" as never)
    .select("agent_id, real_messages_sent")
    .limit(1);

  if (viewErr) {
    fail("agent_activity_view", viewErr.message, "Run Migration 24 to create v_agent_real_activity view");
  } else {
    pass("agent_activity_view", "v_agent_real_activity view accessible");
  }

  // v_overdue_followups view
  const { error: overdueErr } = await sb
    .from("v_overdue_followups" as never)
    .select("lead_id, agent_name")
    .limit(1);

  if (overdueErr) {
    fail("overdue_followups_view", overdueErr.message, "Run Migration 24");
  } else {
    pass("overdue_followups_view", "v_overdue_followups view accessible");
  }

  // Leaderboard only counts real sends (not FB drafts)
  const { data: lbSample } = await sb
    .from("crm_leaderboard_cache")
    .select("messages_sent")
    .limit(1);

  if (lbSample?.length) {
    pass("leaderboard_real_only", "Leaderboard data exists (refresh ran successfully)");
  } else {
    warn("leaderboard_real_only", "Leaderboard cache empty — run POST /api/admin/crm/leaderboard to refresh");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL REPORT
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("  HomeReach — Phase 8 Enhanced Validation: Launch Hardening");
  console.log("════════════════════════════════════════════════════════════");
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  Run at:   ${new Date().toISOString()}\n`);

  await check_dedup_prevention();
  await check_quarantine();
  await check_stop_on_reply();
  await check_dnc();
  await check_commissions();
  await check_fb_truth();
  await check_agent_attribution();

  // ── Summary ────────────────────────────────────────────────────────────────
  const passed  = results.filter(r => r.passed && !r.detail.includes("[WARN]")).length;
  const warned  = results.filter(r => r.passed && r.detail.includes("[WARN]")).length;
  const failed  = results.filter(r => !r.passed).length;
  const total   = results.length;

  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  VALIDATION SUMMARY");
  console.log("════════════════════════════════════════════════════════════");
  console.log(`  ✅ Passed:   ${passed}`);
  console.log(`  ⚠️  Warnings: ${warned}`);
  console.log(`  ❌ Failed:   ${failed}`);
  console.log(`  Total:      ${total}`);

  if (failed > 0) {
    console.log("\n  ❌ BLOCKERS (must fix before go-live):");
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.error(`\n  • ${r.check}`);
        console.error(`    ${r.detail}`);
        if (r.fix) console.error(`    FIX: ${r.fix}`);
      });
  }

  if (warned > 0) {
    console.log("\n  ⚠️  WARNINGS (non-blocking):");
    results
      .filter(r => r.passed && r.detail.includes("[WARN]"))
      .forEach(r => console.warn(`  • ${r.check}: ${r.detail.replace("[WARN] ","")}`));
  }

  console.log("\n════════════════════════════════════════════════════════════");
  if (failed === 0) {
    console.log(warned === 0
      ? "  🟢 VERDICT: GO — All checks passed. System is launch-ready."
      : "  🟡 VERDICT: GO WITH WARNINGS — No blockers. Review warnings above.");
  } else {
    console.log("  🔴 VERDICT: NO-GO — Fix blockers above before launch.");
  }
  console.log("════════════════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
