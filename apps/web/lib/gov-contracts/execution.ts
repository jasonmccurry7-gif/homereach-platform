import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import {
  syncGovContractBidRoomLedger,
  syncGovContractSubmissionPackageLedger,
} from "@/lib/approvals/gov-contracts-ledger";
import { createServiceClient } from "@/lib/supabase/service";
import { loadGovContractOpportunity, logGovContractAuditEvent } from "./data";
import { buildGovContractMarketResearchPacket } from "./market-research";
import { buildGovContractOperatingModel } from "./os";
import type {
  GovContractAIBidAssistant,
  GovContractBidDecision,
  GovContractBidRecommendation,
  GovContractOperatingModel,
  GovContractBidWorkspace,
  GovContractComplianceMatrixItem,
  GovContractMarketResearchPacket,
  GovContractOpportunity,
  GovContractPipelineStatus,
  GovContractPostAwardPlan,
  GovContractPricingLineItem,
  GovContractPricingModel,
  GovContractResearchSource,
  GovContractSubmissionPlan,
  GovContractSubcontractorNeed,
  GovContractWorkflowItem,
} from "./types";

type AnyRow = Record<string, unknown>;

function hasSupabaseServiceEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function cents(value: number) {
  return Math.max(0, Math.round(value));
}

function pct(amount: number, percent: number) {
  return cents(amount * percent);
}

function sum(items: GovContractPricingLineItem[]) {
  return items.reduce((total, item) => total + item.amountCents, 0);
}

function safeBid(costCents: number, marginPercent: number) {
  const margin = Math.max(0.01, Math.min(0.75, marginPercent / 100));
  return cents(costCents / (1 - margin));
}

const BLOCKING_WORK_STATUSES = new Set(["missing", "needs_review", "pending"]);
const APPROVED_OR_COMPLETE_STATUSES = new Set(["approved", "complete", "completed", "ready", "verified"]);
const SAFE_SUBCONTRACTOR_STAGES = new Set([
  "approved",
  "selected",
  "verified",
  "complete",
  "completed",
  "not_applicable",
]);

export type GovContractSubmissionSafetyReport = {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  requiredHumanActions: string[];
};

function opportunitySource(opportunity: GovContractOpportunity): GovContractResearchSource {
  if (opportunity.isSample) {
    return {
      label: "Sample opportunity record",
      type: "internal",
      url: null,
      status: "estimated",
      note: "Sample workflow data only. Do not treat as verified market, award, or solicitation data.",
      retrievedAt: null,
      freshnessLabel: "sample placeholder",
      verifiedData: false,
    };
  }

  return {
    label: opportunity.sourceSystem === "sam.gov" ? "SAM.gov opportunity record" : "Manual opportunity record",
    type: opportunity.sourceSystem === "sam.gov" ? "sam" : "manual",
    url: opportunity.sourceUrl,
    status: opportunity.sourceUrl || opportunity.lastSyncedAt ? "verified" : "manual_review",
    note:
      opportunity.sourceSystem === "sam.gov"
        ? "Loaded opportunity data. Attachments, amendments, and solicitation instructions still require human review."
        : "Manual record. Verify against the official notice before pricing, outreach, or proposal work.",
    retrievedAt: opportunity.lastSyncedAt ?? opportunity.postedDate,
    freshnessLabel: opportunity.lastSyncedAt ? `last synced ${opportunity.lastSyncedAt}` : "freshness not confirmed",
    verifiedData: Boolean(opportunity.sourceUrl || opportunity.lastSyncedAt),
  };
}

function isSubcontractorLikely(opportunity: GovContractOpportunity) {
  const text = [opportunity.title, opportunity.summary, opportunity.naicsCode, opportunity.pscCode]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    opportunity.pipelineStatus === "need_subcontractor" ||
    opportunity.scoreBreakdown.subcontractability >= 68 ||
    ["janitorial", "grounds", "courier", "warehouse", "multi-site", "regional"].some((term) => text.includes(term))
  );
}

function recommendationFor(opportunity: GovContractOpportunity): GovContractBidRecommendation {
  if (opportunity.fitScore >= 78 && opportunity.riskScore <= 44) return "Strong Bid";
  if (isSubcontractorLikely(opportunity) && opportunity.fitScore >= 68) return "Subcontractor-Led";
  if (opportunity.fitScore >= 68 && opportunity.riskScore <= 58) return "Good Fit";
  if (isSubcontractorLikely(opportunity) && opportunity.fitScore >= 52) return "Teaming Recommended";
  if (opportunity.fitScore >= 58 && opportunity.riskScore <= 62) return "Possible Bid";
  if (opportunity.fitScore >= 45 && opportunity.riskScore <= 75) return "Partner Needed";
  if (opportunity.fitScore < 38) return "No-Bid";
  return "High Risk";
}

export function buildBidNoBidDecision(opportunity: GovContractOpportunity): GovContractBidDecision {
  const recommendation = recommendationFor(opportunity);
  const subcontractorLikely = isSubcontractorLikely(opportunity);
  const missingRequirements = [
    ...opportunity.missingItems,
    ...(opportunity.requiredDocuments.length ? [] : ["official required document list"]),
    ...(opportunity.responseMethod ? [] : ["submission method"]),
    ...(opportunity.contractType ? [] : ["contract type"]),
  ];
  const highRisk = opportunity.riskScore >= 68 || opportunity.urgency === "critical";

  return {
    recommendation,
    why: [
      `Fit score is ${opportunity.fitScore}/100 and current fit status is ${opportunity.fitStatus.replace("_", " ")}.`,
      `Scope appears ${subcontractorLikely ? "subcontractor-friendly or partner-dependent" : "within direct HomeReach-adjacent operations"}.`,
      opportunity.estimatedValueCents
        ? "Estimated value is present, so pricing can be modeled before pursuit approval."
        : "Estimated value is missing, so pursuit should stay in review until value and scope are clarified.",
    ],
    risks: [
      highRisk ? "Deadline, compliance, or performance risk is elevated." : "Risk appears manageable if requirements are verified.",
      subcontractorLikely ? "Subcontractor availability, insurance, and quote quality must be confirmed before pricing." : "Direct execution assumptions still require owner review.",
      "Eligibility, certifications, and representations must be reviewed by a human before any submission.",
    ],
    missingRequirements,
    estimatedEffort:
      highRisk || missingRequirements.length >= 4
        ? "Very High"
        : subcontractorLikely || missingRequirements.length >= 2
        ? "High"
        : opportunity.fitScore >= 78
        ? "Moderate"
        : "High",
    recommendedNextStep:
      recommendation === "No-Bid"
        ? "Record no-bid unless a strategic partner changes the economics."
        : "Start bid workspace, confirm required documents, and run pricing before any external commitment.",
    capabilityFit: subcontractorLikely
      ? "HomeReach may prime or coordinate, but subcontractor capability is likely required."
      : "HomeReach capabilities appear adjacent to the scope; validate official attachments.",
    eligibilityFit: opportunity.setAsideDescription
      ? `Set-aside listed as ${opportunity.setAsideDescription}; verify actual eligibility before bid.`
      : "No set-aside data is loaded; verify SAM registration, UEI/CAGE, and solicitation eligibility.",
    financialFit: opportunity.estimatedValueCents
      ? "Financial model can be created, but margin must include admin, compliance, payment-delay, and rework risk."
      : "Financial fit is incomplete until value, volumes, and pricing instructions are known.",
    operationalFit: opportunity.urgency === "critical"
      ? "Operational timeline is tight. Do not start unless submission feasibility is confirmed today."
      : "Operational timeline appears reviewable; confirm deliverables and staffing.",
    competitionFit: opportunity.incumbentVendor
      ? `Incumbent listed as ${opportunity.incumbentVendor}; evaluate displacement risk.`
      : "Incumbent and competitor signals are not loaded; treat win probability as advisory.",
  };
}

