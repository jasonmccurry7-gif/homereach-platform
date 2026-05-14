import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, CalendarDays, MapPinned, ShieldCheck } from "lucide-react";
import { CampaignReadinessChecklist } from "@/app/political/_components/CampaignReadinessChecklist";
import { CandidateAgentActionPanel } from "../_components/CandidateAgentActionPanel";
import { CandidatePlanEditPanel } from "../_components/CandidatePlanEditPanel";
import { buildCandidateLaunchReadiness } from "@/lib/political/candidate-readiness";
import { loadCandidateAgentWorkspace } from "@/lib/political/candidate-launch-agent";
import { formatCurrency } from "@/lib/political/admin-command";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ candidateId: string }>;
}

export default async function CandidateAgentDetailPage({ params }: PageProps) {
  const { candidateId } = await params;
  const workspace = await loadCandidateAgentWorkspace(candidateId);
  if (!workspace.candidate) notFound();

  const candidate = workspace.candidate;
  const plan = workspace.latestPlan;
  const readiness = buildCandidateLaunchReadiness({
    candidate,
    latestResearch: workspace.latestResearch,
    latestPlan: plan,
  });
  const planSources = plan?.planJson.data_sources ?? [];
  const mapHref = `/admin/political/maps?state=${encodeURIComponent(candidate.state)}&geographyType=${encodeURIComponent(
    candidate.geographyType ?? "",
  )}&geographyValue=${encodeURIComponent(candidate.geographyValue ?? "")}`;

  return (
    <section className="space-y-5">
      <Link
        href="/admin/political/candidate-agent"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Candidate Agents
      </Link>

      {!workspace.schemaReady && (
        <div className="rounded-lg border border-amber-300/25 bg-amber-950/30 p-4 text-sm text-amber-100">
          <div className="font-bold">Launch-agent migration pending</div>
          <p className="mt-1 text-amber-100/80">{workspace.migrationHint}</p>
        </div>
      )}

      <header className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-bold uppercase text-blue-200">Candidate 360</p>
          <h1 className="mt-2 text-3xl font-black text-white">{candidate.candidateName}</h1>
          <p className="mt-2 text-sm text-slate-300">
            {candidate.officeSought ?? "Office not set"} / {candidate.geographyType ?? "geography"}:{" "}
            {candidate.geographyValue ?? candidate.state}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Info label="State" value={candidate.state} />
            <Info label="Race Level" value={candidate.districtType ?? "Not set"} />
            <Info label="Election" value={candidate.electionDate ?? "Missing"} />
            <Info label="Priority" value={candidate.priorityScore?.toString() ?? "Pending"} />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-200" />
            <h2 className="font-bold text-white">Launch Agent</h2>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            {workspace.agent?.currentTask ?? "Agent assignment is ready. Run research to activate the workflow."}
          </p>
          <div className="mt-4">
            <CandidateAgentActionPanel
              candidateId={candidate.id}
              initialPlan={plan}
              hasResearch={Boolean(workspace.latestResearch)}
              approvalLockedReason={
                readiness.approvalEnabled ? null : readiness.nextRequiredAction
              }
              productionLockedReason={
                readiness.productionEnabled ? null : readiness.nextRequiredAction
              }
            />
          </div>
        </div>
      </header>

      <CampaignReadinessChecklist
        title="Verified Launch Package Gate"
        candidateName={candidate.candidateName}
        readiness={readiness}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2">
              <MapPinned className="h-4 w-4 text-blue-200" />
              <h2 className="font-bold text-white">Research Summary</h2>
            </div>
            {workspace.latestResearch ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
                  <div className="text-xs font-bold uppercase text-slate-500">Candidate</div>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {workspace.latestResearch.candidateSummary}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
                  <div className="text-xs font-bold uppercase text-slate-500">Race</div>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {workspace.latestResearch.raceSummary}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/60 p-4 md:col-span-2">
                  <div className="text-xs font-bold uppercase text-slate-500">Missing Data</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {workspace.latestResearch.missingData.length > 0 ? (
                      workspace.latestResearch.missingData.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-amber-300/20 bg-amber-950/35 px-3 py-1 text-xs font-semibold text-amber-100"
                        >
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-emerald-200">No required research gaps flagged.</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-white/15 p-6 text-sm text-slate-300">
                Run Candidate Research to create the structured public campaign profile.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-200" />
              <h2 className="font-bold text-white">Multi-Phase Launch Plan</h2>
            </div>
            {plan ? (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Info label="Status" value={plan.status.replaceAll("_", " ")} />
                  <Info label="Households" value={plan.totalHouseholds.toLocaleString()} />
                  <Info label="Estimated Total" value={formatCurrency(plan.totalEstimatedCostCents)} />
                </div>
                <div className="rounded-lg border border-blue-300/15 bg-blue-950/25 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
                        Interactive Map Selections
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Open the map with this candidate context, then replace estimates with verified USPS route counts before proposal send.
                      </p>
                    </div>
                    <Link
                      href={mapHref}
                      className="inline-flex rounded-lg border border-blue-300/20 bg-blue-600/20 px-3 py-2 text-xs font-bold text-blue-50 transition hover:bg-blue-600/30"
                    >
                      Open Map Selection
                    </Link>
                  </div>
                </div>
                <CandidatePlanEditPanel
                  candidateId={candidate.id}
                  planId={plan.id}
                  recommendedStrategy={plan.recommendedStrategy}
                />
                <div className="space-y-2">
                  {workspace.phases.map((phase) => (
                    <article key={phase.id} className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-bold text-white">
                          Phase {phase.phaseNumber}: {phase.objective}
                        </h3>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                          {phase.recommendedSendDate ?? "Date pending"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{phase.creativeBrief}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-4">
                        <Mini label="Households" value={phase.householdCount.toLocaleString()} />
                        <Mini label="Print" value={formatCurrency(phase.estimatedPrintCostCents)} />
                        <Mini label="Postage" value={formatCurrency(phase.estimatedPostageCostCents)} />
                        <Mini label="Total" value={formatCurrency(phase.totalEstimatedCostCents)} />
                      </div>
                    </article>
                  ))}
                </div>
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      Data Sources Used
                    </div>
                    <div className="mt-3 space-y-2">
                      {planSources.length > 0 ? (
                        planSources.map((source) =>
                          source.url ? (
                            <a
                              key={`${source.label}-${source.url}`}
                              href={source.url}
                              className="block rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-blue-100 transition hover:border-blue-300/30"
                            >
                              {source.label}
                            </a>
                          ) : (
                            <div
                              key={source.label}
                              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300"
                            >
                              {source.label}
                            </div>
                          ),
                        )
                      ) : (
                        <div className="text-sm text-slate-400">No sources attached yet.</div>
                      )}
                    </div>
                  </div>
                  <details className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
                    <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
                      Structured Plan JSON
                    </summary>
                    <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-white/10 bg-slate-900 p-3 text-[11px] leading-5 text-slate-300">
                      {JSON.stringify(plan.planJson, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-white/15 p-6 text-sm text-slate-300">
                Generate a multi-phase plan to see budget, schedule, geography, and creative direction.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-200" />
              <h2 className="font-bold text-white">Guardrails</h2>
            </div>
            <div className="mt-3 space-y-2">
              {workspace.guardrails.map((guardrail) => (
                <div key={guardrail} className="rounded-lg border border-emerald-300/15 bg-emerald-950/20 p-3 text-xs leading-5 text-emerald-50">
                  {guardrail}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <h2 className="font-bold text-white">Activity</h2>
            {workspace.activity.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No launch-agent activity yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {workspace.activity.map((activity) => (
                  <div key={activity.id} className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
                    <div className="text-xs font-bold uppercase text-slate-500">
                      {activity.activityType.replaceAll("_", " ")}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-300">{activity.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
      <div className="text-[10px] font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold capitalize text-slate-100" title={value}>
        {value}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-white/[0.04] p-2">
      <div className="text-[10px] font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-xs font-semibold text-slate-200">{value}</div>
    </div>
  );
}
