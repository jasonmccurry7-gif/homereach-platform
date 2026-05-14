"use client";

import { useSearchParams } from "next/navigation";

export function FilterBar() {
  const searchParams = useSearchParams();

  return (
    <form className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Search
          </span>
          <input
            name="search"
            defaultValue={searchParams.get("search") ?? ""}
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
            defaultValue={searchParams.get("state") ?? ""}
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
            defaultValue={searchParams.get("geographyType") ?? ""}
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
            defaultValue={searchParams.get("geographyValue") ?? ""}
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
            defaultValue={searchParams.get("districtType") ?? ""}
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
            defaultValue={searchParams.get("candidateStatus") ?? ""}
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
        <a
          href="/admin/political"
          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Clear
        </a>
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
