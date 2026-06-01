export type ContractOSPlanKey = "watchtower" | "workspace" | "proposal_assist" | "managed_bid";

export type ContractOSPricingPlan = {
  key: ContractOSPlanKey;
  label: string;
  publicLabel: string;
  description: string;
  mode: "payment" | "subscription";
  priceEnvKey: string;
  standardPriceLabel: string;
  founderPriceLabel: string;
  checkoutPriceCents: number;
  cadenceLabel: string;
  checkoutAmountLabel: string;
  includedAiSummaries: string;
  aiSummaryOverageLabel: string;
  bestFor: string;
  highlights: string[];
};

export const CONTRACTOS_PRICING_PLANS: ContractOSPricingPlan[] = [
  {
    key: "watchtower",
    label: "ContractOS Watchtower",
    publicLabel: "Watchtower",
    description: "Opportunity monitoring, SAM.gov matching, plain-English summaries, and deadline visibility.",
    mode: "subscription",
    priceEnvKey: "STRIPE_CONTRACTOS_WATCHTOWER_PRICE_ID",
    standardPriceLabel: "$359/mo",
    founderPriceLabel: "$299/mo",
    checkoutPriceCents: 29_900,
    cadenceLabel: "monthly",
    checkoutAmountLabel: "$299/month founder rate",
    includedAiSummaries: "1 AI solicitation summary/month",
    aiSummaryOverageLabel: "$49 per additional summary",
    bestFor: "Getting visibility without committing to proposal work yet.",
    highlights: [
      "SAM.gov opportunity watchlist",
      "Plain-English opportunity summaries",
      "Deadline and next-action tracking",
      "Monthly opportunity report",
    ],
  },
  {
    key: "workspace",
    label: "ContractOS Workspace",
    publicLabel: "Workspace",
    description: "Monthly bid workspace, watchlist, readiness tracking, and AI-assisted proposal organization.",
    mode: "subscription",
    priceEnvKey: "STRIPE_CONTRACTOS_WORKSPACE_PRICE_ID",
    standardPriceLabel: "$959/mo",
    founderPriceLabel: "$799/mo",
    checkoutPriceCents: 79_900,
    cadenceLabel: "monthly",
    checkoutAmountLabel: "$799/month founder rate",
    includedAiSummaries: "5 AI solicitation summaries/month",
    aiSummaryOverageLabel: "$39 per additional summary",
    bestFor: "A business that wants a real government-contract operating lane.",
    highlights: [
      "Everything in Watchtower",
      "Bid/no-bid scorecards",
      "Compliance checklist support",
      "Monthly strategy review",
    ],
  },
  {
    key: "proposal_assist",
    label: "Proposal Assist Sprint",
    publicLabel: "Proposal Assist",
    description: "Paid proposal drafting support lane with every output marked Draft - Human Review Required.",
    mode: "payment",
    priceEnvKey: "STRIPE_CONTRACTOS_PROPOSAL_ASSIST_PRICE_ID",
    standardPriceLabel: "$1,800-$3,000",
    founderPriceLabel: "$1,500-$2,500",
    checkoutPriceCents: 150_000,
    cadenceLabel: "per opportunity",
    checkoutAmountLabel: "Starts at $1,500 founder rate",
    includedAiSummaries: "AI summaries included for the selected opportunity",
    aiSummaryOverageLabel: "Additional documents scoped before work starts",
    bestFor: "A client that has one opportunity and needs help organizing the response.",
    highlights: [
      "Solicitation breakdown",
      "Compliance matrix",
      "Proposal outline and draft sections",
      "Submission checklist",
    ],
  },
  {
    key: "managed_bid",
    label: "Managed Bid Desk",
    publicLabel: "Managed Bid Desk",
    description: "Human-led review, pricing guardrails, subcontractor planning, and submission package preparation.",
    mode: "payment",
    priceEnvKey: "STRIPE_CONTRACTOS_MANAGED_BID_PRICE_ID",
    standardPriceLabel: "$4,200-$9,000",
    founderPriceLabel: "$3,500-$7,500",
    checkoutPriceCents: 350_000,
    cadenceLabel: "per bid",
    checkoutAmountLabel: "Starts at $3,500 founder rate",
    includedAiSummaries: "AI summaries included for the selected bid package",
    aiSummaryOverageLabel: "Complexity and document volume scoped before work starts",
    bestFor: "Serious opportunities with more documents, deadlines, or subcontractor coordination.",
    highlights: [
      "Human-led bid review",
      "Pricing and risk guardrails",
      "Subcontractor planning notes",
      "Response package preparation",
    ],
  },
];

export function getContractOSPricingPlan(key: ContractOSPlanKey) {
  return CONTRACTOS_PRICING_PLANS.find((plan) => plan.key === key) ?? null;
}
