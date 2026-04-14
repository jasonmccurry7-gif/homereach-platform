"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"

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
    <div className="grid grid-cols-4 gap-4 mb-8">
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
      if (response.ok) {
        const data = await response.json()
        setRunResult(
          `${agent.name}: ${data.actions} actions, ${data.messages} SMS sent`
        )
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
}: Props) {
  // Check if agent registry is initialized
  if (!agents || agents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">APEX — Agent Command Center</h1>
          <p className="text-gray-400 mb-8">16-Agent Autonomous System</p>

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
    <div className="min-h-screen bg-gray-950 text-white p-8">
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

        {/* Main Content: 2-Column Layout */}
        <div className="grid grid-cols-3 gap-8 mb-8">
          {/* Left: Agent Grid (2/3) */}
          <div className="col-span-2 space-y-6">
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
          <div className="col-span-1">
            <ActivityFeed runLogs={runLogs} />
          </div>
        </div>

        {/* Kaizen Panel (full width) */}
        <KaizenPanel insights={kaisenInsights} />
      </div>
    </div>
  )
}
