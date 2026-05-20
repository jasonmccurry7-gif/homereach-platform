export const dynamic = "force-dynamic"
import { createClient } from "@/lib/supabase/server"
import { getUnifiedActionCenter } from "@/lib/ai-orchestration/action-center"
import { getAutopilotControlCenter, getAutopilotTaskQueue } from "@/lib/ai-orchestration/autopilot"
import { getRecentDashboardMonitorRuns, getRecentOperationalBriefings } from "@/lib/ai-orchestration/briefings"
import { getDashboardAgentMatrix, getDashboardAgentSummary } from "@/lib/ai-orchestration/dashboard-agents"
import { getOperationalMemory } from "@/lib/ai-orchestration/operational-memory"
import { getUserActionReadiness } from "@/lib/ai-orchestration/user-action-items"
import { getAiWorkforceSmokeReport } from "@/lib/ai-orchestration/ai-workforce-smoke"
import { getSourceFreshnessReport } from "@/lib/ai-orchestration/source-freshness"
import { getAgentMissionControl } from "@/lib/ai-orchestration/agent-mission-control"
import { getAiCommandCenterState } from "@/lib/ai-orchestration/command-center"
import { getAgentWorkOrderQueue } from "@/lib/ai-orchestration/agent-work-orders"
import { getGoLiveReadinessReport } from "@/lib/ai-orchestration/go-live-readiness"
import { getAgentPermissionMatrix } from "@/lib/ai-orchestration/agent-permissions"
import { getWorkflowRecipeCatalog } from "@/lib/ai-orchestration/workflow-recipes"
import { getAiWorkforceFoundationState } from "@/lib/ai-orchestration/workforce-memory"
import AgentsDashboard from "./agents-dashboard"

export default async function AgentsPage() {
  const supabase = await createClient()

  // Fetch all agents from registry
  const { data: agents } = await supabase
    .from("agent_registry")
    .select("*")
    .order("layer", { ascending: true })

  // Fetch today's stats
  const { data: stats } = await supabase
    .from("agent_daily_stats")
    .select("*")
    .eq("stat_date", new Date().toISOString().split("T")[0])

  // Fetch recent run logs (last 50)
  const { data: runLogs } = await supabase
    .from("agent_run_log")
    .select("*")
    .order("run_at", { ascending: false })
    .limit(50)

  // Fetch latest kaizen insights
  const { data: kaisenInsights } = await supabase
    .from("kaizen_insights")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)

  const dashboardAgents = getDashboardAgentMatrix()
  const [
    actionCenter,
    autopilotControl,
    autopilotTasks,
    operationalBriefings,
    monitorRuns,
    operationalMemory,
    smokeReport,
    sourceFreshness,
    missionControl,
    commandCenter,
    workOrders,
    goLiveReadiness,
    agentPermissions,
    workflowRecipes,
    workforceFoundation,
  ] = await Promise.all([
    getUnifiedActionCenter(18),
    getAutopilotControlCenter(10),
    getAutopilotTaskQueue(10),
    getRecentOperationalBriefings(4),
    getRecentDashboardMonitorRuns(6),
    getOperationalMemory(16),
    getAiWorkforceSmokeReport(),
    getSourceFreshnessReport(),
    getAgentMissionControl(),
    getAiCommandCenterState(),
    getAgentWorkOrderQueue(),
    getGoLiveReadinessReport(),
    getAgentPermissionMatrix(),
    getWorkflowRecipeCatalog(),
    getAiWorkforceFoundationState(),
  ])

  return (
    <AgentsDashboard
      agents={agents || []}
      stats={stats || []}
      runLogs={runLogs || []}
      kaisenInsights={kaisenInsights?.[0] || null}
      dashboardAgents={dashboardAgents}
      dashboardAgentSummary={getDashboardAgentSummary(dashboardAgents)}
      actionCenter={actionCenter}
      autopilotControl={autopilotControl}
      autopilotTasks={autopilotTasks}
      operationalBriefings={operationalBriefings}
      monitorRuns={monitorRuns}
      operationalMemory={operationalMemory}
      userActionReadiness={getUserActionReadiness()}
      smokeReport={smokeReport}
      sourceFreshness={sourceFreshness}
      missionControl={missionControl}
      commandCenter={commandCenter}
      workOrders={workOrders}
      goLiveReadiness={goLiveReadiness}
      agentPermissions={agentPermissions}
      workflowRecipes={workflowRecipes}
      workforceFoundation={workforceFoundation}
    />
  )
}
