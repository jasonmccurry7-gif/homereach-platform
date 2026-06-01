"use client";

import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const FILTER_FIELDS = [
  "search",
  "state",
  "geographyType",
  "geographyValue",
  "districtType",
  "candidateStatus",
] as const;

export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramsKey = searchParams?.toString() ?? "";
  const hasActiveFilters = FILTER_FIELDS.some((field) =>
    Boolean(searchParams?.get(field)?.trim()),
  );

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const next = new URLSearchParams();

    for (const field of FILTER_FIELDS) {
      const value = formData.get(field);
      if (typeof value !== "string") continue;
      const normalized = field === "state" ? value.trim().toUpperCase() : value.trim();
      if (normalized) next.set(field, normalized);
    }

    const query = next.toString();
    router.replace(query ? `/admin/political?${query}` : "/admin/political");
  }

  return (
    <form
      key={paramsKey}
      onSubmit={applyFilters}
      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Search
          </span>
          <input
            name="search"
            defaultValue={searchParams?.get("search") ?? ""}
            placeholder="Candidate"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            State
          </span>
          <input
            name="state"
            defaultValue={searchParams?.get("state") ?? ""}
            placeholder="OH"
            maxLength={2}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase text-slate-900 outline-none focus:border-blue-500"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Geography
          </span>
          <select
            name="geographyType"
            defaultValue={searchParams?.get("geographyType") ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
          >
            <option value="">Any</option>
            <option value="state">State</option>
            <option value="county">County</option>
            <option value="city">City</option>
            <option value="district">District</option>
          </select>
        </label>

        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Name
          </span>
          <input
            name="geographyValue"
            defaultValue={searchParams?.get("geographyValue") ?? ""}
            placeholder="Franklin"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Level
          </span>
          <select
            name="districtType"
            defaultValue={searchParams?.get("districtType") ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
          >
            <option value="">Any</option>
            <option value="local">Local</option>
            <option value="state">State</option>
            <option value="federal">Federal</option>
          </select>
        </label>

        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Status
          </span>
          <select
            name="candidateStatus"
            defaultValue={searchParams?.get("candidateStatus") ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
          >
            <option value="">Any</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {hasActiveFilters && (
          <span className="mr-auto rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Filters active
          </span>
        )}
        <button
          type="button"
          onClick={() => router.replace("/admin/political")}
          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Clear
        </button>
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Apply filters
        </button>
      </div>
    </form>
  );
}
