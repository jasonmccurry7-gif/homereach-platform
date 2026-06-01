export type GrowthActionStatus = "ready" | "draft_ready" | "approval_needed" | "connected" | "integration_needed";

export type GrowthAction = {
  title: string;
  body: string;
  impact: string;
  urgency: "high" | "medium" | "low";
  cta: string;
  href?: string;
  status: GrowthActionStatus;
};

export type GrowthAgent = {
  name: string;
  role: string;
  nextAction: string;
  allowedActions: string[];
  approvalRequiredFor: string[];
};

export type GrowthMetric = {
  label: string;
  value: string;
  detail: string;
};

export type GrowthContentKind =
  | "social_post"
  | "google_post"
  | "review_request"
  | "seasonal_campaign"
  | "community_post"
  | "targeted_mail";

export type GrowthContentDraft = {
  kind: GrowthContentKind;
  title: string;
  channel: string;
  copy: string;
  cta: string;
  approvalNote: string;
  reuseIdea: string;
};

export type GrowthOnboardingInput = {
  businessName: string;
  city: string;
  services: string;
  customers: string;
};

export type GrowthOnboardingPlan = {
  summary: string;
  recommendedSetup: string[];
  nextActions: GrowthAction[];
};

export type GrowthConnectedModule = {
  title: string;
  body: string;
  href: string;
  cta: string;
  status: string;
};

export type GrowthAgentControl = {
  title: string;
  owner: string;
  guardrail: string;
  status: "active" | "needs_integration" | "review_required";
};

export type AiGrowthOsSnapshot = {
  positioning: {
    eyebrow: string;
    headline: string;
    subheadline: string;
    promise: string;
  };
  metrics: GrowthMetric[];
  actions: GrowthAction[];
  quickActions: GrowthAction[];
  agents: GrowthAgent[];
  contentDrafts: GrowthContentDraft[];
  connectedModules: GrowthConnectedModule[];
  agentControls: GrowthAgentControl[];
  approvalRules: string[];
};

const defaultBusiness = "your business";
const defaultCity = "your city";
const defaultServices = "your core services";
const defaultCustomers = "local customers";

export const growthAgents: GrowthAgent[] = [
  {
    name: "Visibility Agent",
    role: "Finds Google profile, listing, and local SEO opportunities that make the business easier to discover.",
    nextAction: "Launch the visibility scan and turn the top fixes into owner-approved tasks.",
    allowedActions: ["Score visibility", "Draft profile improvements", "Recommend service and city pages"],
    approvalRequiredFor: ["Publishing pages", "Changing business profiles", "Making ranking claims"],
  },
  {
    name: "Lead Capture Agent",
    role: "Turns website visitors and campaign traffic into named leads with service need, urgency, and follow-up status.",
    nextAction: "Request an AI Assistant demo and approve the first knowledge base draft.",
    allowedActions: ["Collect lead details", "Summarize conversations", "Flag urgent opportunities"],
    approvalRequiredFor: ["Outbound texts", "Outbound emails", "Appointment confirmations"],
  },
  {
    name: "Social Content Agent",
    role: "Creates simple local posts, Google Business Profile post drafts, seasonal content, and campaign ideas.",
    nextAction: "Generate one useful post and send it to review before scheduling or Canva export.",
    allowedActions: ["Draft posts", "Create content angles", "Repurpose approved offers"],
    approvalRequiredFor: ["Publishing social posts", "Using political content", "Launching ads"],
  },
  {
    name: "Review Agent",
    role: "Helps generate review requests, draft replies, and protect reputation without auto-posting sensitive responses.",
    nextAction: "Approve review request language and review any negative-response drafts manually.",
    allowedActions: ["Draft review requests", "Draft review replies", "Flag negative reviews"],
    approvalRequiredFor: ["Sending requests", "Posting public replies", "Responding to sensitive reviews"],
  },
  {
    name: "Campaign Agent",
    role: "Connects visibility work to shared postcards, targeted mail, and simple local campaign ideas.",
    nextAction: "Build one campaign idea from the business type, city, and customer goal.",
    allowedActions: ["Draft campaign concepts", "Recommend CTA paths", "Prepare postcard copy blocks"],
    approvalRequiredFor: ["Launching campaigns", "Changing budget", "Approving creative"],
  },
  {
    name: "Margin Agent",
    role: "Connects growth work to procurement and supply savings when the business has recurring costs.",
    nextAction: "Offer a supply savings review when industry and spend suggest a strong fit.",
    allowedActions: ["Recommend savings review", "Flag cost-reduction opportunity", "Draft owner summary"],
    approvalRequiredFor: ["Ordering supplies", "Changing vendors", "Committing spend"],
  },
];

