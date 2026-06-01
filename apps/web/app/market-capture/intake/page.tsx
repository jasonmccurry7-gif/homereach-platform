import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketCaptureIntakeClient } from "./market-capture-intake-client";
import { MARKET_CAPTURE_PRICING_TIERS, isMarketCaptureIntakeEnabled } from "@/lib/market-capture/config";

export const metadata: Metadata = {
  title: "Start Market Capture | HomeReach",
  description: "Submit your Market Capture campaign request and create a sales-ready HomeReach opportunity.",
};
export const dynamic = "force-dynamic";

export default async function MarketCaptureIntakePage({
  searchParams,
}: {
  searchParams?: Promise<{ plan?: string | string[] }>;
}) {
  if (!isMarketCaptureIntakeEnabled()) notFound();
  const params = searchParams ? await searchParams : {};
  const plan = Array.isArray(params.plan) ? params.plan[0] : params.plan;
  const initialPlan = MARKET_CAPTURE_PRICING_TIERS.some((tier) => tier.id === plan) ? String(plan) : "starter";
  return <MarketCaptureIntakeClient initialPlan={initialPlan} />;
}
