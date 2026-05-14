import Link from "next/link";
import { Bot, ClipboardList, Plus, ShieldCheck } from "lucide-react";
import { createCandidateAgentCandidate } from "./actions";
import { CandidateAgentActionPanel } from "../_components/CandidateAgentActionPanel";
import { buildCandidateLaunchReadiness } from "@/lib/political/candidate-readiness";
import { loadCandidateAgentDashboard } from "@/lib/political/candidate-launch-agent";
import { formatCurrency } from "@/lib/political/admin-command";

export const dynamic = "force-dynamic";
export const metadata = { title: "Candidate Agent - Political - HomeReach" };

export default async function CandidateAgentPage() {
  const dashboard = await loadCandidateAgentDashboard(300);

  return (
    <section className="space-y-5">
      <header className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase text-blue-200">Candidate Campaign Launch Agents</p>
          <h1 className="mt-2 text-3xl font-black text-white">
            AI-Assisted Campaign Launch Planning
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Add a candidate, assign a launch agent, generate public-source research, build a multi-phase postcard plan, and move approved campaigns toward proposal and production readiness.
          </p>
        </div>
        <Link
          href="/admin/political/maps"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/10"
        >
          <ClipboardList className="h-4 w-4" />
          Open Map Ops
        </Link>
      </header>

      {!dashboard.schemaReady && (
        <div className="rounded-lg border border-amber-300/25 bg-amber-950/30 p-4 text-sm text-amber-100">
          <div className="font-bold">Launch-agent migration pending</div>
          <p className="mt-1 text-amber-100/80">{dashboard.migrationHint}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Candidates" value={dashboard.metrics.candidates.toLocaleString()} />
        <Metric label="Agents" value={dashboard.metrics.agents.toLocaleString()} />
        <Metric label="Research Done" value={dashboard.metrics.researchComplete.toLocaleString()} />
        <Metric label="Plans Ready" value={dashboard.metrics.plansReady.toLocaleString()} />
        <Metric label="Needs Approval" value={dashboard.metrics.approvalsNeeded.toLocaleString()} tone="amber" />
        <Metric label="Production Ready" value={dashboard.metrics.productionReady.toLocaleString()} tone="green" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <form
          action={createCandidateAgentCandidate}
          className="rounded-lg border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-slate-950/30"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/20 text-blue-100">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-white">Add Candidate</h2>
              <p className="text-xs text-slate-400">Creates a candidate record and assigns a launch agent.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <Field name="candidateName" label="Candidate name" required />
            <Field name="campaignName" label="Campaign name" />
            <Field name="officeSought" label="Office sought" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="state" label="State" defaultValue="OH" maxLength={2} />
              <Field name="electionDate" label="Election date" type="date" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                name="districtType"
                label="Race level"
                options={[
                  ["local", "Local"],
                  ["state", "State"],
                  ["federal", "Federal"],
                ]}
              />
              <Select
                name="geographyType"
                label="Geography"
                options={[
                  ["city", "City"],
                  ["county", "County"],
                  ["district", "District"],
                  ["state", "State"],
                ]}
              />
            </div>
            <Field name="geographyValue" label="Geography value" placeholder="Cincinnati, Franklin, OH-1" />
            <Field name="partyOptionalPublic" label="Public party/committee" />
            <Field name="campaignWebsite" label="Campaign website" type="url" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="campaignEmail" label="Campaign email" type="email" />
              <Field name="campaignPhone" label="Campaign phone" />
            </div>
            <Field name="sourceUrl" label="Official filing/source URL" type="url" />
            <label className="grid gap-1 text-xs font-semibold text-slate-300">
              Notes
              <textarea
                name="notes"
                rows={3}
                className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/50"
              />
            </label>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500">
              <Bot className="h-4 w-4" />
              Create Candidate Agent
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-200" />
              <h2 className="font-bold text-white">Compliance Guardrails</h2>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {dashboard.guardrails.map((guardrail) => (
                <div
                  key={guardrail}
                  className="rounded-lg border border-emerald-300/15 bg-emerald-950/20 p-3 text-xs leading-5 text-emerald-50"
                >
                  {guardrail}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] shadow-2xl shadow-slate-950/30">
            <div className="border-b border-white/10 px-4 py-3">
              <h2 className="font-bold text-white">Agent Operations Queue</h2>
              <p className="mt-1 text-xs text-slate-400">
                Candidates are tied to the existing political records. Actions are draft/stage only until human approval.
              </p>
            </div>
            {dashboard.rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-300">
                No candidates yet. Add the first campaign record to activate the launch-agent workflow.
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {dashboard.rows.map((row) => {
                  const readiness = buildCandidateLaunchReadiness({
                    candidate: row.candidate,
                    latestResearch: row.latestResearch,
                    latestPlan: row.latestPlan,
                  });

                  return (
                    <article key={row.candidate.id} className="grid gap-4 p-4 xl:grid-cols-[1fr_520px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/political/${row.candidate.id}`}
                          className="truncate text-base font-black text-white hover:text-blue-200"
                        >
                          {row.candidate.candidateName}
                        </Link>
                        <span className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-0.5 text-xs font-semibold text-slate-300">
                          {row.agent?.status.replaceAll("_", " ") ?? "agent not assigned"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-300">
                        {row.candidate.officeSought ?? "Office not set"} / {row.candidate.geographyType ?? "geography"}:{" "}
                        {row.candidate.geographyValue ?? row.candidate.state}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <MiniStat label="Confidence" value={`${row.latestPlan?.confidenceScore ?? row.latestResearch?.confidenceScore ?? row.agent?.confidenceScore ?? 0}%`} />
                        <MiniStat label="Next Action" value={row.nextAction} />
                        <MiniStat
                          label="Plan Value"
                          value={
                            row.latestPlan
                              ? formatCurrency(row.latestPlan.totalEstimatedCostCents)
                              : "Pending"
                          }
                        />
                        <MiniStat label="Readiness" value={`${readiness.score}% ${readiness.statusLabel}`} />
                      </div>
                      {row.activity.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {row.activity.slice(0, 2).map((activity) => (
                            <div key={activity.id} className="text-xs text-slate-400">
                              {activity.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <CandidateAgentActionPanel
                      candidateId={row.candidate.id}
                      initialPlan={row.latestPlan}
                      hasResearch={Boolean(row.latestResearch)}
                      approvalLockedReason={
                        readiness.approvalEnabled ? null : readiness.nextRequiredAction
                      }
                      productionLockedReason={
                        readiness.productionEnabled ? null : readiness.nextRequiredAction
                      }
                      compact
                    />
                  </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone = "blue" }: { label: string; value: string; tone?: "blue" | "amber" | "green" }) {
  const toneClass =
    tone === "green"
      ? "border-emerald-300/20 bg-emerald-950/35 text-emerald-100"
      : tone === "amber"
        ? "border-amber-300/20 bg-amber-950/35 text-amber-100"
        : "border-blue-300/20 bg-blue-950/35 text-blue-100";
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="text-[11px] font-bold uppercase text-current/70">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/60 p-2">
      <div className="text-[10px] font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-1 truncate text-xs font-semibold text-slate-200" title={value}>
        {value}
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
  defaultValue,
  placeholder,
  maxLength,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-300">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
        className="h-10 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/50"
      />
    </label>
  );
}

function Select({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-300">
      {label}
      <select
        name={name}
        className="h-10 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none transition focus:border-blue-300/50"
      >
        {options.map(([value, display]) => (
          <option key={value} value={value}>
            {display}
          </option>
        ))}
      </select>
    </label>
  );
}
