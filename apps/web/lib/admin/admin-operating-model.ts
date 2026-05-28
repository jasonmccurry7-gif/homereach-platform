export const ADMIN_EXECUTIVE_LAYER = {
  name: "Executive Command Center",
  path: "/admin",
  role:
    "Canonical admin home for executive visibility, revenue movement, system health, AI workforce status, and owner action.",
  compatibilityAliases: [
    {
      path: "/admin/os",
      destination: "/admin",
      reason: "Preserved compatibility route for older HomeReach OS links.",
    },
  ],
  modules: [
    {
      label: "Executive Review",
      href: "/admin/content-review",
      owner: "Approval Governance",
      role: "Central review queue for revenue, political, procurement, creative, GovCon, content, and AI outputs.",
    },
    {
      label: "Revenue Command",
      href: "/admin/revenue-operations",
      owner: "Revenue Ops",
      role: "Pipeline movement, replies, approvals, and payment visibility.",
    },
    {
      label: "Outreach Command",
      href: "/admin/outreach-command",
      owner: "Revenue Ops",
      role: "Manual outreach execution, drafts, queues, and deliverability-safe actions.",
    },
    {
      label: "Control Tower",
      href: "/admin/control-center",
      owner: "Platform Health",
      role: "Operational health, blockers, automation posture, and system readiness.",
    },
    {
      label: "AI Workforce",
      href: "/admin/agents",
      owner: "AI Operations",
      role: "Agent task manifest, approvals, activity logs, and governance.",
    },
    {
      label: "AI Growth OS",
      href: "/admin/ai-growth-os",
      owner: "Growth Modules",
      role: "Growth module supervision. It is not a separate executive shell.",
    },
    {
      label: "ContractOS",
      href: "/admin/contractos",
      owner: "GovCon Packaging",
      role: "Packaging and product surface for government-contract workflows.",
    },
    {
      label: "Gov Contracts",
      href: "/admin/gov-contracts",
      owner: "GovCon Approval",
      role: "Canonical bid/no-bid, approval, evidence, and submission-status surface.",
    },
  ],
} as const;

export const DEPLOYMENT_GOVERNANCE = {
  authoritativeVercelConfig: "vercel.json",
  mirrorVercelConfig: "apps/web/vercel.json",
  rule:
    "Production deploys run from the repository root, so root vercel.json is the deployment and cron source of truth. The app-level file mirrors root for clarity only.",
  schedulerChangeRule:
    "Update root vercel.json and apps/web/vercel.json together, schedule only committed/validated API routes, then verify the cron sets match before deploy.",
} as const;

export const CONTRACT_WORKFLOW_GOVERNANCE = {
  approvalOwnerLabel: "Gov Contracts",
  approvalOwnerPath: "/admin/gov-contracts",
  packagingSurfaceLabel: "ContractOS",
  packagingSurfacePath: "/admin/contractos",
  rule:
    "ContractOS packages, monitors, and sells the workflow. Gov Contracts owns bid/no-bid, approval evidence, submission readiness, external status records, pricing review, and subcontractor commitment controls.",
  protectedActions: [
    "External bid submission",
    "Eligibility or compliance certification",
    "Pricing approval",
    "Subcontractor commitment",
    "Award acceptance",
  ],
} as const;

export const COMMAND_CENTER_EXPANSION_FREEZE = {
  status: "active",
  rule:
    "Do not add new admin command centers, shells, or duplicate approval surfaces unless the existing executive shell, executive review queue, or module owner cannot safely own the workflow.",
  requiredDecisionBeforeNewSurface: [
    "Which existing executive module cannot own this?",
    "Which approval queue owns the human decision?",
    "Which cron or automation source owns scheduling?",
    "Which source of truth owns live-vs-demo readiness?",
    "What revenue growth outcome justifies the extra surface?",
  ],
} as const;
