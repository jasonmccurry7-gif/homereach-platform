import {
  MULTI_CANDIDATE_CAMPAIGN_AGENTS,
  type CandidateCampaignAgent,
  type CandidatePortraitAsset,
  type CandidateCampaignStrategy,
} from "@/lib/political/candidate-agent-recommendations";
import { politicalCandidateHeadshotProxyUrl } from "@/lib/political/candidate-headshot-proxy";
import { resolvePoliticalPostcardPriceCents } from "@/lib/political/pricing-config";

export type StrategySelectionCandidateStatus =
  | "source_backed"
  | "needs_source_verification"
  | "admin_review";

export type CandidateVerificationSource = {
  label: string;
  url: string;
  publishedAt: string;
  note: string;
};

export type StrategySelectionCandidate = {
  id: string;
  candidateName: string;
  office: string;
  party: string;
  geography: string;
  county: string;
  district: string;
  electionYear: string;
  raceType: string;
  campaignStatus: string;
  status: StrategySelectionCandidateStatus;
  sourceNote: string;
  verificationSources?: CandidateVerificationSource[];
  portrait?: CandidatePortraitAsset;
  agent?: CandidateCampaignAgent;
};

export type StrategySelectionMetric = {
  label: string;
  value: string;
};

export type StrategySelectionPostcard = {
  id: string;
  category: string;
  headline: string;
  subheadline: string;
  cta: string;
  tone: string;
  frontBody: string;
  backBody: string;
};

export type StrategySelectionPlan = {
  id: string;
  optionLabel: "A" | "B" | "C" | "D";
  title: string;
  tagline: string;
  strategyOverview: string;
  whyThisPlan: string;
  candidateFit: string;
  estimatedVoterReach: number;
  estimatedHouseholds: number;
  estimatedImpressions: number;
  estimatedFrequency: number;
  totalCampaignCostCents: number;
  costPerHouseholdCents: number;
  drops: number;
  durationWeeks: number;
  countiesIncluded: string[];
  citiesIncluded: string[];
  districtsIncluded: string[];
  uspsRoutesIncluded: number;
  mailFormat: string;
  saturationPct: number;
  timelineLength: string;
  mapHighlights: string[];
  routeDensity: "medium" | "high" | "very high";
  productionStatus:
    | "planning_estimate"
    | "needs_usps_counts"
    | "ready_for_admin_review";
  indicators: Array<{
    label: string;
    value: "MEDIUM" | "HIGH" | "VERY HIGH";
  }>;
  timeline: Array<{
    week: string;
    label: string;
  }>;
  postcards: StrategySelectionPostcard[];
  metrics: StrategySelectionMetric[];
};

const MONEY_WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const MONEY_TWO = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const INTEGER = new Intl.NumberFormat("en-US");

export const OHIO_STATEWIDE_COUNTIES = [
  "Adams",
  "Allen",
  "Ashland",
  "Ashtabula",
  "Athens",
  "Auglaize",
  "Belmont",
  "Brown",
  "Butler",
  "Carroll",
  "Champaign",
  "Clark",
  "Clermont",
  "Clinton",
  "Columbiana",
  "Coshocton",
  "Crawford",
  "Cuyahoga",
  "Darke",
  "Defiance",
  "Delaware",
  "Erie",
  "Fairfield",
  "Fayette",
  "Franklin",
  "Fulton",
  "Gallia",
  "Geauga",
  "Greene",
  "Guernsey",
  "Hamilton",
  "Hancock",
  "Hardin",
  "Harrison",
  "Henry",
  "Highland",
  "Hocking",
  "Holmes",
  "Huron",
  "Jackson",
  "Jefferson",
  "Knox",
  "Lake",
  "Lawrence",
  "Licking",
  "Logan",
  "Lorain",
  "Lucas",
  "Madison",
  "Mahoning",
  "Marion",
  "Medina",
  "Meigs",
  "Mercer",
  "Miami",
  "Monroe",
  "Montgomery",
  "Morgan",
  "Morrow",
  "Muskingum",
  "Noble",
  "Ottawa",
  "Paulding",
  "Perry",
  "Pickaway",
  "Pike",
  "Portage",
  "Preble",
  "Putnam",
  "Richland",
  "Ross",
  "Sandusky",
  "Scioto",
  "Seneca",
  "Shelby",
  "Stark",
  "Summit",
  "Trumbull",
  "Tuscarawas",
  "Union",
  "Van Wert",
  "Vinton",
  "Warren",
  "Washington",
  "Wayne",
  "Williams",
  "Wood",
  "Wyandot",
] as const;

const OHIO_SOS_2026_QUALIFIED_SOURCE: CandidateVerificationSource = {
  label: "Ohio SOS conditionally qualified list",
  url: "https://www.ohiosos.gov/office/media-center/categories/press-releases/2026-02-19",
  publishedAt: "2026-02-19",
  note: "Official Ohio Secretary of State media release listing statewide candidates conditionally qualified for the 2026 primary ballot.",
};

const OHIO_SOS_2026_FILING_SOURCE: CandidateVerificationSource = {
  label: "Ohio SOS statewide filing list",
  url: "https://www.ohiosos.gov/media-center/press-releases/2026/2026-02-04/",
  publishedAt: "2026-02-04",
  note: "Official Ohio Secretary of State filing deadline release and statewide candidate filing reference.",
};

const OFFICIAL_2026_STATEWIDE_CANDIDATE_NAMES = new Set([
  "sherrod-brown",
  "jon-husted",
  "ron-kincaid",
  "amy-acton",
  "david-pepper",
  "heather-hill",
  "stuart-moats",
  "don-kissick",
  "casey-putsch",
  "kimberly-c-georgeton",
  "vivek-ramaswamy",
  "robert-mccolley",
  "keith-faber",
  "elliott-forhan",
  "john-kulewicz",
  "bryan-hambley",
  "tom-pruss",
  "allison-russo",
  "robert-sprague",
  "marcell-strbich",
  "annette-blackwell",
  "frank-larose",
  "jay-edwards",
  "kristina-roegner",
  "seth-walsh",
  "daniel-hawkins",
  "marilyn-zayas",
  "jennifer-brunner",
  "andrew-king",
  "jill-lanzinger",
  "ronald-lewis",
  "colleen-o-donnell",
]);

function portraitAsset(
  url: string,
  alt: string,
  sourceLabel: string,
  sourceUrl: string,
): CandidatePortraitAsset {
  return {
    url: politicalCandidateHeadshotProxyUrl(url, alt.replace(/\s+(official|public|campaign)?\s*portrait$/i, "")),
    alt,
    sourceLabel,
    sourceUrl,
    approvalStatus: "source_linked_review_required",
    notes:
      "Source-linked public portrait for planning UI only. Campaign-approved creative still requires human review before proposal, outreach, or production use.",
  };
}

