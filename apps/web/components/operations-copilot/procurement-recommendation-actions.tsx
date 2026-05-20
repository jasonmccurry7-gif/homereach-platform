"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  MessageSquareText,
  Send,
  ShoppingCart,
  XCircle,
} from "lucide-react";
import type { BestPriceDeliveryRecommendation } from "@/lib/operations-copilot/delivery-intelligence";

type ActionKey =
  | "approve_order"
  | "request_quote"
  | "send_to_owner"
  | "add_to_shopping_list"
  | "mark_purchased"
  | "ignore";

const actionMeta: Record<
  ActionKey,
  { label: string; success: string; icon: typeof CheckCircle2 }
> = {
  approve_order: {
    label: "Approve Order",
    success: "Approval request created. No live order was placed.",
    icon: CheckCircle2,
  },
  request_quote: {
    label: "Request Quote",
    success: "Quote request created for manual supplier follow-up.",
    icon: MessageSquareText,
  },
  send_to_owner: {
    label: "Send to Owner",
    success: "Owner approval request created.",
    icon: Send,
  },
  add_to_shopping_list: {
    label: "Add to Shopping List",
    success: "Shopping list action created.",
    icon: ShoppingCart,
  },
  mark_purchased: {
    label: "Mark Purchased",
    success: "Manual purchase tracking action created.",
    icon: ClipboardList,
  },
  ignore: {
    label: "Ignore",
    success: "Ignore action saved for review.",
    icon: XCircle,
  },
};

export function ProcurementRecommendationActions({
  recommendation,
}: {
  recommendation: BestPriceDeliveryRecommendation;
}) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<ActionKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  async function createAction(action: ActionKey) {
    setLoadingAction(action);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/operations-copilot/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: `procurement_${action}`,
          title: `${actionMeta[action].label}: ${recommendation.itemName}`,
          payload: {
            source: "best_price_delivery_layer",
            recommendationId: recommendation.id,
            sku: recommendation.sku,
            itemName: recommendation.itemName,
            supplierName: recommendation.supplierName,
            status: recommendation.status,
            deliveryOption: recommendation.deliveryOption,
            totalDeliveredCostCents:
              recommendation.savingsAudit.recommendedTotalDeliveredCostCents,
            monthlyEstimatedSavingsCents:
              recommendation.savingsAudit.monthlyEstimatedSavingsCents,
            liveOrderingEnabled: false,
          },
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Action could not be created");
      }

      setMessage(actionMeta[action].success);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action could not be created");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowDetails((value) => !value)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-neutral-100 transition-colors hover:bg-white/10"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          {showDetails ? "Hide Details" : "View Options"}
        </button>
        {(Object.keys(actionMeta) as ActionKey[]).map((action) => {
          const Icon = actionMeta[action].icon;
          const primary = action === "approve_order" || action === "request_quote";

          return (
            <button
              key={action}
              type="button"
              onClick={() => createAction(action)}
              disabled={loadingAction !== null}
              className={
                primary
                  ? "inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-300 px-3 py-2 text-sm font-bold text-neutral-950 transition-colors hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                  : "inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-neutral-100 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {loadingAction === action ? "Saving..." : actionMeta[action].label}
            </button>
          );
        })}
      </div>

      <p className="text-xs leading-5 text-neutral-500">
        Safe workflow: actions create approval or tracking records only. No supplier
        order, payment, or external message is sent from this dashboard.
      </p>

      {showDetails ? (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-5 text-neutral-300">
          <div className="font-semibold text-white">Audit details</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <span>Current total: {formatMoney(recommendation.savingsAudit.currentVendorTotalCostCents)}</span>
            <span>
              Delivered total:{" "}
              {formatMoney(recommendation.savingsAudit.recommendedTotalDeliveredCostCents)}
            </span>
            <span>
              Delivery fee:{" "}
              {formatMoney(recommendation.savingsAudit.recommendedDeliveryFeeCents)}
            </span>
            <span>Order qty: {recommendation.savingsAudit.orderQuantity}</span>
            <span>Monthly usage: {recommendation.savingsAudit.monthlyUsageEstimate}</span>
            <span>Data quality: {recommendation.savingsAudit.dataQuality}</span>
          </div>
          <p className="mt-3 text-neutral-400">{recommendation.savingsAudit.formula}</p>
          <p className="mt-2 text-neutral-400">{recommendation.connector.complianceNotes}</p>
        </div>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-300/20 bg-red-300/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      ) : null}
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
