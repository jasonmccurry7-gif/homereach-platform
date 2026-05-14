"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import type { CandidateSuggestion } from "@/lib/political/candidate-intelligence/types";

function setFormValue(name: string, value: string | null | undefined) {
  if (!value) return;
  const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function districtTypeFor(candidate: CandidateSuggestion): string {
  if (candidate.officeLevel === "federal") return "federal";
  if (candidate.officeLevel === "state") return "state";
  return "local";
}

function geographyTypeFor(candidate: CandidateSuggestion): string {
  const type = (candidate.jurisdictionType ?? candidate.districtType ?? "").toLowerCase();
  if (type.includes("county")) return "county";
  if (type.includes("city") || type.includes("municipal")) return "city";
  if (type.includes("state") && !type.includes("district")) return "state";
  return "district";
}

function summary(candidate: CandidateSuggestion): string {
  return [
    candidate.officeName,
    candidate.districtLabel ?? candidate.jurisdictionName,
    candidate.electionDate,
    candidate.filingStatus,
  ].filter(Boolean).join(" • ");
}

export function CandidateIntelligenceSearch() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("OH");
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<CandidateSuggestion[]>([]);
  const [selected, setSelected] = useState<CandidateSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canSearch = query.trim().length >= 2;
  const stateOptions = useMemo(() => ["OH", "IL", "TN", "US"], []);

  useEffect(() => {
    if (!canSearch) {
      setCandidates([]);
      setError(null);
      abortRef.current?.abort();
      return;
    }

    const handle = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ q: query.trim(), limit: "8" });
        if (state !== "US") params.set("state", state);
        const res = await fetch(`/api/political/candidates/search?${params}`, {
          signal: controller.signal,
        });
        const payload = await res.json() as {
          ok: boolean;
          candidates?: CandidateSuggestion[];
          error?: string;
          migrationHint?: string;
        };
        if (!payload.ok) {
          setCandidates([]);
          setError(payload.migrationHint ?? payload.error ?? "Candidate search is not ready yet.");
          return;
        }
        setCandidates(payload.candidates ?? []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Candidate search is temporarily unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(handle);
  }, [canSearch, query, state]);

  function selectCandidate(candidate: CandidateSuggestion) {
    setSelected(candidate);
    setQuery(candidate.candidateName);
    setCandidates([]);

    setFormValue("candidateName", candidate.candidateName);
    setFormValue("officeSought", candidate.officeName ?? "");
    setFormValue("districtType", districtTypeFor(candidate));
    setFormValue("electionDate", candidate.electionDate ?? "");
    setFormValue("state", candidate.state ?? state);
    setFormValue("geographyType", geographyTypeFor(candidate));
    setFormValue("geographyValue", candidate.districtLabel ?? candidate.jurisdictionName ?? "");
  }

  return (
    <div className="rounded-xl border border-blue-500/25 bg-blue-950/20 p-4 shadow-[0_0_28px_rgba(37,99,235,0.12)]">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-lg border border-blue-400/30 bg-blue-500/15 p-2 text-blue-200">
          <Sparkles className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Candidate intelligence autofill</h3>
          <p className="text-xs text-gray-400">
            Search public candidate/election sources to pre-fill the race, dates, geography, and map hints.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <label className="block">
          <span className="text-xs font-medium text-gray-400">State</span>
          <select
            value={state}
            onChange={(event) => setState(event.target.value)}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            {stateOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-400">Candidate / race lookup</span>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-500" aria-hidden />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(null);
              }}
              placeholder="Start typing a candidate, office, district, or ballot issue"
              className="w-full rounded-md border border-gray-700 bg-gray-950 py-2 pl-9 pr-10 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            />
            {loading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-blue-300" aria-hidden />}
          </div>
        </label>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-100">
          {error}
        </div>
      )}

      {candidates.length > 0 && (
        <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-gray-800 bg-gray-950/90">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => selectCandidate(candidate)}
              className="block w-full border-b border-gray-800 px-4 py-3 text-left transition hover:bg-blue-950/45 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-white">{candidate.candidateName}</span>
                <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gray-300">
                  {candidate.dataConfidence.replace("_", " ")}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-400">{summary(candidate) || "Public candidate intelligence record"}</p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-950/20 p-3 text-xs text-emerald-100">
          Loaded {selected.candidateName}. The form now has office, district, election date, state, and geography fields pre-filled.
        </div>
      )}
    </div>
  );
}
