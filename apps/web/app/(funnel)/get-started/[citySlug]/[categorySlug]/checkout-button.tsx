"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface CheckoutButtonProps {
  bundleId: string;
  bundleName: string;
  cityId: string;
  categoryId: string;
  citySlug: string;
  categorySlug: string;
  highlight: boolean;
  priceCents?: number;
}

export function CheckoutButton({
  bundleId,
  bundleName,
  cityId,
  categoryId,
  citySlug,
  categorySlug,
  highlight,
  priceCents,
}: CheckoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    // Navigate to the checkout review/business-info page
    // Auth check happens there — if not logged in, redirect to login → back
    const params = new URLSearchParams({ bundle: bundleId });
    if (priceCents !== undefined) {
      params.append("price", priceCents.toString());
    }
    router.push(
      `/get-started/${citySlug}/${categorySlug}/checkout?${params.toString()}`
    );
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          "w-full rounded-xl px-5 py-3 text-sm font-bold transition-all disabled:opacity-60",
          highlight
            ? "bg-amber-500 text-white hover:bg-amber-600 shadow-md hover:shadow-lg"
            : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md"
        )}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading…
          </span>
        ) : (
          `Claim ${bundleName} Spot`
        )}
      </button>
      {error && (
        <p className="mt-2 text-center text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
