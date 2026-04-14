"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Error boundary for the bundle selection page.
// Shows a clean recovery UI instead of the generic Next.js error screen.
// ─────────────────────────────────────────────────────────────────────────────

export default function BundlePageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const citySlug = params?.citySlug as string | undefined;

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <div className="text-5xl mb-6">😕</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">
        Something went wrong
      </h1>
      <p className="text-gray-500 mb-8">
        We had trouble loading the available spots. This is usually temporary —
        please try again.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={reset}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
        {citySlug && (
          <Link
            href={`/get-started/${citySlug}`}
            className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ← Back to categories
          </Link>
        )}
      </div>
    </div>
  );
}