export const baseGrowthActions: GrowthAction[] = [
  {
    title: "Launch Visibility Scan",
    body: "Find the trust and Google profile fixes most likely to help customers choose the business.",
    impact: "More calls and stronger trust signals",
    urgency: "high",
    cta: "Launch Visibility Scan",
    href: "/local-visibility#visibility-scan",
    status: "ready",
  },
  {
    title: "Request AI Assistant",
    body: "Set up the 24/7 website front desk so visitors become leads instead of disappearing.",
    impact: "More captured leads",
    urgency: "high",
    cta: "Request AI Assistant",
    href: "/services/ai-website-assistant#assistant-demo",
    status: "ready",
  },
  {
    title: "Create Content",
    body: "Generate one local post, Google profile post, or review request draft for approval.",
    impact: "Faster weekly visibility",
    urgency: "medium",
    cta: "Create Content",
    status: "draft_ready",
  },
  {
    title: "Build Campaign",
    body: "Turn the offer into a simple postcard or targeted campaign concept with a clear next step.",
    impact: "More local customer acquisition",
    urgency: "medium",
    cta: "Build Campaign",
    href: "/targeted/start",
    status: "connected",
  },
];

export const connectedGrowthModules: GrowthConnectedModule[] = [
  {
    title: "AI Web Assistant",
    body: "Answer visitors, capture leads, route urgent requests, and summarize conversations.",
    href: "/services/ai-website-assistant#assistant-demo",
    cta: "Request AI Assistant",
    status: "Live demo intake",
  },
  {
    title: "Local Visibility",
    body: "Score Google profile health, reputation momentum, listings, and local SEO basics.",
    href: "/local-visibility#visibility-scan",
    cta: "Launch Visibility Scan",
    status: "Live scan intake",
  },
  {
    title: "Shared Postcards",
    body: "Turn local visibility into physical neighborhood reach with simple monthly mail.",
    href: "/shared-postcards",
    cta: "See Shared Campaigns",
    status: "Connected product",
  },
  {
    title: "Targeted Campaigns",
    body: "Build a more focused neighborhood campaign around the business's best customers.",
    href: "/targeted/start",
    cta: "Build Campaign",
    status: "Connected intake",
  },
  {
    title: "Supply Savings",
    body: "For restaurants, contractors, and operators, connect growth to margin protection.",
    href: "/inventory-purchasing",
    cta: "Review Costs",
    status: "Connected product",
  },
  {
    title: "Content Review",
    body: "Admin review remains the publishing gate for generated content and campaign drafts.",
    href: "/admin/content-review",
    cta: "Open Review Queue",
    status: "Admin approval",
  },
];

export const growthAgentControls: GrowthAgentControl[] = [
  {
    title: "Approval gate",
    owner: "Orchestrator Agent",
    guardrail: "Every generated output enters human review before public use, outbound sending, campaign launch, pricing, or profile changes.",
    status: "active",
  },
  {
    title: "Source and input trace",
    owner: "Research Agent",
    guardrail: "Queued tasks store business inputs, channel, CTA, reuse idea, source modules, and approval notes in AI Workforce metadata.",
    status: "active",
  },
  {
    title: "Content safety review",
    owner: "SEO QA Agent",
    guardrail: "Drafts are tagged as unverified until reviewed for facts, claims, local specificity, CTA clarity, and spam risk.",
    status: "active",
  },
  {
    title: "Outbound lock",
    owner: "Outreach Agent",
    guardrail: "The Growth Center cannot send SMS, email, Google posts, social posts, ads, or review replies directly.",
    status: "active",
  },
  {
    title: "Canva export handoff",
    owner: "Design Brief Agent",
    guardrail: "Canva export creates an approval task first. Live asset creation requires the Canva connection and human approval.",
    status: "needs_integration",
  },
  {
    title: "Performance learning",
    owner: "Data / Revenue Agent",
    guardrail: "Winning content reuse is session-only until approved output performance and publication records are connected.",
    status: "review_required",
  },
];


