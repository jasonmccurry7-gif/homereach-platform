"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  Copy,
  CreditCard,
  FileImage,
  Link as LinkIcon,
  MapPinned,
  Megaphone,
  MousePointerClick,
  RadioTower,
} from "lucide-react";
import {
  DIGITAL_CAMPAIGN_STATUS_LABELS,
  OBJECTIVE_LABELS,
  TARGETING_TYPE_LABELS,
} from "@/lib/digital-targeting/campaign";
import { formatUsd } from "@/lib/digital-targeting/config";
import type { LaunchReadiness, ManualLaunchPlan } from "@/lib/digital-targeting/ad-platforms";
import type {
  DigitalCampaignAssetRecord,
  DigitalCampaignDraftRecord,
  DigitalCampaignMetricRecord,
  DigitalCampaignRecord,
  DigitalCampaignTaskRecord,
  DigitalTargetLocationRecord,
} from "@/lib/digital-targeting/types";

const statusOptions = [
  "intake_complete",
  "payment_pending",
  "target_area_review",
  "creative_needed",
  "ad_spend_needed",
  "ready_to_launch",
  "live",
  "reporting",
  "renewal_upsell",
  "paused",
  "cancelled",
];

function labelList(value: string, labels: Record<string, string>) {
  return value
    .split(",")
    .map((part) => labels[part.trim()] ?? part.trim().replace(/_/g, " "))
    .filter(Boolean)
    .join(", ");
}

