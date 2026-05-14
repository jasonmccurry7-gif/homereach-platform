export type CampaignOfficeType =
  | "governor"
  | "statewide"
  | "us_senate"
  | "us_house"
  | "state_senate"
  | "state_house"
  | "county_executive"
  | "mayor"
  | "city_council"
  | "school_board"
  | "judicial"
  | "ballot_issue";

export type ElectionType = "general" | "primary" | "special";
export type TimelineUrgency = "full_runway" | "healthy" | "compressed" | "urgent";

export interface OfficeTimelineProfile {
  type: CampaignOfficeType;
  label: string;
  level: "statewide" | "federal" | "state_legislative" | "local" | "judicial" | "issue";
  runwayDays: number;
  productionBusinessDays: number;
  cadenceOffsets: [number, number, number, number, number];
  cadenceSummary: string;
  officeNote: string;
}

export interface MailDropTimelineInput {
  candidateName?: string | null;
  officeType: CampaignOfficeType;
  electionType: ElectionType;
  electionDate?: string | null;
  earlyVoteStartDate?: string | null;
  planningStartDate?: string | null;
  geography?: string | null;
}

export interface MailTimelinePhase {
  phaseNumber: number;
  phaseKey: string;
  title: string;
  objective: string;
  messageTheme: string;
  idealDropDate: string;
  recommendedDropDate: string;
  inHomeStartDate: string;
  inHomeEndDate: string;
  creativeLockDate: string;
  proofApprovalDate: string;
  printDeadlineDate: string;
  daysBeforeElection: number;
  catchUp: boolean;
  whyThisTiming: string;
  officeSpecificNote: string;
  complianceNote: string;
}

