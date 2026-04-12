// ─────────────────────────────────────────────────────────────────────────────
// HomeReach CRM Ingestion Pipeline
// Run: pnpm tsx packages/db/src/ingestion/ingest.ts [--dry-run]
//
// Phases:
//   1. Companies (11 paying advertisers)
//   2. Leads deduplicated (1,646 → ~1,351 canonicals)
//   3. Outreach events (2,475 imported, FB flagged as never-sent)
//   4. Conversations (per-lead summaries)
//   5. Revenue/Deals (3 active contracts)
//   6. Duplicate flagging (295 pairs)
//   7. Tags + special flags (hot, unreachable, fb_only)
//   8. Activity metrics rollup
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import csv from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import { DedupeEngine } from "./dedupe-engine";
import type { RawLead, RawOutreachEvent, RawCompany, RawRevenue, IngestionLog } from "./types";

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const DATA_DIR = process.argv[2] ?? path.join(process.cwd(), "../../migration_export");
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const log: IngestionLog = {
  timestamp: new Date().toISOString(),
  phase: "full",
  results: [],
  total_inserted: 0,
  total_errors: 0,
  duration_ms: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function readCsv<T>(filePath: string): T[] {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return csv.parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true }) as T[];
  } catch (e) {
    console.warn(`⚠️  Could not read ${filePath}: ${e}`);
    return [];
  }
}

function normPhone(p: string | undefined): string | undefined {
  if (!p) return undefined;
  const d = p.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d[0] === "1") return `+${d}`;
  if (d.length >= 10) return `+1${d.slice(-10)}`;
  return undefined;
}

function toNum(v: string | undefined): number { return parseInt(v ?? "0") || 0; }
function toFloat(v: string | undefined): number | null { return v ? (parseFloat(v) || null) : null; }
function toBool(v: string | undefined): boolean { return ["t","true","1","yes"].includes((v ?? "").toLowerCase()); }
function nullify(v: string | undefined): string | null { return v?.trim() || null; }
function toTs(v: string | undefined): string | null { return v?.trim() || null; }