const CANDIDATE_HEADSHOT_LIBRARY: Record<string, CandidatePortraitAsset> = {
  "jd-vance": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/March_2026_Official_Vice_Presidential_Portrait_of_JD_Vance_%28head-and-shoulders_cropped%29.jpg/960px-March_2026_Official_Vice_Presidential_Portrait_of_JD_Vance_%28head-and-shoulders_cropped%29.jpg",
    "JD Vance official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/JD_Vance",
  ),
  "mike-dewine": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Gov-Mike-DeWine.jpg/960px-Gov-Mike-DeWine.jpg",
    "Mike DeWine official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Mike_DeWine",
  ),
  "dave-yost": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/1/1f/Dave_Yost_at_Federalist_Society_2.jpg",
    "Dave Yost public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Dave_Yost",
  ),
  "frank-larose": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Frank_LaRose_by_Gage_Skidmore.jpg/960px-Frank_LaRose_by_Gage_Skidmore.jpg",
    "Frank LaRose public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Frank_LaRose",
  ),
  "jon-husted": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Sen._Jon_Husted_official_portrait%2C_119th_Congress.jpg/960px-Sen._Jon_Husted_official_portrait%2C_119th_Congress.jpg",
    "Jon Husted official Senate portrait",
    "Wikimedia Commons official portrait",
    "https://en.wikipedia.org/wiki/Jon_Husted",
  ),
  "keith-faber": portraitAsset(
    "https://ohioauditor.gov/about/img/Auditor_KeithFaber.jpg",
    "Keith Faber official public office portrait",
    "Ohio Auditor public office site",
    "https://ohioauditor.gov/about/auditor.html",
  ),
  "robert-sprague": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/5/57/Rob_Portman_and_Robert_Sprague_%28cropped%29.jpg",
    "Robert Sprague public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Robert_Sprague",
  ),
  "vivek-ramaswamy": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Vivek_Ramaswamy_2026_%28cropped%29.jpg/960px-Vivek_Ramaswamy_2026_%28cropped%29.jpg",
    "Vivek Ramaswamy public campaign portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Vivek_Ramaswamy",
  ),
  "bernie-moreno": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Sen._Bernie_Moreno_official_photo%2C_119th_Congress_%28HR%29.jpg/960px-Sen._Bernie_Moreno_official_photo%2C_119th_Congress_%28HR%29.jpg",
    "Bernie Moreno official Senate portrait",
    "Wikimedia Commons official portrait",
    "https://en.wikipedia.org/wiki/Bernie_Moreno",
  ),
  "jim-jordan": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/e/e5/Jim_Jordan.jpg",
    "Jim Jordan official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Jim_Jordan",
  ),
  "warren-davidson": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/3/34/Warren_Davidson_118th_Congress_%28cropped%29.jpg",
    "Warren Davidson official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Warren_Davidson",
  ),
  "bob-latta": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Bob_Latta_portrait_118th_Congress.jpeg/960px-Bob_Latta_portrait_118th_Congress.jpeg",
    "Bob Latta official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Bob_Latta",
  ),
  "troy-balderson": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Troy_Balderson%2C_official_portrait%2C_116th_Congress.jpg/960px-Troy_Balderson%2C_official_portrait%2C_116th_Congress.jpg",
    "Troy Balderson official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Troy_Balderson",
  ),
  "mike-carey": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/5/5d/Mike_Carey_2025.jpg",
    "Mike Carey official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Mike_Carey_(politician)",
  ),
  "max-miller": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Max_Miller%2C_official_portrait_%28119th_Congress%29.jpg/960px-Max_Miller%2C_official_portrait_%28119th_Congress%29.jpg",
    "Max Miller official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Max_Miller_(politician)",
  ),
  "dave-joyce": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/David_Joyce.jpg/960px-David_Joyce.jpg",
    "Dave Joyce official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/David_Joyce_(politician)",
  ),
  "michael-rulli": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Michael_Rulli_118th_Congress.jpg/960px-Michael_Rulli_118th_Congress.jpg",
    "Michael Rulli official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Michael_Rulli",
  ),
  "mike-turner": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Mike_Turner_118th_Congress.jpeg/960px-Mike_Turner_118th_Congress.jpeg",
    "Mike Turner official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Mike_Turner",
  ),
  "steve-stivers": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/6/6c/Steve_Stivers%2C_Official_Portrait%2C_112th_Congress.jpg",
    "Steve Stivers official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Steve_Stivers",
  ),
  "jane-timken": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/c/ce/Jane_Timken_2017_07_21.jpg",
    "Jane Timken public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Jane_Timken",
  ),
  "matt-dolan": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/1/1a/MattDolan2020_cropped.jpg",
    "Matt Dolan public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Matt_Dolan",
  ),
  "matt-huffman": portraitAsset(
    "https://www.ohiohouse.gov/assets/people/headshots/medium/3039.jpg",
    "Matt Huffman official Ohio House portrait",
    "Ohio House member profile",
    "https://www.ohiohouse.gov/members/matt-huffman/biography",
  ),
  "rob-mccolley": portraitAsset(
    "https://ohiosenate.gov/assets/people/rob-mccolley/files/thumbnails/large/america-250-senate-president-mccolley_large.jpg",
    "Rob McColley official Ohio Senate portrait",
    "Ohio Senate member profile",
    "https://ohiosenate.gov/members/rob-mccolley",
  ),
  "theresa-gavarone": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/c/c0/Theresa_Gavarone.jpg",
    "Theresa Gavarone public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Theresa_Gavarone",
  ),
  "brian-stewart": portraitAsset(
    "https://www.ohiohouse.gov/assets/people/headshots/medium/2955.jpg",
    "Brian Stewart official Ohio House portrait",
    "Ohio House member profile",
    "https://www.ohiohouse.gov/members/brian-stewart/biography",
  ),
  "jason-stephens": portraitAsset(
    "https://www.ohiohouse.gov/assets/people/headshots/medium/2935.jpg",
    "Jason Stephens official Ohio House portrait",
    "Ohio House member profile",
    "https://www.ohiohouse.gov/members/jason-stephens/biography",
  ),
  "sherrod-brown": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Sherrod_Brown_117th_Congress_%282%29.jpg/960px-Sherrod_Brown_117th_Congress_%282%29.jpg",
    "Sherrod Brown official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Sherrod_Brown",
  ),
  "amy-acton": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/7/7b/Amy_Acton_2025.jpg",
    "Dr. Amy Acton public campaign portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Amy_Acton",
  ),
  "allison-russo": portraitAsset(
    "https://www.ohiohouse.gov/assets/people/headshots/medium/2888.jpg",
    "Allison Russo official Ohio House portrait",
    "Ohio House member profile",
    "https://www.ohiohouse.gov/members/c-allison-russo/biography",
  ),
  "joyce-beatty": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/f/f7/Joyce_Beatty_-_119th_Congress.jpg",
    "Joyce Beatty official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Joyce_Beatty",
  ),
  "marcy-kaptur": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Marcy_Kaptur_Wikipedia.jpg/960px-Marcy_Kaptur_Wikipedia.jpg",
    "Marcy Kaptur official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Marcy_Kaptur",
  ),
  "emilia-sykes": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Rep._Emilia_Sykes_-_118th_Congress_%281.jpg/960px-Rep._Emilia_Sykes_-_118th_Congress_%281.jpg",
    "Emilia Sykes official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Emilia_Sykes",
  ),
  "greg-landsman": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Greg_Landsman_Official_Portrait_118th_Congress.jpg/960px-Greg_Landsman_Official_Portrait_118th_Congress.jpg",
    "Greg Landsman official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Greg_Landsman",
  ),
  "shontel-brown": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Shontel_Brown%2C_official_portrait_%28119th_Congress%29.jpg/960px-Shontel_Brown%2C_official_portrait_%28119th_Congress%29.jpg",
    "Shontel Brown official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Shontel_Brown",
  ),
  "nan-whaley": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/c/ce/Nan_Whaley%2C_Mayor_of_Dayton%2C_Ohio_USA.jpg",
    "Nan Whaley public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Nan_Whaley",
  ),
  "aftab-pureval": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/2/25/Aftab_Pureval._%28July_23%2C_2024%29.jpg",
    "Aftab Pureval public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Aftab_Pureval",
  ),
  "justin-bibb": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/4/46/Mayoral_candidate_Justin_M._Bibb_02_%28cropped%29.jpg",
    "Justin Bibb public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Justin_Bibb",
  ),
  "richard-cordray": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Richard_Cordray%2C_Federal_Student_Aid_COO.jpg/960px-Richard_Cordray%2C_Federal_Student_Aid_COO.jpg",
    "Richard Cordray official portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Richard_Cordray",
  ),
  "kathleen-clyde": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/9/9d/Kathleen_Clyde.jpg",
    "Kathleen Clyde public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Kathleen_Clyde",
  ),
  "jennifer-brunner": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/20080310_Jennifer_Brunner.jpg/960px-20080310_Jennifer_Brunner.jpg",
    "Jennifer Brunner public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Jennifer_Brunner",
  ),
  "nickie-antonio": portraitAsset(
    "https://ohiosenate.gov/assets/people/nickie-j-antonio/files/thumbnails/large/america250-senate-democratic-leader-nickie-j-antonio_large.jpg",
    "Nickie Antonio official Ohio Senate portrait",
    "Ohio Senate member profile",
    "https://ohiosenate.gov/members/nickie-j-antonio",
  ),
  "paula-hicks-hudson": portraitAsset(
    "https://ohiosenate.gov/assets/people/paula-hicks-hudson/files/thumbnails/large/america250-senator-paula-hicks-hudson_large.jpg",
    "Paula Hicks-Hudson official Ohio Senate portrait",
    "Ohio Senate member profile",
    "https://ohiosenate.gov/members/paula-hicks-hudson",
  ),
  "casey-weinstein": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/CaseyWeinstein.png/960px-CaseyWeinstein.png",
    "Casey Weinstein public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Casey_Weinstein",
  ),
  "bride-rose-sweeney": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/b/b9/Bride_Rose_Sweeney.jpg",
    "Bride Rose Sweeney public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Bride_Rose_Sweeney",
  ),
  "dani-isaacsohn": portraitAsset(
    "https://www.ohiohouse.gov/assets/people/headshots/medium/2983.jpg",
    "Dani Isaacsohn official Ohio House portrait",
    "Ohio House member profile",
    "https://www.ohiohouse.gov/members/dani-isaacsohn/biography",
  ),
  "dontavius-jarrells": portraitAsset(
    "https://www.ohiohouse.gov/assets/people/headshots/medium/2940.jpg",
    "Dontavius Jarrells official Ohio House portrait",
    "Ohio House member profile",
    "https://www.ohiohouse.gov/members/dontavius-l-jarrells/biography",
  ),
  "anita-somani": portraitAsset(
    "https://www.ohiohouse.gov/assets/people/headshots/medium/2978.jpg",
    "Anita Somani official Ohio House portrait",
    "Ohio House member profile",
    "https://www.ohiohouse.gov/members/anita-somani/biography",
  ),
  "beryl-brown-piccolantonio": portraitAsset(
    "https://www.ohiohouse.gov/assets/people/headshots/medium/3011.jpg",
    "Beryl Brown Piccolantonio official Ohio House portrait",
    "Ohio House member profile",
    "https://www.ohiohouse.gov/members/beryl-brown-piccolantonio/biography",
  ),
  "michele-grim": portraitAsset(
    "https://www.ohiohouse.gov/assets/people/headshots/medium/2988.jpg",
    "Michele Grim official Ohio House portrait",
    "Ohio House member profile",
    "https://www.ohiohouse.gov/members/michele-grim/biography",
  ),
  "jessica-miranda": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/JessicaMirandaHeadshots-2024.jpg/960px-JessicaMirandaHeadshots-2024.jpg",
    "Jessica Miranda public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Jessica_Miranda",
  ),
  "sean-patrick-brennan": portraitAsset(
    "https://www.ohiohouse.gov/assets/people/headshots/medium/2979.jpg",
    "Sean Patrick Brennan official Ohio House portrait",
    "Ohio House member profile",
    "https://www.ohiohouse.gov/members/sean-p-brennan/biography",
  ),
  "kristina-roegner": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/d/d1/Kristina_Roegner.jpg",
    "Kristina Roegner public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Kristina_Roegner",
  ),
  "marilyn-zayas": portraitAsset(
    "https://upload.wikimedia.org/wikipedia/commons/2/24/Judge_Marilyn_Zayas.jpg",
    "Marilyn Zayas public portrait",
    "Wikimedia Commons public portrait",
    "https://en.wikipedia.org/wiki/Marilyn_Zayas",
  ),
};

function candidateHeadshot(
  candidateId: string,
  candidateName: string,
): CandidatePortraitAsset | undefined {
  return (
    CANDIDATE_HEADSHOT_LIBRARY[normalizeCandidateLookup(candidateId)] ??
    CANDIDATE_HEADSHOT_LIBRARY[normalizeCandidateLookup(candidateName)]
  );
}

const EXISTING_CANDIDATES: StrategySelectionCandidate[] =
  MULTI_CANDIDATE_CAMPAIGN_AGENTS.map((agent) =>
    applyOfficialVerification({
      id: agent.profile.id,
      candidateName: agent.profile.candidateName,
      office: agent.profile.office,
      party: agent.profile.partyOrCommittee,
      geography: agent.profile.state,
      county: agent.profile.topCounties[0] ?? "Ohio",
      district: agent.profile.office.includes("U.S.")
        ? "Federal statewide"
        : "Ohio statewide",
      electionYear: agent.profile.electionDate.slice(0, 4),
      raceType: resolveRaceType(agent.profile.office),
      campaignStatus: "Prebuilt AI agent ready",
      status: "source_backed",
      sourceNote:
        "Uses the existing HomeReach prebuilt candidate-agent profile and source list.",
      portrait:
        candidateHeadshot(agent.profile.id, agent.profile.candidateName) ??
        agent.profile.portrait,
      agent,
    }),
  );

