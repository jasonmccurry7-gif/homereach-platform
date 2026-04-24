"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, type ChangeEvent, type FormEvent } from "react";

// URL-driven filters. Each field updates the querystring on change; the
// server component re-renders server-side with the new filters.
//
// Mobile-first: fields stack full-width on small screens, lay out in a 3-col
// grid at md+.

const DISTRICT_OPTIONS = [
  { value: "",        label: "All levels" },
  { value: "federal", label: "Federal" },
  { value: "state",   label: "State" },
  { value: "local",   label: "Local" },
] as const;

const STATUS_OPTIONS = [
  { value: "",         label: "All statuses" },
  { value: "active",   label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "won",      label: "Won" },
  { value: "lost",     label: "Lost" },
] as const;

const GEO_OPTIONS = [
  { value: "",         label: "Any granularity" },
  { value: "state",    label: "State" },
  { value: "county",   label: "County" },
  { value: "city",     label: "City" },
  { value: "district", label: "District" },
] as const;

export interface FilterBarProps {
  basePath?: string;
}

export function FilterBar({ basePath = "/admin/political" }: FilterBarProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const state           = sp.get("state")          ?? "";
  const geographyType   = sp.get("geographyType")  ?? "";
  const geographyValue  = sp.get("geographyValue") ?? "";
  const districtType    = sp.get("districtType")   ?? "";
  const candidateStatus = sp.get("candidateStatus")?? "";
  const search          = sp.get("search")         ?? "";

  function pushWith(patch: Record<string, string>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else   next.delete(k);
    }
    startTransition(() => {
      router.push(`${basePath}?${next.toString()}`);
    });
  }

  function onSelectChange(key: string) {
    return (e: ChangeEvent<HTMLSelectElement>) => pushWith({ [key]: e.currentTarget.value });
  }

  function onSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    pushWith({
      search:          String(f.get("search")         ?? ""),
      state:           String(f.get("state")          ?? ""),
      geographyValue:  String(f.get("geographyValue") ?? ""),
    });
  }

  const anyActive = Boolean(
    state || geographyType || geographyValue || districtType || candidateStatus || search
  );

  return (
    <form
      onSubmit={onSearchSubmit}
      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
      aria-label="Candidate filters"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Search name</span>
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="e.g. Ortiz"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">State (2-letter)</span>
          <input
            type="text"
            name="state"
            defaultValue={state}
            placeholder="OH"
            maxLength={2}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm uppercase focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Geography value</span>
          <input
            type="text"
            name="geographyValue"
            defaultValue={geographyValue}
            placeholder="Franklin"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Geography type</span>
          <select
            value={geographyType}
            onChange={onSelectChange("geographyType")}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {GEO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">District type</span>
          <select
            value={districtType}
            onChange={onSelectChange("districtType")}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {DISTRICT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Candidate status</span>
          <select
            value={candidateStatus}
            onChange={onSelectChange("candidateStatus")}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Filtering…" : "Apply"}
        </button>
        {anyActive && (
          <button
            type="button"
            onClick={() => startTransition(() => router.push(basePath))}
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            Clear all
          </button>
        )}
      </div>
    </form>
  );
}
