// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Seed Campaign Metrics
//
// Run with:
//   cd packages/db && npx tsx src/seeds/seed-metrics.ts
//
// What it does:
//   1. Queries marketing_campaigns to find the first valid campaign_id
//   2. Inserts a realistic test metrics row for that campaign
//   3. Confirms the row exists and prints derived KPIs
// ─────────────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
config({ path: "../../.env" });
config({ path: ".env" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { marketingCampaigns, campaignMetrics } from "../schema/index.js";
import { eq, desc } from "drizzle-orm";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

async function run() {
  console.log("🔍 Querying marketing_campaigns for a valid campaign_id...\n");

  // ── Step 1: find a real campaign ──────────────────────────────────────────
  const campaigns = await db
    .select({
      id: marketingCampaigns.id,
      businessId: marketingCampaigns.businessId,
      status: marketingCampaigns.status,
      createdAt: marketingCampaigns.createdAt,
    })
    .from(marketingCampaigns)
    .orderBy(desc(marketingCampaigns.createdAt))
    .limit(5);

  if (campaigns.length === 0) {
    console.error(
      "❌  No campaigns found.\n" +
      "    Complete a Stripe checkout first (or run the main seed + manually create an order).\n" +
      "    The webhook auto-creates a marketing_campaign row on payment success."
    );
    await client.end();
    process.exit(1);
  }

  console.log(`Found ${campaigns.length} campaign(s):\n`);
  campaigns.forEach((c, i) => {
    console.log(`  [${i + 1}] id=${c.id}  status=${c.status}  created=${c.createdAt.toISOString()}`);
  });

  const campaignId = campaigns[0]!.id;
  console.log(`\n✅  Using campaign_id: ${campaignId}\n`);

  // ── Step 2: define the metrics row ────────────────────────────────────────
  const NOW = new Date();
  const PERIOD_START = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);

  const impressions  = 2500;
  const mailpieces   = 2500;
  const qrScans      = 18;
  const phoneLeads   = 6;
  const formLeads    = 4;
  const totalLeads   = qrScans + phoneLeads + formLeads; // 28

  // Derived KPIs (stored here for reference, also calculated in dashboard)
  const totalEngagements = qrScans + phoneLeads + formLeads; // 28
  const conversionRate   = ((totalEngagements / impressions) * 100).toFixed(2); // "1.12"

  console.log("📊  Metrics to insert:");
  console.log(`    impressions:     ${impressions.toLocaleString()}`);
  console.log(`    mailpieces:      ${mailpieces.toLocaleString()}`);
  console.log(`    qr_scans:        ${qrScans}`);
  console.log(`    phone_leads:     ${phoneLeads}`);
  console.log(`    form_leads:      ${formLeads}`);
  console.log(`    total_leads:     ${totalLeads}   (qr + phone + form)`);
  console.log(`    ──────────────────────────────────`);
  console.log(`    total_engagements: ${totalEngagements}`);
  console.log(`    conversion_rate:   ${conversionRate}%  (${totalEngagements} / ${impressions})`);
  console.log(`    period:            ${PERIOD_START.toISOString()} → ${NOW.toISOString()}\n`);

  // ── Step 3: insert ────────────────────────────────────────────────────────
  const [inserted] = await db
    .insert(campaignMetrics)
    .values({
      campaignId,
      periodStart: PERIOD_START,
      periodEnd:   NOW,
      impressions,
      mailpieces,
      qrScans,
      phoneLeads,
      formLeads,
      totalLeads,
    })
    .returning();

  console.log(`✅  Row inserted  →  id: ${inserted!.id}\n`);

  // ── Step 4: confirm row exists ────────────────────────────────────────────
  const rows = await db
    .select()
    .from(campaignMetrics)
    .where(eq(campaignMetrics.campaignId, campaignId));

  console.log(`✅  Confirmation: ${rows.length} metric row(s) now exist for campaign ${campaignId}\n`);

  rows.forEach((r, i) => {
    const eng  = r.qrScans + r.phoneLeads + r.formLeads;
    const conv = ((eng / r.impressions) * 100).toFixed(2);
    console.log(`  Row ${i + 1}:`);
    console.log(`    id:                 ${r.id}`);
    console.log(`    impressions:        ${r.impressions.toLocaleString()}`);
    console.log(`    qr_scans:           ${r.qrScans}`);
    console.log(`    phone_leads:        ${r.phoneLeads}`);
    console.log(`    form_leads:         ${r.formLeads}`);
    console.log(`    total_leads:        ${r.totalLeads}`);
    console.log(`    ── derived ──────────────────────`);
    console.log(`    total_engagements:  ${eng}`);
    console.log(`    conversion_rate:    ${conv}%`);
    console.log();
  });

  // ── Step 5: print the raw SQL equivalent for reference ───────────────────
  console.log("─".repeat(60));
  console.log("Equivalent raw SQL (for Supabase SQL Editor):\n");
  console.log(`INSERT INTO public.campaign_metrics (`);
  console.log(`  campaign_id, period_start, period_end,`);
  console.log(`  impressions, mailpieces, qr_scans,`);
  console.log(`  phone_leads, form_leads, total_leads`);
  console.log(`) VALUES (`);
  console.log(`  '${campaignId}',`);
  console.log(`  now() - interval '30 days',`);
  console.log(`  now(),`);
  console.log(`  2500, 2500, 18,`);
  console.log(`  6, 4, 28`);
  console.log(`);`);
  console.log("─".repeat(60));

  await client.end();
  console.log("\n✅  Done. Refresh the dashboard to see real metrics.");
}

run().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
