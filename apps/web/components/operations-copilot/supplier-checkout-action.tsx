"use client";

import { useState } from "react";
import { ExternalLink, MessageSquareText } from "lucide-react";
import type { SupplierCheckoutOption } from "@/lib/operations-copilot/supplier-checkout";

export function SupplierCheckoutAction({
  option,
}: {
  option: SupplierCheckoutOption;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const Icon = option.checkoutUrl ? ExternalLink : MessageSquareText;

  async function trackAndOpen() {
    if (option.checkoutUrl) {
      const confirmed = window.confirm(
        "Open supplier checkout?\n\nThis leaves HomeReach. Supplier payment is direct, and no vendor switch, order, or spend commitment is recorded by HomeReach.",
      );
      if (!confirmed) return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);

    let targetWindow: Window | null = null;
    if (option.checkoutUrl) {
      targetWindow = window.open("about:blank", "_blank");
      if (targetWindow) targetWindow.opener = null;
    }

    try {
      const response = await fetch("/api/operations-copilot/supplier-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionId: option.id,
          itemName: option.itemName,
          currentSupplier: option.currentSupplier,
          recommendedSupplier: option.recommendedSupplier,
          checkoutUrl: option.checkoutUrl,
          checkoutMethod: option.checkoutMethod,
          estimatedSavingsCents: option.estimatedSavingsCents,
          trueLandedCostCents: option.trueLandedCostCents,
          confidence: option.confidenceLabel.toLowerCase(),
          sourceQuality: option.sourceQuality,
          ...option.trackingPayload,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Supplier action could not be tracked");
      }

      if (option.checkoutUrl) {
        if (targetWindow) {
          targetWindow.location.href = option.checkoutUrl;
        } else {
          window.open(option.checkoutUrl, "_blank", "noopener,noreferrer");
        }
        setMessage("Tracked. Review price and pay the supplier directly.");
      } else {
        setMessage("Supplier quote request queued for review. No outbound message was sent.");
      }
    } catch (err) {
      if (targetWindow) targetWindow.close();
      setError(err instanceof Error ? err.message : "Supplier action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={trackAndOpen}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-3 py-2.5 text-sm font-black text-neutral-950 transition-colors hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {loading ? "Tracking..." : option.actionLabel}
      </button>
      {message ? (
        <p className="text-xs font-bold leading-5 text-emerald-100">{message}</p>
      ) : null}
      {error ? (
        <p className="text-xs font-bold leading-5 text-red-100">{error}</p>
      ) : null}
    </div>
  );
}
