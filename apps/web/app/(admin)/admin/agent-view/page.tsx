import type { Metadata } from "next";
import { MOCK_AGENTS } from "@/lib/admin/mock-agents";
import { AgentDashboardWrapper } from "./agent-dashboard";

export const metadata: Metadata = { title: "Sales Agent Dashboard — HomeReach" };

export default function AgentViewPage() {
  // In production, the active agent would be derived from session/auth.
  // Here we pre-load all agents and let the client pick (for admin preview mode).
  return <AgentDashboardWrapper agents={MOCK_AGENTS} />;
}