function buildFarPriceReasonablenessChecks(
  opportunity: GovContractOpportunity,
  input: {
    hasEstimatedValue: boolean;
    totalCost: number;
    minimumSafeBidCents: number;
    recommendedBidCents: number;
    subcontractorLikely: boolean;
  }
) {
  const contractType = opportunity.contractType?.toLowerCase() ?? "";
  const costRealismRelevant = /cost|time.?and.?materials|labor.?hour/.test(contractType);
  const hasPriorAwardAmount = typeof opportunity.awardAmountCents === "number" && opportunity.awardAmountCents > 0;
  const sourceLabel = opportunitySource(opportunity).freshnessLabel ?? "source freshness not confirmed";

  return [
    `FAR 15.402: fair-and-reasonable support is incomplete until competition, historical prices, market prices, or other data are attached. Current basis: ${sourceLabel}.`,
    input.hasEstimatedValue
      ? `FAR 15.404-1(b): compare the recommended bid (${input.recommendedBidCents} cents) to proposed competitors, prior prices, IGCE, market/catalog prices, or validated parametric yardsticks before approval.`
      : "FAR 15.404-1(b): price analysis is blocked because no value, quantity schedule, pricing sheet, or prior paid price is loaded.",
    hasPriorAwardAmount
      ? `Historical award amount is loaded at ${opportunity.awardAmountCents} cents; still adjust for quantity, terms, scope, timing, and market factors before using it as a comparison.`
      : "Historical award placeholder: no verified prior award is loaded. Search agency, office, NAICS, PSC, solicitation number, and award history before treating any range as competitive.",
    costRealismRelevant
      ? "FAR 15.404-1(d): cost realism review is relevant because the contract type appears cost-reimbursement, time-and-materials, or labor-hour."
      : "FAR 15.404-1(d): cost realism may still be useful for performance-risk review, but final evaluation must follow the solicitation criteria.",
    "FAR 15.404-1(f)-(g): review unit-price integrity and unbalanced pricing risk if the solicitation uses CLINs, options, mobilization, or estimated quantities.",
    input.subcontractorLikely
      ? "FAR Part 44 / 44.202-2: subcontractor pricing, responsibility, exclusions, flow-downs, consent, and advance-notification risk require human review before selection."
      : "FAR Part 44 check remains available if scope changes or a subcontractor becomes part of the performance plan.",
    input.totalCost > input.minimumSafeBidCents
      ? "Model warning: total loaded cost exceeds the minimum safe bid calculation. Verify formulas before use."
      : "Internal model guardrail: minimum safe bid is above loaded planning cost, but it is not final price approval.",
  ];
}

function normalizedStatus(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function needsVerification(value: string | null | undefined) {
  if (!value) return true;
  return /verify|not loaded|not listed|tbd|to be determined/i.test(value);
}

function isBlockingWorkItem(item: GovContractWorkflowItem) {
  return BLOCKING_WORK_STATUSES.has(item.status);
}

export function buildGovContractSubmissionSafetyReport(
  opportunity: GovContractOpportunity,
  workspace: GovContractBidWorkspace
): GovContractSubmissionSafetyReport {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!workspace.persisted) {
    blockers.push("A persisted bid room is required before ready-to-submit, submitted, award, or evaluation status can be recorded.");
  }

  for (const item of workspace.requirements) {
    if (item.priority === "critical" && isBlockingWorkItem(item)) {
      blockers.push(`Critical requirement still blocked: ${item.title} (${item.status.replaceAll("_", " ")}).`);
    } else if (isBlockingWorkItem(item)) {
      warnings.push(`Requirement still needs review: ${item.title}.`);
    }
  }

  for (const item of workspace.documents) {
    if (item.status === "not_applicable") continue;
    if (item.priority === "critical" && isBlockingWorkItem(item)) {
      blockers.push(`Critical document still blocked: ${item.title} (${item.status.replaceAll("_", " ")}).`);
    } else if (item.status === "missing") {
      blockers.push(`Required document is missing: ${item.title}.`);
    } else if (isBlockingWorkItem(item)) {
      warnings.push(`Document still needs review: ${item.title}.`);
    }
  }

  for (const item of workspace.complianceMatrix) {
    if (!item.humanReviewRequired || item.status === "not_applicable") continue;
    if (!APPROVED_OR_COMPLETE_STATUSES.has(normalizedStatus(item.status))) {
      blockers.push(`Compliance item requires human completion: ${item.requirement}.`);
    }
  }

  if (workspace.pricing.minimumSafeBidCents <= 0 || workspace.pricing.recommendedBidCents <= 0) {
    blockers.push("Pricing cannot be approved until a value, quantity basis, or pricing schedule is verified.");
  }

  if (workspace.pricing.recommendedBidCents > 0 && workspace.pricing.recommendedBidCents < workspace.pricing.minimumSafeBidCents) {
    blockers.push("Recommended bid is below the minimum safe bid.");
  }

  if (!opportunity.dueDate) {
    blockers.push("Response deadline is missing.");
  }

  if (needsVerification(workspace.submissionPlan.method) || needsVerification(workspace.submissionPlan.portalOrEmail)) {
    blockers.push("Submission method, portal/email, and file delivery instructions must be verified from the solicitation.");
  }

  for (const need of workspace.subcontractorNeeds) {
    const stage = normalizedStatus(need.pipelineStage);
    if (!SAFE_SUBCONTRACTOR_STAGES.has(stage)) {
      blockers.push(`Subcontractor need is not approved/verified: ${need.workCategory} (${need.pipelineStage}).`);
    }
  }

  if (workspace.approvalStatus !== "approved") {
    warnings.push(`Current bid-room approval status is ${workspace.approvalStatus.replaceAll("_", " ")}.`);
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    requiredHumanActions: [
      "Approve final pricing and margin.",
      "Complete compliance and eligibility review.",
      "Approve any subcontractor selection, quote, agreement, or spend commitment.",
      "Verify the final submission method, deadline, file names, and portal/email requirements.",
      "Record external submission or award evidence; the platform does not submit or bind HomeReach.",
    ],
  };
}

