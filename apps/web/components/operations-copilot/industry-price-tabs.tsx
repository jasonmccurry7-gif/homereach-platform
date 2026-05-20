"use client";

import { useMemo, useState } from "react";
import { Factory, RefreshCw, Search, ShieldCheck, Tags } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { IndustryPriceCatalog } from "@/lib/operations-copilot/industry-catalog";
import type { SupplierPriceIntelligence } from "@/lib/operations-copilot/price-intelligence";

export function IndustryPriceTabs({
  catalogs,
  priceIntelligence,
}: {
  catalogs: IndustryPriceCatalog[];
  priceIntelligence: SupplierPriceIntelligence;
}) {
  const [activeId, setActiveId] = useState(catalogs[0]?.id ?? "roofing");
  const active = useMemo(
    () => catalogs.find((catalog) => catalog.id === activeId) ?? catalogs[0],
    [activeId, catalogs]
  );

  if (!active) return null;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Supplier Price Intelligence
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white">
          Industry purchasing command tabs
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-300">
          These tabs define the first supplier-price watchlists for common
          operating supplies. Live prices require supplier portals, API access,
          uploaded invoices, or approved scraping/quote workflows.
        </p>
      </section>

      {active.id === priceIntelligence.industryId ? (
        <section className="grid gap-3 md:grid-cols-4">
          <MetricCard
            label="Roofing SKUs"
            value={String(priceIntelligence.itemCount)}
            detail="Common materials, tools, safety, tear-off, and disposal"
          />
          <MetricCard
            label="Supplier Sources"
            value={String(priceIntelligence.sourceCount)}
            detail="Potential item/supplier comparisons for ZIP 44309"
          />
          <MetricCard
            label="Captured Prices"
            value={String(priceIntelligence.capturedPriceCount)}
            detail="Exact snapshots from web, portal, quote, or invoice"
          />
          <MetricCard
            label="Priced Items"
            value={String(priceIntelligence.pricedItemCount)}
            detail="Items with at least one comparable price"
          />
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {catalogs.map((catalog) => (
          <button
            key={catalog.id}
            type="button"
            onClick={() => setActiveId(catalog.id)}
            className={
              catalog.id === active.id
                ? "rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-neutral-950"
                : "rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
            }
          >
            {catalog.label}
          </button>
        ))}
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-lg border border-white/10 bg-neutral-900 p-5">
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            <h2 className="text-lg font-bold text-white">{active.label}</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-neutral-300">
            {active.operatingModel}
          </p>
          <p className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-100">
            Default market: {active.defaultRegion} / ZIP {active.defaultZip}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Signal
              icon={Search}
              label="Source mode"
              value="Portal, API, quote, invoice"
            />
            <Signal icon={RefreshCw} label="Refresh" value="Daily to weekly" />
            <Signal icon={ShieldCheck} label="Governance" value="No auto-buy" />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-neutral-900 p-5">
          <h2 className="text-lg font-bold text-white">Supplier targets</h2>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            National / multi-market
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {active.supplierTargets.map((supplier) => (
              <span
                key={supplier}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-neutral-200"
              >
                {supplier}
              </span>
            ))}
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Northeast Ohio watchlist
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {active.regionalSupplierTargets.map((supplier) => (
              <span
                key={supplier}
                className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100"
              >
                {supplier}
              </span>
            ))}
          </div>
          <div className="mt-4 space-y-2 text-sm text-neutral-400">
            {active.buyingNotes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        </div>
      </section>

      {active.id === priceIntelligence.industryId ? (
        <section className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-emerald-100">
                Roofing price ingestion cockpit
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-emerald-50/85">
                {priceIntelligence.dataNotice}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-300/20 bg-black/20 px-3 py-2 text-sm font-semibold text-emerald-100">
              Market: {priceIntelligence.region} / {priceIntelligence.zipCode}
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <div className="rounded-lg border border-white/10 bg-neutral-950/60 p-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-200">
                Supplier source readiness
              </h3>
              <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">
                {priceIntelligence.sourceReadiness.map((source) => (
                  <div
                    key={source.supplierName}
                    className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        {source.supplierName}
                      </div>
                      <div className="mt-1 text-xs text-neutral-400">
                        {source.itemCount} catalog matches
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
                        {source.priority}
                      </div>
                      <div className="mt-1 text-xs text-neutral-400">
                        {source.sourceMode.replace("_", " ")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-neutral-950/60 p-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-200">
                Latest captured price snapshots
              </h3>
              <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">
                {priceIntelligence.latestSnapshots.length > 0 ? (
                  priceIntelligence.latestSnapshots.map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-white">
                            {snapshot.itemName}
                          </div>
                          <div className="mt-1 text-xs text-neutral-400">
                            {snapshot.supplierName} / {snapshot.sourceLabel}
                          </div>
                        </div>
                        <div className="text-right font-bold text-emerald-100">
                          {formatMoney(
                            snapshot.landedPriceCents ?? snapshot.observedPriceCents
                          )}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-neutral-400">
                        {snapshot.priceBasis} / confidence {snapshot.confidence}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-6 text-neutral-300">
                    No exact price snapshots are stored yet. Connect supplier
                    portals, add approved public-web collectors, or upload invoices
                    to populate this feed.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-white/10 bg-neutral-900 p-5">
        <div className="flex items-center gap-2">
          <Tags className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          <h2 className="text-lg font-bold text-white">Common supplies to monitor</h2>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                <th className="border-b border-white/10 px-3 py-3">Item</th>
                <th className="border-b border-white/10 px-3 py-3">Unit</th>
                <th className="border-b border-white/10 px-3 py-3">Suppliers</th>
                {active.id === priceIntelligence.industryId ? (
                  <th className="border-b border-white/10 px-3 py-3">Best captured</th>
                ) : null}
                <th className="border-b border-white/10 px-3 py-3">Price signals</th>
                <th className="border-b border-white/10 px-3 py-3">Refresh</th>
                <th className="border-b border-white/10 px-3 py-3">Margin use</th>
              </tr>
            </thead>
            <tbody>
              {active.items.map((item) => (
                <tr key={item.sku} className="text-neutral-300">
                  <td className="border-b border-white/10 px-3 py-4 align-top">
                    <div className="font-semibold text-white">{item.itemName}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {item.category} / {item.sku}
                    </div>
                  </td>
                  <td className="border-b border-white/10 px-3 py-4 align-top">
                    {item.unit}
                  </td>
                  <td className="border-b border-white/10 px-3 py-4 align-top">
                    {item.suppliers.join(", ")}
                  </td>
                  {active.id === priceIntelligence.industryId ? (
                    <td className="border-b border-white/10 px-3 py-4 align-top">
                      <CapturedPriceCell
                        row={priceIntelligence.rows.find(
                          (priceRow) => priceRow.sku === item.sku
                        )}
                      />
                    </td>
                  ) : null}
                  <td className="border-b border-white/10 px-3 py-4 align-top">
                    {item.priceSignals.join(", ")}
                  </td>
                  <td className="border-b border-white/10 px-3 py-4 align-top">
                    {item.refreshCadence}
                  </td>
                  <td className="border-b border-white/10 px-3 py-4 align-top">
                    {item.marginUse}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-5">
        <h2 className="text-lg font-bold text-amber-100">
          What is needed before live price pulling
        </h2>
        <div className="mt-3 grid gap-3 text-sm leading-6 text-amber-50/85 md:grid-cols-2">
          <p>Supplier account credentials, API keys, EDI feeds, or quote-email ingestion.</p>
          <p>Permission to scrape or automate any supplier portal that has no public API.</p>
          <p>Canonical SKU matching so the same item is compared across suppliers correctly.</p>
          <p>Location, tax, delivery fee, minimum order, rebate, and lead-time normalization.</p>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-900 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
      <div className="mt-2 text-xs leading-5 text-neutral-400">{detail}</div>
    </div>
  );
}

function CapturedPriceCell({
  row,
}: {
  row?: SupplierPriceIntelligence["rows"][number];
}) {
  if (!row || row.status !== "priced") {
    return (
      <div>
        <span className="rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-100">
          Ready to pull
        </span>
        <div className="mt-2 text-xs text-neutral-500">
          {row?.sourceCount ?? 0} sources mapped
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="font-semibold text-emerald-100">
        {formatMoney(row.bestPriceCents)}
      </div>
      <div className="mt-1 text-xs text-neutral-400">
        {row.bestSupplierName} / {row.capturedCount} snapshots
      </div>
    </div>
  );
}

function formatMoney(cents: number | null) {
  if (cents === null) return "Not captured";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function Signal({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-300" aria-hidden={true} />
        <span className="text-xs uppercase tracking-[0.16em] text-neutral-500">
          {label}
        </span>
      </div>
      <p className="mt-2 font-semibold text-white">{value}</p>
    </div>
  );
}
