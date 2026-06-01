import { DIGITAL_TARGETING_MANAGEMENT_FEE_CENTS, formatUsd } from "./config";

export const DIGITAL_CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  new_lead: "New Lead",
  intake_complete: "Intake Complete",
  payment_pending: "Payment Pending",
  target_area_review: "Target Area Review",
  creative_needed: "Creative Needed",
  ad_spend_needed: "Ad Spend Needed",
  ready_to_launch: "Ready to Launch",
  live: "Live",
  reporting: "Reporting",
  renewal_upsell: "Renewal / Upsell",
  paused: "Paused",
  cancelled: "Cancelled",
};

export const DIGITAL_PIPELINE_STAGES = [
  "new_lead",
  "intake_complete",
  "payment_pending",
  "target_area_review",
  "creative_needed",
  "ad_spend_needed",
  "ready_to_launch",
  "live",
  "reporting",
  "renewal_upsell",
] as const;

export type DigitalPipelineStage = (typeof DIGITAL_PIPELINE_STAGES)[number];

export const TARGETING_TYPE_LABELS: Record<string, string> = {
  jobsite_neighborhood: "Jobsite Neighborhood",
  competitor_area: "Competitor Area",
  event_area: "Event Area",
  neighborhood: "Neighborhood",
  political_geography: "Political Geography",
  service_area: "Service Area",
  custom_area: "Custom Area",
};

export const OBJECTIVE_LABELS: Record<string, string> = {
  leads: "Leads",
  calls: "Calls",
  website_visits: "Website Visits",
  brand_awareness: "Brand Awareness",
  event_promotion: "Event Promotion",
  political_awareness: "Political Awareness",
  neighborhood_saturation: "Neighborhood Saturation",
};

export type DigitalTaskSeed = {
  title: string;
  owner: "jason" | "heather" | "josh" | "chelsi" | "unassigned";
  dueOffsetDays: number;
};

export const DIGITAL_FULFILLMENT_TASKS: DigitalTaskSeed[] = [
  { title: "Review intake", owner: "jason", dueOffsetDays: 0 },
  { title: "Validate business/contact info", owner: "chelsi", dueOffsetDays: 0 },
  { title: "Confirm payment", owner: "jason", dueOffsetDays: 1 },
  { title: "Confirm ad spend budget", owner: "heather", dueOffsetDays: 1 },
  { title: "Confirm targeting area", owner: "jason", dueOffsetDays: 1 },
  { title: "Confirm creative assets", owner: "chelsi", dueOffsetDays: 2 },
  { title: "Generate ad copy", owner: "josh", dueOffsetDays: 2 },
  { title: "Generate image/ad creative", owner: "josh", dueOffsetDays: 3 },
  { title: "Build landing page if needed", owner: "jason", dueOffsetDays: 4 },
  { title: "Launch Meta campaign or mark manual launch complete", owner: "jason", dueOffsetDays: 5 },
  { title: "Launch Google/display campaign or mark manual launch complete", owner: "jason", dueOffsetDays: 5 },
  { title: "Add tracking links", owner: "jason", dueOffsetDays: 5 },
  { title: "Send client launch confirmation", owner: "chelsi", dueOffsetDays: 6 },
  { title: "Schedule monthly report", owner: "heather", dueOffsetDays: 7 },
];

export function buildDigitalTaskRows(campaignId: string, start = new Date()) {
  return DIGITAL_FULFILLMENT_TASKS.map((task, index) => {
    const due = new Date(start);
    due.setDate(due.getDate() + task.dueOffsetDays);
    return {
      campaign_id: campaignId,
      title: task.title,
      owner: task.owner,
      status: "open",
      due_date: due.toISOString(),
      task_order: index + 1,
    };
  });
}

type DraftInput = {
  campaignId: string;
  businessName: string;
  industry?: string | null;
  objective: string;
  targetingType: string;
  monthlyAdSpendCents: number;
  offer?: string | null;
  directMailAddon: boolean;
  landingPageNeeded: boolean;
};

function objectiveText(value: string) {
  return value
    .split(",")
    .map((part) => OBJECTIVE_LABELS[part.trim()] ?? part.trim())
    .filter(Boolean)
    .join(", ");
}

function targetingText(value: string) {
  return value
    .split(",")
    .map((part) => TARGETING_TYPE_LABELS[part.trim()] ?? part.trim())
    .filter(Boolean)
    .join(", ");
}

export function buildDigitalDraftRows(input: DraftInput) {
  const industry = input.industry || "local business";
  const objective = objectiveText(input.objective) || "local visibility";
  const targeting = targetingText(input.targetingType) || "target neighborhoods";
  const budget = formatUsd(input.monthlyAdSpendCents);
  const offer = input.offer?.trim() || "a clear local offer";
  const mailLine = input.directMailAddon
    ? "This can also be paired with postcards to reinforce the same neighborhoods."
    : "Postcards can be added if the owner wants repeated digital and mailbox exposure.";

  const drafts = [
    {
      draft_type: "meta_ad_copy",
      content: `${input.businessName} helps nearby homeowners get the job handled without the stress. If you live near one of our recent projects, this is a simple way to start: ${offer}. Learn more or request a quick quote today.`,
    },
    {
      draft_type: "google_display_ad_copy",
      content: `Headline: ${input.businessName} near you\nDescription: Local ${industry} help for homeowners in the neighborhoods that matter most. ${offer}.`,
    },
    {
      draft_type: "landing_page_headline",
      content: `Local ${industry} help for homeowners in your neighborhood.`,
    },
    {
      draft_type: "sms_follow_up",
      content: `Hi, this is HomeReach helping ${input.businessName}. We received your interest and can help with next steps when you are ready. Reply STOP to opt out.`,
    },
    {
      draft_type: "email_follow_up",
      content: `Subject: A quick next step from ${input.businessName}\n\nHi there,\n\nThanks for taking a look at ${input.businessName}. The goal is simple: make it easier to get trusted local help without chasing around for answers. If you want, reply with the best time to connect and we will help get the next step organized.\n\nHomeReach Team`,
    },
    {
      draft_type: "dm_draft",
      content: `Thanks for reaching out. ${input.businessName} is running a local neighborhood campaign so nearby homeowners can get help faster. What address or area should we use for the quote?`,
    },
    {
      draft_type: "client_launch_email",
      content: `Subject: Your Neighborhood Digital Targeting campaign is ready for launch review\n\nHi,\n\nYour campaign plan is built around ${targeting}, with the goal of ${objective}. The management fee is ${formatUsd(DIGITAL_TARGETING_MANAGEMENT_FEE_CENTS)}/month, and your ad spend budget is ${budget}/month.\n\nBefore anything goes live, HomeReach will confirm the target area, creative, ad spend, tracking link, and approval status. ${mailLine}\n\nResults vary and ad platform approval is required, but the campaign is designed to keep your business visible in the local areas that matter most.`,
    },
    {
      draft_type: "monthly_report_summary",
      content: `Monthly summary draft: ${input.businessName} stayed visible across ${targeting}. Review impressions, clicks, spend, leads/calls where available, landing page visits, QR scans if postcards were included, and the next recommended adjustment. No guaranteed results are implied.`,
    },
  ];

  return drafts.map((draft) => ({
    campaign_id: input.campaignId,
    draft_type: draft.draft_type,
    content: draft.content,
    created_by: "ai_draft_generator",
  }));
}
