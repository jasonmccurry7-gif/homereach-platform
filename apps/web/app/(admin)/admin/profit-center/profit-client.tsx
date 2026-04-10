"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  ProfitRow,
  ProductPricingResult,
  PostageRate,
  VendorCostConfig,
  MarginTier,
} from "@/lib/pricing";
import type { DiscountTier } from "@/lib/pricing";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Summary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMargin: number;
  rowCount: number;
}

interface Props {
  campaignRows:     ProfitRow[];
  sharedRows:       ProfitRow[];
  productResults:   ProductPricingResult[];
  postageRate:      PostageRate;
  config:           VendorCostConfig;
  marginTiers:      MarginTier[];
  commitmentTiers:  DiscountTier[];
  summary:          Summary;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  live:   { label: "Live",   cls: "bg-green-900/50  text-green-300  border-green-800/40"  },
  cached: { label: "Cached", cls: "bg-blue-900/50   text-blue-300   border-blue-800/40"   },
  manual: { label: "Manual", cls: "bg-amber-900/50  text-amber-300  border-amber-800/40"  },
};

const PRODUCT_LABELS: Record<string, string> = {
  targeted_campaign: "Targeted Campaign",
  shared_postcard:   "Shared Postcard",
  postcard_4x6:      "Postcard 4×6",
  postcard_6x9:      "Postcard 6×9",
  postcard_6x11:     "Postcard 6×11",
  magnet:            "Refrigerator Magnet",
  yard_sign:         "Yard Sign",
  door_hanger:       "Door Hanger",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtK(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : fmt(n);
}

function marginColor(pct: number): string {
  if (pct >= 35) return "text-green-400";
  if (pct >= 20) return "text-yellow-400";
  if (pct >= 10) return "text-orange-400";
  return "text-red-400";
}

function SourceBadge({ source }: { source: string }) {
  const meta = SOURCE_BADGE[source] ?? SOURCE_BADGE.manual;
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", meta.cls)}>
      {meta.label}
    </span>
  );
}

