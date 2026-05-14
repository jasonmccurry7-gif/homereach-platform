import type {
  CandidateLaunchPlanRow,
  CandidateResearchRow,
} from "@/lib/political/candidate-launch-agent";
import type { CandidateRow } from "@/lib/political/queries";

export type CandidateReadinessStatus = "complete" | "review" | "blocked";

export interface CandidateReadinessGate {
  key:
    | "source"
    | "contact"
    | "boundary"
    | "usps"
    | "quote"
    | "approval"
    | "checkout";
  label: string;
  status: CandidateReadinessStatus;
  detail: string;
  action: string;
}

export interface CandidateLaunchReadiness {
  score: number;
  statusLabel: string;
  checkoutEnabled: boolean;
  approvalEnabled: boolean;
  productionEnabled: boolean;
  proposalDraftAllowed: boolean;
  nextRequiredAction: string;
  gates: CandidateReadinessGate[];
}

interface ReadinessInput {
  candidate: CandidateRow;
  latestResearch: CandidateResearchRow | null;
  latestPlan: CandidateLaunchPlanRow | null;
}

function hasValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function sourceLooksUnofficial(value: string | null | undefined): boolean {
  return /unofficial|pending|expected|canvass/i.test(value ?? "");
}

function planHasUspsSource(plan: CandidateLaunchPlanRow | null): boolean {
  const sources = plan?.planJson?.data_sources ?? [];
  return sources.some((source) => {
    const label = `${source.label ?? ""} ${source.url ?? ""}`.toLowerCase();
    return label.includes("usps") || label.includes("eddm") || label.includes("bmeu");
  });
}

function planHasValidPhasePricing(plan: CandidateLaunchPlanRow | null): boolean {
  const phases = plan?.planJson?.phases ?? [];
  if (phases.length === 0) return false;

  return phases.every((phase) => {
    const pricePerPostcard = Number(phase.price_per_postcard_cents ?? 0);
    const pieces = Number(phase.billable_piece_count ?? phase.household_count ?? 0);
    const print = Number(phase.estimated_print_cost_cents ?? 0);
    const postage = Number(phase.estimated_postage_cost_cents ?? 0);
    const total = Number(phase.total_estimated_cost_cents ?? 0);

    return (
      pieces > 0 &&
      print > 0 &&
      postage > 0 &&
      total > 0 &&
      pricePerPostcard > 0 &&
      pricePerPostcard <= 70
    );
  });
}

function firstAction(gates: CandidateReadinessGate[]): string {
  return (
    gates.find((gate) => gate.status === "blocked")?.action ??
    gates.find((gate) => gate.status === "review")?.action ??
    "Ready for verified proposal and checkout."
  );
}

