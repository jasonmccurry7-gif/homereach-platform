import type { CandidateRow } from "./queries";

export interface OhioCandidateSelectorOption {
  value: string;
  candidateName: string;
  officeSought: string;
  party: string;
  geography: string;
  electionLabel: string;
  raceType: string;
  campaignStatus: string;
  sourceLabel: string;
  sourceUrl?: string;
  liveCandidateId?: string;
  isAmyActon?: boolean;
}

const OHIO_SOS_DEMOCRATIC_RESULTS =
  "https://liveresults.ohiosos.gov/Api/v1/download?filename=EMSReportingDemocraticResults";
const OHIO_SOS_REPUBLICAN_RESULTS =
  "https://liveresults.ohiosos.gov/Api/v1/download?filename=EMSReportingRepublicanResults";
const OHIO_SOS_LIBERTARIAN_RESULTS =
  "https://liveresults.ohiosos.gov/Api/v1/download?filename=EMSReportingLibertarianResults";

// Prebuilt selector options from the supplied May 5, 2026 Ohio primary winners CSV,
// plus the already-requested statewide/federal prebuild profiles. These are not
// final USPS-quoted campaigns; they are queued planning profiles.
export const OHIO_TOP_CANDIDATE_SELECTOR_OPTIONS: OhioCandidateSelectorOption[] = [
  {
    value: "amy-acton",
    candidateName: "Amy Acton",
    officeSought: "Governor",
    party: "Democrat",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_DEMOCRATIC_RESULTS,
    isAmyActon: true,
  },
  {
    value: "vivek-ramaswamy",
    candidateName: "Vivek Ramaswamy",
    officeSought: "Governor",
    party: "Republican",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_REPUBLICAN_RESULTS,
  },
  {
    value: "sherrod-brown",
    candidateName: "Sherrod Brown",
    officeSought: "U.S. Senate",
    party: "Democrat",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "federal statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "HomeReach prebuilt federal profile",
  },
  {
    value: "jon-husted",
    candidateName: "Jon Husted",
    officeSought: "U.S. Senate",
    party: "Republican",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "federal statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "HomeReach prebuilt federal profile",
  },
  {
    value: "keith-faber",
    candidateName: "Keith Faber",
    officeSought: "Attorney General",
    party: "Republican",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_REPUBLICAN_RESULTS,
  },
  {
    value: "john-kulewicz",
    candidateName: "John Kulewicz",
    officeSought: "Attorney General",
    party: "Democrat",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_DEMOCRATIC_RESULTS,
  },
  {
    value: "frank-larose",
    candidateName: "Frank LaRose",
    officeSought: "Auditor of State",
    party: "Republican",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_REPUBLICAN_RESULTS,
  },
  {
    value: "annette-blackwell",
    candidateName: "Annette Blackwell",
    officeSought: "Auditor of State",
    party: "Democrat",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_DEMOCRATIC_RESULTS,
  },
  {
    value: "robert-sprague",
    candidateName: "Robert Sprague",
    officeSought: "Secretary of State",
    party: "Republican",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_REPUBLICAN_RESULTS,
  },
  {
    value: "catherine-russo",
    candidateName: "Catherine Russo",
    officeSought: "Secretary of State",
    party: "Democrat",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_DEMOCRATIC_RESULTS,
  },
  {
    value: "seth-walsh",
    candidateName: "Seth Walsh",
    officeSought: "Treasurer of State",
    party: "Democrat",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_DEMOCRATIC_RESULTS,
  },
  {
    value: "jay-edwards",
    candidateName: "Jay Edwards",
    officeSought: "Treasurer of State",
    party: "Republican",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_REPUBLICAN_RESULTS,
  },
  {
    value: "jennifer-brunner",
    candidateName: "Jennifer Brunner",
    officeSought: "Supreme Court Justice",
    party: "Democrat",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "judicial statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_DEMOCRATIC_RESULTS,
  },
  {
    value: "marilyn-zayas",
    candidateName: "Marilyn Zayas",
    officeSought: "Supreme Court Justice",
    party: "Democrat",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "judicial statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_DEMOCRATIC_RESULTS,
  },
  {
    value: "colleen-odonnell",
    candidateName: "Colleen O'Donnell",
    officeSought: "Supreme Court Justice",
    party: "Republican",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "judicial statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_REPUBLICAN_RESULTS,
  },
  {
    value: "daniel-hawkins",
    candidateName: "Daniel Hawkins",
    officeSought: "Supreme Court Justice",
    party: "Republican",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "judicial statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_REPUBLICAN_RESULTS,
  },
  {
    value: "donald-kissick",
    candidateName: "Donald Kissick",
    officeSought: "Governor",
    party: "Libertarian",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_LIBERTARIAN_RESULTS,
  },
  {
    value: "aidan-jeffery",
    candidateName: "Aidan Jeffery",
    officeSought: "Auditor of State",
    party: "Libertarian",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "statewide",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_LIBERTARIAN_RESULTS,
  },
  {
    value: "craig-riedel",
    candidateName: "Craig Riedel",
    officeSought: "State Senator - District 01",
    party: "Republican",
    geography: "Ohio Senate District 01",
    electionLabel: "2026",
    raceType: "state legislative",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_REPUBLICAN_RESULTS,
  },
  {
    value: "michele-reynolds",
    candidateName: "Michele Reynolds",
    officeSought: "State Senator - District 03",
    party: "Republican",
    geography: "Ohio Senate District 03",
    electionLabel: "2026",
    raceType: "state legislative",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_REPUBLICAN_RESULTS,
  },
  {
    value: "cara-jacob",
    candidateName: "Cara Jacob",
    officeSought: "State Senator - District 07",
    party: "Democrat",
    geography: "Ohio Senate District 07",
    electionLabel: "2026",
    raceType: "state legislative",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_DEMOCRATIC_RESULTS,
  },
  {
    value: "zachary-haines",
    candidateName: "Zachary Haines",
    officeSought: "State Senator - District 07",
    party: "Republican",
    geography: "Ohio Senate District 07",
    electionLabel: "2026",
    raceType: "state legislative",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_REPUBLICAN_RESULTS,
  },
  {
    value: "catherine-ingram",
    candidateName: "Catherine Ingram",
    officeSought: "State Senator - District 09",
    party: "Democrat",
    geography: "Ohio Senate District 09",
    electionLabel: "2026",
    raceType: "state legislative",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_DEMOCRATIC_RESULTS,
  },
  {
    value: "linda-matthews",
    candidateName: "Linda Matthews",
    officeSought: "State Senator - District 09",
    party: "Republican",
    geography: "Ohio Senate District 09",
    electionLabel: "2026",
    raceType: "state legislative",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_REPUBLICAN_RESULTS,
  },
  {
    value: "paula-hicks-hudson",
    candidateName: "Paula Hicks-Hudson",
    officeSought: "State Senator - District 11",
    party: "Democrat",
    geography: "Ohio Senate District 11",
    electionLabel: "2026",
    raceType: "state legislative",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_DEMOCRATIC_RESULTS,
  },
  {
    value: "james-nowak",
    candidateName: "James Nowak",
    officeSought: "State Senator - District 11",
    party: "Republican",
    geography: "Ohio Senate District 11",
    electionLabel: "2026",
    raceType: "state legislative",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_REPUBLICAN_RESULTS,
  },
  {
    value: "bride-sweeney",
    candidateName: "Bride Sweeney",
    officeSought: "State Senator - District 23",
    party: "Democrat",
    geography: "Ohio Senate District 23",
    electionLabel: "2026",
    raceType: "state legislative",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_DEMOCRATIC_RESULTS,
  },
  {
    value: "bill-demora",
    candidateName: "Bill DeMora",
    officeSought: "State Senator - District 25",
    party: "Democrat",
    geography: "Ohio Senate District 25",
    electionLabel: "2026",
    raceType: "state legislative",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_DEMOCRATIC_RESULTS,
  },
  {
    value: "jane-timken",
    candidateName: "Jane Timken",
    officeSought: "State Senator - District 29",
    party: "Republican",
    geography: "Ohio Senate District 29",
    electionLabel: "2026",
    raceType: "state legislative",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_REPUBLICAN_RESULTS,
  },
  {
    value: "alessandro-cutrona",
    candidateName: "Alessandro Cutrona",
    officeSought: "State Senator - District 33",
    party: "Republican",
    geography: "Ohio Senate District 33",
    electionLabel: "2026",
    raceType: "state legislative",
    campaignStatus: "prebuilt profile",
    sourceLabel: "Ohio SOS May 5, 2026 primary winners CSV",
    sourceUrl: OHIO_SOS_REPUBLICAN_RESULTS,
  },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\bdr\.?\s+/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function keyForOption(option: Pick<OhioCandidateSelectorOption, "candidateName" | "officeSought" | "party">) {
  return `${normalize(option.candidateName)}|${normalize(option.officeSought)}|${normalize(option.party)}`;
}

function slugify(value: string) {
  return normalize(value).replaceAll(" ", "-");
}

export function optionValueForCandidateRow(candidate: CandidateRow) {
  if (/amy\s+acton|dr\.?\s+amy\s+acton/i.test(candidate.candidateName)) return "amy-acton";
  return slugify(`${candidate.candidateName} ${candidate.officeSought ?? ""}`) || candidate.id;
}

export function optionFromCandidateRow(candidate: CandidateRow): OhioCandidateSelectorOption {
  return {
    value: optionValueForCandidateRow(candidate),
    candidateName: candidate.candidateName,
    officeSought: candidate.officeSought ?? "Office pending",
    party: candidate.partyOptionalPublic ?? "Party/committee pending",
    geography: candidate.geographyValue ?? candidate.state,
    electionLabel: candidate.electionYear ? String(candidate.electionYear) : candidate.electionDate ?? "Election pending",
    raceType: candidate.districtType ?? candidate.geographyType ?? "race pending",
    campaignStatus: candidate.candidateStatus,
    sourceLabel: candidate.sourceType ?? "campaign_candidates database",
    sourceUrl: candidate.sourceUrl ?? undefined,
    liveCandidateId: candidate.id,
    isAmyActon: /amy\s+acton|dr\.?\s+amy\s+acton/i.test(candidate.candidateName),
  };
}

export function buildOhioCandidateSelectorOptions(candidates: CandidateRow[]) {
  const merged = new Map<string, OhioCandidateSelectorOption>();

  for (const option of candidates.map(optionFromCandidateRow)) {
    merged.set(keyForOption(option), option);
  }

  for (const option of OHIO_TOP_CANDIDATE_SELECTOR_OPTIONS) {
    const key = keyForOption(option);
    if (!merged.has(key)) merged.set(key, option);
  }

  return Array.from(merged.values()).slice(0, 30);
}

export function findOhioCandidateSelectorOption(
  options: OhioCandidateSelectorOption[],
  selectedValue: string,
) {
  if (!selectedValue) return null;
  return (
    options.find((option) => option.value === selectedValue) ??
    OHIO_TOP_CANDIDATE_SELECTOR_OPTIONS.find((option) => option.value === selectedValue) ??
    null
  );
}

export function formatOhioCandidateSelectorLabel(option: OhioCandidateSelectorOption) {
  return `${option.candidateName} - ${option.officeSought} - ${option.party}`;
}
