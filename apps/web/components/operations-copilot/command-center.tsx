import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Gauge,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { OwnerSavingsActionButtons } from "./owner-savings-action-buttons";
import { SupplierCheckoutAction } from "./supplier-checkout-action";
import { formatCopilotMoney } from "@/lib/operations-copilot/intelligence";
import type { SupplierCheckoutOption } from "@/lib/operations-copilot/supplier-checkout";
import type { CopilotSnapshot } from "@/lib/operations-copilot/types";
import type {
  OwnerDelivery,
  OwnerOperationalIssue,
  OwnerProcurementOs,
  OwnerRecommendedAction,
  OwnerSavingsOpportunity,
} from "@/lib/operations-copilot/savings-os";

export function OperationsCommandCenter({
  ownerOs,
  snapshot,
}: {
  ownerOs: OwnerProcurementOs;
  snapshot: CopilotSnapshot;
}) {
  const urgentIssue =
    ownerOs.urgentIssues.find((issue) => issue.severity !== "Low") ??
    null;
  const topOpportunity = ownerOs.topSavingsOpportunities[0] ?? null;
  const hasPendingApproval = snapshot.pendingApprovalCount > 0;
  const urgentAction =
    ownerOs.recommendedActions.find((action) => {
      if (action.priority === "This week") return false;
      if (!hasPendingApproval && action.actionType?.includes("approve")) return false;
      return true;
    }) ??
    null;
  const nextDelivery = ownerOs.todaysDeliveries[0] ?? null;
  const deliveryIssue =
    ownerOs.todaysDeliveries.find(
      (delivery) => delivery.status === "Delayed" || delivery.status === "Partial"
    ) ?? null;
  const savingsApprovalOpportunity = hasPendingApproval ? topOpportunity : null;
  const ownerDecisionCount =
    (urgentIssue ? 1 : 0) + snapshot.pendingApprovalCount + (deliveryIssue ? 1 : 0);
  const hasOwnerDecision = ownerDecisionCount > 0;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.2),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.12),_transparent_28%),#07100f] p-5 md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
              Supplify Profitability Intelligence
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-normal text-white md:text-5xl">
              Protect margin before money leaks out.
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-neutral-200">
              Supplify watches recurring spend, vendor price drift, supply risk, delivery issues,
              and approval-ready savings so {snapshot.companyName} sees exactly where profit is
              protected and what needs a decision today.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill>Profitability intelligence</Pill>
              <Pill>Margin protection</Pill>
              <Pill>AI-assisted operational control</Pill>
              <Pill>No spend changes without approval</Pill>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-100">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Today&apos;s executive answer
            </div>
            <p className="mt-3 text-2xl font-black text-white">
              {hasOwnerDecision ? "Profit needs one clean decision." : "Margin watch is calm."}
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-300">
              {hasOwnerDecision
                ? `${ownerDecisionCount} savings, risk, or approval item${ownerDecisionCount === 1 ? "" : "s"} ${ownerDecisionCount === 1 ? "needs" : "need"} attention.`
                : "Savings checks, price drift, and risk monitoring are running quietly in the background."}{" "}
              Last updated {ownerOs.savingsSnapshot.lastUpdatedLabel}. No order, vendor switch, or spend change happens without approval.
            </p>
          </div>
        </div>
      </section>

      <SavingsRollup ownerOs={ownerOs} />
      <ProfitLeakRadar ownerOs={ownerOs} snapshot={snapshot} />
      <SupplifyTrustLayer ownerOs={ownerOs} snapshot={snapshot} />

      <section className="grid gap-4 xl:grid-cols-3">
        <DoNowCard issue={urgentIssue} action={urgentAction} />
        <ApproveSavingsCard
          opportunity={savingsApprovalOpportunity}
          ownerOs={ownerOs}
          pendingApprovalCount={snapshot.pendingApprovalCount}
          topOpportunity={topOpportunity}
        />
        <DeliveryCard delivery={deliveryIssue} preparedDelivery={nextDelivery} />
      </section>

      <SupplierCheckoutPanel options={ownerOs.supplierCheckoutOptions} />

      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" aria-hidden="true" />
          <div>
            <p className="font-bold text-white">Supplify keeps operational complexity behind the scenes.</p>
            <p className="mt-1 text-sm leading-6 text-neutral-300">{ownerOs.safetyNotice}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <WatchItem label="Prices" value="Verified, observed, or estimated" />
          <WatchItem label="Supply risk" value={`${snapshot.atRiskInventoryCount} at risk`} />
          <WatchItem label="Delivery watch" value={`${ownerOs.todaysDeliveries.length} options prepared`} />
          <WatchItem label="Approvals" value={`${snapshot.pendingApprovalCount} waiting`} />
        </div>
      </section>
    </div>
  );
}

