"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MockDataBanner — Operational Honesty Component
//
// Displays a persistent warning on admin dashboards that are still powered by
// mock/demo data. Prevents operators from treating fake numbers as real.
//
// Usage:
//   import { MockDataBanner } from "@/components/admin/mock-data-banner";
//   <MockDataBanner items={["Lead pipeline", "Conversion rates"]} />
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  items?: string[];  // specific sections that are mock — shown in the banner
  note?: string;     // optional override message
}

export function MockDataBanner({ items, note }: Props) {
  return (
    <div className="rounded-xl border border-amber-400/50 bg-amber-900/20 px-4 py-3 flex items-start gap-3">
      <span className="text-amber-400 text-lg shrink-0 mt-0.5">⚠️</span>
      <div>
        <p className="text-sm font-bold text-amber-300">
          DEMO DATA — Not connected to live database
        </p>
        <p className="text-xs text-amber-400/80 mt-0.5">
          {note ??
            "The numbers on this page are sample data and do not reflect real business state."}
        </p>
        {items && items.length > 0 && (
          <p className="text-xs text-amber-400/60 mt-1">
            Mock sections: {items.join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}