export function buildCandidateLaunchReadiness({
  candidate,
  latestResearch,
  latestPlan,
}: ReadinessInput): CandidateLaunchReadiness {
  const sourceLoaded =
    hasValue(candidate.sourceUrl) &&
    hasValue(candidate.dataVerifiedAt) &&
    Boolean(latestResearch?.dataSources?.length);
  const sourceNeedsCertification =
    sourceLooksUnofficial(latestResearch?.sourceFreshness) ||
    sourceLooksUnofficial(candidate.notes);
  const contactSignals = [
    candidate.campaignWebsite,
    candidate.campaignEmail,
    candidate.campaignPhone,
    candidate.facebookUrl,
    candidate.campaignManagerEmail,
  ].filter(hasValue).length;
  const geographySelected = hasValue(candidate.geographyType) && hasValue(candidate.geographyValue);
  const statewideOhio =
    candidate.geographyType === "state" &&
    candidate.geographyValue?.toLowerCase() === "ohio";
  const hasPlanVolume =
    latestPlan !== null &&
    latestPlan.totalHouseholds > 0 &&
    latestPlan.totalEstimatedCostCents > 0;
  const hasUspsSource = planHasUspsSource(latestPlan);
  const validPhasePricing = planHasValidPhasePricing(latestPlan);
  const quoteComplete = hasPlanVolume && validPhasePricing && hasUspsSource;
  const planApproved =
    latestPlan?.status === "approved" ||
    latestPlan?.status === "proposal_ready" ||
    latestPlan?.status === "production_ready";

  const gates: CandidateReadinessGate[] = [
    {
      key: "source",
      label: "Source verified",
      status: !sourceLoaded ? "blocked" : sourceNeedsCertification ? "review" : "complete",
      detail: !sourceLoaded
        ? "No source-backed research record is attached yet."
        : sourceNeedsCertification
          ? "Source data is loaded, but the result is marked unofficial or certification-pending."
          : "Candidate source, freshness, and research summary are attached.",
      action: !sourceLoaded
        ? "Run Candidate Research or attach an official filing/results source."
        : sourceNeedsCertification
          ? "Recheck the official election source after certification."
          : "No source action needed.",
    },
    {
      key: "contact",
      label: "Campaign contact verified",
      status: contactSignals >= 2 ? "complete" : contactSignals === 1 ? "review" : "blocked",
      detail:
        contactSignals >= 2
          ? "Campaign website/contact fields are present."
          : contactSignals === 1
            ? "One contact signal exists, but a direct email/phone or manager contact is still needed."
            : "No campaign website, email, phone, or manager contact is attached.",
      action:
        contactSignals >= 2
          ? "No contact action needed."
          : "Verify the official campaign site and add email, phone, or manager contact.",
    },
    {
      key: "boundary",
      label: "Boundary verified",
      status: !geographySelected ? "blocked" : statewideOhio ? "complete" : "review",
      detail: !geographySelected
        ? "No campaign geography is selected."
        : statewideOhio
          ? "Statewide Ohio geography is selected for governor/statewide planning."
          : "Geography is selected, but district/county/city boundary still needs official GIS confirmation.",
      action: !geographySelected
        ? "Select the candidate's state, district, county, or city geography."
        : statewideOhio
          ? "No boundary action needed for statewide Ohio."
          : "Validate the boundary against the official election/GIS source.",
    },
    {
      key: "usps",
      label: "USPS counts loaded",
      status: hasPlanVolume && hasUspsSource ? "complete" : hasPlanVolume ? "review" : "blocked",
      detail:
        hasPlanVolume && hasUspsSource
          ? "Plan volume is backed by USPS/EDDM/BMEU source labels."
          : hasPlanVolume
            ? "A plan has estimated volume, but USPS route/count source labels are missing."
            : "No deliverable household/mail-piece count is loaded yet.",
      action:
        hasPlanVolume && hasUspsSource
          ? "No USPS action needed."
          : "Load or attach USPS EDDM/carrier-route counts before quoting.",
    },
    {
      key: "quote",
      label: "Quote verified",
      status: quoteComplete ? "complete" : hasPlanVolume && validPhasePricing ? "review" : "blocked",
      detail: quoteComplete
        ? "Piece counts, print, postage, total, and per-postcard caps are present."
        : hasPlanVolume && validPhasePricing
          ? "Pricing math exists, but USPS source verification is still missing."
          : "Quote cannot be verified until plan pieces, print, postage, total, and per-postcard price are complete.",
      action: quoteComplete
        ? "No quote action needed."
        : "Generate or update the plan after USPS counts are attached.",
    },
    {
      key: "approval",
      label: "Human approval",
      status: planApproved ? "complete" : latestPlan ? "review" : "blocked",
      detail: planApproved
        ? "A HomeReach operator has approved or advanced this plan."
        : latestPlan
          ? "A draft plan exists and needs human review before client-facing use."
          : "No launch plan exists yet.",
      action: planApproved
        ? "No approval action needed."
        : "Review the plan, compliance notes, source freshness, route counts, and creative before approval.",
    },
    {
      key: "checkout",
      label: "Checkout enabled",
      status: quoteComplete && planApproved ? "complete" : "blocked",
      detail:
        quoteComplete && planApproved
          ? "Verified plan can move toward client-facing proposal/checkout."
          : "Checkout remains locked until source, contact, boundary, USPS counts, quote, and human approval are complete.",
      action:
        quoteComplete && planApproved
          ? "Proceed through the verified proposal/checkout workflow."
          : "Finish all readiness gates before creating checkout.",
    },
  ];

  const score = Math.round(
    gates.reduce((total, gate) => {
      if (gate.status === "complete") return total + 100;
      if (gate.status === "review") return total + 50;
      return total;
    }, 0) / gates.length,
  );

  const checkoutEnabled = quoteComplete && planApproved;
  const approvalEnabled =
    Boolean(latestPlan) &&
    gates
      .filter((gate) => gate.key !== "approval" && gate.key !== "checkout")
      .every((gate) => gate.status === "complete");

  return {
    score,
    statusLabel: checkoutEnabled
      ? "Verified launch package"
      : score >= 65
        ? "In verification"
        : "Prebuilt profile",
    checkoutEnabled,
    approvalEnabled,
    productionEnabled: checkoutEnabled,
    proposalDraftAllowed: Boolean(latestPlan),
    nextRequiredAction: firstAction(gates),
    gates,
  };
}