export function buildPricingModel(opportunity: GovContractOpportunity): GovContractPricingModel {
  const hasEstimatedValue = typeof opportunity.estimatedValueCents === "number" && opportunity.estimatedValueCents > 0;
  const valueBase = hasEstimatedValue ? opportunity.estimatedValueCents! : 0;
  const subcontractorLikely = isSubcontractorLikely(opportunity);
  const riskMultiplier = Math.max(0.08, opportunity.riskScore / 450);
  const targetGrossMargin = clamp(20 + opportunity.riskScore * 0.12, 22, 38);
  const minimumAcceptableMargin = 16;
  const targetNetMargin = clamp(targetGrossMargin - 8, 10, 26);
  const missingValueNote = hasEstimatedValue
    ? ""
    : " Pricing is blocked until solicitation value, quantities, or the required pricing schedule are verified.";

  const directCosts: GovContractPricingLineItem[] = [
    {
      key: "direct_labor",
      label: "Direct labor",
      amountCents: pct(valueBase, subcontractorLikely ? 0.12 : 0.24),
      note: `Execution labor, setup, production, or field coordination.${missingValueNote}`,
    },
    {
      key: "subcontractor",
      label: "Subcontractor pricing",
      amountCents: subcontractorLikely ? pct(valueBase, 0.38) : pct(valueBase, 0.08),
      note: `Quote placeholder until subcontractor pricing is received.${missingValueNote}`,
    },
    {
      key: "materials",
      label: "Materials / supplies",
      amountCents: pct(valueBase, 0.12),
      note: `Materials, consumables, print/mail inputs, or equipment-dependent supplies.${missingValueNote}`,
    },
    {
      key: "travel_delivery",
      label: "Travel / delivery / fulfillment",
      amountCents: pct(valueBase, opportunity.location.state === "OH" ? 0.04 : 0.08),
      note: `Geography and delivery burden.${missingValueNote}`,
    },
  ];

  const indirectCosts: GovContractPricingLineItem[] = [
    {
      key: "admin_compliance",
      label: "Compliance and admin time",
      amountCents: pct(valueBase, 0.08),
      note: `Solicitation review, reporting, representations review, and contract admin.${missingValueNote}`,
    },
    {
      key: "project_management",
      label: "Project management",
      amountCents: pct(valueBase, 0.07),
      note: `Owner oversight, subcontractor management, status reporting, and QA.${missingValueNote}`,
    },
    {
      key: "insurance_accounting",
      label: "Insurance / accounting review",
      amountCents: pct(valueBase, 0.025),
      note: `Administrative burden that is easy to underprice.${missingValueNote}`,
    },
  ];

  const riskAdders: GovContractPricingLineItem[] = [
    {
      key: "scope_uncertainty",
      label: "Scope uncertainty",
      amountCents: pct(valueBase, riskMultiplier),
      note: `Unclear scope, amendments, unknown quantities, or missing attachments.${missingValueNote}`,
    },
    {
      key: "cash_flow_delay",
      label: "Payment delay / cash flow",
      amountCents: pct(valueBase, 0.035),
      note: `Government payment timing and working-capital cushion.${missingValueNote}`,
    },
    {
      key: "rework_quality",
      label: "Rework and quality control",
      amountCents: pct(valueBase, opportunity.riskScore >= 60 ? 0.055 : 0.025),
      note: `QC, corrections, and performance-risk reserve.${missingValueNote}`,
    },
  ];

  const totalCost = sum(directCosts) + sum(indirectCosts) + sum(riskAdders);
  const minimumSafeBidCents = safeBid(totalCost, minimumAcceptableMargin);
  const aggressiveBidCents = safeBid(totalCost, minimumAcceptableMargin + 3);
  const recommendedBidCents = safeBid(totalCost, targetGrossMargin);
  const premiumBidCents = safeBid(totalCost, targetGrossMargin + 8);
  const recommendation = recommendationFor(opportunity);
  const subcontractorCost = directCosts.find((item) => item.key === "subcontractor")?.amountCents ?? 0;
  const subcontractorShare = totalCost > 0 ? subcontractorCost / totalCost : 0;
  const valueBelowSafeFloor = hasEstimatedValue && valueBase < minimumSafeBidCents;
  const underbidRiskScore = hasEstimatedValue
    ? clamp(18 + opportunity.riskScore * 0.36 + (valueBelowSafeFloor ? 34 : 0) + (subcontractorLikely ? 8 : 0), 5, 100)
    : 100;
  const cashFlowRiskScore = hasEstimatedValue
    ? clamp(20 + opportunity.riskScore * 0.42 + subcontractorShare * 32 + (valueBase >= 25000000 ? 8 : 0), 5, 100)
    : 100;
  const priceReasonablenessStatus = !hasEstimatedValue
    ? "blocked"
    : opportunity.awardAmountCents || opportunity.incumbentVendor
    ? "advisory"
    : "needs_comparison";
  const farPriceReasonablenessChecks = buildFarPriceReasonablenessChecks(opportunity, {
    hasEstimatedValue,
    totalCost,
    minimumSafeBidCents,
    recommendedBidCents,
    subcontractorLikely,
  });

  return {
    directCosts,
    indirectCosts,
    riskAdders,
    targetGrossMargin,
    targetNetMargin,
    minimumAcceptableMargin,
    minimumSafeBidCents,
    aggressiveBidCents,
    recommendedBidCents,
    premiumBidCents,
    expectedGrossProfitCents: cents(recommendedBidCents - totalCost),
    expectedNetProfitCents: cents(recommendedBidCents * (targetNetMargin / 100)),
    riskAdjustedMarginPercent: targetGrossMargin,
    underpricingWarning:
      hasEstimatedValue
        ? valueBelowSafeFloor
          ? "Underbid warning: the loaded opportunity value is below the minimum safe bid. Treat the current value as a cap conflict until quantities, scope, and pricing format are verified."
          : "Do not price below the minimum safe bid. Winning below fully loaded cost turns a contract into a financed loss."
        : "Pricing is blocked because no solicitation value, quantity basis, or pricing schedule is loaded. Do not use this package as bid support until the value basis is verified.",
    lowMarginWarning:
      !hasEstimatedValue
        ? "Margin cannot be evaluated until value, quantities, scope, and required pricing format are verified."
        : targetGrossMargin <= 24
        ? "Low-margin warning: this pursuit has little room for rework, reporting burden, or subcontractor variance."
        : "Margin appears adequate for planning, but final price must still be approved by a human.",
    cashFlowWarning:
      !hasEstimatedValue
        ? "Cash-flow exposure cannot be evaluated until contract value, payment terms, and likely subcontractor costs are known."
        : cashFlowRiskScore >= 62
        ? "Cash-flow warning: confirm subcontractor payment terms, invoice timing, and working-capital reserves before approval."
        : "Cash-flow exposure appears manageable after payment terms are verified.",
    underbidRiskScore,
    cashFlowRiskScore,
    priceReasonablenessStatus,
    priceReasonablenessNotes: [
      ...(hasEstimatedValue
        ? []
        : ["Pricing is locked until an owner verifies the solicitation value, quantities, pricing sheet, or line-item basis."]),
      `FAR-aware status: ${priceReasonablenessStatus.replaceAll("_", " ")}. This is a planning control, not a government fair-and-reasonable determination.`,
      "Document fully burdened direct cost, indirect cost, risk adders, and target margin.",
      "Compare recommended bid against prior awards, incumbent pricing, and solicitation evaluation criteria when available.",
      "Use adequate price competition, historical prices, market/catalog data, parametric yardsticks, or IGCE-style evidence where available; attach source and freshness labels.",
      "Do not use AI-generated assumptions as final price support without human review.",
    ],
    farPriceReasonablenessChecks,
    bidNoBidRecommendation: recommendation,
  };
}
function workflowItem(
  title: string,
  detail: string,
  status: GovContractWorkflowItem["status"] = "needs_review",
  priority: GovContractWorkflowItem["priority"] = "medium",
  owner = "Admin owner"
): GovContractWorkflowItem {
  return { title, detail, status, priority, owner };
}

export function buildRequirements(opportunity: GovContractOpportunity): GovContractWorkflowItem[] {
  return [
    workflowItem("Official notice reviewed", "Open the SAM.gov notice and verify title, agency, response method, due date, and all attachments.", "needs_review", "critical"),
    workflowItem("Solicitation requirements extracted", "Capture deliverables, evaluation criteria, clauses, forms, page limits, and submission instructions.", "needs_review", "critical"),
    workflowItem("Questions deadline confirmed", opportunity.questionsDeadline ?? "No Q&A deadline loaded. Verify the notice manually.", opportunity.questionsDeadline ? "pending" : "missing", "high"),
    workflowItem("Submission method confirmed", opportunity.responseMethod ?? "Response method is not loaded. Verify portal, email, subject line, and file limits.", opportunity.responseMethod ? "pending" : "missing", "critical"),
    workflowItem("Eligibility reviewed", "Verify SAM registration, UEI/CAGE, set-aside eligibility, small business requirements, insurance, bonding, and certifications.", "needs_review", "critical"),
    workflowItem("FAR Part 44 subcontracting review", "Flag consent, advance notification, flow-down clauses, and subcontractor approval review where applicable.", "needs_review", "high"),
  ];
}

export function buildDocumentPlan(opportunity: GovContractOpportunity): GovContractWorkflowItem[] {
  const required = opportunity.requiredDocuments.length
    ? opportunity.requiredDocuments
    : ["Solicitation files", "Amendments", "Capability statement", "Proposal narrative", "Pricing sheet", "Compliance matrix"];

  return [
    ...required.map((title) => workflowItem(title, "Required or recommended response package item.", "missing", "high", "Bid owner")),
    workflowItem("Subcontractor quotes", "Collect quote, scope, insurance, W9, and capability docs before pricing approval.", isSubcontractorLikely(opportunity) ? "missing" : "not_applicable", "high", "Subcontractor owner"),
    workflowItem("Final response package", "Bundle final narrative, pricing, required forms, compliance matrix, and file naming checklist.", "missing", "critical", "Executive approver"),
  ];
}

export function buildComplianceMatrix(opportunity: GovContractOpportunity): GovContractComplianceMatrixItem[] {
  return [
    {
      requirement: "All solicitation attachments and amendments reviewed",
      sourceReference: "SAM.gov notice and attachments",
      status: opportunity.attachments.length ? "needs_review" : "missing",
      responseLocation: "Documents tab",
      riskLevel: "critical",
      humanReviewRequired: true,
    },
    {
      requirement: "Submission method, deadline, and time zone verified",
      sourceReference: "Submission instructions",
      status: opportunity.responseMethod && opportunity.dueDate ? "needs_review" : "missing",
      responseLocation: "Submission tab",
      riskLevel: "critical",
      humanReviewRequired: true,
    },
    {
      requirement: "Pricing approved above minimum safe bid",
      sourceReference: "Internal pricing model",
      status: "needs_review",
      responseLocation: "Pricing tab",
      riskLevel: "critical",
      humanReviewRequired: true,
    },
    {
      requirement: "Subcontracting consent/advance notification review completed where applicable",
      sourceReference: "FAR Part 44 / solicitation clauses",
      status: isSubcontractorLikely(opportunity) ? "needs_review" : "not_applicable",
      responseLocation: "Subcontractors tab",
      riskLevel: "high",
      humanReviewRequired: true,
    },
    {
      requirement: "No certification, eligibility, or past-performance claim is made without documentation",
      sourceReference: "Representations/certifications checklist",
      status: "needs_review",
      responseLocation: "Compliance review",
      riskLevel: "critical",
      humanReviewRequired: true,
    },
  ];
}

function categoryHints(opportunity: GovContractOpportunity) {
  const text = [opportunity.title, opportunity.summary].join(" ").toLowerCase();
  const categories: string[] = [];
  if (text.includes("mail") || text.includes("print") || text.includes("postcard")) categories.push("Print/mail production");
  if (text.includes("courier") || text.includes("delivery") || text.includes("logistics")) categories.push("Courier/logistics");
  if (text.includes("grounds") || text.includes("facilities") || text.includes("maintenance")) categories.push("Facilities/grounds support");
  if (text.includes("warehouse") || text.includes("kitting") || text.includes("distribution")) categories.push("Warehouse/fulfillment");
  if (!categories.length && isSubcontractorLikely(opportunity)) categories.push("Local execution partner");
  return categories;
}