export interface MailDropTimeline {
  candidateName: string;
  office: OfficeTimelineProfile;
  electionType: ElectionType;
  electionDate: string;
  earlyVoteStartDate: string | null;
  planningStartDate: string;
  geography: string;
  urgency: TimelineUrgency;
  urgencyLabel: string;
  runwayDays: number;
  modelConfidence: "high" | "medium" | "compressed";
  phases: MailTimelinePhase[];
  methodologyNotes: string[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const OFFICE_TIMELINE_PROFILES: Record<CampaignOfficeType, OfficeTimelineProfile> = {
  governor: {
    type: "governor",
    label: "Governor / statewide executive",
    level: "statewide",
    runwayDays: 180,
    productionBusinessDays: 10,
    cadenceOffsets: [180, 130, 80, 35, 10],
    cadenceSummary: "Six-month statewide arc: name ID, summer priorities, late-summer credibility, early vote, final GOTV.",
    officeNote: "Statewide executive races need the longest runway because name ID, geography, media markets, and approval cycles are heavier.",
  },
  statewide: {
    type: "statewide",
    label: "Other statewide office",
    level: "statewide",
    runwayDays: 165,
    productionBusinessDays: 10,
    cadenceOffsets: [165, 120, 75, 34, 10],
    cadenceSummary: "Statewide arc with early biography, mid-cycle proof, persuasion, early vote, and final reminder waves.",
    officeNote: "Statewide non-governor races still benefit from early geography coverage and longer creative approval buffers.",
  },
  us_senate: {
    type: "us_senate",
    label: "U.S. Senate",
    level: "federal",
    runwayDays: 165,
    productionBusinessDays: 10,
    cadenceOffsets: [165, 118, 72, 34, 10],
    cadenceSummary: "Federal statewide cadence: broad introduction, issue credibility, contrast, early vote, GOTV.",
    officeNote: "Senate races usually carry statewide logistics and federal compliance review, so production locks should stay conservative.",
  },
  us_house: {
    type: "us_house",
    label: "U.S. House",
    level: "federal",
    runwayDays: 150,
    productionBusinessDays: 8,
    cadenceOffsets: [150, 105, 63, 32, 9],
    cadenceSummary: "Congressional cadence: district name ID, local issue proof, credibility, ballot-window push, final GOTV.",
    officeNote: "Congressional races benefit from a district-wide name-ID wave before the post-Labor-Day persuasion period.",
  },
  state_senate: {
    type: "state_senate",
    label: "State Senate",
    level: "state_legislative",
    runwayDays: 135,
    productionBusinessDays: 7,
    cadenceOffsets: [135, 94, 58, 29, 8],
    cadenceSummary: "Legislative district cadence: early intro, local priority, credibility, early vote, GOTV.",
    officeNote: "State Senate districts are large enough to need repetition, but the calendar can be tighter than statewide races.",
  },
  state_house: {
    type: "state_house",
    label: "State House",
    level: "state_legislative",
    runwayDays: 120,
    productionBusinessDays: 7,
    cadenceOffsets: [120, 82, 50, 27, 8],
    cadenceSummary: "State House cadence: district intro, local issue, credibility, vote-window reminder, final GOTV.",
    officeNote: "State House races usually work best with compact creative and clear local geography because household universes are smaller.",
  },
  county_executive: {
    type: "county_executive",
    label: "County executive / commissioner",
    level: "local",
    runwayDays: 105,
    productionBusinessDays: 6,
    cadenceOffsets: [105, 72, 45, 24, 7],
    cadenceSummary: "County cadence: service record, county issue, credibility, ballot window, final reminder.",
    officeNote: "County races should emphasize local proof, visible service, and clear geography over broad statewide-style branding.",
  },
  mayor: {
    type: "mayor",
    label: "Mayor",
    level: "local",
    runwayDays: 100,
    productionBusinessDays: 6,
    cadenceOffsets: [100, 68, 42, 22, 7],
    cadenceSummary: "Mayor cadence: introduction, neighborhood priorities, competence proof, early vote, final GOTV.",
    officeNote: "Mayor races can move faster, but the best mail still starts before voters mentally lock in local choices.",
  },
  city_council: {
    type: "city_council",
    label: "City council / local board",
    level: "local",
    runwayDays: 84,
    productionBusinessDays: 5,
    cadenceOffsets: [84, 56, 35, 20, 6],
    cadenceSummary: "Local cadence: who I am, neighborhood issue, credibility, vote reminder, final GOTV.",
    officeNote: "Small-district races should keep the mail simple, repeated, and closely tied to the neighborhoods being covered.",
  },
  school_board: {
    type: "school_board",
    label: "School board",
    level: "local",
    runwayDays: 75,
    productionBusinessDays: 5,
    cadenceOffsets: [75, 50, 32, 18, 6],
    cadenceSummary: "School board cadence: biography, priorities, trust proof, vote reminder, final GOTV.",
    officeNote: "School board mail performs best when it is trust-forward, locally specific, and reviewed carefully for tone.",
  },
  judicial: {
    type: "judicial",
    label: "Judicial",
    level: "judicial",
    runwayDays: 120,
    productionBusinessDays: 8,
    cadenceOffsets: [120, 84, 52, 28, 8],
    cadenceSummary: "Judicial cadence: qualifications, experience, public trust, ballot-window reminder, final GOTV.",
    officeNote: "Judicial races should keep copy credential-focused and compliance-reviewed before any public release.",
  },
  ballot_issue: {
    type: "ballot_issue",
    label: "Ballot issue / levy",
    level: "issue",
    runwayDays: 105,
    productionBusinessDays: 6,
    cadenceOffsets: [105, 75, 45, 24, 7],
    cadenceSummary: "Issue cadence: explain the measure, local impact, proof, ballot-window reminder, final GOTV.",
    officeNote: "Issue campaigns need clarity and repetition because voters often decide late and need exact ballot language context.",
  },
};

export const OFFICE_TIMELINE_OPTIONS = Object.values(OFFICE_TIMELINE_PROFILES).map((profile) => ({
  value: profile.type,
  label: profile.label,
}));

const PHASE_TEMPLATES = [
  {
    key: "name_id",
    title: "Candidate introduction / name ID",
    objective: "Introduce the candidate and make the race recognizable before the crowded late-cycle window.",
    messageTheme: "Biography, service record, why the candidate is running, and the office being sought.",
    why: "Early mail creates baseline recognition before voters are overloaded by late-cycle messages.",
  },
  {
    key: "issue_priority",
    title: "Issue priority / local proof",
    objective: "Connect the campaign to the top public priorities for the office and geography.",
    messageTheme: "Two or three concrete priorities, local stakes, and a simple call to learn more.",
    why: "The second wave turns awareness into reasons to remember the campaign.",
  },
  {
    key: "credibility_contrast",
    title: "Credibility / contrast",
    objective: "Reinforce why the candidate or campaign is prepared, credible, and different.",
    messageTheme: "Qualifications, endorsements, record, contrast, or issue-specific credibility.",
    why: "Late-summer and early-fall mail typically shifts from recognition into choice framing.",
  },
  {
    key: "early_vote",
    title: "Early vote / ballot window",
    objective: "Reach households as vote-by-mail, absentee, or early-vote behavior begins.",
    messageTheme: "Voting options, urgency, district reminder, QR or landing-page path, and approval-safe call to action.",
    why: "Campaign calendars should anchor to the first meaningful ballot window, not only Election Day.",
  },
  {
    key: "gotv",
    title: "Final GOTV / election reminder",
    objective: "Land a final reminder in the last week when simple, high-recall messaging matters most.",
    messageTheme: "Election date, candidate name, office, vote reminder, and compliance disclaimer.",
    why: "The final wave should arrive close enough to be remembered but early enough to avoid postal risk.",
  },
] as const;

function dateFromParts(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, y, m, d] = match;
  const date = dateFromParts(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function daysBetween(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function addBusinessDays(date: Date, days: number) {
  let current = new Date(date);
  let remaining = Math.abs(days);
  const direction = days < 0 ? -1 : 1;

  while (remaining > 0) {
    current = addDays(current, direction);
    if (!isWeekend(current)) remaining -= 1;
  }

  return current;
}

function adjustToMailDropDay(date: Date) {
  const day = date.getUTCDay();
  if (day === 1) return addDays(date, 1);
  if (day === 5) return addDays(date, -1);
  if (day === 6) return addDays(date, -2);
  if (day === 0) return addDays(date, -3);
  return date;
}

function nextGeneralElectionDate(reference = new Date()) {
  const year = reference.getUTCFullYear();
  const thisYear = generalElectionDate(year);
  return reference.getTime() <= thisYear.getTime()
    ? thisYear
    : generalElectionDate(year + 1);
}

function generalElectionDate(year: number) {
  const novemberFirst = dateFromParts(year, 10, 1);
  const day = novemberFirst.getUTCDay();
  const firstMonday = addDays(novemberFirst, (8 - day) % 7);
  return addDays(firstMonday, 1);
}

function urgencyForRunway(runwayDays: number, profile: OfficeTimelineProfile): TimelineUrgency {
  if (runwayDays >= profile.runwayDays) return "full_runway";
  if (runwayDays >= Math.round(profile.runwayDays * 0.72)) return "healthy";
  if (runwayDays >= Math.round(profile.runwayDays * 0.42)) return "compressed";
  return "urgent";
}

function urgencyLabel(urgency: TimelineUrgency) {
  if (urgency === "full_runway") return "Full historical runway";
  if (urgency === "healthy") return "Healthy campaign runway";
  if (urgency === "compressed") return "Compressed schedule";
  return "Urgent catch-up schedule";
}

function compressedDropDates(input: {
  election: Date;
  earliestDrop: Date;
  phaseCount: number;
}) {
  const availableDays = Math.max(1, daysBetween(input.earliestDrop, input.election));
  const ratios = [0.78, 0.58, 0.38, 0.2, 0.08];

  return ratios.slice(0, input.phaseCount).map((ratio) => {
    const daysBeforeElection = Math.max(6, Math.round(availableDays * ratio));
    return adjustToMailDropDay(addDays(input.election, -daysBeforeElection));
  });
}

function buildRecommendedDropDates(input: {
  profile: OfficeTimelineProfile;
  election: Date;
  planningStart: Date;
  earlyVoteStart: Date | null;
}) {
  const earliestDrop = adjustToMailDropDay(addBusinessDays(input.planningStart, 5));
  const availableRunway = daysBetween(earliestDrop, input.election);

  if (availableRunway < Math.round(input.profile.runwayDays * 0.42)) {
    return compressedDropDates({
      election: input.election,
      earliestDrop,
      phaseCount: 5,
    });
  }

  let cursor = earliestDrop;
  const minGaps = input.profile.level === "statewide" || input.profile.level === "federal"
    ? [21, 24, 18, 12, 0]
    : [14, 17, 14, 10, 0];

  return input.profile.cadenceOffsets.map((offset, index) => {
    const phaseTemplate = PHASE_TEMPLATES[index];
    const ideal = phaseTemplate?.key === "early_vote" && input.earlyVoteStart
      ? adjustToMailDropDay(addBusinessDays(input.earlyVoteStart, -4))
      : adjustToMailDropDay(addDays(input.election, -offset));

    const recommended = ideal.getTime() < cursor.getTime()
      ? cursor
      : ideal;

    cursor = addDays(recommended, minGaps[index] ?? 14);
    return recommended;
  });
}

function phaseOfficeNote(profile: OfficeTimelineProfile, phaseKey: string) {
  if (profile.type === "governor" && phaseKey === "name_id") {
    return "For a governor race, this is the six-month statewide name-ID wave. Missing it means the next best move is an immediate catch-up introduction.";
  }
  if (profile.level === "local" && phaseKey === "name_id") {
    return "Local races can start later than statewide races, but the first mailer still needs to define the candidate before opponent or issue mail arrives.";
  }
  if (phaseKey === "early_vote") {
    return "This phase should be checked against the official state and county early-vote or absentee calendar before production release.";
  }
  if (phaseKey === "gotv") {
    return "Keep this wave simple: name, office, date, voting reminder, and legally required disclaimer.";
  }
  return profile.officeNote;
}

export function getDefaultElectionDate() {
  return dateOnly(nextGeneralElectionDate());
}

export function getDefaultPlanningStartDate() {
  return dateOnly(new Date());
}

export function generateMailDropTimeline(input: MailDropTimelineInput): MailDropTimeline {
  const profile = OFFICE_TIMELINE_PROFILES[input.officeType] ?? OFFICE_TIMELINE_PROFILES.state_house;
  const election = parseDateOnly(input.electionDate) ?? nextGeneralElectionDate();
  const planningStart = parseDateOnly(input.planningStartDate) ?? new Date();
  const earlyVoteStart = parseDateOnly(input.earlyVoteStartDate);
  const idealDrops = profile.cadenceOffsets.map((offset, index) => {
    const template = PHASE_TEMPLATES[index];
    return template?.key === "early_vote" && earlyVoteStart
      ? adjustToMailDropDay(addBusinessDays(earlyVoteStart, -4))
      : adjustToMailDropDay(addDays(election, -offset));
  });
  const recommendedDrops = buildRecommendedDropDates({
    profile,
    election,
    planningStart,
    earlyVoteStart,
  });

  const phases = PHASE_TEMPLATES.map((template, index): MailTimelinePhase => {
    const offset = profile.cadenceOffsets[index] ?? 10;
    const idealDrop = idealDrops[index] ?? addDays(election, -offset);
    const drop = recommendedDrops[index] ?? idealDrop;
    const inHomeStart = addBusinessDays(drop, 3);
    const inHomeEnd = addBusinessDays(drop, 6);
    const proofApproval = addBusinessDays(drop, -(profile.productionBusinessDays + 2));
    const creativeLock = addBusinessDays(drop, -(profile.productionBusinessDays + 5));
    const printDeadline = addBusinessDays(drop, -profile.productionBusinessDays);

    return {
      phaseNumber: index + 1,
      phaseKey: template.key,
      title: template.title,
      objective: template.objective,
      messageTheme: template.messageTheme,
      idealDropDate: dateOnly(idealDrop),
      recommendedDropDate: dateOnly(drop),
      inHomeStartDate: dateOnly(inHomeStart),
      inHomeEndDate: dateOnly(inHomeEnd),
      creativeLockDate: dateOnly(creativeLock),
      proofApprovalDate: dateOnly(proofApproval),
      printDeadlineDate: dateOnly(printDeadline),
      daysBeforeElection: Math.max(0, daysBetween(drop, election)),
      catchUp: drop.getTime() > idealDrop.getTime(),
      whyThisTiming: template.why,
      officeSpecificNote: phaseOfficeNote(profile, template.key),
      complianceNote: "Human approval required before any client-facing copy, disclaimer, or production handoff.",
    };
  });

  const runwayDays = Math.max(0, daysBetween(planningStart, election));
  const urgency = urgencyForRunway(runwayDays, profile);

  return {
    candidateName: input.candidateName?.trim() || "Campaign",
    office: profile,
    electionType: input.electionType,
    electionDate: dateOnly(election),
    earlyVoteStartDate: earlyVoteStart ? dateOnly(earlyVoteStart) : null,
    planningStartDate: dateOnly(planningStart),
    geography: input.geography?.trim() || "Campaign geography",
    urgency,
    urgencyLabel: urgencyLabel(urgency),
    runwayDays,
    modelConfidence: urgency === "urgent" ? "compressed" : urgency === "compressed" ? "medium" : "high",
    phases,
    methodologyNotes: [
      profile.cadenceSummary,
      "Postcard drop means USPS/BMEU induction or mail-house handoff, followed by a modeled 3-6 business-day in-home window.",
      "The early-vote phase can anchor to a supplied absentee or early-vote start date when the campaign has that official calendar.",
      "This model is geography, timing, production, and compliance planning only. It does not score individual voters or infer ideology.",
    ],
  };
}
