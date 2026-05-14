"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

interface CandidatePlanEditPanelProps {
  candidateId: string;
  planId: string;
  recommendedStrategy: string;
}

export function CandidatePlanEditPanel({
  candidateId,
  planId,
  recommendedStrategy,
}: CandidatePlanEditPanelProps) {
  const router = useRouter();
  const [strategy, setStrategy] = useState(recommendedStrategy);
  const [operatorNotes, setOperatorNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveEdits() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/political/candidate-agents/${candidateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_plan_edits",
          planId,
          recommendedStrategy: strategy,
          operatorNotes,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Plan edits could not be saved.");
      }
      setOperatorNotes("");
      setMessage("Plan edits saved. Approval was reset for human review.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-white">Edit Launch Plan</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Saves operator edits to the structured plan JSON and resets approval before proposal or production use.
          </p>
        </div>
        <button
          type="button"
          onClick={saveEdits}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Edits
        </button>
      </div>

      <label className="mt-4 grid gap-1 text-xs font-semibold text-slate-300">
        Recommended strategy
        <textarea
          value={strategy}
          onChange={(event) => setStrategy(event.target.value)}
          rows={5}
          className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/50"
        />
      </label>

      <label className="mt-3 grid gap-1 text-xs font-semibold text-slate-300">
        Operator notes
        <textarea
          value={operatorNotes}
          onChange={(event) => setOperatorNotes(event.target.value)}
          rows={3}
          placeholder="Explain what changed or what must be reviewed before approval."
          className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/50"
        />
      </label>

      {message && (
        <div className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-100">
          {message}
        </div>
      )}
    </div>
  );
}
