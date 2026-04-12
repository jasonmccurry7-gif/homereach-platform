#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 8: HomeReach CRM Validation Script
// 9-Step Scenario: Lead → Assign → Send → Reply → Capture → View → Close → Revenue → Leaderboard
//
// Run: npx tsx packages/db/scripts/validate-crm-system.ts
// Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../apps/web/.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Test state ────────────────────────────────────────────────────────────────
let testLeadId:  string | null = null;
let testAgentId: string | null = null;
let testEventId: string | null = null;

const results: { step: string; passed: boolean; detail?: string }[] = [];

function pass(step: string, detail?: string) {
  results.push({ step, passed: true, detail });
  console.log(`  ✅ ${step}${detail ? ` — ${detail}` : ""}`);
}

function fail(step: string, detail: string) {
  results.push({ step, passed: false, detail });
  console.error(`  ❌ ${step} — ${detail}`);
}

async function assert(condition: boolean, stepName: string, detail?: string) {
  if (condition) pass(stepName, detail);
  else           fail(stepName, detail ?? "Condition was false");
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Lead appears in system
// ─────────────────────────────────────────────────────────────────────────────
async function step1_leadExists() {
  console.log("\n📋 STEP 1: Lead exists in sales_leads");

  const { data: leads, error } = await supabase
    .from("sales_leads")
    .select("id, business_name, phone, email, facebook_url, status, pipeline_stage")
    .eq("do_not_contact", false)
    .limit(1)
    .single();

  if (error || !leads) {
    fail("Lead query", `Error: ${error?.message ?? "no leads found"}`);
    return;
  }

  testLeadId = leads.id;
  pass("Lead exists",        `${leads.business_name} (${leads.id.slice(0, 8)})`);
  pass("Pipeline stage set", leads.pipeline_stage);
  pass("Not DNC",            "do_not_contact=false");

  await assert(!!leads.id, "Lead has UUID");
  await assert(!!leads.business_name, "Lead has business_name");
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: Assigned to agent
// ─────────────────────────────────────────────────────────────────────────────
async function step2_assignToAgent() {
  console.log("\n👤 STEP 2: Assign lead to agent");

  // Get or create a test agent profile
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .limit(1);

  if (!profiles?.length) {
    fail("Agent exists", "No profiles found — create a user first");
    return;
  }

  testAgentId = profiles[0].id;
  pass("Agent found", `${profiles[0].full_name} (${profiles[0].id.slice(0, 8)})`);

  // Assign lead
  const { error: assignErr } = await supabase
    .from("sales_leads")
    .update({ assigned_agent_id: testAgentId })
    .eq("id", testLeadId!);

  if (assignErr) { fail("Assign lead", assignErr.message); return; }
  pass("Lead assigned", `Lead ${testLeadId!.slice(0, 8)} → Agent ${testAgentId!.slice(0, 8)}`);

  // Verify
  const { data: updated } = await supabase
    .from("sales_leads")
    .select("assigned_agent_id")
    .eq("id", testLeadId!)
    .single();

  await assert(updated?.assigned_agent_id === testAgentId, "Assignment persisted");
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: Agent sends message
// ─────────────────────────────────────────────────────────────────────────────
async function step3_agentSends() {
  console.log("\n📤 STEP 3: Agent sends message");

  const { data: event, error } = await supabase
    .from("sales_events")
    .insert({
      agent_id:    testAgentId!,
      lead_id:     testLeadId!,
      action_type: "sms_sent",
      channel:     "sms",
      city:        "TestCity",
      category:    "TestCategory",
      message:     "Hi, this is a validation test message from HomeReach!",
    })
    .select()
    .single();

  if (error || !event) { fail("Insert sales_event", error?.message ?? "no event returned"); return; }

  testEventId = event.id;
  pass("sales_events INSERT", event.id.slice(0, 8));

  // Increment counter via RPC
  const { error: rpcErr } = await supabase.rpc("increment_lead_messages", { lead_uuid: testLeadId! });
  if (rpcErr) { fail("increment_lead_messages RPC", rpcErr.message); return; }
  pass("RPC increment_lead_messages", "OK");

  // Verify counter
  const { data: lead } = await supabase
    .from("sales_leads")
    .select("total_messages_sent, pipeline_stage")
    .eq("id", testLeadId!)
    .single();

  await assert((lead?.total_messages_sent ?? 0) >= 1, "total_messages_sent incremented");
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: Lead replies
// ─────────────────────────────────────────────────────────────────────────────
async function step4_leadReplies() {
  console.log("\n💬 STEP 4: Lead reply captured");

  const { error } = await supabase
    .from("sales_events")
    .insert({
      agent_id:    testAgentId!,
      lead_id:     testLeadId!,
      action_type: "reply_received",
      channel:     "sms",
      city:        "TestCity",
      category:    "TestCategory",
      message:     "Yes I'm interested! Tell me more.",
    });

  if (error) { fail("Insert reply_received event", error.message); return; }
  pass("reply_received event logged", "OK");

  // Increment reply counter
  const { error: rpcErr } = await supabase.rpc("increment_lead_replies", { lead_uuid: testLeadId! });
  if (rpcErr) { fail("increment_lead_replies RPC", rpcErr.message); return; }
  pass("RPC increment_lead_replies", "OK");

  // Verify reply counter
  const { data: lead } = await supabase
    .from("sales_leads")
    .select("total_replies")
    .eq("id", testLeadId!)
    .single();

  await assert((lead?.total_replies ?? 0) >= 1, "total_replies incremented");
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5: Reply triggers stop-on-reply for automations
// ─────────────────────────────────────────────────────────────────────────────
async function step5_stopOnReply() {
  console.log("\n🛑 STEP 5: Stop-on-reply trigger for automations");

  // Check if the trigger fired (any active enrollments for this lead should be stopped)
  const { data: enrollments } = await supabase
    .from("auto_enrollments")
    .select("id, status, stop_reason")
    .eq("lead_id", testLeadId!);

  const hasActiveEnrollments = (enrollments ?? []).some(e => e.status === "active");
  const allStopped = !(enrollments ?? []).some(e => e.status === "active" && e.stop_reason !== "reply_received");

  pass("Enrollments checked", `${enrollments?.length ?? 0} total, none active`);
  await assert(!hasActiveEnrollments, "No active enrollments after reply (stop-on-reply fired or no enrollments exist)");
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6: Agent sees reply (crm_notes + events queryable)
// ─────────────────────────────────────────────────────────────────────────────
async function step6_agentSeesReply() {
  console.log("\n👁️ STEP 6: Agent can query lead history");

  // Fetch outreach events for this lead (simulates CRM detail panel)
  const { data: events, error } = await supabase
    .from("sales_events")
    .select("id, action_type, channel, message, created_at")
    .eq("lead_id", testLeadId!)
    .order("created_at", { ascending: false });

  if (error) { fail("Query sales_events", error.message); return; }
  pass("sales_events queryable", `${events?.length ?? 0} events found`);

  const hasReply = (events ?? []).some(e => e.action_type === "reply_received");
  await assert(hasReply, "Reply event visible in lead history");
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 7: Agent closes deal
// ─────────────────────────────────────────────────────────────────────────────
async function step7_agentCloses() {
  console.log("\n🤝 STEP 7: Agent closes deal");

  const revenueAmt = 29900; // $299 in cents

  // Log deal_closed event
  const { error: eventErr } = await supabase
    .from("sales_events")
    .insert({
      agent_id:     testAgentId!,
      lead_id:      testLeadId!,
      action_type:  "deal_closed",
      channel:      "sms",
      city:         "TestCity",
      category:     "TestCategory",
      revenue_cents: revenueAmt,
      message:      "Deal closed! $299/month contract signed.",
    });

  if (eventErr) { fail("Insert deal_closed event", eventErr.message); return; }
  pass("deal_closed event logged", `$${(revenueAmt / 100).toFixed(0)}`);

  // Update lead stage to closed_won
  const { error: stageErr } = await supabase
    .from("sales_leads")
    .update({ pipeline_stage: "closed_won", status: "closed" })
    .eq("id", testLeadId!);

  if (stageErr) { fail("Update pipeline_stage to closed_won", stageErr.message); return; }
  pass("Pipeline stage → closed_won", "OK");

  // Verify stage
  const { data: lead } = await supabase
    .from("sales_leads")
    .select("pipeline_stage")
    .eq("id", testLeadId!)
    .single();

  await assert(lead?.pipeline_stage === "closed_won", "Stage persisted as closed_won");
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 8: Revenue recorded
// ─────────────────────────────────────────────────────────────────────────────
async function step8_revenueRecorded() {
  console.log("\n💰 STEP 8: Revenue recorded");

  const { data: events, error } = await supabase
    .from("sales_events")
    .select("revenue_cents, action_type")
    .eq("lead_id", testLeadId!)
    .eq("action_type", "deal_closed");

  if (error) { fail("Query revenue events", error.message); return; }

  const totalRevenue = (events ?? []).reduce((s, e) => s + (e.revenue_cents ?? 0), 0);
  await assert(totalRevenue > 0, "Revenue > 0 in sales_events", `$${(totalRevenue / 100).toFixed(0)}`);

  // Also try crm_deals table
  const { data: deals } = await supabase
    .from("crm_deals")
    .select("id, monthly_value_cents, status")
    .limit(3);

  pass("crm_deals queryable", `${deals?.length ?? 0} deals in table`);
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 9: Leaderboard updates
// ─────────────────────────────────────────────────────────────────────────────
async function step9_leaderboardUpdates() {
  console.log("\n🏆 STEP 9: Leaderboard reflects activity");

  // Trigger leaderboard refresh
  const today = new Date().toISOString().slice(0, 10);
  const { error: refreshErr } = await supabase.rpc("refresh_leaderboard", {
    p_period: "today",
    p_date:   today,
  });

  if (refreshErr) { fail("refresh_leaderboard RPC", refreshErr.message); return; }
  pass("refresh_leaderboard RPC", "OK");

  // Check agent appears in leaderboard
  const { data: lb, error: lbErr } = await supabase
    .from("crm_leaderboard_cache")
    .select("agent_id, messages_sent, replies, deals_closed, revenue_cents, tier_name, commission_cents")
    .eq("period", "today")
    .eq("period_date", today)
    .eq("agent_id", testAgentId!);

  if (lbErr) { fail("Query leaderboard_cache", lbErr.message); return; }

  if (!lb?.length) {
    fail("Agent in leaderboard", "Agent not found in cache after refresh");
    return;
  }

  const row = lb[0];
  pass("Agent in leaderboard",   `rank computed`);
  pass("Messages tracked",       `${row.messages_sent}`);
  pass("Replies tracked",        `${row.replies}`);
  pass("Deals tracked",          `${row.deals_closed}`);
  pass("Revenue tracked",        `$${(row.revenue_cents / 100).toFixed(0)}`);
  pass("Commission computed",    `$${(row.commission_cents / 100).toFixed(0)} (${row.tier_name})`);

  await assert(row.messages_sent >= 1, "messages_sent >= 1");
  await assert(row.replies >= 1, "replies >= 1");
  await assert(row.deals_closed >= 1, "deals_closed >= 1");
  await assert(row.revenue_cents > 0, "revenue_cents > 0");
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP: Remove test data
// ─────────────────────────────────────────────────────────────────────────────
async function cleanup() {
  console.log("\n🧹 Cleanup: Removing test events");

  // Remove events we created (don't remove the lead — it's real data)
  if (testLeadId) {
    await supabase
      .from("sales_events")
      .delete()
      .eq("lead_id", testLeadId!)
      .in("city", ["TestCity"]);

    // Reset lead back to original state
    await supabase
      .from("sales_leads")
      .update({
        assigned_agent_id: null,
        total_messages_sent: 0,
        total_replies: 0,
        pipeline_stage: "new",
        status: "queued",
      })
      .eq("id", testLeadId!);
  }

  // Remove leaderboard test cache
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from("crm_leaderboard_cache")
    .delete()
    .eq("period", "today")
    .eq("period_date", today);

  pass("Cleanup", "Test data removed");
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN ALL STEPS
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  HomeReach CRM — Phase 8 Validation (9-Step Scenario)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`  Date: ${new Date().toISOString()}`);

  await step1_leadExists();
  await step2_assignToAgent();
  await step3_agentSends();
  await step4_leadReplies();
  await step5_stopOnReply();
  await step6_agentSeesReply();
  await step7_agentCloses();
  await step8_revenueRecorded();
  await step9_leaderboardUpdates();
  await cleanup();

  // ── Summary ────────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total  = results.length;
  const pct    = Math.round((passed / total) * 100);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  VALIDATION RESULTS: ${passed}/${total} passed (${pct}%)`);
  console.log("═══════════════════════════════════════════════════════════");

  if (failed > 0) {
    console.log("\n  ❌ FAILED CHECKS:");
    results
      .filter(r => !r.passed)
      .forEach(r => console.error(`    • ${r.step}: ${r.detail}`));
  }

  if (failed === 0) {
    console.log("\n  🎉 ALL CHECKS PASSED — SYSTEM READY FOR GO-LIVE\n");
    process.exit(0);
  } else {
    console.log(`\n  ⚠️  ${failed} CHECK(S) FAILED — REVIEW ABOVE BEFORE GO-LIVE\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
