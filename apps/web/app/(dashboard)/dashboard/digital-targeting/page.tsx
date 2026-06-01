import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  FileImage,
  Mail,
  MapPinned,
  MessageSquareText,
  RadioTower,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DIGITAL_CAMPAIGN_STATUS_LABELS, OBJECTIVE_LABELS, TARGETING_TYPE_LABELS } from "@/lib/digital-targeting/campaign";
import { formatUsd, isClientGeofenceDashboardEnabled } from "@/lib/digital-targeting/config";
import type {
  DigitalCampaignAssetRecord,
  DigitalCampaignMetricRecord,
  DigitalCampaignRecord,
  DigitalTargetLocationRecord,
} from "@/lib/digital-targeting/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Digital Targeting - HomeReach" };

function statusLabel(value: string) {
  return DIGITAL_CAMPAIGN_STATUS_LABELS[value] ?? value.replace(/_/g, " ");
}

function labelList(value: string, labels: Record<string, string>) {
  return value
    .split(",")
    .map((part) => labels[part.trim()] ?? part.trim().replace(/_/g, " "))
    .filter(Boolean)
    .join(", ");
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "To be scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "To be scheduled";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function ClientDigitalTargetingPage() {
  if (!isClientGeofenceDashboardEnabled()) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Digital campaign visibility is not enabled yet.
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const [byClient, byEmail] = await Promise.all([
    service
      .from("digital_targeting_campaigns")
      .select("*")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false }),
    user.email
      ? service
          .from("digital_targeting_campaigns")
          .select("*")
          .ilike("email", user.email)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (byClient.error || byEmail.error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        Digital campaign data is not available yet.
      </div>
    );
  }

  const byId = new Map<string, DigitalCampaignRecord>();
  for (const row of [...(byClient.data ?? []), ...(byEmail.data ?? [])]) {
    byId.set(row.id, row);
  }
  const campaigns = Array.from(byId.values());

  if (campaigns.length === 0) {
    return (
      <div className="max-w-3xl space-y-6">
        <PageIntro
          title="Digital Targeting"
          body="Your Neighborhood Digital Targeting campaigns will live here once intake is submitted."
        />
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
          <RadioTower className="mx-auto h-8 w-8 text-gray-300" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-bold text-gray-900">No digital campaign is active yet.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
            Start a campaign and HomeReach will keep the target area, creative, payment, and reporting path organized here.
          </p>
          <Link href="/digital-targeting/intake" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
            Start Digital Targeting
          </Link>
        </div>
      </div>
    );
  }

  const campaignIds = campaigns.map((campaign) => campaign.id);
  const [locationsRes, assetsRes, metricsRes] = await Promise.all([
    service.from("digital_target_locations").select("*").in("campaign_id", campaignIds),
    service.from("digital_campaign_assets").select("*").in("campaign_id", campaignIds),
    service.from("digital_campaign_metrics").select("*").in("campaign_id", campaignIds),
  ]);

  const locations = (locationsRes.data ?? []) as DigitalTargetLocationRecord[];
  const assets = (assetsRes.data ?? []) as DigitalCampaignAssetRecord[];
  const metrics = (metricsRes.data ?? []) as DigitalCampaignMetricRecord[];

  return (
    <div className="max-w-5xl space-y-6">
      <PageIntro
        title="Digital Targeting"
        body="Simple campaign visibility without ad-tech noise: status, target areas, creative, reporting, and next steps."
      />

      {campaigns.map((campaign) => (
        <CampaignCard
          key={campaign.id}
          campaign={campaign}
          locations={locations.filter((row) => row.campaign_id === campaign.id)}
          assets={assets.filter((row) => row.campaign_id === campaign.id)}
          metrics={metrics.filter((row) => row.campaign_id === campaign.id)}
        />
      ))}
    </div>
  );
}

