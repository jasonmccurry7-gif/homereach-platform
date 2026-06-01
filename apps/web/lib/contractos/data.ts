import { loadGovContractDashboard } from "@/lib/gov-contracts/data";
import { buildGeneratedBidWorkspace } from "@/lib/gov-contracts/execution";
import type { GovContractOpportunity } from "@/lib/gov-contracts/types";

export type ContractOSReadinessProfile = {
  score: number;
  label: string;
  status: "ready" | "partial" | "not_ready";
  summary: string;
  missingRequirements: string[];
  nextChecklist: Array<{
    label: string;
    detail: string;
    status: "complete" | "missing" | "review";
  }>;
};

export type ContractOSOpportunityCard = {
  id: string;
  title: string;
  plainEnglishTitle: string;
  agency: string;
  deadline: string;
  location: string;
  estimatedFit: number;
  complexityLevel: "Low" | "Moderate" | "High" | "Very High";
  competitionLevel: "Unknown" | "Low" | "Medium" | "High";
  estimatedContractSize: string;
  setAsideStatus: string;
  requiredDocuments: string;
  recommendedAction: string;
  whyItFits: string[];
  whyItMayNotFit: string[];
  missingRequirements: string[];
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  detailHref: string;
  source: GovContractOpportunity;
};

export type ContractOSAgent = {
  name: string;
  mission: string;
  status: "active" | "draft" | "needs_connector";
  nextAction: string;
};

export type ContractOSDashboardData = {
  readiness: ContractOSReadinessProfile;
  opportunities: ContractOSOpportunityCard[];
  agents: ContractOSAgent[];
  summary: {
    activeUsers: number;
    bidsInProgress: number;
    opportunitiesTracked: number;
    highFitMatches: number;
    upcomingDeadlines: number;
    proposalDrafts: number;
    stuckUsers: number;
    revenueOpportunities: number;
  };
  sourceNotice: string;
};

export const contractOSAgents: ContractOSAgent[] = [
  {
    name: "Opportunity Scout Agent",
    mission: "Find relevant SAM.gov opportunities and separate realistic matches from distractions.",
    status: "active",
    nextAction: "Review high-fit matches and watchlist gaps.",
  },
  {
    name: "Solicitation Analyst Agent",
    mission: "Translate government notices into plain English: what is required, what is risky, and what to do next.",
    status: "active",
    nextAction: "Summarize official notices after attachments are verified.",
  },
  {
    name: "Readiness Agent",
    mission: "Track UEI, SAM registration, insurance, bonding, certifications, capacity, and missing bid proof.",
    status: "draft",
    nextAction: "Connect saved business readiness profiles.",
  },
  {
    name: "Pricing Assistant Agent",
    mission: "Model fully burdened costs, margin, cash-flow strain, subcontractor burden, and underbid risk.",
    status: "active",
    nextAction: "Block low-confidence pricing until value and scope are verified.",
  },
  {
    name: "Proposal Assistant Agent",
    mission: "Draft proposal sections, capability statements, cover letters, and clarification questions for review.",
    status: "draft",
    nextAction: "Use only source-backed solicitation facts and mark every output draft.",
  },
  {
    name: "Deadline Watch Agent",
    mission: "Track response deadlines, Q&A dates, amendments, stale workspaces, and missed review windows.",
    status: "active",
    nextAction: "Escalate opportunities with deadlines inside seven days.",
  },
  {
    name: "Revenue Opportunity Agent",
    mission: "Find users likely to need paid bid support, done-for-you proposal help, or subcontractor matching.",
    status: "draft",
    nextAction: "Tie workspace risk to subscription and consulting offers after human approval.",
  },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "Not listed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(cents: number | null | undefined) {
  if (!cents) return "Size TBD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function riskLevel(score: number): ContractOSOpportunityCard["riskLevel"] {
  if (score >= 82) return "Critical";
  if (score >= 62) return "High";
  if (score >= 42) return "Medium";
  return "Low";
}

function complexityLevel(opportunity: GovContractOpportunity): ContractOSOpportunityCard["complexityLevel"] {
  if (opportunity.riskScore >= 78 || opportunity.missingItems.length >= 4) return "Very High";
  if (opportunity.riskScore >= 58 || opportunity.scoreBreakdown.complianceComplexity < 45) return "High";
  if (opportunity.riskScore >= 35 || opportunity.requiredDocuments.length >= 4) return "Moderate";
  return "Low";
}

function competitionLevel(opportunity: GovContractOpportunity): ContractOSOpportunityCard["competitionLevel"] {
  if (opportunity.incumbentVendor) return "High";
  if (opportunity.awardAmountCents || opportunity.estimatedValueCents) return "Medium";
  return "Unknown";
}

