import type { Metadata } from "next";
import { MOCK_AGENTS, MOCK_FOLLOW_UPS } from "@/lib/admin/mock-agents";
import { MOCK_LEADS } from "@/lib/admin/mock-data";
import { AgentsClient } from "./agents-client";

export const metadata: Metadata = { title: "Agents — HomeReach Admin" };

export default function AgentsPage() {
  return (
    <AgentsClient
      agents={MOCK_AGENTS}
      leads={MOCK_LEADS}
      followUps={MOCK_FOLLOW_UPS}
    />
  );
}
