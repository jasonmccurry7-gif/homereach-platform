"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailPlus } from "lucide-react";

type GenerateResult = {
  ok?: boolean;
  mode?: "first_touch" | "due_followups";
  generated?: number;
  skippedExisting?: number;
  missingRequirements?: number;
  leadSync?: {
    imported?: number;
    updated?: number;
    skipped?: number;
    errors?: string[];
  };
  error?: string;
};

type GeneratePoliticalEmailsButtonProps = {
  mode?: "first_touch" | "due_followups";
  label?: string;
  limit?: number;
  tone?: "sky" | "amber";
};

export function GeneratePoliticalEmailsButton({
  mode = "first_touch",
  label,
  limit = 8,
  tone = "sky",
}: GeneratePoliticalEmailsButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generateDrafts() {
    setIsLoading(true);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/revenue-messaging/generate-political-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit, ensurePlan: true, mode }),
      });
      const payload = (await response.json().catch(() => ({}))) as GenerateResult;

      if (!response.ok) {
        setError(payload.error ?? "Could not generate drafts.");
        return;
      }

      const synced = (payload.leadSync?.imported ?? 0) + (payload.leadSync?.updated ?? 0);
      const generated = payload.generated ?? 0;
      const skippedExisting = payload.skippedExisting ?? 0;
      const missing = payload.missingRequirements ?? 0;
      const draftKind = mode === "due_followups" ? "due follow-up" : "first-touch";
      setFeedback(
        [
          `Generated ${generated} ${draftKind} draft${generated === 1 ? "" : "s"}.`,
          mode === "first_touch" && synced > 0
            ? `Synced ${synced} real political lead${synced === 1 ? "" : "s"} into candidate outreach.`
            : null,
          `${skippedExisting} already queued.`,
          missing > 0
            ? mode === "due_followups"
              ? `${missing} skipped because they are not due, replied, or need data.`
              : `${missing} skipped for missing, unsafe, or previously-contacted data.`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      );
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate drafts.");
    } finally {
      setIsLoading(false);
    }
  }

  const buttonClass =
    tone === "amber"
      ? "inline-flex items-center gap-2 rounded-md border border-amber-300/30 bg-amber-400/15 px-3 py-2 text-xs font-black text-amber-100 transition hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-50"
      : "inline-flex items-center gap-2 rounded-md border border-sky-300/30 bg-sky-400/15 px-3 py-2 text-xs font-black text-sky-100 transition hover:bg-sky-400/25 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={generateDrafts}
        disabled={isLoading || isPending}
        className={buttonClass}
      >
        <MailPlus className="h-3.5 w-3.5" />
        {isLoading || isPending ? "Generating..." : label ?? (mode === "due_followups" ? "Generate due follow-ups" : "Generate first emails")}
      </button>
      {feedback && <span className="text-xs font-semibold text-emerald-200">{feedback}</span>}
      {error && <span className="text-xs font-semibold text-rose-200">{error}</span>}
    </div>
  );
}
