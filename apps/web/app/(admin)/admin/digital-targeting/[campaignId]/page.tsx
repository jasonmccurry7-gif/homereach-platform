import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { buildManualLaunchPlan, getDigitalAdLaunchReadiness } from "@/lib/digital-targeting/ad-platforms";
import type {
  DigitalCampaignAssetRecord,
  DigitalCampaignDraftRecord,
  DigitalCampaignMetricRecord,
  DigitalCampaignRecord,
  DigitalCampaignTaskRecord,
  DigitalTargetLocationRecord,
} from "@/lib/digital-targeting/types";
import { DigitalTargetingDetailClient } from "./digital-targeting-detail-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Digital Targeting Campaign - HomeReach Admin" };

export default async function DigitalTargetingCampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const supabase = createServiceClient();
  const [campaignRes, locationsRes, assetsRes, tasksRes, draftsRes, metricsRes] = await Promise.all([
    supabase.from("digital_targeting_campaigns").select("*").eq("id", campaignId).single(),
    supabase.from("digital_target_locations").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: true }),
    supabase.from("digital_campaign_assets").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false }),
    supabase.from("digital_campaign_tasks").select("*").eq("campaign_id", campaignId).order("task_order", { ascending: true }),
    supabase.from("digital_campaign_drafts").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false }),
    supabase.from("digital_campaign_metrics").select("*").eq("campaign_id", campaignId).order("reporting_period_start", { ascending: false }),
  ]);

  if (campaignRes.error || !campaignRes.data) notFound();

  const campaign = campaignRes.data as DigitalCampaignRecord;
  const readiness = getDigitalAdLaunchReadiness();
  const manualPlan = buildManualLaunchPlan({
    campaignId: campaign.id,
    businessName: campaign.business_name ?? "Digital targeting campaign",
    objective: campaign.objective ?? "brand_awareness",
    targetingType: campaign.targeting_type ?? "custom_area",
    monthlyAdSpendCents: Number(campaign.monthly_ad_spend ?? 0),
    trackingUrl: campaign.tracking_url ?? null,
  });

  return (
    <div className="space-y-5">
      <Link href="/admin/digital-targeting" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Digital Targeting
      </Link>
      <DigitalTargetingDetailClient
        campaign={campaign}
        locations={(locationsRes.data ?? []) as DigitalTargetLocationRecord[]}
        assets={(assetsRes.data ?? []) as DigitalCampaignAssetRecord[]}
        tasks={(tasksRes.data ?? []) as DigitalCampaignTaskRecord[]}
        drafts={(draftsRes.data ?? []) as DigitalCampaignDraftRecord[]}
        metrics={(metricsRes.data ?? []) as DigitalCampaignMetricRecord[]}
        readiness={readiness}
        manualPlan={manualPlan}
      />
    </div>
  );
}
