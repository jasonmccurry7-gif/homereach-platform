import Link from "next/link";
import type { Metadata } from "next";
import { submitPlanIntent } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get a Reviewed Political Postcard Plan - PoliticalReach",
  description:
    "Request a human-reviewed political postcard plan with geography, timing, estimated cost, creative direction, and production readiness.",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function inferredState(value: string): string {
  return value.toLowerCase().includes("ohio") ? "OH" : "";
}

function inferredGeographyType(value: string): "state" | "" {
  return value.toLowerCase().includes("statewide") ? "state" : "";
}

function inferredDistrictType(value: string): "state" | "" {
  return value.toLowerCase().includes("statewide") ? "state" : "";
}

export default async function PlanPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const error = first(sp.error);
  const contactName = first(sp.contactName);
  const contactEmail = first(sp.contactEmail);
  const utmSource = first(sp.utm_source);
  const utmMedium = first(sp.utm_medium);
  const utmCampaign = first(sp.utm_campaign);
  const selectedCandidate = first(sp.candidateName) || first(sp.candidate);
  const selectedCandidateId = first(sp.candidateId);
  const selectedStrategy = first(sp.strategy);
  const selectedOption = first(sp.option);
  const selectedGeography = first(sp.geography);
  const selectedReadiness = first(sp.readiness);
  const stateDefault = first(sp.state) || inferredState(selectedGeography);
  const geographyTypeDefault =
    first(sp.geographyType) || inferredGeographyType(selectedGeography);
  const geographyValueDefault =
    first(sp.geographyValue) || selectedGeography.replace(/\s*\/.*$/, "");
  const districtTypeDefault =
    first(sp.districtType) || inferredDistrictType(selectedGeography);
  const budgetEstimate = first(sp.budgetEstimate);
  const desiredDropCount = first(sp.desiredDropCount) || first(sp.drops);
  const selectedPlanLabel = [
    selectedCandidate || "Candidate review",
    selectedOption ? `Option ${selectedOption}` : null,
    selectedGeography || null,
  ]
    .filter(Boolean)
    .join(" / ");
  const dashboardNote =
    selectedCandidate || selectedStrategy || selectedOption || selectedGeography
      ? [
          "Dashboard selection:",
          selectedCandidate ? `Candidate: ${selectedCandidate}` : null,
          selectedCandidateId ? `Candidate ID: ${selectedCandidateId}` : null,
          selectedOption ? `Option: ${selectedOption}` : null,
          selectedStrategy ? `Strategy: ${selectedStrategy}` : null,
          selectedGeography ? `Geography: ${selectedGeography}` : null,
          selectedReadiness ? `Readiness: ${selectedReadiness}` : null,
          "Please verify geography, route counts, pricing, disclaimer, and approval status before proposal or production.",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  return (
    <div className="mx-auto w-full max-w-[100vw] overflow-x-hidden px-4 py-8 sm:px-6 lg:py-12 xl:max-w-5xl">
      <header className="mb-8 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-300">
            Campaign consultation
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
            Get a reviewed postcard plan before the campaign spends.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Send the basics. HomeReach will turn candidate, geography, budget,
            timing, and mail objective into a clearer execution path before any
            proposal, payment, or production step.
          </p>
        </div>
        <Link
          href="/political/candidate-agent"
          className="inline-flex justify-center rounded-xl border border-blue-300/25 bg-blue-500/10 px-5 py-3 text-sm font-black text-blue-50 transition hover:border-blue-200/50 hover:bg-blue-500/20"
        >
          Open AI Campaign Agent
        </Link>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-700/40 bg-red-900/20 p-4 text-sm font-semibold text-red-100"
        >
          {error}
        </div>
      )}

      <form action={submitPlanIntent} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" noValidate>
        <input type="hidden" name="utm_source" defaultValue={utmSource} />
        <input type="hidden" name="utm_medium" defaultValue={utmMedium} />
        <input type="hidden" name="utm_campaign" defaultValue={utmCampaign} />
        <input type="hidden" name="dashboardCandidateId" defaultValue={selectedCandidateId} />
        <input type="hidden" name="dashboardStrategy" defaultValue={selectedStrategy} />
        <input type="hidden" name="dashboardOption" defaultValue={selectedOption} />

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30 sm:p-6">
          <div className="mb-6 rounded-2xl border border-blue-300/20 bg-blue-950/30 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              Selected plan
            </p>
            <p className="mt-2 text-lg font-black text-white">
              {selectedPlanLabel || "Campaign mail consultation"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              We review coverage, estimated cost, delivery timing, creative
              direction, and missing production inputs so the campaign can make
              a confident next decision.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-slate-200">
                Human review first
              </span>
              <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-100">
                {selectedReadiness || "Counts verified before production"}
              </span>
              <span className="rounded-full border border-blue-300/25 bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-100">
                No guesswork quote
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="contactName"
              label="Your name"
              required
              defaultValue={contactName}
              placeholder="Jane Doe"
            />
            <Field
              name="contactEmail"
              label="Email"
              type="email"
              required
              defaultValue={contactEmail}
              placeholder="jane@campaign.org"
            />
            <Field name="contactPhone" label="Phone optional" type="tel" />
            <Field name="organizationName" label="Campaign or committee" />
            <Field
              name="candidateName"
              label="Candidate"
              defaultValue={selectedCandidate}
              placeholder="Candidate name"
            />
            <Field
              name="geographyValue"
              label="Geography"
              defaultValue={geographyValueDefault}
              placeholder="Ohio statewide, county, city, or district"
            />
          </div>

          <label className="mt-5 block">
            <span className="text-xs font-bold text-slate-300">
              Anything important for the review?
            </span>
            <textarea
              name="notes"
              rows={3}
              placeholder="Timing, budget comfort, district details, or what you want the mail to accomplish."
              defaultValue={dashboardNote}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm leading-6 text-white placeholder:text-slate-500 outline-none transition focus:border-blue-300/60"
            />
          </label>

          <details className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <summary className="cursor-pointer text-sm font-black text-slate-100">
              Optional campaign details
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field name="officeSought" label="Office sought" placeholder="Governor, mayor, council, district..." />
              <Field name="state" label="State" placeholder="OH" maxLength={2} defaultValue={stateDefault} />
              <Select
                name="geographyType"
                label="Geography level"
                defaultValue={geographyTypeDefault}
                options={[
                  { v: "", l: "Not sure" },
                  { v: "state", l: "Statewide" },
                  { v: "county", l: "County" },
                  { v: "city", l: "City" },
                  { v: "district", l: "District" },
                ]}
              />
              <Select
                name="districtType"
                label="Race type"
                defaultValue={districtTypeDefault}
                options={[
                  { v: "", l: "Not sure" },
                  { v: "local", l: "Local" },
                  { v: "state", l: "State" },
                  { v: "federal", l: "Federal" },
                ]}
              />
              <Field name="electionDate" label="Election date" type="date" />
              <Field
                name="budgetEstimate"
                label="Budget target optional"
                type="number"
                placeholder="15000"
                defaultValue={budgetEstimate}
              />
              <Field
                name="desiredDropCount"
                label="Mail drops optional"
                type="number"
                min={1}
                max={5}
                defaultValue={desiredDropCount}
              />
            </div>
          </details>

          <details className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-950/15 p-4" open>
            <summary className="cursor-pointer text-sm font-black text-emerald-50">
              Political District Saturation details
            </summary>
            <div className="mt-4 grid gap-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-300">
                  District, county, city, ZIP, or route geography
                </span>
                <textarea
                  name="targetGeographies"
                  rows={4}
                  defaultValue={
                    geographyValueDefault
                      ? `${geographyValueDefault} | ${geographyTypeDefault || "district"} | source pending | primary | verify boundaries and counts before quote`
                      : ""
                  }
                  placeholder="District 7 | district | county board of elections | primary | verify boundaries before quote"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm leading-6 text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-300/60"
                />
                <span className="mt-2 block text-xs leading-5 text-slate-500">
                  Format one per line: Name | Type | Source | Priority | Notes.
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  name="districtSource"
                  label="Geography source"
                  placeholder="County BOE, state map, campaign-provided list..."
                />
                <Field
                  name="dropWindow"
                  label="Preferred drop window"
                  placeholder="Two weeks before early voting"
                />
                <Field
                  name="mailQuantityEstimate"
                  label="Mail quantity estimate optional"
                  type="number"
                  placeholder="10000"
                />
                <Select
                  name="campaignAudienceSource"
                  label="Audience basis"
                  defaultValue="geography_only"
                  options={[
                    { v: "geography_only", l: "Geography only" },
                    { v: "campaign_provided", l: "Campaign-provided audience" },
                    { v: "public_geography", l: "Public geography source" },
                    { v: "not_sure", l: "Not sure" },
                  ]}
                />
                <Select
                  name="campaignDisclaimerStatus"
                  label="Disclaimer status"
                  defaultValue="needs_review"
                  options={[
                    { v: "needs_review", l: "Needs review" },
                    { v: "available", l: "Available" },
                    { v: "not_sure", l: "Not sure" },
                  ]}
                />
              </div>

              <div className="grid gap-3">
                <Checkbox
                  name="districtSourceConfirmed"
                  label="The campaign understands district boundaries, route counts, and household counts must be verified before quote, checkout, or production."
                />
                <Checkbox
                  name="politicalComplianceAcknowledged"
                  label="The campaign understands HomeReach uses geography, timing, budget, logistics, and campaign-provided data only."
                />
                <Checkbox
                  name="noSensitiveTargetingAcknowledged"
                  label="The campaign understands HomeReach will not infer voter beliefs, score individual voters, or build ideology-based targeting."
                />
              </div>
            </div>
          </details>

          <label className="mt-5 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
            <input
              type="checkbox"
              name="consentMarketing"
              className="mt-1 rounded border-slate-700 bg-slate-950 text-blue-500"
            />
            <span>
              I am okay receiving follow-up emails about this campaign review
              and future drop windows.
            </span>
          </label>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">
              No payment here. No voter-level inference. No production handoff
              until HomeReach verifies the plan.{" "}
              <Link href="/privacy" className="text-blue-300 hover:underline">
                Privacy policy
              </Link>
            </p>
            <button
              type="submit"
              name="plannerIntent"
              value="request_review"
              className="inline-flex w-full justify-center rounded-xl bg-red-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:-translate-y-0.5 hover:bg-red-500 sm:w-auto"
            >
              Request campaign review
            </button>
          </div>
        </section>

        <aside className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 text-slate-100 lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
            What happens next
          </p>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <li>
              <strong className="text-white">1. We review the candidate and geography.</strong>
              <br />
              Your selected option stays attached to the request so the plan is not rebuilt from zero.
            </li>
            <li>
              <strong className="text-white">2. We tighten counts, cost, and timing.</strong>
              <br />
              USPS/vendor route data, print window, drop count, and deadline risk must be checked before production.
            </li>
            <li>
              <strong className="text-white">3. You get a clear next step.</strong>
              <br />
              Consultation, proposal review, approval link, or campaign setup.
            </li>
          </ol>
          <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-400/10 p-4 text-xs leading-5 text-amber-50">
            Political planning remains approval-gated. HomeReach supports
            aggregate geography, logistics, budget, schedule, and creative
            planning only.
          </div>
        </aside>
      </form>
    </div>
  );
}

function Checkbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
      <input
        type="checkbox"
        name={name}
        className="mt-1 rounded border-slate-700 bg-slate-950 text-emerald-500"
      />
      <span>{label}</span>
    </label>
  );
}

interface FieldProps {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  maxLength?: number;
  min?: number;
  max?: number;
}

function Field({
  name,
  label,
  type = "text",
  required,
  placeholder,
  defaultValue,
  maxLength,
  min,
  max,
}: FieldProps) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-300">
        {label}
        {required && <span className="ml-0.5 text-red-300">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        maxLength={maxLength}
        min={min}
        max={max}
        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-300/60"
      />
    </label>
  );
}

interface SelectProps {
  name: string;
  label: string;
  options: ReadonlyArray<{ v: string; l: string }>;
  defaultValue?: string;
}

function Select({ name, label, options, defaultValue = "" }: SelectProps) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-300">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-300/60"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}
