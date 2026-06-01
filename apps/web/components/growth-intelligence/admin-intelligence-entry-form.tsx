"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

const ENTRY_TYPES = [
  ["competitor", "Competitor"],
  ["local_event", "Local Event"],
  ["neighborhood", "Neighborhood"],
  ["development", "Development"],
  ["seasonal_opportunity", "Seasonal"],
  ["political_race", "Political Race"],
  ["local_business_category", "Business Category"],
  ["storm_weather_note", "Storm/Weather Note"],
  ["community_opportunity", "Community Opportunity"],
  ["referral_target", "Referral Target"],
  ["partnership_target", "Partnership Target"],
];

export function AdminIntelligenceEntryForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      setMessage(null);
      const payload = {
        name: String(formData.get("name") ?? ""),
        entryType: String(formData.get("entryType") ?? ""),
        location: String(formData.get("location") ?? ""),
        clientFit: String(formData.get("clientFit") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        estimatedOpportunityCents: Number(formData.get("estimatedOpportunityCents") ?? 0),
        priority: Number(formData.get("priority") ?? 50),
        urgency: String(formData.get("urgency") ?? "medium"),
        industryFit: String(formData.get("industryFit") ?? ""),
        geographyFit: String(formData.get("geographyFit") ?? ""),
        clientFitTags: String(formData.get("clientFitTags") ?? ""),
        campaignTypeFit: String(formData.get("campaignTypeFit") ?? ""),
        budgetFit: String(formData.get("budgetFit") ?? ""),
      };
      const response = await fetch("/api/admin/growth-intelligence/admin-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error ?? "Entry could not be saved");
        return;
      }
      setMessage("Saved and matched to clients");
      const form = document.getElementById("growth-intelligence-entry-form") as HTMLFormElement | null;
      form?.reset();
    });
  }

  return (
    <form id="growth-intelligence-entry-form" action={submit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Input name="name" label="Name" required placeholder="Spring home show, new subdivision, competitor branch" />
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          Type
          <select name="entryType" className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900">
            {ENTRY_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <Input name="location" label="Location" placeholder="City, ZIP, neighborhood, venue, county" />
        <Input name="estimatedOpportunityCents" label="Estimated Opportunity Cents" type="number" defaultValue="49900" />
        <Input name="industryFit" label="Industry Fit" placeholder="Roofing, HVAC, Lawn Care" />
        <Input name="geographyFit" label="Geography Fit" placeholder="Columbus, 43016, Franklin County" />
        <Input name="campaignTypeFit" label="Campaign Type Fit" placeholder="Market Capture, direct mail, political" />
        <Input name="clientFitTags" label="Client Fit Tags" placeholder="recurring service, homeowner, local business" />
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          Urgency
          <select name="urgency" className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900">
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
            <option value="low">Low</option>
          </select>
        </label>
        <Input name="priority" label="Priority" type="number" defaultValue="65" min="0" max="100" />
      </div>
      <Input name="budgetFit" label="Budget Fit" placeholder="Any budget, $500+, $2k+, needs quote" />
      <TextArea name="clientFit" label="Client Fit" placeholder="Which clients this is best for and why" />
      <TextArea name="notes" label="Notes" placeholder="What happened locally, why it matters, timing, offer ideas, constraints" />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {isPending ? "Saving" : "Add Intelligence"}
      </button>
      {message ? <p className="text-xs font-bold text-slate-500">{message}</p> : null}
    </form>
  );
}

type FieldProps = {
  defaultValue?: string;
  label: string;
  max?: string;
  min?: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
};

function Input({ label, ...props }: FieldProps) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-700">
      {label}
      <input {...props} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400" />
    </label>
  );
}

function TextArea({ label, ...props }: Pick<FieldProps, "label" | "name" | "placeholder">) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-700">
      {label}
      <textarea {...props} rows={3} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400" />
    </label>
  );
}
