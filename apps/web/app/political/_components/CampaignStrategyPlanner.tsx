"use client";

import { useEffect, useMemo, useState } from "react";
import {
  generateCampaignStrategy,
  type CampaignGoal,
  type ScenarioKind,
  type StrategyScenario,
  type StrategyType,
} from "@/lib/political/strategy-engine";
import {
  routesToStrategyRoutes,
  summarizeCoverageSelection,
  type CoverageSelectionSummary,
  type PoliticalRouteSummary,
} from "@/lib/political/coverage-planner";

function fmtUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function fmtPct(value: number): string {
  return `${Math.round(value)}%`;
}

function labelStrategy(strategy: StrategyType): string {
  if (strategy === "hybrid") return "Winning Strategy";
  if (strategy === "precision") return "Precision Strategy";
  return "Coverage Strategy";
}

function defaultScenarioKind(strategy: StrategyType, scenarios: StrategyScenario[]): ScenarioKind {
  const preferred: ScenarioKind =
    strategy === "hybrid" ? "hybrid" :
    strategy === "precision" ? "targeted_only" :
    scenarios.some((scenario) => scenario.kind === "custom") ? "custom" :
    "full_coverage";

  return scenarios.some((scenario) => scenario.kind === preferred)
    ? preferred
    : scenarios[0]?.kind ?? "full_coverage";
}

interface CoverageApiResponse {
  ok: boolean;
  routes?: PoliticalRouteSummary[];
  note?: string | null;
}