function CampaignCard({
  campaign,
  locations,
  assets,
  metrics,
}: {
  campaign: DigitalCampaignRecord;
  locations: DigitalTargetLocationRecord[];
  assets: DigitalCampaignAssetRecord[];
  metrics: DigitalCampaignMetricRecord[];
}) {
  const totals = metrics.reduce(
    (sum, row) => ({
      impressions: sum.impressions + Number(row.impressions ?? 0),
      clicks: sum.clicks + Number(row.clicks ?? 0),
      spend: sum.spend + Number(row.spend ?? 0),
      leads: sum.leads + Number(row.leads ?? 0),
      calls: sum.calls + Number(row.calls ?? 0),
      visits: sum.visits + Number(row.landing_page_visits ?? 0),
      qrScans: sum.qrScans + Number(row.qr_scans ?? 0),
    }),
    { impressions: 0, clicks: 0, spend: 0, leads: 0, calls: 0, visits: 0, qrScans: 0 },
  );
  const nextStep =
    campaign.payment_status !== "paid"
      ? "Complete the management fee payment or wait for HomeReach to send a secure payment link."
      : campaign.campaign_status === "live"
        ? "HomeReach is monitoring available results and preparing the next report."
        : "HomeReach is reviewing target areas, ad spend, creative, and launch readiness.";

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{campaign.business_name ?? "Digital targeting campaign"}</h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                {statusLabel(String(campaign.campaign_status))}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                {String(campaign.payment_status).replace(/_/g, " ")}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {labelList(String(campaign.targeting_type ?? ""), TARGETING_TYPE_LABELS)} | {labelList(String(campaign.objective ?? ""), OBJECTIVE_LABELS)}
            </p>
          </div>
          <Link href="mailto:jason@home-reach.com?subject=Digital%20Targeting%20Campaign%20Question" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            Message support
          </Link>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Next step</p>
          <p className="mt-2 text-sm font-bold leading-6 text-blue-950">{nextStep}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ClientMetric label="Start date" value={fmtDate(campaign.start_date)} icon={Clock3} />
          <ClientMetric label="Management fee" value={`${formatUsd(Number(campaign.monthly_management_fee ?? 0))}/mo`} icon={ShieldCheck} />
          <ClientMetric label="Ad spend budget" value={`${formatUsd(Number(campaign.monthly_ad_spend ?? 0))}/mo`} icon={RadioTower} />
          <ClientMetric label="Direct mail" value={campaign.direct_mail_addon ? "Included in plan" : "Optional add-on"} icon={Mail} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center gap-2">
              <MapPinned className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <h3 className="font-bold text-gray-900">Target area summary</h3>
            </div>
            <div className="mt-3 grid gap-2">
              {locations.length === 0 ? (
                <p className="text-sm text-gray-500">HomeReach is still reviewing target locations.</p>
              ) : (
                locations.slice(0, 6).map((location) => (
                  <div key={location.id} className="rounded-lg bg-white px-3 py-2 text-sm text-gray-600">
                    <span className="font-bold text-gray-900">{String(location.location_type).replace(/_/g, " ")}:</span>{" "}
                    {location.address ?? "Address review pending"}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center gap-2">
              <FileImage className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <h3 className="font-bold text-gray-900">Creative previews</h3>
            </div>
            <div className="mt-3 grid gap-2">
              {assets.length === 0 ? (
                <p className="text-sm text-gray-500">Upload assets or send them to HomeReach so creative can be prepared.</p>
              ) : (
                assets.slice(0, 5).map((asset) => (
                  <div key={asset.id} className="rounded-lg bg-white px-3 py-2 text-sm text-gray-600">
                    <span className="font-bold text-gray-900">{asset.asset_type}:</span> {asset.file_name ?? asset.status}
                  </div>
                ))
              )}
            </div>
            <Link href="mailto:jason@home-reach.com?subject=Digital%20Targeting%20Assets" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload assets
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <h3 className="font-bold text-gray-900">Reporting metrics</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ClientMetric label="Impressions" value={totals.impressions ? totals.impressions.toLocaleString() : "Pending"} icon={RadioTower} />
            <ClientMetric label="Clicks" value={totals.clicks ? totals.clicks.toLocaleString() : "Pending"} icon={CheckCircle2} />
            <ClientMetric label="Spend tracked" value={totals.spend ? formatUsd(totals.spend) : "Pending"} icon={ShieldCheck} />
            <ClientMetric label="Leads / calls" value={totals.leads || totals.calls ? `${totals.leads} / ${totals.calls}` : "Pending"} icon={MessageSquareText} />
          </div>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            Metrics depend on platform access, tracking availability, and manual entry where APIs are unavailable. Results vary.
          </p>
        </div>
      </div>
    </section>
  );
}

function ClientMetric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CheckCircle2 }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <Icon className="h-4 w-4 text-blue-700" aria-hidden="true" />
      <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
    </div>
  );
}

function PageIntro({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Customer campaign center</p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">{body}</p>
    </div>
  );
}
