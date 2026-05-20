"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock3,
  DollarSign,
  Loader2,
  PackageCheck,
  PackageSearch,
  PauseCircle,
  ShieldCheck,
  ShoppingCart,
  Siren,
  Sparkles,
  Truck,
  XCircle,
} from "lucide-react";
import type {
  CopilotDisplayTone,
  CopilotSnapshot,
  SmartBuyRecommendation,
} from "@/lib/operations-copilot/types";

type Mode = "owner" | "operations";
type SmartBuyAction = "approve_order" | "edit_order" | "snooze" | "reject" | "ask_ai_why";

const toneStyles: Record<CopilotDisplayTone, string> = {
  green: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  amber: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  red: "border-rose-300/25 bg-rose-300/10 text-rose-100",
  blue: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  neutral: "border-white/10 bg-white/[0.03] text-neutral-200",
};

export function CostReductionCommandCenter({
  snapshot,
}: {
  snapshot: CopilotSnapshot;
}) {
  const [mode, setMode] = useState<Mode>("owner");

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-white/10 bg-neutral-950 p-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("owner")}
            className={
              mode === "owner"
                ? "rounded-md bg-emerald-300 px-4 py-3 text-sm font-black text-neutral-950"
                : "rounded-md px-4 py-3 text-sm font-bold text-neutral-300 hover:bg-white/10"
            }
          >
            Owner Mode
          </button>
          <button
            type="button"
            onClick={() => setMode("operations")}
            className={
              mode === "operations"
                ? "rounded-md bg-cyan-300 px-4 py-3 text-sm font-black text-neutral-950"
                : "rounded-md px-4 py-3 text-sm font-bold text-neutral-300 hover:bg-white/10"
            }
          >
            Operations Mode
          </button>
        </div>
      </div>

      {mode === "owner" ? (
        <OwnerMode snapshot={snapshot} />
      ) : (
        <OperationsMode snapshot={snapshot} />
      )}
    </section>
  );
}

