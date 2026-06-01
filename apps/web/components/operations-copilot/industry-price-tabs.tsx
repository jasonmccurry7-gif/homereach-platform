"use client";

import { useMemo, useState } from "react";
import { Database, Factory, FileText, RefreshCw, Search, ShieldCheck, Tags, Upload } from "lucide-react";
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
          Supplify Price Watch
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white">
          Price signals by industry
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-300">
          Watch the common operating inputs that move margin across roofing,
          landscaping, bakeries, and HVAC. Live prices become decision-grade through
          supplier portals, API access, uploaded invoices, or approved quote workflows.
        </p>
      </section>

      {active.id === priceIntelligence.industryId ? (
        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            label="Tracked SKUs"
            value={String(priceIntelligence.itemCount)}
            detail="Common materials, tools, safety, tear-off, and disposal"
          />
          <MetricCard
            label="Supplier Sources"
            value={String(priceIntelligence.sourceCount)}
            detail="Potential item/supplier comparisons for ZIP 44309"
          />
          <MetricCard
            label="Verified"
            value={String(priceIntelligence.verifiedPriceCount)}
            detail="Invoice, quote, API, EDI, cXML, or approved portal data"
          />
          <MetricCard
            label="Observed"
            value={String(priceIntelligence.observedPriceCount)}
            detail="Public web/search benchmarks only"
          />
          <MetricCard
            label="Estimated"
            value={String(priceIntelligence.estimatedPriceCount)}
            detail="Planning data that still needs quote or invoice verification"
          />
          <MetricCard
            label="Captured"
            value={String(priceIntelligence.capturedPriceCount)}
            detail={`${priceIntelligence.freshPriceCount} fresh / ${priceIntelligence.agingPriceCount} refresh soon / ${priceIntelligence.stalePriceCount} stale`}
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
                Roofing margin signal cockpit
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-emerald-50/85">
                {priceIntelligence.dataNotice}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-300/20 bg-black/20 px-3 py-2 text-sm font-semibold text-emerald-100">
              Market: {priceIntelligence.region} / {priceIntelligence.zipCode}
            </div>
          </div>

          <ProcurementDocumentImportPanel activeCatalog={active} />

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
                        {source.sourceMode.replaceAll("_", " ")}
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
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <QualityBadge quality={snapshot.sourceQuality} label={snapshot.sourceQualityLabel} />
                        <span className="rounded-md border border-white/10 px-2 py-1 text-neutral-300">
                          {snapshot.freshnessLabel}
                        </span>
                        <span className="rounded-md border border-white/10 px-2 py-1 text-neutral-300">
                          Updated {snapshot.lastUpdatedLabel}
                        </span>
                      </div>
                      <div className="mt-2 text-xs leading-5 text-neutral-400">
                        {snapshot.priceBasis} / confidence {snapshot.confidence}. Observed and estimated prices require human verification before supplier switching or ordering.
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-6 text-neutral-300">
                    No exact price snapshots are stored yet. Have the client drop
                    in spend sheets, receipts, or invoices, then Supplify will
                    normalize the rows and run observed benchmark search.
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
          <h2 className="text-lg font-bold text-white">Common margin inputs to monitor</h2>
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
          What is needed before decision-grade price monitoring
        </h2>
        <div className="mt-3 grid gap-3 text-sm leading-6 text-amber-50/85 md:grid-cols-2">
          <p>Supplier account credentials, API keys, EDI feeds, or approved quote-email ingestion.</p>
          <p>Permission to scrape or automate any supplier portal that has no public API.</p>
          <p>Client spend sheets, receipts, and invoices for the current-spend baseline.</p>
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
      <div className="mt-2 flex flex-wrap gap-1">
        {row.bestSourceQuality ? (
          <QualityBadge quality={row.bestSourceQuality} label={row.bestSourceQualityLabel} />
        ) : null}
        <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-neutral-300">
          {row.bestFreshnessLabel}
        </span>
      </div>
      <div className="mt-1 text-xs text-neutral-400">
        {row.bestSupplierName} / {row.capturedCount} snapshots / updated {row.latestUpdatedLabel}
      </div>
    </div>
  );
}