function ProfitLeakRadar({
  ownerOs,
  snapshot,
}: {
  ownerOs: OwnerProcurementOs;
  snapshot: CopilotSnapshot;
}) {
  const savings = ownerOs.savingsSnapshot;
  const monthlyOpportunity = Math.max(
    savings.savingsFoundThisMonthCents,
    savings.savingsPendingApprovalCents,
    snapshot.projectedSavingsCents
  );
  const annualizedLeak = monthlyOpportunity * 12;
  const priceDriftCount = snapshot.insights.filter(
    (insight) => insight.type === "price_spike" || insight.type === "savings"
  ).length;
  const nextMove =
    ownerOs.recommendedActions[0]?.title ??
    ownerOs.topSavingsOpportunities[0]?.title ??
    "Keep source data fresh so Supplify can keep watching margin.";

  return (
    <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(255,255,255,0.035))] p-5">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-emerald-300" aria-hidden="true" />
          <h2 className="text-xl font-black text-white">Profit Leak Radar</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-neutral-300">
          The fastest read on where money may be leaking through price drift, supply risk,
          delayed decisions, and disconnected purchasing visibility.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <RadarMetric
            icon={TrendingDown}
            label="Annualized margin at watch"
            value={formatCopilotMoney(annualizedLeak)}
            detail="Directional opportunity if current monthly leaks repeat"
            tone="emerald"
          />
          <RadarMetric
            icon={AlertTriangle}
            label="Risk signals"
            value={String(snapshot.atRiskInventoryCount + snapshot.riskAlerts.length)}
            detail="Supply, vendor, pricing, and action items being watched"
            tone="amber"
          />
          <RadarMetric
            icon={DollarSign}
            label="Price drift signals"
            value={String(priceDriftCount)}
            detail="Savings or spike patterns that need source review"
            tone="cyan"
          />
          <RadarMetric
            icon={ShieldCheck}
            label="Owner approval lock"
            value={String(snapshot.pendingApprovalCount)}
            detail="Queued decisions before spend, vendor, or workflow changes"
            tone="white"
          />
        </div>
      </div>

      <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">
          Next best move
        </p>
        <h3 className="mt-3 text-2xl font-black text-white">{nextMove}</h3>
        <p className="mt-3 text-sm leading-6 text-emerald-50/85">
          Supplify is designed to reduce owner workload: surface the highest-value
          decision, show the money impact, explain the source quality, and keep action
          approval-gated.
        </p>
        <div className="mt-4 grid gap-2">
          <WatchItem label="Customer feeling" value="Control, clarity, confidence" />
          <WatchItem label="Primary promise" value="Stop quiet profit leaks" />
          <WatchItem label="Market proof" value="Vendor comparison is a paid SMB behavior" />
        </div>
      </div>
    </section>
  );
}

function SupplifyTrustLayer({
  ownerOs,
  snapshot,
}: {
  ownerOs: OwnerProcurementOs;
  snapshot: CopilotSnapshot;
}) {
  const sourceCounts = ownerOs.topSavingsOpportunities.reduce(
    (counts, opportunity) => {
      counts[opportunity.sourceQuality] += 1;
      return counts;
    },
    { estimated: 0, observed: 0, verified: 0 }
  );
  const nextActionCount = ownerOs.recommendedActions.length;

  return (
    <section className="rounded-lg border border-white/10 bg-neutral-900 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-300" aria-hidden="true" />
            <h2 className="text-xl font-black text-white">Profitability Guardrails</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
            Supplify keeps the product simple for the owner while preserving the
            controls that matter: proof quality, approval state, and clear next action.
          </p>
        </div>
        <span className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-100">
          Approval-first mode
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <GuardrailCard
          title="No silent spend"
          value={`${snapshot.pendingApprovalCount} waiting`}
          detail="Orders, vendor switches, quote sends, and payment actions stay blocked until reviewed."
        />
        <GuardrailCard
          title="Source discipline"
          value={`${sourceCounts.verified}/${sourceCounts.observed}/${sourceCounts.estimated}`}
          detail="Verified, observed, and estimated savings are separated so confidence stays honest."
        />
        <GuardrailCard
          title="Owner workload"
          value={`${nextActionCount} next moves`}
          detail="The system surfaces the highest-value decisions instead of burying the owner in tables."
        />
      </div>
    </section>
  );
}

