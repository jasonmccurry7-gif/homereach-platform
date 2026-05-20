export type WorkflowRecipeRisk = "low" | "medium" | "high";
export type WorkflowRecipeStatus = "ready_to_plan" | "needs_setup" | "review_only";

export interface WorkflowRecipeStep {
  label: string;
  owner: "ai" | "human" | "system";
  requiresApproval: boolean;
  output: string;
}

export interface WorkflowRecipe {
  id: string;
  title: string;
  dashboard: string;
  route: string;
  status: WorkflowRecipeStatus;
  risk: WorkflowRecipeRisk;
  objective: string;
  steps: WorkflowRecipeStep[];
  prohibited: string[];
  goLiveRequirement: string;
}

export interface WorkflowRecipeCatalog {
  generatedAt: string;
  summary: {
    total: number;
    reviewOnly: number;
    needsSetup: number;
    highRisk: number;
  };
  recipes: WorkflowRecipe[];
}

function nowIso() {
  return new Date().toISOString();
}

const SHARED_PROHIBITED = [
  "No autonomous payments, bids, orders, external sends, publishing, production launches, or code deployments.",
  "No duplicate dashboard, workflow, API, table, or AI system.",
  "No bypassing existing auth, Stripe, maps, route logic, campaign records, approval queues, or audit logs.",
];

const RECIPES: WorkflowRecipe[] = [
  {
    id: "political-campaign-launch",
    title: "Political Campaign Launch Review",
    dashboard: "Political Command",
    route: "/political/candidate-agent",
    status: "review_only",
    risk: "high",
    objective: "Guide a candidate from selection to strategy comparison, map coverage, creative review, proposal, approval, and launch readiness.",
    steps: [
      { label: "Select candidate and load candidate-specific intelligence", owner: "human", requiresApproval: true, output: "Candidate context loaded" },
      { label: "Generate four budget-sensitive coverage options", owner: "ai", requiresApproval: true, output: "Coverage plans and Ohio map highlights" },
      { label: "Review postcard concepts and comments", owner: "human", requiresApproval: true, output: "Selected creative and requested revisions" },
      { label: "Check route/pricing/approval readiness", owner: "system", requiresApproval: true, output: "Launch readiness status" },
      { label: "Approve proposal and production handoff", owner: "human", requiresApproval: true, output: "Human-approved launch package" },
    ],
    prohibited: [...SHARED_PROHIBITED, "No autonomous political persuasion conversation or campaign launch."],
    goLiveRequirement: "Political outreach policy and candidate data freshness must be confirmed first.",
  },
  {
    id: "procurement-savings-review",
    title: "Procurement Savings Review",
    dashboard: "Inventory / Procurement",
    route: "/inventory-purchasing/dashboard",
    status: "ready_to_plan",
    risk: "medium",
    objective: "Help a business owner review savings, compare vendors, approve smart buys, and track delivered value.",
    steps: [
      { label: "Summarize savings and inventory risks", owner: "ai", requiresApproval: false, output: "Owner-ready summary" },
      { label: "Recommend smart-buy actions", owner: "ai", requiresApproval: true, output: "Approval-ready purchase recommendation" },
      { label: "Owner approves, edits, snoozes, or rejects", owner: "human", requiresApproval: true, output: "Purchase decision" },
      { label: "Create manual/vendor-manager follow-up", owner: "system", requiresApproval: true, output: "Internal task, not a live order" },
    ],
    prohibited: [...SHARED_PROHIBITED, "No supplier order without owner approval and connected safe ordering workflow."],
    goLiveRequirement: "Postmark procurement senders and procurement sequence should be verified before automated emails.",
  },
  {
    id: "gov-contract-bid-room",
    title: "Gov Contract Bid Room",
    dashboard: "Gov Contracts",
    route: "/admin/gov-contracts",
    status: "review_only",
    risk: "high",
    objective: "Move an opportunity from SAM.gov discovery to go/no-go, bid-room checklist, subcontractor matching, proposal prep, and human approval.",
    steps: [
      { label: "Ingest and score opportunity", owner: "system", requiresApproval: false, output: "Fit score and risk summary" },
      { label: "Open Bid Room and decide go/no-go", owner: "human", requiresApproval: true, output: "Pursuit decision" },
      { label: "Draft compliance checklist and proposal notes", owner: "ai", requiresApproval: true, output: "Review-ready bid materials" },
      { label: "Collect subcontractor quotes manually", owner: "human", requiresApproval: true, output: "Approved quote package" },
      { label: "Final submission decision", owner: "human", requiresApproval: true, output: "Human-owned submission" },
    ],
    prohibited: [...SHARED_PROHIBITED, "No autonomous bid submission, pricing commitment, certification claim, subcontractor commitment, or award acceptance."],
    goLiveRequirement: "SAM.gov cadence, alerts, and human bid approval workflow must be confirmed.",
  },
  {
    id: "learning-engine-promotion",
    title: "Learning Engine Idea Promotion",
    dashboard: "Learning Engine",
    route: "/admin/content-intel",
    status: "ready_to_plan",
    risk: "medium",
    objective: "Move an ingested idea from source analysis to conflict check, human review, Action Center promotion, and implementation planning.",
    steps: [
      { label: "Ingest trusted source", owner: "system", requiresApproval: false, output: "Pending queue item" },
      { label: "Extract and score idea", owner: "ai", requiresApproval: false, output: "Review-ready insight" },
      { label: "Check duplicates and conflicts", owner: "system", requiresApproval: false, output: "Overlap warning" },
      { label: "Approve, reject, or promote to Action Center", owner: "human", requiresApproval: true, output: "Internal implementation candidate" },
      { label: "Plan implementation safely", owner: "human", requiresApproval: true, output: "Scoped task, tests, rollback path" },
    ],
    prohibited: [...SHARED_PROHIBITED, "No production implementation directly from ingestion."],
    goLiveRequirement: "Learning Engine should launch in review-only mode first.",
  },
  {
    id: "targeted-campaign-revenue-path",
    title: "Targeted Campaign Revenue Path",
    dashboard: "Targeted Campaigns",
    route: "/admin/targeted-campaigns",
    status: "needs_setup",
    risk: "medium",
    objective: "Guide a targeted campaign from service area selection to route review, postcard approval, payment, and fulfillment readiness.",
    steps: [
      { label: "Review route and audience plan", owner: "human", requiresApproval: true, output: "Confirmed geography" },
      { label: "Validate pricing and quantities", owner: "system", requiresApproval: true, output: "Quote readiness" },
      { label: "Approve creative/proposal", owner: "human", requiresApproval: true, output: "Approved campaign package" },
      { label: "Use existing Stripe checkout", owner: "system", requiresApproval: true, output: "Payment through protected flow" },
      { label: "Update admin/customer dashboards", owner: "system", requiresApproval: false, output: "Campaign record visibility" },
    ],
    prohibited: [...SHARED_PROHIBITED, "No checkout without verified price, quantity, route data, and customer handoff records."],
    goLiveRequirement: "Revenue path test should pass before expanding automation.",
  },
];

export function getWorkflowRecipeCatalog(): WorkflowRecipeCatalog {
  return {
    generatedAt: nowIso(),
    summary: {
      total: RECIPES.length,
      reviewOnly: RECIPES.filter((recipe) => recipe.status === "review_only").length,
      needsSetup: RECIPES.filter((recipe) => recipe.status === "needs_setup").length,
      highRisk: RECIPES.filter((recipe) => recipe.risk === "high").length,
    },
    recipes: RECIPES,
  };
}
