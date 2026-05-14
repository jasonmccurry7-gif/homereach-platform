"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Flag,
  Mail,
  Printer,
  ShieldCheck,
  Timer,
} from "lucide-react";
import {
  generateMailDropTimeline,
  getDefaultElectionDate,
  getDefaultPlanningStartDate,
  OFFICE_TIMELINE_OPTIONS,
  type CampaignOfficeType,
  type ElectionType,
  type MailTimelinePhase,
  type TimelineUrgency,
} from "@/lib/political/mail-timeline";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const URGENCY_CLASSES: Record<TimelineUrgency, string> = {
  full_runway: "border-emerald-300/30 bg-emerald-500/10 text-emerald-100",
  healthy: "border-blue-300/30 bg-blue-500/10 text-blue-100",
  compressed: "border-amber-300/30 bg-amber-500/10 text-amber-100",
  urgent: "border-red-300/30 bg-red-500/10 text-red-100",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "TBD";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "TBD" : DATE_FORMATTER.format(date);
}

function phaseTone(phase: MailTimelinePhase) {
  if (phase.phaseKey === "gotv") return "border-red-300/25 bg-red-500/10";
  if (phase.phaseKey === "early_vote") return "border-amber-300/25 bg-amber-500/10";
  return "border-blue-300/20 bg-blue-500/10";
}