function SupplierCheckoutPanel({
  options,
}: {
  options: SupplierCheckoutOption[];
}) {
  const visibleOptions = options.slice(0, 4);
  const totalSavingsCents = visibleOptions.reduce(
    (sum, option) => sum + Math.max(0, option.estimatedSavingsCents),
    0
  );

  return (
    <section className="rounded-lg border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_32%),rgba(255,255,255,0.04)] p-4 md:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-emerald-300" aria-hidden="true" />
            <h2 className="text-xl font-black text-white">
              Best-Price Action Path
            </h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-300">
            Supplify finds the clearest savings path, estimates true landed cost, and
            keeps the owner in control. Supplier payment stays direct, and vendor or
            spend changes require approval.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100">
            Visible savings
          </p>
          <p className="mt-1 text-2xl font-black text-white">
            {formatCopilotMoney(totalSavingsCents)}/mo
          </p>
        </div>
      </div>

      {visibleOptions.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
          <div className="hidden grid-cols-[1.25fr_1fr_0.85fr_0.95fr_1.15fr] gap-3 border-b border-white/10 bg-black/30 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-neutral-500 lg:grid">
            <span>Item</span>
            <span>Supplier</span>
            <span>Savings</span>
            <span>Delivery</span>
            <span>Next step</span>
          </div>
          <div className="divide-y divide-white/10">
            {visibleOptions.map((option) => (
              <div
                key={option.id}
                className="grid gap-4 bg-black/15 p-4 lg:grid-cols-[1.25fr_1fr_0.85fr_0.95fr_1.15fr] lg:items-center"
              >
                <div>
                  <p className="text-sm font-black text-white">{option.itemName}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <QualityPill quality={option.sourceQuality}>
                      {option.sourceQualityLabel}
                    </QualityPill>
                    <Pill>{option.confidenceLabel} confidence</Pill>
                  </div>
                </div>
                <div className="text-sm leading-6 text-neutral-300">
                  <p>
                    <span className="text-neutral-500">From </span>
                    <span className="font-bold text-neutral-100">
                      {option.currentSupplier}
                    </span>
                  </p>
                  <p>
                    <span className="text-neutral-500">To </span>
                    <span className="font-bold text-emerald-100">
                      {option.recommendedSupplier}
                    </span>
                  </p>
                  <p className="text-xs text-neutral-500">
                    {formatCopilotMoney(option.currentPriceCents)} current /{" "}
                    {formatCopilotMoney(option.recommendedPriceCents)} landed
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-100">
                    {formatCopilotMoney(option.estimatedSavingsCents)}
                  </p>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                    est. monthly
                  </p>
                </div>
                <div className="space-y-2 text-sm leading-6 text-neutral-300">
                  <p className="font-bold text-white">{option.deliveryEstimate}</p>
                  <p className="text-xs text-neutral-500">
                    {checkoutMethodLabel(option.checkoutMethod)}
                  </p>
                </div>
                <div className="space-y-2">
                  <SupplierCheckoutAction option={option} />
                  <p className="text-xs leading-5 text-neutral-500">
                    {option.disclaimer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-6 text-neutral-300">
          No supplier checkout recommendations are ready yet. Once supplier prices,
          invoice benchmarks, or delivery recommendations are available, the clearest
          savings path will appear here.
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Pill>Supplier payment stays direct</Pill>
        <Pill>Approval before vendor changes</Pill>
        <Pill>Checkout clicks are logged</Pill>
        <Link
          href="/operations-copilot/approvals"
          className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-cyan-100 transition-colors hover:bg-cyan-300/20"
        >
          Decision history
        </Link>
      </div>
    </section>
  );
}

function SavingsRollup({ ownerOs }: { ownerOs: OwnerProcurementOs }) {
  const savings = ownerOs.savingsSnapshot;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-300" aria-hidden="true" />
            <h2 className="text-xl font-black text-white">Profit Protection Rollup</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Done-for-you money view: found estimates, captured savings, margin at risk,
            and owner approvals with verification labels kept visible.
          </p>
        </div>
        <div className="text-sm font-bold text-neutral-400 sm:text-right">
          <p>Last updated {savings.lastUpdatedLabel}</p>
          <p className="mt-1">Enrolled {savings.enrolledAtLabel}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SavingsMetric
          label="Found this week"
          value={savings.savingsFoundThisWeekCents}
          detail={`${formatCopilotMoney(savings.savingsCapturedThisWeekCents)} captured; estimated until verified`}
          tone="emerald"
        />
        <SavingsMetric
          label="Found this month"
          value={savings.savingsFoundThisMonthCents}
          detail={`${formatCopilotMoney(savings.savingsCapturedThisMonthCents)} captured from approved records`}
          tone="cyan"
        />
        <SavingsMetric
          label="Since enrolling"
          value={savings.totalSinceEnrollmentCents}
          detail={`${formatCopilotMoney(savings.savingsCapturedCents)} captured total; rest identified`}
          tone="white"
        />
        <SavingsMetric
          label="Ready for review"
          value={savings.savingsPendingApprovalCents}
          detail="Queue owner approval before spend or vendor changes"
          tone="amber"
        />
      </div>
      <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm leading-6 text-neutral-300">
        <span className="font-bold text-white">Source labels: </span>
        Verified means invoice, supplier quote, or account price data. Observed means public or benchmark reference data.
        Estimated means planning math that needs review before it becomes an owner decision.
      </div>
    </section>
  );
}

function checkoutMethodLabel(method: SupplierCheckoutOption["checkoutMethod"]) {
  if (method === "api_ready_reference") return "Supplier API-ready reference";
  if (method === "b2b_portal_redirect") return "B2B portal review";
  if (method === "punchout_ready") return "Punchout-ready supplier";
  if (method === "quote_request") return "Quote request needed";
  return "Supplier checkout redirect";
}

function DoNowCard({
  action,
  issue,
}: {
  action: OwnerRecommendedAction | null;
  issue: OwnerOperationalIssue | null;
}) {
  const title = issue?.title ?? action?.title ?? "No urgent action right now";
  const detail =
    issue?.detail ??
    action?.detail ??
    "Supplify is not showing a supply, delivery, or savings issue that needs the owner right now.";
  const actionConfig = issue
    ? {
        label: issue.actionLabel,
        actionType: issue.actionType,
        payload: issue.payload,
      }
    : action
      ? {
          label: action.actionLabel,
          href: action.href,
          actionType: action.actionType,
          payload: action.payload,
        }
      : null;

  return (
    <DecisionCard
      icon={AlertTriangle}
      eyebrow="Do Now"
      title={title}
      detail={detail}
      tone={issue && issue.severity !== "Low" ? "amber" : "neutral"}
    >
      {actionConfig ? (
        <OwnerSavingsActionButtons compact actions={[actionConfig]} />
      ) : (
        <Pill>Nothing urgent</Pill>
      )}
    </DecisionCard>
  );
}

function ApproveSavingsCard({
  opportunity,
  ownerOs,
  pendingApprovalCount,
  topOpportunity,
}: {
  opportunity: OwnerSavingsOpportunity | null;
  ownerOs: OwnerProcurementOs;
  pendingApprovalCount: number;
  topOpportunity: OwnerSavingsOpportunity | null;
}) {
  if (!opportunity) {
    return (
      <DecisionCard
        icon={CheckCircle2}
        eyebrow="Owner Approval"
        title="No urgent savings approval"
        detail={
          topOpportunity
            ? "A savings signal is available in the review layer, but it is not being treated as an urgent owner decision until approval data is ready."
            : "Add invoices, supplier quotes, or delivery data and Supplify will keep looking for approval-ready savings. Nothing changes vendors or spend without approval."
        }
        tone="neutral"
      >
        <div className="flex flex-wrap gap-2">
          <Pill>{pendingApprovalCount} pending approvals</Pill>
          <Pill>{formatCopilotMoney(ownerOs.savingsSnapshot.estimatedMonthlySavingsCents)} monthly opportunity</Pill>
        </div>
      </DecisionCard>
    );
  }

  return (
    <DecisionCard
      icon={CheckCircle2}
      eyebrow="Approve Savings"
      title={opportunity.title}
      detail={opportunity.detail}
      tone="emerald"
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <Pill>{formatCopilotMoney(opportunity.projectedSavingsCents)}/mo</Pill>
        <QualityPill quality={opportunity.sourceQuality}>{opportunity.sourceQualityLabel}</QualityPill>
        <Pill>Updated {ownerOs.savingsSnapshot.lastUpdatedLabel}</Pill>
        <Pill>{opportunity.difficulty}</Pill>
        <Pill>{opportunity.confidence} confidence</Pill>
      </div>
      <OwnerSavingsActionButtons
        compact
        actions={[
          {
            label: opportunity.actionLabel,
            actionType: opportunity.actionType,
            payload: opportunity.payload,
          },
        ]}
      />
    </DecisionCard>
  );
}

function DeliveryCard({
  delivery,
  preparedDelivery,
}: {
  delivery: OwnerDelivery | null;
  preparedDelivery: OwnerDelivery | null;
}) {
  if (!delivery) {
    return (
      <DecisionCard
        icon={Truck}
        eyebrow="Delivery Watch"
        title="No delivery issue is waiting"
        detail={
          preparedDelivery
            ? `${preparedDelivery.supplierName} has a prepared delivery option in review. This is not a live shipment or supplier order.`
            : "When an order is delayed, partial, missing, or ready to receive, it will appear here first."
        }
        tone="neutral"
      >
        <div className="flex flex-wrap gap-2">
          <Pill>Delivery watch active</Pill>
          {preparedDelivery ? <Pill>{preparedDelivery.etaLabel}</Pill> : null}
        </div>
      </DecisionCard>
    );
  }

  return (
    <DecisionCard
      icon={Truck}
      eyebrow="Delivery Watch"
      title={`${delivery.supplierName}: ${delivery.status}`}
      detail={`${delivery.itemSummary}. ETA: ${delivery.etaLabel}. Missing: ${delivery.missingItemsLabel}. Receiving stays human-confirmed before any follow-up action.`}
      tone={delivery.status === "Delayed" || delivery.status === "Partial" ? "amber" : "cyan"}
    >
      <OwnerSavingsActionButtons
        compact
        actions={[
          {
            label: delivery.actionLabel,
            actionType: delivery.actionType,
            payload: delivery.payload,
          },
        ]}
      />
    </DecisionCard>
  );
}

function DecisionCard({
  children,
  detail,
  eyebrow,
  icon: Icon,
  title,
  tone,
}: {
  children: React.ReactNode;
  detail: string;
  eyebrow: string;
  icon: typeof AlertTriangle;
  title: string;
  tone: "amber" | "cyan" | "emerald" | "neutral";
}) {
  const toneClass = {
    amber: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
    emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    neutral: "border-white/10 bg-neutral-900 text-neutral-100",
  }[tone];

  return (
    <article className={`rounded-lg border p-5 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" aria-hidden="true" />
        <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{eyebrow}</p>
      </div>
      <h3 className="mt-4 text-2xl font-black text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-neutral-200">{detail}</p>
      <div className="mt-5">{children}</div>
    </article>
  );
}

function SavingsMetric({
  detail,
  label,
  tone,
  value,
}: {
  detail: string;
  label: string;
  tone: "amber" | "cyan" | "emerald" | "white";
  value: number;
}) {
  const toneClass = {
    amber: "border-amber-300/25 bg-amber-300/10",
    cyan: "border-cyan-300/25 bg-cyan-300/10",
    emerald: "border-emerald-300/25 bg-emerald-300/10",
    white: "border-white/15 bg-white/[0.05]",
  }[tone];

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-400">{label}</p>
      <p className="mt-3 text-4xl font-black text-white">{formatCopilotMoney(value)}</p>
      <p className="mt-2 text-sm font-bold text-neutral-300">{detail}</p>
    </div>
  );
}

function RadarMetric({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: "amber" | "cyan" | "emerald" | "white";
  value: string;
}) {
  const toneClass = {
    amber: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
    emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    white: "border-white/15 bg-white/[0.05] text-white",
  }[tone];

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <p className="text-xs font-black uppercase tracking-[0.14em] opacity-80">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-neutral-300">{detail}</p>
    </div>
  );
}

function GuardrailCard({
  detail,
  title,
  value,
}: {
  detail: string;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-neutral-500">
        {title}
      </p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-neutral-400">{detail}</p>
    </div>
  );
}

function WatchItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-cyan-200" aria-hidden="true" />
        <p className="text-xs font-black uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      </div>
      <p className="mt-2 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-neutral-100">
      {children}
    </span>
  );
}

function QualityPill({
  children,
  quality,
}: {
  children: React.ReactNode;
  quality: OwnerSavingsOpportunity["sourceQuality"];
}) {
  const className =
    quality === "verified"
      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
      : quality === "observed"
        ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
        : "border-amber-300/25 bg-amber-300/10 text-amber-100";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] ${className}`}>
      {children}
    </span>
  );
}
