import type { Metadata } from "next";
import { AgentExecutionControlCenter } from "@/components/agent-execution/agent-execution-control-center";
import { loadAgentExecutionReadiness } from "@/lib/agent-execution/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agent Execution Readiness | HomeReach Admin",
};

export default async function AgentExecutionPage() {
  const data = await loadAgentExecutionReadiness();
  return <AgentExecutionControlCenter data={data} />;
}
