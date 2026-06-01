import type {
  GovContractAgencyProfile,
  GovContractAwardIntel,
  GovContractBidRecommendation,
  GovContractContactPlan,
  GovContractFinancialRiskModel,
  GovContractLifecycleItem,
  GovContractOperatingModel,
  GovContractOpportunity,
  GovContractPastPerformanceMatch,
  GovContractPricingModel,
  GovContractProposalSection,
  GovContractRecompeteSignal,
  GovContractSubcontractorNeed,
  GovContractTeamingPlan,
} from "./types";

function cents(value: number) {
  return Math.max(0, Math.round(value));
}

function pct(amount: number, percent: number) {
  return cents(amount * percent);
}

function formatCurrencyRange(lowCents: number, highCents: number) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return `${formatter.format(lowCents / 100)} - ${formatter.format(highCents / 100)}`;
}

function textFor(opportunity: GovContractOpportunity) {
  return [opportunity.title, opportunity.summary, opportunity.naicsCode, opportunity.pscCode, opportunity.agency]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function nextFutureDate(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

export function buildContractLifecycle(opportunity: GovContractOpportunity): GovContractLifecycleItem[] {
  const status = opportunity.pipelineStatus;
  return [
    {
      stage: "Opportunity Discovery",
      status: "complete",
      objective: "Load SAM.gov notice, source link, agency, codes, dates, and advisory scores.",
      nextAction: "Verify notice freshness, attachments, amendments, and response method.",
      risk: "low",
    },
    {
      stage: "Qualification",
      status: ["new", "saved", "reviewing", "qualifying"].includes(status) ? "active" : "complete",
      objective: "Decide whether the opportunity deserves pursuit time.",
      nextAction: "Confirm capability, eligibility, value, deadline, and missing requirement list.",
      risk: opportunity.riskScore >= 70 ? "critical" : "high",
    },
    {
      stage: "Bid / No-Bid",
      status: ["bid_prep", "pricing_review", "compliance_review", "ready_for_approval", "ready_to_submit", "submitted", "under_evaluation", "awarded"].includes(status)
        ? "complete"
        : "next",
      objective: "Lock the pursuit decision before spending proposal time.",
      nextAction: "Record Strong Bid, Teaming Recommended, High Risk, or No-Bid with reasons.",
      risk: "high",
    },
    {
      stage: "Pricing And Cash Flow",
      status: ["pricing_review", "compliance_review", "ready_for_approval", "ready_to_submit", "submitted", "under_evaluation", "awarded"].includes(status)
        ? "active"
        : "future",
      objective: "Prevent underpriced work and working-capital strain.",
      nextAction: "Approve a price above the minimum safe bid and review payment timing.",
      risk: "critical",
    },
    {
      stage: "Proposal And Compliance",
      status: ["compliance_review", "ready_for_approval", "ready_to_submit", "submitted", "under_evaluation", "awarded"].includes(status)
        ? "active"
        : "future",
      objective: "Build a compliant, reviewed response package.",
      nextAction: "Complete every proposal section and compliance matrix line before approval.",
      risk: "critical",
    },
    {
      stage: "Submission Preparation",
      status: ["ready_to_submit", "submitted", "under_evaluation", "awarded"].includes(status) ? "active" : "future",
      objective: "Prepare export package and submission instructions for human approval.",
      nextAction: "Verify portal/email, subject line, deadline, file limits, signatures, and final approval.",
      risk: "critical",
    },
    {
      stage: "Award Execution",
      status: status === "awarded" ? "active" : "future",
      objective: "Convert bid workspace into delivery, invoicing, issue, and closeout management.",
      nextAction: "Capture award notice, kickoff, subcontractor onboarding, invoices, and margin forecast.",
      risk: "high",
    },
    {
      stage: "Recompete And Past Performance",
      status: status === "awarded" ? "next" : "future",
      objective: "Turn completed work into reusable proof and future pipeline.",
      nextAction: "Record outcomes, ratings, lessons learned, references, and expected recompete timing.",
      risk: "medium",
    },
  ];
}

export function buildAgencyProfile(opportunity: GovContractOpportunity): GovContractAgencyProfile {
  const text = textFor(opportunity);
  const isFederal = hasAny(text, ["federal", "department", "administration", "service", "agency"]);
  const isLocal = hasAny(text, ["county", "city", "school", "municipal"]);
  const commonNaics = [opportunity.naicsCode, hasAny(text, ["mail", "postcard", "print"]) ? "323111 / 541860 adjacent" : null]
    .filter(Boolean)
    .map(String);

  return {
    agencyName: opportunity.agency,
    office: opportunity.office,
    spendingTrend: opportunity.estimatedValueCents
      ? "Value-bearing notice. Use prior awards and incumbent signals before setting pursuit priority."
      : "No loaded value. Treat spending trend as unknown until award history is attached.",
    awardFrequency: isFederal ? "Federal opportunity cadence should be tracked by NAICS, office, and recompete timing." : "Frequency unknown; build history as awards are imported.",
    commonNaics: commonNaics.length ? commonNaics : ["Not loaded"],
    incumbentPattern: opportunity.incumbentVendor
      ? `Incumbent visible: ${opportunity.incumbentVendor}. Displacement strategy required.`
      : "Incumbent not loaded. Research award history before assuming the field is open.",
    smallBusinessTendency: opportunity.setAsideDescription
      ? `Set-aside signal: ${opportunity.setAsideDescription}. Verify actual eligibility before bid.`
      : "No set-aside signal loaded. Confirm eligibility and small-business office guidance.",
    procurementSpeed: opportunity.urgency === "critical" ? "Compressed response window." : isLocal ? "Likely relationship-sensitive; verify Q&A and local requirements." : "Unknown until amendment/Q&A cadence is tracked.",
    contractSizeRange: opportunity.estimatedValueCents
      ? formatCurrencyRange(pct(opportunity.estimatedValueCents, 0.75), pct(opportunity.estimatedValueCents, 1.25))
      : "Unknown",
    aiGuidance: [
      "Research awards by agency, office, NAICS, and solicitation number before final bid/no-bid.",
      opportunity.incumbentVendor ? "Assume incumbent advantage until evidence says otherwise." : "Do not infer incumbent weakness without historical award data.",
      "Use subcontracting-first positioning if direct past performance is thin.",
    ],
  };
}

export function buildAwardIntel(opportunity: GovContractOpportunity, pricing: GovContractPricingModel): GovContractAwardIntel {
  const value = opportunity.estimatedValueCents ?? pricing.recommendedBidCents;
  const low = Math.min(pricing.aggressiveBidCents, pct(value, 0.82));
  const high = Math.max(pricing.premiumBidCents, pct(value, 1.18));
  const hasValueBasis = value > 0 || pricing.recommendedBidCents > 0 || pricing.premiumBidCents > 0;
  const sourceLabel = opportunity.isSample
    ? "sample planning record"
    : opportunity.lastSyncedAt
    ? `source-labeled opportunity record synced ${opportunity.lastSyncedAt}`
    : "source freshness not confirmed";

  return {
    incumbentVendor: opportunity.incumbentVendor ?? "Unknown",
    historicalAwardSignal: opportunity.awardAmountCents
      ? `Loaded award amount: ${formatCurrencyRange(opportunity.awardAmountCents, opportunity.awardAmountCents)}. Source/freshness: ${sourceLabel}; verify scope, quantity, dates, and terms before using as price support.`
      : `Historical award placeholder only. No verified prior award is loaded; source/freshness: ${sourceLabel}. Import award history before final pricing.`,
    realisticCompetitiveRange: hasValueBasis
      ? `${formatCurrencyRange(low, high)} planning range placeholder; not verified competitive range until prior awards, competitor prices, or market evidence are attached.`
      : "Unknown until estimated value, quantities, pricing sheet, or prior awards are attached.",
    incumbentRisk: opportunity.incumbentVendor ? "high" : "unknown",
    likelyCompetitorBehavior: opportunity.incumbentVendor
      ? "Incumbent may price defensively and emphasize continuity."
      : "Competitor field is unknown; expect price sensitivity until award data is reviewed.",
    pricingPattern: "Use fully burdened cost, risk adders, FAR-aware price reasonableness notes, and source-labeled comparisons. Do not chase a loss-making low bid.",
    intelligenceGaps: [
      ...(opportunity.incumbentVendor ? [] : ["incumbent vendor"]),
      "prior award values",
      "competitor count",
      "agency evaluation tendencies",
      "source freshness labels for every external data point",
    ],
  };
}

export function buildFinancialRiskModel(
  opportunity: GovContractOpportunity,
  pricing: GovContractPricingModel
): GovContractFinancialRiskModel {
  const subcontractor = pricing.directCosts.find((item) => item.key === "subcontractor")?.amountCents ?? 0;
  const directLabor = pricing.directCosts.find((item) => item.key === "direct_labor")?.amountCents ?? 0;
  const paymentGapDays = opportunity.riskScore >= 70 ? 60 : opportunity.riskScore >= 50 ? 45 : 30;
  const upfrontCashNeed = cents((directLabor + subcontractor) * 0.42);
  const subcontractorFloat = cents(subcontractor * 0.35);
  const burnRate = cents((directLabor + subcontractor + sumPricing(pricing.riskAdders)) / Math.max(1, paymentGapDays / 30));
  const stress = Math.min(100, Math.round(opportunity.riskScore * 0.5 + (subcontractor > directLabor ? 22 : 8) + (paymentGapDays > 45 ? 15 : 5)));
  const warnings = [
    ...(pricing.underbidRiskScore >= 70 ? ["Underbid risk is high. Verify value basis, quantities, and minimum safe bid before any price approval."] : []),
    ...(pricing.cashFlowRiskScore >= 70 ? ["Cash-flow risk is high. Confirm invoice timing, reserve capacity, and subcontractor payment terms before bid approval."] : []),
    ...(stress >= 70 ? ["High working-capital stress. Confirm payment timing and reserves before bid approval."] : []),
    ...(pricing.riskAdjustedMarginPercent < 22 ? ["Low margin warning. Pricing does not leave much room for rework or payment delay."] : []),
    ...(subcontractorFloat > 0 ? ["Subcontractor payment timing can create cash pressure before government payment arrives."] : []),
  ];

  return {
    upfrontCashNeedCents: upfrontCashNeed,
    payrollBurdenCents: cents(directLabor * 0.5),
    subcontractorFloatCents: subcontractorFloat,
    estimatedPaymentGapDays: paymentGapDays,
    burnRateCents: burnRate,
    workingCapitalStressScore: stress,
    warnings: warnings.length ? warnings : ["Cash-flow risk appears manageable after human review of payment terms."],
    assumptions: [
      "Payment timing is estimated until contract clauses and invoice process are reviewed.",
      "Subcontractor payment terms are placeholders until quotes and agreements are approved.",
      "Working-capital stress is advisory and must be reviewed before final pricing approval.",
    ],
  };
}

function sumPricing(items: Array<{ amountCents: number }>) {
  return items.reduce((total, item) => total + item.amountCents, 0);
}

export function buildPastPerformanceMatches(opportunity: GovContractOpportunity): GovContractPastPerformanceMatch[] {
  const text = textFor(opportunity);
  const matches: GovContractPastPerformanceMatch[] = [];
  if (hasAny(text, ["mail", "print", "postcard"])) {
    matches.push({
      projectName: "Direct mail campaign production and deployment",
      relevanceScore: 82,
      matchingScope: ["print/mail coordination", "addressing", "deployment scheduling", "quality control"],
      gap: "Federal past-performance format and reference contact still need documentation.",
      narrativeUse: "Use as operational execution narrative only after proof and references are attached.",
      humanReviewRequired: true,
    });
  }
  if (hasAny(text, ["courier", "logistics", "delivery", "fulfillment"])) {
    matches.push({
      projectName: "Route-based fulfillment and logistics coordination",
      relevanceScore: 74,
      matchingScope: ["local routing", "vendor coordination", "fulfillment visibility"],
      gap: "Government-specific CPARS/reference evidence not loaded.",
      narrativeUse: "Use for management approach and schedule controls, not as a fabricated federal reference.",
      humanReviewRequired: true,
    });
  }
  if (!matches.length) {
    matches.push({
      projectName: "HomeReach operational execution capability",
      relevanceScore: 48,
      matchingScope: ["project management", "vendor coordination", "customer communication"],
      gap: "No direct matching past performance loaded.",
      narrativeUse: "Identify a partner or subcontractor with stronger direct performance before prime bid.",
      humanReviewRequired: true,
    });
  }
  return matches;
}

export function buildProposalSections(opportunity: GovContractOpportunity): GovContractProposalSection[] {
  const needsSub = textFor(opportunity).includes("subcontract") || opportunity.scoreBreakdown.subcontractability >= 68;
  const sections: Array<[string, string, string]> = [
    ["executive_summary", "Executive Summary", "Position the value, risk controls, and compliant response posture."],
    ["technical_approach", "Technical Approach", "Describe how the scope will be performed with clear deliverables."],
    ["management_approach", "Management Approach", "Show ownership, cadence, reporting, issue handling, and quality control."],
    ["staffing_plan", "Staffing Plan", "Map labor categories, roles, and availability without inventing credentials."],
    ["pricing_narrative", "Pricing Narrative", "Explain fair and reasonable pricing logic, assumptions, exclusions, and risk adders."],
    ["compliance_matrix", "Compliance Matrix", "Map every requirement to the response location or human review flag."],
    ["past_performance", "Past Performance", "Use documented references only; identify gaps where proof is missing."],
    ["subcontractor_plan", "Subcontractor / Teaming Plan", needsSub ? "Show subcontractor role, quote, docs, and consent/flow-down review." : "Keep available if scope changes."],
    ["quality_control", "Quality Control Plan", "Define acceptance checks, corrections, escalation, and delivery evidence."],
    ["risk_mitigation", "Risk Mitigation Plan", "Address schedule, compliance, cash flow, subcontractor, and performance risk."],
  ];

  return sections.map(([key, title, purpose]) => ({
    key,
    title,
    status: key === "subcontractor_plan" && !needsSub ? "not_applicable" : "missing",
    owner: key === "pricing_narrative" ? "Pricing owner" : key === "compliance_matrix" ? "Compliance reviewer" : "Bid owner",
    purpose,
    aiDraftInstruction: `Draft ${title.toLowerCase()} from official solicitation facts only. Flag assumptions instead of filling gaps.`,
    humanReviewRequired: true,
  }));
}

export function buildTeamingPlan(
  opportunity: GovContractOpportunity,
  subcontractorNeeds: GovContractSubcontractorNeed[],
  recommendation: GovContractBidRecommendation
): GovContractTeamingPlan {
  const primeRecommendation =
    recommendation === "No-Bid"
      ? "No Pursuit"
      : recommendation === "Teaming Recommended" || recommendation === "Partner Needed"
      ? "Teaming Partner Needed"
      : subcontractorNeeds.length
      ? "Prime With Subcontractor"
      : opportunity.fitScore < 55
      ? "Subcontractor First"
      : "Prime Direct";

  return {
    primeRecommendation,
    rationale: [
      subcontractorNeeds.length
        ? "Scope appears to require outside capability, local coverage, insurance, or documented labor capacity."
        : "No immediate subcontractor requirement detected, but direct execution assumptions still need review.",
      "Prime/subcontractor decision should account for past performance, cash flow, compliance, and relationship strategy.",
    ],
    requiredPartners: subcontractorNeeds,
    agreementWarnings: [
      "No teaming, JV, mentor-protege, or subcontractor commitment without written human approval.",
      "Review FAR Part 44 consent/advance-notification risk and solicitation flow-down clauses.",
      "Confirm exclusions, insurance, licenses, pricing, and payment terms before selection.",
    ],
  };
}

export function buildRecompeteSignals(opportunity: GovContractOpportunity): GovContractRecompeteSignal[] {
  return [
    {
      label: "Likely recompete monitoring",
      timing: opportunity.dueDate ? `Start monitoring after award; seed reminder around ${nextFutureDate(18)}.` : "Set after award date is known.",
      prepositioningAction: "Track awardee, contract number, period of performance, agency contacts, and lessons learned.",
      risk: "unknown",
    },
    {
      label: "Relationship pre-positioning",
      timing: "Begin after bid decision or award notice.",
      prepositioningAction: "Build agency contact history, capability statement sends, and small business office touchpoints.",
      risk: opportunity.incumbentVendor ? "high" : "medium",
    },
  ];
}

export function buildGovernmentContacts(opportunity: GovContractOpportunity): GovContractContactPlan[] {
  return [
    {
      contactType: "contracting_officer",
      label: "Contracting Officer",
      relationshipStage: "identified from solicitation",
      nextAction: "Extract verified contact details from the official notice before any question or submission.",
      approvalRequired: true,
    },
    {
      contactType: "small_business_office",
      label: `${opportunity.agency} small business office`,
      relationshipStage: "research needed",
      nextAction: "Identify appropriate small business contact and capability statement path.",
      approvalRequired: true,
    },
    {
      contactType: "teaming_partner",
      label: "Prime / teaming partner candidates",
      relationshipStage: "not started",
      nextAction: "Use partner-first strategy if direct past performance or eligibility is weak.",
      approvalRequired: true,
    },
  ];
}

export function buildGovContractOperatingModel(
  opportunity: GovContractOpportunity,
  pricing: GovContractPricingModel,
  subcontractorNeeds: GovContractSubcontractorNeed[],
  recommendation: GovContractBidRecommendation
): GovContractOperatingModel {
  return {
    lifecycle: buildContractLifecycle(opportunity),
    agencyProfile: buildAgencyProfile(opportunity),
    awardIntel: buildAwardIntel(opportunity, pricing),
    financialRisk: buildFinancialRiskModel(opportunity, pricing),
    pastPerformanceMatches: buildPastPerformanceMatches(opportunity),
    proposalSections: buildProposalSections(opportunity),
    teamingPlan: buildTeamingPlan(opportunity, subcontractorNeeds, recommendation),
    recompeteSignals: buildRecompeteSignals(opportunity),
    governmentContacts: buildGovernmentContacts(opportunity),
  };
}