const OFFICIAL_STATEWIDE_WORKSPACES: StrategySelectionCandidate[] = [
  officialWorkspace("ron-kincaid", "Ron Kincaid", "U.S. Senate", "Democrat"),
  officialWorkspace("heather-hill", "Heather Hill", "Governor of Ohio", "Republican"),
  officialWorkspace("stuart-moats", "Stuart Moats", "Lieutenant Governor", "Republican"),
  officialWorkspace("don-kissick", "Don Kissick", "Governor of Ohio", "Libertarian"),
  officialWorkspace("casey-putsch", "Casey Putsch", "Governor of Ohio", "Republican"),
  officialWorkspace("kimberly-georgeton", "Kimberly C. Georgeton", "Lieutenant Governor", "Republican"),
  officialWorkspace("elliott-forhan", "Elliott Forhan", "Attorney General", "Democrat"),
  officialWorkspace("bryan-hambley", "Bryan Hambley", "Secretary of State", "Democrat"),
  officialWorkspace("tom-pruss", "Tom Pruss", "Secretary of State", "Libertarian"),
  officialWorkspace("marcell-strbich", "Marcell Strbich", "Secretary of State", "Republican"),
  officialWorkspace("annette-blackwell", "Annette Blackwell", "Auditor of State", "Democrat"),
  officialWorkspace("jay-edwards", "Jay Edwards", "Treasurer of State", "Republican"),
  officialWorkspace("kristina-roegner", "Kristina Roegner", "Treasurer of State", "Republican"),
  officialWorkspace("seth-walsh", "Seth Walsh", "Treasurer of State", "Democrat"),
  officialWorkspace("daniel-hawkins", "Daniel Hawkins", "Ohio Supreme Court", "Republican"),
  officialWorkspace("marilyn-zayas", "Marilyn Zayas", "Ohio Supreme Court", "Democrat"),
  officialWorkspace("andrew-king", "Andrew King", "Ohio Supreme Court", "Republican"),
  officialWorkspace("jill-lanzinger", "Jill Lanzinger", "Ohio Supreme Court", "Republican"),
  officialWorkspace("ronald-lewis", "Ronald Lewis", "Ohio Supreme Court", "Republican"),
  officialWorkspace("colleen-odonnell", "Colleen O'Donnell", "Ohio Supreme Court", "Republican"),
];

