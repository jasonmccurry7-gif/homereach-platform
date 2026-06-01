import { MARKET_CAPTURE_MANAGEMENT_FEE_CENTS, formatUsd } from "./config";

export const MARKET_CAPTURE_PIPELINE_STAGES = [
  "new_lead",
  "intake_complete",
  "needs_review",
  "payment_pending",
  "qualified",
  "ready_for_fulfillment",
  "campaign_setup",
  "asset_collection",
  "creative_review",
  "client_approval",
  "ready_for_launch",
  "live",
  "reporting",
  "renewal_opportunity",
  "closed",
  "closed_won",
  "closed_lost",
] as const;

export const MARKET_CAPTURE_STAGE_LABELS: Record<string, string> = {
  new_lead: "New Lead",
  intake_complete: "Intake Complete",
  needs_review: "Needs Review",
  payment_pending: "Payment Pending",
  qualified: "Qualified",
  ready_for_fulfillment: "Ready For Fulfillment",
  campaign_setup: "Campaign Setup",
  asset_collection: "Asset Collection",
  creative_review: "Creative Review",
  client_approval: "Client Approval",
  ready_for_launch: "Ready For Launch",
  live: "Live",
  reporting: "Reporting",
  renewal_opportunity: "Renewal Opportunity",
  closed: "Closed",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export const MARKET_CAPTURE_OBJECTIVE_LABELS: Record<string, string> = {
  leads: "Leads",
  calls: "Calls",
  website_visits: "Website Visits",
  awareness: "Awareness",
  event_promotion: "Event Promotion",
  neighborhood_saturation: "Neighborhood Saturation",
  political_awareness: "Political Awareness",
  competitor_visibility: "Competitor Visibility",
  jobsite_expansion: "Jobsite Expansion",
};

export const MARKET_CAPTURE_TARGETING_LABELS: Record<string, string> = {
  jobsite_halo: "Jobsite Halo",
  competitor_area: "Competitor Area",
  neighborhood_saturation: "Neighborhood Saturation",
  service_area: "Service Area",
  event_area: "Event Area",
  political_geography: "Political Geography",
  custom_area: "Custom Area",
  digital_direct_mail: "Digital + Direct Mail",
};

type SalesTaskSeed = {
  title: string;
  owner: "jason" | "josh" | "chelsi" | "heather";
  dueOffsetDays: number;
  notes?: string;
};

export const MARKET_CAPTURE_SALES_TASKS: SalesTaskSeed[] = [
  { title: "Review intake", owner: "jason", dueOffsetDays: 0 },
  { title: "Contact prospect", owner: "josh", dueOffsetDays: 0 },
  { title: "Confirm budget", owner: "jason", dueOffsetDays: 1 },
  { title: "Confirm target area", owner: "jason", dueOffsetDays: 1 },
  { title: "Discuss direct mail", owner: "josh", dueOffsetDays: 1 },
  { title: "Discuss landing page", owner: "chelsi", dueOffsetDays: 2 },
  { title: "Payment follow-up", owner: "jason", dueOffsetDays: 2 },
  { title: "Move to fulfillment", owner: "heather", dueOffsetDays: 3, notes: "Only after payment, budget, target area, and scope are confirmed." },
];

export function buildMarketCaptureTaskRows(input: {
  leadId: string;
  pipelineId?: string | null;
  start?: Date;
}) {
  const start = input.start ?? new Date();
  return MARKET_CAPTURE_SALES_TASKS.map((task, index) => {
    const due = new Date(start);
    due.setDate(due.getDate() + task.dueOffsetDays);
    return {
      market_capture_lead_id: input.leadId,
      pipeline_id: input.pipelineId ?? null,
      title: task.title,
      owner: task.owner,
      status: "open",
      due_date: due.toISOString(),
      notes: task.notes ?? null,
      task_order: index + 1,
    };
  });
}

type DraftInput = {
  leadId: string;
  businessName: string;
  contactName: string;
  industry: string;
  objective: string;
  targetingType: string;
  monthlyAdBudgetCents: number;
  monthlyManagementFeeCents?: number;
  targetArea: string;
  campaignOffer?: string | null;
  postcardAddon: boolean;
  landingPageNeeded: boolean;
};

function labelList(value: string, labels: Record<string, string>) {
  return value
    .split(",")
    .map((item) => labels[item.trim()] ?? item.trim())
    .filter(Boolean)
    .join(", ");
}

function targetExample(targetingType: string) {
  if (targetingType.includes("jobsite_halo")) return "Jobsite Halo";
  if (targetingType.includes("competitor_area")) return "Competitor Campaign";
  if (targetingType.includes("event_area")) return "Event Campaign";
  if (targetingType.includes("neighborhood_saturation")) return "Neighborhood Saturation";
  if (targetingType.includes("political_geography")) return "Political Campaign";
  if (targetingType.includes("digital_direct_mail")) return "Digital + Direct Mail";
  return "Market Capture";
}

export function buildMarketCaptureDraftRows(input: DraftInput) {
  const objective = labelList(input.objective, MARKET_CAPTURE_OBJECTIVE_LABELS) || "local visibility";
  const targeting = labelList(input.targetingType, MARKET_CAPTURE_TARGETING_LABELS) || "target area";
  const offer = input.campaignOffer?.trim() || "a clear local offer";
  const budget = formatUsd(input.monthlyAdBudgetCents);
  const managementFee = formatUsd(input.monthlyManagementFeeCents ?? MARKET_CAPTURE_MANAGEMENT_FEE_CENTS);
  const example = targetExample(input.targetingType);
  const directMailLine = input.postcardAddon
    ? "Because you asked about postcards, we can also discuss pairing the digital campaign with direct mail to the same area."
    : "Postcards can be added if you want the same neighborhoods to see you online and in the mailbox.";

  const drafts = [
    {
      draft_type: "email",
      label: `${example} Email Draft`,
      content: `Subject: Your Market Capture request from HomeReach\n\nHi ${input.contactName},\n\nThanks for sending over the details for ${input.businessName}. Based on what you shared, the first opportunity is a ${targeting} plan built around ${objective} in ${input.targetArea}.\n\nThe HomeReach management fee is ${managementFee}/month, and your ad spend budget is separate and controlled by you. ${directMailLine}\n\nThe next step is a quick review of your target area, budget, and offer: ${offer}.\n\nBest,\nHomeReach`,
    },
    {
      draft_type: "sms",
      label: `${example} SMS Draft`,
      content: `Hi ${input.contactName}, this is HomeReach. We received the Market Capture request for ${input.businessName}. I'm reviewing the target area and ${budget}/mo ad budget now. Want me to send the next-step plan? Reply STOP to opt out.`,
    },
    {
      draft_type: "dm",
      label: `${example} DM Draft`,
      content: `Thanks for reaching out. We can build this as a Market Capture plan around ${targeting.toLowerCase()} so ${input.businessName} stays visible in ${input.targetArea}. The next step is confirming the offer, budget, and best start date.`,
    },
    {
      draft_type: "proposal_intro",
      label: `${example} Proposal Intro`,
      content: `${input.businessName} has an opportunity to stay visible in the areas most likely to create local demand: ${input.targetArea}. HomeReach will build a Market Capture plan around ${targeting.toLowerCase()}, with a ${managementFee}/month management fee and client-funded ad spend of approximately ${budget}/month. Results vary and platform approval is required; the goal is repeat local visibility and a cleaner path to qualified opportunities.`,
    },
    {
      draft_type: "discovery_questions",
      label: `${example} Discovery Questions`,
      content: [
        `Which neighborhoods or jobsites have produced your best customers so far?`,
        `Do you want this campaign to prioritize ${objective.toLowerCase()} or broader visibility?`,
        `Is ${budget}/month the initial ad budget you want to test?`,
        `Should postcards be included for the same target area?`,
        `Do you already have a landing page or should HomeReach quote one?`,
        `What offer should homeowners see first: ${offer}?`,
      ].join("\n"),
    },
  ];

  return drafts.map((draft) => ({
    market_capture_lead_id: input.leadId,
    draft_type: draft.draft_type,
    label: draft.label,
    content: draft.content,
    created_by: "sales_draft_generator",
  }));
}

export function badgeClass(status: string) {
  if (["qualified", "ready_for_fulfillment", "ready_for_launch", "live", "reporting", "closed_won", "paid", "approved"].includes(status)) {
    return "bg-emerald-100 text-emerald-800";
  }
  if (["needs_review", "payment_pending", "checkout_created", "campaign_setup", "asset_collection", "creative_review", "client_approval", "renewal_opportunity", "awaiting_approval", "uploaded", "needs_review"].includes(status)) {
    return "bg-blue-100 text-blue-800";
  }
  if (["payment_required", "manual_invoice_needed", "intake_complete", "missing", "not_started", "requested", "proposed", "scheduled"].includes(status)) {
    return "bg-amber-100 text-amber-900";
  }
  if (["closed_lost", "failed", "refunded", "rejected", "blocked", "needs_revision"].includes(status)) return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}