export const starterContentDrafts: GrowthContentDraft[] = [
  {
    kind: "social_post",
    title: "Simple local proof post",
    channel: "Facebook / LinkedIn",
    copy:
      "Local customers usually do not need a long sales pitch. They need to know who shows up, what you do well, and how to take the next step. This week, we are making it easier to ask questions, request help, and get a clear answer from a local team.",
    cta: "Message us with what you need help with this week.",
    approvalNote: "Draft only. Human approval required before publishing.",
    reuseIdea: "Reuse as a Facebook post, GBP post, or postcard support line.",
  },
  {
    kind: "google_post",
    title: "Google Business Profile update",
    channel: "Google Business Profile",
    copy:
      "Need help from a local team this week? We are available for practical questions, service requests, and clear next steps. Send a message or call and we will point you in the right direction.",
    cta: "Call or request a quote today.",
    approvalNote: "Draft only. GBP publishing requires approval and live GBP integration.",
    reuseIdea: "Turn into a short SMS-safe follow-up after customer approval.",
  },
  {
    kind: "review_request",
    title: "Warm review request",
    channel: "SMS / Email",
    copy:
      "Thanks again for choosing us. If everything went well, would you be willing to leave a quick review? It helps more local customers feel confident reaching out.",
    cta: "Use the approved review link.",
    approvalNote: "Draft only. Sending requires opt-in, review link confirmation, and approval.",
    reuseIdea: "Use after completed jobs or positive customer replies.",
  },
  {
    kind: "targeted_mail",
    title: "Neighborhood campaign angle",
    channel: "Postcard / Targeted mail",
    copy:
      "A simple neighborhood campaign should make one thing obvious: who you help, where you work, and what action the homeowner should take next. Keep the offer clean, local, and easy to respond to.",
    cta: "Request your local campaign plan.",
    approvalNote: "Draft only. Creative, budget, routes, and launch require approval.",
    reuseIdea: "Use as the strategy brief for postcard copy and landing page sections.",
  },
];

export function getAiGrowthOsSnapshot(): AiGrowthOsSnapshot {
  const launchVisibilityScan = baseGrowthActions[0]!;
  const requestAiAssistant = baseGrowthActions[1]!;
  const createContent = baseGrowthActions[2]!;
  const buildCampaign = baseGrowthActions[3]!;

  return {
    positioning: {
      eyebrow: "AI-Powered Local Business Growth OS",
      headline: "Make AI feel useful, simple, and profitable.",
      subheadline:
        "HomeReach connects AI Web Assistant, Local Visibility, Reputation, Social Content, Reviews, Campaigns, and follow-up into one action-oriented growth center.",
      promise:
        "The owner sees what matters, what changed, and what to do next without managing another complicated tool.",
    },
    metrics: [
      { label: "Leads captured", value: "18", detail: "Website and campaign inquiries ready for follow-up." },
      { label: "Visibility score", value: "82", detail: "Google profile, listings, review momentum, and local SEO." },
      { label: "Drafts ready", value: "7", detail: "Posts, review requests, GBP updates, and campaign copy." },
      { label: "Next actions", value: "4", detail: "High-value tasks surfaced for owner approval." },
    ],
    actions: baseGrowthActions,
    quickActions: [
      { ...createContent, cta: "Create Content" },
      {
        title: "Generate Post",
        body: "Create one fast social or Google profile post draft from the business context.",
        impact: "Fresh local visibility",
        urgency: "medium",
        cta: "Generate Post",
        status: "draft_ready",
      },
      {
        title: "Generate Campaign",
        body: "Create a simple campaign concept that can become a postcard, post, or follow-up sequence.",
        impact: "More local demand",
        urgency: "medium",
        cta: "Generate Campaign",
        status: "draft_ready",
      },
      requestAiAssistant,
      launchVisibilityScan,
      buildCampaign,
    ],
    agents: growthAgents,
    contentDrafts: starterContentDrafts,
    connectedModules: connectedGrowthModules,
    agentControls: growthAgentControls,
    approvalRules: [
      "AI can draft posts, replies, content, campaigns, and follow-ups.",
      "Humans approve public posts, review replies, outbound messages, ads, pricing, and campaigns.",
      "Political publishing and outreach always require human approval.",
      "Payment, vendor, procurement, and customer commitments stay protected.",
    ],
  };
}

