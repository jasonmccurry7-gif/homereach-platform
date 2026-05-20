import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  DollarSign,
  Gauge,
  PackageSearch,
  Radio,
  ShieldAlert,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CopilotConsole } from "./copilot-console";
import { CostReductionCommandCenter } from "./cost-reduction-command-center";
import {
  formatCopilotMoney,
} from "@/lib/operations-copilot/intelligence";
import type { CopilotSnapshot } from "@/lib/operations-copilot/types";

export function OperationsCommandCenter({
  snapshot,
}: {
  snapshot: CopilotSnapshot;
}) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-lg border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_34%),#111111] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            AI Cost Reduction Command Center
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-normal text-white md:text-5xl">
            {snapshot.companyName}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-neutral-300">
            A simple owner-facing command center for savings, vendor risk,
            inventory health, approval-ready orders, and weekly cost reduction.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/operations-copilot/delivery"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-300 px-4 py-2 text-sm font-bold text-neutral-950 transition-colors hover:bg-emerald-200"
            >
              View Best Delivered Prices
            </Link>
            <Link
              href="/operations-copilot/approvals"
              className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-neutral-100 transition-colors hover:bg-white/10"
            >
              Review Approvals
            </Link>
          </div>
        </div>
        <div className="rounded-lg border border-cyan-400/20 bg-neutral-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-300">
              Command Health
            </span>
            <Gauge className="h-5 w-5 text-cyan-300" aria-hidden="true" />
          </div>
          <div className="mt-5 text-6xl font-bold tabular-nums text-white">
            {snapshot.healthScore}
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-cyan-300"
              style={{ width: `${snapshot.healthScore}%` }}
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-neutral-400">
            Based on shortage exposure, approval backlog, supplier reliability,
            and active opportunity value.
          </p>
        </div>
      </section>

      <CostReductionCommandCenter snapshot={snapshot} />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={PackageSearch}
          label="Inventory Items"
          value={String(snapshot.inventoryItemCount)}
        />
        <StatCard
          icon={Truck}
          label="Suppliers"
          value={String(snapshot.supplierCount)}
        />
        <StatCard
          icon={ShieldAlert}
          label="At Risk"
          value={String(snapshot.atRiskInventoryCount)}
        />
        <StatCard
          icon={Clock}
          label="Approvals"
          value={String(snapshot.pendingApprovalCount)}
        />
        <StatCard
          icon={DollarSign}
          label="Open Savings"
          value={formatCopilotMoney(snapshot.projectedSavingsCents)}
        />
      </section>

      <CopilotConsole snapshot={snapshot} />

      <section id="risks" className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-white/10 bg-neutral-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
                Proactive Signal Feed
              </p>
              <h2 className="mt-2 text-xl font-bold text-white">
                Highest-priority risks and opportunities
              </h2>
            </div>
            <Radio className="h-5 w-5 text-amber-300" aria-hidden="true" />
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.insights.map((insight) => (
              <article
                key={insight.id}
                className="rounded-lg border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-white/10 px-2 py-1 text-xs font-semibold uppercase text-neutral-200">
                        {insight.type.replaceAll("_", " ")}
                      </span>
                      <span className="rounded bg-amber-400/10 px-2 py-1 text-xs font-semibold uppercase text-amber-200">
                        {insight.urgency}
                      </span>
                    </div>
                    <h3 className="mt-3 font-bold text-white">{insight.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-300">
                      {insight.summary}
                    </p>
                  </div>
                  <div className="min-w-32 rounded-lg border border-white/10 bg-neutral-950 p-3 text-sm">
                    <div className="text-neutral-500">Impact</div>
                    <div className="mt-1 font-bold text-emerald-300">
                      {formatCopilotMoney(insight.estimatedImpactCents)}
                    </div>
                    <div className="mt-2 text-neutral-500">Risk</div>
                    <div className="font-bold text-white">{insight.riskScore}/100</div>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-cyan-400/10 p-3 text-sm text-cyan-50">
                  {insight.recommendedAction}
                </div>
                <ul className="mt-3 grid gap-2 text-xs text-neutral-400 md:grid-cols-3">
                  {insight.reasoning.map((reason) => (
                    <li key={reason} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div id="approvals" className="rounded-lg border border-white/10 bg-neutral-900 p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-300" aria-hidden="true" />
              <h2 className="font-bold text-white">Approval Queue</h2>
            </div>
            <p className="mt-3 text-4xl font-bold text-white">
              {snapshot.pendingApprovalCount}
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Drafts and conditional autonomy actions wait here until approval
              policy permits execution.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-neutral-900 p-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              <h2 className="font-bold text-white">Operations Stream</h2>
            </div>
            <div className="mt-4 space-y-3">
              {snapshot.activityFeed.map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-300"
                >
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

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-900 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
          {label}
        </span>
        <Icon className="h-4 w-4 text-cyan-300" aria-hidden={true} />
      </div>
      <div className="mt-3 text-2xl font-bold tabular-nums text-white">
        {value}
      </div>
    </div>
  );
}
