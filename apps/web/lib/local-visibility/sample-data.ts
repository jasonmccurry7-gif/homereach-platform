import { buildLocalVisibilityScorecard, type LocalVisibilityScorecard } from "./scoring";

export type LocalVisibilityActionStatus = "needs_review" | "draft_ready" | "approved" | "blocked" | "monitoring";

export type LocalVisibilityAction = {
  title: string;
  detail: string;
  owner: "business" | "homereach" | "ai_agent";
  impact: "high" | "medium" | "low";
  status: LocalVisibilityActionStatus;
  cta: string;
};

export type LocalVisibilityAgent = {
  name: string;
  role: string;
  allowedActions: string[];
  requiresApprovalFor: string[];
  nextOutput: string;
};

export type LocalVisibilityDashboardSnapshot = {
  businessName: string;
  location: string;
  category: string;
  scorecard: LocalVisibilityScorecard;
  metrics: {
    reviewRequestsSent: number;
    reviewsGenerated: number;
    averageRating: string;
    unansweredReviews: number;
    listingIssues: number;
    weeklyProfileActions: number;
  };
  actions: LocalVisibilityAction[];
  agents: LocalVisibilityAgent[];
  alerts: LocalVisibilityAction[];
  packages: {
    name: string;
    price: string;
    bestFor: string;
    includes: string[];
  }[];
};

export const localVisibilityAgents: LocalVisibilityAgent[] = [
  {
    name: "Review Agent",
    role: "Requests reviews, tracks review velocity, drafts replies, and flags urgent review issues.",
    allowedActions: ["Draft review requests", "Draft review replies", "Summarize review trends", "Flag low ratings"],
    requiresApprovalFor: ["Sending review requests", "Posting public replies", "Responding to sensitive reviews"],
    nextOutput: "Review request plan and response drafts",
  },
  {
    name: "Listings Agent",
    role: "Checks name, address, phone, hours, categories, and directory consistency.",
    allowedActions: ["Audit listings", "Recommend corrections", "Create update checklist", "Flag inconsistencies"],
    requiresApprovalFor: ["Changing public listings", "Submitting directory updates"],
    nextOutput: "Listings correction checklist",
  },
  {
    name: "Google Profile Agent",
    role: "Monitors profile completeness, posts, photos, services, categories, and profile activity.",
    allowedActions: ["Recommend profile fixes", "Draft Google posts", "Suggest photos and services", "Summarize profile gaps"],
    requiresApprovalFor: ["Publishing Google posts", "Changing GBP fields"],
    nextOutput: "Google profile optimization brief",
  },
  {
    name: "Local SEO Agent",
    role: "Suggests city pages, service pages, FAQs, review keywords, and local search improvements.",
    allowedActions: ["Draft page briefs", "Recommend FAQs", "Suggest internal links", "Prioritize city/service opportunities"],
    requiresApprovalFor: ["Publishing website pages", "Changing public claims"],
    nextOutput: "Local SEO page plan",
  },
  {
    name: "Reputation Risk Agent",
    role: "Flags negative trends, repeated complaints, review drops, and urgent trust risks.",
    allowedActions: ["Detect risk", "Summarize issue themes", "Create response task", "Escalate urgent alerts"],
    requiresApprovalFor: ["Contacting unhappy customers", "Posting sensitive public responses"],
    nextOutput: "Reputation risk alert",
  },
  {
    name: "Insight Agent",
    role: "Explains what changed this week and what the business should do next.",
    allowedActions: ["Generate weekly brief", "Rank next actions", "Summarize impact", "Create owner-friendly updates"],
    requiresApprovalFor: ["Sending external reports"],
    nextOutput: "Weekly visibility briefing",
  },
];

export function getLocalVisibilitySnapshot(): LocalVisibilityDashboardSnapshot {
  const scorecard = buildLocalVisibilityScorecard({
    businessName: "Example Local Business",
    website: "https://example.com",
    phone: "(330) 555-0100",
    city: "Akron",
    state: "OH",
    category: "Home services",
    googleBusinessProfileUrl: "https://business.google.com/example",
  });

  return {
    businessName: "Example Local Business",
    location: "Akron, OH",
    category: "Home services",
    scorecard,
    metrics: {
      reviewRequestsSent: 38,
      reviewsGenerated: 9,
      averageRating: "4.7",
      unansweredReviews: 3,
      listingIssues: 4,
      weeklyProfileActions: 12,
    },
    actions: [
      {
        title: "Approve 12 review requests",
        detail: "Recent completed jobs are ready for a polite review request. Messages stay human-approved.",
        owner: "business",
        impact: "high",
        status: "needs_review",
        cta: "Review Requests",
      },
      {
        title: "Add 8 service photos to Google",
        detail: "Fresh photos help the profile look active and can improve trust before customers call.",
        owner: "homereach",
        impact: "medium",
        status: "draft_ready",
        cta: "View Photo Plan",
      },
      {
        title: "Draft replies for unanswered reviews",
        detail: "AI can draft brand-safe replies, but posting remains approval-only.",
        owner: "ai_agent",
        impact: "high",
        status: "draft_ready",
        cta: "Review Replies",
      },
      {
        title: "Create a service-area FAQ page",
        detail: "A short local FAQ can support search visibility and reduce repeat questions.",
        owner: "homereach",
        impact: "medium",
        status: "needs_review",
        cta: "View SEO Brief",
      },
    ],
    alerts: [
      {
        title: "Review response gap",
        detail: "Three reviews need a reply. Responding quickly makes the business look attentive.",
        owner: "business",
        impact: "high",
        status: "needs_review",
        cta: "Draft Replies",
      },
      {
        title: "Listings consistency check needed",
        detail: "Hours and phone format should be verified across major directories.",
        owner: "homereach",
        impact: "medium",
        status: "monitoring",
        cta: "Audit Listings",
      },
    ],
    agents: localVisibilityAgents,
    packages: [
      {
        name: "Starter Visibility",
        price: "$299/mo",
        bestFor: "New local visibility foundation",
        includes: ["GBP audit", "Review request links", "Basic review dashboard", "Monthly visibility report"],
      },
      {
        name: "Growth Reputation",
        price: "$599/mo",
        bestFor: "Review velocity and weekly action",
        includes: ["Approved review requests", "AI review reply drafts", "Listings health checks", "Weekly recommendations"],
      },
      {
        name: "Local Dominance",
        price: "$999+/mo",
        bestFor: "Competitive or multi-location markets",
        includes: ["Full reputation command center", "Listings optimization", "Local SEO recommendations", "Monthly strategy report"],
      },
    ],
  };
}

