import { DemoDataButton } from "@/components/operations-copilot/demo-data-button";
import Link from "next/link";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import {
  formatCopilotMoney,
  listOperationsCopilotData,
} from "@/lib/operations-copilot/intelligence";

export const dynamic = "force-dynamic";

function value(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

export default async function OperationsCopilotDataPage() {
  const user = await getOperationsCopilotSessionUser();
  if (!user) return null;

  const data = await listOperationsCopilotData(user.id);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Source Health
            </p>
            <h1 className="mt-3 text-3xl font-bold text-white">
              Profitability context layer
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-neutral-300">
              Supplify turns business rules, supply levels, vendor prices, quote
              signals, approvals, and operating memory into margin-aware context.
            </p>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
              <Metric label="Items" value={data.inventory.length.toString()} />
              <Metric label="Suppliers" value={data.suppliers.length.toString()} />
              <Metric label="Quotes" value={data.quotes.length.toString()} />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
              <Link
                href="/operations-copilot/supplier-prices"
                className="rounded-lg bg-emerald-300 px-3 py-2 text-center text-sm font-bold text-neutral-950 hover:bg-emerald-200"
              >
                Load Spend Proof
              </Link>
              <Link
                href="/operations-copilot/approvals"
                className="rounded-lg border border-white/10 px-3 py-2 text-center text-sm font-bold text-white hover:bg-white/10"
              >
                Review Approvals
              </Link>
            </div>
          </div>
        </div>
      </section>

      <DemoDataButton />

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-bold text-white">Business Context</h2>
          <div className="mt-4 grid gap-3 text-sm text-neutral-300 sm:grid-cols-2">
            <Field label="Company" value={data.context?.companyName ?? "Not loaded"} />
            <Field label="Business type" value={data.context?.businessType ?? "Not loaded"} />
            <Field label="Operating model" value={data.context?.operatingModel ?? "Not loaded"} />
            <Field label="Geography" value={data.context?.serviceGeography ?? "Not loaded"} />
            <Field
              label="Autonomy level"
              value={String(data.context?.approvalPolicy?.autonomyLevel ?? 0)}
            />
            <Field
              label="Auto-approve under"
              value={formatCopilotMoney(
                data.context?.approvalPolicy?.autoApproveUnderCents ?? 0
              )}
            />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-bold text-white">Preference Memory</h2>
          <div className="mt-4 space-y-3 text-sm text-neutral-300">
            <Field
              label="Preferred brands"
              value={
                data.context?.preferenceMemory?.preferredBrands?.join(", ") ??
                "Not loaded"
              }
            />
            <Field
              label="Substitute tolerance"
              value={data.context?.preferenceMemory?.substituteTolerance ?? "Not loaded"}
            />
            <Field
              label="Seasonal patterns"
              value={data.context?.seasonalPatterns?.join("; ") ?? "Not loaded"}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-bold text-white">Supply Risk Radar</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.inventory.map((item) => {
            const daysRemaining =
              value(item.averageDailyUse) > 0
                ? value(item.onHandQuantity) / value(item.averageDailyUse)
                : null;

            return (
              <article
                key={item.id}
                className="rounded-lg border border-white/10 bg-neutral-950/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{item.itemName}</h3>
                    <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                      {item.category} - {item.sku}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-neutral-300">
                    {item.substituteTolerance} substitute
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <Metric label="On hand" value={`${value(item.onHandQuantity)} ${item.unit}`} />
                  <Metric label="Reorder" value={`${value(item.reorderPointQuantity)} ${item.unit}`} />
                  <Metric label="Daily use" value={`${value(item.averageDailyUse)} ${item.unit}`} />
                  <Metric
                    label="Runway"
                    value={daysRemaining ? `${Math.round(daysRemaining)} days` : "N/A"}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-bold text-white">Vendor Intelligence</h2>
          <div className="mt-4 space-y-3">
            {data.suppliers.map((supplier) => (
              <article
                key={supplier.id}
                className="rounded-lg border border-white/10 bg-neutral-950/60 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-white">{supplier.supplierName}</h3>
                  <span className="text-sm text-cyan-200">
                    {supplier.reliabilityScore}/100 reliable
                  </span>
                </div>
                <p className="mt-2 text-sm text-neutral-300">
                  {supplier.categoryCoverage.join(", ")} - {supplier.averageLeadTimeDays}
                  d lead - {formatCopilotMoney(supplier.deliveryFeeCents)} delivery
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-bold text-white">Price Signal Stream</h2>
          <div className="mt-4 space-y-3">
            {data.quotes.map((quote) => {
              const supplier = data.suppliers.find(
                (candidate) => candidate.id === quote.supplierId
              );
              const item = data.inventory.find(
                (candidate) => candidate.id === quote.inventoryItemId
              );

              return (
                <article
                  key={quote.id}
                  className="rounded-lg border border-white/10 bg-neutral-950/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-white">
                      {item?.itemName ?? "Supply item"}
                    </h3>
                    <span className="text-sm text-emerald-200">
                      {formatCopilotMoney(quote.landedCostCents)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-300">
                    {supplier?.supplierName ?? "Supplier"} - {quote.leadTimeDays}d lead -{" "}
                    {value(quote.availableQuantity)} available
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-950/70 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      <p className="mt-1 text-white">{value}</p>
    </div>
  );
}
