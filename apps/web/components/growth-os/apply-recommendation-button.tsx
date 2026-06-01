"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ApplyRecommendationButton({
  triggerKey,
  disabled,
}: {
  triggerKey: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function applyRecommendation() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/growth-os/recommendations/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ triggerKey }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Could not apply recommendation");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply lever");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={applyRecommendation}
        disabled={disabled || pending}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors",
          disabled
            ? "cursor-not-allowed bg-gray-100 text-gray-400"
            : "bg-blue-600 text-white hover:bg-blue-700",
          pending ? "cursor-wait" : ""
        )}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="h-4 w-4" aria-hidden="true" />
        )}
        {disabled ? "One lever active" : "Approve lever"}
      </button>
      {!disabled ? (
        <p className="text-xs font-medium leading-5 text-gray-500">
          Approval starts tracking. It does not change prices, send messages, or
          commit staffing automatically.
        </p>
      ) : null}
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
