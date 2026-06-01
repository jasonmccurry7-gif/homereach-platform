"use client";

import type {
  GrowthOsContextFlagKey,
  GrowthOsContextFlags,
} from "@/lib/growth-os/types";

const FLAG_LABELS: Array<{ key: GrowthOsContextFlagKey; label: string }> = [
  { key: "badWeather", label: "Bad weather" },
  { key: "holidaySpike", label: "Holiday spike" },
  { key: "equipmentIssue", label: "Equipment issue" },
  { key: "staffingIssue", label: "Staffing issue" },
  { key: "promotionRunning", label: "Promotion running" },
];

export function ContextFlags({
  value,
  onChange,
}: {
  value: GrowthOsContextFlags;
  onChange: (value: GrowthOsContextFlags) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-gray-900">
        Context flags
      </legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {FLAG_LABELS.map((flag) => (
          <label
            key={flag.key}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
          >
            <input
              type="checkbox"
              checked={value[flag.key]}
              onChange={(event) =>
                onChange({ ...value, [flag.key]: event.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>{flag.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
