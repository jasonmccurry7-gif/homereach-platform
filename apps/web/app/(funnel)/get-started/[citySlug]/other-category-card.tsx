"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OtherCategoryCard({ citySlug }: { citySlug: string }) {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState("");
  const router = useRouter();

  function handleContinue() {
    const trimmed = value.trim();
    if (!trimmed) return;
    router.push(
      `/get-started/${citySlug}/other?custom=${encodeURIComponent(trimmed)}`
    );
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md text-left w-full"
      >
        <div className="mb-3 text-3xl">➕</div>
        <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors leading-tight">
          Other
        </h3>
        <p className="mt-1 text-xs text-gray-500 leading-snug">
          My business type isn&apos;t listed above
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-medium text-green-600">Available</span>
          <svg className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </button>
    );
  }

  return (
    <div className="relative flex flex-col rounded-2xl border border-blue-300 bg-white p-5 shadow-md col-span-full sm:col-span-2">
      <div className="mb-3 text-3xl">➕</div>
      <h3 className="font-semibold text-gray-900 leading-tight mb-3">
        What type of business are you?
      </h3>
      <input
        type="text"
        autoFocus
        placeholder="e.g. Pool Service, Dog Grooming, Drywall..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleContinue()}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleContinue}
          disabled={!value.trim()}
          className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continue →
        </button>
        <button
          onClick={() => { setExpanded(false); setValue(""); }}
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