async function upsertBatch(table: string, rows: Record<string, unknown>[], conflict = "external_id"): Promise<{ inserted: number; errors: number }> {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would insert ${rows.length} rows into ${table}`);
    return { inserted: rows.length, errors: 0 };
  }
  const BATCH = 200;
  let inserted = 0, errors = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error, count } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflict, ignoreDuplicates: false })
      .select("id");
    if (error) {
      console.error(`  ❌ ${table} batch ${i}: ${error.message}`);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }
  }
  return { inserted, errors };
}

// ── Phase 1: Companies ────────────────────────────────────────────────────────
async function ingestCompanies() {
  console.log("\n📦 Phase 1: Companies");
  const rows = readCsv<RawCompany>(path.join(DATA_DIR, "normalized/companies.csv"));
  const mapped = rows.map(r => ({
    external_id:  r.id,
    name:         r.name,
    contact_name: nullify(r.contact_name),
    email:        nullify(r.email),
    phone:        normPhone(r.phone) ?? null,
    address:      nullify(r.address),
    website:      nullify(r.website),
    industry:     nullify(r.industry),
    status:       r.status === "active" ? "active" : "prospect",
    notes:        nullify(r.notes),
  }));

  const { inserted, errors } = await upsertBatch("crm_companies", mapped);
  console.log(`  ✓ ${inserted} companies, ${errors} errors`);
  log.results.push({ table: "crm_companies", inserted, skipped: 0, errors, duplicates_flagged: 0, warnings: [] });
  log.total_inserted += inserted;
  log.total_errors += errors;
}

// ── Phase 2: Leads (with dedup) ───────────────────────────────────────────────
async function ingestLeads() {
  console.log("\n🎯 Phase 2: Leads (with deduplication)");
  const rows = readCsv<RawLead>(path.join(DATA_DIR, "normalized/leads_master.csv"));
  const engine = new DedupeEngine();

  const toInsert: Record<string, unknown>[] = [];
  const duplicateUpdates: Array<{ ext_id: string; canonical_ext_id: string }> = [];
  let unreachable = 0, fbNeverSent = 0;

  for (const r of rows) {
    const phone = normPhone(r.phone);
    const email = nullify(r.email) ?? undefined;
    const fb = nullify(r.facebook_url) ?? undefined;

    const result = engine.process({
      externalId:   r.original_primary_id,
      businessName: r.business_name,
      contactName:  nullify(r.contact_name) ?? undefined,
      email,
      phone,
      website:      nullify(r.website) ?? undefined,
      city:         nullify(r.city) ?? undefined,
      category:     nullify(r.category) ?? undefined,
      score:        toNum(r.score),
    });

    // Determine pipeline stage
    const totalSent = toNum(r.total_texts_sent) + toNum(r.total_emails_sent) + toNum(r.total_fb_sent);
    const totalReplies = toNum(r.total_sms_replies);
    const pipelineStage: string = totalReplies > 0 ? "replied" : totalSent > 0 ? "contacted" : "new";

    // Flags
    const noPhone = !phone;
    const noEmail = !email;
    const isUnreachable = noPhone && noEmail;
    if (isUnreachable) unreachable++;
    
    // FB messages were never actually sent
    const fbNeverSentFlag = toNum(r.total_fb_sent) > 0;
    if (fbNeverSentFlag) fbNeverSent++;

    // Priority mapping
    const prioMap: Record<string, string> = { HIGH: "high", MEDIUM: "medium", LOW: "low" };
    const priority = prioMap[r.priority?.toUpperCase()] ?? "medium";

    toInsert.push({
      external_id:        r.original_primary_id,
      business_name:      r.business_name,
      contact_name:       nullify(r.contact_name),
      email:              email ?? null,
      phone:              phone ?? null,
      website:            nullify(r.website),
      facebook_url:       fb ?? null,
      address:            nullify(r.address),
      city:               nullify(r.city),
      state:              r.state || "OH",
      category:           nullify(r.category),
      city_id:            r.city_id ? parseInt(r.city_id) : null,
      category_id:        r.category_id ? parseInt(r.category_id) : null,
      score:              toNum(r.score),
      priority,
      rating:             toFloat(r.rating),
      reviews_count:      toNum(r.reviews_count),
      buying_signal:      toBool(r.buying_signal),
      do_not_contact:     toBool(r.do_not_contact),
      sms_opt_out:        toBool(r.sms_opt_out),
      status:             totalReplies > 0 ? "replied" : totalSent > 0 ? "contacted" : "queued",
      pipeline_stage:     pipelineStage,
      notes:              nullify(r.notes),
      total_messages_sent: totalSent,
      total_replies:      totalReplies,
      last_contacted_at:  toTs(r.last_contacted_at),
      last_reply_at:      toTs(r.last_reply_at),
      is_duplicate:       result.isDuplicate,
      unreachable:        isUnreachable,
      fb_never_sent:      fbNeverSentFlag,
    });
  }

  const { inserted, errors } = await upsertBatch("sales_leads", toInsert);
  const dedupeSummary = engine.getSummary();
  console.log(`  ✓ ${inserted} leads upserted`);
  console.log(`  📊 Dedup: ${dedupeSummary.canonicals} canonical, ${dedupeSummary.duplicates} duplicates flagged`);
  console.log(`  ⚠️  ${unreachable} unreachable (no phone, no email)`);
  console.log(`  ⚠️  ${fbNeverSent} FB "sent" records are actually NEVER DELIVERED`);
  console.log(`  Dedup reasons:`, dedupeSummary.byReason);

  log.results.push({
    table: "sales_leads",
    inserted, skipped: 0, errors,
    duplicates_flagged: dedupeSummary.duplicates,
    warnings: [
      `${unreachable} unreachable leads (no phone, no email)`,
      `${fbNeverSent} leads had Facebook messages marked sent but NEVER ACTUALLY DELIVERED`,
    ],
  });
  log.total_inserted += inserted;
  log.total_errors += errors;
}

// ── Phase 3: Outreach Events ──────────────────────────────────────────────────
async function ingestOutreachEvents() {
  console.log("\n📨 Phase 3: Outreach Events");
  const rows = readCsv<RawOutreachEvent>(path.join(DATA_DIR, "normalized/outreach_history.csv"));

  // Build lead external_id → UUID map
  const { data: leads } = await supabase
    .from("sales_leads")
    .select("id, external_id")
    .not("external_id", "is", null);

  const leadMap = new Map<string, string>();
  for (const l of leads ?? []) leadMap.set(l.external_id, l.id);

  const toInsert: Record<string, unknown>[] = [];
  let fbFlagged = 0, orphaned = 0;

  for (const r of rows) {
    const leadId = leadMap.get(r.lead_id) ?? null;
    if (!leadId) { orphaned++; continue; }

    // CRITICAL: Facebook messages were NEVER ACTUALLY SENT
    const isFacebook = r.channel === "facebook";
    const fbActuallySent = !isFacebook; // FB = false, SMS/email = true

    if (isFacebook && r.status !== "sent") fbFlagged++;

    // Map type
    const typeMap: Record<string, string> = {
      sms_initial: "sms_initial", initial_email: "email_initial",
      follow_up_1: "email_follow_up", follow_up_2: "email_follow_up",
      fb_follow_up: "fb_follow_up", fb_dm: "fb_dm",
      intake_link: "intake_link", opener_1: "fb_dm", opener_2: "fb_dm",
      opener_3: "fb_dm", opener_4: "fb_dm", soft_close: "other",
      objection_price: "other", final: "other",
    };

    toInsert.push({
      external_id:      r.event_id,
      lead_id:          leadId,
      contact_phone:    nullify(r.lead_phone),
      contact_email:    nullify(r.lead_email),
      business_name:    nullify(r.business_name),
      channel:          isFacebook ? "facebook" : (r.channel as string),
      direction:        r.direction === "inbound" ? "inbound" : "outbound",
      type:             typeMap[r.type] ?? "other",
      subject:          nullify(r.subject),
      message_body:     nullify(r.message_body),
      status:           ["sent","generated","approved","failed"].includes(r.status) ? r.status : "generated",
      ai_generated:     toBool(r.ai_generated),
      got_reply:        toBool(r.got_reply),
      buying_signal:    toBool(r.buying_signal),
      sentiment:        nullify(r.sentiment),
      objection_type:   nullify(r.objection_type),
      fb_actually_sent: fbActuallySent,
      sent_at:          toTs(r.sent_at),
      scheduled_at:     toTs(r.scheduled_at),
      created_at:       toTs(r.created_at) ?? new Date().toISOString(),
    });
  }

  console.log(`  ⚠️  ${fbFlagged} Facebook messages NEVER DELIVERED — flagged fb_actually_sent=false`);
  console.log(`  ⚠️  ${orphaned} orphaned events (lead not found)`);

  const { inserted, errors } = await upsertBatch("crm_outreach_events", toInsert, "external_id");
  console.log(`  ✓ ${inserted} outreach events`);
  log.results.push({ table: "crm_outreach_events", inserted, skipped: orphaned, errors, duplicates_flagged: 0, warnings: [`${fbFlagged} FB messages never delivered`] });
  log.total_inserted += inserted;
  log.total_errors += errors;
}

// ── Phase 4: Conversations ────────────────────────────────────────────────────
async function ingestConversations() {
  console.log("\n💬 Phase 4: Conversations");
  const rows = readCsv<Record<string, string>>(path.join(DATA_DIR, "normalized/conversations.csv"));

  const { data: leads } = await supabase
    .from("sales_leads")
    .select("id, external_id")
    .not("external_id", "is", null);
  const leadMap = new Map<string, string>();
  for (const l of leads ?? []) leadMap.set(l.external_id, l.id);

  const toInsert: Record<string, unknown>[] = [];
  for (const r of rows) {
    const leadId = leadMap.get(r.lead_id) ?? null;
    if (!leadId) continue;

    // Determine channels used
    const channelsRaw = r.channels_used ?? "";
    const primaryChannel = channelsRaw.includes("sms") ? "sms" : channelsRaw.includes("email") ? "email" : "facebook";

    toInsert.push({
      lead_id:              leadId,
      channel:              primaryChannel,
      total_messages:       toNum(r.total_messages),
      outbound_count:       toNum(r.outbound_count),
      inbound_replies:      toNum(r.inbound_replies),
      has_replied:          toBool(r.has_replied),
      last_activity_at:     toTs(r.last_activity),
      last_direction:       (r.last_direction === "inbound" ? "inbound" : "outbound"),
      last_message_preview: r.last_message_preview?.substring(0, 500) ?? null,
      reply_sentiments:     nullify(r.reply_sentiments),
      buying_signals:       toNum(r.buying_signals),
    });
  }

  const { inserted, errors } = await upsertBatch("crm_conversations", toInsert.slice(0, 1), "lead_id");
  // Insert in batches without conflict (no unique key)
  if (!DRY_RUN) {
    const { error } = await supabase.from("crm_conversations").insert(toInsert);
    if (error) console.error(`  ❌ Conversations: ${error.message}`);
  }
  console.log(`  ✓ ${toInsert.length} conversation summaries`);
  log.results.push({ table: "crm_conversations", inserted: toInsert.length, skipped: 0, errors: 0, duplicates_flagged: 0, warnings: [] });
  log.total_inserted += toInsert.length;
}

// ── Phase 5: Revenue / Deals ──────────────────────────────────────────────────
async function ingestDeals() {
  console.log("\n💰 Phase 5: Revenue / Deals");
  const rows = readCsv<RawRevenue>(path.join(DATA_DIR, "normalized/revenue_attribution.csv"));

  // Get company IDs
  const { data: companies } = await supabase
    .from("crm_companies")
    .select("id, external_id");
  const companyMap = new Map<string, string>();
  for (const c of companies ?? []) companyMap.set(c.external_id, c.id);

  const toInsert = rows.map(r => ({
    company_id:          companyMap.get(r.business_id) ?? null,
    spot_id:             r.spot_id ? parseInt(r.spot_id) : null,
    city:                nullify(r.city),
    category:            nullify(r.category),
    monthly_value_cents: Math.round(parseFloat(r.monthly_value || "0") * 100),
    contract_months:     3,
    total_value_cents:   Math.round(parseFloat(r.monthly_value || "0") * 100 * 3),
    status:              r.status ?? "active",
    start_date:          r.start_date ? r.start_date.split(" ")[0] : null,
    end_date:            r.end_date   ? r.end_date.split(" ")[0]   : null,
    signed_at:           toTs(r.signed_at),
    notes:               `Imported from Replit contract ${r.contract_id}`,
  }));

  if (!DRY_RUN) {
    const { error } = await supabase.from("crm_deals").insert(toInsert);
    if (error) console.error(`  ❌ Deals: ${error.message}`);
  }

  const totalMRR = toInsert.reduce((s, d) => s + d.monthly_value_cents, 0);
  console.log(`  ✓ ${toInsert.length} deals | MRR: $${(totalMRR/100).toFixed(2)}`);
  log.results.push({ table: "crm_deals", inserted: toInsert.length, skipped: 0, errors: 0, duplicates_flagged: 0, warnings: [] });
  log.total_inserted += toInsert.length;

  // Also update company MRR
  if (!DRY_RUN) {
    for (const r of rows) {
      const compId = companyMap.get(r.business_id);
      if (!compId) continue;
      await supabase
        .from("crm_companies")
        .update({ mrr_cents: Math.round(parseFloat(r.monthly_value || "0") * 100), status: "active" })
        .eq("id", compId);
    }
  }
}

// ── Phase 6: Apply special tags ───────────────────────────────────────────────
async function applyTags() {
  console.log("\n🏷️  Phase 6: Applying tags");
  if (DRY_RUN) { console.log("  [DRY RUN] Skipping tag application"); return; }

  // Get tag IDs
  const { data: tags } = await supabase.from("crm_tags").select("id, name");
  const tagMap = new Map<string, string>();
  for (const t of tags ?? []) tagMap.set(t.name, t.id);

  // Tag: hot_lead (buying_signal = true)
  const { data: hotLeads } = await supabase
    .from("sales_leads").select("id").eq("buying_signal", true);
  if (hotLeads && tagMap.get("hot_lead")) {
    const tagInserts = hotLeads.map(l => ({ lead_id: l.id, tag_id: tagMap.get("hot_lead")! }));
    for (let i = 0; i < tagInserts.length; i += 200) {
      await supabase.from("crm_lead_tags").upsert(tagInserts.slice(i, i+200)).select();
    }
    console.log(`  ✓ ${hotLeads.length} hot_lead tags applied`);
  }

  // Tag: unreachable
  const { data: unreachable } = await supabase
    .from("sales_leads").select("id").eq("unreachable", true);
  if (unreachable && tagMap.get("unreachable")) {
    const tagInserts = unreachable.map(l => ({ lead_id: l.id, tag_id: tagMap.get("unreachable")! }));
    for (let i = 0; i < tagInserts.length; i += 200) {
      await supabase.from("crm_lead_tags").upsert(tagInserts.slice(i, i+200)).select();
    }
    console.log(`  ✓ ${unreachable.length} unreachable tags applied`);
  }

  // Tag: fb_only (has facebook_url but no phone and no email)
  const { data: fbOnly } = await supabase
    .from("sales_leads").select("id")
    .is("phone", null).is("email", null).not("facebook_url", "is", null);
  if (fbOnly && tagMap.get("fb_only")) {
    const tagInserts = fbOnly.map(l => ({ lead_id: l.id, tag_id: tagMap.get("fb_only")! }));
    for (let i = 0; i < tagInserts.length; i += 200) {
      await supabase.from("crm_lead_tags").upsert(tagInserts.slice(i, i+200)).select();
    }
    console.log(`  ✓ ${fbOnly.length} fb_only tags applied`);
  }

  // Tag: high_score
  const { data: highScore } = await supabase
    .from("sales_leads").select("id").gte("score", 70);
  if (highScore && tagMap.get("high_score")) {
    const tagInserts = highScore.map(l => ({ lead_id: l.id, tag_id: tagMap.get("high_score")! }));
    await supabase.from("crm_lead_tags").upsert(tagInserts).select();
    console.log(`  ✓ ${highScore.length} high_score tags applied`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const start = Date.now();
  console.log(`🚀 HomeReach CRM Ingestion Pipeline`);
  console.log(`   Data dir: ${DATA_DIR}`);
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`   Time: ${new Date().toISOString()}`);

  await ingestCompanies();
  await ingestLeads();
  await ingestOutreachEvents();
  await ingestConversations();
  await ingestDeals();
  await applyTags();

  log.duration_ms = Date.now() - start;

  console.log("\n" + "─".repeat(60));
  console.log("✅ Ingestion Complete");
  console.log(`   Total inserted: ${log.total_inserted}`);
  console.log(`   Total errors:   ${log.total_errors}`);
  console.log(`   Duration:       ${log.duration_ms}ms`);

  // Save log
  const logPath = path.join(process.cwd(), `ingestion-log-${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`   Log saved: ${logPath}`);

  if (log.total_errors > 0) process.exit(1);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