function StatCard({
  label, value, sub, color = "default",
}: {
  label: string; value: string; sub?: string;
  color?: "green" | "blue" | "amber" | "red" | "default";
}) {
  const colorCls = {
    green:   "border-green-800/40  bg-green-900/20",
    blue:    "border-blue-800/40   bg-blue-900/20",
    amber:   "border-amber-800/40  bg-amber-900/20",
    red:     "border-red-800/40    bg-red-900/20",
    default: "border-gray-800      bg-gray-900",
  }[color];
  return (
    <div className={cn("rounded-2xl border p-5", colorCls)}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

type TabKey = "campaigns" | "shared" | "products";

export function ProfitClient({
  campaignRows,
  sharedRows,
  productResults,
  postageRate,
  config,
  marginTiers,
  commitmentTiers,
  summary,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("campaigns");

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: "campaigns", label: "Targeted Campaigns", count: campaignRows.length },
    { key: "shared",    label: "Shared Postcards",   count: sharedRows.length   },
    { key: "products",  label: "Product Reference",  count: productResults.length },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 bg-gray-900/60 backdrop-blur sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">💰 Profit Center</h1>
            <p className="text-xs text-gray-500">Internal only · Cost + margin breakdown for all products</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-amber-400 font-medium">🔒 Admin Only</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8 max-w-[1400px] mx-auto">

        {/* ── Profit Summary ─────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Revenue"
            value={fmtK(summary.totalRevenue)}
            sub={`${summary.rowCount} active products`}
            color="blue"
          />
          <StatCard
            label="Total Cost"
            value={fmtK(summary.totalCost)}
            sub="Print + postage"
            color="default"
          />
          <StatCard
            label="Gross Profit"
            value={fmtK(summary.totalProfit)}
            sub="Revenue minus cost"
            color="green"
          />
          <StatCard
            label="Avg Margin"
            value={`${summary.avgMargin}%`}
            sub="Across all products"
            color={summary.avgMargin >= 25 ? "green" : "amber"}
          />
        </section>

        {/* ── Pricing Source Status ──────────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Panel title="📮 Postage Source" sub="USPS EDDM rate in use">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-white">${postageRate.ratePerPiece.toFixed(3)}/piece</p>
                <p className="text-sm text-gray-400 mt-0.5">{postageRate.rateName}</p>
                <p className="text-xs text-gray-600 mt-1">
                  Last updated: {new Date(postageRate.fetchedAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
                  })}
                </p>
              </div>
              <SourceBadge source={postageRate.source} />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-500">
                At 2,500 homes: <span className="text-white font-medium">${(postageRate.ratePerPiece * 2500).toFixed(2)}</span>
                {" · "}
                5,000 homes: <span className="text-white font-medium">${(postageRate.ratePerPiece * 5000).toFixed(2)}</span>
                {" · "}
                10,000 homes: <span className="text-white font-medium">${(postageRate.ratePerPiece * 10000).toFixed(2)}</span>
              </p>
            </div>
          </Panel>

          <Panel title="🖨️ Print Source" sub="48HourPrint hybrid pricing">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-white">${config.printCostPerPiece.toFixed(3)}/piece</p>
                <p className="text-sm text-gray-400 mt-0.5">48HourPrint — 6×9 Postcard (default)</p>
                <p className="text-xs text-gray-600 mt-1">
                  Total cost: ${(config.printCostPerPiece + config.postageCostPerPiece).toFixed(3)}/piece
                </p>
              </div>
              <SourceBadge source="manual" />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-500">
                Default margin: <span className="text-white font-medium">{(config.defaultMarginRate * 100).toFixed(0)}%</span>
                {" · "}
                Floor: <span className="text-white font-medium">{(config.minimumMarginRate * 100).toFixed(0)}%</span>
                {" · "}
                Total cost/piece: <span className="text-white font-medium">${(config.printCostPerPiece + config.postageCostPerPiece).toFixed(3)}</span>
              </p>
            </div>
          </Panel>
        </section>

        {/* ── Margin Tier Reference ──────────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Panel title="📊 Campaign Margin Tiers" sub="Margin automatically applied by scale">
            <div className="space-y-2">
              {marginTiers.map((tier) => (
                <div key={tier.label} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="text-sm font-semibold text-white">{tier.label}</p>
                    <p className="text-xs text-gray-400">
                      {tier.minHouseholds.toLocaleString()}
                      {tier.maxHouseholds === Infinity ? "+" : `–${tier.maxHouseholds.toLocaleString()}`} homes
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-bold", marginColor(tier.marginRate * 100))}>
                      {(tier.marginRate * 100).toFixed(0)}% margin
                    </p>
                    <p className="text-xs text-gray-500">
                      ${((config.printCostPerPiece + config.postageCostPerPiece) * (1 + tier.marginRate)).toFixed(3)}/piece sell
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="📅 Commitment Discounts" sub="Applied after margin — floor enforced">
            <div className="space-y-2">
              {commitmentTiers.map((tier) => (
                <div key={tier.months} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="text-sm font-semibold text-white">{tier.label}</p>
                    <p className="text-xs text-gray-400">{tier.months} month{tier.months !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right">
                    {tier.discountRate > 0 ? (
                      <>
                        <p className="text-sm font-bold text-green-400">
                          −{(tier.discountRate * 100).toFixed(0)}%
                        </p>
                        <p className="text-xs text-gray-500">{tier.badgeLabel}</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">No discount</p>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-800">
                Minimum margin floor: 15% — discounts are capped to protect profitability
              </p>
            </div>
          </Panel>
        </section>

        {/* ── Campaign / Product Table ───────────────────────────────────── */}
        <section>
          {/* Tab Bar */}
          <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl w-fit mb-5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition",
                  activeTab === tab.key
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-white"
                )}
              >
                {tab.label}
                <span className="ml-2 text-xs text-gray-500">({tab.count})</span>
              </button>
            ))}
          </div>

          {/* Campaign + Shared Rows */}
          {(activeTab === "campaigns" || activeTab === "shared") && (
            <ProfitTable rows={activeTab === "campaigns" ? campaignRows : sharedRows} />
          )}

          {/* Product Reference Table */}
          {activeTab === "products" && (
            <ProductReferenceTable rows={productResults} />
          )}
        </section>

        {/* ── Admin Cost Config ──────────────────────────────────────────── */}
        <section>
          <Panel
            title="⚙️ Cost Configuration"
            sub="Current system defaults — editing via admin controls (coming soon)"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ConfigField label="Print Cost / Piece" value={`$${config.printCostPerPiece.toFixed(3)}`} note="48HourPrint 6×9" />
              <ConfigField label="Postage Cost / Piece" value={`$${config.postageCostPerPiece.toFixed(3)}`} note="USPS EDDM Retail" />
              <ConfigField label="Total Cost / Piece" value={`$${(config.printCostPerPiece + config.postageCostPerPiece).toFixed(3)}`} note="Print + postage" />
              <ConfigField label="Default Margin" value={`${(config.defaultMarginRate * 100).toFixed(0)}%`} note={`Floor: ${(config.minimumMarginRate * 100).toFixed(0)}%`} />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Last updated: {new Date(config.lastUpdated).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
              <button
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition opacity-60 cursor-not-allowed"
                disabled
                title="Editing coming soon — connect to Supabase config"
              >
                ✏️ Edit Config
              </button>
            </div>
          </Panel>
        </section>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profit Table (Campaigns / Shared)
// ─────────────────────────────────────────────────────────────────────────────

function ProfitTable({ rows }: { rows: ProfitRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
        <p className="text-gray-500 text-sm">No data to display</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/80">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Type</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Qty / Homes</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Print Cost</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Postage</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Cost</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Sell Price</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Profit $</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Margin</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-800/40 transition">
                <td className="px-4 py-3">
                  <p className="font-medium text-white truncate max-w-[140px]">{row.name}</p>
                  {row.status && (
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">{row.status.replace("_", " ")}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {PRODUCT_LABELS[row.productType] ?? row.productType}
                </td>
                <td className="px-4 py-3 text-right text-white font-mono">
                  {row.quantity.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-300 font-mono">{fmt(row.vendorCost)}</td>
                <td className="px-4 py-3 text-right text-gray-300 font-mono">{fmt(row.postageCost)}</td>
                <td className="px-4 py-3 text-right text-gray-300 font-mono font-semibold">{fmt(row.totalCost)}</td>
                <td className="px-4 py-3 text-right text-white font-mono font-semibold">{fmt(row.sellPrice)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">
                  <span className={row.grossProfit >= 0 ? "text-green-400" : "text-red-400"}>
                    {fmt(row.grossProfit)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={cn("font-bold", marginColor(row.marginPercent))}>
                    {row.marginPercent.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <SourceBadge source={row.pricingSource} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-700 bg-gray-900/80">
              <td colSpan={5} className="px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                Totals
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold text-white">
                {fmt(rows.reduce((s, r) => s + r.totalCost, 0))}
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold text-white">
                {fmt(rows.reduce((s, r) => s + r.sellPrice, 0))}
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold text-green-400">
                {fmt(rows.reduce((s, r) => s + r.grossProfit, 0))}
              </td>
              <td className="px-4 py-3 text-right">
                {(() => {
                  const rev = rows.reduce((s, r) => s + r.sellPrice, 0);
                  const cost = rows.reduce((s, r) => s + r.totalCost, 0);
                  const m = rev > 0 ? Math.round(((rev - cost) / rev) * 100) : 0;
                  return <span className={cn("font-bold", marginColor(m))}>{m}%</span>;
                })()}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Reference Table
// ─────────────────────────────────────────────────────────────────────────────

function ProductReferenceTable({ rows }: { rows: ProductPricingResult[] }) {
  // Group by product type
  const grouped = rows.reduce<Record<string, ProductPricingResult[]>>((acc, row) => {
    if (!acc[row.productType]) acc[row.productType] = [];
    acc[row.productType].push(row);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([productType, items]) => (
        <div key={productType} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 bg-gray-900/80">
            <h4 className="text-sm font-bold text-white">{PRODUCT_LABELS[productType] ?? productType}</h4>
            <p className="text-xs text-gray-500 mt-0.5">Print only — no postage included</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Quantity</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Print Cost/pc</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Cost</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sell Price</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sell/pc</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Profit</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Margin</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {items.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-800/30 transition">
                    <td className="px-4 py-2.5 text-right text-white font-mono">{row.quantity.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-gray-400 font-mono">${row.costPerPiece.toFixed(4)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-300 font-mono">{fmt(row.totalCost)}</td>
                    <td className="px-4 py-2.5 text-right text-white font-mono font-semibold">{fmt(row.finalPrice)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-300 font-mono">${row.pricePerPiece.toFixed(4)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-green-400">{fmt(row.grossProfit)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn("font-bold text-sm", marginColor(row.grossMarginPercent))}>
                        {row.grossMarginPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <SourceBadge source={row.pricingSource} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Config Field
// ─────────────────────────────────────────────────────────────────────────────

function ConfigField({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{label}</p>
      <p className="text-xl font-bold text-white mt-1">{value}</p>
      {note && <p className="text-xs text-gray-600 mt-0.5">{note}</p>}
    </div>
  );
}
