import Link from "next/link";
import {
  AlertTriangle,
  ClipboardCheck,
  Clock3,
  DollarSign,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ProcurementRecommendationActions } from "@/components/operations-copilot/procurement-recommendation-actions";
import type {
  BestPriceDeliveryBoard,
  BestPriceDeliveryRecommendation,
  RecommendationUrgency,
} from "@/lib/operations-copilot/delivery-intelligence";
import type { IndustryPriceCatalog } from "@/lib/operations-copilot/industry-catalog";

export function BestPriceDeliveryDashboard({
  activeIndustryId,
  board,
  catalogs,
}: {
  activeIndustryId: IndustryPriceCatalog["id"];
  board: BestPriceDeliveryBoard;
  catalogs: IndustryPriceCatalog[];
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_34%),#111111] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Delivered-Cost Intelligence
            </p>
            <h1 className="mt-3 max-w-4xl text-3xl font-bold text-white md:text-4xl">
              Margin-protecting delivery decisions
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-neutral-300">
              Supplify compares the normal spend baseline against the best available
              supplier option, delivery cost, estimated arrival, and approval path.
              The owner sees the decision, not the spreadsheet.
            </p>
            <p className="mt-2 text-sm font-semibold text-neutral-400">
              Data as of {formatDateTime(board.asOfDate)}. Supplier prices remain snapshots, benchmarks, or estimates until verified.
            </p>
            <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-50">
              Recommended next step: {board.recommendedNextStep}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4 lg:min-w-[520px]">
            <Metric label="Est. monthly savings" value={formatMoney(board.totalMonthlySavingsCents)} />
            <Metric label="Top opportunity" value={formatMoney(board.topSavingsCents)} />
            <Metric label="Delivered options" value={String(board.deliveryReadyCount)} />
            <Metric label="Needs review" value={String(board.needsReviewCount)} />
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {catalogs.map((catalog) => (
          <Link
            key={catalog.id}
            href={`/operations-copilot/delivery?industry=${catalog.id}`}
            className={
              activeIndustryId === catalog.id
                ? "rounded-lg bg-emerald-300 px-4 py-2 text-sm font-bold text-neutral-950"
                : "rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
            }
          >
            {catalog.label}
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <BusinessDeliveryProfileCard board={board} />
        <RecommendationSummary board={board} />
      </section>

      <section className="grid gap-4">
        {board.recommendations.length > 0 ? (
          board.recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
              updatedAt={board.asOfDate}
            />
          ))
        ) : (
          <div className="rounded-lg border border-white/10 bg-neutral-900 p-6 text-neutral-300">
            No recommendations yet. Load demo data, import invoices, or add supplier
            price snapshots to generate best delivered options.
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <ConnectorControlPanel board={board} />
        <WorkflowAndAlerts board={board} />
      </section>

      <section className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
          <div>
            <p className="font-bold">Safe profitability mode</p>
            <ul className="mt-2 grid gap-1">
              {board.dataNotices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function BusinessDeliveryProfileCard({ board }: { board: BestPriceDeliveryBoard }) {
  const profile = board.businessProfile;

  return (
    <section className="rounded-lg border border-white/10 bg-neutral-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Business Delivery Profile
          </p>
          <h2 className="mt-2 text-xl font-bold text-white">{profile.businessName}</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-bold text-white">
          {profile.profileCompleteness}% complete
        </div>
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Info label="Address" value={profile.businessAddress} />
        <Info label="Receiving contact" value={profile.receivingContact} />
        <Info label="Receiving location" value={formatLabel(profile.receivingLocation)} />
        <Info label="Delivery preference" value={formatLabel(profile.deliveryPreference)} />
        <Info
          label="Preferred windows"
          value={profile.preferredDeliveryWindows.join(", ")}
        />
        <Info
          label="Pickup radius"
          value={`${profile.localPickupRadiusMiles} miles`}
        />
        <Info label="Tax exempt" value={formatLabel(profile.taxExemptStatus)} />
        <Info
          label="Preferred suppliers"
          value={
            profile.preferredSuppliers.length > 0
              ? profile.preferredSuppliers.join(", ")
              : "None pinned yet"
          }
        />
      </div>
      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-neutral-300">
        <span className="font-semibold text-white">Delivery instructions: </span>
        {profile.deliveryInstructions}
      </div>
      {profile.missingFields.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
          Missing: {profile.missingFields.join(", ")}. Add these before relying on
          delivery ETA or courier estimates.
        </div>
      ) : null}
    </section>
  );
}

function RecommendationSummary({ board }: { board: BestPriceDeliveryBoard }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <SummaryCard
        icon={DollarSign}
        label="Potential Savings"
        value={formatMoney(board.totalMonthlySavingsCents)}
        detail="Estimated monthly savings from the top supplier and delivered-cost recommendations."
      />
      <SummaryCard
        icon={Truck}
        label="Delivery Ready"
        value={String(board.deliveryReadyCount)}
        detail="Recommendations that have delivery, pickup, or supplier-truck options."
      />
      <SummaryCard
        icon={ClipboardCheck}
        label="Pending Approvals"
        value={String(board.pendingApprovalCount)}
        detail="Safe approval requests waiting in the existing Operations Copilot queue."
      />
      <SummaryCard
        icon={PackageCheck}
        label="Tracked Items"
        value={String(board.recommendationCount)}
        detail={`${board.industryLabel} items ranked for ${board.region} / ZIP ${board.zipCode}.`}
      />
    </section>
  );
}

function RecommendationCard({
  recommendation,
  updatedAt,
}: {
  recommendation: BestPriceDeliveryRecommendation;
  updatedAt: Date;
}) {
  const urgencyClass = urgencyStyles[recommendation.urgency];

  return (
    <article className="rounded-lg border border-white/10 bg-neutral-900 p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-1 text-xs font-bold uppercase tracking-[0.14em] ${urgencyClass}`}>
              {recommendation.urgency} urgency
            </span>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs font-bold uppercase tracking-[0.14em] text-cyan-100">
              {recommendation.deliveryLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold uppercase tracking-[0.14em] text-neutral-200">
              {formatLabel(recommendation.status)}
            </span>
            <DataQualityBadge quality={recommendation.savingsAudit.dataQuality} />
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold uppercase tracking-[0.14em] text-neutral-200">
              Updated {formatDateTime(updatedAt)}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-bold text-white">{recommendation.title}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-300">
            {recommendation.explanation}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniMetric
              label="Supplier"
              value={recommendation.supplierName}
              detail={`${recommendation.supplierReliabilityScore}/100 reliability`}
            />
            <MiniMetric
              label="Total delivered"
              value={formatMoney(
                recommendation.savingsAudit.recommendedTotalDeliveredCostCents
              )}
              detail={`ETA ${recommendation.estimatedDeliveryDateLabel}`}
            />
            <MiniMetric
              label="Savings/order"
              value={formatMoney(recommendation.savingsAudit.savingsPerOrderCents)}
              detail={`Qty ${recommendation.savingsAudit.orderQuantity} ${recommendation.unit}`}
            />
            <MiniMetric
              label="Monthly savings"
              value={formatMoney(
                recommendation.savingsAudit.monthlyEstimatedSavingsCents
              )}
              detail={`${recommendation.itemMatchConfidence} match confidence`}
            />
          </div>
        </div>
        <div className="w-full rounded-lg border border-white/10 bg-black/20 p-4 xl:max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Recommended action
          </p>
          <p className="mt-2 text-sm leading-6 text-white">
            {recommendation.recommendedAction}
          </p>
          {recommendation.searchUrl ? (
            <a
              href={recommendation.searchUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-sm font-bold text-cyan-200 hover:text-cyan-100"
            >
              Open supplier reference search
            </a>
          ) : null}
        </div>
      </div>
      <div className="mt-5 border-t border-white/10 pt-4">
        <ProcurementRecommendationActions recommendation={recommendation} />
      </div>
    </article>
  );
}

function ConnectorControlPanel({ board }: { board: BestPriceDeliveryBoard }) {
  return (
    <section className="rounded-lg border border-white/10 bg-neutral-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Supplier + Delivery Source Architecture
          </p>
          <h2 className="mt-2 text-xl font-bold text-white">
            Connectors ready for quotes, CSVs, and APIs
          </h2>
        </div>
        <MapPin className="h-5 w-5 text-cyan-300" aria-hidden="true" />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {board.connectorControlPanel.slice(0, 10).map((connector) => (
          <article
            key={connector.supplierName}
            className="rounded-lg border border-white/10 bg-black/20 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{connector.supplierName}</h3>
                <p className="mt-1 text-xs text-neutral-400">
                  {connector.itemCount} items / {connector.status}
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-neutral-200">
                {connector.confidenceScore}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-neutral-500">
              {connector.lastCheckedLabel}. Live ordering disabled.
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function WorkflowAndAlerts({ board }: { board: BestPriceDeliveryBoard }) {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-neutral-900 p-5">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          <h2 className="font-bold text-white">Done-for-you workflow</h2>
        </div>
        <div className="mt-4 space-y-2">
          {board.workflowStatuses.map((item) => (
            <div key={item.status} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-neutral-400">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-neutral-900 p-5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-300" aria-hidden="true" />
          <h2 className="font-bold text-white">Alerts and notification hooks</h2>
        </div>
        <div className="mt-4 space-y-2">
          {board.notificationHooks.map((hook) => (
            <div key={hook.label} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{hook.label}</p>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs uppercase text-neutral-300">
                  {hook.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-neutral-400">
                {hook.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-900 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-emerald-300" aria-hidden={true} />
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
          {label}
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold text-white">{value}</div>
      <div className="mt-2 text-xs leading-5 text-neutral-400">{detail}</div>
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
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      <p className="mt-1 truncate font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{detail}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-950/70 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      <p className="mt-1 text-white">{value}</p>
    </div>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function DataQualityBadge({
  quality,
}: {
  quality: BestPriceDeliveryRecommendation["savingsAudit"]["dataQuality"];
}) {
  const label =
    quality === "verified" ? "Verified" : quality === "benchmark" ? "Observed" : "Estimated";
  const className =
    quality === "verified"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
      : quality === "benchmark"
        ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
        : "border-amber-300/30 bg-amber-300/10 text-amber-100";

  return (
    <span className={`rounded-full border px-2 py-1 text-xs font-bold uppercase tracking-[0.14em] ${className}`}>
      {label}
    </span>
  );
}

const urgencyStyles: Record<RecommendationUrgency, string> = {
  high: "border-red-300/40 bg-red-400/10 text-red-100",
  medium: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  low: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
};
