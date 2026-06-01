"use client";

import { type FormEvent, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import type { LocalVisibilityScorecard } from "@/lib/local-visibility/scoring";

type ScanState =
  | { status: "idle"; scorecard?: null; error?: null }
  | { status: "loading"; scorecard?: null; error?: null }
  | { status: "success"; scorecard: LocalVisibilityScorecard; error?: null }
  | { status: "error"; scorecard?: null; error: string };

const initialState: ScanState = { status: "idle" };

export function VisibilityScanForm() {
  const [state, setState] = useState<ScanState>(initialState);
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("OH");
  const [category, setCategory] = useState("");
  const [googleBusinessProfileUrl, setGoogleBusinessProfileUrl] = useState("");

  const disabled = useMemo(
    () => state.status === "loading" || !businessName.trim() || !city.trim() || !stateCode.trim() || !category.trim(),
    [businessName, category, city, state.status, stateCode],
  );

  async function submitScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "loading" });

    const response = await fetch("/api/local-visibility/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName,
        website,
        phone,
        city,
        state: stateCode,
        category,
        googleBusinessProfileUrl,
      }),
    }).catch(() => null);

    if (!response) {
      setState({ status: "error", error: "The scan could not run. Please try again." });
      return;
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.scorecard) {
      setState({ status: "error", error: payload?.error ?? "The scan could not run. Please try again." });
      return;
    }

    setState({ status: "success", scorecard: payload.scorecard });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <form onSubmit={submitScan} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Free Local Visibility Scan</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">See what needs fixed first.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This scan starts with a simple estimate. Live Google, review, listing, and analytics connectors can make it
            more precise after setup.
          </p>
        </div>

        <div className="mt-5 grid gap-3">
          <Field label="Business name" value={businessName} onChange={setBusinessName} required />
          <Field label="Website" value={website} onChange={setWebsite} placeholder="https://example.com" />
          <Field label="Phone" value={phone} onChange={setPhone} placeholder="(330) 555-0100" />
          <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
            <Field label="City" value={city} onChange={setCity} required />
            <Field label="State" value={stateCode} onChange={setStateCode} required />
          </div>
          <Field label="Business category" value={category} onChange={setCategory} placeholder="Roofing, HVAC, med spa..." required />
          <Field
            label="Google Business Profile link"
            value={googleBusinessProfileUrl}
            onChange={setGoogleBusinessProfileUrl}
            placeholder="Optional"
          />
        </div>

        <button
          type="submit"
          disabled={disabled}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {state.status === "loading" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Building Scan
            </>
          ) : (
            <>
              Get My Visibility Score
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </button>

        {state.status === "error" && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {state.error}
          </p>
        )}
      </form>

      <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
        {state.status === "success" ? (
          <ScorecardView scorecard={state.scorecard} />
        ) : (
          <div className="flex h-full min-h-[28rem] flex-col justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-200">Scorecard Preview</p>
              <h3 className="mt-3 text-3xl font-black tracking-tight">Get found. Look trusted. Know what to fix next.</h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                The scan produces a plain-English visibility scorecard for Google profile health, review momentum,
                listing accuracy, and local SEO next steps.
              </p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {["Visibility Score", "Trust Score", "Review Momentum", "Top 5 Fixes"].map((item) => (
                <div key={item} className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  <p className="mt-3 text-sm font-black">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">
      {label}
      <input
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function ScorecardView({ scorecard }: { scorecard: LocalVisibilityScorecard }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">Estimated Scorecard</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Metric label="Visibility" value={scorecard.overallVisibilityScore} />
        <Metric label="Trust" value={scorecard.trustScore} />
        <Metric label="Listings" value={scorecard.listingsScore} />
        <Metric label="Review Momentum" value={scorecard.reviewMomentumScore} />
      </div>
      <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100">Estimated revenue opportunity</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-emerald-50">{scorecard.estimatedRevenueOpportunity}</p>
      </div>
      <div className="mt-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Top fixes</p>
        <div className="mt-3 grid gap-2">
          {scorecard.topFixes.map((fix) => (
            <div key={fix.title} className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
              <p className="text-sm font-black text-white">{fix.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">{fix.recommendedAction}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-emerald-300" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
