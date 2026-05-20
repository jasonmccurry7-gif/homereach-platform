"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { DashboardAgentRuntime } from "@/lib/ai-orchestration/dashboard-agents"
import type {
  AutopilotApprovalRequest,
  AutopilotControlCenter,
  AutopilotInternalTask,
  AutopilotTaskQueue,
} from "@/lib/ai-orchestration/autopilot"
import type { UnifiedActionCenter, UnifiedActionItem } from "@/lib/ai-orchestration/action-center"
import type { DashboardMonitorRun, OperationalBriefing } from "@/lib/ai-orchestration/briefings"
import type { OperationalMemory } from "@/lib/ai-orchestration/operational-memory"
import type { UserActionReadiness } from "@/lib/ai-orchestration/user-action-items"
import type { AiWorkforceSmokeReport } from "@/lib/ai-orchestration/ai-workforce-smoke"
import type { SourceFreshnessReport } from "@/lib/ai-orchestration/source-freshness"
import type { AgentMissionControl, AgentMissionMode, AgentMissionRisk } from "@/lib/ai-orchestration/agent-mission-control"
import type { AiCommandCenterState } from "@/lib/ai-orchestration/command-center"
import type { AgentWorkOrderQueue, AgentWorkOrderPriority, AgentWorkOrderStatus } from "@/lib/ai-orchestration/agent-work-orders"
import type { GoLiveGateStatus, GoLiveReadinessReport } from "@/lib/ai-orchestration/go-live-readiness"
import type { AgentPermissionMatrix } from "@/lib/ai-orchestration/agent-permissions"
import type { WorkflowRecipeCatalog } from "@/lib/ai-orchestration/workflow-recipes"
import type { WorkforceFoundationState } from "@/lib/ai-orchestration/workforce-memory"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AgentRegistry {
  id: string
  name: string
  role: string
  layer: "executive" | "outreach" | "growth" | "operations" | "intelligence"
  is_active: boolean
  description: string
}

interface AgentDailyStat {
  id: string
  agent_id: string
  stat_date: string
  actions_completed: number
  messages_sent: number
  errors: number
  completion_pct: number
}

interface AgentRunLog {
  id: string
  agent_id: string
  agent_name: string
  run_at: string
  status: "success" | "failed" | "partial"
  actions_taken: number
  messages_sent: number
  error_message?: string
}

interface KaizenInsights {
  id: string
  findings: string[]
  auto_fixes_applied: number
  flagged_for_approval: string[]
  created_at: string
}

interface Props {
  agents: AgentRegistry[]
  stats: AgentDailyStat[]
  runLogs: AgentRunLog[]
  kaisenInsights: KaizenInsights | null
  dashboardAgents: DashboardAgentRuntime[]
  dashboardAgentSummary: DashboardAgentSummary
  actionCenter: UnifiedActionCenter
  autopilotControl: AutopilotControlCenter
  autopilotTasks: AutopilotTaskQueue
  operationalBriefings: OperationalBriefing[]
  monitorRuns: DashboardMonitorRun[]
  operationalMemory: OperationalMemory
  userActionReadiness: UserActionReadiness
  smokeReport: AiWorkforceSmokeReport
  sourceFreshness: SourceFreshnessReport
  missionControl: AgentMissionControl
  commandCenter: AiCommandCenterState
  workOrders: AgentWorkOrderQueue
  goLiveReadiness: GoLiveReadinessReport
  agentPermissions: AgentPermissionMatrix
  workflowRecipes: WorkflowRecipeCatalog
  workforceFoundation: WorkforceFoundationState
}

