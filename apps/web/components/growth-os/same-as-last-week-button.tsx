"use client";

import { Copy } from "lucide-react";

export function SameAsLastWeekButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Copy className="h-4 w-4" aria-hidden="true" />
      Same as last week
    </button>
  );
}
