import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  PackageSearch,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { IndustryPriceCatalog } from "@/lib/operations-copilot/industry-catalog";
import type {
  SupplyOpportunityBoard,
  SupplyOpportunityRow,
} from "@/lib/operations-copilot/supply-opportunities";

export function SuppliesOpportunityTable({
  activeIndustryId,
  board,
  catalogs,
}: {
  activeIndustryId: IndustryPriceCatalog["id"];
  board: SupplyOpportunityBoard;
  catalogs: IndustryPriceCatalog[];
}) {
  const totals = buildTotals(board.rows);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Supplify Spend Map
        </p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="max-w-4xl text-3xl font-bold text-white">
              Best price today vs. your margin baseline
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-300">
              {board.industryLabel} operating inputs are ranked by the clearest
              profit-protection opportunity: best available price today, your baseline,
              variance, and estimated savings. The goal is not more purchasing work.
              The goal is knowing where money is leaking.
            </p>
            <p className="mt-2 max-w-4xl text-xs uppercase tracking-[0.14em] text-neutral-500">
              {board.operatingModel}
            </p>
          </div>
          <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-100">
            {board.region} / ZIP {board.zipCode} / {formatDate(board.asOfDate)}
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {catalogs.map((catalog) => (
          <Link
            key={catalog.id}
            href={`/operations-copilot/supplies?industry=${catalog.id}`}
            className={
              activeIndustryId === catalog.id
                ? "rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-neutral-950"
                : "rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
            }
          >
            {catalog.label}
          </Link>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          icon={PackageSearch}
          label="Tracked Supplies"
          value={String(board.rowCount)}
          detail={`Common ${board.industryLabel.toLowerCase()} supplies and operating inputs`}
        />
        <MetricCard
          icon={TrendingDown}
          label="Under Baseline"
          value={String(board.underBaselineCount)}
          detail="Items with a buy-below-baseline opportunity"
        />
        <MetricCard
          icon={ArrowUpRight}
          label="Over Baseline"
          value={String(board.overBaselineCount)}
          detail="Items currently above the baseline"
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Savings Opportunity"
          value={formatMoney(board.totalSavingsOpportunityCents)}
          detail="Estimated weekly opportunity from mapped quantities"
        />
      </section>

      <section className="rounded-lg border border-white/10 bg-neutral-900 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Profitability watchlist</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Columns are arranged for fast owner clarity: item, best price today,
              baseline, over/under variance, and estimated savings opportunity.
            </p>
          </div>
          <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
            Baselines become exact after invoice/account import
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                <th className="border-b border-white/10 px-3 py-3">Supply</th>
                <th className="border-b border-white/10 px-3 py-3">Best today</th>
                <th className="border-b border-white/10 px-3 py-3">Margin baseline</th>
                <th className="border-b border-white/10 px-3 py-3">Over / under</th>
                <th className="border-b border-white/10 px-3 py-3">Savings opp.</th>
                <th className="border-b border-white/10 px-3 py-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row) => (
                <SupplyRow key={row.sku} row={row} />
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-cyan-300/10 text-sm font-bold text-white">
                <td className="border-t border-cyan-300/30 px-3 py-4">
                  Total estimated weekly margin impact
                </td>
                <td className="border-t border-cyan-300/30 px-3 py-4">
                  {formatMoney(totals.bestTodaySpendCents)}
                </td>
                <td className="border-t border-cyan-300/30 px-3 py-4">
                  {formatMoney(totals.baselineSpendCents)}
                </td>
                <td className="border-t border-cyan-300/30 px-3 py-4">
                  <span
                    className={
                      totals.netVarianceCents >= 0
                        ? "text-emerald-100"
                        : "text-rose-100"
                    }
                  >
                    {totals.netVarianceCents >= 0 ? "Under " : "Over "}
                    {formatMoney(Math.abs(totals.netVarianceCents))}
                  </span>
                </td>
                <td className="border-t border-cyan-300/30 px-3 py-4 text-emerald-100">
                  {formatMoney(totals.savingsOpportunityCents)}
                </td>
                <td className="border-t border-cyan-300/30 px-3 py-4 text-neutral-300">
                  {board.rowCount} supplies
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

function buildTotals(rows: SupplyOpportunityRow[]) {
  return rows.reduce(
    (totals, row) => {
      const bestSpend = row.bestTodayPriceCents * row.estimatedWeeklyQuantity;
      const baselineSpend = row.baselinePriceCents * row.estimatedWeeklyQuantity;

      return {
        bestTodaySpendCents: totals.bestTodaySpendCents + bestSpend,
        baselineSpendCents: totals.baselineSpendCents + baselineSpend,
        netVarianceCents: totals.netVarianceCents + baselineSpend - bestSpend,
        savingsOpportunityCents:
          totals.savingsOpportunityCents + row.savingsOpportunityCents,
      };
    },
    {
      bestTodaySpendCents: 0,
      baselineSpendCents: 0,
      netVarianceCents: 0,
      savingsOpportunityCents: 0,
    }
  );
}

function MetricCard({
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
        <Icon className="h-4 w-4 text-cyan-300" aria-hidden={true} />
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
          {label}
        </span>
      </div>
      <div className="mt-3 text-3xl font-bold text-white">{value}</div>
      <div className="mt-2 text-xs leading-5 text-neutral-400">{detail}</div>
    </div>
  );
}

function SupplyRow({ row }: { row: SupplyOpportunityRow }) {
  const positive = row.varianceCents > 0;
  const negative = row.varianceCents < 0;

  return (
    <tr className="text-neutral-300">
      <td className="border-b border-white/10 px-3 py-4 align-top">
        <div className="font-semibold text-white">{row.itemName}</div>
        <div className="mt-1 text-xs text-neutral-500">
          {row.category} / {row.sku} / {row.unit}
        </div>
      </td>
      <td className="border-b border-white/10 px-3 py-4 align-top">
        <div className="font-bold text-cyan-100">
          {formatMoney(row.bestTodayPriceCents)}
        </div>
        <div className="mt-1 text-xs text-neutral-500">{row.supplierName}</div>
      </td>
      <td className="border-b border-white/10 px-3 py-4 align-top">
        <div className="font-semibold text-white">
          {formatMoney(row.baselinePriceCents)}
        </div>
        <div className="mt-1 text-xs text-neutral-500">baseline per {row.unit}</div>
      </td>
      <td className="border-b border-white/10 px-3 py-4 align-top">
        <div
          className={
            positive
              ? "inline-flex items-center gap-1 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs font-bold text-emerald-100"
              : negative
                ? "inline-flex items-center gap-1 rounded-md border border-rose-300/20 bg-rose-300/10 px-2 py-1 text-xs font-bold text-rose-100"
                : "inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-neutral-200"
          }
        >
          {positive ? (
            <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
          ) : negative ? (
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          ) : null}
          {positive ? "Under" : negative ? "Over" : "In line"}{" "}
          {formatMoney(Math.abs(row.varianceCents))}
        </div>
      </td>
      <td className="border-b border-white/10 px-3 py-4 align-top">
        <div className="font-bold text-emerald-100">
          {formatMoney(row.savingsOpportunityCents)}
        </div>
        <div className="mt-1 text-xs text-neutral-500">
          qty {row.estimatedWeeklyQuantity}/week
        </div>
      </td>
      <td className="border-b border-white/10 px-3 py-4 align-top">
        <div className="text-sm font-semibold text-neutral-300">{row.sourceLabel}</div>
        <div className="mt-2 flex flex-wrap gap-1">
          <SourceQualityBadge quality={row.sourceQuality} label={row.sourceQualityLabel} />
          <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-neutral-300">
            {row.freshnessLabel}
          </span>
        </div>
        <div className="mt-2 text-xs text-neutral-500">
          confidence {row.confidence} / updated {row.lastUpdatedLabel}
        </div>
      </td>
    </tr>
  );
}

function SourceQualityBadge({
  label,
  quality,
}: {
  label: string;
  quality: SupplyOpportunityRow["sourceQuality"];
}) {
  const className =
    quality === "verified"
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
      : quality === "observed"
        ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
        : "border-amber-300/20 bg-amber-300/10 text-amber-100";

  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
