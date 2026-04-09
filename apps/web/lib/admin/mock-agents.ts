// ─────────────────────────────────────────────────────────────────────────────
// Mock Sales Agents
// Replace with Supabase query when auth/roles are connected.
// ─────────────────────────────────────────────────────────────────────────────

import type { SalesAgent, AgentFollowUp } from "@/lib/engine/types";

export const MOCK_AGENTS: SalesAgent[] = [
  {
    id: "agent-1",
    name: "Ryan Cole",
    email: "ryan@homereach.com",
    phone: "+13301110001",
    role: "sales_agent",
    status: "active",
    assignedCityIds: ["city-medina", "city-stow"],
    assignedLeadIds: ["lead-1", "lead-2", "lead-5", "lead-6"],
    createdAt: "2026-01-15T00:00:00Z",
    dealsClosedThisMonth: 2,
    dealsClosedAllTime: 11,
    pipelineValue: 1497,   // sum of active lead monthly values
    commissionRate: 0.10,
    commissionEarnedThisMonth: 94.80,
    commissionEarnedAllTime: 1640,
    followUpsDue: 2,
  },
  {
    id: "agent-2",
    name: "Melissa Park",
    email: "melissa@homereach.com",
    phone: "+13301110002",
    role: "sales_agent",
    status: "active",
    assignedCityIds: ["city-hudson", "city-medina"],
    assignedLeadIds: ["lead-4", "lead-8", "lead-7"],
    createdAt: "2026-02-01T00:00:00Z",
    dealsClosedThisMonth: 1,
    dealsClosedAllTime: 6,
    pipelineValue: 1198,
    commissionRate: 0.10,
    commissionEarnedThisMonth: 39.90,
    commissionEarnedAllTime: 720,
    followUpsDue: 1,
  },
  {
    id: "agent-3",
    name: "Jordan Wells",
    email: "jordan@homereach.com",
    phone: "+13301110003",
    role: "sales_agent",
    status: "active",
    assignedCityIds: ["city-akron"],
    assignedLeadIds: ["lead-3", "lead-7"],
    createdAt: "2026-03-01T00:00:00Z",
    dealsClosedThisMonth: 0,
    dealsClosedAllTime: 2,
    pipelineValue: 0,
    commissionRate: 0.10,
    commissionEarnedThisMonth: 0,
    commissionEarnedAllTime: 180,
    followUpsDue: 3,
  },
];

export const MOCK_FOLLOW_UPS: AgentFollowUp[] = [
  {
    id: "fu-1",
    agentId: "agent-1",
    leadId: "lead-1",
    leadName: "Mike Harrington",
    businessName: "Harrington Plumbing",
    city: "Medina, OH",
    category: "Plumber",
    dueAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
    note: "Send intake link — he said 'yes, send me the link'",
    completed: false,
  },
  {
    id: "fu-2",
    agentId: "agent-1",
    leadId: "lead-6",
    leadName: "Beth Callahan",
    businessName: "Callahan Insurance",
    city: "Stow, OH",
    category: "Insurance",
    dueAt: new Date(Date.now() + 3 * 24 * 3_600_000).toISOString(),
    note: "Re-contact after 6-month break — check in on interest",
    completed: false,
  },
  {
    id: "fu-3",
    agentId: "agent-2",
    leadId: "lead-8",
    leadName: "Angela Frost",
    businessName: "Frost Realty",
    city: "Hudson, OH",
    category: "Realtor",
    dueAt: new Date(Date.now() + 1 * 24 * 3_600_000).toISOString(),
    note: "Follow up Friday — she said she'd have partner approval by then",
    completed: false,
  },
  {
    id: "fu-4",
    agentId: "agent-3",
    leadId: "lead-3",
    leadName: "Derek Townsend",
    businessName: "Townsend HVAC",
    city: "Akron, OH",
    category: "HVAC",
    dueAt: new Date(Date.now() + 4 * 3_600_000).toISOString(),
    note: "No response to voicemail — try SMS today",
    completed: false,
  },
  {
    id: "fu-5",
    agentId: "agent-3",
    leadId: "lead-7",
    leadName: "James Kowalski",
    businessName: "Kowalski Electric",
    city: "Akron, OH",
    category: "Electrician",
    dueAt: new Date(Date.now() + 6 * 3_600_000).toISOString(),
    note: "New outreach sent — follow up if no reply by EOD",
    completed: false,
  },
];

/** Get agent by ID */
export function getAgent(agentId: string): SalesAgent | null {
  return MOCK_AGENTS.find((a) => a.id === agentId) ?? null;
}

/** Get follow-ups for an agent, sorted soonest first */
export function getAgentFollowUps(agentId: string): AgentFollowUp[] {
  return MOCK_FOLLOW_UPS
    .filter((f) => f.agentId === agentId && !f.completed)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}
