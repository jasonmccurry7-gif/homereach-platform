"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Download,
  ExternalLink,
  FileText,
  Flag,
  Gauge,
  Map,
  Maximize2,
  Minimize2,
  PackageCheck,
  Printer,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import type {
  CommandStatusMetric,
  PoliticalMailCommandCenterData,
  RiskAlert,
} from "@/lib/political/mail-command-center";

interface PoliticalMailCommandCenterProps {
  data: PoliticalMailCommandCenterData;
  audience?: "admin" | "customer";
}

const statusTone = {
  blue: "border-blue-300/25 bg-blue-950/45 text-blue-100",
  green: "border-emerald-300/25 bg-emerald-950/40 text-emerald-100",
  amber: "border-amber-300/30 bg-amber-950/35 text-amber-100",
  red: "border-red-300/30 bg-red-950/35 text-red-100",
  slate: "border-slate-300/15 bg-slate-950/40 text-slate-100",
} as const;

const severityTone = {
  critical: "border-red-300/35 bg-red-950/50 text-red-100",
  high: "border-orange-300/35 bg-orange-950/45 text-orange-100",
  medium: "border-amber-300/35 bg-amber-950/40 text-amber-100",
  low: "border-blue-300/25 bg-blue-950/35 text-blue-100",
} as const;