export function buildSubcontractorNeeds(opportunity: GovContractOpportunity): GovContractSubcontractorNeed[] {
  const location = opportunity.location.label;
  const categories = categoryHints(opportunity);

  const marketResearch = buildGovContractMarketResearchPacket(opportunity, buildPricingModel(opportunity));

  return categories.map((category) => {
    const candidateBusinesses = marketResearch.subcontractorCandidates.filter((candidate) =>
      candidate.workCategory.toLowerCase().includes(category.toLowerCase().split("/")[0] ?? category.toLowerCase())
    );
    return {
      workCategory: category,
      requiredCapabilities: ["Relevant past performance", "Reliable staffing", "Documented pricing", "Insurance confirmation"],
      geography: location,
      insuranceRequired: true,
      licenseOrCertificationNeeds: ["Verify solicitation-specific licenses, certifications, and exclusions status"],
      timelineRequirements: opportunity.dueDate ? `Quote needed before ${opportunity.dueDate}` : "Quote deadline must be set by bid owner",
      pipelineStage: "Identified",
      outreachDraft:
        `Hello,\n\nHomeReach is reviewing a government opportunity that may require ${category.toLowerCase()} support in ${location}. We are collecting quotes and capability details before deciding whether to bid.\n\nPlease confirm availability, relevant experience, insurance status, pricing format, and any constraints by the quote deadline.\n\nNo award or subcontract commitment is made until written approval and contract terms are complete.\n\nThank you,\nHomeReach Government Contracts`,
      candidateBusinesses: candidateBusinesses.length ? candidateBusinesses : marketResearch.subcontractorCandidates.slice(0, 2),
      sourcingLinks: marketResearch.sourceLinks.filter((source) => ["entity_search", "local_search"].includes(source.type)),
    };
  });
}

export function buildSubmissionPlan(opportunity: GovContractOpportunity): GovContractSubmissionPlan {
  return {
    method: opportunity.responseMethod ?? "Verify exact submission method from solicitation.",
    portalOrEmail: String(opportunity.submissionInstructions.portal ?? opportunity.submissionInstructions.email ?? "Not loaded"),
    deadline: opportunity.dueDate,
    timezone: String(opportunity.submissionInstructions.timezone ?? "Verify solicitation time zone"),
    requiredSubjectLine: String(opportunity.submissionInstructions.subjectLine ?? "Verify if email submission is allowed"),
    attachmentLimits: String(opportunity.submissionInstructions.attachmentLimits ?? "Verify file size, naming, and format requirements"),
    checklist: [
      workflowItem("All required documents complete", "Every required file exists and is named correctly.", "missing", "critical", "Bid owner"),
      workflowItem("Pricing approved", "Final bid price is above minimum safe bid and approved by a human.", "missing", "critical", "Executive approver"),
      workflowItem("Subcontractor pricing confirmed", "Selected subcontractor quote and compliance docs are attached.", isSubcontractorLikely(opportunity) ? "missing" : "not_applicable", "critical", "Subcontractor owner"),
      workflowItem("Compliance matrix complete", "Every requirement is addressed, marked N/A, or flagged for review.", "missing", "critical", "Compliance reviewer"),
      workflowItem("Final human approval recorded", "Authorized person approves ready-to-submit status.", "missing", "critical", "Executive approver"),
    ],
    humanApprovalGate: [
      "The platform does not submit bids autonomously.",
      "Marking ready/submitted requires completed documents, pricing approval, compliance review, and human approval.",
      "Legal, certification, and eligibility claims must be reviewed outside the AI workflow.",
    ],
  };
}

export function buildPostAwardPlan(opportunity: GovContractOpportunity): GovContractPostAwardPlan {
  return {
    awardStatus: opportunity.pipelineStatus === "awarded" ? "Awarded - kickoff required" : "Not awarded",
    kickoffChecklist: [
      workflowItem("Award notice captured", "Attach award notice, contract number, scope, and period of performance.", "pending", "critical", "Award owner"),
      workflowItem("Notice to proceed confirmed", "Record start date and first deliverable.", "pending", "critical", "Award owner"),
      workflowItem("Subcontractor onboarding", "Confirm agreement, insurance, payment terms, scope, and kickoff date.", "pending", "high", "Subcontractor owner"),
    ],
    milestones: [
      workflowItem("Delivery schedule", "Create performance milestones based on contract deliverables.", "pending", "high", "Project manager"),
      workflowItem("Reporting calendar", "Track required reports and government communication cadence.", "pending", "high", "Project manager"),
    ],
    invoiceTracker: [
      workflowItem("Invoice schedule", "Define invoice timing, required documentation, and payment status.", "pending", "high", "Finance"),
      workflowItem("Cost-to-complete review", "Update actual cost, forecast margin, and payment risk.", "pending", "high", "Finance"),
    ],
    riskLog: [
      workflowItem("Performance issues", "Track scope changes, delays, subcontractor issues, and government communications.", "pending", "medium", "Project manager"),
    ],
    closeoutChecklist: [
      workflowItem("Final deliverables accepted", "Confirm government acceptance and closeout requirements.", "pending", "high", "Project manager"),
      workflowItem("Final invoice and margin review", "Record actual profit, lessons learned, and renewal opportunities.", "pending", "medium", "Finance"),
    ],
  };
}

export function buildAIBidAssistant(
  opportunity: GovContractOpportunity,
  decision: GovContractBidDecision
): GovContractAIBidAssistant {
  return {
    recommendation: decision.recommendation,
    reasoning: decision.why,
    risks: decision.risks,
    missingItems: decision.missingRequirements,
    nextAction: decision.recommendedNextStep,
    allowedActions: [
      "Summarize solicitation",
      "Draft response sections",
      "Build compliance checklist",
      "Recommend pricing logic",
      "Draft subcontractor outreach",
      "Flag missing documents",
    ],
    blockedActions: [
      "Submit bids autonomously",
      "Make legal or certification claims",
      "Fabricate past performance",
      "Approve final pricing",
      "Commit subcontractors",
      "Mark compliance complete without documentation",
    ],
  };
}

export function buildGeneratedBidWorkspace(
  opportunity: GovContractOpportunity,
  options: { id?: string; persisted?: boolean; bidStage?: GovContractPipelineStatus } = {}
): GovContractBidWorkspace {
  const bidDecision = buildBidNoBidDecision(opportunity);
  const pricing = buildPricingModel(opportunity);
  const marketResearch = buildGovContractMarketResearchPacket(opportunity, pricing);
  const requirements = buildRequirements(opportunity);
  const documents = buildDocumentPlan(opportunity);
  const complianceMatrix = buildComplianceMatrix(opportunity);
  const subcontractorNeeds = buildSubcontractorNeeds(opportunity);
  const operatingModel = buildGovContractOperatingModel(
    opportunity,
    pricing,
    subcontractorNeeds,
    bidDecision.recommendation
  );
  const submissionPlan = buildSubmissionPlan(opportunity);
  const postAwardPlan = buildPostAwardPlan(opportunity);
  const readiness = clamp(
    opportunity.fitScore * 0.36 +
      (100 - opportunity.riskScore) * 0.18 +
      requirements.filter((item) => item.status !== "missing").length * 5 +
      documents.filter((item) => item.status !== "missing").length * 2,
    8,
    82
  );

  return {
    id: options.id ?? `generated-${opportunity.id}`,
    opportunityId: opportunity.id,
    persisted: options.persisted ?? false,
    bidStage: options.bidStage ?? opportunity.pipelineStatus,
    ownerLabel: "Unassigned",
    submissionReadinessScore: readiness,
    winProbability: clamp(opportunity.fitScore - opportunity.riskScore * 0.35, 8, 78),
    profitTargetPercent: pricing.targetGrossMargin,
    approvalStatus: "not_requested",
    bidDecision,
    requirements,
    documents,
    pricing,
    subcontractorNeeds,
    complianceMatrix,
    submissionPlan,
    postAwardPlan,
    operatingModel,
    marketResearch,
    aiAssistant: buildAIBidAssistant(opportunity, bidDecision),
    exportPackage: {
      packageName: `${opportunity.solicitationNumber ?? opportunity.id} response package`,
      files: [
        "Executive summary",
        "Technical approach",
        "Management approach",
        "Pricing attachment",
        "Compliance matrix",
        "Required forms",
        "Subcontractor docs if applicable",
      ],
      fileNamingChecklist: [
        "Use solicitation number in every final filename",
        "Keep pricing attachment separate if solicitation requires it",
        "Include version/date on internal drafts",
        "Do not upload unreviewed AI drafts",
      ],
      notes: [
        "Export package is a preparation aid only.",
        "Final submission method must be verified from the official solicitation.",
      ],
    },
    auditTrail: [
      workflowItem("Opportunity discovered", "Opportunity loaded from SAM.gov, sample data, or manual source.", "complete", "low", "System"),
      workflowItem("Human approval required", "Pricing, compliance claims, subcontractor commitments, and final submission are locked.", "pending", "critical", "Authorized admin"),
    ],
  };
}

function rowArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function rowObject(value: unknown): AnyRow {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRow) : {};
}

function hasRowValues(value: unknown) {
  return Object.keys(rowObject(value)).length > 0;
}

function rowString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function rowStatus(value: unknown, fallback: GovContractWorkflowItem["status"]) {
  return rowString(value, fallback) as GovContractWorkflowItem["status"];
}