function statusLabel(value: string) {
  return DIGITAL_CAMPAIGN_STATUS_LABELS[value] ?? value.replace(/_/g, " ");
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function mapsSrc(locations: DigitalTargetLocationRecord[]) {
  const first = locations.find((location) => location.address);
  if (!first) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(first.address ?? "")}&output=embed`;
}

export function DigitalTargetingDetailClient({
  campaign: initialCampaign,
  locations,
  assets,
  tasks: initialTasks,
  drafts,
  metrics: initialMetrics,
  readiness,
  manualPlan,
}: {
  campaign: DigitalCampaignRecord;
  locations: DigitalTargetLocationRecord[];
  assets: DigitalCampaignAssetRecord[];
  tasks: DigitalCampaignTaskRecord[];
  drafts: DigitalCampaignDraftRecord[];
  metrics: DigitalCampaignMetricRecord[];
  readiness: LaunchReadiness;
  manualPlan: ManualLaunchPlan[];
}) {
  const [campaign, setCampaign] = useState(initialCampaign);
  const [tasks, setTasks] = useState(initialTasks);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const mapUrl = mapsSrc(locations);

  const totals = useMemo(() => {
    return metrics.reduce(
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
  }, [metrics]);

  const ctr = totals.impressions > 0 ? `${((totals.clicks / totals.impressions) * 100).toFixed(2)}%` : "-";
  const cpc = totals.clicks > 0 ? formatUsd(Math.round(totals.spend / totals.clicks)) : "-";
  const cpl = totals.leads > 0 ? formatUsd(Math.round(totals.spend / totals.leads)) : "-";

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 3000);
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      showFeedback("Copied.");
    } catch {
      showFeedback("Clipboard access failed.");
    }
  }

  async function updateTask(task: DigitalCampaignTaskRecord, checked: boolean) {
    setSaving(task.id);
    try {
      const res = await fetch(`/api/admin/digital-targeting/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: checked ? "completed" : "open" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Task update failed.");
      setTasks((prev) => prev.map((row) => (row.id === task.id ? { ...row, ...data.task } : row)));
      showFeedback(checked ? "Task completed." : "Task reopened.");
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Task update failed.");
    } finally {
      setSaving(null);
    }
  }

  async function updateCampaign(updates: Record<string, unknown>, message: string) {
    setSaving("campaign");
    try {
      const res = await fetch(`/api/admin/digital-targeting/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Campaign update failed.");
      setCampaign((prev) => ({ ...prev, ...data.campaign }));
      showFeedback(message);
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Campaign update failed.");
    } finally {
      setSaving(null);
    }
  }

  async function addMetric(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("metrics");
    try {
      const form = new FormData(event.currentTarget);
      const payload = Object.fromEntries(form.entries());
      const res = await fetch("/api/admin/digital-targeting/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Metric save failed.");
      setMetrics((prev) => [data.metric, ...prev]);
      event.currentTarget.reset();
      showFeedback("Metrics saved.");
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Metric save failed.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-5">
      {feedback ? (
        <div className="fixed right-4 top-4 z-50 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-xl">
          {feedback}
        </div>
      ) : null}

      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Digital Targeting Campaign</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{campaign.business_name}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {campaign.contact_name ?? "No contact"} | {campaign.email} | {campaign.phone ?? "No phone"}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:w-[36rem]">
            <MiniStat label="Payment" value={String(campaign.payment_status).replace(/_/g, " ")} icon={CreditCard} />
            <MiniStat label="Status" value={statusLabel(String(campaign.campaign_status))} icon={RadioTower} />
            <MiniStat label="Ad Spend" value={`${formatUsd(Number(campaign.monthly_ad_spend ?? 0))}/mo`} icon={Megaphone} />
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.88fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Campaign Detail</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Detail label="Industry" value={campaign.industry ?? "-"} />
            <Detail label="Website" value={campaign.website ?? "-"} />
            <Detail label="Objective" value={labelList(String(campaign.objective ?? ""), OBJECTIVE_LABELS)} />
            <Detail label="Targeting Type" value={labelList(String(campaign.targeting_type ?? ""), TARGETING_TYPE_LABELS)} />
            <Detail label="Management Fee" value={`${formatUsd(Number(campaign.monthly_management_fee ?? 0))}/mo`} />
            <Detail label="Start Date" value={fmtDate(campaign.start_date)} />
            <Detail label="Landing Page URL" value={campaign.landing_page_url ?? "-"} />
            <Detail label="Tracking URL" value={campaign.tracking_url ?? "-"} />
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Notes / offer</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{campaign.notes ?? "No campaign offer captured."}</p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Next Best Action</h2>
          <div className="mt-4 grid gap-2">
            <select
              value={campaign.campaign_status ?? "intake_complete"}
              onChange={(event) => updateCampaign({ campaignStatus: event.target.value }, "Campaign status updated.")}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
            <ActionButton
              label="Confirm ad spend"
              active={Boolean(campaign.ad_spend_confirmed)}
              onClick={() => updateCampaign({ adSpendConfirmed: !campaign.ad_spend_confirmed }, "Ad spend confirmation updated.")}
            />
            <ActionButton
              label="Creative approved"
              active={Boolean(campaign.creative_approved)}
              onClick={() => updateCampaign({ creativeApproved: !campaign.creative_approved }, "Creative approval updated.")}
            />
            <ActionButton
              label="Admin approved for launch"
              active={Boolean(campaign.admin_approved_for_launch)}
              onClick={() => updateCampaign({ adminApprovedForLaunch: !campaign.admin_approved_for_launch }, "Launch approval updated.")}
            />
            <button
              onClick={() => updateCampaign({ campaignStatus: "live" }, "Campaign marked live and client launch email queued.")}
              disabled={saving === "campaign"}
              className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark Manual Launch Complete
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-slate-950">Map / Target Area</h2>
            <MapPinned className="h-5 w-5 text-blue-700" aria-hidden="true" />
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {mapUrl ? (
              <iframe title="Target area map preview" src={mapUrl} className="h-72 w-full border-0" loading="lazy" />
            ) : (
              <div className="flex h-72 items-center justify-center text-sm font-semibold text-slate-500">No mappable address yet.</div>
            )}
          </div>
          <div className="mt-4 grid gap-2">
            {locations.map((location) => (
              <div key={location.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-black text-slate-950">{location.name ?? location.address}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {String(location.location_type).replace(/_/g, " ")} | radius {location.radius_miles ?? "TBD"} miles
                </p>
                {location.name ? <p className="mt-1 text-xs text-slate-500">{location.address}</p> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Admin Fulfillment Checklist</h2>
          <div className="mt-4 grid gap-2">
            {tasks.map((task) => (
              <label key={task.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  type="checkbox"
                  checked={task.status === "completed"}
                  onChange={(event) => updateTask(task, event.target.checked)}
                  disabled={saving === task.id}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-slate-950">{task.title}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Owner: {task.owner ?? "unassigned"} | Due: {fmtDate(task.due_date)} | Status: {String(task.status).replace(/_/g, " ")}
                  </span>
                  {task.notes ? <span className="mt-1 block text-xs text-slate-500">{task.notes}</span> : null}
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">AI Drafting Area</h2>
          <div className="mt-4 grid gap-3">
            {drafts.map((draft) => (
              <div key={draft.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black capitalize text-slate-950">{String(draft.draft_type).replace(/_/g, " ")}</p>
                  <button
                    onClick={() => copyText(String(draft.content))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-100"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Copy
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-5 text-slate-700">{draft.content}</pre>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Campaign Launch Modes</h2>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">
              Current mode: {readiness.mode === "api_draft" ? "API draft gated" : "Manual launch mode"}
            </p>
            {readiness.blockers.length > 0 ? (
              <p className="mt-2 text-xs leading-5 text-amber-800">{readiness.blockers.join(" ")}</p>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3">
            {manualPlan.map((plan) => (
              <div key={plan.platform} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-950">{plan.platform} manual launch plan</p>
                  <button
                    onClick={() => copyText(plan.instructions.map((item) => `- ${item}`).join("\n"))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-100"
                  >
                    <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                    Copy
                  </button>
                </div>
                <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {plan.instructions.map((item, index) => (
                    <li key={item} className="flex gap-2">
                      <span className="font-black text-slate-900">{index + 1}.</span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Creative Assets</h2>
          <div className="mt-4 grid gap-2">
            {assets.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No assets uploaded yet.</p>
            ) : (
              assets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{asset.file_name ?? asset.asset_type}</p>
                    <p className="text-xs text-slate-500">{asset.asset_type} | {asset.status}</p>
                  </div>
                  {asset.file_url ? <LinkIcon className="h-4 w-4 text-blue-700" aria-hidden="true" /> : <FileImage className="h-4 w-4 text-slate-400" aria-hidden="true" />}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Reporting</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <MiniStat label="Impressions" value={totals.impressions.toLocaleString()} icon={RadioTower} />
            <MiniStat label="Clicks / CTR" value={`${totals.clicks.toLocaleString()} / ${ctr}`} icon={MousePointerClick} />
            <MiniStat label="Spend / CPC" value={`${formatUsd(totals.spend)} / ${cpc}`} icon={CreditCard} />
            <MiniStat label="Leads / CPL" value={`${totals.leads.toLocaleString()} / ${cpl}`} icon={Megaphone} />
          </div>

          <form onSubmit={addMetric} className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <MetricInput name="reportingPeriodStart" label="Period start" type="date" required />
            <MetricInput name="reportingPeriodEnd" label="Period end" type="date" required />
            <MetricInput name="impressions" label="Impressions" type="number" />
            <MetricInput name="clicks" label="Clicks" type="number" />
            <MetricInput name="spend" label="Spend ($)" type="number" />
            <MetricInput name="leads" label="Leads/forms" type="number" />
            <MetricInput name="calls" label="Calls" type="number" />
            <MetricInput name="landingPageVisits" label="Landing page visits" type="number" />
            <MetricInput name="qrScans" label="QR scans" type="number" />
            <label className="sm:col-span-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Notes/recommendations</span>
              <textarea name="notes" rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <button disabled={saving === "metrics"} className="min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">
              Save Manual Metrics
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CheckCircle2 }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <Icon className="h-4 w-4 text-blue-700" aria-hidden="true" />
      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function ActionButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-11 items-center justify-between rounded-lg border px-3 py-2 text-sm font-black ${
        active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      {label}
      {active ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : null}
    </button>
  );
}

function MetricInput({ name, label, type, required = false }: { name: string; label: string; type: string; required?: boolean }) {
  return (
    <label>
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <input name={name} type={type} required={required} min={type === "number" ? 0 : undefined} step={name === "spend" ? "0.01" : undefined} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
    </label>
  );
}
