"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileImage,
  MapPinned,
  ShieldCheck,
  Target,
  Upload,
} from "lucide-react";
import {
  MARKET_CAPTURE_MANAGEMENT_FEE_CENTS,
  MARKET_CAPTURE_MIN_COMMITMENT_MONTHS,
  MARKET_CAPTURE_PRICING_TIERS,
  MARKET_CAPTURE_RECOMMENDED_AD_SPEND_CENTS,
  formatUsd,
} from "@/lib/market-capture/config";

const objectives = [
  ["leads", "Leads"],
  ["calls", "Calls"],
  ["website_visits", "Website Visits"],
  ["awareness", "Awareness"],
  ["event_promotion", "Event Promotion"],
  ["neighborhood_saturation", "Neighborhood Saturation"],
  ["political_awareness", "Political Awareness"],
  ["competitor_visibility", "Competitor Visibility"],
  ["jobsite_expansion", "Jobsite Expansion"],
] as const;

const targetingTypes = [
  ["jobsite_halo", "Jobsite Halo"],
  ["competitor_area", "Competitor Area"],
  ["neighborhood_saturation", "Neighborhood Saturation"],
  ["service_area", "Service Area"],
  ["event_area", "Event Area"],
  ["political_geography", "Political Geography"],
  ["custom_area", "Custom Area"],
  ["digital_direct_mail", "Digital + Direct Mail"],
] as const;