function rowPriority(value: unknown, fallback: GovContractWorkflowItem["priority"]) {
  return rowString(value, fallback) as GovContractWorkflowItem["priority"];
}

function pricingReasonablenessStatus(
  value: unknown,
  fallback: GovContractPricingModel["priceReasonablenessStatus"]
): GovContractPricingModel["priceReasonablenessStatus"] {
  const status = rowString(value, fallback);
  if (["blocked", "advisory", "needs_comparison", "ready_for_human_review"].includes(status)) {
    return status as GovContractPricingModel["priceReasonablenessStatus"];
  }
  return fallback;
}

function complianceStatus(value: unknown): GovContractComplianceMatrixItem["status"] {
  const status = rowString(value, "needs_review");
  if (["missing", "needs_review", "not_applicable", "completed"].includes(status)) {
    return status as GovContractComplianceMatrixItem["status"];
  }
  return "needs_review";
}

function complianceRisk(value: unknown): GovContractComplianceMatrixItem["riskLevel"] {
  const risk = rowString(value, "medium");
  if (["low", "medium", "high", "critical"].includes(risk)) {
    return risk as GovContractComplianceMatrixItem["riskLevel"];
  }
  return "medium";
}

function workspaceFromBidRoom(
  opportunity: GovContractOpportunity,
  row: AnyRow | null | undefined,
  related: {
    requirements?: AnyRow[];
    documents?: AnyRow[];
    pricing?: AnyRow | null;
    compliance?: AnyRow[];
    quotes?: AnyRow[];
    submissionPackage?: AnyRow | null;
    awards?: AnyRow[];
    milestones?: AnyRow[];
    communications?: AnyRow[];
  } = {}
): GovContractBidWorkspace {
  const generated = buildGeneratedBidWorkspace(opportunity, {
    id: row?.id ? String(row.id) : undefined,
    persisted: Boolean(row?.id),
    bidStage: (row?.bid_stage ?? opportunity.pipelineStatus) as GovContractPipelineStatus,
  });
  const pricingRow = related.pricing;
  const directCostsRow = rowObject(pricingRow?.direct_costs);
  const indirectCostsRow = rowObject(pricingRow?.indirect_costs);
  const riskAddersRow = rowObject(pricingRow?.risk_adders);
  const pricingMetadata = rowObject(pricingRow?.metadata);
  const submissionPlanRow = row?.submission_plan;
  const postAwardPlanRow = row?.post_award_plan;
  const aiAssistantRow = row?.ai_bid_assistant;
  const operatingModelRow = rowObject(row?.operating_model);
  const operatingModel: GovContractOperatingModel = {
    ...generated.operatingModel,
    lifecycle: rowArray(row?.lifecycle_plan, generated.operatingModel.lifecycle),
    agencyProfile: hasRowValues(row?.agency_intelligence)
      ? (row?.agency_intelligence as GovContractOperatingModel["agencyProfile"])
      : generated.operatingModel.agencyProfile,
    awardIntel: hasRowValues(row?.award_intelligence)
      ? (row?.award_intelligence as GovContractOperatingModel["awardIntel"])
      : generated.operatingModel.awardIntel,
    financialRisk: hasRowValues(row?.financial_risk_model)
      ? (row?.financial_risk_model as GovContractOperatingModel["financialRisk"])
      : generated.operatingModel.financialRisk,
    proposalSections: hasRowValues(row?.proposal_workspace)
      ? rowArray(rowObject(row?.proposal_workspace).sections, generated.operatingModel.proposalSections)
      : generated.operatingModel.proposalSections,
    pastPerformanceMatches: rowArray(row?.past_performance_plan, generated.operatingModel.pastPerformanceMatches),
    teamingPlan: hasRowValues(row?.teaming_plan)
      ? (row?.teaming_plan as GovContractOperatingModel["teamingPlan"])
      : generated.operatingModel.teamingPlan,
    recompeteSignals: rowArray(row?.recompete_plan, generated.operatingModel.recompeteSignals),
    governmentContacts: rowArray(row?.government_crm_plan, generated.operatingModel.governmentContacts),
  };
  const marketResearch = hasRowValues(operatingModelRow.marketResearch)
    ? (operatingModelRow.marketResearch as GovContractMarketResearchPacket)
    : generated.marketResearch;

  const requirements = related.requirements?.length
    ? related.requirements.map((item) =>
        workflowItem(
          rowString(item.title, "Solicitation requirement"),
          rowString(item.detail),
          rowStatus(item.status, "needs_review"),
          rowPriority(item.priority, "medium"),
          "Bid owner"
        )
      )
    : rowArray(row?.requirement_snapshot, generated.requirements);

  const documents = related.documents?.length
    ? related.documents.map((item) =>
        workflowItem(
          rowString(item.title, "Bid document"),
          rowString(item.document_type, "Document"),
          rowStatus(item.status, "missing"),
          item.required ? "high" : "medium",
          "Document owner"
        )
      )
    : rowArray(row?.document_plan, generated.documents);

  const pricing = pricingRow
    ? {
        ...generated.pricing,
        directCosts: rowArray(directCostsRow.items, generated.pricing.directCosts),
        indirectCosts: rowArray(indirectCostsRow.items, generated.pricing.indirectCosts),
        riskAdders: rowArray(riskAddersRow.items, generated.pricing.riskAdders),
        minimumSafeBidCents: Number(pricingRow.minimum_safe_bid_cents ?? generated.pricing.minimumSafeBidCents),
        aggressiveBidCents: Number(pricingRow.aggressive_bid_cents ?? generated.pricing.aggressiveBidCents),
        recommendedBidCents: Number(pricingRow.recommended_bid_cents ?? generated.pricing.recommendedBidCents),
        premiumBidCents: Number(pricingRow.premium_bid_cents ?? generated.pricing.premiumBidCents),
        expectedGrossProfitCents: Number(pricingRow.expected_gross_profit_cents ?? generated.pricing.expectedGrossProfitCents),
        expectedNetProfitCents: Number(pricingRow.expected_net_profit_cents ?? generated.pricing.expectedNetProfitCents),
        riskAdjustedMarginPercent: Number(pricingRow.risk_adjusted_margin_percent ?? generated.pricing.riskAdjustedMarginPercent),
        underpricingWarning: rowString(pricingRow.underpricing_warning, generated.pricing.underpricingWarning),
        lowMarginWarning: rowString(pricingMetadata.lowMarginWarning, generated.pricing.lowMarginWarning),
        cashFlowWarning: rowString(pricingMetadata.cashFlowWarning, generated.pricing.cashFlowWarning),
        underbidRiskScore: Number(pricingMetadata.underbidRiskScore ?? generated.pricing.underbidRiskScore),
        cashFlowRiskScore: Number(pricingMetadata.cashFlowRiskScore ?? generated.pricing.cashFlowRiskScore),
        priceReasonablenessStatus: pricingReasonablenessStatus(
          pricingMetadata.priceReasonablenessStatus,
          generated.pricing.priceReasonablenessStatus
        ),
        priceReasonablenessNotes: rowArray(pricingMetadata.priceReasonablenessNotes, generated.pricing.priceReasonablenessNotes),
        farPriceReasonablenessChecks: rowArray(pricingMetadata.farPriceReasonablenessChecks, generated.pricing.farPriceReasonablenessChecks),
        bidNoBidRecommendation: rowString(
          pricingRow.recommendation,
          generated.pricing.bidNoBidRecommendation
        ) as GovContractBidRecommendation,
      }
    : generated.pricing;

  return {
    ...generated,
    id: row?.id ? String(row.id) : generated.id,
    persisted: Boolean(row?.id),
    bidStage: (row?.bid_stage ?? generated.bidStage) as GovContractPipelineStatus,
    ownerLabel: row?.owner_id ? "Assigned admin" : generated.ownerLabel,
    submissionReadinessScore: Number(row?.submission_readiness_score ?? generated.submissionReadinessScore),
    winProbability: Number(row?.win_probability ?? generated.winProbability),
    profitTargetPercent: Number(row?.profit_target_percent ?? generated.profitTargetPercent),
    approvalStatus: rowString(row?.approval_status, generated.approvalStatus),
    bidDecision: (hasRowValues(row?.bid_decision) ? row?.bid_decision : generated.bidDecision) as GovContractBidDecision,
    requirements,
    documents,
    pricing,
    subcontractorNeeds:
      related.quotes?.length
        ? related.quotes.map((quote) => {
            const quoteMetadata = rowObject(quote.metadata);
            return {
              workCategory: rowString(quote.work_category, "Subcontractor support"),
              requiredCapabilities: ["Quote requested", "Compliance review", "Insurance verification"],
              geography: rowString(quoteMetadata.geography, opportunity.location.label),
              insuranceRequired: Boolean(quote.insurance_required),
              licenseOrCertificationNeeds: rowArray(quoteMetadata.licenseOrCertificationNeeds, ["Verify solicitation-specific requirements"]),
              timelineRequirements: quote.quote_due_at ? `Quote due ${quote.quote_due_at}` : "Quote deadline not set",
              pipelineStage: rowString(quote.status, "identified"),
              outreachDraft: rowString(quote.scope_summary, generated.subcontractorNeeds[0]?.outreachDraft ?? ""),
              candidateBusinesses: rowArray(quoteMetadata.candidateBusinesses, generated.subcontractorNeeds[0]?.candidateBusinesses ?? []),
              sourcingLinks: rowArray(quoteMetadata.sourcingLinks, generated.subcontractorNeeds[0]?.sourcingLinks ?? []),
            };
          })
        : generated.subcontractorNeeds,
    complianceMatrix:
      related.compliance?.length
        ? related.compliance.map((item) => ({
            requirement: rowString(item.requirement, "Compliance requirement"),
            sourceReference: rowString(item.source_reference, "Compliance matrix"),
            status: complianceStatus(item.status),
            responseLocation: rowString(item.response_location, "Not mapped"),
            riskLevel: complianceRisk(item.risk_level),
            humanReviewRequired: Boolean(item.human_review_required ?? true),
          }))
        : generated.complianceMatrix,
    submissionPlan: hasRowValues(submissionPlanRow)
      ? (submissionPlanRow as GovContractSubmissionPlan)
      : generated.submissionPlan,
    postAwardPlan: hasRowValues(postAwardPlanRow)
      ? (postAwardPlanRow as GovContractPostAwardPlan)
      : generated.postAwardPlan,
    aiAssistant: hasRowValues(aiAssistantRow)
      ? (aiAssistantRow as GovContractAIBidAssistant)
      : generated.aiAssistant,
    operatingModel,
    marketResearch,
  };
}

