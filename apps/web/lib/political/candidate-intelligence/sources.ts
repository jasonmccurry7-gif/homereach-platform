export interface CandidateIntelSourceDefinition {
  key: string;
  label: string;
  provider: "fec" | "google_civic" | "democracy_works" | "ballotpedia" | "configured_feed" | "serpapi";
  envKeys: string[];
  dataProvided: string[];
  format: "json_api" | "configured_json" | "csv_or_manual";
  coverage: string;
  cadence: string;
  compliance: string;
  implementationPriority: "mvp" | "phase_2" | "phase_3";
  requiredForMvp: boolean;
}

export const CANDIDATE_INTEL_SOURCES: CandidateIntelSourceDefinition[] = [
  {
    key: "fec_candidates_v1",
    label: "FEC OpenFEC Candidates",
    provider: "fec",
    envKeys: ["FEC_API_KEY"],
    dataProvided: ["federal candidates", "party as publicly filed", "office", "state", "district", "cycle"],
    format: "json_api",
    coverage: "Federal races",
    cadence: "Weekly or nightly during active cycles",
    compliance: "Official public federal filing data; no voter targeting data.",
    implementationPriority: "mvp",
    requiredForMvp: true,
  },
  {
    key: "google_civic_elections_v1",
    label: "Google Civic Information API",
    provider: "google_civic",
    envKeys: ["GOOGLE_CIVIC_API_KEY"],
    dataProvided: ["election IDs", "address-based divisions", "supported candidate data", "election official metadata"],
    format: "json_api",
    coverage: "Supported US elections/address geographies",
    cadence: "Nightly plus intake lookup",
    compliance: "Use only supported election/address data; keep API key restricted.",
    implementationPriority: "mvp",
    requiredForMvp: false,
  },
  {
    key: "democracy_works_elections_v2",
    label: "Democracy Works Elections API",
    provider: "democracy_works",
    envKeys: ["DEMOCRACY_WORKS_API_KEY"],
    dataProvided: ["upcoming elections", "deadlines", "authorities", "Open Civic Data IDs"],
    format: "json_api",
    coverage: "Local, state, and federal elections where licensed",
    cadence: "Nightly",
    compliance: "Requires partnership/API key; timeline guidance only, not voter modeling.",
    implementationPriority: "phase_2",
    requiredForMvp: false,
  },
  {
    key: "ballotpedia_data_api_v1",
    label: "Ballotpedia Data API",
    provider: "ballotpedia",
    envKeys: ["BALLOTPEDIA_API_KEY"],
    dataProvided: ["candidates", "ballot measures", "officeholders", "geographic data by licensed package"],
    format: "json_api",
    coverage: "Licensed Ballotpedia package scope",
    cadence: "Nightly",
    compliance: "Requires active key/package and Ballotpedia terms compliance.",
    implementationPriority: "phase_2",
    requiredForMvp: false,
  },
  {
    key: "state_sos_candidate_filings",
    label: "Secretary of State Candidate Filings",
    provider: "configured_feed",
    envKeys: ["STATE_SOS_FEED_CONFIG_JSON"],
    dataProvided: ["state candidate filings", "filing status", "office", "district", "election dates"],
    format: "configured_json",
    coverage: "Configured states; starts with OH, IL, TN",
    cadence: "Nightly where feed exists; manual CSV otherwise",
    compliance: "Official public filing records; retain source URL and stale-data flags.",
    implementationPriority: "mvp",
    requiredForMvp: true,
  },
  {
    key: "state_boe_candidate_filings",
    label: "State Board of Elections Candidate Filings",
    provider: "configured_feed",
    envKeys: ["STATE_BOE_FEED_CONFIG_JSON"],
    dataProvided: ["state/county filings", "office", "district", "filing status"],
    format: "configured_json",
    coverage: "Configured boards of elections",
    cadence: "Nightly where feed exists; manual upload otherwise",
    compliance: "Official public records; formats vary by state/county.",
    implementationPriority: "mvp",
    requiredForMvp: true,
  },
  {
    key: "municipal_election_filings",
    label: "Municipal Election Filings",
    provider: "configured_feed",
    envKeys: ["MUNICIPAL_ELECTION_FEED_CONFIG_JSON"],
    dataProvided: ["municipal", "school board", "judicial", "ballot initiative filings"],
    format: "csv_or_manual",
    coverage: "Configured municipal sources",
    cadence: "Weekly or manual",
    compliance: "Public local records; every record must keep source and confidence labels.",
    implementationPriority: "phase_2",
    requiredForMvp: false,
  },
  {
    key: "serpapi_candidate_search_v1",
    label: "SerpAPI Candidate Web Search",
    provider: "serpapi",
    envKeys: ["SERPAPI_KEY", "ENABLE_CANDIDATE_SERPAPI"],
    dataProvided: ["campaign websites", "public candidate pages", "public social links", "search snippets"],
    format: "json_api",
    coverage: "Targeted candidate-level public web search",
    cadence: "Manual candidate research only by default",
    compliance: "Public web result discovery only; no voter targeting, persuasion scoring, ideology inference, or background scraping.",
    implementationPriority: "phase_2",
    requiredForMvp: false,
  },
];

export function getCandidateIntelSource(key: string): CandidateIntelSourceDefinition | undefined {
  return CANDIDATE_INTEL_SOURCES.find((source) => source.key === key);
}

export function configuredSourceKeys(): string[] {
  return CANDIDATE_INTEL_SOURCES
    .filter((source) => source.envKeys.every((key) => Boolean(process.env[key])))
    .map((source) => source.key);
}