const PRIORITY_REPUBLICAN_WORKSPACES: StrategySelectionCandidate[] = [
  workspace("jd-vance", "JD Vance", "U.S. Senate / National", "Republican", "Ohio", "Statewide", "Ohio statewide", "2026", "Statewide", "Priority public-profile agent workspace"),
  workspace("mike-dewine", "Mike DeWine", "Governor", "Republican", "Ohio", "Statewide", "Ohio statewide", "2026", "Statewide", "Priority public-profile agent workspace"),
  workspace("dave-yost", "Dave Yost", "Attorney General", "Republican", "Ohio", "Statewide", "Ohio statewide", "2026", "Statewide", "Priority public-profile agent workspace"),
  workspace("frank-larose", "Frank LaRose", "Secretary of State", "Republican", "Ohio", "Statewide", "Ohio statewide", "2026", "Statewide", "Priority public-profile agent workspace"),
  workspace("jon-husted", "Jon Husted", "Statewide Campaign", "Republican", "Ohio", "Statewide", "Ohio statewide", "2026", "Statewide", "Prebuilt AI agent ready"),
  workspace("keith-faber", "Keith Faber", "Attorney General", "Republican", "Ohio", "Statewide", "Ohio statewide", "2026", "Statewide", "Prebuilt AI agent ready"),
  workspace("robert-sprague", "Robert Sprague", "Secretary of State", "Republican", "Ohio", "Statewide", "Ohio statewide", "2026", "Statewide", "Prebuilt AI agent ready"),
  workspace("vivek-ramaswamy", "Vivek Ramaswamy", "Governor of Ohio", "Republican", "Ohio", "Statewide", "Ohio statewide", "2026", "Statewide", "Prebuilt AI agent ready"),
  workspace("bernie-moreno", "Bernie Moreno", "U.S. Senate", "Republican", "Ohio", "Statewide", "Federal statewide", "2026", "Federal", "Priority public-profile agent workspace"),
  workspace("jim-jordan", "Jim Jordan", "U.S. House", "Republican", "Western / North Central Ohio", "Allen", "Ohio Congressional District 4", "2026", "Federal", "Priority public-profile agent workspace"),
  workspace("warren-davidson", "Warren Davidson", "U.S. House", "Republican", "Western Ohio", "Butler", "Ohio Congressional District 8", "2026", "Federal", "Priority public-profile agent workspace"),
  workspace("bob-latta", "Bob Latta", "U.S. House", "Republican", "Northwest Ohio", "Wood", "Ohio Congressional District 5", "2026", "Federal", "Priority public-profile agent workspace"),
  workspace("troy-balderson", "Troy Balderson", "U.S. House", "Republican", "Central / Eastern Ohio", "Licking", "Ohio Congressional District 12", "2026", "Federal", "Priority public-profile agent workspace"),
  workspace("mike-carey", "Mike Carey", "U.S. House", "Republican", "Central Ohio", "Franklin", "Ohio Congressional District 15", "2026", "Federal", "Priority public-profile agent workspace"),
  workspace("max-miller", "Max Miller", "U.S. House", "Republican", "Northeast Ohio", "Cuyahoga", "Ohio Congressional District 7", "2026", "Federal", "Priority public-profile agent workspace"),
  workspace("dave-joyce", "Dave Joyce", "U.S. House", "Republican", "Northeast Ohio", "Geauga", "Ohio Congressional District 14", "2026", "Federal", "Priority public-profile agent workspace"),
  workspace("michael-rulli", "Michael Rulli", "U.S. House", "Republican", "Mahoning Valley / Eastern Ohio", "Mahoning", "Ohio Congressional District 6", "2026", "Federal", "Priority public-profile agent workspace"),
  workspace("mike-turner", "Mike Turner", "U.S. House", "Republican", "Dayton / Miami Valley", "Montgomery", "Ohio Congressional District 10", "2026", "Federal", "Priority public-profile agent workspace"),
  workspace("steve-stivers", "Steve Stivers", "Statewide / Central Ohio", "Republican", "Ohio", "Franklin", "Ohio campaign geography", "2026", "Statewide", "Priority public-profile agent workspace"),
  workspace("jane-timken", "Jane Timken", "Statewide / Party Leadership", "Republican", "Ohio", "Statewide", "Ohio statewide", "2026", "Statewide", "Priority public-profile agent workspace"),
  workspace("matt-dolan", "Matt Dolan", "Statewide / Legislative", "Republican", "Ohio", "Cuyahoga", "Ohio campaign geography", "2026", "Statewide", "Priority public-profile agent workspace"),
  workspace("matt-huffman", "Matt Huffman", "State Legislative", "Republican", "Western Ohio", "Allen", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("rob-mccolley", "Rob McColley", "State Legislative", "Republican", "Northwest Ohio", "Henry", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("theresa-gavarone", "Theresa Gavarone", "State Legislative", "Republican", "Northwest Ohio", "Wood", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("brian-stewart", "Brian Stewart", "State Legislative", "Republican", "Central / Southern Ohio", "Pickaway", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("jason-stephens", "Jason Stephens", "State Legislative", "Republican", "Southern Ohio", "Lawrence", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("sharon-kennedy", "Sharon Kennedy", "Ohio Supreme Court", "Republican", "Ohio", "Statewide", "Ohio statewide", "2026", "Judicial", "Priority public-profile agent workspace"),
  workspace("pat-dewine", "Pat DeWine", "Ohio Supreme Court", "Republican", "Ohio", "Statewide", "Ohio statewide", "2026", "Judicial", "Priority public-profile agent workspace"),
  workspace("pat-fischer", "Pat Fischer", "Ohio Supreme Court", "Republican", "Ohio", "Statewide", "Ohio statewide", "2026", "Judicial", "Priority public-profile agent workspace"),
  workspace("frank-hoagland", "Frank Hoagland", "State Legislative", "Republican", "Eastern Ohio", "Belmont", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
];

const PRIORITY_DEMOCRATIC_WORKSPACES: StrategySelectionCandidate[] = [
  workspace("sherrod-brown", "Sherrod Brown", "U.S. Senate", "Democrat", "Ohio", "Statewide", "Federal statewide", "2026", "Federal", "Prebuilt AI agent ready"),
  workspace("amy-acton", "Amy Acton", "Governor of Ohio", "Democrat", "Ohio", "Statewide", "Ohio statewide", "2026", "Statewide", "Prebuilt AI agent ready"),
  workspace("allison-russo", "Allison Russo", "Statewide / Legislative", "Democrat", "Ohio", "Franklin", "Ohio campaign geography", "2026", "Statewide", "Prebuilt AI agent ready"),
  workspace("john-kulewicz", "John Kulewicz", "Attorney General", "Democrat", "Ohio", "Statewide", "Ohio statewide", "2026", "Statewide", "Prebuilt AI agent ready"),
  workspace("joyce-beatty", "Joyce Beatty", "U.S. House", "Democrat", "Franklin County", "Franklin", "Ohio Congressional District 3", "2026", "Federal", "Priority public-profile agent workspace"),
  workspace("marcy-kaptur", "Marcy Kaptur", "U.S. House", "Democrat", "Northwest Ohio", "Lucas", "Ohio Congressional District 9", "2026", "Federal", "Priority public-profile agent workspace"),
  workspace("emilia-sykes", "Emilia Sykes", "U.S. House", "Democrat", "Akron / Northeast Ohio", "Summit", "Ohio Congressional District 13", "2026", "Federal", "Priority public-profile agent workspace"),
  workspace("greg-landsman", "Greg Landsman", "U.S. House", "Democrat", "Cincinnati / Southwest Ohio", "Hamilton", "Ohio Congressional District 1", "2026", "Federal", "Priority public-profile agent workspace"),
  workspace("shontel-brown", "Shontel Brown", "U.S. House", "Democrat", "Cleveland / Cuyahoga County", "Cuyahoga", "Ohio Congressional District 11", "2026", "Federal", "Priority public-profile agent workspace"),
  workspace("tim-ryan", "Tim Ryan", "Statewide / Northeast Ohio", "Democrat", "Ohio", "Trumbull", "Ohio campaign geography", "2026", "Statewide", "Priority public-profile agent workspace"),
  workspace("nan-whaley", "Nan Whaley", "Statewide / Dayton", "Democrat", "Ohio", "Montgomery", "Ohio campaign geography", "2026", "Statewide", "Priority public-profile agent workspace"),
  workspace("aftab-pureval", "Aftab Pureval", "Mayor", "Democrat", "Cincinnati", "Hamilton", "Citywide", "2025", "Mayoral", "Priority public-profile agent workspace"),
  workspace("justin-bibb", "Justin Bibb", "Mayor", "Democrat", "Cleveland", "Cuyahoga", "Citywide", "2025", "Mayoral", "Priority public-profile agent workspace"),
  workspace("david-pepper", "David Pepper", "Statewide / Party Leadership", "Democrat", "Ohio", "Hamilton", "Ohio campaign geography", "2026", "Statewide", "Priority public-profile agent workspace"),
  workspace("richard-cordray", "Richard Cordray", "Statewide", "Democrat", "Ohio", "Statewide", "Ohio statewide", "2026", "Statewide", "Priority public-profile agent workspace"),
  workspace("kathleen-clyde", "Kathleen Clyde", "Statewide / Legislative", "Democrat", "Ohio", "Portage", "Ohio campaign geography", "2026", "Statewide", "Priority public-profile agent workspace"),
  workspace("jennifer-brunner", "Jennifer Brunner", "Ohio Supreme Court", "Democrat", "Ohio", "Statewide", "Ohio statewide", "2026", "Judicial", "Priority public-profile agent workspace"),
  workspace("melody-stewart", "Melody Stewart", "Ohio Supreme Court", "Democrat", "Ohio", "Statewide", "Ohio statewide", "2026", "Judicial", "Priority public-profile agent workspace"),
  workspace("nickie-antonio", "Nickie Antonio", "State Legislative", "Democrat", "Northeast Ohio", "Cuyahoga", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("paula-hicks-hudson", "Paula Hicks-Hudson", "State Legislative", "Democrat", "Northwest Ohio", "Lucas", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("cecil-thomas", "Cecil Thomas", "State Legislative", "Democrat", "Cincinnati / Southwest Ohio", "Hamilton", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("casey-weinstein", "Casey Weinstein", "State Legislative", "Democrat", "Northeast Ohio", "Summit", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("bride-rose-sweeney", "Bride Rose Sweeney", "State Legislative", "Democrat", "Northeast Ohio", "Cuyahoga", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("dani-isaacsohn", "Dani Isaacsohn", "State Legislative", "Democrat", "Cincinnati / Southwest Ohio", "Hamilton", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("dontavius-jarrells", "Dontavius Jarrells", "State Legislative", "Democrat", "Central Ohio", "Franklin", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("anita-somani", "Anita Somani", "State Legislative", "Democrat", "Central Ohio", "Franklin", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("beryl-brown-piccolantonio", "Beryl Brown Piccolantonio", "State Legislative", "Democrat", "Central Ohio", "Franklin", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("michele-grim", "Michele Grim", "State Legislative", "Democrat", "Northwest Ohio", "Lucas", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("jessica-miranda", "Jessica Miranda", "State Legislative", "Democrat", "Southwest Ohio", "Hamilton", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
  workspace("sean-patrick-brennan", "Sean Patrick Brennan", "State Legislative", "Democrat", "Northeast Ohio", "Cuyahoga", "Ohio legislative geography", "2026", "Legislative", "Priority public-profile agent workspace"),
];

const ADDITIONAL_WORKSPACES: StrategySelectionCandidate[] = [
  workspace(
    "frank-larose",
    "Frank LaRose",
    "Secretary of State",
    "Republican",
    "Ohio",
    "Franklin",
    "Ohio statewide",
    "2026",
    "Statewide",
    "Source verification needed",
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Frank_LaRose_by_Gage_Skidmore.jpg/960px-Frank_LaRose_by_Gage_Skidmore.jpg",
      alt: "Frank LaRose public portrait",
      sourceLabel: "Wikimedia Commons public portrait",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Frank_LaRose_by_Gage_Skidmore.jpg",
      approvalStatus: "source_linked_review_required",
      notes:
        "Public source-linked portrait. Human review is required before using in paid creative, proposals, or production artwork.",
    },
  ),
  workspace(
    "columbus-mayor",
    "Columbus Mayor Program",
    "Mayor",
    "Nonpartisan/local",
    "Columbus",
    "Franklin",
    "Citywide",
    "2027",
    "Mayoral",
    "Campaign workspace",
  ),
  workspace(
    "cleveland-mayor",
    "Cleveland Mayor Program",
    "Mayor",
    "Nonpartisan/local",
    "Cleveland",
    "Cuyahoga",
    "Citywide",
    "2025",
    "Mayoral",
    "Campaign workspace",
  ),
  workspace(
    "cincinnati-mayor",
    "Cincinnati Mayor Program",
    "Mayor",
    "Nonpartisan/local",
    "Cincinnati",
    "Hamilton",
    "Citywide",
    "2025",
    "Mayoral",
    "Campaign workspace",
  ),
  workspace(
    "toledo-mayor",
    "Toledo Mayor Program",
    "Mayor",
    "Nonpartisan/local",
    "Toledo",
    "Lucas",
    "Citywide",
    "2025",
    "Mayoral",
    "Campaign workspace",
  ),
  workspace(
    "akron-mayor",
    "Akron Mayor Program",
    "Mayor",
    "Nonpartisan/local",
    "Akron",
    "Summit",
    "Citywide",
    "2027",
    "Mayoral",
    "Campaign workspace",
  ),
  workspace(
    "dayton-mayor",
    "Dayton Mayor Program",
    "Mayor",
    "Nonpartisan/local",
    "Dayton",
    "Montgomery",
    "Citywide",
    "2025",
    "Mayoral",
    "Campaign workspace",
  ),
  workspace(
    "franklin-county-commissioner",
    "Franklin County Commissioner Program",
    "County Commissioner",
    "Local",
    "Franklin County",
    "Franklin",
    "Countywide",
    "2026",
    "County",
    "Campaign workspace",
  ),
  workspace(
    "cuyahoga-county-judicial",
    "Cuyahoga County Judicial Program",
    "Judicial",
    "Nonpartisan/local",
    "Cuyahoga County",
    "Cuyahoga",
    "Countywide",
    "2026",
    "Judicial",
    "Campaign workspace",
  ),
  workspace(
    "hamilton-county-commissioner",
    "Hamilton County Commissioner Program",
    "County Commissioner",
    "Local",
    "Hamilton County",
    "Hamilton",
    "Countywide",
    "2026",
    "County",
    "Campaign workspace",
  ),
  workspace(
    "summit-county-executive",
    "Summit County Executive Program",
    "County Executive",
    "Local",
    "Summit County",
    "Summit",
    "Countywide",
    "2026",
    "County",
    "Campaign workspace",
  ),
  workspace(
    "lucas-county-commissioner",
    "Lucas County Commissioner Program",
    "County Commissioner",
    "Local",
    "Lucas County",
    "Lucas",
    "Countywide",
    "2026",
    "County",
    "Campaign workspace",
  ),
  workspace(
    "delaware-legislative",
    "Delaware County Legislative Program",
    "State Legislative",
    "Local",
    "Delaware County",
    "Delaware",
    "State House/Senate",
    "2026",
    "Legislative",
    "Campaign workspace",
  ),
  workspace(
    "stark-county-judicial",
    "Stark County Judicial Program",
    "Judicial",
    "Nonpartisan/local",
    "Stark County",
    "Stark",
    "Countywide",
    "2026",
    "Judicial",
    "Campaign workspace",
  ),
  workspace(
    "mahoning-valley-legislative",
    "Mahoning Valley Legislative Program",
    "State Legislative",
    "Local",
    "Mahoning Valley",
    "Mahoning",
    "State House/Senate",
    "2026",
    "Legislative",
    "Campaign workspace",
  ),
  workspace(
    "lorain-school-board",
    "Lorain County School Board Program",
    "School Board",
    "Nonpartisan/local",
    "Lorain County",
    "Lorain",
    "School district",
    "2025",
    "School Board",
    "Campaign workspace",
  ),
  workspace(
    "warren-township",
    "Warren County Township Program",
    "Township Trustee",
    "Nonpartisan/local",
    "Warren County",
    "Warren",
    "Township",
    "2025",
    "Township",
    "Campaign workspace",
  ),
  workspace(
    "butler-legislative",
    "Butler County Legislative Program",
    "State Legislative",
    "Local",
    "Butler County",
    "Butler",
    "State House/Senate",
    "2026",
    "Legislative",
    "Campaign workspace",
  ),
  workspace(
    "ohio-house-battleground",
    "Ohio House Battleground Program",
    "State House",
    "Coordinated",
    "Ohio",
    "Multiple",
    "Priority House districts",
    "2026",
    "Legislative",
    "Campaign workspace",
  ),
  workspace(
    "ohio-senate-battleground",
    "Ohio Senate Battleground Program",
    "State Senate",
    "Coordinated",
    "Ohio",
    "Multiple",
    "Priority Senate districts",
    "2026",
    "Legislative",
    "Campaign workspace",
  ),
  workspace(
    "joyce-beatty",
    "Joyce Beatty",
    "U.S. House",
    "Campaign",
    "Franklin County",
    "Franklin",
    "Ohio Congressional District 3",
    "2026",
    "Federal",
    "Outreach workspace",
  ),
  workspace(
    "joe-gerard",
    "Joe Gerard",
    "U.S. House",
    "Campaign",
    "Franklin County",
    "Franklin",
    "Ohio Congressional District 3",
    "2026",
    "Federal",
    "Outreach workspace",
  ),
  workspace(
    "don-leonard",
    "Don Leonard",
    "U.S. House",
    "Campaign",
    "Franklin County",
    "Franklin",
    "Ohio Congressional District 3",
    "2026",
    "Federal",
    "Outreach workspace",
  ),
  workspace(
    "jesse-baker",
    "Jesse Baker",
    "Ohio Campaign",
    "Campaign",
    "Franklin County",
    "Franklin",
    "Ohio campaign geography",
    "2026",
    "Local",
    "Outreach workspace",
  ),
  workspace(
    "beryl-brown-piccolantonio",
    "Beryl Brown Piccolantonio",
    "Ohio Campaign",
    "Campaign",
    "Franklin County",
    "Franklin",
    "Ohio campaign geography",
    "2026",
    "Local",
    "Outreach workspace",
  ),
  workspace(
    "christine-cockley",
    "Christine Cockley",
    "Ohio Campaign",
    "Campaign",
    "Franklin County",
    "Franklin",
    "Ohio campaign geography",
    "2026",
    "Local",
    "Outreach workspace",
  ),
  workspace(
    "ukeme-awakessien-jeter",
    "Ukeme Awakessien Jeter",
    "Ohio Campaign",
    "Campaign",
    "Franklin County",
    "Franklin",
    "Ohio campaign geography",
    "2026",
    "Local",
    "Outreach workspace",
  ),
  workspace(
    "michaela-burriss",
    "Michaela Burriss",
    "Ohio Campaign",
    "Campaign",
    "Franklin County",
    "Franklin",
    "Ohio campaign geography",
    "2026",
    "Local",
    "Outreach workspace",
  ),
  workspace(
    "zach-rossfeld",
    "Zach Rossfeld",
    "Ohio Campaign",
    "Campaign",
    "Franklin County",
    "Franklin",
    "Ohio campaign geography",
    "2026",
    "Local",
    "Outreach workspace",
  ),
  workspace(
    "anita-somani",
    "Anita Somani",
    "Ohio Campaign",
    "Campaign",
    "Franklin County",
    "Franklin",
    "Ohio campaign geography",
    "2026",
    "Local",
    "Outreach workspace",
  ),
];

const LAKE_COUNTY_2026_SOURCE: CandidateVerificationSource = {
  label: "Lake County BOE candidate filings",
  url: "https://wpassets.lakecountyohio.gov/wp-content/uploads/sites/12/2026/03/30144825/2026-Candidate-Filings.pdf",
  publishedAt: "2026-03-30",
  note: "Official Lake County Board of Elections May 5, 2026 primary candidate filing list.",
};

const ASHTABULA_COUNTY_2026_SOURCE: CandidateVerificationSource = {
  label: "Ashtabula County BOE candidate list",
  url: "https://www.boe.ohio.gov/ashtabula/c/upload/Election_Candidates.pdf",
  publishedAt: "2026-05-05",
  note: "Official Ashtabula County Board of Elections candidate list reference.",
};

const LORAIN_COUNTY_2026_SOURCE: CandidateVerificationSource = {
  label: "Lorain County BOE candidate list",
  url: "https://www.voteloraincountyohio.gov/_files/ugd/2568d0_084e43e27256471584dd8fad210539a8.pdf",
  publishedAt: "2026-03-19",
  note: "Official Lorain County Board of Elections May 5, 2026 primary candidate list.",
};

const PORTAGE_COUNTY_2026_SOURCE: CandidateVerificationSource = {
  label: "Portage County BOE FWAB candidate notice",
  url: "https://www.portagecounty-oh.gov/board-elections/files/46-day-notice-42326",
  publishedAt: "2026-03-20",
  note: "Official Portage County Board of Elections 46-day FWAB candidate notice.",
};

const MAHONING_COUNTY_2026_SOURCE: CandidateVerificationSource = {
  label: "Mahoning County BOE candidate list",
  url: "https://vote.mahoningcountyoh.gov/DocumentCenter/View/2609/Primary-Election-May-5",
  publishedAt: "2026-03-01",
  note: "Official Mahoning County Board of Elections May 5, 2026 primary candidate list.",
};

const TRUMBULL_COUNTY_2026_DEM_SOURCE: CandidateVerificationSource = {
  label: "Trumbull County BOE Democratic filings",
  url: "https://boe.co.trumbull.oh.gov/pdfs/DEM%20CAND%20FILINGS%20MAY%2026.pdf",
  publishedAt: "2026-05-05",
  note: "Official Trumbull County Board of Elections Democratic candidate filing list.",
};

const TRUMBULL_COUNTY_2026_GOP_SOURCE: CandidateVerificationSource = {
  label: "Trumbull County BOE Republican filings",
  url: "https://boe.co.trumbull.oh.gov/pdfs/REP%20CAND%20FILINGS%20MAY%2026.pdf",
  publishedAt: "2026-05-05",
  note: "Official Trumbull County Board of Elections Republican candidate filing list.",
};

const SUMMIT_COUNTY_2026_SOURCE: CandidateVerificationSource = {
  label: "Summit County BOE filing list",
  url: "https://www.boe.ohio.gov/summit/c/upload/Election_CandidateFilingsDeadline.pdf",
  publishedAt: "2026-02-04",
  note: "Official Summit County Board of Elections candidate filing deadline list.",
};

const GEAUGA_COUNTY_2026_SOURCE: CandidateVerificationSource = {
  label: "Geauga County BOE candidate list",
  url: "https://www.boe.ohio.gov/geauga/c/upload/Election_CandidateList.pdf",
  publishedAt: "2026-05-05",
  note: "Official Geauga County Board of Elections candidate list.",
};

const CUYAHOGA_COUNTY_2026_SOURCE: CandidateVerificationSource = {
  label: "Cuyahoga County BOE candidate list",
  url: "https://boe.cuyahogacounty.gov/docs/default-source/boe/candidates-page/candidate-list.pdf?sfvrsn=4b1792c0_658",
  publishedAt: "2026-05-05",
  note: "Official Cuyahoga County Board of Elections May 5, 2026 primary candidate list.",
};

const NORTHEAST_OHIO_LOCAL_WORKSPACES: StrategySelectionCandidate[] = [
  sourceBackedLocalWorkspace("john-t-plecnik", "John T. Plecnik", "County Commissioner", "Republican", "Lake County", "Lake", "Countywide", LAKE_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("tom-trombley", "Tom Trombley", "County Commissioner", "Democrat", "Lake County", "Lake", "Countywide", LAKE_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("lisa-lewins", "Lisa Lewins", "County Commissioner", "Democrat", "Lake County", "Lake", "Countywide", LAKE_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("morgan-r-mcintosh", "Morgan R. McIntosh", "County Commissioner", "Republican", "Lake County", "Lake", "Countywide", LAKE_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("jayson-robert-t-noscal", "Jayson-Robert T. Noscal", "County Commissioner", "Democrat", "Ashtabula County", "Ashtabula", "Countywide", ASHTABULA_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("casey-kozlowski", "Casey Kozlowski", "County Commissioner", "Republican", "Ashtabula County", "Ashtabula", "Countywide", ASHTABULA_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("oakey-l-emery", "Oakey L. Emery", "County Auditor", "Democrat", "Ashtabula County", "Ashtabula", "Countywide", ASHTABULA_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("scott-yamamoto", "Scott Yamamoto", "County Auditor", "Republican", "Ashtabula County", "Ashtabula", "Countywide", ASHTABULA_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("brian-a-baker", "Brian A. Baker", "County Commissioner", "Democrat", "Lorain County", "Lorain", "Countywide", LORAIN_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("carolyn-y-white", "Carolyn Y. White", "County Commissioner", "Democrat", "Lorain County", "Lorain", "Countywide", LORAIN_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("jeff-riddell", "Jeff Riddell", "County Commissioner", "Republican", "Lorain County", "Lorain", "Countywide", LORAIN_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("will-schlechter", "Will Schlechter", "County Commissioner", "Republican", "Lorain County", "Lorain", "Countywide", LORAIN_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("elaine-m-seguin", "Elaine M. Seguin", "County Auditor", "Republican", "Lorain County", "Lorain", "Countywide", LORAIN_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("craig-snodgrass", "Craig Snodgrass", "County Auditor", "Democrat", "Lorain County", "Lorain", "Countywide", LORAIN_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("jenny-d-adams", "Jenny D. Adams", "County Commissioner", "Democrat", "Portage County", "Portage", "Countywide", PORTAGE_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("mike-tinlin", "Mike Tinlin", "County Commissioner", "Republican", "Portage County", "Portage", "Countywide", PORTAGE_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("lauren-mcnally", "Lauren McNally", "County Commissioner", "Democrat", "Mahoning County", "Mahoning", "Countywide", MAHONING_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("don-dragish", "Don Dragish", "County Commissioner", "Republican", "Mahoning County", "Mahoning", "Countywide", MAHONING_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("christine-oliver", "Christine Oliver", "County Commissioner", "Republican", "Mahoning County", "Mahoning", "Countywide", MAHONING_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("bruce-shepas", "Bruce Shepas", "County Commissioner", "Republican", "Mahoning County", "Mahoning", "Countywide", MAHONING_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("ralph-t-meacham", "Ralph T. Meacham", "County Auditor", "Republican", "Mahoning County", "Mahoning", "Countywide", MAHONING_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("dalton-bosze", "Dalton Bosze", "County Auditor", "Democrat", "Mahoning County", "Mahoning", "Countywide", MAHONING_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("kristen-f-rock", "Kristen F. Rock", "County Commissioner", "Democrat", "Trumbull County", "Trumbull", "Countywide", TRUMBULL_COUNTY_2026_DEM_SOURCE),
  sourceBackedLocalWorkspace("michael-j-hovis", "Michael J. Hovis", "County Commissioner", "Republican", "Trumbull County", "Trumbull", "Countywide", TRUMBULL_COUNTY_2026_GOP_SOURCE),
  sourceBackedLocalWorkspace("denny-malloy", "Denny Malloy", "County Commissioner", "Republican", "Trumbull County", "Trumbull", "Countywide", TRUMBULL_COUNTY_2026_GOP_SOURCE),
  sourceBackedLocalWorkspace("edward-d-stredney", "Edward D. Stredney", "County Auditor", "Democrat", "Trumbull County", "Trumbull", "Countywide", TRUMBULL_COUNTY_2026_DEM_SOURCE),
  sourceBackedLocalWorkspace("tom-letson", "Tom Letson", "County Auditor", "Democrat", "Trumbull County", "Trumbull", "Countywide", TRUMBULL_COUNTY_2026_DEM_SOURCE),
  sourceBackedLocalWorkspace("mike-loychik", "Mike Loychik", "County Auditor", "Republican", "Trumbull County", "Trumbull", "Countywide", TRUMBULL_COUNTY_2026_GOP_SOURCE),
  sourceBackedLocalWorkspace("stacy-a-marling", "Stacy A. Marling", "County Auditor", "Republican", "Trumbull County", "Trumbull", "Countywide", TRUMBULL_COUNTY_2026_GOP_SOURCE),
  sourceBackedLocalWorkspace("martha-yoder", "Martha Yoder", "County Auditor", "Republican", "Trumbull County", "Trumbull", "Countywide", TRUMBULL_COUNTY_2026_GOP_SOURCE),
  sourceBackedLocalWorkspace("shane-r-barker", "Shane R. Barker", "County Council At-Large", "Republican", "Summit County", "Summit", "Countywide", SUMMIT_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("erin-dickinson", "Erin Dickinson", "County Council At-Large", "Democrat", "Summit County", "Summit", "Countywide", SUMMIT_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("elizabeth-walters", "Elizabeth Walters", "County Council At-Large", "Democrat", "Summit County", "Summit", "Countywide", SUMMIT_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("jim-dvorak", "Jim Dvorak", "County Commissioner", "Republican", "Geauga County", "Geauga", "Countywide", GEAUGA_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("steven-oluic", "Steven Oluic", "County Commissioner", "Republican", "Geauga County", "Geauga", "Countywide", GEAUGA_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("joe-deboth", "Joe DeBoth", "County Auditor", "Republican", "Geauga County", "Geauga", "Countywide", GEAUGA_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("charles-e-walder", "Charles E. Walder", "County Auditor", "Republican", "Geauga County", "Geauga", "Countywide", GEAUGA_COUNTY_2026_SOURCE),
  sourceBackedLocalWorkspace("chris-ronayne", "Chris Ronayne", "County Executive", "Democrat", "Cuyahoga County", "Cuyahoga", "Countywide", CUYAHOGA_COUNTY_2026_SOURCE),
];

export const STRATEGY_SELECTION_CANDIDATES: StrategySelectionCandidate[] = [
  ...uniqueStrategyCandidates([
    ...EXISTING_CANDIDATES,
    ...OFFICIAL_STATEWIDE_WORKSPACES,
    ...PRIORITY_REPUBLICAN_WORKSPACES,
    ...PRIORITY_DEMOCRATIC_WORKSPACES,
    ...NORTHEAST_OHIO_LOCAL_WORKSPACES,
    ...ADDITIONAL_WORKSPACES,
  ]).map(applyOfficialVerification),
];

export type PublicCampaignCandidateRecord = {
  id: string;
  candidateName: string;
  officeSought: string | null;
  state: string | null;
  geographyType: string | null;
  geographyValue: string | null;
  districtType: string | null;
  candidateStatus: string | null;
  electionDate: string | null;
  electionYear: number | null;
  partyOptionalPublic: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  dataVerifiedAt: string | null;
  priorityScore: number | null;
};

export function strategyCandidateFromPublicRecord(
  record: PublicCampaignCandidateRecord,
): StrategySelectionCandidate {
  const office = record.officeSought?.trim() || "Campaign office to verify";
  const state = record.state?.trim() || "OH";
  const geographyType = record.geographyType?.trim().toLowerCase() || "state";
  const geographyValue = record.geographyValue?.trim() || state;
  const county = countyFromPublicRecord(record);
  const electionYear =
    record.electionYear?.toString() ??
    (record.electionDate ? record.electionDate.slice(0, 4) : "2026");
  const raceType = raceTypeFromPublicRecord(record, office);
  const verificationSources =
    record.sourceUrl && record.sourceUrl.startsWith("http")
      ? [
          {
            label: sourceLabelForPublicRecord(record),
            url: record.sourceUrl,
            publishedAt:
              record.dataVerifiedAt?.slice(0, 10) ??
              record.electionDate ??
              `${electionYear}-01-01`,
            note:
              "Public candidate source attached from the HomeReach admin candidate registry. Human review is required before outreach, proposal, creative, payment, or production.",
          },
        ]
      : undefined;

  return {
    id: `candidate-${record.id}`,
    candidateName: record.candidateName,
    office,
    party: record.partyOptionalPublic?.trim() || "Campaign",
    geography: geographyLabelForPublicRecord(
      geographyType,
      geographyValue,
      state,
    ),
    county,
    district: districtLabelForPublicRecord(record, geographyType, geographyValue),
    electionYear,
    raceType,
    campaignStatus: "Public-safe admin roster AI agent assigned",
    status: verificationSources ? "source_backed" : "admin_review",
    sourceNote: verificationSources
      ? "Loaded from the HomeReach admin candidate registry with a public source attached. The AI political planning agent can prepare four options, but all public history, platform claims, geography, USPS counts, pricing, and creative require human approval."
      : "Loaded from the HomeReach admin candidate registry. Source verification is still required before client-facing use, outreach, proposal, payment, or production.",
    verificationSources,
    portrait: candidateHeadshot(record.id, record.candidateName),
  };
}

export function mergeStrategySelectionCandidates(
  candidates: StrategySelectionCandidate[],
): StrategySelectionCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const identityKey = [
      normalizeCandidateLookup(candidate.candidateName),
      normalizeCandidateLookup(candidate.office),
      normalizeCandidateLookup(candidate.district),
    ].join("|");
    const idKey = normalizeCandidateLookup(candidate.id);
    if (seen.has(idKey) || seen.has(identityKey)) return false;
    seen.add(idKey);
    seen.add(identityKey);
    return true;
  });
}

export function getDefaultStrategySelectionCandidateId() {
  return "amy-acton";
}

export function getStrategySelectionCandidate(candidateId: string) {
  return (
    STRATEGY_SELECTION_CANDIDATES.find(
      (candidate) => candidate.id === candidateId,
    ) ??
    STRATEGY_SELECTION_CANDIDATES.find(
      (candidate) => candidate.id === getDefaultStrategySelectionCandidateId(),
    ) ??
    STRATEGY_SELECTION_CANDIDATES[0]!
  );
}

export function findStrategySelectionCandidate(candidateIdOrName: string) {
  const normalized = normalizeCandidateLookup(candidateIdOrName);
  return STRATEGY_SELECTION_CANDIDATES.find(
    (candidate) =>
      normalizeCandidateLookup(candidate.id) === normalized ||
      normalizeCandidateLookup(candidate.candidateName) === normalized,
  );
}

export function buildCustomStrategySelectionCandidate(
  rawName: string,
): StrategySelectionCandidate {
  const candidateName = titleizeCandidateName(rawName);
  const id = `custom-${slugifyCandidate(candidateName || "campaign")}`;

  return {
    id,
    candidateName: candidateName || "New Campaign",
    office: "Campaign office to verify",
    party: "Campaign",
    geography: "Ohio",
    county: "Statewide",
    district: "Ohio campaign geography",
    electionYear: "2026",
    raceType: "Statewide",
    campaignStatus: "AI-generated intake workspace",
    status: "admin_review",
    sourceNote:
      "AI-generated intake workspace. Public candidate history, platform, filings, geography, contacts, and route assumptions must be researched and verified before client-facing use.",
  };
}

export function buildStrategySelectionPlans(
  candidate: StrategySelectionCandidate,
): StrategySelectionPlan[] {
  if (candidate.agent) {
    return candidate.agent.strategies
      .slice(0, 4)
      .map((strategy, index) =>
        fromExistingStrategy(candidate, strategy, index),
      );
  }

  return buildWorkspacePlans(candidate);
}

function workspace(
  id: string,
  candidateName: string,
  office: string,
  party: string,
  geography: string,
  county: string,
  district: string,
  electionYear: string,
  raceType: string,
  campaignStatus: string,
  portrait?: CandidatePortraitAsset,
): StrategySelectionCandidate {
  return {
    id,
    candidateName,
    office,
    party,
    geography,
    county,
    district,
    electionYear,
    raceType,
    campaignStatus,
    status: "needs_source_verification",
    sourceNote:
      "Prebuilt campaign workspace. Candidate/contact/platform/source details must be verified before proposal, checkout, creative approval, or production.",
    portrait: portrait ?? candidateHeadshot(id, candidateName),
  };
}

function sourceBackedLocalWorkspace(
  id: string,
  candidateName: string,
  office: string,
  party: string,
  geography: string,
  county: string,
  district: string,
  source: CandidateVerificationSource,
): StrategySelectionCandidate {
  return {
    ...workspace(
      id,
      candidateName,
      office,
      party,
      geography,
      county,
      district,
      "2026",
      resolveRaceType(office),
      "Source-backed local campaign AI agent assigned",
    ),
    status: "source_backed",
    sourceNote:
      "Source-backed Northeast Ohio local campaign workspace. The Campaign AI Agent can prepare four aggregate-geography mail options; candidate history, platform, claims, USPS counts, pricing, and creative still require human review.",
    verificationSources: [source],
  };
}

function officialWorkspace(
  id: string,
  candidateName: string,
  office: string,
  party: string,
) {
  return applyOfficialVerification(
    workspace(
      id,
      candidateName,
      office,
      party,
      "Ohio",
      "Statewide",
      office.includes("U.S.") ? "Federal statewide" : "Ohio statewide",
      "2026",
      resolveRaceType(office),
      "Official 2026 statewide candidate source linked",
    ),
  );
}

function applyOfficialVerification(
  candidate: StrategySelectionCandidate,
): StrategySelectionCandidate {
  const officialKey = normalizeCandidateLookup(candidate.candidateName)
    .replace(/^kimberly-georgeton$/, "kimberly-c-georgeton")
    .replace(/^colleen-odonnell$/, "colleen-o-donnell");

  if (!OFFICIAL_2026_STATEWIDE_CANDIDATE_NAMES.has(officialKey)) {
    return candidate;
  }

  return {
    ...candidate,
    status: "source_backed",
    campaignStatus:
      candidate.campaignStatus === "Priority public-profile agent workspace" ||
      candidate.campaignStatus === "Source verification needed"
        ? "Official 2026 statewide candidate source linked"
        : candidate.campaignStatus,
    sourceNote:
      "Official Ohio Secretary of State 2026 statewide candidate source attached. Public platform, contact, geography, USPS counts, and creative claims still require human review before client-facing use.",
    verificationSources: [
      ...(candidate.verificationSources ?? []),
      OHIO_SOS_2026_QUALIFIED_SOURCE,
      OHIO_SOS_2026_FILING_SOURCE,
    ],
  };
}

function uniqueStrategyCandidates(candidates: StrategySelectionCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = normalizeCandidateLookup(candidate.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeCandidateLookup(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function sourceLabelForPublicRecord(record: PublicCampaignCandidateRecord) {
  if (record.sourceType?.includes("sos")) return "Ohio SOS source linked";
  if (record.sourceType?.includes("boe")) return "Board of Elections source";
  if (record.sourceType?.includes("fec")) return "FEC source linked";
  return "Public source linked";
}

function geographyLabelForPublicRecord(
  geographyType: string,
  geographyValue: string,
  state: string,
) {
  if (geographyType === "state") return state === "OH" ? "Ohio" : state;
  if (geographyType === "county" && !geographyValue.toLowerCase().includes("county")) {
    return `${geographyValue} County`;
  }
  return geographyValue;
}

function districtLabelForPublicRecord(
  record: PublicCampaignCandidateRecord,
  geographyType: string,
  geographyValue: string,
) {
  if (geographyType === "state") {
    return record.officeSought?.includes("U.S.") ? "Federal statewide" : "Ohio statewide";
  }
  if (geographyType === "county") return "Countywide";
  if (geographyType === "city") return "Citywide";
  if (record.districtType === "federal") return geographyValue || "Federal district";
  if (record.districtType === "state") return geographyValue || "State legislative district";
  return geographyValue || "Local campaign geography";
}

function countyFromPublicRecord(record: PublicCampaignCandidateRecord) {
  const geographyType = record.geographyType?.toLowerCase();
  const geographyValue = record.geographyValue?.trim() ?? "";
  if (geographyType === "county") {
    return geographyValue.replace(/\s+County$/i, "") || "Countywide";
  }
  if (geographyType === "city") {
    return geographyValue || "Citywide";
  }
  if (geographyType === "state") {
    return record.state === "OH" ? "Statewide" : record.state ?? "Statewide";
  }
  return geographyValue || record.state || "Ohio";
}

function raceTypeFromPublicRecord(
  record: PublicCampaignCandidateRecord,
  office: string,
) {
  const type = record.geographyType?.toLowerCase();
  const districtType = record.districtType?.toLowerCase();
  const officeLower = office.toLowerCase();
  if (officeLower.includes("school")) return "School Board";
  if (officeLower.includes("mayor")) return "Mayoral";
  if (officeLower.includes("judge") || officeLower.includes("court")) return "Judicial";
  if (officeLower.includes("commissioner") || officeLower.includes("auditor") || officeLower.includes("executive") || type === "county") return "County";
  if (officeLower.includes("council") && type === "city") return "Mayoral";
  if (districtType === "federal" || officeLower.includes("u.s.")) return "Federal";
  if (districtType === "state" || officeLower.includes("representative") || officeLower.includes("senate")) return "Legislative";
  if (type === "state") return "Statewide";
  return resolveRaceType(office);
}

function slugifyCandidate(value: string) {
  return normalizeCandidateLookup(value) || "campaign";
}

function titleizeCandidateName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) =>
      part.length <= 2
        ? part.toUpperCase()
        : `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`,
    )
    .join(" ");
}

function fromExistingStrategy(
  candidate: StrategySelectionCandidate,
  strategy: CandidateCampaignStrategy,
  index: number,
): StrategySelectionPlan {
  const optionLabel = optionLabels[index] ?? "A";
  const priorityCounties =
    candidate.agent?.profile.topCounties.slice(index, index + 5) ?? [];
  const priorityCities =
    candidate.agent?.profile.topCities.slice(index, index + 5) ?? [];
  const counties = coverageCountiesFor(candidate, priorityCounties);
  const cities =
    priorityCities.length > 0 ? priorityCities : resolveCities(candidate);
  const districts = [
    candidate.district,
    ...(candidate.agent?.profile.mediaMarkets.slice(0, 2) ?? []).map(
      (market) => `${market} media market`,
    ),
  ];
  const saturationPct = clamp(42 + index * 11, 38, 86);
  const routeCount = Math.max(12, Math.round(strategy.households / 620));
  const frequency = strategy.drops;
  const postcards =
    strategy.phases[0]?.postcardConcepts.slice(0, 4).map((concept) => ({
      id: concept.id,
      category: concept.category,
      headline: concept.headline,
      subheadline: concept.subheadline,
      cta: concept.cta,
      tone: concept.visualDirection,
      frontBody: concept.frontBody,
      backBody: concept.backBody,
    })) ?? [];

  return completePlan({
    id: strategy.id,
    optionLabel,
    title: strategy.title,
    tagline: strategy.campaignTheme,
    strategyOverview: strategy.strategyOverview,
    whyThisPlan: `${strategy.rolloutStrategy} ${strategy.mailQuantityAssumptions}`,
    candidateFit: strategy.emotionalPositioning,
    estimatedVoterReach: strategy.estimatedReach,
    estimatedHouseholds: strategy.households,
    estimatedImpressions: Math.round(strategy.totalPieces * 2.1),
    estimatedFrequency: frequency,
    totalCampaignCostCents: strategy.estimatedTotalCents,
    costPerHouseholdCents: Math.round(
      strategy.estimatedTotalCents / Math.max(1, strategy.households),
    ),
    drops: strategy.drops,
    durationWeeks: strategy.drops * 2,
    countiesIncluded: counties,
    citiesIncluded: cities,
    districtsIncluded: districts,
    uspsRoutesIncluded: routeCount,
    mailFormat: "6x11 political postcard",
    saturationPct,
    timelineLength: `${strategy.drops * 2} weeks`,
    mapHighlights: [
      ...priorityCounties.slice(0, 8),
      ...cities.slice(0, 3),
    ],
    routeDensity: index === 0 ? "very high" : index === 1 ? "high" : "medium",
    productionStatus: "needs_usps_counts",
    postcards,
  });
}

function buildWorkspacePlans(
  candidate: StrategySelectionCandidate,
): StrategySelectionPlan[] {
  const geography = candidate.geography || candidate.county || "Ohio";
  const baseHouseholds = baseHouseholdsFor(candidate);
  const names = resolveStrategyNames(candidate);
  const counties = resolveCounties(candidate);
  const cities = resolveCities(candidate);

  return names.map((seed, index) => {
    const drops = [5, 4, 4, 3][index] ?? 4;
    const householdFactor = [1, 0.68, 0.48, 0.34][index] ?? 0.5;
    const households = Math.round(baseHouseholds * householdFactor);
    const pieces = households * drops;
    const priceCents = resolvePoliticalPostcardPriceCents(
      resolveDistrictType(candidate),
      pieces,
    );
    const totalCostCents = pieces * priceCents;

    return completePlan({
      id: seed.id,
      optionLabel: optionLabels[index] ?? "A",
      title: seed.title,
      tagline: seed.tagline,
      strategyOverview: `${seed.tagline} Built for ${candidate.candidateName} in ${geography} using aggregate geography, route density, and production feasibility only.`,
      whyThisPlan: `This plan gives ${candidate.office} staff a clean route to compare ${counties
        .slice(0, 3)
        .join(
          ", ",
        )} and ${cities.slice(0, 3).join(", ")} before USPS counts and final source verification.`,
      candidateFit: seed.fit,
      estimatedVoterReach: Math.round(households * 1.5),
      estimatedHouseholds: households,
      estimatedImpressions: Math.round(pieces * 2.1),
      estimatedFrequency: drops,
      totalCampaignCostCents: totalCostCents,
      costPerHouseholdCents: Math.round(
        totalCostCents / Math.max(1, households),
      ),
      drops,
      durationWeeks: drops * 2,
      countiesIncluded: counties,
      citiesIncluded: cities,
      districtsIncluded: [candidate.district, candidate.raceType],
      uspsRoutesIncluded: Math.max(8, Math.round(households / 620)),
      mailFormat:
        candidate.raceType === "School Board"
          ? "6x9 local postcard"
          : "6x11 political postcard",
      saturationPct: clamp(38 + index * 12, 35, 82),
      timelineLength: `${drops * 2} weeks`,
      mapHighlights: [...counties.slice(0, 5), ...cities.slice(0, 3)],
      routeDensity: index === 0 ? "high" : index === 1 ? "very high" : "medium",
      productionStatus: "needs_usps_counts",
      postcards: buildWorkspacePostcards(candidate, seed.title, seed.fit),
    });
  });
}

function completePlan(
  plan: Omit<StrategySelectionPlan, "metrics" | "indicators" | "timeline">,
): StrategySelectionPlan {
  const isStatewideCoverage =
    plan.countiesIncluded.length >= OHIO_STATEWIDE_COUNTIES.length;
  const focusCountyCount = new Set(
    plan.mapHighlights.filter((label) =>
      OHIO_STATEWIDE_COUNTIES.includes(
        label as (typeof OHIO_STATEWIDE_COUNTIES)[number],
      ),
    ),
  ).size;
  const geographyMetrics = isStatewideCoverage
    ? [
        { label: "Race scope", value: "Statewide" },
        { label: "Focus counties", value: String(focusCountyCount || 5) },
      ]
    : [{ label: "Counties", value: String(plan.countiesIncluded.length) }];
  const metrics = [
    {
      label: "Household reach",
      value: INTEGER.format(plan.estimatedVoterReach),
    },
    { label: "Households", value: INTEGER.format(plan.estimatedHouseholds) },
    { label: "Impressions", value: INTEGER.format(plan.estimatedImpressions) },
    { label: "Frequency", value: `${plan.estimatedFrequency}x` },
    {
      label: "Total cost",
      value: MONEY_WHOLE.format(plan.totalCampaignCostCents / 100),
    },
    {
      label: "Cost/HH",
      value: MONEY_TWO.format(plan.costPerHouseholdCents / 100),
    },
    { label: "Drops", value: String(plan.drops) },
    { label: "Duration", value: `${plan.durationWeeks} weeks` },
    ...geographyMetrics,
    { label: "Cities", value: String(plan.citiesIncluded.length) },
    { label: "Districts", value: String(plan.districtsIncluded.length) },
    { label: "USPS routes", value: INTEGER.format(plan.uspsRoutesIncluded) },
    { label: "Format", value: plan.mailFormat },
    { label: "Saturation", value: `${plan.saturationPct}%` },
    { label: "Timeline", value: plan.timelineLength },
  ];

  return {
    ...plan,
    metrics,
    indicators: [
      {
        label: "Civic Timing Fit",
        value: plan.drops >= 4 ? "VERY HIGH" : "HIGH",
      },
      {
        label: "Message Reinforcement",
        value: plan.saturationPct >= 60 ? "HIGH" : "MEDIUM",
      },
      {
        label: "Cost Efficiency",
        value: plan.costPerHouseholdCents <= 260 ? "VERY HIGH" : "HIGH",
      },
      {
        label: "Geographic Coverage",
        value:
          isStatewideCoverage || plan.countiesIncluded.length >= 5
            ? "VERY HIGH"
            : "HIGH",
      },
      {
        label: "Frequency Strength",
        value: plan.estimatedFrequency >= 4 ? "VERY HIGH" : "HIGH",
      },
      { label: "Candidate Alignment", value: "HIGH" },
      {
        label: "Expansion Opportunity",
        value: plan.routeDensity === "very high" ? "VERY HIGH" : "HIGH",
      },
    ],
    timeline: buildTimeline(plan.drops),
  };
}

function buildTimeline(drops: number) {
  const labels = ["Introduction", "Trust", "Issue", "Contrast", "Ballot Window"];
  return Array.from({ length: drops }).map((_, index) => ({
    week: `Week ${index * 2 + 1}`,
    label: labels[index] ?? "Reinforcement",
  }));
}

function buildWorkspacePostcards(
  candidate: StrategySelectionCandidate,
  strategyTitle: string,
  fit: string,
): StrategySelectionPostcard[] {
  const categories = [
    "Emotional/Human",
    "Policy/Issue Focused",
    "Testimonial/Social Proof",
    "Contrast/Urgency",
  ];
  const issue = issueFor(candidate);

  return categories.map((category, index) => ({
    id: `${candidate.id}-${strategyTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
    category,
    headline:
      category === "Contrast/Urgency"
        ? `${candidate.geography} has a clear choice`
        : `${candidate.candidateName}: ${issue} for ${candidate.geography}`,
    subheadline:
      category === "Testimonial/Social Proof"
        ? "Approved validator quote and source required before print."
        : fit,
    cta: index === 3 ? "Make your voting plan" : "Learn the plan",
    tone: `${category} concept with ${candidate.party} campaign-safe styling and final source review.`,
    frontBody:
      "Front preview uses a candidate-safe headline, Ohio/local visual, and one simple message lane.",
    backBody:
      "Back preview reserves space for proof bullets, QR code, disclaimer, deadline, and campaign-approved contact.",
  }));
}

function resolveStrategyNames(candidate: StrategySelectionCandidate) {
  const party = candidate.party.toLowerCase();
  if (candidate.raceType === "Mayoral") {
    return [
      {
        id: "city-name-id",
        title: "Citywide Name Recognition",
        tagline: "Build simple, repeated citywide awareness.",
        fit: "Local, practical, civic, and easy to understand.",
      },
      {
        id: "neighborhood-saturation",
        title: "Neighborhood Saturation Push",
        tagline: "Cluster routes around high-density neighborhoods.",
        fit: "Local proof, neighborhood familiarity, and service delivery.",
      },
      {
        id: "community-contrast",
        title: "Community Contrast Lane",
        tagline: "Frame the public choice with local issues.",
        fit: "Factual, civic, and deadline-aware.",
      },
      {
        id: "turnout-window",
        title: "Municipal Ballot Window",
        tagline: "Compress reminders around absentee and Election Day.",
        fit: "Clear, urgent, and voting-plan focused.",
      },
    ];
  }
  if (candidate.raceType === "School Board") {
    return [
      {
        id: "family-trust",
        title: "Family Trust Builder",
        tagline: "Reach households with a calm education-first message.",
        fit: "Parent-focused, local, and nonpartisan.",
      },
      {
        id: "district-awareness",
        title: "District Awareness Layer",
        tagline: "Explain the office and voting window.",
        fit: "Simple, civic, and practical.",
      },
      {
        id: "community-proof",
        title: "Community Proof Card",
        tagline: "Use approved local validators and school-community proof.",
        fit: "Trust-centered and source-dependent.",
      },
      {
        id: "final-reminder",
        title: "Final Reminder Push",
        tagline: "Make the low-turnout election impossible to miss.",
        fit: "Short, clear, and deadline-heavy.",
      },
    ];
  }
  if (party.includes("republican")) {
    return [
      {
        id: "suburban-retention",
        title: "Suburban Retention Push",
        tagline: "Hold high-efficiency suburban and exurban route clusters.",
        fit: "Steady, values-forward, and economy-aware.",
      },
      {
        id: "rural-reinforcement",
        title: "Rural Reinforcement Push",
        tagline: "Reinforce county-seat and rural carrier-route coverage.",
        fit: "Direct, patriotic, and locally grounded.",
      },
      {
        id: "business-corridor",
        title: "Business Corridor Mail Plan",
        tagline: "Focus on growth corridors and local economic confidence.",
        fit: "Economy, safety, and competence.",
      },
      {
        id: "gop-gotv",
        title: "Conservative Ballot Window Accelerator",
        tagline: "Tight final-window mail for turnout and deadline clarity.",
        fit: "Clear, urgent, and voting-window focused.",
      },
    ];
  }
  if (party.includes("democrat")) {
    return [
      {
        id: "suburban-persuasion",
        title: "Suburban Message Reinforcement",
        tagline: "Build trust in suburban and education-heavy counties.",
        fit: "Warm, family-centered, and issue-forward.",
      },
      {
        id: "urban-turnout",
        title: "Urban Ballot Window Expansion",
        tagline: "Reinforce dense city routes and ballot-window timing.",
        fit: "Energetic, clear, and deadline-focused.",
      },
      {
        id: "coalition-mail",
        title: "Coalition Message Ladder",
        tagline: "Sequence approved issue lanes by geography.",
        fit: "Healthcare, affordability, labor, and civic trust.",
      },
      {
        id: "hybrid-gotv",
        title: "Hybrid Message + Ballot Reminder",
        tagline: "Balance trust-building with final-week turnout reminders.",
        fit: "Emotionally steady and operationally focused.",
      },
    ];
  }
  return [
    {
      id: "name-id",
      title: "Name Recognition Acceleration",
      tagline: "Make the candidate and office easy to understand.",
      fit: "Simple, local, and credible.",
    },
    {
      id: "route-density",
      title: "Route Density Plan",
      tagline: "Prioritize efficient mail routes and neighborhood repetition.",
      fit: "Operationally efficient and local.",
    },
    {
      id: "trust-proof",
      title: "Trust + Proof Sequence",
      tagline: "Use approved public record and validator proof.",
      fit: "Measured, factual, and review-ready.",
    },
    {
      id: "final-window",
      title: "Final Window Reminder",
      tagline: "Mail around absentee, early vote, and Election Day.",
      fit: "Direct, urgent, and civic.",
    },
  ];
}

function resolveCounties(candidate: StrategySelectionCandidate) {
  if (isOhioStatewideRace(candidate)) return [...OHIO_STATEWIDE_COUNTIES];
  if (candidate.county !== "Multiple")
    return [candidate.county, "Nearby route cluster", "Adjacent county"];
  return ["Franklin", "Cuyahoga", "Hamilton", "Summit", "Lucas", "Montgomery"];
}

function resolveCities(candidate: StrategySelectionCandidate) {
  const city = candidate.geography.replace(" County", "");
  if (["Ohio", "Multiple"].includes(city))
    return ["Columbus", "Cleveland", "Cincinnati", "Akron", "Toledo", "Dayton"];
  return [city, "Primary suburbs", "County seat"];
}

function baseHouseholdsFor(candidate: StrategySelectionCandidate) {
  if (candidate.raceType === "Statewide") return 1_050_000;
  if (candidate.raceType === "Mayoral") return 95_000;
  if (candidate.raceType === "County") return 160_000;
  if (candidate.raceType === "Judicial") return 140_000;
  if (candidate.raceType === "School Board") return 24_000;
  if (candidate.raceType === "Township") return 14_000;
  if (candidate.raceType === "Legislative") return 72_000;
  return 120_000;
}

function resolveDistrictType(candidate: StrategySelectionCandidate) {
  if (candidate.office.includes("U.S.")) return "federal";
  if (
    candidate.raceType === "Statewide" ||
    candidate.raceType === "Legislative"
  )
    return "state";
  return "local";
}

function resolveRaceType(office: string) {
  if (office.includes("Party")) return "Coordinated";
  if (
    office.includes("Governor") ||
    office.includes("Secretary") ||
    office.includes("Attorney")
  )
    return "Statewide";
  if (office.includes("U.S.")) return "Federal";
  return "Local";
}

function coverageCountiesFor(
  candidate: StrategySelectionCandidate,
  priorityCounties: string[],
) {
  if (isOhioStatewideRace(candidate)) return [...OHIO_STATEWIDE_COUNTIES];
  if (priorityCounties.length > 0) return priorityCounties;
  return resolveCounties(candidate);
}

function isOhioStatewideRace(candidate: StrategySelectionCandidate) {
  const normalizedGeography = candidate.geography.toLowerCase();
  const office = candidate.office.toLowerCase();
  const district = candidate.district.toLowerCase();
  const isStatewideOffice =
    office.includes("governor") ||
    office.includes("secretary") ||
    office.includes("attorney") ||
    office.includes("treasurer") ||
    office.includes("auditor") ||
    office.includes("u.s. senate");
  const isStatewideCoordinated =
    candidate.raceType === "Coordinated" &&
    (office.includes("party") || district.includes("statewide"));
  return (
    normalizedGeography === "ohio" &&
    (candidate.raceType === "Statewide" ||
      isStatewideOffice ||
      isStatewideCoordinated)
  );
}

function issueFor(candidate: StrategySelectionCandidate) {
  const office = candidate.office.toLowerCase();
  if (office.includes("attorney")) return "accountability";
  if (office.includes("secretary")) return "civic trust";
  if (office.includes("school")) return "strong local schools";
  if (office.includes("mayor")) return "safer, stronger neighborhoods";
  if (office.includes("governor")) return "Ohio families";
  return "community leadership";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const optionLabels: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
