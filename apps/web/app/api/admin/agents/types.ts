// ─────────────────────────────────────────────────────────────────────────────
// Shared Types for Agent System
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentIdentity {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface AgentRunLog {
  id: string;
  agent_name: string;
  status: "success" | "partial" | "failed";
  actions_taken: number;
  messages_sent: number;
  errors: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type Territory =
  | "Wooster"
  | "Medina"
  | "Massillon"
  | "Ravenna"
  | "Green"
  | "Stow"
  | "Cuyahoga Falls"
  | "Hudson"
  | "Canton"
  | "Akron";

export const AGENT_TERRITORIES: Record<Territory, AgentIdentity> = {
  "Wooster": {
    id: "heather-agent-id",
    name: "Heather",
    email: "heather@home-reach.com",
    phone: "+13306626331",
  },
  "Medina": {
    id: "heather-agent-id",
    name: "Heather",
    email: "heather@home-reach.com",
    phone: "+13306626331",
  },
  "Massillon": {
    id: "josh-agent-id",
    name: "Josh",
    email: "josh@home-reach.com",
    phone: "+13304224396",
  },
  "Ravenna": {
    id: "josh-agent-id",
    name: "Josh",
    email: "josh@home-reach.com",
    phone: "+13304224396",
  },
  "Green": {
    id: "chris-agent-id",
    name: "Chris",
    email: "chris@home-reach.com",
    phone: "+13305949713",
  },
  "Stow": {
    id: "chris-agent-id",
    name: "Chris",
    email: "chris@home-reach.com",
    phone: "+13305949713",
  },
  "Cuyahoga Falls": {
    id: "jason-agent-id",
    name: "Jason",
    email: "jason@home-reach.com",
    phone: "+13303044916",
  },
  "Hudson": {
    id: "jason-agent-id",
    name: "Jason",
    email: "jason@home-reach.com",
    phone: "+13303044916",
  },
  "Canton": {
    id: "jason-agent-id",
    name: "Jason",
    email: "jason@home-reach.com",
    phone: "+13303044916",
  },
  "Akron": {
    id: "jason-agent-id",
    name: "Jason",
    email: "jason@home-reach.com",
    phone: "+13303044916",
  },
};

export const DEFAULT_AGENT: AgentIdentity = {
  id: "jason-agent-id",
  name: "Jason",
  email: "jason@home-reach.com",
  phone: "+13303044916",
};

/**
 * Resolve agent identity for a given city.
 * Falls back to DEFAULT_AGENT if city not in AGENT_TERRITORIES.
 */
export function getAgentForTerritory(city: string | null): AgentIdentity {
  if (!city) return DEFAULT_AGENT;
  return AGENT_TERRITORIES[city as Territory] || DEFAULT_AGENT;
}
