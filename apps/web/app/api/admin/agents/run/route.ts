import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Agent Orchestrator — Run all agents in sequence
// POST /api/admin/agents/run?agents=echo,closer,anchor
// GET  /api/admin/agents/run (status check)
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

interface OrchestrationResult {
  success: boolean;
  timestamp: string;
  agents_run: Array<{
    name: string;
    success: boolean;
    summary?: Record<string, unknown>;
    error?: string;
    duration_ms: number;
  }>;
  total_duration_ms: number;
}

// ─── Helper: Call agent endpoint ───────────────────────────────────────────────

async function callAgent(
  agentName: "echo" | "closer" | "anchor"
): Promise<{
  success: boolean;
  summary?: Record<string, unknown>;
  error?: string;
  duration_ms: number;
}> {
  const startTime = Date.now();
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  try {
    const response = await fetch(
      `${baseUrl}/api/admin/agents/${agentName}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No auth headers needed for internal calls
      }
    );

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${error}`,
        duration_ms: duration,
      };
    }

    const data = await response.json();
    return {
      success: data.success ?? false,
      summary: data.summary,
      duration_ms: duration,
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    const error = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error,
      duration_ms: duration,
    };
  }
}

// ─── POST: Run agents ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const startTime = Date.now();
  const orchestrationResult: OrchestrationResult = {
    success: true,
    timestamp: new Date().toISOString(),
    agents_run: [],
    total_duration_ms: 0,
  };

  try {
    // Parse request to determine which agents to run
    const { searchParams } = new URL(request.url);
    const agentsParam = searchParams.get("agents") || "echo,closer,anchor";
    const agentsToRun = agentsParam
      .split(",")
      .map((a) => a.trim().toLowerCase()) as Array<
      "echo" | "closer" | "anchor"
    >;

    // Run each agent in sequence
    for (const agentName of agentsToRun) {
      if (!["echo", "closer", "anchor"].includes(agentName)) {
        orchestrationResult.agents_run.push({
          name: agentName,
          success: false,
          error: "Unknown agent",
          duration_ms: 0,
        });
        continue;
      }

      console.log(`[orchestrator] starting ${agentName}...`);
      const result = await callAgent(agentName as "echo" | "closer" | "anchor");

      orchestrationResult.agents_run.push({
        name: agentName,
        success: result.success,
        summary: result.summary,
        error: result.error,
        duration_ms: result.duration_ms,
      });

      if (!result.success) {
        orchestrationResult.success = false;
      }

      console.log(
        `[orchestrator] ${agentName} completed (${result.success ? "✓" : "✗"}, ${result.duration_ms}ms)`
      );
    }

    orchestrationResult.total_duration_ms = Date.now() - startTime;
    return NextResponse.json(orchestrationResult);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[orchestrator] fatal error:", error);
    orchestrationResult.success = false;
    orchestrationResult.total_duration_ms = Date.now() - startTime;
    return NextResponse.json(orchestrationResult, { status: 500 });
  }
}

// ─── GET: Status check ────────────────────────────────────────────────────────

export async function GET() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const agents = ["echo", "closer", "anchor"];
    const statuses = await Promise.all(
      agents.map(async (agent) => {
        try {
          const response = await fetch(
            `${baseUrl}/api/admin/agents/${agent}`,
            {
              method: "GET",
              headers: { "Content-Type": "application/json" },
            }
          );

          if (!response.ok) {
            return { agent, status: "error", error: `HTTP ${response.status}` };
          }

          const data = await response.json();
          return { agent, status: data.status, ...data };
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          return { agent, status: "error", error };
        }
      })
    );

    return NextResponse.json({
      status: "operational",
      timestamp: new Date().toISOString(),
      agents: statuses,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[orchestrator] status check failed:", error);
    return NextResponse.json(
      { status: "error", error },
      { status: 500 }
    );
  }
}
