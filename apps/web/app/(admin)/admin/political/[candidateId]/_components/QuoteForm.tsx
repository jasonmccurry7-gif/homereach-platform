"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createProposalAction,
  generateQuoteAction,
  type CreateProposalArgs,
  type CreateProposalResultData,
} from "../actions";
import type { PoliticalQuoteResult } from "@/lib/political/quote";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Quote Form — preview + create proposal
// - Minimal form. Mobile-first.
// - "Preview" runs generateQuoteAction (no DB write)
// - "Create & get link" runs createProposalAction (persists, returns public URL)
// - The preview surface intentionally labels internal cost / margin / profit
//   clearly so operators know what is / isn't on the client-facing page.
// ─────────────────────────────────────────────────────────────────────────────

interface CampaignOption {
  id: string;
  label: string;
}

interface QuoteFormProps {
  candidateId: string;
  campaigns: CampaignOption[];
  /** When the candidate has no campaigns yet. */
  needsCampaign?: boolean;
}

export function QuoteForm({ candidateId, campaigns, needsCampaign }: QuoteFormProps) {
  // Form state
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [useOverride, setUseOverride] = useState(false);
  const [householdOverride, setHouseholdOverride] = useState("");
  const [drops, setDrops] = useState(1);
  const [daysUntilElection, setDaysUntilElection] = useState<string>("");

  const [setup, setSetup] = useState(false);
  const [design, setDesign] = useState(false);
  const [rush, setRush] = useState(false);
  const [targeting, setTargeting] = useState(false);
  const [yardSignQty, setYardSignQty] = useState("");
  const [doorHangerQty, setDoorHangerQty] = useState("");

  const [preview, setPreview] = useState<PoliticalQuoteResult | null>(null);
  const [result, setResult] = useState<CreateProposalResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const addOns = useMemo(
    () => ({
      setup,
      design,
      rush,
      targeting,
      yardSigns:
        yardSignQty && Number(yardSignQty) > 0
          ? { quantity: Number(yardSignQty) }
          : null,
      doorHangers:
        doorHangerQty && Number(doorHangerQty) > 0
          ? { quantity: Number(doorHangerQty) }
          : null,
    }),
    [setup, design, rush, targeting, yardSignQty, doorHangerQty],
  );

  if (needsCampaign) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">No political campaign on file for this candidate yet.</p>
        <p className="mt-1 text-xs text-amber-800">
          Create a <code className="rounded bg-amber-100 px-1">political_campaigns</code> row
          for this candidate in the SQL editor, then refresh. A future admin
          UI will surface campaign creation here.
        </p>
      </div>
    );
  }

  function runPreview() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await generateQuoteAction({
        candidateId,
        drops,
        daysUntilElection: daysUntilElection ? Number(daysUntilElection) : null,
        householdCountOverride: useOverride && householdOverride ? Number(householdOverride) : null,
        addOns,
      });
      if ("error" in res) {
        setError(res.error);
        setPreview(null);
      } else {
        setPreview(res.data);
      }
    });
  }

  function runCreate() {
    if (!campaignId) {
      setError("Select a campaign first.");
      return;
    }
    setError(null);
    setResult(null);
    const args: CreateProposalArgs = {
      candidateId,
      campaignId,
      drops,
      daysUntilElection: daysUntilElection ? Number(daysUntilElection) : null,
      householdCountOverride: useOverride && householdOverride ? Number(householdOverride) : null,
      addOns,
    };
    startTransition(async () => {
      const res = await createProposalAction(args);
      if ("error" in res) {
        setError(res.error);
      } else {
        setResult(res.data);
      }
    });
  }

  async function copyUrl() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.publicUrl);
    } catch {
      // no-op — clipboard permissions vary
    }
  }

  return (
    <div className="space-y-4">
      {/* Form */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Generate quote</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Uses the candidate&apos;s state, geography, and district type.
          Internal cost / margin / profit stay internal.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Campaign</span>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.currentTarget.value)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Drops</span>
            <input
              type="number"
              min={1}
              max={12}
              value={drops}
              onChange={(e) => setDrops(Math.max(1, Math.min(12, Number(e.currentTarget.value) || 1)))}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Days until election (optional)</span>
            <input
              type="number"
              value={daysUntilElection}
              onChange={(e) => setDaysUntilElection(e.currentTarget.value)}
              placeholder="e.g. 120"
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={useOverride}
                onChange={(e) => setUseOverride(e.currentTarget.checked)}
              />
              Override household count
            </span>
            <input
              type="number"
              disabled={!useOverride}
              value={householdOverride}
              onChange={(e) => setHouseholdOverride(e.currentTarget.value)}
              placeholder="e.g. 45000"
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
            />
          </label>
        </div>

        <div className="mt-3">
          <span className="mb-1 block text-xs font-medium text-slate-600">Add-ons</span>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={setup} onChange={(e) => setSetup(e.currentTarget.checked)} />
              Setup
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={design} onChange={(e) => setDesign(e.currentTarget.checked)} />
              Design
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={rush} onChange={(e) => setRush(e.currentTarget.checked)} />
              Rush
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={targeting} onChange={(e) => setTargeting(e.currentTarget.checked)} />
              Targeting
            </label>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-500">Yard signs qty (optional)</span>
              <input
                type="number"
                min={0}
                value={yardSignQty}
                onChange={(e) => setYardSignQty(e.currentTarget.value)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-500">Door hangers qty (optional)</span>
              <input
                type="number"
                min={0}
                value={doorHangerQty}
                onChange={(e) => setDoorHangerQty(e.currentTarget.value)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runPreview}
            disabled={pending}
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            {pending ? "…" : "Preview quote"}
          </button>
          <button
            type="button"
            onClick={runCreate}
            disabled={pending}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create proposal & get link"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>
      )}

      {/* Preview */}
      {preview && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Quote preview</h3>

          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
            <Stat label="Households" value={preview.estimatedHouseholds.toLocaleString()} />
            <Stat label="Drops" value={preview.input.drops.toLocaleString()} />
            <Stat label="Total pieces" value={preview.totalPieces.toLocaleString()} />
            <Stat label="Volume band" value={preview.volumeBand} />
            <Stat label="Price / piece" value={formatCents(preview.pricePerPieceCents)} />
            <Stat label="Cost / piece" value={formatCents(preview.costPerPieceCents)} subtle />
            <Stat label="Margin / piece" value={formatCents(preview.marginPerPieceCents)} subtle />
            <Stat label="Subtotal" value={formatCents(preview.subtotalCents)} />
          </dl>

          {preview.addOnsCents > 0 && (
            <div className="mt-3 text-sm text-slate-700">
              <span className="text-slate-500">Add-ons:</span>{" "}
              <span className="font-medium">{formatCents(preview.addOnsCents)}</span>
              {preview.rushSurchargeCents > 0 && (
                <span className="ml-2 text-xs text-amber-700">
                  (rush {formatCents(preview.rushSurchargeCents)})
                </span>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3 border-t border-slate-200 pt-3">
            <div>
              <div className="text-xs text-slate-500">Client-facing total</div>
              <div className="text-2xl font-semibold tracking-tight text-slate-900">
                {formatCents(preview.totalCents)}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{preview.clientSummary.deliveryWindowText}</div>
            </div>
            <div className="text-right text-xs">
              <div className="text-slate-500">
                Internal profit margin: <span className="font-medium text-slate-800">{preview.internal.profitMarginPct}%</span>
              </div>
              <div className="text-slate-500">
                Internal margin: <span className="font-medium text-slate-800">{formatCents(preview.internal.totalMarginCents)}</span>
              </div>
              <div className="text-slate-500">
                Internal cost: <span className="font-medium text-slate-800">{formatCents(preview.internal.totalCostCents)}</span>
              </div>
            </div>
          </div>

          {preview.recommendations.warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-800">
              {preview.recommendations.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-400">
            Internal pricing never appears on the client-facing proposal page.
          </p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <p className="font-medium text-emerald-900">Proposal created. Send this link to the client:</p>
          <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
            <input
              readOnly
              value={result.publicUrl}
              className="flex-1 rounded-md border border-emerald-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyUrl}
                className="inline-flex items-center rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
              >
                Copy link
              </button>
              <a
                href={result.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
              >
                Preview
              </a>
            </div>
          </div>
          <p className="mt-2 text-xs text-emerald-800">
            Total: <span className="font-medium">{formatCents(result.totalInvestmentCents)}</span>
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  subtle,
}: {
  label: string;
  value: string;
  subtle?: boolean;
}) {
  return (
    <div>
      <dt className={`text-xs ${subtle ? "text-slate-400" : "text-slate-500"}`}>{label}</dt>
      <dd className={`text-sm ${subtle ? "text-slate-600" : "font-medium text-slate-900"}`}>{value}</dd>
    </div>
  );
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
