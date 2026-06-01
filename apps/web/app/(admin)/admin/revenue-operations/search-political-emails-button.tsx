"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type SearchResult = {
  ok?: boolean;
  scanned?: number;
  candidatesUpdated?: number;
  contactsInserted?: number;
  emailsFound?: number;
  skipped?: number;
  error?: string;
};

type SearchPoliticalEmailsButtonProps = {
  label?: string;
  limit?: number;
};

export function SearchPoliticalEmailsButton({
  label = "Search manager emails",
  limit = 50,
}: SearchPoliticalEmailsButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function searchEmails() {
    setIsLoading(true);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/political/campaign-manager-email-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit, force: false, includeSearchEngine: true }),
      });
      const payload = (await response.json().catch(() => ({}))) as SearchResult;
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Could not search campaign manager emails.");
        return;
      }

      setFeedback(
        [
          `Searched ${payload.scanned ?? 0} candidate${payload.scanned === 1 ? "" : "s"}.`,
          `Found ${payload.emailsFound ?? 0} usable email${payload.emailsFound === 1 ? "" : "s"}.`,
          `Updated ${payload.candidatesUpdated ?? 0} candidate record${payload.candidatesUpdated === 1 ? "" : "s"}.`,
          `Added ${payload.contactsInserted ?? 0} campaign contact${payload.contactsInserted === 1 ? "" : "s"}.`,
          (payload.skipped ?? 0) > 0 ? `${payload.skipped} skipped for missing sources or guardrails.` : null,
        ]
          .filter(Boolean)
          .join(" "),
      );
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search campaign manager emails.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={searchEmails}
        disabled={isLoading || isPending}
        className="inline-flex items-center gap-2 rounded-md border border-violet-300/30 bg-violet-400/15 px-3 py-2 text-xs font-black text-violet-100 transition hover:bg-violet-400/25 disabled:cursor-not-allowed disabled:opacity-50"
        title="Search public campaign websites for manager/contact emails and save them for human-reviewed outreach."
      >
        <Search className="h-3.5 w-3.5" />
        {isLoading || isPending ? "Searching..." : label}
      </button>
      {feedback && <span className="max-w-md text-xs font-semibold leading-5 text-emerald-200">{feedback}</span>}
      {error && <span className="max-w-md text-xs font-semibold leading-5 text-rose-200">{error}</span>}
    </div>
  );
}
