"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileImage,
  Landmark,
  MapPinned,
  Megaphone,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { DIGITAL_TARGETING_MANAGEMENT_FEE_CENTS, formatUsd } from "@/lib/digital-targeting/config";

const objectives = [
  ["leads", "Leads"],
  ["calls", "Calls"],
  ["website_visits", "Website visits"],
  ["brand_awareness", "Brand awareness"],
  ["event_promotion", "Event promotion"],
  ["political_awareness", "Political awareness"],
  ["neighborhood_saturation", "Neighborhood saturation"],
] as const;

const targetingTypes = [
  ["jobsite_neighborhood", "Jobsite neighborhood"],
  ["competitor_area", "Competitor area"],
  ["event_area", "Event area"],
  ["service_area", "Service area"],
  ["political_geography", "Political geography"],
  ["custom_area", "Custom area"],
] as const;

export function DigitalTargetingIntakeClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const res = await fetch("/api/digital-targeting/intake", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "The campaign intake could not be submitted.");
        setLoading(false);
        return;
      }

      const token = data.checkoutToken ? `token=${encodeURIComponent(data.checkoutToken)}` : "";
      window.location.href = `/digital-targeting/checkout${token ? `?${token}` : ""}`;
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/digital-targeting" className="flex items-center gap-2 text-sm font-black">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs">HR</span>
            HomeReach
          </Link>
          <span className="hidden rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-100 sm:inline-flex">
            Digital Targeting Intake
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-6 lg:py-8">
        <aside className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.08] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Campaign setup</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Tell us where you want to stay visible.
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              HomeReach will turn this into an admin-reviewed launch plan. No ads are launched, spend is committed, or
              customer-facing claims are made without human approval.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              {
                label: "Management fee",
                value: `${formatUsd(DIGITAL_TARGETING_MANAGEMENT_FEE_CENTS)}/month`,
                icon: CircleDollarSign,
              },
              { label: "Ad spend", value: "Client-funded separately", icon: Megaphone },
              { label: "Launch control", value: "Manual safe mode by default", icon: ShieldCheck },
              { label: "Direct mail", value: "Optional same-neighborhood add-on", icon: MapPinned },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.08] p-4">
                  <Icon className="h-5 w-5 text-cyan-200" aria-hidden="true" />
                  <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                  <p className="mt-1 text-sm font-black text-white">{item.value}</p>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="rounded-lg border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl shadow-slate-950/25">
          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-7">
            <FormSection eyebrow="Business" title="Who is this campaign for?" icon={MapPinned}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input name="businessName" label="Business name" required placeholder="Peak Roofing Co." />
                <Input name="contactName" label="Contact name" required placeholder="Jane Smith" />
                <Input name="email" label="Email" required type="email" placeholder="jane@peakroofing.com" />
                <Input name="phone" label="Phone" required type="tel" placeholder="(330) 555-0100" />
                <Input name="website" label="Website" type="url" placeholder="https://peakroofing.com" />
                <Input name="industry" label="Industry" required placeholder="Roofing, HVAC, med spa..." />
              </div>
            </FormSection>

            <FormSection eyebrow="Budget and goal" title="What should the campaign accomplish?" icon={CircleDollarSign}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input name="monthlyAdSpend" label="Monthly ad spend budget" required placeholder="1000" helper="Ad spend is separate from the management fee." />
                <Input name="preferredStartDate" label="Preferred campaign start date" type="date" />
              </div>
              <CheckboxGrid name="objectives" options={objectives} />
            </FormSection>

            <FormSection eyebrow="Targeting" title="Where do you want HomeReach to focus?" icon={Landmark}>
              <CheckboxGrid name="targetingTypes" options={targetingTypes} />
              <Textarea
                name="targetLocations"
                label="Target address/location(s)"
                required
                rows={4}
                placeholder="One per line: job address, neighborhood, ZIP, city, district, or service area."
              />
              <Input name="radiusPreference" label="Radius preference" placeholder="Example: 1 mile, 3 miles, ZIP only, citywide" />
              <Textarea
                name="competitorLocations"
                label="Competitor names/addresses if applicable"
                rows={3}
                placeholder="One per line. HomeReach will verify what platform rules allow."
              />
              <Textarea
                name="eventLocations"
                label="Event names/addresses/dates if applicable"
                rows={3}
                placeholder="Example: County fair, 123 Main St, June 12-15."
              />
            </FormSection>

            <FormSection eyebrow="Creative" title="What should the ads say or use?" icon={FileImage}>
              <Textarea
                name="campaignOffer"
                label="Campaign offer/message"
                required
                rows={3}
                placeholder="Example: Free roof inspection for homeowners near our recent jobs."
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <FileInput name="logo" label="Upload logo" />
                <FileInput name="images" label="Upload images" multiple />
                <FileInput name="postcard" label="Existing postcard" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Toggle name="directMailAddon" label="Would you like postcards added?" />
                <Toggle name="landingPageNeeded" label="Landing page needed?" />
                <Toggle name="creativePackageAddon" label="Creative package add-on?" />
              </div>
            </FormSection>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <label className="flex gap-3">
                <input name="consent" type="checkbox" value="true" required className="mt-1 h-4 w-4 shrink-0 rounded border-amber-300" />
                <span>
                  I understand HomeReach charges a {formatUsd(DIGITAL_TARGETING_MANAGEMENT_FEE_CENTS)}/month
                  management fee and ad spend is separate, client-funded, and subject to platform approval.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-4 text-sm font-black text-white shadow-xl shadow-blue-950/20 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating campaign..." : "Continue to Payment Review"}
              {!loading ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
            </button>

            <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              Results vary. Targeting availability depends on platform policies. No prohibited targeting categories or
              individual-level private identity display.
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}

function FormSection({
  eyebrow,
  title,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: typeof CalendarDays;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 ring-1 ring-slate-200">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{title}</h2>
        </div>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Input({
  name,
  label,
  placeholder,
  type = "text",
  required = false,
  helper,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-800">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {helper ? <span className="mt-0.5 block text-xs text-slate-500">{helper}</span> : null}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function Textarea({
  name,
  label,
  placeholder,
  rows,
  required = false,
}: {
  name: string;
  label: string;
  placeholder?: string;
  rows: number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-800">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <textarea
        name={name}
        required={required}
        rows={rows}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function CheckboxGrid({
  name,
  options,
}: {
  name: string;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {options.map(([value, label]) => (
        <label key={value} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          <input name={name} type="checkbox" value={value} className="h-4 w-4 rounded border-slate-300" />
          {label}
        </label>
      ))}
    </div>
  );
}

function Toggle({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">
      <input name={name} type="checkbox" value="true" className="h-4 w-4 rounded border-slate-300" />
      {label}
    </label>
  );
}

function FileInput({ name, label, multiple = false }: { name: string; label: string; multiple?: boolean }) {
  return (
    <label className="block rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">
      <span className="flex items-center gap-2 font-bold text-slate-800">
        <Upload className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
      <input name={name} type="file" multiple={multiple} accept="image/png,image/jpeg,image/webp,application/pdf" className="mt-2 w-full text-xs" />
    </label>
  );
}