export function PoliticalMailCommandCenter({ data, audience = "admin" }: PoliticalMailCommandCenterProps) {
  const [warRoomOpen, setWarRoomOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState("");
  const isAdmin = audience === "admin";
  const routeBase = isAdmin ? "/admin/political" : "/political";
  const analyticsHref = isAdmin ? `${routeBase}/reporting` : `${routeBase}/analytics`;
  const [simulator, setSimulator] = useState({
    additionalWaves: 1,
    quantityChange: 5000,
    budgetChangeCents: 0,
    costPerPieceCents: Math.max(1, data.simulatorBaseline.costPerPieceCents || 70),
    inHomeDate: data.simulatorBaseline.nextInHomeDate ?? "",
  });

  const simulation = useMemo(() => {
    const additionalPieces = Math.max(0, simulator.quantityChange) * Math.max(0, simulator.additionalWaves);
    const additionalCostCents = additionalPieces * Math.max(0, simulator.costPerPieceCents);
    const totalCostCents = data.simulatorBaseline.totalCostCents + additionalCostCents + simulator.budgetChangeCents;
    const totalPieces = data.simulatorBaseline.totalPieces + additionalPieces;
    const householdsReached = Math.max(
      data.simulatorBaseline.householdsReached,
      data.simulatorBaseline.householdsReached + Math.round(simulator.quantityChange * 0.65),
    );
    const routesNeeded = Math.ceil(additionalPieces / 550);
    const costPerHouseholdCents = householdsReached > 0 ? Math.round(totalCostCents / householdsReached) : 0;

    return {
      additionalPieces,
      additionalCostCents,
      totalCostCents: Math.max(0, totalCostCents),
      totalPieces,
      householdsReached,
      routesNeeded,
      costPerHouseholdCents,
      budgetImpactCents: additionalCostCents + simulator.budgetChangeCents,
    };
  }, [data.simulatorBaseline, simulator]);

  const riskAlerts = useMemo(
    () => (isAdmin ? data.risks : data.risks.map(toCustomerSafeRiskAlert)),
    [data.risks, isAdmin],
  );

  const actionAudit = useMemo(
    () => (isAdmin ? data.actionAudit : buildCustomerActionAudit()),
    [data.actionAudit, isAdmin],
  );
  const calculationNotes = useMemo(
    () =>
      isAdmin
        ? data.calculationNotes
        : data.calculationNotes.filter((note) => !note.toLowerCase().includes("margin")),
    [data.calculationNotes, isAdmin],
  );

  const resetSimulation = () => {
    setSimulator({
      additionalWaves: 1,
      quantityChange: 5000,
      budgetChangeCents: 0,
      costPerPieceCents: Math.max(1, data.simulatorBaseline.costPerPieceCents || 70),
      inHomeDate: data.simulatorBaseline.nextInHomeDate ?? "",
    });
    setActionNotice("Scenario reset. No real campaign data was changed.");
  };

  const exportClientJson = () => {
    const clientFinancials = {
      totalProjectedCostCents: data.financials.totalProjectedCostCents,
      costPerHouseholdCents: data.financials.costPerHouseholdCents,
      costPerPieceCents: data.financials.costPerPieceCents,
      printCostCents: data.financials.printCostCents,
      postageCostCents: data.financials.postageCostCents,
      dataListCostCents: data.financials.dataListCostCents,
      costByWave: data.financials.costByWave,
      costByGeography: data.financials.costByGeography,
      guardrails: data.financials.guardrails,
      source: data.financials.source,
    };
    const payload = {
      exportedAt: new Date().toISOString(),
      compliance:
        "HomeReach provides operational mail execution, geographic delivery planning, campaign logistics support, and campaign-provided response reporting. The platform does not infer political beliefs, predict voter behavior, or claim vote impact.",
      branding: data.branding,
      statusMetrics: data.statusMetrics,
      scaleSignals: data.scaleSignals,
      coverage: data.coverage,
      waves: data.waves,
      deliveryConfidence: data.deliveryConfidence,
      financials: clientFinancials,
      qrAttribution: data.qrAttribution,
      risks: data.risks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "homereach-political-execution-summary.json";
    link.click();
    URL.revokeObjectURL(url);
    setActionNotice(
      isAdmin
        ? "Client-safe export downloaded. Admin margin fields were excluded."
        : "Client-safe export downloaded. Internal-only fields were excluded.",
    );
  };

  const printSummary = () => {
    setActionNotice("Print dialog opened. Use Save as PDF for a campaign execution summary.");
    window.print();
  };

  return (
    <section className="space-y-6 text-slate-100">
      <style jsx global>{`
        @media print {
          .admin-only-export-hide {
            display: none !important;
          }
          .political-command-print {
            background: white !important;
            color: #0f172a !important;
          }
          .political-command-print * {
            color: #0f172a !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <header className="overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.32),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(15,23,42,0.72))] p-5 shadow-2xl shadow-slate-950/45 political-command-print">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-blue-200">
              <span className="rounded-full border border-blue-300/25 bg-blue-950/50 px-3 py-1">
                Political Mail Command Center
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {data.dataMode === "live" ? "Live data" : data.dataMode === "partial" ? "Partial live data" : "Awaiting live data"}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
              {data.branding.campaignName}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-slate-200">
              <span>{data.branding.candidateName}</span>
              <span className="text-slate-500">/</span>
              <span>{data.branding.raceName}</span>
              <span className="text-slate-500">/</span>
              <span>{data.branding.geography}</span>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Operational mail execution, geographic coverage, route readiness, delivery confidence, financial visibility, and safe campaign-provided engagement reporting from one existing analytics surface.
            </p>
          </div>
          <div className="admin-only-export-hide flex flex-wrap gap-2">
            <ActionLink href={`${routeBase}/maps`} label="Open Maps" icon={<Map className="h-4 w-4" />} />
            <ActionLink href={`${routeBase}/routes`} label="Open Routes" icon={<Route className="h-4 w-4" />} />
            <ActionLink href={analyticsHref} label={isAdmin ? "Open Reporting" : "Review Analytics"} icon={<BarChart3 className="h-4 w-4" />} />
            <ActionLink href={isAdmin ? `${routeBase}/candidate-agent` : "/political/candidate-agent"} label="Chat with Campaign AI Agent" icon={<Sparkles className="h-4 w-4" />} />
            <button
              type="button"
              onClick={() => setWarRoomOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
            >
              <Maximize2 className="h-4 w-4" />
              Command View
            </button>
            <button
              type="button"
              onClick={printSummary}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={exportClientJson}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500"
            >
              <Download className="h-4 w-4" />
              Export Client JSON
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.statusMetrics.map((metric) => (
            <StatusMetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </header>

      {actionNotice && (
        <div className="admin-only-export-hide rounded-lg border border-emerald-300/25 bg-emerald-950/35 px-4 py-3 text-sm font-semibold text-emerald-100">
          {actionNotice}
        </div>
      )}

      <ComplianceBanner />

      {!isAdmin && data.dataMode !== "live" && (
        <div className="rounded-lg border border-amber-300/25 bg-amber-950/35 p-4 text-sm leading-6 text-amber-100">
          This dashboard is showing {data.dataMode === "partial" ? "partial live data" : "an empty/sample-ready state"}. It is safe for planning visibility, but proposal and checkout decisions still need verified route counts, mail pieces, print estimate, postage estimate, and campaign/contact details.
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          eyebrow="Scale Signals"
          title="High-Volume Campaign Snapshot"
          icon={<TrendingUp className="h-5 w-5" />}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.scaleSignals.map((metric) => (
              <MiniMetric key={metric.label} {...metric} />
            ))}
          </div>
        </Panel>

        <Panel
          eyebrow="Campaign Branding"
          title="Candidate-Specific Layer"
          icon={<Flag className="h-5 w-5" />}
        >
          <div className="flex items-start gap-4">
            <div
              className="h-16 w-16 rounded-xl border border-white/20 shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${data.branding.colors.primary}, ${data.branding.colors.accent})`,
              }}
            />
            <div>
              <p className="text-lg font-black text-white">{data.branding.candidateName}</p>
              <p className="mt-1 text-sm text-slate-300">{data.branding.raceName}</p>
              <p className="mt-2 text-xs text-slate-400">{data.branding.sourceLabel}</p>
              <p className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-blue-100">
                {data.branding.electionDate
                  ? `${data.branding.daysUntilElection} days until ${data.branding.electionDate}`
                  : "Election date not configured"}
              </p>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel
          eyebrow="Geographic Coverage"
          title="Coverage Intelligence"
          icon={<Map className="h-5 w-5" />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {data.coverage.metrics.map((metric) => (
              <MiniMetric key={metric.label} {...metric} />
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/45 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Undercovered Areas
            </p>
            {data.coverage.undercoveredAreas.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.coverage.undercoveredAreas.map((area) => (
                  <span
                    key={area}
                    className="rounded-full border border-amber-300/25 bg-amber-950/35 px-3 py-1 text-xs font-semibold text-amber-100"
                  >
                    {area}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-300">No undercovered geography was flagged from loaded route data.</p>
            )}
          </div>
        </Panel>

        <Panel
          eyebrow="Mail Waves"
          title="Wave Timeline"
          icon={<CalendarClock className="h-5 w-5" />}
        >
          {data.waves.length > 0 ? (
            <div className="space-y-3">
              {data.waves.map((wave) => (
                <div
                  key={wave.id}
                  className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 md:grid-cols-[auto_1fr_auto]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-blue-300/25 bg-blue-950/45 text-lg font-black text-blue-100">
                    {wave.waveNumber}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-black text-white">{wave.objective}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${severityTone[wave.riskLevel]}`}>
                        {wave.riskLevel}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{wave.audience}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      Drop: {wave.dropDate ?? "not scheduled"} / In-home: {wave.inHomeWindow}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-xl font-black text-white">{formatInteger(wave.mailQuantity)}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{wave.status.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{wave.source}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No mail wave timeline is connected yet." />
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel
          eyebrow="Delivery Confidence"
          title={`${data.deliveryConfidence.score}% Estimated In-Home Readiness`}
          icon={<Gauge className="h-5 w-5" />}
        >
          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <div className="h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-300 to-emerald-400"
                style={{ width: `${Math.max(0, Math.min(100, data.deliveryConfidence.score))}%` }}
              />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{data.deliveryConfidence.methodology}</p>
          </div>
          <div className="mt-4 space-y-3">
            {data.deliveryConfidence.components.map((component) => (
              <div key={component.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-white">{component.label}</p>
                  <p className="font-mono text-sm font-black text-blue-100">{component.score}%</p>
                </div>
                <p className="mt-1 text-xs text-slate-400">{component.detail}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          eyebrow="Route Intelligence"
          title="Real-Time Route Readiness"
          icon={<Route className="h-5 w-5" />}
        >
          {data.routes.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {data.routes.map((route) => (
                <div key={route.id || route.routeId} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-black text-white">{route.routeId}</p>
                      <p className="mt-1 text-sm text-slate-300">{route.geography}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-200">
                      {route.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <MetricPill label="HH" value={formatInteger(route.households)} />
                    <MetricPill label="Ready" value={`${route.readiness}%`} />
                    <MetricPill label="Flag" value={route.flag} />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-400">{route.objective}</p>
                  <p className="mt-2 text-[11px] text-slate-500">{route.notes}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No route catalog rows are loaded for route intelligence." />
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel
          eyebrow="Financial Visibility"
          title="Campaign Cost Model"
          icon={<Wallet className="h-5 w-5" />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyMetric label="Total projected cost" cents={data.financials.totalProjectedCostCents} source={data.financials.source} />
            <MoneyMetric label="Cost per household" cents={data.financials.costPerHouseholdCents} source="total projected cost / households reached" />
            <MoneyMetric label="Cost per piece" cents={data.financials.costPerPieceCents} source="total projected cost / scheduled pieces" />
            <MoneyMetric label="Print cost" cents={data.financials.printCostCents} source="phase estimate or pricing config" />
            <MoneyMetric label="Postage cost" cents={data.financials.postageCostCents} source="phase estimate or pricing config" />
            {isAdmin && (
              <div className="admin-only-export-hide rounded-lg border border-emerald-300/25 bg-emerald-950/35 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">Admin margin</p>
                <p className="mt-2 text-2xl font-black text-white">{formatCurrency(data.financials.estimatedMarginCents)}</p>
                <p className="mt-1 text-xs text-emerald-100/75">Hidden from client export and print.</p>
              </div>
            )}
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/45 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Formula Guardrails</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {data.financials.guardrails.map((guardrail) => (
                <li key={guardrail} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{guardrail}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel
          eyebrow="Scenario Simulator"
          title="Model Changes Without Saving"
          icon={<RefreshCw className="h-5 w-5" />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-slate-200">
              Additional waves
              <input
                type="number"
                min={0}
                max={6}
                value={simulator.additionalWaves}
                onChange={(event) => setSimulator((current) => ({ ...current, additionalWaves: Number(event.target.value) }))}
                className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-blue-300/60"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-200">
              Quantity change
              <input
                type="number"
                min={0}
                step={500}
                value={simulator.quantityChange}
                onChange={(event) => setSimulator((current) => ({ ...current, quantityChange: Number(event.target.value) }))}
                className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-blue-300/60"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-200">
              Budget adjustment
              <input
                type="number"
                step={500}
                value={Math.round(simulator.budgetChangeCents / 100)}
                onChange={(event) => setSimulator((current) => ({ ...current, budgetChangeCents: Number(event.target.value) * 100 }))}
                className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-blue-300/60"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-200">
              Cost per piece (cents)
              <input
                type="number"
                min={1}
                max={70}
                value={simulator.costPerPieceCents}
                onChange={(event) => setSimulator((current) => ({ ...current, costPerPieceCents: Number(event.target.value) }))}
                className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-blue-300/60"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-200 sm:col-span-2">
              Adjusted in-home date
              <input
                type="date"
                value={simulator.inHomeDate}
                onChange={(event) => setSimulator((current) => ({ ...current, inHomeDate: event.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-blue-300/60"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniMetric label="Simulated pieces" value={formatInteger(simulation.totalPieces)} detail={`${formatInteger(simulation.additionalPieces)} added`} source="local simulator only" />
            <MiniMetric label="Simulated cost" value={formatCurrency(simulation.totalCostCents)} detail={`${formatCurrency(simulation.budgetImpactCents)} budget impact`} source="local simulator only" />
            <MiniMetric label="Households reached" value={formatInteger(simulation.householdsReached)} detail={`${formatInteger(simulation.routesNeeded)} additional routes estimated`} source="local simulator only" />
            <MiniMetric label="Cost per household" value={formatCurrency(simulation.costPerHouseholdCents)} detail={simulator.inHomeDate || "No adjusted date"} source="local simulator only" />
          </div>
          <div className="admin-only-export-hide mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetSimulation}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Reset Simulation
            </button>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2 text-sm font-bold text-slate-400"
              title="Disabled until an explicit scenario persistence workflow is approved."
            >
              Save Scenario Disabled
            </button>
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel
          eyebrow="AI / Operations"
          title="Campaign Operations Agent"
          icon={<Sparkles className="h-5 w-5" />}
        >
          <div className="rounded-lg border border-blue-300/20 bg-blue-950/35 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-100">
                {data.agentPanel.status.replaceAll("_", " ")}
              </p>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-black text-white">
                {data.agentPanel.confidenceScore}% confidence
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-200">{data.agentPanel.summary}</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <AgentList title="Risks" items={data.agentPanel.risks} />
            <AgentList title="Next Actions" items={data.agentPanel.recommendations} />
          </div>
          {!isAdmin && (
            <div className="admin-only-export-hide mt-4">
              <ActionLink
                href="/political/candidate-agent"
                label="Chat with Campaign AI Agent"
                icon={<Sparkles className="h-4 w-4" />}
              />
            </div>
          )}
          <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/45 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Recent Agent Activity</p>
            {data.agentPanel.activity.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {data.agentPanel.activity.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-300">No agent activity has been logged yet.</p>
            )}
          </div>
        </Panel>

        <Panel
          eyebrow="QR & Attribution"
          title="Safe Engagement Reporting"
          icon={<Activity className="h-5 w-5" />}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniMetric label="QR scans" value={formatInteger(data.qrAttribution.scans)} detail="Platform tracked" source="QR analytics connection" />
            <MiniMetric label="Landing visits" value={formatInteger(data.qrAttribution.landingPageVisits)} detail="If connected" source="landing analytics" />
            <MiniMetric label="Responses" value={formatInteger(data.qrAttribution.campaignResponses)} detail="Campaign-provided only" source="campaign reporting" />
          </div>
          <p className="mt-4 rounded-lg border border-amber-300/25 bg-amber-950/30 p-4 text-sm leading-6 text-amber-100">
            {data.qrAttribution.detail}
          </p>
        </Panel>
      </section>

      <Panel
        eyebrow="Risk Alerts"
        title="Operational Blockers and Recommended Actions"
        icon={<AlertTriangle className="h-5 w-5" />}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {riskAlerts.map((alert) => (
            <RiskAlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel
          eyebrow="Methodology"
          title="Calculation Verification"
          icon={<FileText className="h-5 w-5" />}
        >
          <ul className="space-y-3 text-sm leading-6 text-slate-300">
            {calculationNotes.map((note) => (
              <li key={note} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                {note}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          eyebrow="Data Provenance"
          title="Source Status"
          icon={<PackageCheck className="h-5 w-5" />}
        >
          <div className="space-y-2">
            {data.dataSources.map((source) => (
              <div key={source.table} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-bold text-white">{source.label}</p>
                  <p className="mt-1 text-xs text-slate-400">{source.table} / {source.detail}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-200">
                  {source.status} / {source.rows}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel
        eyebrow="Button Verification"
        title="Action Audit"
        icon={<ShieldCheck className="h-5 w-5" />}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {actionAudit.map((action) => (
            <div key={action.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-white">{action.label}</p>
                <span className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-slate-300">
                  {action.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">{action.type} / {action.target}</p>
            </div>
          ))}
        </div>
      </Panel>

      {warRoomOpen && (
        <WarRoomOverlay
          data={data}
          onClose={() => setWarRoomOpen(false)}
        />
      )}
    </section>
  );
}

function toCustomerSafeRiskAlert(alert: RiskAlert): RiskAlert {
  if (!alert.actionHref || alert.disabled) return alert;
  if (alert.actionHref.startsWith("/political")) return alert;

  return {
    ...alert,
    actionHref: undefined,
    actionLabel: alert.actionHref.startsWith("/admin") ? "HomeReach review needed" : "Unavailable",
    disabled: true,
  };
}

function buildCustomerActionAudit(): PoliticalMailCommandCenterData["actionAudit"] {
  return [
    { label: "Overview tab", type: "route", target: "/political", status: "verified" },
    { label: "AI Agent tab", type: "route", target: "/political/candidate-agent", status: "verified" },
    { label: "Plan tab", type: "route", target: "/political/plan", status: "verified" },
    { label: "Maps tab", type: "route", target: "/political/maps", status: "verified" },
    { label: "Pricing tab", type: "route", target: "/political/pricing", status: "verified" },
    { label: "Routes tab", type: "route", target: "/political/routes", status: "verified" },
    { label: "Timeline tab", type: "route", target: "/political/timeline", status: "verified" },
    { label: "Calendar tab", type: "route", target: "/political/calendar", status: "verified" },
    { label: "Simulator tab", type: "route", target: "/political/simulator", status: "verified" },
    { label: "Analytics tab", type: "route", target: "/political/analytics", status: "verified" },
    { label: "Data tab", type: "route", target: "/political/data-sources", status: "verified" },
    { label: "Start Campaign Mail Plan", type: "route", target: "/political/plan or signup redirect", status: "verified" },
    { label: "Chat with Campaign AI Agent", type: "route", target: "/political/candidate-agent", status: "verified" },
    { label: "Open Maps", type: "route", target: "/political/maps", status: "verified" },
    { label: "Open Routes", type: "route", target: "/political/routes", status: "verified" },
    { label: "Print / Save PDF", type: "browser-print", target: "window.print()", status: "local_action" },
    { label: "Export Client JSON", type: "download", target: "client-safe JSON blob", status: "local_action" },
    { label: "War Room Mode", type: "modal", target: "same page data", status: "local_action" },
    { label: "Reset Simulation", type: "local-state", target: "scenario simulator state", status: "local_action" },
    { label: "Save Scenario", type: "disabled", target: "requires explicit persistence workflow", status: "disabled" },
  ];
}

function StatusMetricCard({ metric }: { metric: CommandStatusMetric }) {
  return (
    <div className={`rounded-lg border p-4 ${statusTone[metric.tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-80">{metric.label}</p>
        <span className="h-2.5 w-2.5 rounded-full bg-current shadow-[0_0_14px_currentColor]" />
      </div>
      <p className="mt-2 text-2xl font-black tracking-tight text-white">{metric.value}</p>
      <p className="mt-1 text-xs leading-5 opacity-80">{metric.detail}</p>
      <p className="mt-2 text-[11px] opacity-60">{metric.source}</p>
    </div>
  );
}

function ComplianceBanner() {
  return (
    <div className="rounded-lg border border-blue-300/25 bg-blue-950/35 p-4 text-sm leading-6 text-blue-100">
      <div className="flex gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" />
        <p>
          HomeReach provides operational mail execution, geographic delivery planning, campaign logistics support, and campaign-provided response reporting. The platform does not infer political beliefs, predict voter behavior, or claim vote impact.
        </p>
      </div>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-950/55 p-4 shadow-xl shadow-slate-950/30 political-command-print">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-white">{title}</h2>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-blue-100">{icon}</div>
      </div>
      {children}
    </section>
  );
}

function MiniMetric({
  label,
  value,
  detail,
  source,
}: {
  label: string;
  value: string;
  detail: string;
  source: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-300">{detail}</p>
      <p className="mt-2 text-[11px] text-slate-500">{source}</p>
    </div>
  );
}

function MoneyMetric({ label, cents, source }: { label: string; cents: number; source: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{formatCurrency(cents)}</p>
      <p className="mt-2 text-[11px] text-slate-500">{source}</p>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/55 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-white" title={value}>{value}</p>
    </div>
  );
}

function AgentList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function RiskAlertCard({ alert }: { alert: RiskAlert }) {
  const content = (
    <div className={`h-full rounded-lg border p-4 ${severityTone[alert.severity]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-current/20 bg-black/15 px-2 py-1 text-[11px] font-black uppercase tracking-wide">
          {alert.severity}
        </span>
        <span className="text-xs font-semibold opacity-75">{alert.owner}</span>
      </div>
      <p className="mt-3 text-sm font-bold text-white">{alert.reason}</p>
      <p className="mt-2 text-sm leading-6 opacity-85">{alert.recommendedAction}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs opacity-70">{alert.dueDate ? `Due ${alert.dueDate}` : "No due date"}</p>
        <span className="inline-flex items-center gap-1 rounded-lg border border-current/20 px-3 py-2 text-xs font-black uppercase tracking-wide">
          {alert.actionLabel}
          {!alert.disabled && <ExternalLink className="h-3 w-3" />}
        </span>
      </div>
    </div>
  );

  if (alert.disabled || !alert.actionHref) return content;
  return (
    <Link href={alert.actionHref} className="block h-full">
      {content}
    </Link>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-sm text-slate-300">
      {label}
    </div>
  );
}

function ActionLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
    >
      {icon}
      {label}
    </Link>
  );
}

function WarRoomOverlay({
  data,
  onClose,
}: {
  data: PoliticalMailCommandCenterData;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/95 p-4 text-slate-100 backdrop-blur">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">War Room Mode</p>
            <h2 className="mt-1 text-3xl font-black text-white">{data.branding.campaignName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
          >
            <Minimize2 className="h-4 w-4" />
            Exit Command View
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.statusMetrics.slice(0, 8).map((metric) => (
            <StatusMetricCard key={metric.label} metric={metric} />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2 text-blue-100">
              <Gauge className="h-5 w-5" />
              <h3 className="text-xl font-black text-white">Delivery Confidence {data.deliveryConfidence.score}%</h3>
            </div>
            <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-300 to-emerald-400"
                style={{ width: `${Math.max(0, Math.min(100, data.deliveryConfidence.score))}%` }}
              />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {data.scaleSignals.slice(0, 4).map((metric) => (
                <MiniMetric key={metric.label} {...metric} />
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2 text-red-100">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-xl font-black text-white">Risk Alerts</h3>
            </div>
            <div className="mt-4 space-y-3">
              {data.risks.slice(0, 4).map((risk) => (
                <div key={risk.id} className={`rounded-lg border p-3 ${severityTone[risk.severity]}`}>
                  <p className="text-sm font-bold text-white">{risk.reason}</p>
                  <p className="mt-1 text-xs opacity-80">{risk.recommendedAction}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-2 text-blue-100">
            <CalendarClock className="h-5 w-5" />
            <h3 className="text-xl font-black text-white">Active Mail Waves</h3>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {data.waves.length > 0 ? (
              data.waves.slice(0, 6).map((wave) => (
                <div key={wave.id} className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-sm font-black text-white">Wave {wave.waveNumber}: {wave.objective}</p>
                  <p className="mt-1 text-sm text-slate-300">{formatInteger(wave.mailQuantity)} pieces / {wave.inHomeWindow}</p>
                </div>
              ))
            ) : (
              <EmptyState label="No active mail waves connected." />
            )}
          </div>
        </section>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="fixed right-4 top-4 rounded-full border border-white/15 bg-white/10 p-3 text-white transition hover:bg-white/20"
        aria-label="Close command view"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(value || 0)));
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents >= 100 ? 0 : 2,
  }).format((cents || 0) / 100);
}