export function MailTimelineCalculator() {
  const [candidateName, setCandidateName] = useState("");
  const [officeType, setOfficeType] = useState<CampaignOfficeType>("governor");
  const [electionType, setElectionType] = useState<ElectionType>("general");
  const [electionDate, setElectionDate] = useState(getDefaultElectionDate());
  const [planningStartDate, setPlanningStartDate] = useState(getDefaultPlanningStartDate());
  const [earlyVoteStartDate, setEarlyVoteStartDate] = useState("");
  const [geography, setGeography] = useState("Ohio");

  const timeline = useMemo(
    () =>
      generateMailDropTimeline({
        candidateName,
        officeType,
        electionType,
        electionDate,
        earlyVoteStartDate,
        planningStartDate,
        geography,
      }),
    [candidateName, earlyVoteStartDate, electionDate, electionType, geography, officeType, planningStartDate],
  );

  function applyPreset(type: CampaignOfficeType, geographyValue: string) {
    setOfficeType(type);
    setGeography(geographyValue);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-lg border border-white/10 bg-slate-950 p-5 shadow-2xl shadow-slate-950/30">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-white/10 bg-blue-500/15 p-2 text-blue-200">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Timeline Inputs</p>
              <h2 className="text-lg font-black text-white">Campaign calendar</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field
              label="Candidate or campaign"
              value={candidateName}
              placeholder="e.g. Smith for Governor"
              onChange={setCandidateName}
            />
            <label className="block">
              <span className="text-xs font-bold text-slate-400">Office</span>
              <select
                value={officeType}
                onChange={(event) => setOfficeType(event.target.value as CampaignOfficeType)}
                className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              >
                {OFFICE_TIMELINE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-400">Election type</span>
              <select
                value={electionType}
                onChange={(event) => setElectionType(event.target.value as ElectionType)}
                className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              >
                <option value="general">General</option>
                <option value="primary">Primary</option>
                <option value="special">Special</option>
              </select>
            </label>
            <Field label="Geography" value={geography} placeholder="e.g. Ohio, OH-3, Franklin County" onChange={setGeography} />
            <DateField label="Election date" value={electionDate} onChange={setElectionDate} />
            <DateField label="Planning starts" value={planningStartDate} onChange={setPlanningStartDate} />
            <DateField label="Early vote starts" value={earlyVoteStartDate} onChange={setEarlyVoteStartDate} optional />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <PresetButton label="Governor race" onClick={() => applyPreset("governor", "Ohio")} />
            <PresetButton label="U.S. House" onClick={() => applyPreset("us_house", "Congressional district")} />
            <PresetButton label="Mayor" onClick={() => applyPreset("mayor", "City")} />
            <PresetButton label="School board" onClick={() => applyPreset("school_board", "School district")} />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-slate-950/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">Recommended Mail Arc</p>
              <h2 className="mt-1 text-2xl font-black text-white">{timeline.candidateName}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                {timeline.office.label} in {timeline.geography}. Election Day: {formatDate(timeline.electionDate)}.
              </p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${URGENCY_CLASSES[timeline.urgency]}`}>
              {timeline.urgencyLabel}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric icon={Timer} label="Runway" value={`${timeline.runwayDays} days`} />
            <Metric icon={Mail} label="First drop" value={formatDate(timeline.phases[0]?.recommendedDropDate)} />
            <Metric icon={Flag} label="Final in-home" value={formatDate(timeline.phases[4]?.inHomeEndDate)} />
          </div>

          <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/70 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-200" />
              Office-specific cadence
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{timeline.office.cadenceSummary}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{timeline.office.officeNote}</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-slate-950 p-5 shadow-2xl shadow-slate-950/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Five-Phase Postcard Plan</p>
            <h2 className="mt-1 text-xl font-black text-white">Recommended drop calendar</h2>
          </div>
          <a
            href="/political/plan"
            className="rounded-lg border border-blue-200/25 bg-blue-500/15 px-4 py-2 text-sm font-bold text-blue-100 transition hover:bg-blue-500/25"
          >
            Build coverage plan
          </a>
        </div>

        <div className="mt-5 grid gap-4">
          {timeline.phases.map((phase) => (
            <PhaseRow key={phase.phaseKey} phase={phase} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <Printer className="h-4 w-4 text-blue-200" />
            Production rules
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {timeline.phases.slice(0, 2).map((phase) => (
              <div key={phase.phaseKey} className="rounded-lg border border-white/10 bg-slate-950 p-3">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Phase {phase.phaseNumber}</div>
                <div className="mt-2 text-sm font-bold text-white">Creative lock: {formatDate(phase.creativeLockDate)}</div>
                <div className="mt-1 text-xs text-slate-400">Print deadline: {formatDate(phase.printDeadlineDate)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-200" />
            Methodology guardrails
          </div>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
            {timeline.methodologyNotes.map((note) => (
              <li key={note} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-400 focus:outline-none"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
  optional,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-400">{label}{optional ? " (optional)" : ""}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
      />
    </label>
  );
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-white/10"
    >
      {label}
    </button>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950 p-4">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        <Icon className="h-3.5 w-3.5 text-blue-200" />
        {label}
      </div>
      <div className="mt-2 text-lg font-black text-white">{value}</div>
    </div>
  );
}

function PhaseRow({ phase }: { phase: MailTimelinePhase }) {
  return (
    <article className={`rounded-lg border p-4 ${phaseTone(phase)}`}>
      <div className="grid gap-4 lg:grid-cols-[0.55fr_1fr_0.85fr] lg:items-start">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Phase {phase.phaseNumber}
          </div>
          <h3 className="mt-1 text-lg font-black text-white">{phase.title}</h3>
          <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/80 p-3">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-blue-200">Mail drop</div>
            <div className="mt-1 text-2xl font-black text-white">{formatDate(phase.recommendedDropDate)}</div>
            <div className="mt-1 text-xs text-slate-400">{phase.daysBeforeElection} days before Election Day</div>
            {phase.catchUp && (
              <div className="mt-2 rounded-md border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-100">
                Catch-up from ideal {formatDate(phase.idealDropDate)}
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm leading-6 text-slate-200">{phase.objective}</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">{phase.messageTheme}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <DateChip icon={Clock3} label="In-home" value={`${formatDate(phase.inHomeStartDate)} - ${formatDate(phase.inHomeEndDate)}`} />
            <DateChip icon={FileText} label="Proof" value={formatDate(phase.proofApprovalDate)} />
            <DateChip icon={Printer} label="Print" value={formatDate(phase.printDeadlineDate)} />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-slate-950/70 p-3">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Why this timing</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{phase.whyThisTiming}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{phase.officeSpecificNote}</p>
        </div>
      </div>
    </article>
  );
}

function DateChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950 px-3 py-1.5 text-slate-200">
      <Icon className="h-3.5 w-3.5 text-blue-200" />
      <span className="font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  );
}
