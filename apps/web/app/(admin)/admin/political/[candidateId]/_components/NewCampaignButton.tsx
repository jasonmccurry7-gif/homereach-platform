"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createPoliticalCampaignAction,
  type DistrictTypeValue,
  type GeographyTypeValue,
  type CampaignPipelineStatus,
} from "../actions";

// ─────────────────────────────────────────────────────────────────────────────
// NewCampaignButton — opens an inline modal for creating a political_campaigns
// row for the current candidate. Defaults inherit from the candidate.
// ─────────────────────────────────────────────────────────────────────────────

export interface CandidateDefaults {
  id: string;
  officeSought: string | null;
  districtType: DistrictTypeValue | null;
  geographyType: GeographyTypeValue | null;
  geographyValue: string | null;
  electionDate: string | null;  // ISO or YYYY-MM-DD
  candidateName: string;
}

interface Props {
  candidate: CandidateDefaults;
}

const DISTRICT_OPTIONS: Array<{ value: "" | DistrictTypeValue; label: string }> = [
  { value: "", label: "— inherit from candidate —" },
  { value: "federal", label: "Federal" },
  { value: "state",   label: "State" },
  { value: "local",   label: "Local" },
];

const GEO_OPTIONS: Array<{ value: "" | GeographyTypeValue; label: string }> = [
  { value: "",         label: "— inherit from candidate —" },
  { value: "state",    label: "State" },
  { value: "county",   label: "County" },
  { value: "city",     label: "City" },
  { value: "district", label: "District" },
];

const STATUS_OPTIONS: Array<{ value: CampaignPipelineStatus; label: string }> = [
  { value: "prospect",      label: "Prospect" },
  { value: "contacted",     label: "Contacted" },
  { value: "proposal_sent", label: "Proposal sent" },
  { value: "won",           label: "Won" },
  { value: "lost",          label: "Lost" },
];

export function NewCampaignButton({ candidate }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
      >
        + New campaign
      </button>
    );
  }

  return (
    <NewCampaignModal
      candidate={candidate}
      onClose={() => setOpen(false)}
      onCreated={(campaignId) => {
        setOpen(false);
        router.refresh();
        // Land on the Quote tab — next natural action after creating.
        router.push(`/admin/political/${candidate.id}?tab=quote&campaign=${campaignId}`);
      }}
    />
  );
}

function NewCampaignModal({
  candidate,
  onClose,
  onCreated,
}: {
  candidate: CandidateDefaults;
  onClose: () => void;
  onCreated: (campaignId: string) => void;
}) {
  // Defaults derived from the candidate row
  const defaultElectionDate = toDateInputValue(candidate.electionDate);
  const defaultOffice = candidate.officeSought ?? "";
  const defaultCampaignName = `${candidate.candidateName} — ${defaultOffice || "Campaign"}`.trim();

  const [campaignName, setCampaignName] = useState<string>(defaultCampaignName);
  const [office, setOffice] = useState<string>(defaultOffice);
  const [districtType, setDistrictType] = useState<"" | DistrictTypeValue>("");
  const [geographyType, setGeographyType] = useState<"" | GeographyTypeValue>("");
  const [geographyValue, setGeographyValue] = useState<string>("");
  const [electionDate, setElectionDate] = useState<string>(defaultElectionDate);
  const [pipelineStatus, setPipelineStatus] = useState<CampaignPipelineStatus>("prospect");
  const [budgetDollars, setBudgetDollars] = useState<string>("");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const budgetCents = budgetDollars.trim()
      ? Math.round(Number(budgetDollars) * 100)
      : null;
    if (budgetDollars.trim() && (budgetCents === null || Number.isNaN(budgetCents) || budgetCents < 0)) {
      setError("Budget must be a non-negative dollar amount.");
      return;
    }

    startTransition(async () => {
      const res = await createPoliticalCampaignAction({
        candidateId: candidate.id,
        campaignName,
        office: office.trim() || null,
        districtType: districtType || null,
        geographyType: geographyType || null,
        geographyValue: geographyValue.trim() || null,
        pipelineStatus,
        budgetEstimateCents: budgetCents,
        electionDate: electionDate || null,
      });
      if ("error" in res) {
        setError(res.error);
      } else {
        onCreated(res.data.campaignId);
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create campaign"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New campaign</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        </header>

        <p className="text-xs text-slate-500">
          Creates a <code className="rounded bg-slate-100 px-1">political_campaigns</code> row
          linked to {candidate.candidateName}. Defaults are inherited from the candidate — edit as needed.
        </p>

        <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Campaign name</span>
            <input
              type="text"
              required
              minLength={2}
              maxLength={200}
              value={campaignName}
              onChange={(e) => setCampaignName(e.currentTarget.value)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Office</span>
              <input
                type="text"
                value={office}
                onChange={(e) => setOffice(e.currentTarget.value)}
                placeholder={candidate.officeSought ?? ""}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Election date</span>
              <input
                type="date"
                value={electionDate}
                onChange={(e) => setElectionDate(e.currentTarget.value)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">District type</span>
              <select
                value={districtType}
                onChange={(e) => setDistrictType(e.currentTarget.value as "" | DistrictTypeValue)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              >
                {DISTRICT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {candidate.districtType && !districtType && (
                <span className="mt-0.5 block text-[10px] text-slate-400">
                  Will use candidate&apos;s: {candidate.districtType}
                </span>
              )}
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Pipeline status</span>
              <select
                value={pipelineStatus}
                onChange={(e) => setPipelineStatus(e.currentTarget.value as CampaignPipelineStatus)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Geography type</span>
              <select
                value={geographyType}
                onChange={(e) => setGeographyType(e.currentTarget.value as "" | GeographyTypeValue)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              >
                {GEO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {candidate.geographyType && !geographyType && (
                <span className="mt-0.5 block text-[10px] text-slate-400">
                  Will use candidate&apos;s: {candidate.geographyType}
                </span>
              )}
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Geography value</span>
              <input
                type="text"
                value={geographyValue}
                onChange={(e) => setGeographyValue(e.currentTarget.value)}
                placeholder={candidate.geographyValue ?? ""}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Budget estimate (USD, optional)
            </span>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={budgetDollars}
                onChange={(e) => setBudgetDollars(e.currentTarget.value)}
                placeholder="e.g. 15000"
                className="w-full rounded-md border border-slate-300 pl-6 pr-2.5 py-1.5"
              />
            </div>
          </label>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
              {error}
            </div>
          )}

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !campaignName.trim()}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? "Creating…" : "Create campaign"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

/** Normalizes an ISO timestamp or YYYY-MM-DD into the `<input type="date">`
 *  value format. Returns "" when the input is not parseable. */
function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  // Already date-only
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
