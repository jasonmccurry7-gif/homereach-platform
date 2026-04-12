import type { Metadata } from "next";
import {
  db,
  targetedRouteCampaigns,
  spotAssignments,
  businesses,
} from "@homereach/db";
import { inArray, eq } from "drizzle-orm";
import {
  ProfitAwarePricingEngine,
  PostagePricingProvider,
  CAMPAIGN_MARGIN_TIERS,
  COMMITMENT_TIERS,
} from "@/lib/pricing";
import type { ProfitRow, ProductPricingResult } from "@/lib/pricing";
import { ProfitClient } from "./profit-client";

export const dynamic  = "force-dynamic";
export const metadata: Metadata = { title: "Profit Center — HomeReach Admin" };

export default async function ProfitCenterPage() {
  // ── Resolve live/cached/fallback pricing sources ────────────────────────────
  const [postageRate] = await Promise.all([
    PostagePricingProvider.getRate(),
  ]);

  const config = ProfitAwarePricingEngine.getConfig();

  // ── Build targeted-campaign profit rows (real DB) ───────────────────────────
  const liveCampaigns = await db
    .select({
      id:          targetedRouteCampaigns.id,
      businessName: targetedRouteCampaigns.businessName,
      homesCount:  targetedRouteCampaigns.homesCount,
      priceCents:  targetedRouteCampaigns.priceCents,
      status:      targetedRouteCampaigns.status,
    })
    .from(targetedRouteCampaigns)
    .where(
      inArray(targetedRouteCampaigns.status, [
        "paid", "design_queued", "design_in_progress",
        "design_ready", "approved", "mailed", "complete",
      ])
    )
    .catch(() => [] as typeof liveCampaigns);

  const campaignRows: ProfitRow[] = await Promise.all(
    liveCampaigns.map(async (c) => {
      const result = await ProfitAwarePricingEngine.calculateCampaign({
        totalHouseholds:     c.homesCount,
        productType:         "postcard_6x9",
        monthsCommitted:     1,
        campaignId:          c.id,
        campaignProductType: "targeted_campaign",
      });
      const sellPrice = c.priceCents / 100; // authoritative price from DB
      return {
        id:               c.id,
        name:             c.businessName,
        productType:      "targeted_campaign" as const,
        quantity:         c.homesCount,
        vendorCost:       result.vendorCost,
        postageCost:      result.postageCost,
        totalCost:        result.totalCost,
        sellPrice,
        grossProfit:      sellPrice - result.totalCost,
        marginPercent:    sellPrice > 0
          ? Math.round(((sellPrice - result.totalCost) / sellPrice) * 100)
          : 0,
        pricingSource:    result.pricingSource,
        pricingTimestamp: result.pricingTimestamp,
        status:           c.status,
      };
    })
  );

  // ── Build shared-postcard profit rows (real DB: active spot assignments) ─────
  const activeSpots = await db
    .select({
      id:               spotAssignments.id,
      businessId:       spotAssignments.businessId,
      monthlyValueCents: spotAssignments.monthlyValueCents,
      status:           spotAssignments.status,
    })
    .from(spotAssignments)
    .where(inArray(spotAssignments.status, ["active", "paused"]))
    .catch(() => [] as typeof activeSpots);

  // Look up business names for display
  const bizIds = activeSpots
    .map((s) => s.businessId)
    .filter(Boolean) as string[];
  const bizNameMap: Record<string, string> = {};
  if (bizIds.length > 0) {
    const bizRows = await db
      .select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .where(inArray(businesses.id, bizIds))
      .catch(() => []);
    for (const b of bizRows) bizNameMap[b.id] = b.name ?? b.id;
  }

  // Shared-postcard standard print quantity per city per drop
  const SHARED_POSTCARD_HOMES = 2500;

  const sharedRows: ProfitRow[] = await Promise.all(
    activeSpots.map(async (spot) => {
      const result = await ProfitAwarePricingEngine.calculateCampaign({
        totalHouseholds:     SHARED_POSTCARD_HOMES,
        productType:         "postcard_6x9",
        monthsCommitted:     1,
        campaignProductType: "shared_postcard",
      });
      const sellPrice = spot.monthlyValueCents / 100;
      return {
        id:               spot.id,
        name:             spot.businessId ? (bizNameMap[spot.businessId] ?? spot.businessId) : "Unknown",
        productType:      "shared_postcard" as const,
        quantity:         SHARED_POSTCARD_HOMES,
        vendorCost:       result.vendorCost,
        postageCost:      result.postageCost,
        totalCost:        result.totalCost,
        sellPrice,
        grossProfit:      sellPrice - result.totalCost,
        marginPercent:    sellPrice > 0
          ? Math.round(((sellPrice - result.totalCost) / sellPrice) * 100)
          : 0,
        pricingSource:    result.pricingSource,
        pricingTimestamp: result.pricingTimestamp,
        status:           spot.status,
      };
    })
  );

  // ── Build product reference rows for all print products ────────────────────
  const SAMPLE_QUANTITIES = [1000, 2500, 5000, 10000];
  const productResults: ProductPricingResult[] = await Promise.all(
    (["postcard_4x6", "postcard_6x9", "postcard_6x11", "magnet", "door_hanger"] as const).flatMap(
      (pt) => SAMPLE_QUANTITIES.map((qty) =>
        ProfitAwarePricingEngine.calculateProduct({ productType: pt, quantity: qty, withPostage: false })
      )
    )
  );

  // ── Aggregate profit summary ────────────────────────────────────────────────
  const allRows   = [...campaignRows, ...sharedRows];
  const totalRevenue = allRows.reduce((s, r) => s + r.sellPrice, 0);
  const totalCost    = allRows.reduce((s, r) => s + r.totalCost, 0);
  const totalProfit  = allRows.reduce((s, r) => s + r.grossProfit, 0);
  const avgMargin    = totalRevenue > 0
    ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 100)
    : 0;

  const summary = { totalRevenue, totalCost, totalProfit, avgMargin, rowCount: allRows.length };

  return (
    <ProfitClient
      campaignRows={campaignRows}
      sharedRows={sharedRows}
      productResults={productResults}
      postageRate={postageRate}
      config={config}
      marginTiers={[...CAMPAIGN_MARGIN_TIERS].reverse()}
      commitmentTiers={COMMITMENT_TIERS}
      summary={summary}
    />
  );
}
