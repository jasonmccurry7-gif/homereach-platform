"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Loader2 } from "lucide-react";

export function EvaluateAbTestButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function evaluate() {
    setPending(true);
    try {
      await fetch("/api/growth-os/ab-tests/evaluate", { method: "POST" });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={evaluate}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-400"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <BarChart3 className="h-4 w-4" aria-hidden="true" />
      )}
      Evaluate
    </button>
  );
}
