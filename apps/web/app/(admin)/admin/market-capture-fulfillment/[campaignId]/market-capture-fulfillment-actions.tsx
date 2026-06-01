"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clipboard, Plus, Save } from "lucide-react";

type Props =
  | { mode: "copy"; copyText: string }
  | { mode: "init"; leadId: string }
  | { mode: "campaign"; campaignId: string; campaign: Record<string, unknown> }
  | { mode: "checklist"; campaignId: string; checklistId: string; status: string }
  | { mode: "task"; campaignId: string; taskId: string; status: string; priority?: string }
  | { mode: "asset"; campaignId: string; assetId: string; status: string }
  | { mode: "approval"; campaignId: string; approvalId: string; status: string }
  | { mode: "location"; campaignId: string }
  | { mode: "report"; campaignId: string }
  | { mode: "note"; campaignId: string };

const statusChoices = ["open", "in_progress", "completed", "blocked"];

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Update failed.");
  return data;
}

export function MarketCaptureFulfillmentActions(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(body: unknown) {
    if (!("campaignId" in props)) return;
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/admin/market-capture/fulfillment/${props.campaignId}`, body);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  if (props.mode === "copy") {
    const { copyText } = props;
    async function copy() {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }

    return (
      <button type="button" onClick={copy} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50">
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
      </button>
    );
  }

  if (props.mode === "init") {
    const { leadId } = props;
    async function init() {
      setBusy(true);
      setError(null);
      try {
        const data = await postJson("/api/admin/market-capture/fulfillment/init", { leadId });
        if (data.campaignId) router.push(`/admin/market-capture-fulfillment/${data.campaignId}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Initialization failed.");
      } finally {
        setBusy(false);
      }
    }

    return (
      <div>
        <button type="button" onClick={init} disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-600 disabled:opacity-50">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Fulfillment Campaign
        </button>
        {error ? <p className="mt-2 text-xs font-bold text-red-600">{error}</p> : null}
      </div>
    );
  }

  if (props.mode === "campaign") {
    const campaign = props.campaign;
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void run({
            action: "update_campaign",
            campaignStatus: form.get("campaignStatus"),
            launchStatus: form.get("launchStatus"),
            creativeStatus: form.get("creativeStatus"),
            approvalStatus: form.get("approvalStatus"),
            reportingStatus: form.get("reportingStatus"),
            directMailStatus: form.get("directMailStatus"),
            directMailQuantity: form.get("directMailQuantity"),
            directMailEstimatedCostCents: form.get("directMailEstimatedCostCents"),
            landingPageUrl: form.get("landingPageUrl"),
            trackingUrl: form.get("trackingUrl"),
            owner: form.get("owner"),
            reviewer: form.get("reviewer"),
            designer: form.get("designer"),
            accountManager: form.get("accountManager"),
            notes: form.get("notes"),
          });
        }}
        className="grid gap-3"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Select name="campaignStatus" label="Campaign Status" value={String(campaign.campaign_status ?? "campaign_setup")} options={["campaign_setup", "asset_collection", "creative_review", "client_approval", "ready_for_launch", "live", "reporting", "renewal_opportunity", "closed"]} />
          <Select name="launchStatus" label="Launch Status" value={String(campaign.launch_status ?? "not_started")} options={["not_started", "blocked", "ready", "manual_launch_complete", "live", "paused", "complete"]} />
          <Select name="creativeStatus" label="Creative Status" value={String(campaign.creative_status ?? "missing")} options={["missing", "uploaded", "needs_review", "approved", "rejected"]} />
          <Select name="approvalStatus" label="Approval Status" value={String(campaign.approval_status ?? "awaiting_approval")} options={["awaiting_approval", "approved", "needs_revision", "rejected"]} />
          <Select name="reportingStatus" label="Reporting Status" value={String(campaign.reporting_status ?? "not_started")} options={["not_started", "scheduled", "due", "submitted"]} />
          <Select name="directMailStatus" label="Direct Mail Status" value={String(campaign.direct_mail_status ?? "not_requested")} options={["not_requested", "requested", "proposed", "approved", "in_production", "delivered"]} />
          <Input name="directMailQuantity" label="Mail Quantity" defaultValue={String(campaign.direct_mail_quantity ?? "")} />
          <Input name="directMailEstimatedCostCents" label="Estimated Mail Cost Cents" defaultValue={String(campaign.direct_mail_estimated_cost_cents ?? "")} />
          <Input name="landingPageUrl" label="Landing Page URL" defaultValue={String(campaign.landing_page_url ?? "")} />
          <Input name="trackingUrl" label="Tracking URL" defaultValue={String(campaign.tracking_url ?? "")} />
          <Input name="owner" label="Owner" defaultValue={String(campaign.owner ?? "jason")} />
          <Input name="reviewer" label="Reviewer" defaultValue={String(campaign.reviewer ?? "")} />
          <Input name="designer" label="Designer" defaultValue={String(campaign.designer ?? "")} />
          <Input name="accountManager" label="Account Manager" defaultValue={String(campaign.account_manager ?? "")} />
        </div>
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          Notes
          <textarea name="notes" defaultValue={String(campaign.notes ?? "")} rows={3} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
        </label>
        <Submit busy={busy} label="Update Campaign" />
        {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
      </form>
    );
  }

  if (props.mode === "checklist" || props.mode === "task") {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {statusChoices.map((status) => (
          <button
            key={status}
            type="button"
            disabled={busy || props.status === status}
            onClick={() =>
              run(
                props.mode === "checklist"
                  ? { action: "update_checklist", checklistId: props.checklistId, status }
                  : { action: "update_task", taskId: props.taskId, status, priority: props.priority ?? "normal" },
              )
            }
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {status.replace(/_/g, " ")}
          </button>
        ))}
        {error ? <p className="basis-full text-xs font-bold text-red-600">{error}</p> : null}
      </div>
    );
  }

  if (props.mode === "asset") {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {["approved", "needs_review", "rejected"].map((status) => (
          <button
            key={status}
            type="button"
            disabled={busy || props.status === status}
            onClick={() => run({ action: "update_asset", assetId: props.assetId, status })}
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {status.replace(/_/g, " ")}
          </button>
        ))}
        {error ? <p className="basis-full text-xs font-bold text-red-600">{error}</p> : null}
      </div>
    );
  }

  if (props.mode === "approval") {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {["approved", "needs_revision", "rejected"].map((status) => (
          <button
            key={status}
            type="button"
            disabled={busy || props.status === status}
            onClick={() => run({ action: "update_approval", approvalId: props.approvalId, status })}
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {status.replace(/_/g, " ")}
          </button>
        ))}
        {error ? <p className="basis-full text-xs font-bold text-red-600">{error}</p> : null}
      </div>
    );
  }

  if (props.mode === "location") {
    return (
      <SmallForm
        onSubmit={(form) =>
          run({
            action: "add_location",
            locationType: form.get("locationType"),
            name: form.get("name"),
            address: form.get("address"),
            radiusMiles: form.get("radiusMiles"),
            notes: form.get("notes"),
          })
        }
        busy={busy}
        error={error}
        submitLabel="Add Location"
      >
        <Select name="locationType" label="Type" value="custom_area" options={["target_geography", "jobsite", "competitor", "service_area", "political_geography", "event", "custom_area"]} />
        <Input name="name" label="Name" required />
        <Input name="address" label="Address" />
        <Input name="radiusMiles" label="Radius Miles" />
        <Textarea name="notes" label="Notes" rows={2} />
      </SmallForm>
    );
  }

  if (props.mode === "report") {
    return (
      <SmallForm
        onSubmit={(form) =>
          run({
            action: "add_report",
            reportingPeriodStart: form.get("reportingPeriodStart"),
            reportingPeriodEnd: form.get("reportingPeriodEnd"),
            impressions: form.get("impressions"),
            reach: form.get("reach"),
            clicks: form.get("clicks"),
            spend: form.get("spend"),
            leads: form.get("leads"),
            calls: form.get("calls"),
            landingPageVisits: form.get("landingPageVisits"),
            qrScans: form.get("qrScans"),
            directMailQuantityReport: form.get("directMailQuantityReport"),
            notes: form.get("notes"),
            recommendations: form.get("recommendations"),
          })
        }
        busy={busy}
        error={error}
        submitLabel="Save Report"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Input name="reportingPeriodStart" label="Period Start" type="date" />
          <Input name="reportingPeriodEnd" label="Period End" type="date" />
          <Input name="impressions" label="Impressions" />
          <Input name="reach" label="Reach" />
          <Input name="clicks" label="Clicks" />
          <Input name="spend" label="Spend Cents" />
          <Input name="leads" label="Leads" />
          <Input name="calls" label="Calls" />
          <Input name="landingPageVisits" label="Landing Page Visits" />
          <Input name="qrScans" label="QR Scans" />
          <Input name="directMailQuantityReport" label="Direct Mail Quantity" />
        </div>
        <Textarea name="notes" label="Notes" rows={2} />
        <Textarea name="recommendations" label="Recommendations" rows={2} />
      </SmallForm>
    );
  }

  return (
    <SmallForm
      onSubmit={(form) => run({ action: "add_note", content: form.get("content") })}
      busy={busy}
      error={error}
      submitLabel="Add Note"
    >
      <Textarea name="content" label="Internal Note" rows={3} required />
    </SmallForm>
  );
}

function SmallForm({
  children,
  onSubmit,
  busy,
  error,
  submitLabel,
}: {
  children: React.ReactNode;
  onSubmit: (form: FormData) => void;
  busy: boolean;
  error: string | null;
  submitLabel: string;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
        event.currentTarget.reset();
      }}
      className="grid gap-3"
    >
      {children}
      <Submit busy={busy} label={submitLabel} />
      {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
    </form>
  );
}

function Submit({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-600 disabled:opacity-50">
      <Save className="h-4 w-4" aria-hidden="true" />
      {busy ? "Saving..." : label}
    </button>
  );
}

function Input({
  name,
  label,
  defaultValue,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-700">
      {label}
      <input name={name} type={type} required={required} defaultValue={defaultValue} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal" />
    </label>
  );
}

function Textarea({ name, label, rows, required = false }: { name: string; label: string; rows: number; required?: boolean }) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-700">
      {label}
      <textarea name={name} rows={rows} required={required} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
    </label>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: string[] }) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-700">
      {label}
      <select name={name} defaultValue={value} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal">
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
