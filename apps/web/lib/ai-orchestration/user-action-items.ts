import { getDashboardAgentMatrix } from "./dashboard-agents";

export type UserActionPriority = "critical" | "high" | "medium" | "low";
export type UserActionOwner = "jason" | "admin" | "vendor" | "developer";
export type UserActionCategory =
  | "env"
  | "credential"
  | "external_approval"
  | "database"
  | "deployment"
  | "policy"
  | "verification";

export interface UserRequiredAction {
  id: string;
  title: string;
  detail: string;
  category: UserActionCategory;
  owner: UserActionOwner;
  priority: UserActionPriority;
  blocksGoLive: boolean;
  blocksAutonomy: boolean;
  nextStep: string;
  relatedRoute?: string;
  relatedSystem?: string;
}

export interface UserActionReadiness {
  generatedAt: string;
  summary: {
    total: number;
    critical: number;
    high: number;
    blocksGoLive: number;
    blocksAutonomy: number;
  };
  items: UserRequiredAction[];
}

function nowIso() {
  return new Date().toISOString();
}

function envValue(key: string) {
  return process.env[key]?.trim();
}

function isEnabled(key: string) {
  return envValue(key)?.toLowerCase() === "true";
}

function priorityRank(priority: UserActionPriority) {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function summarize(items: UserRequiredAction[]): UserActionReadiness["summary"] {
  return {
    total: items.length,
    critical: items.filter((item) => item.priority === "critical").length,
    high: items.filter((item) => item.priority === "high").length,
    blocksGoLive: items.filter((item) => item.blocksGoLive).length,
    blocksAutonomy: items.filter((item) => item.blocksAutonomy).length,
  };
}

function addUnique(items: UserRequiredAction[], item: UserRequiredAction) {
  if (items.some((existing) => existing.id === item.id)) return;
  items.push(item);
}

export function getUserActionReadiness(): UserActionReadiness {
  const items: UserRequiredAction[] = [];
  const agents = getDashboardAgentMatrix();

  for (const agent of agents) {
    for (const key of agent.missingRequiredEnv) {
      addUnique(items, {
        id: `missing-required-env-${key}`,
        title: `Add required environment variable: ${key}`,
        detail: `${agent.name} cannot reach its target readiness until ${key} is configured in the deployed environment.`,
        category: key.includes("KEY") || key.includes("TOKEN") || key.includes("SECRET") ? "credential" : "env",
        owner: "jason",
        priority: "high",
        blocksGoLive: false,
        blocksAutonomy: true,
        nextStep: `Add ${key} in Vercel/Supabase secrets, then redeploy or refresh the environment.`,
        relatedRoute: "/admin/agents",
        relatedSystem: agent.name,
      });
    }

    for (const key of agent.missingOptionalEnv.slice(0, 3)) {
      addUnique(items, {
        id: `missing-optional-env-${key}`,
        title: `Optional integration not configured: ${key}`,
        detail: `${agent.name} can run in a limited mode, but ${key} unlocks a stronger production workflow.`,
        category: key.includes("KEY") || key.includes("TOKEN") || key.includes("SECRET") ? "credential" : "env",
        owner: "jason",
        priority: "medium",
        blocksGoLive: false,
        blocksAutonomy: false,
        nextStep: `Add ${key} when that integration is ready for production use.`,
        relatedRoute: agent.route,
        relatedSystem: agent.name,
      });
    }

    for (const blocker of agent.manualBlockers ?? []) {
      addUnique(items, {
        id: `manual-blocker-${agent.id}-${blocker}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 180),
        title: `${agent.name}: manual approval required`,
        detail: blocker,
        category: "external_approval",
        owner: "jason",
        priority: blocker.toLowerCase().includes("twilio") ? "critical" : "high",
        blocksGoLive: false,
        blocksAutonomy: true,
        nextStep: blocker.toLowerCase().includes("twilio")
          ? "Finish Twilio A2P approval before enabling SMS prospecting or higher-volume SMS automation."
          : "Resolve the listed external dependency before moving this agent beyond advisory/human-approval mode.",
        relatedRoute: agent.route,
        relatedSystem: agent.name,
      });
    }
  }

  addUnique(items, {
    id: "apply-ai-workforce-migrations-097-102",
    title: "Apply Supabase migrations 097 through 102",
    detail:
      "These migrations enable the durable Action Center, operational briefings, autopilot approvals, safe internal handoffs, CRM task linkage, and Learning Engine taxonomy.",
    category: "database",
    owner: "jason",
    priority: "critical",
    blocksGoLive: true,
    blocksAutonomy: true,
    nextStep: "Apply migrations 097, 098, 099, 100, 101, and 102 in Supabase before treating the AI Workforce OS foundation as live.",
    relatedRoute: "/admin/agents",
    relatedSystem: "AI Workforce OS",
  });

  if (!isEnabled("ENABLE_CONTENT_INTEL")) {
    addUnique(items, {
      id: "enable-content-intel-review-mode",
      title: "Enable Learning Engine after credentials are ready",
      detail:
        "The Learning Engine should stay off until YouTube/transcript/API credentials are configured and the admin review queue is verified.",
      category: "deployment",
      owner: "jason",
      priority: "high",
      blocksGoLive: false,
      blocksAutonomy: true,
      nextStep: "Set ENABLE_CONTENT_INTEL=true only after review-only mode is ready in production.",
      relatedRoute: "/admin/content-intel",
      relatedSystem: "Learning Engine",
    });
  }

  if (!isEnabled("DISABLE_CONTENT_INTEL_AI")) {
    addUnique(items, {
      id: "confirm-content-intel-ai-mode",
      title: "Confirm Learning Engine AI extraction mode",
      detail:
        "For first production rollout, keep AI extraction disabled until credentials, rate limits, and human review behavior are validated.",
      category: "policy",
      owner: "jason",
      priority: "medium",
      blocksGoLive: false,
      blocksAutonomy: true,
      nextStep: "Set DISABLE_CONTENT_INTEL_AI=true for review-only launch, then enable extraction after a manual QA pass.",
      relatedRoute: "/admin/content-intel",
      relatedSystem: "Learning Engine",
    });
  }

  addUnique(items, {
    id: "verify-postmark-procurement-sender-list",
    title: "Verify Postmark sender identities for procurement email",
    detail:
      "The autonomous email path should send only from approved HomeReach addresses and stay focused on inventory/procurement until messaging QA is complete.",
    category: "verification",
    owner: "jason",
    priority: "medium",
    blocksGoLive: false,
    blocksAutonomy: false,
    nextStep: "Confirm Heather, Josh, Chelsi, and jason@home-reach.com are the intended sender identities and update env/config if needed.",
    relatedRoute: "/admin/inbox",
    relatedSystem: "Procurement Outreach",
  });

  addUnique(items, {
    id: "confirm-political-outreach-policy",
    title: "Confirm political outreach approval policy",
    detail:
      "Political messaging should remain draft-only or human-approved, with automation paused after any response and Jason notified immediately.",
    category: "policy",
    owner: "jason",
    priority: "high",
    blocksGoLive: false,
    blocksAutonomy: true,
    nextStep: "Confirm the exact political outreach rules before enabling any production political messaging sequence.",
    relatedRoute: "/political/candidate-agent",
    relatedSystem: "Political Outreach",
  });

  addUnique(items, {
    id: "confirm-canva-integration-path",
    title: "Confirm Canva integration path",
    detail:
      "Canva should remain a planned design engine until OAuth/app permissions, template structure, and export workflow are approved.",
    category: "external_approval",
    owner: "jason",
    priority: "low",
    blocksGoLive: false,
    blocksAutonomy: false,
    nextStep: "Choose whether Canva integration should launch as manual template workflow, OAuth Connect API, or both.",
    relatedRoute: "/admin/ad-designer",
    relatedSystem: "Creative Production",
  });

  addUnique(items, {
    id: "confirm-sam-gov-sync-cadence",
    title: "Confirm SAM.gov production sync cadence and alerts",
    detail:
      "Gov Contracts sync can monitor home-services opportunities, but production cadence and alert recipients should be explicitly approved.",
    category: "policy",
    owner: "jason",
    priority: "medium",
    blocksGoLive: false,
    blocksAutonomy: false,
    nextStep: "Confirm sync frequency, home-services focus categories, and alert recipients for SAM.gov monitoring.",
    relatedRoute: "/admin/gov-contracts",
    relatedSystem: "Gov Contracts",
  });

  const sorted = items.sort((a, b) => {
    const goLiveDelta = Number(b.blocksGoLive) - Number(a.blocksGoLive);
    if (goLiveDelta !== 0) return goLiveDelta;
    const autonomyDelta = Number(b.blocksAutonomy) - Number(a.blocksAutonomy);
    if (autonomyDelta !== 0) return autonomyDelta;
    return priorityRank(b.priority) - priorityRank(a.priority);
  });

  return {
    generatedAt: nowIso(),
    summary: summarize(sorted),
    items: sorted,
  };
}