export function CampaignStrategyPlanner() {
  const [goal, setGoal] = useState<CampaignGoal>("awareness");
  const [budgetDollars, setBudgetDollars] = useState(25_000);
  const [daysUntilElection, setDaysUntilElection] = useState(60);
  const [state, setState] = useState("OH");
  const [geographyType, setGeographyType] = useState<"county" | "city" | "district">("county");
  const [geographyValue, setGeographyValue] = useState("Franklin");
  const [districtType, setDistrictType] = useState<"local" | "state" | "federal">("local");
  const [drops, setDrops] = useState(2);
  const [listAddresses, setListAddresses] = useState(7_500);
  const [coverageRoutes, setCoverageRoutes] = useState<PoliticalRouteSummary[]>([]);
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [selectedScenarioKind, setSelectedScenarioKind] = useState<ScenarioKind>("full_coverage");
  const [scenarioTouched, setScenarioTouched] = useState(false);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesNote, setRoutesNote] = useState<string | null>(null);
  const [routesError, setRoutesError] = useState<string | null>(null);

  useEffect(() => {
    const stateCode = state.trim().toUpperCase();
    if (stateCode.length !== 2) {
      setCoverageRoutes([]);
      setSelectedRouteIds([]);
      setRoutesNote("Enter a two-letter state code to load route coverage.");
      setRoutesError(null);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      state: stateCode,
      geographyType,
      geographyValue,
      limit: "120",
    });

    setRoutesLoading(true);
    setRoutesError(null);

    fetch(`/api/political/routes/coverage?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Route request failed (${response.status})`);
        return (await response.json()) as CoverageApiResponse;
      })
      .then((payload) => {
        const routes = payload.ok ? payload.routes ?? [] : [];
        setCoverageRoutes(routes);
        setSelectedRouteIds(routes.map((route) => route.id));
        setRoutesNote(payload.note ?? null);
        setRoutesError(payload.ok ? null : "Route catalog is unavailable right now.");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCoverageRoutes([]);
        setSelectedRouteIds([]);
        setRoutesNote(null);
        setRoutesError("Route catalog is unavailable right now.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setRoutesLoading(false);
      });

    return () => controller.abort();
  }, [state, geographyType, geographyValue]);

  const selectedRouteSet = useMemo(() => new Set(selectedRouteIds), [selectedRouteIds]);
  const selectedRoutes = useMemo(
    () => coverageRoutes.filter((route) => selectedRouteSet.has(route.id)),
    [coverageRoutes, selectedRouteSet],
  );
  const coverageSummary = useMemo(
    () => summarizeCoverageSelection(coverageRoutes, selectedRouteIds),
    [coverageRoutes, selectedRouteIds],
  );
  const strategyRoutes = useMemo(() => routesToStrategyRoutes(selectedRoutes), [selectedRoutes]);

  const result = useMemo(
    () =>
      generateCampaignStrategy({
        goal,
        budgetCents: Math.max(0, Math.round(budgetDollars * 100)),
        state,
        geographyType,
        geographyValue,
        districtType,
        daysUntilElection,
        dropCount: drops,
        campaignListAddresses: listAddresses,
        householdCountOverride:
          coverageRoutes.length > 0 ? coverageSummary.selectedHouseholds : undefined,
        coverageUniverseHouseholds:
          coverageRoutes.length > 0 ? coverageSummary.availableHouseholds : undefined,
        routes: strategyRoutes.length > 0 ? strategyRoutes : undefined,
      }),
    [
      goal,
      budgetDollars,
      state,
      geographyType,
      geographyValue,
      districtType,
      daysUntilElection,
      drops,
      listAddresses,
      coverageRoutes.length,
      coverageSummary.availableHouseholds,
      coverageSummary.selectedHouseholds,
      strategyRoutes,
    ],
  );

  useEffect(() => {
    const next = defaultScenarioKind(result.recommendedStrategy, result.scenarios);
    const currentExists = result.scenarios.some((scenario) => scenario.kind === selectedScenarioKind);

    if ((!scenarioTouched || !currentExists) && selectedScenarioKind !== next) {
      setSelectedScenarioKind(next);
    }
  }, [result, scenarioTouched, selectedScenarioKind]);

  const selectedScenario = useMemo(
    () =>
      result.scenarios.find((scenario) => scenario.kind === selectedScenarioKind) ??
      result.scenarios.find(
        (scenario) => scenario.kind === defaultScenarioKind(result.recommendedStrategy, result.scenarios),
      ) ??
      result.scenarios[0],
    [result, selectedScenarioKind],
  );

  const snapshot = JSON.stringify({
    goal,
    recommendedStrategy: result.recommendedStrategy,
    totalReach: result.combined.totalReach,
    totalCostCents: result.combined.totalCostCents,
    coveragePct: result.coverageLayer.coveragePct,
    coverageStrengthScore: result.coverageStrengthScore,
    deliveryConfidence: result.deliveryConfidence,
    drops,
    daysUntilElection,
    campaignListAddresses: listAddresses,
    selectedRouteCount: coverageSummary.selectedRouteCount,
    selectedRouteHouseholds: coverageSummary.selectedHouseholds,
    availableRouteCount: coverageSummary.availableRouteCount,
    availableRouteHouseholds: coverageSummary.availableHouseholds,
    selectedRouteIds: selectedRouteIds.slice(0, 200),
  });

  const selectedScenarioSnapshot = JSON.stringify({
    kind: selectedScenario?.kind,
    label: selectedScenario?.label,
    strategy: selectedScenario?.strategy,
    routeCount: selectedScenario?.routeCount,
    households: selectedScenario?.households,
    coveragePct: selectedScenario?.coveragePct,
    drops: selectedScenario?.drops,
    totalPieces: selectedScenario?.totalPieces,
    totalCostCents: selectedScenario?.totalCostCents,
    costPerHouseholdCents: selectedScenario?.costPerHouseholdCents,
    estimatedImpressions: selectedScenario?.estimatedImpressions,
    tradeoff: selectedScenario?.tradeoff,
  });

  const scenarioComparisonSnapshot = JSON.stringify(
    result.scenarios.map((scenario) => ({
      kind: scenario.kind,
      label: scenario.label,
      strategy: scenario.strategy,
      routeCount: scenario.routeCount,
      households: scenario.households,
      coveragePct: scenario.coveragePct,
      drops: scenario.drops,
      totalCostCents: scenario.totalCostCents,
      costPerHouseholdCents: scenario.costPerHouseholdCents,
    })),
  );

  const routeSnapshot = JSON.stringify({
    availableRouteCount: coverageSummary.availableRouteCount,
    selectedRouteCount: coverageSummary.selectedRouteCount,
    selectedHouseholds: coverageSummary.selectedHouseholds,
    availableHouseholds: coverageSummary.availableHouseholds,
    coveragePct: coverageSummary.coveragePct,
    gapRouteCount: coverageSummary.gapRouteCount,
    gapHouseholds: coverageSummary.gapHouseholds,
    zipCount: coverageSummary.zipCount,
    selectedRouteIds: selectedRouteIds.slice(0, 200),
  });

  function toggleRoute(routeId: string) {
    setSelectedRouteIds((current) =>
      current.includes(routeId)
        ? current.filter((id) => id !== routeId)
        : [...current, routeId],
    );
  }

  function selectScenario(kind: ScenarioKind) {
    setScenarioTouched(true);
    setSelectedScenarioKind(kind);
  }

  return (
    <aside
      aria-label="Campaign strategy planner"
      className="sticky top-24 space-y-4 rounded-lg border border-gray-800 bg-gray-900/70 p-5"
    >
      <input type="hidden" name="strategySnapshot" value={snapshot} />
      <input type="hidden" name="selectedScenarioKind" value={selectedScenario?.kind ?? ""} />
      <input type="hidden" name="selectedScenarioSnapshot" value={selectedScenarioSnapshot} />
      <input type="hidden" name="scenarioComparisonSnapshot" value={scenarioComparisonSnapshot} />
      <input type="hidden" name="routeCoverageSnapshot" value={routeSnapshot} />
      <input type="hidden" name="selectedRouteIds" value={selectedRouteIds.join(",")} />

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
          Strategy engine
        </p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-white">
          {result.headline}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-gray-400">
          {result.whyThisPlan}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-400">Campaign goal</span>
          <select
            name="campaignGoal"
            value={goal}
            onChange={(e) => setGoal(e.target.value as CampaignGoal)}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="awareness">Awareness</option>
            <option value="persuasion">Persuasion</option>
            <option value="gotv">Get Out The Vote</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-400">Budget</span>
            <input
              name="strategyBudgetEstimate"
              type="number"
              min={0}
              step={1000}
              value={budgetDollars}
              onChange={(e) => setBudgetDollars(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-400">Days out</span>
            <input
              name="strategyDaysUntilElection"
              type="number"
              min={0}
              max={365}
              value={daysUntilElection}
              onChange={(e) => setDaysUntilElection(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-[72px_1fr] gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-400">State</span>
            <input
              name="strategyState"
              maxLength={2}
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-400">Geography</span>
            <input
              name="strategyGeographyValue"
              value={geographyValue}
              onChange={(e) => setGeographyValue(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-400">Geo type</span>
            <select
              name="strategyGeographyType"
              value={geographyType}
              onChange={(e) =>
                setGeographyType(e.target.value as "county" | "city" | "district")
              }
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="county">County</option>
              <option value="city">City</option>
              <option value="district">District</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-400">Race level</span>
            <select
              name="strategyDistrictType"
              value={districtType}
              onChange={(e) => setDistrictType(e.target.value as "local" | "state" | "federal")}
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="local">Local</option>
              <option value="state">State</option>
              <option value="federal">Federal</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-400">Drops</span>
            <input
              name="strategyDropCount"
              type="number"
              min={1}
              max={5}
              value={drops}
              onChange={(e) => setDrops(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-400">List addresses</span>
            <input
              name="strategyListAddresses"
              type="number"
              min={0}
              step={500}
              value={listAddresses}
              onChange={(e) => setListAddresses(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </label>
        </div>
      </div>

      <BudgetOptimizerPanel
        scenarios={result.scenarios}
        budgetDollars={budgetDollars}
        onBudgetChange={setBudgetDollars}
        onSelectScenario={selectScenario}
      />

      <RouteCoveragePanel
        routes={coverageRoutes}
        selectedRouteSet={selectedRouteSet}
        summary={coverageSummary}
        loading={routesLoading}
        note={routesNote}
        error={routesError}
        onToggleRoute={toggleRoute}
        onSelectAll={() => setSelectedRouteIds(coverageRoutes.map((route) => route.id))}
        onClear={() => setSelectedRouteIds([])}
      />

      <ScenarioBuilderPanel
        scenarios={result.scenarios}
        selectedScenarioKind={selectedScenario?.kind ?? selectedScenarioKind}
        onSelectScenario={selectScenario}
      />

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Metric label="Reach" value={(selectedScenario?.households ?? result.combined.totalReach).toLocaleString()} />
        <Metric label="Cost" value={fmtUsd(selectedScenario?.totalCostCents ?? result.combined.totalCostCents)} />
        <Metric label="Coverage" value={fmtPct(selectedScenario?.coveragePct ?? result.coverageLayer.coveragePct)} />
        <Metric label="Strength" value={`${result.coverageStrengthScore}/100`} />
        <Metric label="Impressions" value={(selectedScenario?.estimatedImpressions ?? result.combined.estimatedImpressions).toLocaleString()} />
        <Metric label="Confidence" value={result.deliveryConfidence.toUpperCase()} />
      </div>

      <div className="rounded-md border border-gray-800 bg-gray-950/70 p-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold uppercase tracking-wide text-gray-400">
            Time to impact
          </span>
          <span className="font-medium text-emerald-300">
            {result.timeToImpact.nextAvailableDropText}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-gray-400">
          {result.timeToImpact.printDeadlineText}
        </p>
      </div>

      <p className="text-[11px] leading-relaxed text-gray-500">
        {result.complianceNote}
      </p>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-800 bg-gray-950/70 p-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 truncate font-mono font-semibold text-white">{value}</div>
    </div>
  );
}

interface BudgetOptimizerPanelProps {
  scenarios: StrategyScenario[];
  budgetDollars: number;
  onBudgetChange(value: number): void;
  onSelectScenario(kind: ScenarioKind): void;
}

function BudgetOptimizerPanel({
  scenarios,
  budgetDollars,
  onBudgetChange,
  onSelectScenario,
}: BudgetOptimizerPanelProps) {
  const full = scenarios.find((scenario) => scenario.kind === "full_coverage");
  const hybrid = scenarios.find((scenario) => scenario.kind === "hybrid");
  const targeted = scenarios.find((scenario) => scenario.kind === "targeted_only");
  const budget = scenarios.find((scenario) => scenario.kind === "budget_constrained");

  return (
    <div className="rounded-md border border-gray-800 bg-gray-950/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Budget optimizer
          </div>
          <div className="mt-1 text-sm font-semibold text-white">
            {budget ? `${budget.households.toLocaleString()} households within ${fmtUsd(budget.totalCostCents)}` : "Set a budget"}
          </div>
        </div>
        <div className="rounded border border-gray-700 px-2 py-1 font-mono text-[11px] text-gray-300">
          {fmtUsd(Math.round(budgetDollars * 100))}
        </div>
      </div>

      <input
        type="range"
        min={2_500}
        max={150_000}
        step={1_000}
        value={Math.min(150_000, Math.max(2_500, budgetDollars))}
        onChange={(event) => onBudgetChange(Number(event.target.value) || 0)}
        className="mt-3 w-full accent-blue-500"
        aria-label="Budget to coverage"
      />

      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        {full && (
          <OptimizerOption label="Coverage" scenario={full} onSelect={onSelectScenario} />
        )}
        {hybrid && (
          <OptimizerOption label="Hybrid" scenario={hybrid} onSelect={onSelectScenario} />
        )}
        {targeted && (
          <OptimizerOption label="Precision" scenario={targeted} onSelect={onSelectScenario} />
        )}
      </div>
    </div>
  );
}

function OptimizerOption({
  label,
  scenario,
  onSelect,
}: {
  label: string;
  scenario: StrategyScenario;
  onSelect(kind: ScenarioKind): void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(scenario.kind)}
      className="rounded border border-gray-800 bg-gray-900/60 p-2 text-left hover:border-gray-700"
    >
      <div className="uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 truncate font-mono font-semibold text-gray-100">
        {fmtUsd(scenario.totalCostCents)}
      </div>
      <div className="mt-0.5 truncate text-gray-500">
        {scenario.households.toLocaleString()} reach
      </div>
    </button>
  );
}

interface ScenarioBuilderPanelProps {
  scenarios: StrategyScenario[];
  selectedScenarioKind: ScenarioKind;
  onSelectScenario(kind: ScenarioKind): void;
}

function ScenarioBuilderPanel({
  scenarios,
  selectedScenarioKind,
  onSelectScenario,
}: ScenarioBuilderPanelProps) {
  const selected = scenarios.find((scenario) => scenario.kind === selectedScenarioKind);

  return (
    <div className="rounded-md border border-gray-800 bg-gray-950/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Scenario builder
          </div>
          <div className="mt-1 text-sm font-semibold text-white">
            {selected ? `${selected.label} selected` : "Choose a final plan"}
          </div>
        </div>
        {selected && (
          <div className="rounded border border-emerald-900/70 bg-emerald-950/40 px-2 py-1 text-[11px] font-semibold text-emerald-300">
            Final plan
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {scenarios.map((scenario) => {
          const isSelected = scenario.kind === selectedScenarioKind;

          return (
            <button
              key={scenario.kind}
              type="button"
              onClick={() => onSelectScenario(scenario.kind)}
              className={`w-full rounded border p-3 text-left transition ${
                isSelected
                  ? "border-blue-500 bg-blue-950/30"
                  : "border-gray-800 bg-gray-900/60 hover:border-gray-700"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-white">
                    {scenario.label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-500">
                    {labelStrategy(scenario.strategy)}
                  </div>
                </div>
                <div className="shrink-0 rounded border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300">
                  {isSelected ? "Selected" : "Use"}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                <MiniStat label="Reach" value={scenario.households.toLocaleString()} />
                <MiniStat label="Cost" value={fmtUsd(scenario.totalCostCents)} />
                <MiniStat label="Cover" value={fmtPct(scenario.coveragePct)} />
                <MiniStat label="Drops" value={scenario.drops.toLocaleString()} />
              </div>

              <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-gray-500">
                {scenario.tradeoff}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface RouteCoveragePanelProps {
  routes: PoliticalRouteSummary[];
  selectedRouteSet: Set<string>;
  summary: CoverageSelectionSummary;
  loading: boolean;
  note: string | null;
  error: string | null;
  onToggleRoute(routeId: string): void;
  onSelectAll(): void;
  onClear(): void;
}

function RouteCoveragePanel({
  routes,
  selectedRouteSet,
  summary,
  loading,
  note,
  error,
  onToggleRoute,
  onSelectAll,
  onClear,
}: RouteCoveragePanelProps) {
  return (
    <div className="rounded-md border border-gray-800 bg-gray-950/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Route coverage
          </div>
          <div className="mt-1 text-sm font-semibold text-white">
            {loading
              ? "Loading routes..."
              : routes.length > 0
                ? `${summary.selectedRouteCount} of ${summary.availableRouteCount} routes selected`
                : "No imported routes found"}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={routes.length === 0}
            className="rounded border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            All
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={routes.length === 0}
            className="rounded border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>

      {routes.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <MiniStat label="Households" value={summary.selectedHouseholds.toLocaleString()} />
          <MiniStat label="Coverage" value={fmtPct(summary.coveragePct)} />
          <MiniStat label="Gaps" value={summary.gapRouteCount.toLocaleString()} />
        </div>
      )}

      {routes.length > 0 && (
        <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
          {routes.slice(0, 80).map((route) => (
            <label
              key={route.id}
              className="flex cursor-pointer items-start gap-2 rounded border border-gray-800 bg-gray-900/60 p-2 hover:border-gray-700"
            >
              <input
                type="checkbox"
                checked={selectedRouteSet.has(route.id)}
                onChange={() => onToggleRoute(route.id)}
                className="mt-0.5 rounded border-gray-700 bg-gray-950 text-blue-500"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-white">
                  {route.label}
                </span>
                <span className="mt-0.5 block text-[11px] text-gray-500">
                  {route.households.toLocaleString()} households / density {route.densityScore}/100
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      {(note || error) && (
        <p className={`mt-3 text-[11px] leading-relaxed ${error ? "text-amber-300" : "text-gray-500"}`}>
          {error ?? note}
        </p>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-800 bg-gray-900/60 p-2">
      <div className="uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 truncate font-mono font-semibold text-gray-100">{value}</div>
    </div>
  );
}
