"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";

type CampaignOption = {
  id: string;
  name: string;
};

export function ReportingImportForm({ campaigns }: { campaigns: CampaignOption[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          try {
            const response = await fetch("/api/admin/ad-tech/reporting-imports", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                marketCaptureCampaignId: form.get("campaignId"),
                platform: form.get("platform"),
                reportingPeriodStart: form.get("start"),
                reportingPeriodEnd: form.get("end"),
                impressions: form.get("impressions"),
                reach: form.get("reach"),
                clicks: form.get("clicks"),
                spendCents: Math.round(Number(form.get("spend") || 0) * 100),
                leads: form.get("leads"),
                calls: form.get("calls"),
                forms: form.get("forms"),
                landingPageVisits: form.get("landingPageVisits"),
                qrScans: form.get("qrScans"),
                notes: form.get("notes"),
                recommendations: form.get("recommendations"),
                source: "manual",
              }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Import failed");
            setMessage("Reporting import saved.");
            window.location.reload();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Import failed");
          }
        });
      }}
    >
      <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        Campaign
        <select name="campaignId" required className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-900">
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 md:grid-cols-3">
        <Field name="platform" label="Platform" defaultValue="manual" />
        <Field name="start" label="Start" type="date" />
        <Field name="end" label="End" type="date" />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Field name="impressions" label="Impressions" type="number" />
        <Field name="reach" label="Reach" type="number" />
        <Field name="clicks" label="Clicks" type="number" />
        <Field name="spend" label="Spend $" type="number" step="0.01" />
        <Field name="leads" label="Leads" type="number" />
        <Field name="calls" label="Calls" type="number" />
        <Field name="forms" label="Forms" type="number" />
        <Field name="landingPageVisits" label="Visits" type="number" />
      </div>
      <Field name="qrScans" label="QR Scans" type="number" />
      <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        Notes
        <textarea name="notes" rows={2} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-900" />
      </label>
      <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        Recommendations
        <textarea name="recommendations" rows={2} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-900" />
      </label>
      <button
        type="submit"
        disabled={isPending || campaigns.length === 0}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {isPending ? "Saving" : "Save Manual Import"}
      </button>
      {message ? <p className="text-xs font-semibold text-slate-500">{message}</p> : null}
    </form>
  );
}

function Field({ defaultValue, label, name, step, type = "text" }: { defaultValue?: string; label: string; name: string; step?: string; type?: string }) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
      {label}
      <input
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-900"
      />
    </label>
  );
}
