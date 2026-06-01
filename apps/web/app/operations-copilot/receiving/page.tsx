import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
} from "lucide-react";
import { OwnerSavingsActionButtons } from "@/components/operations-copilot/owner-savings-action-buttons";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { buildBestPriceDeliveryBoard } from "@/lib/operations-copilot/delivery-intelligence";

export const dynamic = "force-dynamic";

export default async function OperationsCopilotReceivingPage() {
  const user = await getOperationsCopilotSessionUser();
  if (!user) return null;

  const board = await buildBestPriceDeliveryBoard({
    userId: user.id,
    industryId: "roofing",
  });
  const deliveries = board.recommendations
    .filter((recommendation) => recommendation.deliveryOption !== "not_delivery_eligible")
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_34%),#111111] p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
          Margin-Safe Receiving
        </p>
        <h1 className="mt-3 text-3xl font-black text-white md:text-4xl">
          60-second receiving check
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300">
          Confirm what arrived, flag problems, and keep savings and invoice proof clean.
          Receiving actions queue an auditable record; vendor follow-up still needs human review.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <ReceivingMetric label="Ready to receive" value={String(deliveries.length)} />
        <ReceivingMetric label="Missing reported" value="0" />
        <ReceivingMetric label="Human checks required" value={String(deliveries.length)} />
      </section>

      <section className="grid gap-4">
        {deliveries.length > 0 ? (
          deliveries.map((delivery) => (
            <article key={delivery.id} className="rounded-lg border border-white/10 bg-neutral-900 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Pill>{delivery.supplierName}</Pill>
                    <Pill>{delivery.deliveryLabel}</Pill>
                    <Pill>{delivery.estimatedDeliveryDateLabel}</Pill>
                    <QualityPill quality={delivery.savingsAudit.dataQuality} />
                  </div>
                  <h2 className="mt-3 text-xl font-black text-white">{delivery.itemName}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
                    Expected delivered cost: {formatMoney(delivery.savingsAudit.recommendedTotalDeliveredCostCents)}.
                    Estimated monthly savings: {formatMoney(delivery.savingsAudit.monthlyEstimatedSavingsCents)}.
                    Match confidence: {delivery.itemMatchConfidence}.
                  </p>
                </div>
                <OwnerSavingsActionButtons
                  compact
                  actions={[
                    {
                      label: "Log Complete",
                      actionType: "receiving_received_complete",
                      payload: {
                        recommendationId: delivery.id,
                        itemName: delivery.itemName,
                        supplierName: delivery.supplierName,
                      },
                    },
                  ]}
                />
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <ReceiveButton
                  icon={CheckCircle2}
                  label="All Items Here"
                  actionType="receiving_all_items_here"
                  payload={{ recommendationId: delivery.id, itemName: delivery.itemName }}
                />
                <ReceiveButton
                  icon={AlertTriangle}
                  label="Missing Item"
                  actionType="receiving_missing_item"
                  payload={{ recommendationId: delivery.id, itemName: delivery.itemName }}
                />
                <ReceiveButton
                  icon={ClipboardCheck}
                  label="Invoice Mismatch"
                  actionType="receiving_invoice_mismatch"
                  payload={{ recommendationId: delivery.id, itemName: delivery.itemName }}
                />
                <ReceiveButton
                  icon={Camera}
                  label="Attach Photo"
                  actionType="receiving_attach_photo_requested"
                  payload={{ recommendationId: delivery.id, itemName: delivery.itemName }}
                />
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-white/15 bg-neutral-900 p-6 text-sm text-neutral-400">
            No deliveries are ready for receiving yet.
          </div>
        )}
      </section>
    </div>
  );
}

function ReceiveButton({
  actionType,
  icon: Icon,
  label,
  payload,
}: {
  actionType: string;
  icon: typeof CheckCircle2;
  label: string;
  payload: Record<string, unknown>;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
        <Icon className="h-4 w-4 text-cyan-300" aria-hidden="true" />
        {label}
      </div>
      <OwnerSavingsActionButtons
        compact
        actions={[
          {
            label,
            actionType,
            payload: {
              source: "receiving_command_center",
              ...payload,
            },
          },
        ]}
      />
    </div>
  );
}

function ReceivingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-900 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">{label}</p>
        <PackageCheck className="h-4 w-4 text-cyan-300" aria-hidden="true" />
      </div>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-neutral-200">
      {children}
    </span>
  );
}

function QualityPill({ quality }: { quality: "verified" | "estimated" | "benchmark" }) {
  const label =
    quality === "verified" ? "Verified" : quality === "benchmark" ? "Observed" : "Estimated";
  const className =
    quality === "verified"
      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
      : quality === "benchmark"
        ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
        : "border-amber-300/25 bg-amber-300/10 text-amber-100";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] ${className}`}>
      {label}
    </span>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
