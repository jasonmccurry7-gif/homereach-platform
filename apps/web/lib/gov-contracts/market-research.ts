import type {
  GovContractMarketResearchPacket,
  GovContractOpportunity,
  GovContractPricingModel,
  GovContractResearchSource,
  GovContractSubcontractorCandidate,
} from "./types";

type AnyRecord = Record<string, unknown>;

const USA_SPENDING_AWARDS_URL =
  process.env.USA_SPENDING_AWARDS_URL || "https://api.usaspending.gov/api/v2/search/spending_by_award/";
const BING_SEARCH_URL = process.env.BING_SEARCH_URL || "https://api.bing.microsoft.com/v7.0/search";
const FAR_REFERENCE_FRESHNESS =
  "Acquisition.gov FAR FAC 2026-01, effective 2026-03-13; verify the official FAR before final pricing, legal, or compliance use.";

function compact(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.trim()));
}

function queryUrl(base: string, query: string) {
  const url = new URL(base);
  url.searchParams.set("q", query);
  return url.toString();
}

function workCategoriesFor(opportunity: GovContractOpportunity) {
  const text = compact([opportunity.title, opportunity.summary, opportunity.naicsCode, opportunity.pscCode])
    .join(" ")
    .toLowerCase();
  const categories: string[] = [];
  if (/(print|mail|postcard|address|fulfillment)/.test(text)) categories.push("print and mail production");
  if (/(courier|delivery|logistics|transport|route)/.test(text)) categories.push("courier and local delivery");
  if (/(warehouse|kitting|packing|distribution)/.test(text)) categories.push("warehouse kitting and fulfillment");
  if (/(grounds|landscap|facilit|maintenance)/.test(text)) categories.push("facilities and grounds maintenance");
  if (/(janitorial|cleaning|custodial)/.test(text)) categories.push("janitorial and facilities support");
  return categories.length ? categories : ["local execution partner"];
}

function locationLabel(opportunity: GovContractOpportunity) {
  return opportunity.location.label || compact([opportunity.location.city, opportunity.location.state]).join(", ") || "the job location";
}

function localSearchRadiusMiles(opportunity: GovContractOpportunity) {
  if (opportunity.location.city && opportunity.location.zip) return 25;
  if (opportunity.location.city || opportunity.location.zip) return 40;
  if (opportunity.location.state) return 75;
  return 150;
}

function samEntitySearchUrl(opportunity: GovContractOpportunity, category: string) {
  return queryUrl("https://sam.gov/search/", `${category} ${opportunity.location.state ?? ""} ${opportunity.naicsCode ?? ""}`.trim()).replace(
    "q=",
    "index=entity&q="
  );
}

function publicWebSearchUrl(query: string) {
  return queryUrl("https://www.bing.com/search", query);
}

function farSource(label: string, url: string): GovContractResearchSource {
  return {
    label,
    type: "far",
    url,
    status: "manual_review",
    note: FAR_REFERENCE_FRESHNESS,
    retrievedAt: "2026-05-23",
    freshnessLabel: "official reference checked during implementation; recheck before final use",
    verifiedData: true,
  };
}

