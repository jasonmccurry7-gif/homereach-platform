import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  FileText,
  Landmark,
  ShieldCheck,
  Users,
} from "lucide-react";
import { CONTRACT_WORKFLOW_GOVERNANCE } from "@/lib/admin/admin-operating-model";
import { contractOSFeatureFlags } from "@/lib/contractos/config";
import { loadContractOSDashboard } from "@/lib/contractos/data";
import { getContractOSProductionDepth } from "@/lib/contractos/production-readiness";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ContractOS Command Center - HomeReach Admin",
};

export default async function AdminContractOSPage() {
  if (!contractOSFeatureFlags().enabled) notFound();

  const data = await loadContractOSDashboard();
  const productionDepth = getContractOSProductionDepth();
  const highestFit = data.opportunities[0];

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.28),transparent_42%),linear-gradient(135deg,#020617,#0f172a)] p-6 lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">ContractOS command center</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight lg:text-4xl">
                Small-business GovCon operating system.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Admin visibility for readiness scans, bids in progress, opportunity matches, proposal drafts, stuck users,
                agent activity, and paid support opportunities. ContractOS reuses the existing Gov Contracts engine and keeps
                submissions, pricing, certifications, and subcontractor commitments approval-gated.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:w-[28rem]">
              <DarkMetric label="Active users" value={String(data.summary.activeUsers)} />
              <DarkMetric label="Revenue signals" value={String(data.summary.revenueOpportunities)} />
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Workflow ownership lock</p>
            <h2 className="mt-1 text-lg font-black">ContractOS is packaging; Gov Contracts is approval authority.</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6">{CONTRACT_WORKFLOW_GOVERNANCE.rule}</p>
          </div>
          <Link
            href={CONTRACT_WORKFLOW_GOVERNANCE.approvalOwnerPath}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white"
          >
            Open Gov Contracts approvals
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={BriefcaseBusiness} label="Bids in progress" value={String(data.summary.bidsInProgress)} detail="Existing Gov Contracts bid rooms" />
        <MetricCard icon={Landmark} label="Opportunities tracked" value={String(data.summary.opportunitiesTracked)} detail="Public-safe opportunity cards" />
        <MetricCard icon={CalendarClock} label="Upcoming deadlines" value={String(data.summary.upcomingDeadlines)} detail="Review windows to watch" />
        <MetricCard icon={FileText} label="Proposal drafts" value={String(data.summary.proposalDrafts)} detail="Human review required" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Production depth</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Connector and safety readiness</h2>
          </div>
          <div className="rounded-xl bg-slate-950 px-4 py-3 text-center text-white">
            <p className="text-3xl font-black">{productionDepth.score}%</p>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Depth</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {productionDepth.items.map((item) => (
            <DepthStatusCard key={item.label} item={item} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Next admin action</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                {highestFit ? "Review the highest-fit opportunity." : "Connect live SAM.gov opportunities."}
              </h2>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700 ring-1 ring-emerald-200">
              Safe
            </span>
          </div>
          {highestFit ? (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-lg font-black text-slate-950">{highestFit.plainEnglishTitle}</p>
              <p className="mt-1 text-sm text-slate-600">{highestFit.agency}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <MiniFact label="Fit" value={`${highestFit.estimatedFit}%`} />
                <MiniFact label="Risk" value={highestFit.riskLevel} />
                <MiniFact label="Deadline" value={highestFit.deadline} />
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-700">{highestFit.recommendedAction}</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link href={`/admin/gov-contracts/${encodeURIComponent(highestFit.id)}`} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white">
                  Open admin review
                </Link>
                <Link href={`/admin/gov-contracts/${encodeURIComponent(highestFit.id)}/bid-room`} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-950">
                  Open bid room
                </Link>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Add SAM_GOV_API_KEY and run sync to pull live opportunities. ContractOS will keep manual/internal records admin-side.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Admin quick actions</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <QuickAction href="/admin/gov-contracts" icon={Landmark} label="Review opportunities" />
            <QuickAction href="/admin/gov-contracts?status=bid_prep" icon={BriefcaseBusiness} label="Open bid pipeline" />
            <QuickAction href="/admin/gov-contracts/subcontractors" icon={Users} label="Subcontractor sourcing" />
            <QuickAction href="/admin/agents?workflow=sam.gov" icon={Bot} label="AI agent tasks" />
            <QuickAction href="/admin/gov-contracts?status=awaiting_approval" icon={ShieldCheck} label="Approval queue" />
            <QuickAction href="/contractos" icon={ArrowRight} label="Public ContractOS" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">AI agent layer</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.agents.map((agent) => (
              <div key={agent.name} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{agent.name}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{agent.mission}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black uppercase text-blue-700 ring-1 ring-blue-200">
                    {agent.status.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-3 rounded-lg bg-white p-3 text-xs font-semibold leading-5 text-slate-600 ring-1 ring-slate-200">
                  {agent.nextAction}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-black">Safety lock</p>
                <p className="mt-2 text-sm leading-6">
                  ContractOS prepares decisions; it does not submit bids, certify eligibility, approve pricing, bind
                  HomeReach, or commit subcontractors without human approval.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Monetization architecture</p>
            <div className="mt-4 space-y-2">
              {[
                "Free readiness scan",
                "Monthly ContractOS workspace",
                "AI proposal assistance",
                "Done-for-you bid consulting",
                "Subcontractor matchmaking",
                "Enterprise upgrade path",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                  <BadgeDollarSign className="h-4 w-4 text-blue-700" aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Landmark;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Landmark;
  label: string;
}) {
  return (
    <Link href={href} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-950 transition hover:bg-slate-100">
      <Icon className="h-4 w-4 text-blue-700" aria-hidden="true" />
      {label}
    </Link>
  );
}

function DepthStatusCard({
  item,
}: {
  item: ReturnType<typeof getContractOSProductionDepth>["items"][number];
}) {
  const tone =
    item.status === "ready"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : item.status === "locked"
        ? "bg-blue-50 text-blue-800 ring-blue-200"
        : "bg-amber-50 text-amber-800 ring-amber-200";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-black text-slate-950">{item.label}</p>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ring-1 ${tone}`}>
          {item.status.replace("_", " ")}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
      <p className="mt-3 rounded-lg bg-white p-3 text-xs font-semibold leading-5 text-slate-700 ring-1 ring-slate-200">
        {item.action}
      </p>
    </div>
  );
}
