import type { Metadata } from "next";
import { MOCK_TARGETED_CAMPAIGNS } from "@/lib/admin/mock-routes";
import { MOCK_MIGRATED_CLIENTS }   from "@/lib/admin/mock-clients";
import {
  ProfitAwarePricingEngine,
  PostagePricingProvider,
  CAMPAIGN_MARGIN_TIERS,
  COMMITMENT_TIERS,
} from "@/lib/pricing";
import type { ProfitRow, ProductPricingResult } from "@/lib/pricing";
import { ProfitClient } from "./profit-client";

export const metadata: Metadata = { title: "Profit Center — HomeReach Admin" };

export default async function ProfitCenterPage() {
  // ── Resolve live/cached/fallback pricing sources ────────────────────────────
  const [postageRate] = await Promise.all([
    PostagePricingProvider.getRate(),
  ]);

  const config = ProfitAwarePricingEngine.getConfig();

  // ── Build campaign profit rows ──────────────────────────────────────────────
  const campaignRows: ProfitRow[] = await Promise.all(
    MOCK_TARGETED_CAMPAIGNS.map(async (c) => {
      const result = await ProfitAwarePricingEngine.calculateCampaign({
        totalHouseholds:      c.totalHouseholds,
        productType:          "postcard_6x9",
        monthsCommitted:      1,
        campaignId:           c.id,
        campaignProductType:  "targeted_campaign",
      });
      return {
        id:               c.id,
        name:             c.businessId, // future: join to business name
        productType:      "targeted_campaign" as const,
        quantity:         c.totalHouseholds,
        vendorCost:       result.vendorCost,
        postageCost:      result.postageCost,
        totalCost:        result.totalCost,
        sellPrice:        result.finalPrice,
        grossProfit:      result.grossProfit,
        marginPercent:    result.grossMarginPercent,
        pricingSource:    result.pricingSource,
        pricingTimestamp: result.pricingTimestamp,
        status:           c.status,
      };
    })
  );

  // ── Build shared-postcard profit rows (legacy / migrated clients) ───────────
  const sharedRows: ProfitRow[] = await Promise.all(
    MOCK_MIGRATED_CLIENTS
      .filter((mc) => mc.migrationStatus !== "legacy_pending")
      .map(async (mc) => {
        const qty     = 3000; // typical shared postcard EDDM route size
        const result  = await ProfitAwarePricingEngine.calculateCampaign({
          totalHouseholds:     qty,
          productType:         "postcard_6x9",
          monthsCommitted:     1,
          campaignProductType: "shared_postcard",
        });
        return {
          id:               mc.id,
          name:             mc.businessName,
          productType:      "shared_postcard" as const,
          quantity:         qty,
          vendorCost:       result.vendorCost,
          postageCost:      result.postageCost,
          totalCost:        result.totalCost,
          sellPrice:        mc.monthlyPrice, // actual contract price (what we charge them)
          grossProfit:      mc.monthlyPrice - result.totalCost,
          marginPercent:    Math.round(((mc.monthlyPrice - result.totalCost) / mc.monthlyPrice) * 100),
          pricingSource:    result.pricingSource,
          pricingTimestamp: result.pricingTimestamp,
          status:           mc.migrationStatus,
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