function ProcurementDocumentImportPanel({ activeCatalog }: { activeCatalog: IndustryPriceCatalog }) {
  const [documentType, setDocumentType] = useState("mixed");
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [runPublicBenchmark, setRunPublicBenchmark] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [standardizedRows, setStandardizedRows] = useState<Array<{ itemName?: string; supplierName?: string; unitPriceCents?: number; sku?: string }>>([]);

  async function importDocuments() {
    setStatus("saving");
    setMessage("");
    const body = new FormData();
    body.set("documentType", documentType);
    body.set("industryId", activeCatalog.id);
    body.set("region", activeCatalog.defaultRegion);
    body.set("zipCode", activeCatalog.defaultZip);
    body.set("runPublicBenchmark", String(runPublicBenchmark));
    if (text.trim()) body.set("text", text);
    for (const file of files) body.append("files", file);

    try {
      const response = await fetch("/api/operations-copilot/procurement-documents/import", {
        method: "POST",
        body,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus("error");
        setMessage(result?.error ?? "Document import failed.");
        return;
      }
      setStatus("saved");
      setStandardizedRows(result.standardizedRows ?? []);
      setMessage(
        `${result.standardizedRows?.length ?? 0} line item${result.standardizedRows?.length === 1 ? "" : "s"} standardized. ${result.inserted?.observedBenchmarks ?? 0} public/API benchmark${result.inserted?.observedBenchmarks === 1 ? "" : "s"} captured. ${result.inserted?.savingsRecommendations ?? 0} savings recommendation${result.inserted?.savingsRecommendations === 1 ? "" : "s"} created for review.`
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Document import failed.");
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-white/10 bg-neutral-950/60 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-emerald-200" aria-hidden="true" />
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-200">
              Drop in messy spend sheets, receipts, or invoices
            </h3>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
            Clients should not clean spreadsheets. Upload Excel, CSV, text exports, PDFs, or receipt images and Supplify standardizes the rows, stores current spend, then searches public/API benchmarks for savings signals.
          </p>
        </div>
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-50">
          Daily benchmark search runs at 6:15 AM
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr_auto]">
        <label className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Document type
          </span>
          <select
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold text-white"
          >
            <option value="mixed">Let Supplify detect it</option>
            <option value="inventory_sheet">Spend sheet</option>
            <option value="invoice">Invoice</option>
            <option value="receipt">Receipt</option>
            <option value="purchase_history">Purchase history</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Files
          </span>
          <input
            type="file"
            multiple
            accept=".csv,.tsv,.txt,.json,.xlsx,.xls,.xlsm,.ods,.pdf,.png,.jpg,.jpeg"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-300 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-neutral-950"
          />
          <span className="block text-xs text-neutral-500">
            {files.length > 0 ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "No formatting required."}
          </span>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={importDocuments}
            disabled={status === "saving" || (files.length === 0 && !text.trim())}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-300 px-4 py-2 text-sm font-black text-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "saving" ? "Standardizing..." : "Find savings"}
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_260px]">
        <label className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Optional paste area
          </span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            placeholder="Paste invoice text, a vendor email quote, or a rough spend list. Supplify will normalize it."
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm leading-5 text-neutral-100 placeholder:text-neutral-600"
          />
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm leading-6 text-neutral-300">
          <input
            type="checkbox"
            checked={runPublicBenchmark}
            onChange={(event) => setRunPublicBenchmark(event.target.checked)}
            className="mt-1 h-4 w-4 accent-emerald-300"
          />
          <span>
            Run public/API benchmark search after standardizing. Results are observed only until supplier account data verifies them.
          </span>
        </label>
      </div>
      {message ? (
        <div
          className={
            status === "error"
              ? "mt-3 rounded-lg border border-red-300/20 bg-red-300/10 px-3 py-2 text-sm text-red-100"
              : "mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100"
          }
        >
          {message}
        </div>
      ) : null}
      {standardizedRows.length > 0 ? (
        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <FileText className="h-4 w-4 text-emerald-200" aria-hidden="true" />
            Standardized preview
          </div>
          <div className="mt-3 max-h-40 space-y-2 overflow-auto pr-1">
            {standardizedRows.slice(0, 6).map((row, index) => (
              <div
                key={`${row.sku ?? row.itemName}-${index}`}
                className="grid gap-2 rounded-md border border-white/10 bg-white/[0.03] p-2 text-xs text-neutral-300 md:grid-cols-[1fr_auto]"
              >
                <span className="font-semibold text-white">{row.itemName ?? "Item"}</span>
                <span>
                  {row.supplierName ?? "Supplier TBD"} / {formatMoney(row.unitPriceCents ?? null)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 text-xs leading-5 text-neutral-400 md:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <Database className="mb-2 h-4 w-4 text-emerald-200" aria-hidden="true" />
          Uploaded invoices and receipts become the verified current-spend baseline after extraction review.
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          Web/API search benchmarks are observed savings signals, not automatic buying approval.
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          No vendor switch, order, or spend action happens without owner approval.
        </div>
      </div>
    </div>
  );
}

function QualityBadge({
  quality,
  label,
}: {
  quality: "verified" | "observed" | "estimated";
  label: string;
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
