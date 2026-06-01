"use client";

import { useState } from "react";
import type { SeoConnectorKey } from "@/lib/seo/connectors";

type ConnectorActionState = {
  loading?: boolean;
  message?: string;
  error?: string;
};

export function SeoConnectorActions({ sourceKey }: { sourceKey: SeoConnectorKey }) {
  const [state, setState] = useState<ConnectorActionState>({});

  async function runImport() {
    setState({ loading: true });
    try {
      const response = await fetch("/api/admin/seo-connectors/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey }),
      });
      const payload = (await response.json()) as { ok?: boolean; imported?: number; error?: string; status?: string };
      if (!response.ok || payload.ok === false) {
        setState({
          loading: false,
          error: payload.error || `Connector needs attention${payload.status ? `: ${payload.status}` : ""}.`,
        });
        return;
      }
      setState({
        loading: false,
        message: `Imported ${payload.imported ?? 0} rows. Refresh the page to see the updated readout.`,
      });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "Import failed.",
      });
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        onClick={runImport}
        disabled={state.loading}
        className="inline-flex w-full items-center justify-center rounded-lg bg-slate-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {state.loading ? "Running sync..." : "Run sync"}
      </button>
      {state.message ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold leading-5 text-emerald-800">{state.message}</p> : null}
      {state.error ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">{state.error}</p> : null}
    </div>
  );
}
