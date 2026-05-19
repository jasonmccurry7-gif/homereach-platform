export const dynamic = "force-dynamic"
import { createClient } from "@/lib/supabase/server"
import { getUnifiedActionCenter } from "@/lib/ai-orchestration/action-center"
import { getRecentDashboardMonitorRuns, getRecentOperationalBriefings } from "@/lib/ai-orchestration/briefings"
import { getDashboardAgentMatrix, getDashboardAgentSummary } from "@/lib/ai-orchestration/dashboard-agents"
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
  const [actionCenter, operationalBriefings, monitorRuns] = await Promise.all([
    getUnifiedActionCenter(18),
    getRecentOperationalBriefings(4),
    getRecentDashboardMonitorRuns(6),
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
      operationalBriefings={operationalBriefings}
      monitorRuns={monitorRuns}
    />
  )
}