export function MarketCaptureIntakeClient({ initialPlan = "starter" }: { initialPlan?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const res = await fetch("/api/market-capture/intake", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "The Market Capture request could not be submitted.");
        setLoading(false);
        return;
      }

      const token = data.checkoutToken ? `token=${encodeURIComponent(data.checkoutToken)}` : "";
      window.location.href = `/market-capture/checkout${token ? `?${token}` : ""}`;
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/market-capture" className="flex items-center gap-2 text-sm font-black">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs">HR</span>
            HomeReach Market Capture
          </Link>
          <span className="hidden rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-100 sm:inline-flex">
            Sales Intake
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-6 lg:py-8">
        <aside className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.08] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Campaign request</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Start with the areas that can create growth.
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              This creates a sales-ready Market Capture opportunity. HomeReach will review your target area, budget,
              offer, and payment path before anything moves to fulfillment.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              { label: "Starter fee", value: `${formatUsd(MARKET_CAPTURE_MANAGEMENT_FEE_CENTS)}/month`, icon: CircleDollarSign },
              { label: "Recommended ad spend", value: `${formatUsd(MARKET_CAPTURE_RECOMMENDED_AD_SPEND_CENTS)}/month`, icon: Target },
              { label: "Approval", value: "No auto-launching paid ads", icon: ShieldCheck },
              { label: "Commitment", value: `${MARKET_CAPTURE_MIN_COMMITMENT_MONTHS}-month starter path`, icon: MapPinned },
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
                <Input name="businessName" label="Business Name" required placeholder="Peak Roofing Co." />
                <Input name="contactName" label="Contact Name" required placeholder="Jane Smith" />
                <Input name="email" label="Email" required type="email" placeholder="jane@peakroofing.com" />
                <Input name="phone" label="Phone" required type="tel" placeholder="(330) 555-0100" />
                <Input name="website" label="Website" type="url" placeholder="https://peakroofing.com" />
                <Input name="industry" label="Industry" required placeholder="Roofing, HVAC, med spa..." />
              </div>
            </FormSection>

            <FormSection eyebrow="Budget and objective" title="What should this create?" icon={CircleDollarSign}>
              <div className="grid gap-3 lg:grid-cols-3">
                {MARKET_CAPTURE_PRICING_TIERS.map((tier) => (
                  <label
                    key={tier.id}
                    className="flex h-full cursor-pointer flex-col rounded-lg border border-slate-200 bg-white p-4 text-sm transition hover:border-blue-300 hover:shadow-sm has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50"
                  >
                    <span className="flex items-start gap-2">
                      <input
                        name="requestedPlan"
                        type="radio"
                        value={tier.id}
                        defaultChecked={tier.id === initialPlan}
                        className="mt-1 h-4 w-4 border-slate-300 text-blue-700"
                      />
                      <span>
                        <span className="block font-black text-slate-950">{tier.name}</span>
                        <span className="mt-1 block text-lg font-black text-blue-700">
                          {formatUsd(tier.managementFeeCents)}/mo
                        </span>
                      </span>
                    </span>
                    <span className="mt-3 block text-xs leading-5 text-slate-600">{tier.bestFor}</span>
                    <span className="mt-3 block text-xs font-bold text-slate-500">
                      Recommended ad spend: {formatUsd(tier.recommendedAdSpendCents)}/mo
                    </span>
                  </label>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  name="monthlyAdBudget"
                  label="Monthly Ad Budget"
                  required
                  placeholder="1000"
                  helper={`Ad spend is separate. We recommend at least ${formatUsd(MARKET_CAPTURE_RECOMMENDED_AD_SPEND_CENTS)}/month for a cleaner test.`}
                />
                <Input name="preferredStartDate" label="Preferred Start Date" type="date" />
              </div>
              <CheckboxGrid name="objectives" options={objectives} />
            </FormSection>

            <FormSection eyebrow="Targeting" title="Where should HomeReach focus?" icon={Target}>
              <CheckboxGrid name="targetingTypes" options={targetingTypes} />
              <Textarea
                name="targetArea"
                label="Target Area"
                required
                rows={5}
                placeholder="Neighborhoods, ZIPs, job addresses, competitor areas, event locations, districts, or custom notes."
              />
              <div className="rounded-lg border border-violet-100 bg-violet-50 p-4">
                <div className="flex items-start gap-3">
                  <Target className="mt-1 h-5 w-5 shrink-0 text-violet-700" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-black text-slate-950">Competitor Area details</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Use this when the campaign should create local visibility near competitor locations where
                      platform rules allow. This is geography-based market capture, not individual tracking.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4">
                  <Textarea
                    name="competitorLocations"
                    label="Competitor Names / Addresses"
                    rows={5}
                    placeholder={"ABC Roofing | 123 Main St, Akron OH | roofing | primary | local visibility area\nXYZ Exterior Co. | 456 Market Ave, Canton OH | roofing | secondary | review after first area"}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      name="competitorRadiusPreference"
                      label="Preferred Radius"
                      placeholder="1 mile, 2 miles, or leave blank"
                      helper="Includes up to 10 competitor-area locations; additional validation can be quoted."
                    />
                    <Input
                      name="competitorCampaignGoal"
                      label="Campaign Goal"
                      placeholder="Build visibility near competitor-heavy service areas"
                    />
                  </div>
                  <Toggle
                    name="competitorComplianceAcknowledged"
                    label="I understand competitor campaigns use geography-based visibility, not surveillance or individual-level targeting"
                  />
                </div>
              </div>
              <div className="rounded-lg border border-orange-100 bg-orange-50 p-4">
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-1 h-5 w-5 shrink-0 text-orange-700" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-black text-slate-950">Event Area details</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Use this when timing matters: local events, open houses, fundraisers, rallies, grand openings,
                      or seasonal moments. HomeReach reviews the launch cutoff before accepting any short-run launch.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4">
                  <Textarea
                    name="eventLocations"
                    label="Event Names / Locations"
                    rows={5}
                    placeholder={"Summer Home Expo | 123 Event Center Dr, Akron OH | 2026-07-15 | 2 weeks before event | primary | source confirmed by client\nDowntown Food Night | Main St, Canton OH | 2026-08-01 | week of event | secondary | local awareness push"}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input name="eventStartDate" label="Event Start Date" type="date" />
                    <Input name="eventEndDate" label="Event End Date" type="date" />
                    <Input
                      name="eventRadiusPreference"
                      label="Preferred Radius"
                      placeholder="1 mile, 3 miles, city/ZIP fallback..."
                      helper="Rush review may apply when launch is under 7 business days."
                    />
                    <Input
                      name="eventPromotionWindow"
                      label="Promotion Window"
                      placeholder="Two weeks before, event weekend, post-event follow-up..."
                    />
                  </div>
                  <Textarea
                    name="eventCampaignGoal"
                    label="Event Campaign Goal"
                    rows={3}
                    placeholder="Example: build local awareness before the event and drive qualified visitors to the landing page."
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Toggle name="eventSourceConfirmed" label="Event details/source have been confirmed" />
                    <Toggle
                      name="eventComplianceAcknowledged"
                      label="I understand HomeReach does not guarantee event attendance, sales, leads, or platform approval"
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <MapPinned className="mt-1 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-black text-slate-950">Neighborhood Saturation details</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Use this when the campaign should focus on repeated visibility in specific neighborhoods, ZIPs,
                      or route clusters. Add one area per line. You can write: area name | geography | priority | notes.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4">
                  <Textarea
                    name="neighborhoodAreas"
                    label="Neighborhood / Area List"
                    rows={4}
                    placeholder={"Highland Square | Akron OH | primary | best customer density\nFirestone Park | Akron OH | secondary | seasonal push"}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      name="neighborhoodZipCodes"
                      label="ZIP Codes"
                      placeholder="44303, 44313, 44708"
                      helper="Optional. Separate ZIPs with commas or new lines."
                    />
                    <Input
                      name="neighborhoodDirectMailQuantity"
                      label="Estimated Mail Quantity"
                      placeholder="1000, 2500, or leave blank"
                      helper="Used only for planning. Direct mail is quoted separately after route counts are verified."
                    />
                  </div>
                  <Textarea
                    name="neighborhoodRouteClusters"
                    label="Route Clusters / Streets"
                    rows={3}
                    placeholder={"North Canton route cluster | Main St to Applegrove | primary | postcard add-on candidate"}
                  />
                  <Textarea
                    name="neighborhoodSaturationGoal"
                    label="Saturation Goal"
                    rows={3}
                    placeholder="Example: Build repeated visibility with homeowners in the highest-value neighborhoods before storm season."
                  />
                  <Textarea
                    name="neighborhoodNotes"
                    label="Neighborhood Planning Notes"
                    rows={3}
                    placeholder="Example: prioritize owner-occupied homes, avoid apartment-heavy routes, match postcards to the same areas if approved."
                  />
                </div>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <MapPinned className="mt-1 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-black text-slate-950">Jobsite Halo details</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Use this when the campaign should build visibility around recent jobs. Add one jobsite per line.
                      You can write just an address, or use: job name | address | notes.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4">
                  <Textarea
                    name="jobsiteAddresses"
                    label="Jobsite Address List"
                    rows={5}
                    placeholder={"Smith roof replacement | 123 Main St, Akron OH | completed May 2026\n456 Oak Ave, Canton OH"}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      name="jobsiteRadiusPreference"
                      label="Preferred Radius"
                      placeholder="1 mile, 1.5 miles, or leave blank"
                      helper="HomeReach will review this against the industry default before launch."
                    />
                    <FileInput name="jobsitePhotos" label="Jobsite Photos / Proof" multiple />
                  </div>
                  <Textarea
                    name="jobsiteProofNotes"
                    label="Jobsite Proof Notes"
                    rows={3}
                    placeholder="Example: customer approved exterior photos; avoid showing house number; recent install completed this month."
                  />
                </div>
              </div>
            </FormSection>

            <FormSection eyebrow="Offer and assets" title="What should the campaign use?" icon={FileImage}>
              <Textarea
                name="campaignOffer"
                label="Campaign Offer"
                rows={3}
                placeholder="Example: Free roof inspection for homeowners near our recent jobs."
              />
              <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-4">
                <div className="flex items-start gap-3">
                  <FileImage className="mt-1 h-5 w-5 shrink-0 text-cyan-700" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-black text-slate-950">Digital + Direct Mail bundle details</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Use this when postcards should support the same Market Capture campaign. Direct mail is quoted
                      separately after geography, quantity, proof, and vendor costs are verified.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      name="directMailPath"
                      label="Direct Mail Path"
                      placeholder="Targeted Direct Mail, Shared Postcard, Political Mail, or Needs Quote"
                    />
                    <Input
                      name="directMailQuantity"
                      label="Estimated Mail Quantity"
                      placeholder="500, 1000, 2500, 5000..."
                      helper="Planning only. Final quantity needs verified route counts."
                    />
                    <Input
                      name="directMailFormat"
                      label="Mail Format"
                      placeholder="6x9 postcard, 9x12 shared spot, political mailer..."
                    />
                    <Input
                      name="directMailDropWindow"
                      label="Desired Mail Window"
                      placeholder="Early July, before storm season, 2 weeks before event..."
                    />
                    <Input
                      name="directMailTrackingDestination"
                      label="QR / Tracking Destination"
                      placeholder="Landing page URL, campaign URL, or needs landing page"
                    />
                    <Input
                      name="directMailProofContact"
                      label="Proof Approval Contact"
                      placeholder="Name and email of approval contact"
                    />
                  </div>
                  <Toggle name="sameAreaForMail" label="Mail should match the digital target area" />
                  <Textarea
                    name="directMailBundleNotes"
                    label="Bundle Notes"
                    rows={3}
                    placeholder="Example: same offer on postcard and digital; QR should point to campaign landing page; avoid final quote until route counts are verified."
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FileInput name="logo" label="Upload Logo" />
                <FileInput name="images" label="Upload Images" multiple />
                <FileInput name="postcard" label="Upload Existing Postcard" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Toggle name="postcardAddon" label="Postcard Add-On" />
                <Toggle name="landingPageNeeded" label="Landing Page Needed" />
                <Toggle name="creativePackageNeeded" label="Creative Package Needed" />
              </div>
            </FormSection>

            <div className="grid gap-3">
              <Consent name="consent">
                I understand HomeReach management starts at {formatUsd(MARKET_CAPTURE_MANAGEMENT_FEE_CENTS)}/month, the selected plan may change the monthly management fee, and ad spend is separate and client-funded.
              </Consent>
              <Consent name="compliance">
                I understand results vary, ad platform approval is required, targeting depends on platform availability, and HomeReach does not guarantee leads, sales, ROI, visits, or conversions.
              </Consent>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-4 text-sm font-black text-white shadow-xl shadow-blue-950/20 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating opportunity..." : "Continue to Payment Review"}
              {!loading ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
            </button>

            <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              This is a sales intake and qualification flow. Fulfillment and paid ad launch remain approval-gated.
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
  icon: typeof MapPinned;
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

function Consent({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <label className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
      <input name={name} type="checkbox" value="true" required className="mt-1 h-4 w-4 shrink-0 rounded border-amber-300" />
      <span>{children}</span>
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