function sourceLinksFor(opportunity: GovContractOpportunity, category?: string): GovContractResearchSource[] {
  const location = locationLabel(opportunity);
  const naics = opportunity.naicsCode ? `NAICS ${opportunity.naicsCode}` : "";
  const sourceLinks: GovContractResearchSource[] = [
    {
      label: "Official SAM.gov notice",
      type: "sam",
      url: opportunity.sourceUrl,
      status: opportunity.sourceUrl ? "verified" : "manual_review",
      note: opportunity.sourceUrl
        ? "Primary source for requirements, attachments, deadlines, amendments, and submission instructions."
        : "Official notice URL is missing. Verify from SAM.gov before pricing or outreach.",
      retrievedAt: opportunity.lastSyncedAt ?? opportunity.postedDate,
      freshnessLabel: opportunity.isSample
        ? "sample placeholder"
        : opportunity.lastSyncedAt
        ? `last synced ${opportunity.lastSyncedAt}`
        : "freshness not confirmed",
      verifiedData: Boolean(opportunity.sourceUrl || opportunity.lastSyncedAt),
    },
    {
      label: "USAspending award history",
      type: "usaspending",
      url: publicWebSearchUrl(`${opportunity.agency} ${opportunity.solicitationNumber ?? ""} ${naics} prior award value`),
      status: "open_search",
      note: "Placeholder search until live award history is reviewed. Use prior recipient data to avoid underpricing against historical ranges.",
      retrievedAt: null,
      freshnessLabel: "placeholder requires award research",
      verifiedData: false,
    },
    farSource("FAR 15.402 pricing policy", "https://www.acquisition.gov/far/15.402"),
    farSource("FAR 15.404-1 proposal analysis techniques", "https://www.acquisition.gov/far/15.404-1"),
    farSource("FAR Part 44 subcontracting policies", "https://www.acquisition.gov/far/part-44"),
    {
      label: "SAM entity / subcontractor search",
      type: "entity_search",
      url: samEntitySearchUrl(opportunity, category ?? workCategoriesFor(opportunity)[0] ?? "contractor"),
      status: process.env.SAM_GOV_ENTITY_API_KEY || process.env.SAM_GOV_API_KEY ? "configured" : "open_search",
      note: "Find registered entities by NAICS, capability, and geography before subcontractor outreach.",
      retrievedAt: null,
      freshnessLabel: "verification required per candidate",
      verifiedData: false,
    },
    {
      label: "Local business sourcing search",
      type: "local_search",
      url: publicWebSearchUrl(`${category ?? workCategoriesFor(opportunity)[0]} near ${location}`),
      status: process.env.BING_SEARCH_API_KEY ? "configured" : "open_search",
      note: "Use live local search or a configured search API to identify nearby businesses for outreach. Search results are not verified until documents and quotes are reviewed.",
      retrievedAt: null,
      freshnessLabel: "open search required",
      verifiedData: false,
    },
  ];
  return sourceLinks;
}

function candidatePlaceholders(opportunity: GovContractOpportunity): GovContractSubcontractorCandidate[] {
  const location = locationLabel(opportunity);
  const radius = localSearchRadiusMiles(opportunity);
  return workCategoriesFor(opportunity).flatMap((category) => {
    const searchUrl = publicWebSearchUrl(`${category} near ${location}`);
    const entityUrl = samEntitySearchUrl(opportunity, category);
    return [
      {
        name: `Find ${category} companies near ${location}`,
        workCategory: category,
        geography: location,
        distanceSignal: `Local search required within ${radius} miles of the place of performance`,
        sourceLabel: "Local web search",
        sourceUrl: searchUrl,
        verificationStatus: "search_required",
        nextAction: "Open search, shortlist 3-5 companies, then verify capability, insurance, SAM status, and quote availability.",
        verificationChecklist: [
          "Confirm business is active and serves the place of performance",
          "Confirm relevant service category and capacity",
          "Request quote with assumptions and exclusions",
          "Verify insurance, licenses, exclusions, and payment terms",
          "Do not commit spend or name the subcontractor externally without human approval",
        ],
      },
      {
        name: `Search SAM-registered ${category} entities`,
        workCategory: category,
        geography: opportunity.location.state ?? location,
        distanceSignal: `State/NAICS search; prefer providers within ${radius} miles when feasible`,
        sourceLabel: "SAM.gov entity search",
        sourceUrl: entityUrl,
        verificationStatus: "search_required",
        nextAction: "Use SAM entity search to identify registered entities before relying on them in a federal bid.",
        verificationChecklist: [
          "Confirm active registration and public entity record",
          "Confirm NAICS/capability alignment",
          "Confirm exclusions status when available",
          "Attach capability statement or quote before selection",
          "Do not represent eligibility or responsibility without human review",
        ],
      },
    ];
  });
}