function OwnerMode({ snapshot }: { snapshot: CopilotSnapshot }) {
  const topBuy = snapshot.smartBuys[0] ?? null;

  return (
    <div className="space-y-5">
      <AiExecutiveAssistant snapshot={snapshot} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.healthCards.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            className={`rounded-lg border p-4 transition hover:-translate-y-0.5 hover:bg-white/10 ${toneStyles[card.tone]}`}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] opacity-75">
              {card.label}
            </p>
            <p className="mt-3 text-2xl font-black text-white">{card.value}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-300">{card.detail}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <SmartBuyPanel buy={topBuy} />
        <ActionCenter snapshot={snapshot} />
      </section>

      <section id="savings-feed" className="rounded-lg border border-white/10 bg-neutral-900 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-emerald-300" aria-hidden="true" />
          <h2 className="text-xl font-black text-white">Savings Feed</h2>
        </div>
        <p className="mt-1 text-sm leading-6 text-neutral-400">
          Wins and opportunities in plain English. Estimates stay estimates until quotes, invoices, or supplier data are verified.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {snapshot.savingsFeed.length > 0 ? (
            snapshot.savingsFeed.map((event) => (
              <div key={event.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{event.title}</p>
                    <p className="mt-2 text-sm leading-6 text-neutral-400">{event.detail}</p>
                  </div>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs font-bold text-emerald-100">
                    {formatMoney(event.impactCents)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <EmptyState text="No savings events yet. Import supplier quotes or use demo data to activate the feed." />
          )}
        </div>
      </section>
    </div>
  );
}

function AiExecutiveAssistant({ snapshot }: { snapshot: CopilotSnapshot }) {
  return (
    <section className="rounded-lg border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.2),_transparent_32%),#111111] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-4xl">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-emerald-300" aria-hidden="true" />
            <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
              AI Executive Assistant
            </p>
          </div>
          <h2 className="mt-3 text-2xl font-black text-white md:text-3xl">
            What needs attention today
          </h2>
          <p className="mt-3 text-base leading-7 text-neutral-200">
            {snapshot.aiExecutiveSummary}
          </p>
        </div>
        <div className="grid min-w-full gap-2 sm:grid-cols-3 lg:min-w-[420px]">
          <MiniExecutiveMetric label="Savings" value={formatMoney(snapshot.weeklyReport.totalSavingsFoundCents)} />
          <MiniExecutiveMetric label="Approvals" value={String(snapshot.pendingApprovalCount)} />
          <MiniExecutiveMetric label="Supply risks" value={String(snapshot.atRiskInventoryCount)} />
        </div>
      </div>
    </section>
  );
}

function SmartBuyPanel({ buy }: { buy: SmartBuyRecommendation | null }) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<SmartBuyAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);

  async function createAction(action: Exclude<SmartBuyAction, "ask_ai_why">) {
    if (!buy) return;
    setLoadingAction(action);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/operations-copilot/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: `smart_buy_${action}`,
          title: `${actionLabel(action)}: ${buy.itemName}`,
          payload: {
            source: "ai_cost_reduction_command_center",
            smartBuyId: buy.id,
            itemName: buy.itemName,
            currentVendor: buy.currentVendor,
            bestVendor: buy.bestVendor,
            quantityRecommended: buy.quantityRecommended,
            estimatedSavingsCents: buy.estimatedSavingsCents,
            liveOrderingEnabled: false,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Action could not be created.");
      setMessage(`${actionLabel(action)} saved as an approval-ready action. No live order was placed.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action could not be created.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <section id="smart-buy" className="rounded-lg border border-white/10 bg-neutral-900 p-5">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-emerald-300" aria-hidden="true" />
        <h2 className="text-xl font-black text-white">One-Click Smart Buy</h2>
      </div>
      <p className="mt-1 text-sm leading-6 text-neutral-400">
        Approval-ready purchasing help. External supplier ordering remains pending integration.
      </p>

      {buy ? (
        <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">
                Recommended Order
              </p>
              <h3 className="mt-2 text-2xl font-black text-white">{buy.itemName}</h3>
              <p className="mt-2 text-sm leading-6 text-emerald-50/90">{buy.explanation}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold uppercase text-white">
              {buy.riskLevel} risk
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniMetric label="Current vendor" value={buy.currentVendor} detail={formatMoney(buy.currentPriceCents)} />
            <MiniMetric label="Best vendor" value={buy.bestVendor} detail={formatMoney(buy.betterPriceCents)} />
            <MiniMetric label="Qty" value={String(buy.quantityRecommended)} detail={buy.deliveryTiming} />
            <MiniMetric label="Est. savings" value={formatMoney(buy.estimatedSavingsCents)} detail="Per smart buy" />
          </div>

          <p className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm leading-6 text-neutral-100">
            {buy.inventoryImpact}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <SmartActionButton
              label="Approve Order"
              icon={CheckCircle2}
              loading={loadingAction === "approve_order"}
              onClick={() => createAction("approve_order")}
              primary
            />
            <SmartActionButton
              label="Edit Order"
              icon={PackageSearch}
              loading={loadingAction === "edit_order"}
              onClick={() => createAction("edit_order")}
            />
            <SmartActionButton
              label="Snooze"
              icon={Clock3}
              loading={loadingAction === "snooze"}
              onClick={() => createAction("snooze")}
            />
            <SmartActionButton
              label="Reject"
              icon={XCircle}
              loading={loadingAction === "reject"}
              onClick={() => createAction("reject")}
            />
            <SmartActionButton
              label="Ask AI Why"
              icon={Brain}
              loading={false}
              onClick={() => setWhyOpen((value) => !value)}
            />
          </div>

          {whyOpen ? (
            <p className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm leading-6 text-cyan-50">
              This recommendation compares loaded landed cost, quantity needed to get closer to target stock,
              supplier lead time, and estimated inventory risk. It is safe to approve because it creates an internal
              approval record only.
            </p>
          ) : null}
          {message ? <p className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">{message}</p> : null}
          {error ? <p className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</p> : null}
        </div>
      ) : (
        <EmptyState text="No Smart Buy is ready yet. Add inventory, supplier quotes, or load demo data to generate approval-ready orders." />
      )}
    </section>
  );
}

function ActionCenter({ snapshot }: { snapshot: CopilotSnapshot }) {
  const topActions = useMemo(() => {
    const smartBuy = snapshot.smartBuys[0]
      ? [`Approve or edit Smart Buy: ${snapshot.smartBuys[0].itemName}`]
      : [];
    return [
      ...smartBuy,
      ...snapshot.riskAlerts.slice(0, 4).map((risk) => risk.recommendedAction),
    ].slice(0, 5);
  }, [snapshot.riskAlerts, snapshot.smartBuys]);

  return (
    <section id="action-center" className="rounded-lg border border-white/10 bg-neutral-900 p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-cyan-300" aria-hidden="true" />
        <h2 className="text-xl font-black text-white">Action Center</h2>
      </div>
      <p className="mt-1 text-sm leading-6 text-neutral-400">
        Only decisions that need owner attention. No raw procurement noise.
      </p>
      <div className="mt-4 space-y-3">
        {topActions.map((action) => (
          <div key={action} className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-sm font-semibold text-white">{action}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/operations-copilot/approvals" className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-bold text-neutral-950 hover:bg-cyan-200">
          Review Approvals
        </Link>
        <Link href="/operations-copilot/delivery" className="rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/10">
          View Best Prices
        </Link>
      </div>
    </section>
  );
}

function OperationsMode({ snapshot }: { snapshot: CopilotSnapshot }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <InventoryForecastPanel snapshot={snapshot} />
        <WeeklyReportPanel snapshot={snapshot} />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <VendorScorecards snapshot={snapshot} />
        <RiskAndEmergencyPanel snapshot={snapshot} />
      </section>
      <BusinessMemoryPanel snapshot={snapshot} />
    </div>
  );
}

function InventoryForecastPanel({ snapshot }: { snapshot: CopilotSnapshot }) {
  return (
    <section id="inventory-risk" className="rounded-lg border border-white/10 bg-neutral-900 p-5">
      <div className="flex items-center gap-2">
        <PackageCheck className="h-5 w-5 text-cyan-300" aria-hidden="true" />
        <h2 className="text-xl font-black text-white">Predictive Inventory Intelligence</h2>
      </div>
      <div className="mt-4 grid gap-3">
        {snapshot.inventoryForecasts.slice(0, 6).map((item) => (
          <div key={item.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-bold text-white">{item.itemName}</p>
                <p className="mt-1 text-sm text-neutral-400">{item.reorderRecommendation}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold uppercase text-neutral-200">
                {item.daysUntilStockout === null ? "Need data" : `${item.daysUntilStockout} days`}
              </span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Usage: {item.usageVelocity} / Confidence: {item.confidence} / Risk: {item.riskLevel}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WeeklyReportPanel({ snapshot }: { snapshot: CopilotSnapshot }) {
  const report = snapshot.weeklyReport;
  return (
    <section className="rounded-lg border border-white/10 bg-neutral-900 p-5">
      <div className="flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-emerald-300" aria-hidden="true" />
        <h2 className="text-xl font-black text-white">Weekly AI Report</h2>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniMetric label="Savings found" value={formatMoney(report.totalSavingsFoundCents)} detail="Open signals" />
        <MiniMetric label="Savings approved" value={formatMoney(report.totalSavingsApprovedCents)} detail="Approved actions" />
        <MiniMetric label="Biggest leak" value={report.biggestCostLeak} detail="Highest impact signal" />
        <MiniMetric label="Items at risk" value={String(report.itemsAtRisk)} detail="Need attention" />
      </div>
      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="text-sm font-bold text-white">Next week&apos;s focus</p>
        <p className="mt-1 text-sm leading-6 text-neutral-400">{report.nextWeekFocus}</p>
      </div>
    </section>
  );
}

function VendorScorecards({ snapshot }: { snapshot: CopilotSnapshot }) {
  return (
    <section id="vendor-watch" className="rounded-lg border border-white/10 bg-neutral-900 p-5">
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5 text-cyan-300" aria-hidden="true" />
        <h2 className="text-xl font-black text-white">Vendor Scorecards</h2>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {snapshot.vendorScorecards.map((vendor) => (
          <div key={vendor.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-white">{vendor.supplierName}</p>
                <p className="mt-1 text-xs text-neutral-500">{vendor.itemsPurchased} tracked items</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-neutral-200">
                Risk {vendor.riskScore}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniMetric label="Reliability" value={`${vendor.reliabilityScore}/100`} detail={vendor.deliveryIssueRisk} />
              <MiniMetric label="Spend tracked" value={formatMoney(vendor.totalTrackedSpendCents)} detail={vendor.priceTrend} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RiskAndEmergencyPanel({ snapshot }: { snapshot: CopilotSnapshot }) {
  return (
    <section id="risk-detection" className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-neutral-900 p-5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-300" aria-hidden="true" />
          <h2 className="text-xl font-black text-white">Risk Detection</h2>
        </div>
        <div className="mt-4 space-y-3">
          {snapshot.riskAlerts.map((risk) => (
            <div key={risk.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold text-white">{risk.title}</p>
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-xs font-bold uppercase text-amber-100">
                  {risk.severity}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-neutral-400">{risk.detail}</p>
              <p className="mt-2 text-sm font-semibold text-cyan-100">{risk.recommendedAction}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-rose-300/20 bg-rose-300/10 p-5">
        <div className="flex items-center gap-2">
          <Siren className="h-5 w-5 text-rose-200" aria-hidden="true" />
          <h2 className="text-xl font-black text-white">Emergency Mode</h2>
        </div>
        <div className="mt-4 space-y-3">
          {snapshot.emergencyItems.length > 0 ? (
            snapshot.emergencyItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="font-bold text-white">{item.itemName}</p>
                <p className="mt-1 text-sm text-rose-50/80">{item.shortageReason}</p>
                <p className="mt-2 text-sm text-neutral-300">
                  Backup: {item.backupVendor} / {item.fastestOption} / {formatMoney(item.estimatedCostCents)}
                </p>
              </div>
            ))
          ) : (
            <EmptyState text="No emergency supply risk from loaded data." />
          )}
        </div>
      </div>
    </section>
  );
}

function BusinessMemoryPanel({ snapshot }: { snapshot: CopilotSnapshot }) {
  const memory = snapshot.businessMemory;
  return (
    <section className="rounded-lg border border-white/10 bg-neutral-900 p-5">
      <div className="flex items-center gap-2">
        <PauseCircle className="h-5 w-5 text-cyan-300" aria-hidden="true" />
        <h2 className="text-xl font-black text-white">Business Memory + Pricing Support</h2>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="Preferred vendors" value={memory.preferredVendors.length ? memory.preferredVendors.join(", ") : "Add vendors"} detail="Buying memory" />
        <MiniMetric label="Preferred brands" value={memory.preferredBrands.length ? memory.preferredBrands.join(", ") : "Add brands"} detail="Substitution rules" />
        <MiniMetric label="Approval threshold" value={formatMoney(memory.approvalThresholdCents)} detail="Manual approval stays active" />
        <MiniMetric label="Founder pricing" value="Supported" detail="Billing change not activated here" />
      </div>
      <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-6 text-amber-50">
        Founder rate, early adopter pricing, savings-share, pilot mode, and manual admin override are UI-supported.
        No billing change is activated from this dashboard unless the existing payment system is wired and approved.
      </p>
    </section>
  );
}

function SmartActionButton({
  icon: Icon,
  label,
  loading,
  onClick,
  primary,
}: {
  icon: typeof CheckCircle2;
  label: string;
  loading: boolean;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={
        primary
          ? "inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-black text-neutral-950 hover:bg-neutral-100 disabled:opacity-60"
          : "inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60"
      }
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {loading ? "Saving..." : label}
    </button>
  );
}

function MiniExecutiveMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-400">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-950/60 p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
      <p className="mt-1 truncate text-xs text-neutral-500">{detail}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-5 text-sm text-neutral-400">
      {text}
    </div>
  );
}

function actionLabel(action: Exclude<SmartBuyAction, "ask_ai_why">) {
  if (action === "approve_order") return "Approve Order";
  if (action === "edit_order") return "Edit Order";
  if (action === "snooze") return "Snooze";
  return "Reject Recommendation";
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
