import Link from "next/link";
import type { Metadata } from "next";
import { submitPlanIntent } from "../actions";
import { CampaignStrategyPlanner } from "../_components/CampaignStrategyPlanner";
import { CandidateIntelligenceSearch } from "../_components/CandidateIntelligenceSearch";

// ─────────────────────────────────────────────────────────────────────────────
// /political/plan — Public planner / lead-capture form.
//
// Two columns on desktop:
//   1. Real form that creates a political_outreach_lead via server action
//   2. Live cost estimator (client component) for instant confidence
//
// On mobile they stack — calculator shown first so the user sees value
// immediately, then the form.
//
// Errors / validation feedback are passed back via querystring (the action
// redirect()s on validation failure and we re-hydrate via searchParams).
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Start Campaign Mail Plan — HomeReach Campaign Mail",
  description:
    "Tell us your district, your goal, and your timeline. We'll come back with a coverage and cost plan.",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function PlanPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const error = first(sp.error);
  const contactName = first(sp.contactName);
  const contactEmail = first(sp.contactEmail);
  const utmSource = first(sp.utm_source);
  const utmMedium = first(sp.utm_medium);
  const utmCampaign = first(sp.utm_campaign);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
          Step 1 of 3 — Tell us about your campaign
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          Start your campaign mail plan
        </h1>
        <p className="mt-3 max-w-2xl text-base text-gray-400">
          A few details so we can pull your district&apos;s household counts,
          confirm production capacity in your drop window, and send back a
          coverage + cost plan you can approve.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-8 rounded-lg border border-red-700/40 bg-red-900/20 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      <form
        action={submitPlanIntent}
        className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_390px]"
        noValidate
      >
        {/* ── LEFT: form ─────────────────────────────────────────────────── */}
        <div className="space-y-8">
          {/* Hidden UTM passthrough */}
          <input type="hidden" name="utm_source"   defaultValue={utmSource} />
          <input type="hidden" name="utm_medium"   defaultValue={utmMedium} />
          <input type="hidden" name="utm_campaign" defaultValue={utmCampaign} />

          {/* Section: Contact */}
          <fieldset className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/40 p-6">
            <legend className="text-sm font-bold uppercase tracking-wider text-gray-400">
              Who&apos;s asking
            </legend>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                placeholder="jane@yourcampaign.org"
              />
              <Field name="contactPhone" label="Phone (optional)" type="tel" />
              <Field name="organizationName" label="Campaign / committee" />
            </div>
          </fieldset>

          {/* Section: Candidate / race */}
          <fieldset className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/40 p-6">
            <legend className="text-sm font-bold uppercase tracking-wider text-gray-400">
              The race
            </legend>

            <CandidateIntelligenceSearch />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field name="candidateName" label="Candidate name" />
              <Field name="officeSought"  label="Office sought" placeholder="e.g. State House District 12" />

              <Select
                name="districtType"
                label="District type"
                options={[
                  { v: "",        l: "Select…"          },
                  { v: "local",   l: "Local"            },
                  { v: "state",   l: "State"            },
                  { v: "federal", l: "Federal"          },
                ]}
              />
              <Field
                name="electionDate"
                label="Election date"
                type="date"
              />
            </div>
          </fieldset>

          {/* Section: Geography */}
          <fieldset className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/40 p-6">
            <legend className="text-sm font-bold uppercase tracking-wider text-gray-400">
              Where to mail
            </legend>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field name="state" label="State (2-letter)" placeholder="OH" maxLength={2} />
              <Select
                name="geographyType"
                label="Geography level"
                options={[
                  { v: "",         l: "Select…"  },
                  { v: "city",     l: "City"     },
                  { v: "county",   l: "County"   },
                  { v: "district", l: "District" },
                  { v: "state",    l: "Statewide" },
                ]}
              />
              <Field
                name="geographyValue"
                label="Name / number"
                placeholder="e.g. Franklin County, OH-3, Worthington"
              />
            </div>
          </fieldset>

          {/* Section: Plan intent */}
          <fieldset className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/40 p-6">
            <legend className="text-sm font-bold uppercase tracking-wider text-gray-400">
              Your plan
            </legend>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                name="budgetEstimate"
                label="Budget (USD)"
                type="number"
                placeholder="15000"
              />
              <Field
                name="desiredDropCount"
                label="Drops you'd like (1-5)"
                type="number"
                min={1}
                max={5}
              />
            </div>

            <label className="block">
              <span className="text-xs font-medium text-gray-400">
                Anything else we should know
              </span>
              <textarea
                name="notes"
                rows={4}
                placeholder="Top messaging priorities, key drop windows, anything else you want our team to consider."
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </label>

            <label className="flex items-start gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                name="consentMarketing"
                className="mt-1 rounded border-gray-700 bg-gray-950 text-blue-500"
              />
              <span>
                I&apos;m okay receiving follow-up emails about my plan and
                future drop windows.
              </span>
            </label>
          </fieldset>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              By submitting you agree to our{" "}
              <Link href="/privacy" className="text-blue-400 hover:underline">
                privacy policy
              </Link>
              . No voter-data collection. We&apos;ll never share your campaign data.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                name="plannerIntent"
                value="request_review"
                className="rounded-xl border border-gray-700 bg-gray-950 px-6 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:border-gray-500"
              >
                Send plan request
              </button>
              <button
                type="submit"
                name="plannerIntent"
                value="generate_proposal"
                className="rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-blue-500"
              >
                Generate proposal
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: live calculator ─────────────────────────────────────── */}
        <div className="lg:order-last">
          <CampaignStrategyPlanner />
        </div>
      </form>
    </div>
  );
}

// ── small primitive components, kept local to this page ────────────────────

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
      <span className="text-xs font-medium text-gray-400">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
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
        className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
      />
    </label>
  );
}

interface SelectProps {
  name: string;
  label: string;
  options: ReadonlyArray<{ v: string; l: string }>;
}

function Select({ name, label, options }: SelectProps) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-400">{label}</span>
      <select
        name={name}
        defaultValue=""
        className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
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