export function buildGovContractMarketResearchPacket(
  opportunity: GovContractOpportunity,
  pricing: GovContractPricingModel
): GovContractMarketResearchPacket {
  const location = locationLabel(opportunity);
  const hasValue = Boolean(opportunity.estimatedValueCents || opportunity.awardAmountCents);
  const hasLiveNotice = opportunity.sourceSystem === "sam.gov" && Boolean(opportunity.sourceUrl);
  const candidates = candidatePlaceholders(opportunity);
  const radius = localSearchRadiusMiles(opportunity);
  const sourceGaps = [
    ...(opportunity.incumbentVendor ? [] : ["incumbent vendor not loaded"]),
    ...(hasValue ? [] : ["estimated value / quantity basis not loaded"]),
    ...(opportunity.requiredDocuments.length ? [] : ["required document list not extracted"]),
    "prior award values and competitor count need live research before final pricing",
    "subcontractor quotes must be collected before final price approval",
    "payment terms, invoice timing, and working-capital exposure need human review",
    "FAR clauses, subcontracting consent, and flow-down requirements must be verified from the solicitation",
  ];

  return {
    generatedAt: new Date().toISOString(),
    freshnessLabel: hasLiveNotice
      ? `Live notice source loaded; market research remains estimated until source checks run${opportunity.lastSyncedAt ? ` (synced ${opportunity.lastSyncedAt})` : ""}`
      : "Estimated planning packet; no live verified market research attached",
    confidence: hasLiveNotice && hasValue ? "partial" : "estimated",
    executiveSummary:
      `${opportunity.title} for ${opportunity.agency} at ${location} should not move to final pricing until the official notice, prior awards, competitor signals, and local subcontractor quotes are verified. ` +
      `The current model sets a minimum safe bid of ${formatMoney(pricing.minimumSafeBidCents)} and a recommended planning bid of ${formatMoney(pricing.recommendedBidCents)}. ` +
      `Local subcontractor sourcing should start within ${radius} miles of the place of performance and expand only if capability, insurance, or quote quality is weak.`,
    researchStatus: hasLiveNotice ? "partially_verified" : "estimated_planning",
    sourceLinks: sourceLinksFor(opportunity),
    historicalAwardSummary: opportunity.awardAmountCents
      ? `Loaded award amount is ${formatMoney(opportunity.awardAmountCents)}. Compare it against scope, quantities, and contract type before using it as a pricing anchor.`
      : "No prior award value is loaded. Use USAspending, SAM.gov history, solicitation attachments, and incumbent research before selecting a competitive range.",
    competitiveRangeSummary:
      `Planning range: minimum safe ${formatMoney(pricing.minimumSafeBidCents)}, aggressive ${formatMoney(pricing.aggressiveBidCents)}, recommended ${formatMoney(pricing.recommendedBidCents)}, premium ${formatMoney(pricing.premiumBidCents)}. Do not chase a number below fully loaded cost.`,
    likelyCompetitorSummary: opportunity.incumbentVendor
      ? `Incumbent visible: ${opportunity.incumbentVendor}. Assume continuity advantage until research proves otherwise.`
      : "Competitor field is unknown. Research prior recipients, nearby registered entities, and agency award patterns before assuming the opportunity is open.",
    pricingSignals: [
      "Use fully burdened direct costs, subcontractor costs, compliance/admin time, risk reserve, and payment-delay exposure.",
      "Compare recommended bid against prior award values, incumbent pricing patterns, and evaluation criteria.",
      `FAR-aware price reasonableness status: ${pricing.priceReasonablenessStatus.replaceAll("_", " ")}.`,
      `Underbid risk score: ${pricing.underbidRiskScore}/100.`,
      `Cash-flow risk score: ${pricing.cashFlowRiskScore}/100.`,
      "If a local subcontractor quote is missing, treat the subcontractor cost line as estimated and block final submission.",
      ...pricing.farPriceReasonablenessChecks,
    ],
    underbidControls: [
      pricing.underpricingWarning,
      pricing.lowMarginWarning,
      pricing.cashFlowWarning,
      "Do not treat the planning range as a verified competitive range until prior awards, price competition, market/catalog data, or IGCE-style evidence is attached.",
      "Owner approval is required before final pricing, external quote acceptance, or ready-to-submit status.",
    ],
    subcontractorCandidates: candidates,
    sourceGaps,
  };
}

export async function runGovContractLiveMarketResearch(
  opportunity: GovContractOpportunity,
  pricing: GovContractPricingModel
): Promise<GovContractMarketResearchPacket> {
  const basePacket = buildGovContractMarketResearchPacket(opportunity, pricing);
  const [awardResearch, subcontractorResearch] = await Promise.all([
    fetchUsaSpendingAwardSignals(opportunity),
    fetchBingSubcontractorCandidates(opportunity),
  ]);
  const generatedAt = new Date().toISOString();
  const liveSources: GovContractResearchSource[] = [
    ...(awardResearch.length
      ? [
          {
            label: "USAspending live award API query",
            type: "usaspending" as const,
            url: USA_SPENDING_AWARDS_URL,
            status: "verified" as const,
            note: "Live API response was summarized for market research. Review raw award records before using any value as price support.",
            retrievedAt: generatedAt,
            freshnessLabel: "live API query in this request",
            verifiedData: true,
          },
        ]
      : []),
    ...(subcontractorResearch.length
      ? [
          {
            label: "Bing live local subcontractor search",
            type: "local_search" as const,
            url: BING_SEARCH_URL,
            status: "verified" as const,
            note: "Live search returned candidate names only. Each candidate remains unverified until outreach, documents, quote, and exclusions checks are complete.",
            retrievedAt: generatedAt,
            freshnessLabel: "live search query in this request",
            verifiedData: false,
          },
        ]
      : []),
  ];

  return {
    ...basePacket,
    generatedAt,
    confidence: awardResearch.length || subcontractorResearch.length ? "partial" : basePacket.confidence,
    researchStatus: awardResearch.length || subcontractorResearch.length ? "partially_verified" : basePacket.researchStatus,
    sourceLinks: [...basePacket.sourceLinks, ...liveSources],
    historicalAwardSummary: awardResearch.length
      ? `Live USAspending returned ${awardResearch.length} award signal${awardResearch.length === 1 ? "" : "s"} for agency/NAICS context. Review them before final pricing.`
      : basePacket.historicalAwardSummary,
    pricingSignals: [
      ...basePacket.pricingSignals,
      ...awardResearch.map((item) => `${item.recipient}: ${item.amount} - ${item.description}`),
    ].slice(0, 10),
    subcontractorCandidates: subcontractorResearch.length ? subcontractorResearch : basePacket.subcontractorCandidates,
    sourceGaps: basePacket.sourceGaps.filter((gap) => !(awardResearch.length && gap.includes("prior award"))),
  };
}