export function buildGrowthOnboardingPlan(input: GrowthOnboardingInput): GrowthOnboardingPlan {
  const businessName = clean(input.businessName, defaultBusiness);
  const city = clean(input.city, defaultCity);
  const services = clean(input.services, defaultServices);
  const customers = clean(input.customers, defaultCustomers);

  return {
    summary: `${businessName} should start with a simple ${city} growth setup: capture website leads, improve local trust, create useful weekly content, and connect the best offer to a campaign path for ${customers}.`,
    recommendedSetup: [
      `AI Assistant profile for ${services}`,
      `Visibility scan for ${city} search and trust signals`,
      `Weekly local content rhythm for ${customers}`,
      "Review request and reply drafts with human approval",
      "Campaign idea tied to one clear customer action",
    ],
    nextActions: [
      {
        title: "Create the assistant profile",
        body: `Use ${services} and ${city} to draft the greeting, FAQ, lead questions, and handoff rules.`,
        impact: "Fewer missed leads",
        urgency: "high",
        cta: "Request AI Assistant",
        href: "/services/ai-website-assistant#assistant-demo",
        status: "ready",
      },
      {
        title: "Run the visibility scan",
        body: `Score ${businessName}'s Google profile, reviews, listings, and local SEO basics before making public claims.`,
        impact: "More trust before purchase",
        urgency: "high",
        cta: "Launch Visibility Scan",
        href: "/local-visibility#visibility-scan",
        status: "ready",
      },
      {
        title: "Draft the first content pack",
        body: `Create a local post, Google update, and review request around ${services}.`,
        impact: "Visible momentum this week",
        urgency: "medium",
        cta: "Create Content",
        status: "draft_ready",
      },
    ],
  };
}

export function createGrowthContentDraft(kind: GrowthContentKind, input: GrowthOnboardingInput): GrowthContentDraft {
  const businessName = clean(input.businessName, "this local business");
  const city = clean(input.city, defaultCity);
  const services = clean(input.services, defaultServices);
  const customers = clean(input.customers, defaultCustomers);

  if (kind === "google_post") {
    return {
      kind,
      title: `${city} Google profile update`,
      channel: "Google Business Profile",
      copy: `${businessName} helps ${customers} in ${city} with ${services}. If you need a clear answer, a local recommendation, or the next step, reach out this week and we will help you move forward.`,
      cta: "Call or request help today.",
      approvalNote: "Draft only. GBP publishing requires approval and live Google profile integration.",
      reuseIdea: "Reuse as a short Facebook update or local visibility post.",
    };
  }

  if (kind === "review_request") {
    return {
      kind,
      title: `${businessName} review request`,
      channel: "SMS / Email",
      copy: `Thanks for choosing ${businessName}. If the experience was helpful, a quick review would mean a lot and help more ${city} customers feel confident reaching out.`,
      cta: "Use the approved review link.",
      approvalNote: "Draft only. Sending requires consent, review-link confirmation, and human approval.",
      reuseIdea: "Use after completed work, positive replies, or follow-up calls.",
    };
  }

  if (kind === "seasonal_campaign") {
    return {
      kind,
      title: `${city} seasonal campaign`,
      channel: "Social / Postcard / Email",
      copy: `${city} customers are planning ahead. ${businessName} can turn that timing into a simple campaign around ${services}: one clear offer, one local proof point, and one easy way to respond.`,
      cta: "Build the seasonal campaign.",
      approvalNote: "Draft only. Budget, creative, routes, and sends require approval.",
      reuseIdea: "Turn into a postcard headline, email subject, and Facebook group post.",
    };
  }

  if (kind === "community_post") {
    return {
      kind,
      title: `${city} community post`,
      channel: "Facebook / LinkedIn / Community groups",
      copy: `${businessName} is focused on making ${services} simpler for ${customers} around ${city}. If you have a question, need a second opinion, or just want to know what happens next, send a message and we will point you in the right direction.`,
      cta: "Message us with your question.",
      approvalNote: "Draft only. Community group posting requires manual review and group-rule compliance.",
      reuseIdea: "Use as a warm outreach DM or website FAQ intro.",
    };
  }

  if (kind === "targeted_mail") {
    return {
      kind,
      title: `${city} targeted campaign concept`,
      channel: "Targeted mail / Shared postcard",
      copy: `${businessName} should use one clean neighborhood campaign: show ${customers} in ${city} what problem you solve, why the local team is trustworthy, and how to respond in one step.`,
      cta: "Request a local campaign plan.",
      approvalNote: "Draft only. Mailing geography, pricing, proof, and launch require approval.",
      reuseIdea: "Use as a postcard brief and landing page section.",
    };
  }

  return {
    kind,
    title: `${businessName} local social post`,
    channel: "Facebook / LinkedIn / Instagram caption",
    copy: `${businessName} helps ${customers} in ${city} with ${services}. The goal is simple: make it easier to get a clear answer, take the right next step, and feel confident choosing a local team.`,
    cta: "Send a message to get started.",
    approvalNote: "Draft only. Social publishing requires human approval.",
    reuseIdea: "Use as a Facebook post, LinkedIn update, or Canva caption.",
  };
}

function clean(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}
