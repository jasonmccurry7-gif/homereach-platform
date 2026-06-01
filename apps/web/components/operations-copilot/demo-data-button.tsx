"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DatabaseZap } from "lucide-react";

export function DemoDataButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function seedDemoData() {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/operations-copilot/demo", {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Demo data could not be loaded");
      }

      setMessage(
        `Loaded ${payload.inventoryCount} inventory items, ${payload.supplierCount} suppliers, and ${payload.quoteCount} quotes.`
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Demo data could not be loaded"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-cyan-100">
          Load procurement command data
        </p>
        <p className="mt-1 text-sm text-cyan-100/75">
          Creates sample inventory, suppliers, quotes, AI signals, and one approval.
        </p>
        {message ? <p className="mt-2 text-sm text-cyan-50">{message}</p> : null}
      </div>
      <button
        type="button"
        onClick={seedDemoData}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-neutral-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <DatabaseZap className="h-4 w-4" aria-hidden="true" />
        {loading ? "Loading..." : "Load Demo Data"}
      </button>
    </div>
  );
}