async function fetchUsaSpendingAwardSignals(opportunity: GovContractOpportunity) {
  if (!opportunity.naicsCode && !opportunity.agency) return [];
  try {
    const end = new Date();
    const start = new Date();
    start.setFullYear(end.getFullYear() - 5);
    const response = await fetch(USA_SPENDING_AWARDS_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        filters: {
          award_type_codes: ["A", "B", "C", "D"],
          time_period: [{ start_date: toDate(start), end_date: toDate(end) }],
          ...(opportunity.naicsCode ? { naics_codes: [opportunity.naicsCode] } : {}),
          ...(opportunity.agency ? { keywords: [opportunity.agency] } : {}),
        },
        fields: [
          "Award ID",
          "Recipient Name",
          "Award Amount",
          "Start Date",
          "End Date",
          "Awarding Agency",
          "Awarding Sub Agency",
          "Description",
          "NAICS",
          "PSC",
        ],
        page: 1,
        limit: 5,
        sort: "Award Amount",
        order: "desc",
        subawards: false,
      }),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as AnyRecord;
    const results = Array.isArray(payload.results) ? payload.results : [];
    return results.slice(0, 5).map((row) => {
      const record = row as AnyRecord;
      return {
        recipient: String(record["Recipient Name"] ?? "Prior recipient unknown"),
        amount: formatMoney(Number(record["Award Amount"] ?? 0) * 100),
        description: String(record.Description ?? record["Award ID"] ?? "Award signal"),
      };
    });
  } catch {
    return [];
  }
}

async function fetchBingSubcontractorCandidates(opportunity: GovContractOpportunity): Promise<GovContractSubcontractorCandidate[]> {
  const apiKey = process.env.BING_SEARCH_API_KEY;
  if (!apiKey) return [];
  const location = locationLabel(opportunity);
  const categories = workCategoriesFor(opportunity).slice(0, 3);
  const searches = await Promise.all(
    categories.map(async (category) => {
      try {
        const url = new URL(BING_SEARCH_URL);
        url.searchParams.set("q", `${category} business near ${location}`);
        url.searchParams.set("count", "5");
        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            "Ocp-Apim-Subscription-Key": apiKey,
          },
          cache: "no-store",
        });
        if (!response.ok) return [];
        const payload = (await response.json()) as AnyRecord;
        const webPages = payload.webPages as AnyRecord | undefined;
        const values = Array.isArray(webPages?.value) ? webPages.value : [];
        return values.slice(0, 4).map((item) => {
          const row = item as AnyRecord;
          return {
            name: String(row.name ?? `${category} candidate`),
            workCategory: category,
            geography: location,
            distanceSignal: "Search result near place of performance",
            sourceLabel: "Bing Web Search",
            sourceUrl: typeof row.url === "string" ? row.url : null,
            verificationStatus: "unverified" as const,
            nextAction: "Verify capability, location, insurance, quote fit, and federal registration before outreach or selection.",
            verificationChecklist: [
              "Confirm business serves the job location",
              "Confirm insurance/license and capacity",
              "Request quote and scope assumptions",
              "Verify SAM/exclusion status before bid use",
            ],
          };
        });
      } catch {
        return [];
      }
    })
  );
  return searches.flat();
}

function toDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatMoney(cents: number | null | undefined) {
  if (!cents) return "TBD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
