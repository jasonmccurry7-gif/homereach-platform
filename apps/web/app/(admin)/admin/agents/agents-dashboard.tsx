"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { DashboardAgentRuntime } from "@/lib/ai-orchestration/dashboard-agents"
import type { UnifiedActionCenter, UnifiedActionItem } from "@/lib/ai-orchestration/action-center"
import type { DashboardMonitorRun, OperationalBriefing } from "@/lib/ai-orchestration/briefings"

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
  operationalBriefings: OperationalBriefing[]
  monitorRuns: DashboardMonitorRun[]
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
  operationalBriefings,
  monitorRuns,
}: Props) {
  // Check if agent registry is initialized
  if (!agents || agents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">APEX — Agent Command Center</h1>
          <p className="text-gray-400 mb-8">16-Agent Autonomous System</p>

          <OperationalBriefingPanel initialBriefings={operationalBriefings} initialMonitorRuns={monitorRuns} />
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

        <OperationalBriefingPanel initialBriefings={operationalBriefings} initialMonitorRuns={monitorRuns} />
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