function plainEnglishTitle(opportunity: GovContractOpportunity) {
  const title = opportunity.title.replace(/\s+/g, " ").trim();
  if (/grounds|lawn|snow|maintenance/i.test(title)) return "Lawn, grounds, or facilities support contract";
  if (/print|mail|postcard|address/i.test(title)) return "Printing and mailing support contract";
  if (/courier|delivery|logistics|transport/i.test(title)) return "Delivery and logistics support contract";
  if (/warehouse|kitting|packing|fulfillment/i.test(title)) return "Warehouse, packing, or fulfillment contract";
  return title;
}

function toContractOSOpportunity(opportunity: GovContractOpportunity): ContractOSOpportunityCard {
  const workspace = buildGeneratedBidWorkspace(opportunity);
  const missingRequirements = [
    ...opportunity.missingItems,
    ...workspace.complianceMatrix
      .filter((item) => item.status === "missing" || item.status === "needs_review")
      .slice(0, 3)
      .map((item) => item.requirement),
  ];

  return {
    id: opportunity.id,
    title: opportunity.title,
    plainEnglishTitle: plainEnglishTitle(opportunity),
    agency: opportunity.agency,
    deadline: formatDate(opportunity.dueDate),
    location: opportunity.location.label,
    estimatedFit: opportunity.fitScore,
    complexityLevel: complexityLevel(opportunity),
    competitionLevel: competitionLevel(opportunity),
    estimatedContractSize: formatMoney(opportunity.estimatedValueCents ?? opportunity.awardAmountCents),
    setAsideStatus: opportunity.setAsideDescription ?? opportunity.setAsideCode ?? "Not listed",
    requiredDocuments: opportunity.requiredDocuments.length
      ? `${opportunity.requiredDocuments.length} listed`
      : "Needs extraction",
    recommendedAction: workspace.bidDecision.recommendedNextStep,
    whyItFits: workspace.bidDecision.why.slice(0, 3),
    whyItMayNotFit: workspace.bidDecision.risks.slice(0, 3),
    missingRequirements: Array.from(new Set(missingRequirements)).slice(0, 6),
    riskLevel: riskLevel(opportunity.riskScore),
    detailHref: `/contractos/opportunities/${encodeURIComponent(opportunity.id)}`,
    source: opportunity,
  };
}

export function buildContractOSReadinessProfile(): ContractOSReadinessProfile {
  return {
    score: 48,
    label: "Starter profile",
    status: "partial",
    summary:
      "ContractOS can review opportunities now, but a business should complete its readiness profile before relying on bid recommendations.",
    missingRequirements: [
      "SAM registration / UEI / CAGE status",
      "Insurance and bonding details",
      "Past performance examples",
      "Service area and capacity limits",
      "Minimum acceptable margin",
      "Subcontractor network",
    ],
    nextChecklist: [
      {
        label: "Company basics",
        detail: "Business name, services, states served, and owner contact.",
        status: "review",
      },
      {
        label: "Government identity",
        detail: "SAM registration, UEI, CAGE, set-aside eligibility, and certifications.",
        status: "missing",
      },
      {
        label: "Execution capacity",
        detail: "Labor, equipment, geography, insurance, bonding, and subcontractors.",
        status: "missing",
      },
      {
        label: "Financial guardrails",
        detail: "Minimum margins, cash-flow tolerance, payment timing, and bid floor.",
        status: "review",
      },
      {
        label: "Past performance",
        detail: "Relevant projects, references, proof, outcomes, and lessons learned.",
        status: "missing",
      },
    ],
  };
}

export async function loadContractOSDashboard(): Promise<ContractOSDashboardData> {
  const govData = await loadGovContractDashboard({});
  const publicSafeOpportunities = govData.opportunities
    .filter((opportunity) => opportunity.sourceSystem === "sam.gov" || opportunity.isSample)
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 9)
    .map(toContractOSOpportunity);

  const highFitMatches = publicSafeOpportunities.filter((opportunity) => opportunity.estimatedFit >= 70).length;
  const upcomingDeadlines = publicSafeOpportunities.filter((opportunity) =>
    ["High", "Critical"].includes(opportunity.riskLevel)
  ).length;

  return {
    readiness: buildContractOSReadinessProfile(),
    opportunities: publicSafeOpportunities,
    agents: contractOSAgents,
    summary: {
      activeUsers: 0,
      bidsInProgress: govData.summary.bidsInProgress,
      opportunitiesTracked: publicSafeOpportunities.length,
      highFitMatches,
      upcomingDeadlines,
      proposalDrafts: govData.summary.pendingApprovals,
      stuckUsers: 0,
      revenueOpportunities: highFitMatches + govData.summary.activeSubcontractorNeeds,
    },
    sourceNotice:
      govData.sourceLabel === "database"
        ? "Showing public-safe SAM.gov opportunity records where available. Manual/internal records stay admin-side."
        : "Showing labeled sample opportunities until live SAM.gov records are available.",
  };
}
