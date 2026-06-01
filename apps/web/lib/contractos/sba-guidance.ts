export type ContractOSSbaGuidanceItem = {
  title: string;
  plainEnglishSummary: string;
  whyItMatters: string;
  ownerAction: string;
  sourceLabel: string;
  sourceUrl: string;
};

export const contractOSSbaGuidanceLibrary: ContractOSSbaGuidanceItem[] = [
  {
    title: "Basic federal contracting requirements",
    plainEnglishSummary:
      "Before bidding, a business should confirm its legal business identity, UEI, SAM.gov registration, business size, and ability to perform the work.",
    whyItMatters:
      "A promising opportunity can become a no-bid if registration, size, insurance, bonding, or required proof is missing.",
    ownerAction: "Complete the readiness profile before treating any opportunity as bid-ready.",
    sourceLabel: "U.S. Small Business Administration",
    sourceUrl: "https://www.sba.gov/federal-contracting/contracting-guide/basic-requirements",
  },
  {
    title: "Contracting assistance programs",
    plainEnglishSummary:
      "SBA programs can help eligible small businesses compete for set-aside and sole-source opportunities.",
    whyItMatters:
      "Set-aside eligibility affects fit scoring, competition level, subcontractor strategy, and bid/no-bid decisions.",
    ownerAction: "List every verified certification and mark unverified programs as review-required.",
    sourceLabel: "U.S. Small Business Administration",
    sourceUrl: "https://www.sba.gov/federal-contracting/contracting-assistance-programs",
  },
  {
    title: "How to find and win government contracts",
    plainEnglishSummary:
      "Government contracting is a workflow: prepare the business, find realistic opportunities, read the solicitation, price the work, submit correctly, and execute after award.",
    whyItMatters:
      "ContractOS should guide owners through the process instead of leaving them inside a confusing bid database.",
    ownerAction: "Use the bid workspace checklist for every serious opportunity.",
    sourceLabel: "U.S. Small Business Administration",
    sourceUrl: "https://www.sba.gov/federal-contracting/contracting-guide",
  },
  {
    title: "Subcontracting as a realistic path",
    plainEnglishSummary:
      "Small businesses can build past performance by supporting primes or teaming where direct prime bidding is too risky.",
    whyItMatters:
      "Some opportunities should become partner/subcontractor plays instead of underpriced prime bids.",
    ownerAction: "Use Subcontractor Mode when capability, bonding, staffing, geography, or past performance is incomplete.",
    sourceLabel: "U.S. Small Business Administration",
    sourceUrl: "https://www.sba.gov/federal-contracting/contracting-guide/prime-subcontracting",
  },
];