interface DashboardAgentSummary {
  total: number
  ready: number
  partial: number
  blocked: number
  averageReadiness: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer Configuration
// ─────────────────────────────────────────────────────────────────────────────

const LAYER_CONFIG = {
  executive: {
    label: "Executive Layer",
    color: "indigo",
    bgColor: "bg-indigo-900/20",
    borderColor: "border-indigo-800/30",
    textColor: "text-indigo-400",
    badgeBg: "bg-indigo-900/30",
    badgeText: "text-indigo-300",
  },
  outreach: {
    label: "Outreach Layer",
    color: "blue",
    bgColor: "bg-blue-900/20",
    borderColor: "border-blue-800/30",
    textColor: "text-blue-400",
    badgeBg: "bg-blue-900/30",
    badgeText: "text-blue-300",
  },
  growth: {
    label: "Growth Layer",
    color: "green",
    bgColor: "bg-green-900/20",
    borderColor: "border-green-800/30",
    textColor: "text-green-400",
    badgeBg: "bg-green-900/30",
    badgeText: "text-green-300",
  },
  operations: {
    label: "Operations Layer",
    color: "orange",
    bgColor: "bg-orange-900/20",
    borderColor: "border-orange-800/30",
    textColor: "text-orange-400",
    badgeBg: "bg-orange-900/30",
    badgeText: "text-orange-300",
  },
  intelligence: {
    label: "Intelligence Layer",
    color: "rose",
    bgColor: "bg-rose-900/20",
    borderColor: "border-rose-800/30",
    textColor: "text-rose-400",
    badgeBg: "bg-rose-900/30",
    badgeText: "text-rose-300",
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function getStatusBadge(
  isActive: boolean,
  completionPct: number
): { label: string; color: string; bgColor: string } {
  if (!isActive) {
    return { label: "INACTIVE", color: "text-gray-300", bgColor: "bg-gray-800" }
  }
  if (completionPct >= 80) {
    return { label: "AUTONOMOUS", color: "text-blue-300", bgColor: "bg-blue-800" }
  }
  if (completionPct >= 50) {
    return { label: "ACTIVE", color: "text-green-300", bgColor: "bg-green-800" }
  }
  return { label: "PARTIAL", color: "text-yellow-300", bgColor: "bg-yellow-800" }
}

function formatRelativeTime(isoTimestamp: string): string {
  const now = new Date()
  const then = new Date(isoTimestamp)
  const diff = now.getTime() - then.getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function StatBar({
  totalAgents,
  activeAgents,
  inactiveAgents,
  avgCompletion,
}: {
  totalAgents: number
  activeAgents: number
  inactiveAgents: number
  avgCompletion: number
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
        <p className="text-xs text-gray-500 mb-1">TOTAL AGENTS</p>
        <p className="text-3xl font-bold text-white">{totalAgents}</p>
      </div>
      <div className="p-4 bg-green-900/20 border border-green-800/30 rounded-lg">
        <p className="text-xs text-green-400 mb-1">ACTIVE</p>
        <p className="text-3xl font-bold text-green-300">{activeAgents}</p>
      </div>
      <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
        <p className="text-xs text-gray-500 mb-1">INACTIVE</p>
        <p className="text-3xl font-bold text-gray-400">{inactiveAgents}</p>
      </div>
      <div className="p-4 bg-blue-900/20 border border-blue-800/30 rounded-lg">
        <p className="text-xs text-blue-400 mb-1">AVG COMPLETION %</p>
        <p className="text-3xl font-bold text-blue-300">
          {Math.round(avgCompletion)}%
        </p>
      </div>
    </div>
  )
}

function getDashboardAgentStatusClass(status: DashboardAgentRuntime["status"]) {
  if (status === "ready") return "bg-green-900/30 text-green-300 border-green-700/40"
  if (status === "blocked") return "bg-red-900/30 text-red-300 border-red-700/40"
  return "bg-amber-900/30 text-amber-300 border-amber-700/40"
}

function formatAutonomy(level: string) {
  return level
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function DashboardAgentMatrix({
  agents,
  summary,
}: {
  agents: DashboardAgentRuntime[]
  summary: DashboardAgentSummary
}) {
  return (
    <section className="mb-8 rounded-2xl border border-blue-900/40 bg-blue-950/20 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-blue-300">
            Phase 1 AI Orchestration Layer
          </p>
          <h2 className="text-2xl font-bold text-white">Dashboard Agent Readiness Matrix</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            This does not replace the existing APEX agents. It assigns each major HomeReach dashboard a clear AI agent owner,
            autonomy level, guardrails, missing setup, and the next safe build phase.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <p className="text-xs text-gray-500">Dashboards</p>
            <p className="text-2xl font-bold text-white">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-green-800/40 bg-green-950/30 p-3">
            <p className="text-xs text-green-400">Ready</p>
            <p className="text-2xl font-bold text-green-300">{summary.ready}</p>
          </div>
          <div className="rounded-xl border border-amber-800/40 bg-amber-950/30 p-3">
            <p className="text-xs text-amber-400">Partial</p>
            <p className="text-2xl font-bold text-amber-300">{summary.partial}</p>
          </div>
          <div className="rounded-xl border border-blue-800/40 bg-blue-950/30 p-3">
            <p className="text-xs text-blue-400">Avg Ready</p>
            <p className="text-2xl font-bold text-blue-300">{summary.averageReadiness}%</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => {
          const blockers = [
            ...agent.missingRequiredEnv.map((key) => `Missing required env: ${key}`),
            ...(agent.manualBlockers ?? []),
          ]

          return (
            <article
              key={agent.id}
              className="rounded-xl border border-gray-800/70 bg-gray-950/70 p-4 shadow-lg shadow-black/10"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    {agent.dashboard}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-white">{agent.name}</h3>
                  <a className="mt-1 block text-xs font-semibold text-blue-300 hover:text-blue-200" href={agent.route}>
                    Open {agent.route}
                  </a>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-bold uppercase",
                    getDashboardAgentStatusClass(agent.status)
                  )}
                >
                  {agent.status}
                </span>
              </div>

              <p className="mb-4 text-sm leading-6 text-gray-400">{agent.mission}</p>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                  <p className="text-xs text-gray-500">Current</p>
                  <p className="text-sm font-semibold text-gray-200">{formatAutonomy(agent.currentAutonomy)}</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                  <p className="text-xs text-gray-500">Target</p>
                  <p className="text-sm font-semibold text-gray-200">{formatAutonomy(agent.targetAutonomy)}</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-gray-500">Readiness</span>
                  <span className="font-semibold text-gray-300">{agent.readinessScore}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${agent.readinessScore}%` }} />
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <p className="mb-1 font-semibold uppercase tracking-[0.12em] text-gray-500">Next phase</p>
                  <p className="leading-5 text-gray-300">{agent.phaseNext}</p>
                </div>

                {blockers.length > 0 && (
                  <div>
                    <p className="mb-1 font-semibold uppercase tracking-[0.12em] text-amber-400">Blocks autonomy</p>
                    <ul className="space-y-1">
                      {blockers.slice(0, 3).map((blocker) => (
                        <li key={blocker} className="leading-5 text-amber-100/80">
                          {blocker}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="mb-1 font-semibold uppercase tracking-[0.12em] text-gray-500">Guardrails</p>
                  <ul className="space-y-1">
                    {agent.guardrails.slice(0, 2).map((guardrail) => (
                      <li key={guardrail} className="leading-5 text-gray-400">
                        {guardrail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function actionUrgencyClass(urgency: UnifiedActionItem["urgency"]) {
  if (urgency === "critical") return "border-red-700/50 bg-red-950/30 text-red-200"
  if (urgency === "high") return "border-orange-700/50 bg-orange-950/30 text-orange-200"
  if (urgency === "medium") return "border-amber-700/50 bg-amber-950/20 text-amber-100"
  return "border-gray-700 bg-gray-900/50 text-gray-300"
}

function actionStatusClass(status: UnifiedActionItem["status"]) {
  if (status === "blocked") return "bg-red-900/30 text-red-300 border-red-700/40"
  if (status === "needs_review") return "bg-blue-900/30 text-blue-300 border-blue-700/40"
  if (status === "ready") return "bg-green-900/30 text-green-300 border-green-700/40"
  return "bg-gray-800 text-gray-300 border-gray-700"
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function monitorStatusClass(status: OperationalBriefing["status"]) {
  if (status === "critical") return "border-red-800/50 bg-red-950/30 text-red-200"
  if (status === "failed") return "border-red-800/50 bg-red-950/30 text-red-200"
  if (status === "warning") return "border-amber-800/50 bg-amber-950/30 text-amber-100"
  return "border-emerald-800/40 bg-emerald-950/20 text-emerald-100"
}

function AiCommandCenterSummaryPanel({ commandCenter }: { commandCenter: AiCommandCenterState }) {
  return (
    <section className={cn("mb-8 rounded-2xl border p-5", monitorStatusClass(commandCenter.status))}>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-sky-200">
            Phase 1M Unified AI Command State
          </p>
          <h2 className="text-2xl font-bold text-white">{commandCenter.headline}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-300">
            One normalized state object for Action Center, mission control, source freshness, smoke checks, and Jason-owned
            go-live items. This is read-only and built for future dashboard and agent orchestration.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold uppercase">
          {formatStatus(commandCenter.status)}
        </span>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs text-gray-400">Open Actions</p>
          <p className="text-2xl font-bold text-white">{commandCenter.summary.openActions}</p>
        </div>
        <div className="rounded-xl border border-red-800/30 bg-red-950/20 p-3">
          <p className="text-xs text-red-200">Critical</p>
          <p className="text-2xl font-bold text-red-100">{commandCenter.summary.criticalActions}</p>
        </div>
        <div className="rounded-xl border border-amber-800/30 bg-amber-950/20 p-3">
          <p className="text-xs text-amber-200">Jason Items</p>
          <p className="text-2xl font-bold text-amber-100">{commandCenter.summary.userActionsRequired}</p>
        </div>
        <div className="rounded-xl border border-blue-800/30 bg-blue-950/20 p-3">
          <p className="text-xs text-blue-200">Ready Agents</p>
          <p className="text-2xl font-bold text-blue-100">{commandCenter.summary.dashboardAgentsReady}</p>
        </div>
        <div className="rounded-xl border border-teal-800/30 bg-teal-950/20 p-3">
          <p className="text-xs text-teal-200">Source Issues</p>
          <p className="text-2xl font-bold text-teal-100">{commandCenter.summary.sourceFreshnessIssues}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Safe next steps</p>
          <div className="space-y-2">
            {commandCenter.safeNextSteps.slice(0, 4).map((step) => (
              <p key={step} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-gray-200">
                {step}
              </p>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-gray-400">System signals</p>
          <div className="space-y-2">
            {commandCenter.systemSignals.slice(0, 5).map((signal) => (
              <p key={signal} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-gray-200">
                {signal}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function goLiveStatusClass(status: GoLiveGateStatus) {
  if (status === "blocked") return "border-red-800/50 bg-red-950/30 text-red-100"
  if (status === "warning") return "border-amber-800/50 bg-amber-950/30 text-amber-100"
  return "border-emerald-800/40 bg-emerald-950/20 text-emerald-100"
}

function GoLiveReadinessPanel({ report }: { report: GoLiveReadinessReport }) {
  return (
    <section className={cn("mb-8 rounded-2xl border p-5", goLiveStatusClass(report.overallStatus))}>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-amber-200">
            Phase 1P Go-Live Gates
          </p>
          <h2 className="text-2xl font-bold text-white">AI Workforce Go-Live Readiness</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-300">
            Clear launch gates separate safe admin visibility from production rollout and expanded autonomy. Anything
            blocked or warning stays human-owned until resolved.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold uppercase">
            {formatStatus(report.overallStatus)}
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold uppercase">
            {formatStatus(report.recommendedLaunchMode)}
          </span>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs text-gray-400">Gates</p>
          <p className="text-2xl font-bold text-white">{report.summary.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-3">
          <p className="text-xs text-emerald-300">Passed</p>
          <p className="text-2xl font-bold text-emerald-200">{report.summary.passed}</p>
        </div>
        <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3">
          <p className="text-xs text-amber-300">Warnings</p>
          <p className="text-2xl font-bold text-amber-200">{report.summary.warning}</p>
        </div>
        <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-3">
          <p className="text-xs text-red-300">Blocked</p>
          <p className="text-2xl font-bold text-red-200">{report.summary.blocked}</p>
        </div>
        <div className="rounded-xl border border-orange-800/40 bg-orange-950/20 p-3">
          <p className="text-xs text-orange-300">Launch Blocks</p>
          <p className="text-2xl font-bold text-orange-200">{report.summary.productionBlockers}</p>
        </div>
        <div className="rounded-xl border border-blue-800/40 bg-blue-950/20 p-3">
          <p className="text-xs text-blue-300">Jason-Owned</p>
          <p className="text-2xl font-bold text-blue-200">{report.summary.jasonOwned}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {report.gates.map((gate) => (
          <article key={gate.id} className={cn("rounded-xl border p-4", goLiveStatusClass(gate.status))}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                {gate.status}
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                {gate.owner}
              </span>
            </div>
            <h3 className="text-base font-bold text-white">{gate.title}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-300">{gate.detail}</p>
            <p className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm font-semibold text-white">
              {gate.nextStep}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function autopilotRiskClass(risk: AutopilotApprovalRequest["riskLevel"]) {
  if (risk === "critical") return "border-red-700/50 bg-red-950/30 text-red-200"
  if (risk === "high") return "border-orange-700/50 bg-orange-950/30 text-orange-200"
  if (risk === "medium") return "border-amber-700/50 bg-amber-950/20 text-amber-100"
  return "border-gray-700 bg-gray-900/50 text-gray-300"
}

function autopilotStatusClass(status: AutopilotApprovalRequest["approvalStatus"]) {
  if (status === "approved") return "bg-emerald-900/30 text-emerald-300 border-emerald-700/40"
  if (status === "rejected") return "bg-red-900/30 text-red-300 border-red-700/40"
  if (status === "executed") return "bg-purple-900/30 text-purple-300 border-purple-700/40"
  return "bg-blue-900/30 text-blue-300 border-blue-700/40"
}

function summarizeVisibleActions(items: UnifiedActionItem[]): UnifiedActionCenter["summary"] {
  return {
    total: items.length,
    critical: items.filter((item) => item.urgency === "critical").length,
    high: items.filter((item) => item.urgency === "high").length,
    needsReview: items.filter((item) => item.status === "needs_review").length,
    blocked: items.filter((item) => item.status === "blocked").length,
    humanApprovalRequired: items.filter((item) => item.requiresHumanApproval).length,
  }
}

function OperationalBriefingPanel({
  initialBriefings,
  initialMonitorRuns,
}: {
  initialBriefings: OperationalBriefing[]
  initialMonitorRuns: DashboardMonitorRun[]
}) {
  const [briefings, setBriefings] = useState<OperationalBriefing[]>(initialBriefings)
  const [monitorRuns, setMonitorRuns] = useState<DashboardMonitorRun[]>(initialMonitorRuns)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setBriefings(initialBriefings)
    setMonitorRuns(initialMonitorRuns)
  }, [initialBriefings, initialMonitorRuns])

  const latest = briefings[0]

  const runBriefing = useCallback(async () => {
    setIsRunning(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/ai-orchestration/briefings/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "manual" }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Briefing run failed")
      }
      if (data.briefing) setBriefings((current) => [data.briefing, ...current].slice(0, 4))
      if (data.monitorRun) setMonitorRuns((current) => [data.monitorRun, ...current].slice(0, 6))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Briefing run failed")
    } finally {
      setIsRunning(false)
    }
  }, [])

  return (
    <section className="mb-8 rounded-2xl border border-sky-900/40 bg-sky-950/10 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-sky-300">
            Phase 4 AI Briefings
          </p>
          <h2 className="text-2xl font-bold text-white">Morning and Evening Monitor Briefing</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Scheduled monitor snapshots turn the Action Center into an executive briefing. This is dashboard-only:
            no messages, orders, bids, or payments are executed.
          </p>
        </div>
        <button
          type="button"
          onClick={runBriefing}
          disabled={isRunning}
          className="rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-gray-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRunning ? "Running..." : "Run Briefing"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-800/40 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {!latest ? (
        <div className="rounded-xl border border-sky-800/30 bg-sky-950/20 p-5">
          <p className="font-semibold text-sky-100">No operational briefing has been generated yet.</p>
          <p className="mt-1 text-sm text-sky-100/70">
            Run the first briefing manually, then the scheduled monitor can keep snapshots fresh.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <article className={cn("rounded-xl border p-4", monitorStatusClass(latest.status))}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                {formatStatus(latest.status)}
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                {formatStatus(latest.briefingType)}
              </span>
              <span className="text-xs text-gray-400">{new Date(latest.createdAt).toLocaleString()}</span>
            </div>
            <h3 className="text-xl font-bold text-white">{latest.headline}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-300">{latest.summary}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-xs text-gray-500">Actions</p>
                <p className="text-2xl font-bold text-white">{latest.actionSummary.total}</p>
              </div>
              <div className="rounded-lg border border-red-800/30 bg-red-950/20 p-3">
                <p className="text-xs text-red-300">Critical</p>
                <p className="text-2xl font-bold text-red-200">{latest.actionSummary.critical}</p>
              </div>
              <div className="rounded-lg border border-orange-800/30 bg-orange-950/20 p-3">
                <p className="text-xs text-orange-300">High</p>
                <p className="text-2xl font-bold text-orange-200">{latest.actionSummary.high}</p>
              </div>
              <div className="rounded-lg border border-amber-800/30 bg-amber-950/20 p-3">
                <p className="text-xs text-amber-300">Human Gates</p>
                <p className="text-2xl font-bold text-amber-200">{latest.actionSummary.humanApprovalRequired}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Next actions</p>
                <div className="space-y-2">
                  {latest.nextActions.slice(0, 4).map((action, index) => (
                    <p key={`${action}-${index}`} className="rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-gray-200">
                      {action}
                    </p>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Risks / wins</p>
                <div className="space-y-2">
                  {[...latest.risks.slice(0, 2), ...latest.wins.slice(0, 2)].map((item, index) => (
                    <p key={`${item}-${index}`} className="rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-gray-300">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <aside className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
            <h3 className="mb-3 text-lg font-bold text-white">Monitor Runs</h3>
            <div className="space-y-2">
              {monitorRuns.slice(0, 5).map((run) => (
                <div key={run.id} className="rounded-lg border border-gray-800 bg-black/20 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className={cn("rounded-full border px-2 py-1 text-xs font-bold uppercase", monitorStatusClass(run.status))}>
                      {formatStatus(run.status)}
                    </span>
                    <span className="text-xs text-gray-500">{formatRelativeTime(run.createdAt)}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{formatStatus(run.runType)} monitor</p>
                  <p className="mt-1 text-xs leading-5 text-gray-400">{run.summary}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}

function memorySeverityClass(severity: string) {
  if (severity === "critical") return "border-red-800/40 bg-red-950/25 text-red-100"
  if (severity === "warning") return "border-amber-800/40 bg-amber-950/25 text-amber-100"
  if (severity === "success") return "border-emerald-800/40 bg-emerald-950/25 text-emerald-100"
  return "border-slate-800 bg-slate-950/30 text-slate-100"
}

function OperationalMemoryPanel({ memory }: { memory: OperationalMemory }) {
  return (
    <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-slate-300">
            Phase 1D Shared Memory
          </p>
          <h2 className="text-2xl font-bold text-white">Operational Memory Timeline</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            A read-only memory layer stitched from existing approval events, Action Center notes, briefings, Learning Engine outcomes,
            internal handoffs, and agent runs. It gives future agents context without creating another source of truth.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-7">
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <p className="text-xs text-gray-500">Events</p>
            <p className="text-2xl font-bold text-white">{memory.summary.total}</p>
          </div>
          <div className="rounded-xl border border-violet-800/40 bg-violet-950/30 p-3">
            <p className="text-xs text-violet-300">Approvals</p>
            <p className="text-2xl font-bold text-violet-200">{memory.summary.approvals}</p>
          </div>
          <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/30 p-3">
            <p className="text-xs text-cyan-300">Tasks</p>
            <p className="text-2xl font-bold text-cyan-200">{memory.summary.tasks}</p>
          </div>
          <div className="rounded-xl border border-blue-800/40 bg-blue-950/30 p-3">
            <p className="text-xs text-blue-300">Learning</p>
            <p className="text-2xl font-bold text-blue-200">{memory.summary.learning}</p>
          </div>
          <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/30 p-3">
            <p className="text-xs text-cyan-300">Workforce</p>
            <p className="text-2xl font-bold text-cyan-200">{memory.summary.workforce}</p>
          </div>
          <div className="rounded-xl border border-sky-800/40 bg-sky-950/30 p-3">
            <p className="text-xs text-sky-300">Briefings</p>
            <p className="text-2xl font-bold text-sky-200">{memory.summary.monitorEvents}</p>
          </div>
          <div className="rounded-xl border border-red-800/40 bg-red-950/30 p-3">
            <p className="text-xs text-red-300">Failures</p>
            <p className="text-2xl font-bold text-red-200">{memory.summary.failures}</p>
          </div>
        </div>
      </div>

      {memory.events.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-black/20 p-5">
          <p className="font-semibold text-slate-100">No operational memory events are visible yet.</p>
          <p className="mt-1 text-sm text-slate-400">
            The timeline fills in as Action Center, approval, briefing, Learning Engine, and agent run tables collect events.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {memory.events.slice(0, 10).map((event) => (
            <article key={event.id} className={cn("rounded-xl border p-4", memorySeverityClass(event.severity))}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                  {event.source.replace(/_/g, " ")}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                  {event.actor}
                </span>
                <span className="text-xs text-gray-400">{formatRelativeTime(event.occurredAt)}</span>
              </div>
              <h3 className="text-base font-bold text-white">{event.title}</h3>
              <p className="mt-1 text-sm leading-6 text-gray-300">{event.summary}</p>
              <a href={event.route} className="mt-3 inline-block text-xs font-bold text-sky-200 underline">
                Open source workflow
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function workforceStatusClass(status: string) {
  if (status === "blocked" || status === "critical") return "border-red-800/40 bg-red-950/25 text-red-100"
  if (status === "needs_review" || status === "queued" || status === "warning") return "border-amber-800/40 bg-amber-950/25 text-amber-100"
  if (status === "done" || status === "completed" || status === "success") return "border-emerald-800/40 bg-emerald-950/25 text-emerald-100"
  return "border-cyan-800/40 bg-cyan-950/20 text-cyan-100"
}

function AiWorkforceFoundationPanel({ foundation }: { foundation: WorkforceFoundationState }) {
  return (
    <section className="mb-8 rounded-2xl border border-cyan-900/40 bg-cyan-950/10 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">
            Phase 2 Persistent Memory
          </p>
          <h2 className="text-2xl font-bold text-white">AI Workforce Data Foundation</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Durable memory, event, task, and ingestion queues for supervised agents. This is infrastructure only:
            it stores context and work items, but it does not send, publish, order, bid, or bill.
          </p>
        </div>
        <span
          className={cn(
            "w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase",
            foundation.databaseReady
              ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-200"
              : "border-amber-800/50 bg-amber-950/30 text-amber-100"
          )}
        >
          {foundation.databaseReady ? "Database Ready" : "Migration Needed"}
        </span>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
          <p className="text-xs text-gray-500">Entities</p>
          <p className="text-2xl font-bold text-white">{foundation.summary.entities}</p>
        </div>
        <div className="rounded-xl border border-blue-800/40 bg-blue-950/30 p-3">
          <p className="text-xs text-blue-300">Memory</p>
          <p className="text-2xl font-bold text-blue-200">{foundation.summary.activeMemory}</p>
        </div>
        <div className="rounded-xl border border-red-800/40 bg-red-950/30 p-3">
          <p className="text-xs text-red-300">Critical</p>
          <p className="text-2xl font-bold text-red-200">{foundation.summary.criticalMemory}</p>
        </div>
        <div className="rounded-xl border border-violet-800/40 bg-violet-950/30 p-3">
          <p className="text-xs text-violet-300">Events 24h</p>
          <p className="text-2xl font-bold text-violet-200">{foundation.summary.events24h}</p>
        </div>
        <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/30 p-3">
          <p className="text-xs text-cyan-300">Tasks</p>
          <p className="text-2xl font-bold text-cyan-200">{foundation.summary.openTasks}</p>
        </div>
        <div className="rounded-xl border border-orange-800/40 bg-orange-950/30 p-3">
          <p className="text-xs text-orange-300">Blocked</p>
          <p className="text-2xl font-bold text-orange-200">{foundation.summary.blockedTasks}</p>
        </div>
        <div className="rounded-xl border border-fuchsia-800/40 bg-fuchsia-950/30 p-3">
          <p className="text-xs text-fuchsia-300">Ingest</p>
          <p className="text-2xl font-bold text-fuchsia-200">{foundation.summary.ingestionQueued}</p>
        </div>
        <div className="rounded-xl border border-amber-800/40 bg-amber-950/30 p-3">
          <p className="text-xs text-amber-300">Review</p>
          <p className="text-2xl font-bold text-amber-200">{foundation.summary.ingestionNeedsReview}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
          <h3 className="mb-3 text-lg font-bold text-white">Active Memory</h3>
          {foundation.memoryItems.length === 0 ? (
            <p className="text-sm leading-6 text-gray-400">No durable memory items are stored yet.</p>
          ) : (
            <div className="space-y-3">
              {foundation.memoryItems.slice(0, 4).map((item) => (
                <article key={item.id} className={cn("rounded-lg border p-3", workforceStatusClass(item.impactLevel))}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                      {formatStatus(item.memoryType)}
                    </span>
                    <span className="text-xs text-gray-400">{Math.round(item.confidence * 100)}% confidence</span>
                  </div>
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm leading-5 text-gray-300">{item.summary}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
          <h3 className="mb-3 text-lg font-bold text-white">Agent Task Queue</h3>
          {foundation.tasks.length === 0 ? (
            <p className="text-sm leading-6 text-gray-400">No persistent agent tasks are queued yet.</p>
          ) : (
            <div className="space-y-3">
              {foundation.tasks.slice(0, 4).map((task) => (
                <article key={task.id} className={cn("rounded-lg border p-3", workforceStatusClass(task.status))}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                      {formatStatus(task.status)}
                    </span>
                    <span className="text-xs text-gray-400">{task.agentId}</span>
                  </div>
                  <p className="font-semibold text-white">{task.title}</p>
                  <p className="mt-1 text-sm leading-5 text-gray-300">{task.recommendedAction}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
          <h3 className="mb-3 text-lg font-bold text-white">Ingestion Queue</h3>
          {foundation.ingestionQueue.length === 0 ? (
            <p className="text-sm leading-6 text-gray-400">No sources are waiting in the persistent ingestion queue.</p>
          ) : (
            <div className="space-y-3">
              {foundation.ingestionQueue.slice(0, 4).map((item) => (
                <article key={item.id} className={cn("rounded-lg border p-3", workforceStatusClass(item.status))}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                      {formatStatus(item.sourceType)}
                    </span>
                    <span className="text-xs text-gray-400">{formatRelativeTime(item.updatedAt)}</span>
                  </div>
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm leading-5 text-gray-300">{item.nextStep}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {foundation.sourceHealth.some((source) => source.status === "unavailable") && (
        <div className="mt-4 rounded-xl border border-amber-800/40 bg-amber-950/20 p-4">
          <p className="font-semibold text-amber-100">Phase 2 storage is not fully available yet.</p>
          <p className="mt-1 text-sm leading-6 text-amber-100/80">
            Apply migration 103 and confirm Supabase service-role env before relying on the persistent memory foundation.
          </p>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-gray-800 bg-black/20 p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Safe Next Steps</p>
        <div className="grid gap-2 md:grid-cols-3">
          {foundation.safeNextSteps.map((step) => (
            <p key={step} className="rounded-lg border border-gray-800 bg-gray-950/60 p-3 text-sm leading-5 text-gray-300">
              {step}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}

function userActionPriorityClass(priority: string) {
  if (priority === "critical") return "border-red-800/50 bg-red-950/30 text-red-100"
  if (priority === "high") return "border-orange-800/50 bg-orange-950/30 text-orange-100"
  if (priority === "medium") return "border-amber-800/40 bg-amber-950/20 text-amber-100"
  return "border-slate-800 bg-slate-950/30 text-slate-100"
}

function UserActionReadinessPanel({ readiness }: { readiness: UserActionReadiness }) {
  return (
    <section className="mb-8 rounded-2xl border border-orange-900/40 bg-orange-950/10 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-orange-300">
            Jason Action Required
          </p>
          <h2 className="text-2xl font-bold text-white">Go-Live and Autonomy Checklist</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            A running list of credentials, approvals, migrations, and policy confirmations that need human action.
            These are separated from engineering work so I can keep building until one of them becomes a true blocker.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <p className="text-xs text-gray-500">Items</p>
            <p className="text-2xl font-bold text-white">{readiness.summary.total}</p>
          </div>
          <div className="rounded-xl border border-red-800/40 bg-red-950/30 p-3">
            <p className="text-xs text-red-300">Critical</p>
            <p className="text-2xl font-bold text-red-200">{readiness.summary.critical}</p>
          </div>
          <div className="rounded-xl border border-orange-800/40 bg-orange-950/30 p-3">
            <p className="text-xs text-orange-300">High</p>
            <p className="text-2xl font-bold text-orange-200">{readiness.summary.high}</p>
          </div>
          <div className="rounded-xl border border-fuchsia-800/40 bg-fuchsia-950/30 p-3">
            <p className="text-xs text-fuchsia-300">Go-Live</p>
            <p className="text-2xl font-bold text-fuchsia-200">{readiness.summary.blocksGoLive}</p>
          </div>
          <div className="rounded-xl border border-violet-800/40 bg-violet-950/30 p-3">
            <p className="text-xs text-violet-300">Autonomy</p>
            <p className="text-2xl font-bold text-violet-200">{readiness.summary.blocksAutonomy}</p>
          </div>
        </div>
      </div>

      {readiness.items.length === 0 ? (
        <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/30 p-5">
          <p className="font-semibold text-emerald-200">No required user actions are currently visible.</p>
          <p className="mt-1 text-sm text-emerald-100/70">Engineering can continue without waiting on credentials or approvals.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {readiness.items.slice(0, 10).map((item) => (
            <article key={item.id} className={cn("rounded-xl border p-4", userActionPriorityClass(item.priority))}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                  {item.priority}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                  {item.category.replace(/_/g, " ")}
                </span>
                {item.blocksGoLive && (
                  <span className="rounded-full border border-red-700/40 bg-red-900/30 px-2 py-1 text-xs font-bold text-red-100">
                    blocks go-live
                  </span>
                )}
                {item.blocksAutonomy && (
                  <span className="rounded-full border border-violet-700/40 bg-violet-900/30 px-2 py-1 text-xs font-bold text-violet-100">
                    blocks autonomy
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white">{item.title}</h3>
              <p className="mt-1 text-sm leading-6 text-gray-300">{item.detail}</p>
              <p className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-gray-200">
                {item.nextStep}
              </p>
              {item.relatedRoute && (
                <a href={item.relatedRoute} className="mt-3 inline-block text-xs font-bold text-sky-200 underline">
                  Open related workflow
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function smokeStatusClass(status: string) {
  if (status === "failed") return "border-red-800/50 bg-red-950/30 text-red-100"
  if (status === "warning") return "border-amber-800/50 bg-amber-950/30 text-amber-100"
  return "border-emerald-800/40 bg-emerald-950/20 text-emerald-100"
}

function AiWorkforceSmokePanel({ report }: { report: AiWorkforceSmokeReport }) {
  return (
    <section className="mb-8 rounded-2xl border border-cyan-900/40 bg-cyan-950/10 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">
            Phase 1H Smoke Check
          </p>
          <h2 className="text-2xl font-bold text-white">AI Workforce OS Readiness Check</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            A read-only check for the orchestration foundation: environment readiness, core tables, Learning Engine,
            Action Center, briefings, approval gates, handoffs, and internal task linkage.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className={cn("rounded-xl border p-3", smokeStatusClass(report.overallStatus))}>
            <p className="text-xs opacity-70">Overall</p>
            <p className="text-xl font-bold uppercase">{report.overallStatus}</p>
          </div>
          <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-3">
            <p className="text-xs text-emerald-300">OK</p>
            <p className="text-2xl font-bold text-emerald-200">{report.summary.ok}</p>
          </div>
          <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3">
            <p className="text-xs text-amber-300">Warn</p>
            <p className="text-2xl font-bold text-amber-200">{report.summary.warning}</p>
          </div>
          <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-3">
            <p className="text-xs text-red-300">Fail</p>
            <p className="text-2xl font-bold text-red-200">{report.summary.failed}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {report.checks.slice(0, 10).map((check) => (
          <article key={check.key} className={cn("rounded-xl border p-4", smokeStatusClass(check.status))}>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                {check.status}
              </span>
              <span className="text-xs text-gray-400">{check.key}</span>
            </div>
            <h3 className="text-base font-bold text-white">{check.label}</h3>
            <p className="mt-1 text-sm leading-6 text-gray-300">{check.summary}</p>
            <p className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-gray-200">
              {check.nextStep}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function freshnessStatusClass(status: string) {
  if (status === "unavailable" || status === "stale") return "border-red-800/50 bg-red-950/30 text-red-100"
  if (status === "aging" || status === "missing") return "border-amber-800/50 bg-amber-950/30 text-amber-100"
  return "border-emerald-800/40 bg-emerald-950/20 text-emerald-100"
}

function SourceFreshnessPanel({ report }: { report: SourceFreshnessReport }) {
  return (
    <section className="mb-8 rounded-2xl border border-teal-900/40 bg-teal-950/10 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-teal-300">
            Phase 1I Source Freshness
          </p>
          <h2 className="text-2xl font-bold text-white">Agent Data Freshness</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Read-only freshness checks for the data sources agents depend on: political intelligence, Learning Engine,
            Gov Contracts, messaging webhooks, and procurement email automation.
          </p>
        </div>
        <div className="grid grid-cols-5 gap-3">
          <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-3">
            <p className="text-xs text-emerald-300">Fresh</p>
            <p className="text-2xl font-bold text-emerald-200">{report.summary.fresh}</p>
          </div>
          <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3">
            <p className="text-xs text-amber-300">Aging</p>
            <p className="text-2xl font-bold text-amber-200">{report.summary.aging}</p>
          </div>
          <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-3">
            <p className="text-xs text-red-300">Stale</p>
            <p className="text-2xl font-bold text-red-200">{report.summary.stale}</p>
          </div>
          <div className="rounded-xl border border-orange-800/40 bg-orange-950/20 p-3">
            <p className="text-xs text-orange-300">Missing</p>
            <p className="text-2xl font-bold text-orange-200">{report.summary.missing}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <p className="text-xs text-gray-500">Offline</p>
            <p className="text-2xl font-bold text-gray-200">{report.summary.unavailable}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {report.items.map((item) => (
          <article key={item.key} className={cn("rounded-xl border p-4", freshnessStatusClass(item.status))}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                {item.status}
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                {item.sourceTable}
              </span>
              <span className="text-xs text-gray-400">
                stale after {item.staleAfterHours}h
              </span>
            </div>
            <h3 className="text-base font-bold text-white">{item.label}</h3>
            <p className="mt-1 text-sm leading-6 text-gray-300">{item.summary}</p>
            <p className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-gray-200">
              {item.nextStep}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function missionModeClass(mode: AgentMissionMode) {
  if (mode === "blocked") return "border-red-800/50 bg-red-950/30 text-red-100"
  if (mode === "draft_only") return "border-amber-800/50 bg-amber-950/30 text-amber-100"
  if (mode === "human_approval") return "border-blue-800/50 bg-blue-950/30 text-blue-100"
  if (mode === "scheduled_monitor") return "border-cyan-800/50 bg-cyan-950/30 text-cyan-100"
  if (mode === "assisted_ready") return "border-emerald-800/50 bg-emerald-950/30 text-emerald-100"
  return "border-gray-800 bg-gray-950/60 text-gray-200"
}

function missionRiskClass(risk: AgentMissionRisk) {
  if (risk === "high") return "bg-red-900/30 text-red-200 border-red-700/40"
  if (risk === "medium") return "bg-amber-900/30 text-amber-100 border-amber-700/40"
  return "bg-emerald-900/30 text-emerald-200 border-emerald-700/40"
}

function AgentMissionControlPanel({ missionControl }: { missionControl: AgentMissionControl }) {
  return (
    <section className="mb-8 rounded-2xl border border-violet-900/40 bg-violet-950/10 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-violet-300">
            Phase 1K Agent Mission Control
          </p>
          <h2 className="text-2xl font-bold text-white">Autonomy Modes + Human Gates</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Each dashboard agent now has a clear operating mode, allowed actions, prohibited actions, source warnings,
            and next safe task. This makes the AI Workforce OS supervisable before deeper autonomy is enabled.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <p className="text-xs text-gray-500">Agents</p>
            <p className="text-2xl font-bold text-white">{missionControl.summary.total}</p>
          </div>
          <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-3">
            <p className="text-xs text-red-300">Blocked</p>
            <p className="text-2xl font-bold text-red-200">{missionControl.summary.blocked}</p>
          </div>
          <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3">
            <p className="text-xs text-amber-300">Draft Only</p>
            <p className="text-2xl font-bold text-amber-200">{missionControl.summary.draftOnly}</p>
          </div>
          <div className="rounded-xl border border-blue-800/40 bg-blue-950/20 p-3">
            <p className="text-xs text-blue-300">Approval</p>
            <p className="text-2xl font-bold text-blue-200">{missionControl.summary.humanApproval}</p>
          </div>
          <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-3">
            <p className="text-xs text-cyan-300">Monitor</p>
            <p className="text-2xl font-bold text-cyan-200">{missionControl.summary.scheduledMonitor}</p>
          </div>
          <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-3">
            <p className="text-xs text-emerald-300">Assisted</p>
            <p className="text-2xl font-bold text-emerald-200">{missionControl.summary.assistedReady}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {missionControl.agents.map((agent) => (
          <article key={agent.agentId} className={cn("rounded-xl border p-4", missionModeClass(agent.mode))}>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">{agent.dashboard}</p>
                <h3 className="mt-1 text-lg font-bold text-white">{agent.name}</h3>
                <a className="mt-1 block text-xs font-semibold text-blue-200 hover:text-blue-100" href={agent.route}>
                  Open {agent.route}
                </a>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-bold uppercase">
                  {formatStatus(agent.mode)}
                </span>
                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold uppercase", missionRiskClass(agent.risk))}>
                  {agent.risk} risk
                </span>
              </div>
            </div>

            <p className="mb-3 text-sm leading-6 text-gray-300">{agent.mission}</p>
            <p className="mb-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm font-semibold text-white">
              Next safe task: {agent.nextSafeTask}
            </p>
            <p className="mb-4 text-xs leading-5 text-gray-300">{agent.humanGate}</p>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">Allowed</p>
                <ul className="space-y-1 text-xs leading-5 text-gray-300">
                  {agent.allowedActions.slice(0, 4).map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-red-200">Prohibited</p>
                <ul className="space-y-1 text-xs leading-5 text-gray-300">
                  {agent.prohibitedActions.slice(0, 4).map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            </div>

            {(agent.blockers.length > 0 || agent.sourceWarnings.length > 0) && (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-200">Needs Attention</p>
                <ul className="space-y-1 text-xs leading-5 text-gray-300">
                  {agent.blockers.slice(0, 3).map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                  {agent.sourceWarnings.slice(0, 3).map((source) => (
                    <li key={source.key}>{source.label}: {source.status}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

function CapabilityDot({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-1 text-[11px] font-bold uppercase",
        enabled
          ? "border-emerald-700/40 bg-emerald-900/30 text-emerald-200"
          : "border-gray-700 bg-gray-950/70 text-gray-500"
      )}
    >
      {label}
    </span>
  )
}

function AgentPermissionsPanel({ matrix }: { matrix: AgentPermissionMatrix }) {
  return (
    <section className="mb-8 rounded-2xl border border-indigo-900/40 bg-indigo-950/10 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-indigo-300">
            Phase 1R Agent Permissions
          </p>
          <h2 className="text-2xl font-bold text-white">Digital Employee Permission Matrix</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Every dashboard agent gets explicit capabilities. External execution is disabled by default while read,
            draft, approval, monitoring, and internal handoff permissions are separated.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <p className="text-xs text-gray-500">Agents</p>
            <p className="text-2xl font-bold text-white">{matrix.summary.total}</p>
          </div>
          <div className="rounded-xl border border-blue-800/40 bg-blue-950/20 p-3">
            <p className="text-xs text-blue-300">Draft</p>
            <p className="text-2xl font-bold text-blue-200">{matrix.summary.draftEnabled}</p>
          </div>
          <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3">
            <p className="text-xs text-amber-300">Approval</p>
            <p className="text-2xl font-bold text-amber-200">{matrix.summary.approvalEnabled}</p>
          </div>
          <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-3">
            <p className="text-xs text-cyan-300">Monitor</p>
            <p className="text-2xl font-bold text-cyan-200">{matrix.summary.monitorEnabled}</p>
          </div>
          <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-3">
            <p className="text-xs text-emerald-300">Handoff</p>
            <p className="text-2xl font-bold text-emerald-200">{matrix.summary.internalHandoffEnabled}</p>
          </div>
          <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-3">
            <p className="text-xs text-red-300">External</p>
            <p className="text-2xl font-bold text-red-200">{matrix.summary.externalExecutionEnabled}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {matrix.agents.slice(0, 10).map((agent) => (
          <article key={agent.agentId} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{agent.dashboard}</p>
                <h3 className="mt-1 text-base font-bold text-white">{agent.agentName}</h3>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-bold uppercase text-gray-200">
                {formatStatus(agent.mode)}
              </span>
            </div>
            <p className="mb-3 text-sm leading-6 text-gray-400">{agent.permissionSummary}</p>
            <div className="flex flex-wrap gap-2">
              <CapabilityDot enabled={agent.canReadData} label="Read" />
              <CapabilityDot enabled={agent.canDraft} label="Draft" />
              <CapabilityDot enabled={agent.canCreateActionItem} label="Action" />
              <CapabilityDot enabled={agent.canRequestApproval} label="Approval" />
              <CapabilityDot enabled={agent.canRunScheduledMonitor} label="Monitor" />
              <CapabilityDot enabled={agent.canQueueInternalHandoff} label="Handoff" />
              <CapabilityDot enabled={agent.canSendExternalMessage} label="External Send" />
              <CapabilityDot enabled={agent.canChangePaymentOrPricing} label="Pricing" />
              <CapabilityDot enabled={agent.canPlaceOrderOrBid} label="Order/Bid" />
              <CapabilityDot enabled={agent.canPublishOrDeploy} label="Publish" />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function workOrderPriorityClass(priority: AgentWorkOrderPriority) {
  if (priority === "critical") return "border-red-700/50 bg-red-950/30 text-red-100"
  if (priority === "high") return "border-orange-700/50 bg-orange-950/30 text-orange-100"
  if (priority === "medium") return "border-amber-700/50 bg-amber-950/20 text-amber-100"
  return "border-gray-700 bg-gray-950/60 text-gray-200"
}

function workOrderStatusClass(status: AgentWorkOrderStatus) {
  if (status === "blocked") return "bg-red-900/30 text-red-200 border-red-700/40"
  if (status === "ready_for_review") return "bg-blue-900/30 text-blue-200 border-blue-700/40"
  return "bg-emerald-900/30 text-emerald-200 border-emerald-700/40"
}

function AgentWorkOrdersPanel({ queue }: { queue: AgentWorkOrderQueue }) {
  return (
    <section className="mb-8 rounded-2xl border border-fuchsia-900/40 bg-fuchsia-950/10 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300">
            Phase 1O Agent Work Orders
          </p>
          <h2 className="text-2xl font-bold text-white">Internal AI Workforce Backlog</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Mission-control state becomes human-supervised work orders. These are planning items only: no external action,
            send, bid, payment, order, publishing, or deploy is performed.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-5">
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <p className="text-xs text-gray-500">Orders</p>
            <p className="text-2xl font-bold text-white">{queue.summary.total}</p>
          </div>
          <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-3">
            <p className="text-xs text-red-300">Blocked</p>
            <p className="text-2xl font-bold text-red-200">{queue.summary.blocked}</p>
          </div>
          <div className="rounded-xl border border-orange-800/40 bg-orange-950/20 p-3">
            <p className="text-xs text-orange-300">High</p>
            <p className="text-2xl font-bold text-orange-200">{queue.summary.high}</p>
          </div>
          <div className="rounded-xl border border-blue-800/40 bg-blue-950/20 p-3">
            <p className="text-xs text-blue-300">Review</p>
            <p className="text-2xl font-bold text-blue-200">{queue.summary.readyForReview}</p>
          </div>
          <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-3">
            <p className="text-xs text-emerald-300">Auto-safe</p>
            <p className="text-2xl font-bold text-emerald-200">{queue.summary.safeToAutomate}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {queue.workOrders.slice(0, 10).map((order) => (
          <article key={order.id} className={cn("rounded-xl border p-4", workOrderPriorityClass(order.priority))}>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">{order.dashboard}</p>
                <h3 className="mt-1 text-base font-bold text-white">{order.title}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold uppercase", workOrderStatusClass(order.status))}>
                  {formatStatus(order.status)}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-bold uppercase">
                  {order.priority}
                </span>
              </div>
            </div>

            <p className="mb-3 text-sm leading-6 text-gray-300">{order.objective}</p>
            <p className="mb-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm font-semibold text-white">
              Next step: {order.nextStep}
            </p>
            <p className="mb-3 text-xs leading-5 text-gray-300">{order.humanGate}</p>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Acceptance criteria</p>
              <ul className="space-y-1 text-xs leading-5 text-gray-300">
                {order.acceptanceCriteria.slice(0, 4).map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function HumanApprovedAutopilotPanel({ control }: { control: AutopilotControlCenter }) {
  const [requests, setRequests] = useState<AutopilotApprovalRequest[]>(control.requests)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRequests(control.requests)
  }, [control])

  const summary = {
    total: requests.length,
    pending: requests.filter((request) => request.approvalStatus === "pending").length,
    approved: requests.filter((request) => request.approvalStatus === "approved").length,
    handoffReady: requests.filter((request) => request.executorStatus === "handoff_ready").length,
    handoffQueued: requests.filter((request) => request.executorStatus === "handoff_queued").length,
    taskCreated: requests.filter((request) => request.executorStatus === "task_created").length,
    critical: requests.filter((request) => request.riskLevel === "critical").length,
    high: requests.filter((request) => request.riskLevel === "high").length,
  }

  const decide = useCallback(
    async (request: AutopilotApprovalRequest, decision: "approve" | "reject" | "comment") => {
      const key = `${request.id}:${decision}`
      setBusyKey(key)
      setError(null)
      try {
        const response = await fetch("/api/admin/ai-orchestration/autopilot", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: request.id,
            decision,
            note: notes[request.id],
          }),
        })
        const data = await response.json()
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Autopilot decision failed")
        }

        if (decision === "comment") {
          setNotes((current) => ({ ...current, [request.id]: "" }))
          return
        }

        setRequests((current) =>
          current.map((item) =>
            item.id === request.id
              ? {
                  ...item,
                  approvalStatus: decision === "approve" ? "approved" : "rejected",
                  executorStatus: data.executorStatus ?? item.executorStatus,
                  cannotExecuteReason: data.cannotExecuteReason ?? item.cannotExecuteReason,
                  decisionNote: notes[request.id],
                }
              : item
          )
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : "Autopilot decision failed")
      } finally {
        setBusyKey(null)
      }
    },
    [notes]
  )

  const queueHandoff = useCallback(
    async (request: AutopilotApprovalRequest) => {
      const key = `${request.id}:queue_internal_handoff`
      setBusyKey(key)
      setError(null)
      try {
        const response = await fetch("/api/admin/ai-orchestration/autopilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: request.id,
            operation: "queue_internal_handoff",
            note: notes[request.id],
          }),
        })
        const data = await response.json()
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Safe handoff queue failed")
        }

        setRequests((current) =>
          current.map((item) =>
            item.id === request.id
              ? {
                  ...item,
                  executorStatus: data.executorStatus ?? "handoff_queued",
                  cannotExecuteReason: data.message ?? "Safe internal handoff queued.",
                }
              : item
          )
        )
        setNotes((current) => ({ ...current, [request.id]: "" }))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Safe handoff queue failed")
      } finally {
        setBusyKey(null)
      }
    },
    [notes]
  )

  const createInternalTask = useCallback(
    async (request: AutopilotApprovalRequest) => {
      const key = `${request.id}:create_internal_task`
      setBusyKey(key)
      setError(null)
      try {
        const response = await fetch("/api/admin/ai-orchestration/autopilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: request.id,
            operation: "create_internal_task",
            note: notes[request.id],
          }),
        })
        const data = await response.json()
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Internal task creation failed")
        }

        setRequests((current) =>
          current.map((item) =>
            item.id === request.id
              ? {
                  ...item,
                  executorStatus: "task_created",
                  internalTaskId: data.internalTaskId ?? item.internalTaskId,
                  cannotExecuteReason: data.message ?? "Internal CRM task created.",
                }
              : item
          )
        )
        setNotes((current) => ({ ...current, [request.id]: "" }))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Internal task creation failed")
      } finally {
        setBusyKey(null)
      }
    },
    [notes]
  )

  return (
    <section className="mb-8 rounded-2xl border border-violet-900/40 bg-violet-950/10 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-violet-300">
            Phase 6 Assisted Autopilot
          </p>
          <h2 className="text-2xl font-bold text-white">Approval Gates + Safe Internal Handoffs</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            This turns high-value AI recommendations into explicit approval requests, then lets approved low-risk gates move
            into an internal work queue and CRM task. It still does not send outreach, place orders, submit bids, or change checkout.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-7">
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <p className="text-xs text-gray-500">Gates</p>
            <p className="text-2xl font-bold text-white">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-blue-800/40 bg-blue-950/30 p-3">
            <p className="text-xs text-blue-300">Pending</p>
            <p className="text-2xl font-bold text-blue-200">{summary.pending}</p>
          </div>
          <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/30 p-3">
            <p className="text-xs text-emerald-300">Approved</p>
            <p className="text-2xl font-bold text-emerald-200">{summary.approved}</p>
          </div>
          <div className="rounded-xl border border-violet-800/40 bg-violet-950/30 p-3">
            <p className="text-xs text-violet-300">Ready</p>
            <p className="text-2xl font-bold text-violet-200">{summary.handoffReady}</p>
          </div>
          <div className="rounded-xl border border-purple-800/40 bg-purple-950/30 p-3">
            <p className="text-xs text-purple-300">Queued</p>
            <p className="text-2xl font-bold text-purple-200">{summary.handoffQueued}</p>
          </div>
          <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/30 p-3">
            <p className="text-xs text-cyan-300">Tasks</p>
            <p className="text-2xl font-bold text-cyan-200">{summary.taskCreated}</p>
          </div>
          <div className="rounded-xl border border-red-800/40 bg-red-950/30 p-3">
            <p className="text-xs text-red-300">Critical</p>
            <p className="text-2xl font-bold text-red-200">{summary.critical}</p>
          </div>
          <div className="rounded-xl border border-orange-800/40 bg-orange-950/30 p-3">
            <p className="text-xs text-orange-300">High</p>
            <p className="text-2xl font-bold text-orange-200">{summary.high}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-800/40 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="rounded-xl border border-violet-800/30 bg-violet-950/20 p-5">
          <p className="font-semibold text-violet-100">No autopilot approval gates are waiting.</p>
          <p className="mt-1 text-sm text-violet-100/70">
            Gates appear when Action Center recommendations require explicit human approval.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {requests.slice(0, 8).map((request) => (
            <article key={request.id} className={cn("rounded-xl border p-4", autopilotRiskClass(request.riskLevel))}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                      {request.riskLevel}
                    </span>
                    <span className={cn("rounded-full border px-2 py-1 text-xs font-bold", autopilotStatusClass(request.approvalStatus))}>
                      {formatStatus(request.approvalStatus)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                      {formatStatus(request.executorStatus)}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                      {request.dashboard}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{request.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-gray-300">{request.requestedAction}</p>
                  <p className="mt-2 text-xs leading-5 text-gray-400">{request.guardrailSummary}</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">{request.cannotExecuteReason}</p>
                </div>
                <a
                  href={request.route}
                  className="rounded-lg bg-white px-3 py-2 text-center text-xs font-bold text-gray-950 transition hover:bg-gray-200"
                >
                  Open Workflow
                </a>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                <textarea
                  value={notes[request.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                  placeholder="Decision note for the approval audit trail."
                  className="min-h-[76px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500"
                />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
                  <button
                    type="button"
                    disabled={busyKey === `${request.id}:approve` || request.approvalStatus === "approved"}
                    onClick={() => decide(request, "approve")}
                    className="rounded-lg bg-violet-400 px-3 py-2 text-xs font-bold text-gray-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve Gate
                  </button>
                  <button
                    type="button"
                    disabled={
                      busyKey === `${request.id}:queue_internal_handoff` ||
                      request.approvalStatus !== "approved" ||
                      request.executorStatus === "handoff_queued" ||
                      request.executorStatus === "blocked"
                    }
                    onClick={() => queueHandoff(request)}
                    className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-gray-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Queue Handoff
                  </button>
                  <button
                    type="button"
                    disabled={
                      busyKey === `${request.id}:create_internal_task` ||
                      !["handoff_queued", "task_ready"].includes(request.executorStatus) ||
                      Boolean(request.internalTaskId)
                    }
                    onClick={() => createInternalTask(request)}
                    className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-gray-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Create Task
                  </button>
                  <button
                    type="button"
                    disabled={busyKey === `${request.id}:reject` || request.approvalStatus === "rejected"}
                    onClick={() => decide(request, "reject")}
                    className="rounded-lg border border-red-800/40 bg-red-950/30 px-3 py-2 text-xs font-bold text-red-100 transition hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={busyKey === `${request.id}:comment` || !(notes[request.id] ?? "").trim()}
                    onClick={() => decide(request, "comment")}
                    className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add Note
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <span>Generated {new Date(control.generatedAt).toLocaleString()}</span>
        <span>
          Sources online: {control.sourceHealth.filter((source) => source.status === "ok").length}/{control.sourceHealth.length}
        </span>
      </div>
    </section>
  )
}

function taskStatusClass(status: AutopilotInternalTask["status"]) {
  if (status === "done") return "border-emerald-700/40 bg-emerald-950/30 text-emerald-200"
  if (status === "snoozed") return "border-amber-700/40 bg-amber-950/30 text-amber-100"
  if (status === "cancelled") return "border-red-700/40 bg-red-950/30 text-red-200"
  return "border-cyan-700/40 bg-cyan-950/30 text-cyan-100"
}

function isOpenTask(task: AutopilotInternalTask) {
  return task.status === "pending" || task.status === "in_progress"
}

function isOverdueTask(task: AutopilotInternalTask) {
  return task.status !== "done" && Boolean(task.dueAt) && new Date(task.dueAt as string).getTime() < Date.now()
}

function isDueSoonTask(task: AutopilotInternalTask) {
  if (task.status === "done" || !task.dueAt) return false
  const dueAt = new Date(task.dueAt).getTime()
  const now = Date.now()
  return dueAt >= now && dueAt <= now + 24 * 60 * 60 * 1000
}

function summarizeTaskDashboardGroups(tasks: AutopilotInternalTask[]) {
  const groupMap = new Map<
    string,
    {
      dashboard: string
      total: number
      pending: number
      done: number
      overdue: number
      dueSoon: number
    }
  >()

  for (const task of tasks) {
    const dashboard = task.dashboard || "Unassigned"
    const current =
      groupMap.get(dashboard) ??
      {
        dashboard,
        total: 0,
        pending: 0,
        done: 0,
        overdue: 0,
        dueSoon: 0,
      }

    current.total += 1
    if (isOpenTask(task)) current.pending += 1
    if (task.status === "done") current.done += 1
    if (isOverdueTask(task)) current.overdue += 1
    if (isDueSoonTask(task)) current.dueSoon += 1
    groupMap.set(dashboard, current)
  }

  return Array.from(groupMap.values()).sort((a, b) => {
    if (b.overdue !== a.overdue) return b.overdue - a.overdue
    if (b.pending !== a.pending) return b.pending - a.pending
    return a.dashboard.localeCompare(b.dashboard)
  })
}

function AutopilotTasksPanel({ queue }: { queue: AutopilotTaskQueue }) {
  const [tasks, setTasks] = useState<AutopilotInternalTask[]>(queue.tasks)
  const [selectedDashboard, setSelectedDashboard] = useState("all")
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTasks(queue.tasks)
    setSelectedDashboard((current) =>
      current === "all" || queue.tasks.some((task) => task.dashboard === current) ? current : "all"
    )
  }, [queue])

  const summary = {
    total: tasks.length,
    pending: tasks.filter(isOpenTask).length,
    done: tasks.filter((task) => task.status === "done").length,
    overdue: tasks.filter(isOverdueTask).length,
    dueSoon: tasks.filter(isDueSoonTask).length,
  }
  const dashboardGroups = summarizeTaskDashboardGroups(tasks)
  const activeDashboardGroup = dashboardGroups.find((group) => group.dashboard === selectedDashboard)
  const visibleGroups =
    selectedDashboard === "all"
      ? dashboardGroups
      : dashboardGroups.filter((group) => group.dashboard === selectedDashboard)

  const completeTask = useCallback(async (task: AutopilotInternalTask) => {
    const key = `${task.taskId}:complete`
    setBusyKey(key)
    setError(null)
    try {
      const response = await fetch("/api/admin/ai-orchestration/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "complete_internal_task",
          taskId: task.taskId,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Task completion failed")
      }

      setTasks((current) =>
        current.map((item) =>
          item.taskId === task.taskId
            ? { ...item, status: "done", completedAt: new Date().toISOString() }
            : item
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Task completion failed")
    } finally {
      setBusyKey(null)
    }
  }, [])

  return (
    <section className="mb-8 rounded-2xl border border-cyan-900/40 bg-cyan-950/10 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">
            Phase 9 Autopilot Work Queue
          </p>
          <h2 className="text-2xl font-bold text-white">Internal Tasks Grouped By Dashboard</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            This is the safe work queue created after human-approved AI handoffs. Focus by dashboard, clear the
            highest-risk internal reminders first, and keep external execution inside each source workflow.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <p className="text-xs text-gray-500">Tasks</p>
            <p className="text-2xl font-bold text-white">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/30 p-3">
            <p className="text-xs text-cyan-300">Pending</p>
            <p className="text-2xl font-bold text-cyan-200">{summary.pending}</p>
          </div>
          <div className="rounded-xl border border-red-800/40 bg-red-950/30 p-3">
            <p className="text-xs text-red-300">Overdue</p>
            <p className="text-2xl font-bold text-red-200">{summary.overdue}</p>
          </div>
          <div className="rounded-xl border border-amber-800/40 bg-amber-950/30 p-3">
            <p className="text-xs text-amber-300">Due Soon</p>
            <p className="text-2xl font-bold text-amber-100">{summary.dueSoon}</p>
          </div>
          <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/30 p-3">
            <p className="text-xs text-emerald-300">Done</p>
            <p className="text-2xl font-bold text-emerald-200">{summary.done}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-800/40 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-cyan-800/30 bg-cyan-950/20 p-5">
          <p className="font-semibold text-cyan-100">No AI handoff tasks yet.</p>
          <p className="mt-1 text-sm text-cyan-100/70">
            Tasks appear after an approved gate is queued as a safe handoff and converted into an internal CRM task.
          </p>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="rounded-xl border border-cyan-900/30 bg-gray-950/50 p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-bold text-white">Dashboard Focus</h3>
                <p className="text-sm text-gray-400">
                  {selectedDashboard === "all"
                    ? "Showing all dashboard work queues."
                    : `Showing ${activeDashboardGroup?.pending ?? 0} open task${(activeDashboardGroup?.pending ?? 0) === 1 ? "" : "s"} for ${selectedDashboard}.`}
                </p>
              </div>
              <span className="text-xs text-gray-500">Sorted by overdue work, then open work</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => setSelectedDashboard("all")}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  selectedDashboard === "all"
                    ? "border-cyan-400 bg-cyan-950/50"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-white">All Dashboards</span>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-gray-200">
                    {summary.total}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {summary.pending} open, {summary.overdue} overdue
                </p>
              </button>

              {dashboardGroups.map((group) => (
                <button
                  key={group.dashboard}
                  type="button"
                  onClick={() => setSelectedDashboard(group.dashboard)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition",
                    selectedDashboard === group.dashboard
                      ? "border-cyan-400 bg-cyan-950/50"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-bold text-white">{group.dashboard}</span>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-gray-200">
                      {group.total}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {group.pending} open
                    {group.overdue > 0 ? `, ${group.overdue} overdue` : ""}
                    {group.dueSoon > 0 ? `, ${group.dueSoon} due soon` : ""}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {visibleGroups.map((group) => {
            const groupTasks = tasks.filter((task) => task.dashboard === group.dashboard)
            return (
              <div key={group.dashboard} className="rounded-xl border border-cyan-900/30 bg-gray-950/40 p-4">
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                      {group.dashboard}
                    </p>
                    <h3 className="text-lg font-bold text-white">
                      {group.pending > 0
                        ? `${group.pending} internal action${group.pending === 1 ? "" : "s"} need attention`
                        : "No open internal actions"}
                    </h3>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-gray-500">Total</p>
                      <p className="font-bold text-white">{group.total}</p>
                    </div>
                    <div className="rounded-lg border border-cyan-800/40 bg-cyan-950/30 px-3 py-2">
                      <p className="text-cyan-300">Open</p>
                      <p className="font-bold text-cyan-100">{group.pending}</p>
                    </div>
                    <div className="rounded-lg border border-red-800/40 bg-red-950/30 px-3 py-2">
                      <p className="text-red-300">Late</p>
                      <p className="font-bold text-red-100">{group.overdue}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-3 py-2">
                      <p className="text-emerald-300">Done</p>
                      <p className="font-bold text-emerald-100">{group.done}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  {groupTasks.map((task) => (
                    <article key={task.taskId} className="rounded-xl border border-cyan-900/30 bg-gray-950/50 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className={cn("rounded-full border px-2 py-1 text-xs font-bold uppercase", taskStatusClass(task.status))}>
                              {formatStatus(task.status)}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold uppercase text-gray-300">
                              {task.source}
                            </span>
                            {task.dueAt && (
                              <span className={cn("text-xs", isOverdueTask(task) ? "text-red-300" : "text-gray-500")}>
                                Due {new Date(task.dueAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <h4 className="text-lg font-bold text-white">{task.title}</h4>
                          <p className="mt-1 text-sm leading-6 text-gray-300">{task.requestedAction}</p>
                          <p className="mt-2 text-xs leading-5 text-gray-500">{task.guardrailSummary}</p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[240px] lg:grid-cols-1">
                          <a
                            href={task.route}
                            className="rounded-lg bg-white px-3 py-2 text-center text-xs font-bold text-gray-950 transition hover:bg-gray-200"
                          >
                            Open Source Workflow
                          </a>
                          <button
                            type="button"
                            disabled={busyKey === `${task.taskId}:complete` || task.status === "done"}
                            onClick={() => completeTask(task)}
                            className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-gray-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Mark Done
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <span>Generated {new Date(queue.generatedAt).toLocaleString()}</span>
        <span>
          Sources online: {queue.sourceHealth.filter((source) => source.status === "ok").length}/{queue.sourceHealth.length}
        </span>
      </div>
    </section>
  )
}

function UnifiedActionCenterPanel({ actionCenter }: { actionCenter: UnifiedActionCenter }) {
  const [items, setItems] = useState<UnifiedActionItem[]>(actionCenter.items)
  const [expanded, setExpanded] = useState<string | null>(actionCenter.items[0]?.id ?? null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    setItems(actionCenter.items)
    setExpanded((current) => {
      if (current && actionCenter.items.some((item) => item.id === current)) return current
      return actionCenter.items[0]?.id ?? null
    })
  }, [actionCenter])

  const summary = summarizeVisibleActions(items)
  const visibleItems = items.slice(0, 10)

  const mutateAction = useCallback(
    async (
      item: UnifiedActionItem,
      operation: "resolve" | "snooze" | "dismiss" | "comment",
      options: { note?: string; snoozeHours?: number } = {}
    ) => {
      const key = `${item.id}:${operation}`
      setBusyKey(key)
      setActionError(null)

      try {
        const response = await fetch("/api/admin/ai-orchestration/action-center", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceKey: item.id,
            operation,
            note: options.note,
            snoozeHours: options.snoozeHours,
          }),
        })
        const data = await response.json()
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Action update failed")
        }

        if (operation === "comment") {
          setItems((current) =>
            current.map((currentItem) =>
              currentItem.id === item.id
                ? { ...currentItem, commentCount: (currentItem.commentCount ?? 0) + 1 }
                : currentItem
            )
          )
          setNotes((current) => ({ ...current, [item.id]: "" }))
        } else {
          setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
          setExpanded((current) => (current === item.id ? null : current))
        }
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Action update failed")
      } finally {
        setBusyKey(null)
      }
    },
    []
  )

  return (
    <section className="mb-8 rounded-2xl border border-emerald-900/40 bg-emerald-950/10 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
            Phase 3 Durable Action Center
          </p>
          <h2 className="text-2xl font-bold text-white">What Needs Action Now</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            A single queue for cross-dashboard approvals, blockers, hot replies, contract deadlines, and AI review items.
            You can now resolve, snooze, dismiss, and comment without triggering any live execution.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <p className="text-xs text-gray-500">Actions</p>
            <p className="text-2xl font-bold text-white">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-red-800/40 bg-red-950/30 p-3">
            <p className="text-xs text-red-400">Critical</p>
            <p className="text-2xl font-bold text-red-300">{summary.critical}</p>
          </div>
          <div className="rounded-xl border border-orange-800/40 bg-orange-950/30 p-3">
            <p className="text-xs text-orange-400">High</p>
            <p className="text-2xl font-bold text-orange-300">{summary.high}</p>
          </div>
          <div className="rounded-xl border border-blue-800/40 bg-blue-950/30 p-3">
            <p className="text-xs text-blue-400">Review</p>
            <p className="text-2xl font-bold text-blue-300">{summary.needsReview}</p>
          </div>
          <div className="rounded-xl border border-amber-800/40 bg-amber-950/30 p-3">
            <p className="text-xs text-amber-400">Human Gate</p>
            <p className="text-2xl font-bold text-amber-300">{summary.humanApprovalRequired}</p>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 rounded-xl border border-red-800/40 bg-red-950/30 p-3 text-sm text-red-200">
          {actionError}
        </div>
      )}

      {visibleItems.length === 0 ? (
        <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/30 p-5">
          <p className="font-semibold text-emerald-200">No immediate cross-dashboard actions found.</p>
          <p className="mt-1 text-sm text-emerald-100/70">
            The action center will populate from approvals, political replies, Gov Contracts deadlines, sales lead activity,
            failed webhooks, and agent readiness blockers.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {visibleItems.map((item) => {
            const isExpanded = expanded === item.id
            return (
              <article key={item.id} className={cn("rounded-xl border p-4", actionUrgencyClass(item.urgency))}>
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : item.id)}
                  className="flex w-full flex-col gap-3 text-left md:flex-row md:items-start md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold uppercase">
                        {item.urgency}
                      </span>
                      <span className={cn("rounded-full border px-2 py-1 text-xs font-bold", actionStatusClass(item.status))}>
                        {formatStatus(item.status)}
                      </span>
                      {item.commentCount ? (
                        <span className="rounded-full border border-emerald-700/40 bg-emerald-900/20 px-2 py-1 text-xs font-bold text-emerald-200">
                          {item.commentCount} note{item.commentCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                        {item.dashboard}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-gray-300">{item.reason}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={item.route}
                      className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-gray-950 transition hover:bg-gray-200"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Open
                    </a>
                    <span className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300">
                      {isExpanded ? "Hide" : "Details"}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-4 border-t border-white/10 pt-4 text-sm">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-gray-500">Recommended action</p>
                        <p className="leading-6 text-gray-200">{item.recommendedAction}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-gray-500">Expected impact</p>
                        <p className="leading-6 text-gray-200">{item.impact}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-gray-500">Control rule</p>
                        <p className="leading-6 text-gray-200">
                          {item.requiresHumanApproval ? "Human approval required before execution." : "Informational action only."}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Queue state: {formatStatus(item.durableState ?? "open")}
                          {item.snoozedUntil ? ` until ${new Date(item.snoozedUntil).toLocaleString()}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                      <textarea
                        value={notes[item.id] ?? ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                        placeholder="Add an internal note before resolving, dismissing, or commenting."
                        className="min-h-[84px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-emerald-500"
                      />
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
                        <button
                          type="button"
                          disabled={busyKey === `${item.id}:resolve`}
                          onClick={() => mutateAction(item, "resolve", { note: notes[item.id] })}
                          className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-gray-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          disabled={busyKey === `${item.id}:snooze`}
                          onClick={() => mutateAction(item, "snooze", { note: notes[item.id], snoozeHours: 24 })}
                          className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Snooze 24h
                        </button>
                        <button
                          type="button"
                          disabled={busyKey === `${item.id}:comment` || !(notes[item.id] ?? "").trim()}
                          onClick={() => mutateAction(item, "comment", { note: notes[item.id] })}
                          className="rounded-lg border border-blue-700/40 bg-blue-900/30 px-3 py-2 text-xs font-bold text-blue-100 transition hover:bg-blue-900/50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Add Note
                        </button>
                        <button
                          type="button"
                          disabled={busyKey === `${item.id}:dismiss`}
                          onClick={() => mutateAction(item, "dismiss", { note: notes[item.id] })}
                          className="rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-xs font-bold text-gray-300 transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <span>Generated {new Date(actionCenter.generatedAt).toLocaleString()}</span>
        <span>
          Sources online: {actionCenter.sourceHealth.filter((source) => source.status === "ok").length}/{actionCenter.sourceHealth.length}
        </span>
      </div>
    </section>
  )
}

function WorkflowRecipesPanel({ catalog }: { catalog: WorkflowRecipeCatalog }) {
  return (
    <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-slate-300">
            Phase 1T Workflow Recipes
          </p>
          <h2 className="text-2xl font-bold text-white">Guided Agent Workflow Recipes</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Reusable, human-gated operating recipes for the major HomeReach workflows. These define safe execution paths
            before any agent receives deeper permissions.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <p className="text-xs text-gray-500">Recipes</p>
            <p className="text-2xl font-bold text-white">{catalog.summary.total}</p>
          </div>
          <div className="rounded-xl border border-blue-800/40 bg-blue-950/20 p-3">
            <p className="text-xs text-blue-300">Review</p>
            <p className="text-2xl font-bold text-blue-200">{catalog.summary.reviewOnly}</p>
          </div>
          <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3">
            <p className="text-xs text-amber-300">Setup</p>
            <p className="text-2xl font-bold text-amber-200">{catalog.summary.needsSetup}</p>
          </div>
          <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-3">
            <p className="text-xs text-red-300">High Risk</p>
            <p className="text-2xl font-bold text-red-200">{catalog.summary.highRisk}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {catalog.recipes.map((recipe) => (
          <article key={recipe.id} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{recipe.dashboard}</p>
                <h3 className="mt-1 text-lg font-bold text-white">{recipe.title}</h3>
                <a className="mt-1 block text-xs font-semibold text-blue-300 hover:text-blue-200" href={recipe.route}>
                  Open {recipe.route}
                </a>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-bold uppercase text-gray-200">
                  {formatStatus(recipe.status)}
                </span>
                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold uppercase", autopilotRiskClass(recipe.risk))}>
                  {recipe.risk}
                </span>
              </div>
            </div>
            <p className="mb-3 text-sm leading-6 text-gray-400">{recipe.objective}</p>
            <div className="mb-3 rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Steps</p>
              <ol className="space-y-2 text-xs leading-5 text-gray-300">
                {recipe.steps.slice(0, 5).map((step, index) => (
                  <li key={`${recipe.id}-${step.label}`}>
                    {index + 1}. {step.label} - {step.output}
                    {step.requiresApproval ? " (approval)" : ""}
                  </li>
                ))}
              </ol>
            </div>
            <p className="rounded-lg border border-amber-800/30 bg-amber-950/20 p-3 text-sm text-amber-100">
              {recipe.goLiveRequirement}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function AgentCard({
  agent,
  stat,
  layerConfig,
}: {
  agent: AgentRegistry
  stat: AgentDailyStat | undefined
  layerConfig: (typeof LAYER_CONFIG)[keyof typeof LAYER_CONFIG]
}) {
  const [expanded, setExpanded] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [runResult, setRunResult] = useState<string | null>(null)

  const completionPct = stat?.completion_pct ?? 0
  const statusBadge = getStatusBadge(agent.is_active, completionPct)

  const handleRunNow = useCallback(async () => {
    setIsRunning(true)
    try {
      const response = await fetch(`/api/admin/agents/${agent.id}`, {
        method: "POST",
      })
      const data = await response.json()
      if (response.ok && data.success) {
        const s = data.summary || {}
        const parts = []
        if (s.leads_processed) parts.push(`${s.leads_processed} leads`)
        if (s.sms_sent) parts.push(`${s.sms_sent} SMS`)
        if (s.emails_sent) parts.push(`${s.emails_sent} emails`)
        if (s.runs !== undefined) parts.push(`${s.runs} runs`)
        setRunResult(`${agent.name}: ${parts.join(", ") || data.message || "complete"}`)
        setTimeout(() => setRunResult(null), 5000)
      } else {
        setRunResult(`${agent.name}: ${data.error || data.message || "error — check logs"}`)
        setTimeout(() => setRunResult(null), 5000)
      }
    } catch (error) {
      console.error("Failed to run agent:", error)
      setRunResult("Failed to run agent")
    } finally {
      setIsRunning(false)
    }
  }, [agent.id, agent.name])

  return (
    <div
      className={cn(
        "border rounded-xl p-4 transition-all",
        layerConfig.bgColor,
        layerConfig.borderColor
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-bold text-white uppercase">{agent.name}</h3>
            <span
              className={cn(
                "text-xs px-2 py-1 rounded-full font-semibold",
                statusBadge.bgColor,
                statusBadge.color
              )}
            >
              {statusBadge.label}
            </span>
          </div>
          <p className="text-sm text-gray-400">{agent.description}</p>
          <p className={cn("text-xs mt-1", layerConfig.textColor)}>
            Role: {agent.role}
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-200 transition"
        >
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {/* Completion Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Completion Rate</span>
          <span className="text-sm font-semibold text-white">{completionPct}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={cn(
              "h-2 rounded-full transition-all",
              completionPct >= 80
                ? "bg-blue-500"
                : completionPct >= 50
                  ? "bg-green-500"
                  : "bg-yellow-500"
            )}
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Today's Stats */}
      {stat && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-2 bg-gray-900/50 rounded-lg">
            <p className="text-xs text-gray-500">Actions</p>
            <p className="text-lg font-bold text-white">{stat.actions_completed}</p>
          </div>
          <div className="p-2 bg-gray-900/50 rounded-lg">
            <p className="text-xs text-gray-500">Messages</p>
            <p className="text-lg font-bold text-white">{stat.messages_sent}</p>
          </div>
          <div className="p-2 bg-gray-900/50 rounded-lg">
            <p className="text-xs text-gray-500">Errors</p>
            <p className={cn(
              "text-lg font-bold",
              stat.errors > 0 ? "text-red-400" : "text-green-400"
            )}>
              {stat.errors}
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleRunNow}
          disabled={isRunning}
          className={cn(
            "flex-1 px-3 py-2 rounded-lg font-semibold text-sm transition",
            isRunning
              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          )}
        >
          {isRunning ? "Running..." : "Run Now"}
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition"
        >
          {expanded ? "Hide" : "View"} Logs
        </button>
      </div>

      {/* Result Toast */}
      {runResult && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-800/50 rounded-lg">
          <p className="text-sm text-green-300">{runResult}</p>
        </div>
      )}

      {/* Expanded View: Logs */}
      {expanded && (
        <div className="border-t border-gray-700 pt-4">
          <p className="text-xs font-semibold text-gray-400 mb-2">Recent Runs</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <p className="text-xs text-gray-500">
              (Scroll through recent_run_logs filtered by agent_id in live view)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function ActivityFeed({ runLogs }: { runLogs: AgentRunLog[] }) {
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      // In production, this would refetch runLogs from the server
      // For now, we just show the provided logs
    }, 30_000)

    return () => clearInterval(interval)
  }, [autoRefresh])

  const displayLogs = runLogs.slice(0, 20)

  return (
    <div className="bg-gray-900/30 border border-gray-800/50 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Live Activity Feed</h3>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={cn(
            "text-xs px-2 py-1 rounded-full transition",
            autoRefresh
              ? "bg-green-900/30 text-green-400"
              : "bg-gray-800 text-gray-500"
          )}
        >
          {autoRefresh ? "Auto" : "Manual"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {displayLogs.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-8">
            No recent activity yet
          </p>
        ) : (
          displayLogs.map((log) => (
            <div
              key={log.id}
              className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-xs"
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                    log.status === "success"
                      ? "bg-green-500"
                      : log.status === "partial"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-white">{log.agent_name}</p>
                    <p className="text-gray-500">{formatRelativeTime(log.run_at)}</p>
                  </div>
                  <p className="text-gray-400 mt-0.5">
                    {log.actions_taken} actions, {log.messages_sent} messages
                  </p>
                  {log.error_message && (
                    <p className="text-red-400 mt-1 truncate">{log.error_message}</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function KaizenPanel({ insights }: { insights: KaizenInsights | null }) {
  if (!insights) {
    return (
      <div className="bg-purple-900/10 border border-purple-800/20 rounded-xl p-4">
        <p className="text-sm text-purple-400 font-semibold">
          Kaizen Insights not yet initialized
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Run agents to generate system insights
        </p>
      </div>
    )
  }

  return (
    <div className="bg-purple-900/20 border border-purple-800/30 rounded-xl p-4">
      <h3 className="text-lg font-bold text-white mb-3">Kaizen Insights</h3>

      {/* Findings */}
      {insights.findings && insights.findings.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-purple-400 mb-2">Findings</p>
          <ul className="space-y-1">
            {insights.findings.map((finding, i) => (
              <li key={i} className="text-xs text-gray-300 flex gap-2">
                <span className="text-purple-400 flex-shrink-0">•</span>
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Auto Fixes */}
      <div className="p-3 bg-green-900/20 border border-green-800/30 rounded-lg mb-4">
        <p className="text-xs text-green-400 font-semibold">
          Auto Fixes Applied: {insights.auto_fixes_applied}
        </p>
      </div>

      {/* Flagged for Review */}
      {insights.flagged_for_approval && insights.flagged_for_approval.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-400 mb-2">
            Flagged for Approval
          </p>
          <div className="space-y-2">
            {insights.flagged_for_approval.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 bg-amber-900/20 border border-amber-800/30 rounded-lg"
              >
                <p className="text-xs text-gray-300">{item}</p>
                <button className="text-xs px-2 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded transition">
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-600 mt-4">
        Generated: {formatRelativeTime(insights.created_at)}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard Component
// ─────────────────────────────────────────────────────────────────────────────

export default function AgentsDashboard({
  agents,
  stats,
  runLogs,
  kaisenInsights,
  dashboardAgents,
  dashboardAgentSummary,
  actionCenter,
  autopilotControl,
  autopilotTasks,
  operationalBriefings,
  monitorRuns,
  operationalMemory,
  userActionReadiness,
  smokeReport,
  sourceFreshness,
  missionControl,
  commandCenter,
  workOrders,
  goLiveReadiness,
  agentPermissions,
  workflowRecipes,
  workforceFoundation,
}: Props) {
  // Check if agent registry is initialized
  if (!agents || agents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">APEX — Agent Command Center</h1>
          <p className="text-gray-400 mb-8">16-Agent Autonomous System</p>

          <GoLiveReadinessPanel report={goLiveReadiness} />
          <AiCommandCenterSummaryPanel commandCenter={commandCenter} />
          <OperationalBriefingPanel initialBriefings={operationalBriefings} initialMonitorRuns={monitorRuns} />
          <OperationalMemoryPanel memory={operationalMemory} />
          <AiWorkforceFoundationPanel foundation={workforceFoundation} />
          <UserActionReadinessPanel readiness={userActionReadiness} />
          <AiWorkforceSmokePanel report={smokeReport} />
          <SourceFreshnessPanel report={sourceFreshness} />
          <AgentMissionControlPanel missionControl={missionControl} />
          <AgentPermissionsPanel matrix={agentPermissions} />
          <AgentWorkOrdersPanel queue={workOrders} />
          <WorkflowRecipesPanel catalog={workflowRecipes} />
          <HumanApprovedAutopilotPanel control={autopilotControl} />
          <AutopilotTasksPanel queue={autopilotTasks} />
          <UnifiedActionCenterPanel actionCenter={actionCenter} />
          <DashboardAgentMatrix agents={dashboardAgents} summary={dashboardAgentSummary} />

          <div className="p-8 bg-gray-900/50 border border-gray-800 rounded-xl text-center">
            <p className="text-lg text-gray-400 mb-2">
              Agent registry not yet initialized
            </p>
            <p className="text-sm text-gray-600">
              Run migration 27 to activate the agent_registry table and begin
              tracking autonomous agent performance.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Calculate stats
  const totalAgents = agents.length
  const activeAgents = agents.filter((a) => a.is_active).length
  const inactiveAgents = totalAgents - activeAgents
  const avgCompletion =
    stats.length > 0
      ? stats.reduce((sum, s) => sum + s.completion_pct, 0) / stats.length
      : 0

  // Group agents by layer
  const agentsByLayer = {
    executive: agents.filter((a) => a.layer === "executive"),
    outreach: agents.filter((a) => a.layer === "outreach"),
    growth: agents.filter((a) => a.layer === "growth"),
    operations: agents.filter((a) => a.layer === "operations"),
    intelligence: agents.filter((a) => a.layer === "intelligence"),
  }

  const layers: Array<keyof typeof agentsByLayer> = [
    "executive",
    "outreach",
    "growth",
    "operations",
    "intelligence",
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-1">APEX — Agent Command Center</h1>
          <p className="text-gray-400">16-Agent Autonomous System</p>
        </div>

        {/* Stat Bar */}
        <StatBar
          totalAgents={totalAgents}
          activeAgents={activeAgents}
          inactiveAgents={inactiveAgents}
          avgCompletion={avgCompletion}
        />

        <GoLiveReadinessPanel report={goLiveReadiness} />
        <AiCommandCenterSummaryPanel commandCenter={commandCenter} />
        <OperationalBriefingPanel initialBriefings={operationalBriefings} initialMonitorRuns={monitorRuns} />
        <OperationalMemoryPanel memory={operationalMemory} />
        <AiWorkforceFoundationPanel foundation={workforceFoundation} />
        <UserActionReadinessPanel readiness={userActionReadiness} />
        <AiWorkforceSmokePanel report={smokeReport} />
        <SourceFreshnessPanel report={sourceFreshness} />
        <AgentMissionControlPanel missionControl={missionControl} />
        <AgentPermissionsPanel matrix={agentPermissions} />
        <AgentWorkOrdersPanel queue={workOrders} />
        <WorkflowRecipesPanel catalog={workflowRecipes} />
        <HumanApprovedAutopilotPanel control={autopilotControl} />
        <AutopilotTasksPanel queue={autopilotTasks} />
        <UnifiedActionCenterPanel actionCenter={actionCenter} />
        <DashboardAgentMatrix agents={dashboardAgents} summary={dashboardAgentSummary} />

        {/* Main Content: 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Left: Agent Grid (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {layers.map((layer) => {
              const layerAgents = agentsByLayer[layer]
              if (layerAgents.length === 0) return null

              const config = LAYER_CONFIG[layer]

              return (
                <div key={layer}>
                  <h2
                    className={cn(
                      "text-lg font-bold mb-4 px-1",
                      config.textColor
                    )}
                  >
                    {config.label}
                  </h2>
                  <div className="space-y-4">
                    {layerAgents.map((agent) => {
                      const agentStat = stats.find((s) => s.agent_id === agent.id)
                      return (
                        <AgentCard
                          key={agent.id}
                          agent={agent}
                          stat={agentStat}
                          layerConfig={config}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right: Live Activity Feed (1/3) */}
          <div className="lg:col-span-1">
            <ActivityFeed runLogs={runLogs} />
          </div>
        </div>

        {/* Kaizen Panel (full width) */}
        <KaizenPanel insights={kaisenInsights} />
      </div>
    </div>
  )
}