export async function loadGovContractBidWorkspace(opportunityId: string): Promise<{
  opportunity: GovContractOpportunity | null;
  workspace: GovContractBidWorkspace | null;
}> {
  const opportunity = await loadGovContractOpportunity(opportunityId);
  if (!opportunity) return { opportunity: null, workspace: null };
  if (!hasSupabaseServiceEnv() || opportunity.isSample) {
    return { opportunity, workspace: buildGeneratedBidWorkspace(opportunity) };
  }

  try {
    const supabase = createServiceClient();
    const { data: room } = await supabase
      .from("gov_contract_bid_rooms")
      .select("*")
      .eq("opportunity_id", opportunity.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!room) return { opportunity, workspace: buildGeneratedBidWorkspace(opportunity) };

    const [requirements, documents, pricing, compliance, quotes, submissionPackage, awards, milestones, communications] =
      await Promise.all([
        supabase.from("gov_contract_bid_requirements").select("*").eq("bid_room_id", room.id).order("created_at"),
        supabase.from("gov_contract_bid_documents").select("*").eq("bid_room_id", room.id).order("created_at"),
        supabase.from("gov_contract_bid_pricing_models").select("*").eq("bid_room_id", room.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("gov_contract_compliance_matrix_items").select("*").eq("bid_room_id", room.id).order("created_at"),
        supabase.from("gov_contract_subcontractor_quotes").select("*").eq("bid_room_id", room.id).order("created_at"),
        supabase.from("gov_contract_submission_packages").select("*").eq("bid_room_id", room.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("gov_contract_awards").select("*").eq("bid_room_id", room.id).order("created_at", { ascending: false }),
        supabase.from("gov_contract_fulfillment_milestones").select("*").eq("bid_room_id", room.id).order("due_at", { ascending: true }),
        supabase.from("gov_contract_communications").select("*").eq("bid_room_id", room.id).order("created_at", { ascending: false }).limit(25),
      ]);

    return {
      opportunity,
      workspace: workspaceFromBidRoom(opportunity, room, {
        requirements: requirements.data ?? [],
        documents: documents.data ?? [],
        pricing: pricing.data ?? null,
        compliance: compliance.data ?? [],
        quotes: quotes.data ?? [],
        submissionPackage: submissionPackage.data ?? null,
        awards: awards.data ?? [],
        milestones: milestones.data ?? [],
        communications: communications.data ?? [],
      }),
    };
  } catch {
    return { opportunity, workspace: buildGeneratedBidWorkspace(opportunity) };
  }
}

export async function startGovContractBidWorkspace(input: {
  opportunityId: string;
  actorId?: string | null;
  bidStage?: GovContractPipelineStatus;
  opportunityStatus?: GovContractPipelineStatus;
}): Promise<{ ok: boolean; persisted: boolean; opportunity: GovContractOpportunity | null; workspace: GovContractBidWorkspace | null; error?: string }> {
  const opportunity = await loadGovContractOpportunity(input.opportunityId);
  if (!opportunity) {
    return { ok: false, persisted: false, opportunity: null, workspace: null, error: "Opportunity not found." };
  }

  const bidStage = input.bidStage ?? "bid_prep";
  const opportunityStatus = input.opportunityStatus ?? bidStage;
  const generated = buildGeneratedBidWorkspace(opportunity, { bidStage });
  if (!hasSupabaseServiceEnv() || opportunity.isSample) {
    return { ok: true, persisted: false, opportunity, workspace: generated };
  }

  try {
    const supabase = createServiceClient();
    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from("gov_contract_bid_rooms")
      .select("id,approval_status")
      .eq("opportunity_id", opportunity.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const roomPayload = {
      opportunity_id: opportunity.id,
      owner_id: input.actorId ?? null,
      bid_stage: bidStage,
      go_no_go_status: "started",
      submission_readiness_score: generated.submissionReadinessScore,
      estimated_value_cents: opportunity.estimatedValueCents,
      win_probability: generated.winProbability,
      profit_target_percent: generated.profitTargetPercent,
      bid_decision: generated.bidDecision,
      requirement_snapshot: generated.requirements,
      required_forms: generated.documents,
      document_plan: generated.documents,
      pricing_worksheet: generated.pricing,
      proposal_draft: {
        executiveSummary: "Draft only. Must be reviewed before external use.",
        technicalApproach: "Use AI Bid Assistant to prepare a solicitation-specific draft after attachments are reviewed.",
      },
      risk_assessment: {
        riskScore: opportunity.riskScore,
        underbidRiskScore: generated.pricing.underbidRiskScore,
        cashFlowRiskScore: generated.pricing.cashFlowRiskScore,
        marketResearchStatus: generated.marketResearch.researchStatus,
        sourceGaps: generated.marketResearch.sourceGaps,
        safeguards: generated.aiAssistant.blockedActions,
      },
      subcontractor_plan: {
        needs: generated.subcontractorNeeds,
        candidateBusinesses: generated.marketResearch.subcontractorCandidates,
        sourcingLinks: generated.marketResearch.sourceLinks.filter((source) => ["entity_search", "local_search"].includes(source.type)),
        safeguards: ["No subcontractor commitment without written human approval."],
      },
      submission_plan: generated.submissionPlan,
      post_award_plan: generated.postAwardPlan,
      ai_bid_assistant: generated.aiAssistant,
      lifecycle_plan: generated.operatingModel.lifecycle,
      agency_intelligence: generated.operatingModel.agencyProfile,
      award_intelligence: generated.operatingModel.awardIntel,
      proposal_workspace: { sections: generated.operatingModel.proposalSections },
      financial_risk_model: generated.operatingModel.financialRisk,
      past_performance_plan: generated.operatingModel.pastPerformanceMatches,
      teaming_plan: generated.operatingModel.teamingPlan,
      recompete_plan: generated.operatingModel.recompeteSignals,
      government_crm_plan: generated.operatingModel.governmentContacts,
      operating_model: { ...generated.operatingModel, marketResearch: generated.marketResearch },
      export_package: generated.exportPackage,
      approval_status: rowString(existing?.approval_status, "not_requested"),
      updated_at: now,
    };

    const roomResult = existing?.id
      ? await supabase.from("gov_contract_bid_rooms").update(roomPayload).eq("id", existing.id).select("*").maybeSingle()
      : await supabase.from("gov_contract_bid_rooms").insert({ ...roomPayload, created_at: now }).select("*").maybeSingle();

    if (roomResult.error || !roomResult.data) {
      throw roomResult.error ?? new Error("Bid workspace could not be saved.");
    }

    const bidRoomId = roomResult.data.id;

    const [
      requirementCount,
      documentCount,
      pricingCount,
      complianceCount,
      submissionCount,
      financialRiskCount,
      proposalSectionCount,
      contactCount,
      teamingCount,
    ] = await Promise.all([
      supabase.from("gov_contract_bid_requirements").select("id", { count: "exact", head: true }).eq("bid_room_id", bidRoomId),
      supabase.from("gov_contract_bid_documents").select("id", { count: "exact", head: true }).eq("bid_room_id", bidRoomId),
      supabase.from("gov_contract_bid_pricing_models").select("id", { count: "exact", head: true }).eq("bid_room_id", bidRoomId),
      supabase.from("gov_contract_compliance_matrix_items").select("id", { count: "exact", head: true }).eq("bid_room_id", bidRoomId),
      supabase.from("gov_contract_submission_packages").select("id", { count: "exact", head: true }).eq("bid_room_id", bidRoomId),
      supabase.from("gov_contract_financial_risk_models").select("id", { count: "exact", head: true }).eq("bid_room_id", bidRoomId),
      supabase.from("gov_contract_proposal_sections").select("id", { count: "exact", head: true }).eq("bid_room_id", bidRoomId),
      supabase.from("gov_contract_contacts").select("id", { count: "exact", head: true }).eq("bid_room_id", bidRoomId),
      supabase.from("gov_contract_teaming_relationships").select("id", { count: "exact", head: true }).eq("bid_room_id", bidRoomId),
    ]);

    if (!requirementCount.count) {
      await supabase.from("gov_contract_bid_requirements").insert(
        generated.requirements.map((item) => ({
          bid_room_id: bidRoomId,
          opportunity_id: opportunity.id,
          requirement_type: "workflow",
          title: item.title,
          detail: item.detail,
          priority: item.priority,
          status: item.status,
          metadata: { owner: item.owner },
        }))
      );
    }

    if (!documentCount.count) {
      await supabase.from("gov_contract_bid_documents").insert(
        generated.documents.map((item) => ({
          bid_room_id: bidRoomId,
          opportunity_id: opportunity.id,
          document_type: item.title,
          title: item.title,
          status: item.status,
          required: item.status !== "not_applicable",
          source: "generated_bid_plan",
          metadata: { detail: item.detail, owner: item.owner },
        }))
      );
    }

    if (!pricingCount.count) {
      await supabase.from("gov_contract_bid_pricing_models").insert({
        bid_room_id: bidRoomId,
        opportunity_id: opportunity.id,
        status: "draft",
        direct_costs: { items: generated.pricing.directCosts },
        indirect_costs: { items: generated.pricing.indirectCosts },
        risk_adders: { items: generated.pricing.riskAdders },
        margin_targets: {
          targetGrossMargin: generated.pricing.targetGrossMargin,
          targetNetMargin: generated.pricing.targetNetMargin,
          minimumAcceptableMargin: generated.pricing.minimumAcceptableMargin,
        },
        minimum_safe_bid_cents: generated.pricing.minimumSafeBidCents,
        aggressive_bid_cents: generated.pricing.aggressiveBidCents,
        recommended_bid_cents: generated.pricing.recommendedBidCents,
        premium_bid_cents: generated.pricing.premiumBidCents,
        expected_gross_profit_cents: generated.pricing.expectedGrossProfitCents,
        expected_net_profit_cents: generated.pricing.expectedNetProfitCents,
        risk_adjusted_margin_percent: generated.pricing.riskAdjustedMarginPercent,
        underpricing_warning: generated.pricing.underpricingWarning,
        recommendation: generated.pricing.bidNoBidRecommendation,
        metadata: {
          lowMarginWarning: generated.pricing.lowMarginWarning,
          cashFlowWarning: generated.pricing.cashFlowWarning,
          underbidRiskScore: generated.pricing.underbidRiskScore,
          cashFlowRiskScore: generated.pricing.cashFlowRiskScore,
          priceReasonablenessStatus: generated.pricing.priceReasonablenessStatus,
          priceReasonablenessNotes: generated.pricing.priceReasonablenessNotes,
          farPriceReasonablenessChecks: generated.pricing.farPriceReasonablenessChecks,
          marketResearchFreshness: generated.marketResearch.freshnessLabel,
          marketResearchStatus: generated.marketResearch.researchStatus,
        },
      });
    }

    if (!complianceCount.count) {
      await supabase.from("gov_contract_compliance_matrix_items").insert(
        generated.complianceMatrix.map((item) => ({
          bid_room_id: bidRoomId,
          opportunity_id: opportunity.id,
          requirement: item.requirement,
          source_reference: item.sourceReference,
          response_location: item.responseLocation,
          status: item.status,
          risk_level: item.riskLevel,
          human_review_required: item.humanReviewRequired,
        }))
      );
    }

    if (!submissionCount.count) {
      await supabase.from("gov_contract_submission_packages").insert({
        bid_room_id: bidRoomId,
        opportunity_id: opportunity.id,
        status: "draft",
        package_name: generated.exportPackage.packageName,
        submission_method: generated.submissionPlan.method,
        deadline_at: opportunity.dueDate,
        approval_status: "not_requested",
        checklist: generated.submissionPlan.checklist,
        files: generated.exportPackage.files,
        export_metadata: {
          fileNamingChecklist: generated.exportPackage.fileNamingChecklist,
          notes: generated.exportPackage.notes,
        },
      });
    }

    if (!financialRiskCount.count) {
      await supabase.from("gov_contract_financial_risk_models").insert({
        bid_room_id: bidRoomId,
        opportunity_id: opportunity.id,
        status: "draft",
        upfront_cash_need_cents: generated.operatingModel.financialRisk.upfrontCashNeedCents,
        payroll_burden_cents: generated.operatingModel.financialRisk.payrollBurdenCents,
        subcontractor_float_cents: generated.operatingModel.financialRisk.subcontractorFloatCents,
        estimated_payment_gap_days: generated.operatingModel.financialRisk.estimatedPaymentGapDays,
        burn_rate_cents: generated.operatingModel.financialRisk.burnRateCents,
        working_capital_stress_score: generated.operatingModel.financialRisk.workingCapitalStressScore,
        warnings: generated.operatingModel.financialRisk.warnings,
        assumptions: { items: generated.operatingModel.financialRisk.assumptions },
        human_approval_required: true,
      });
    }

    if (!proposalSectionCount.count) {
      await supabase.from("gov_contract_proposal_sections").insert(
        generated.operatingModel.proposalSections.map((section) => ({
          bid_room_id: bidRoomId,
          opportunity_id: opportunity.id,
          section_key: section.key,
          title: section.title,
          status: section.status,
          owner: section.owner,
          draft_content: null,
          source_references: [section.purpose],
          ai_notes: [section.aiDraftInstruction],
          human_approval_required: section.humanReviewRequired,
        }))
      );
    }

    if (!contactCount.count) {
      await supabase.from("gov_contract_contacts").insert(
        generated.operatingModel.governmentContacts.map((contact) => ({
          bid_room_id: bidRoomId,
          opportunity_id: opportunity.id,
          contact_type: contact.contactType,
          title: contact.label,
          agency: opportunity.agency,
          organization: opportunity.agency,
          relationship_stage: contact.relationshipStage,
          next_action: contact.nextAction,
          notes: contact.approvalRequired ? "Human approval required before external communication." : null,
          metadata: { approvalRequired: contact.approvalRequired },
        }))
      );
    }

    if (!teamingCount.count && generated.operatingModel.teamingPlan.requiredPartners.length) {
      await supabase.from("gov_contract_teaming_relationships").insert(
        generated.operatingModel.teamingPlan.requiredPartners.map((partner) => ({
          bid_room_id: bidRoomId,
          opportunity_id: opportunity.id,
          relationship_type: "subcontractor",
          role_summary: partner.workCategory,
          stage: "identified",
          agreement_status: "not_started",
          compliance_status: "needs_review",
          human_approval_required: true,
          metadata: {
            geography: partner.geography,
            requiredCapabilities: partner.requiredCapabilities,
            warnings: generated.operatingModel.teamingPlan.agreementWarnings,
          },
        }))
      );
    }

    await supabase.from("gov_contract_agency_profiles").upsert(
      {
        agency_key: opportunity.agency.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || opportunity.id,
        agency_name: opportunity.agency,
        office: opportunity.office,
        spending_trends: { summary: generated.operatingModel.agencyProfile.spendingTrend },
        common_naics: generated.operatingModel.agencyProfile.commonNaics,
        incumbent_patterns: [generated.operatingModel.agencyProfile.incumbentPattern],
        small_business_tendencies: generated.operatingModel.agencyProfile.smallBusinessTendency,
        evaluation_patterns: generated.operatingModel.agencyProfile.aiGuidance,
        procurement_speed: generated.operatingModel.agencyProfile.procurementSpeed,
        contract_size_range: generated.operatingModel.agencyProfile.contractSizeRange,
        ai_guidance: generated.operatingModel.agencyProfile.aiGuidance,
        source: "generated_bid_workspace",
        last_reviewed_at: now,
        updated_at: now,
      },
      { onConflict: "agency_key" }
    );

    if (generated.subcontractorNeeds.length) {
      const { count } = await supabase
        .from("gov_contract_subcontractor_quotes")
        .select("id", { count: "exact", head: true })
        .eq("bid_room_id", bidRoomId);
      if (!count) {
        await supabase.from("gov_contract_subcontractor_quotes").insert(
          generated.subcontractorNeeds.map((need) => ({
            bid_room_id: bidRoomId,
            opportunity_id: opportunity.id,
            work_category: need.workCategory,
            status: "identified",
            scope_summary: need.outreachDraft,
            requested_pricing_format: "Line-item quote with assumptions, exclusions, insurance status, and availability.",
            insurance_required: need.insuranceRequired,
            compliance_status: "needs_review",
            metadata: {
              geography: need.geography,
              requiredCapabilities: need.requiredCapabilities,
              licenseOrCertificationNeeds: need.licenseOrCertificationNeeds,
              candidateBusinesses: need.candidateBusinesses ?? [],
              sourcingLinks: need.sourcingLinks ?? [],
              sourceFreshness: generated.marketResearch.freshnessLabel,
              approvalGate: "No subcontractor selection, quote acceptance, or spend commitment without human approval.",
            },
          }))
        );
      }
    }

    await supabase
      .from("gov_contract_opportunities")
      .update({
        pipeline_status: opportunityStatus,
        owner_id: input.actorId ?? null,
        started_bid_at: now,
        evaluated_at: now,
        updated_at: now,
      })
      .eq("id", opportunity.id);

    await logGovContractAuditEvent({
      opportunityId: opportunity.id,
      actorId: input.actorId ?? null,
      eventType: "bid_workspace_started",
      summary: `Bid workspace started at ${bidStage.replaceAll("_", " ")} with pricing, compliance, subcontractor, submission, and post-award planning.`,
      metadata: {
        bidRoomId,
        bidStage,
        opportunityStatus,
        recommendation: generated.bidDecision.recommendation,
        minimumSafeBidCents: generated.pricing.minimumSafeBidCents,
        recommendedBidCents: generated.pricing.recommendedBidCents,
        workingCapitalStressScore: generated.operatingModel.financialRisk.workingCapitalStressScore,
      },
    });

    await logPlatformAuditEvent({
      actorType: input.actorId ? "human" : "system",
      actorId: input.actorId ?? null,
      module: "government_contracts",
      actionType: "bid_workspace_started",
      entityType: "gov_contract_bid_room",
      entityId: bidRoomId,
      sourceTable: "gov_contract_bid_rooms",
      sourceId: bidRoomId,
      resultStatus: "success",
      approvalState: "needs_review",
      severity: "info",
      message: "Government contract bid workspace started.",
      metadata: { opportunityId: opportunity.id, bidStage, opportunityStatus, recommendation: generated.bidDecision.recommendation },
    });

    const bidRoomLedgerResult = await syncGovContractBidRoomLedger({
      id: String(roomResult.data.id),
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      agency: opportunity.agency,
      bidStage: rowString(roomResult.data.bid_stage, bidStage),
      approvalStatus: rowString(roomResult.data.approval_status, "not_requested"),
      submissionReadinessScore: Number(roomResult.data.submission_readiness_score ?? generated.submissionReadinessScore),
      estimatedValueCents: Number(roomResult.data.estimated_value_cents ?? opportunity.estimatedValueCents ?? 0),
      finalApprovalBy: typeof roomResult.data.final_approval_by === "string" ? roomResult.data.final_approval_by : null,
      finalApprovalAt: typeof roomResult.data.final_approval_at === "string" ? roomResult.data.final_approval_at : null,
      submittedAt: typeof roomResult.data.submitted_at === "string" ? roomResult.data.submitted_at : null,
      awardStatus: typeof roomResult.data.award_status === "string" ? roomResult.data.award_status : null,
      createdAt: typeof roomResult.data.created_at === "string" ? roomResult.data.created_at : now,
      updatedAt: typeof roomResult.data.updated_at === "string" ? roomResult.data.updated_at : now,
    }, {
      actorId: input.actorId ?? null,
      actorLabel: "gov_contract_workspace_start",
      eventType: "gov_contract_bid_workspace_started",
    });
    if (!bidRoomLedgerResult.ok) {
      console.warn("[approval-ledger] gov contract bid room sync skipped:", bidRoomLedgerResult.error);
    }

    const { data: submissionPackageRow } = await supabase
      .from("gov_contract_submission_packages")
      .select("id,package_name,status,approval_status,submission_method,deadline_at,approved_by,approved_at,submitted_by,submitted_at,created_at,updated_at")
      .eq("bid_room_id", bidRoomId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (submissionPackageRow) {
      const submissionLedgerResult = await syncGovContractSubmissionPackageLedger({
        id: String(submissionPackageRow.id),
        bidRoomId,
        opportunityId: opportunity.id,
        opportunityTitle: opportunity.title,
        agency: opportunity.agency,
        packageName: rowString(submissionPackageRow.package_name, generated.exportPackage.packageName),
        status: rowString(submissionPackageRow.status, "draft"),
        approvalStatus: rowString(submissionPackageRow.approval_status, "not_requested"),
        submissionMethod: typeof submissionPackageRow.submission_method === "string" ? submissionPackageRow.submission_method : null,
        deadlineAt: typeof submissionPackageRow.deadline_at === "string" ? submissionPackageRow.deadline_at : opportunity.dueDate ?? null,
        approvedBy: typeof submissionPackageRow.approved_by === "string" ? submissionPackageRow.approved_by : null,
        approvedAt: typeof submissionPackageRow.approved_at === "string" ? submissionPackageRow.approved_at : null,
        submittedBy: typeof submissionPackageRow.submitted_by === "string" ? submissionPackageRow.submitted_by : null,
        submittedAt: typeof submissionPackageRow.submitted_at === "string" ? submissionPackageRow.submitted_at : null,
        createdAt: typeof submissionPackageRow.created_at === "string" ? submissionPackageRow.created_at : now,
        updatedAt: typeof submissionPackageRow.updated_at === "string" ? submissionPackageRow.updated_at : now,
      }, {
        actorId: input.actorId ?? null,
        actorLabel: "gov_contract_workspace_start",
        eventType: "gov_contract_submission_package_started",
      });
      if (!submissionLedgerResult.ok) {
        console.warn("[approval-ledger] gov contract submission package sync skipped:", submissionLedgerResult.error);
      }
    }

    const loaded = await loadGovContractBidWorkspace(opportunity.id);
    return { ok: true, persisted: true, opportunity: loaded.opportunity, workspace: loaded.workspace };
  } catch (err) {
    return {
      ok: false,
      persisted: false,
      opportunity,
      workspace: generated,
      error: err instanceof Error ? err.message : "Unable to start bid workspace.",
    };
  }
}

export function buildBidExportPackage(opportunity: GovContractOpportunity, workspace: GovContractBidWorkspace) {
  const sourcesReferenced = [
    {
      label: "Opportunity record",
      type: opportunity.sourceSystem,
      sourceId: opportunity.sourceId,
      url: opportunity.sourceUrl,
    },
    ...opportunity.attachments.map((attachment) => ({
      label: attachment.label,
      type: attachment.type ?? "attachment",
      sourceId: null,
      url: attachment.url,
    })),
    ...workspace.marketResearch.sourceLinks.map((source) => ({
      label: source.label,
      type: source.type,
      sourceId: null,
      url: source.url,
      freshnessLabel: source.freshnessLabel ?? null,
      verifiedData: Boolean(source.verifiedData),
    })),
  ];

  return {
    generatedAt: new Date().toISOString(),
    approvalStatus: workspace.approvalStatus || "not_requested",
    reviewStatus: "needs_human_review",
    destination: "Internal HomeReach government contract review export",
    nextAction: workspace.bidDecision.recommendedNextStep,
    relatedEntity: {
      type: "gov_contract_opportunity",
      id: opportunity.id,
      solicitationNumber: opportunity.solicitationNumber,
      bidRoomId: workspace.id,
    },
    inputsUsed: [
      "opportunity record",
      "advisory bid/no-bid decision",
      "pricing guardrail model",
      "opportunity-specific market research packet",
      "requirements and document plan",
      "compliance matrix",
      "subcontractor needs",
      "submission checklist",
      "operating model",
    ],
    sourcesReferenced,
    humanApprovalRequiredBefore: [
      "Final pricing or margin decision",
      "Legal, eligibility, certification, or past-performance claim",
      "Subcontractor selection, teaming agreement, quote acceptance, or spend commitment",
      "External proposal delivery, portal upload, email submission, or award acceptance",
    ],
    warning:
      "Preparation package only. HomeReach does not submit government bids or certify compliance without explicit human approval.",
    opportunity: {
      title: opportunity.title,
      agency: opportunity.agency,
      solicitationNumber: opportunity.solicitationNumber,
      sourceUrl: opportunity.sourceUrl,
      dueDate: opportunity.dueDate,
      responseMethod: opportunity.responseMethod,
    },
    bidDecision: workspace.bidDecision,
    marketResearch: workspace.marketResearch,
    pricing: workspace.pricing,
    documents: workspace.documents,
    complianceMatrix: workspace.complianceMatrix,
    subcontractorNeeds: workspace.subcontractorNeeds,
    submissionPlan: workspace.submissionPlan,
    postAwardPlan: workspace.postAwardPlan,
    operatingModel: workspace.operatingModel,
    fileNamingChecklist: workspace.exportPackage.fileNamingChecklist,
  };
}
