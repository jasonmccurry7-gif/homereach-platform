"use client";

import { useMemo, useState } from "react";
import { ArrowRight, FileText, Loader2, ShieldCheck, Upload } from "lucide-react";

type BillingPlanView = {
  key: "watchtower" | "workspace" | "proposal_assist" | "managed_bid";
  label: string;
  publicLabel: string;
  description: string;
  mode: "payment" | "subscription";
  configured: boolean;
  priceEnvKey: string;
  standardPriceLabel: string;
  founderPriceLabel: string;
  cadenceLabel: string;
  checkoutAmountLabel: string;
  includedAiSummaries: string;
  aiSummaryOverageLabel: string;
};

type DocumentAnalysis = {
  parserStatus: string;
  analysisMode: string;
  summary: string;
  whatGovernmentIsBuying: string;
  submissionMethod: string;
  deadlines: string[];
  requiredDocuments: string[];
  complianceItems: string[];
  pricingWarnings: string[];
  riskFlags: string[];
  nextActions: string[];
  warnings: string[];
};

export function ContractOSDocumentAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const form = new FormData();
      if (file) form.set("file", file);
      if (text.trim()) form.set("text", text.trim());

      const response = await fetch("/api/contractos/documents/analyze", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; analysis?: DocumentAnalysis };

      if (!response.ok || !payload.ok || !payload.analysis) {
        throw new Error(payload.error || "Document analysis failed.");
      }

      setAnalysis(payload.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Upload className="h-6 w-6 text-blue-700" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-black text-slate-950">Document review lane</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Upload an RFQ, RFP, SOW, amendment, or paste solicitation text. ContractOS extracts a draft summary,
            deadlines, documents, compliance items, and pricing risks for human review.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase text-amber-800 ring-1 ring-amber-200">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Draft only
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Upload document</span>
            <input
              type="file"
              accept=".pdf,.txt,.md,.csv,.rtf,application/pdf,text/plain,text/markdown,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-2 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-xs file:font-black file:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Or paste text</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={5}
              placeholder="Paste solicitation, RFQ, amendment, or statement of work text..."
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={loading || (!file && !text.trim())}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
            Analyze for bid readiness
          </button>
          {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          {analysis ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                  {analysis.analysisMode} summary / {analysis.parserStatus}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{analysis.summary}</p>
              </div>
              <ResultBlock title="What they are buying" items={[analysis.whatGovernmentIsBuying]} />
              <ResultBlock title="Deadlines" items={analysis.deadlines} empty="No dates extracted." />
              <ResultBlock title="Required docs" items={analysis.requiredDocuments} empty="Needs manual extraction." />
              <ResultBlock title="Pricing warnings" items={analysis.pricingWarnings} empty="No pricing warning extracted yet." />
              <ResultBlock title="Next actions" items={analysis.nextActions} />
              {analysis.warnings.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-800">Warnings</p>
                  <ul className="mt-2 space-y-1 text-xs font-semibold leading-5 text-amber-900">
                    {analysis.warnings.map((warning) => (
                      <li key={warning}>- {warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full min-h-80 flex-col justify-center rounded-lg border border-dashed border-slate-300 p-5 text-center">
              <p className="text-lg font-black text-slate-950">Draft analysis appears here.</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Nothing here submits, certifies, or approves a bid. It only prepares a review checklist.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function ContractOSBillingActions({ plans }: { plans: BillingPlanView[] }) {
  const [email, setEmail] = useState("");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const requestId = useMemo(() => crypto.randomUUID(), []);

  async function startCheckout(plan: BillingPlanView) {
    setLoadingPlan(plan.key);
    setMessage(null);

    try {
      const response = await fetch("/api/contractos/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: plan.key,
          email: email.trim() || undefined,
          requestId,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; url?: string; error?: string; missingEnv?: string[] };

      if (!response.ok || !payload.ok || !payload.url) {
        const setup = payload.missingEnv?.length ? ` Missing: ${payload.missingEnv.join(", ")}.` : "";
        throw new Error(`${payload.error || "Checkout is not ready yet."}${setup}`);
      }

      window.location.href = payload.url;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout is not ready yet.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Paid workspace gate</p>
      <h2 className="mt-2 text-xl font-black text-slate-950">Stripe-ready, pricing-controlled access.</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        These buttons only create paid access sessions after Stripe product price IDs are configured. They never submit bids
        or approve pricing.
      </p>
      <label className="mt-4 block">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Email for checkout receipt</span>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          placeholder="owner@business.com"
          className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      <div className="mt-4 space-y-2">
        {plans.map((plan) => (
          <button
            key={plan.key}
            type="button"
            onClick={() => startCheckout(plan)}
            disabled={Boolean(loadingPlan)}
            className="flex min-h-20 w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-black text-slate-950 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
          >
            <span className="min-w-0">
              <span className="block">{plan.publicLabel}</span>
              <span className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-black text-slate-400 line-through">{plan.standardPriceLabel}</span>
                <span className="text-sm font-black text-blue-700">{plan.founderPriceLabel}</span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-800 ring-1 ring-blue-100">
                  Founder rate
                </span>
              </span>
              <span className="mt-1 block text-xs font-semibold text-slate-500">{plan.includedAiSummaries}</span>
              <span className="block text-xs font-semibold text-slate-500">
                {plan.configured ? `${plan.mode} checkout configured` : `Needs ${plan.priceEnvKey}`}
              </span>
            </span>
            {loadingPlan === plan.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          </button>
        ))}
      </div>
      {message ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-900">{message}</p> : null}
    </section>
  );
}

function ResultBlock({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  const values = items.filter(Boolean);
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="mt-2 space-y-1 text-sm font-semibold leading-6 text-slate-700">
        {values.length ? values.map((item) => <li key={item}>- {item}</li>) : <li>{empty ?? "No items extracted."}</li>}
      </ul>
    </div>
  );
}
