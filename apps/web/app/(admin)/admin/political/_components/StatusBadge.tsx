import type { CandidateStatus, DistrictType } from "@/lib/political/queries";

// ── CandidateStatus badge ────────────────────────────────────────────────────

const STATUS_CLASSES: Record<CandidateStatus, string> = {
  active:   "bg-blue-50 text-blue-700 ring-blue-200",
  inactive: "bg-slate-100 text-slate-600 ring-slate-200",
  won:      "bg-emerald-50 text-emerald-700 ring-emerald-200",
  lost:     "bg-rose-50 text-rose-700 ring-rose-200",
};

const STATUS_LABELS: Record<CandidateStatus, string> = {
  active:   "Active",
  inactive: "Inactive",
  won:      "Won",
  lost:     "Lost",
};

export function StatusBadge({ status }: { status: CandidateStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── DistrictType badge ───────────────────────────────────────────────────────

const DISTRICT_CLASSES: Record<DistrictType, string> = {
  federal: "bg-violet-50 text-violet-700 ring-violet-200",
  state:   "bg-amber-50 text-amber-700 ring-amber-200",
  local:   "bg-cyan-50 text-cyan-700 ring-cyan-200",
};

const DISTRICT_LABELS: Record<DistrictType, string> = {
  federal: "Federal",
  state:   "State",
  local:   "Local",
};

export function DistrictTypeBadge({ value }: { value: DistrictType | null }) {
  if (!value) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-200">
        —
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${DISTRICT_CLASSES[value]}`}
    >
      {DISTRICT_LABELS[value]}
    </span>
  );
}

// ── Geography summary ───────────────────────────────────────────────────────

export function GeographyLabel({
  state,
  geographyType,
  geographyValue,
}: {
  state: string;
  geographyType: string | null;
  geographyValue: string | null;
}) {
  if (!geographyType || !geographyValue) {
    return <span className="text-slate-500">{state}</span>;
  }
  // Short typed prefix keeps the scale signal visible: "county: Franklin · OH".
  return (
    <span className="text-slate-700">
      <span className="text-slate-400">{geographyType}:</span>{" "}
      <span className="font-medium">{geographyValue}</span>
      <span className="text-slate-400"> · {state}</span>
    </span>
  );
}
