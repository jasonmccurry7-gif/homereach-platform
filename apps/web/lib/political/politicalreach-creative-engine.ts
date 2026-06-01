export const POLITICALREACH_NAME = "PoliticalReach";
export const POLITICALREACH_POSITIONING =
  "A campaign persuasion and voter communication operating system for premium, approval-gated political mail.";

export type PoliticalReachBrandMode =
  | "Presidential"
  | "Grassroots"
  | "Reform Candidate"
  | "Outsider"
  | "Veteran/Military"
  | "Executive Leadership"
  | "Working-Class"
  | "Conservative Traditional"
  | "Progressive Modern"
  | "Community Focused"
  | "Law & Order"
  | "Unity/Future Focused";

export type PoliticalReachPostcardType =
  | "Candidate Introduction"
  | "Persuasion"
  | "GOTV"
  | "Early Voting"
  | "Absentee Ballot"
  | "Contrast Mail"
  | "Issue Mail"
  | "Endorsement Mail"
  | "Fundraising"
  | "Volunteer Recruitment"
  | "Event Promotion"
  | "Reputation Defense"
  | "Momentum Messaging"
  | "Community Connection"
  | "Localized Geographic Messaging";

export type PoliticalReachCreativeInput = {
  candidateName: string;
  shortName?: string | null;
  office?: string | null;
  state?: string | null;
  partyOrCommittee?: string | null;
  campaignFrame?: string | null;
  phaseKey?: string | null;
  phaseObjective?: string | null;
  campaignGoal?: string | null;
  districtType?: string | null;
  geography?: string | null;
  daysUntilElection?: number | null;
  issueFocus?: string | null;
  category?: string | null;
  brandMode?: PoliticalReachBrandMode | null;
};

export type PoliticalReachCreativeStrategy = {
  systemName: typeof POLITICALREACH_NAME;
  brandMode: PoliticalReachBrandMode;
  postcardType: PoliticalReachPostcardType;
  conceptTitle: string;
  emotionalJob: string;
  voterMemoryDevice: string;
  hierarchy: string[];
  typographySystem: string[];
  colorSystem: string[];
  imageStrategy: string;
  layoutModel: string;
  copyDiscipline: string[];
  ctaStrategy: string;
  printAndMailRules: string[];
  complianceGuardrails: string[];
  variationDirection: string;
  frontPrompt: string;
  backPrompt: string;
};

const BRAND_MODE_RULES: Record<
  PoliticalReachBrandMode,
  {
    emotionalJob: string;
    typography: string[];
    colors: string[];
    image: string;
    layout: string;
    tone: string;
  }
> = {
  Presidential: {
    emotionalJob: "Create instant legitimacy, scale, calm authority, and serious executive presence.",
    typography: ["Large candidate-name lockup", "Tight uppercase section labels", "Confident serif or geometric sans pairing"],
    colors: ["Presidential navy", "Matte white", "Muted liberty red", "Brushed steel accents"],
    image: "Leadership portrait or cinematic public-service image with eye contact and clean negative space.",
    layout: "Editorial hero front with one dominant statement and disciplined proof architecture on the back.",
    tone: "commanding, composed, national-caliber",
  },
  Grassroots: {
    emotionalJob: "Make the campaign feel local, human, neighbor-driven, and mobilized.",
    typography: ["Warm bold headline", "Human quote zone", "Plain-language proof bullets"],
    colors: ["Navy", "Warm white", "Community red", "Soft slate"],
    image: "Candidate with people, volunteers, local storefronts, homes, or community settings.",
    layout: "Human-photo lead with simple issue proof and a strong action strip.",
    tone: "approachable, active, local",
  },
  "Reform Candidate": {
    emotionalJob: "Signal a serious break from stale politics without looking reckless.",
    typography: ["Bold reform headline", "Sharp contrast subhead", "Clean accountability bullets"],
    colors: ["Deep navy", "Crisp white", "Liberty red accent", "Steel gray"],
    image: "Forward-looking portrait, courthouse, main street, or clean civic visual.",
    layout: "Strong headline front with reform promise, back structured as problem, standard, action.",
    tone: "clear, disciplined, reform-minded",
  },
  Outsider: {
    emotionalJob: "Create strength, independence, and a sense of direct accountability.",
    typography: ["Oversized name", "Short punch headline", "Minimal supporting copy"],
    colors: ["Navy black", "White", "Signal red", "Muted gold sparingly"],
    image: "Confident candidate portrait with practical, non-politician environment.",
    layout: "High-contrast front with minimal clutter and back built around a direct voter promise.",
    tone: "direct, confident, anti-template",
  },
  "Veteran/Military": {
    emotionalJob: "Communicate service, discipline, duty, and trustworthy command presence.",
    typography: ["Command-style headline", "Structured service proof", "Clear rank/role space only if verified"],
    colors: ["Command navy", "Matte white", "Deep red", "Muted gold accent"],
    image: "Service-oriented portrait or public-service setting, never costume-like or unverified.",
    layout: "Badge-free, premium command layout with controlled patriotic accents.",
    tone: "disciplined, credible, service-first",
  },
  "Executive Leadership": {
    emotionalJob: "Position the candidate as capable, decisive, and operationally competent.",
    typography: ["Executive headline", "Measured subhead", "Data/proof rail"],
    colors: ["Navy", "Steel", "White", "Muted red"],
    image: "Confident professional portrait or leadership-in-action image.",
    layout: "Premium business-editorial composition with a proof column and clear CTA.",
    tone: "competent, decisive, premium",
  },
  "Working-Class": {
    emotionalJob: "Build respect, dignity, economic trust, and practical connection.",
    typography: ["Readable bold headline", "Plain proof bullets", "Human local CTA"],
    colors: ["Deep navy", "White", "Workwear red", "Industrial slate"],
    image: "Local workers, homes, small businesses, or candidate in real community context.",
    layout: "Human-first front and back copy that keeps the message concrete and uncluttered.",
    tone: "grounded, respectful, practical",
  },
  "Conservative Traditional": {
    emotionalJob: "Signal steadiness, security, tradition, family, and fiscal seriousness.",
    typography: ["Strong traditional headline", "Trust proof", "Simple ballot action"],
    colors: ["Deep navy", "Rich red", "White", "Subtle gold"],
    image: "Family, public service, small business, farm, courthouse, or law-and-order image when sourced.",
    layout: "Classic but modern patriotic structure with restrained accents and high readability.",
    tone: "steady, patriotic, trustworthy",
  },
  "Progressive Modern": {
    emotionalJob: "Signal future focus, competence, inclusion, and modern civic energy.",
    typography: ["Modern bold headline", "Clean human subhead", "Optimistic action rail"],
    colors: ["Command blue", "White", "Soft red", "Fresh slate"],
    image: "Bright community, healthcare, education, environment, or candidate listening image.",
    layout: "Modern editorial layout with generous space and crisp message hierarchy.",
    tone: "optimistic, modern, credible",
  },
  "Community Focused": {
    emotionalJob: "Make the candidate feel present, known, local, and useful.",
    typography: ["Local identity headline", "County/city proof line", "Simple CTA"],
    colors: ["Navy", "White", "Community red", "Soft gray"],
    image: "Candidate in district, neighborhood, local event, or recognizably local scene.",
    layout: "Geography-led postcard with candidate identity, local proof, and action.",
    tone: "local, reassuring, specific",
  },
  "Law & Order": {
    emotionalJob: "Project safety, seriousness, duty, and calm control.",
    typography: ["High-legibility command headline", "Source-backed safety proof", "No-frills CTA"],
    colors: ["Night navy", "White", "Muted red", "Steel"],
    image: "Courthouse, community safety, candidate portrait, or verified public-safety context.",
    layout: "Strong dark front with proof-driven back and source/legal review space.",
    tone: "firm, factual, controlled",
  },
  "Unity/Future Focused": {
    emotionalJob: "Reduce polarization, create optimism, and make the campaign feel bigger than the moment.",
    typography: ["Aspirational headline", "Warm subhead", "Action-focused close"],
    colors: ["Navy", "White", "Command blue", "Restrained red"],
    image: "Families, neighborhoods, sunrise community scene, or candidate listening moment.",
    layout: "Open, cinematic front with a future-oriented back and minimal issue clutter.",
    tone: "hopeful, confident, forward-looking",
  },
};

export function selectPoliticalReachBrandMode(input: PoliticalReachCreativeInput): PoliticalReachBrandMode {
  if (input.brandMode) return input.brandMode;
  const text = [
    input.office,
    input.campaignGoal,
    input.campaignFrame,
    input.issueFocus,
    input.category,
    input.phaseObjective,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\bveteran|military|service member|navy|army|marine|air force\b/.test(text)) return "Veteran/Military";
  if (/\bsheriff|prosecutor|judge|court|safety|crime|law\b/.test(text)) return "Law & Order";
  if (/\breform|accountability|clean up|change\b/.test(text)) return "Reform Candidate";
  if (/\boutsider|business owner|entrepreneur\b/.test(text)) return "Outsider";
  if (/\bworker|working|labor|manufacturing|jobs|wages\b/.test(text)) return "Working-Class";
  if (/\bunity|future|next generation|together\b/.test(text)) return "Unity/Future Focused";
  if (/\bmayor|council|school board|county|local|community\b/.test(text)) return "Community Focused";
  if (/\bgovernor|senate|statewide|executive\b/.test(text)) return "Presidential";
  if (/\bprogressive|health|education|environment|rights\b/.test(text)) return "Progressive Modern";
  if (/\brepublican|conservative|gop\b/.test(input.partyOrCommittee ?? "")) return "Conservative Traditional";
  return "Executive Leadership";
}

export function inferPoliticalReachPostcardType(input: PoliticalReachCreativeInput): PoliticalReachPostcardType {
  const text = [input.phaseKey, input.phaseObjective, input.campaignGoal, input.category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const days = input.daysUntilElection;
  if (/\babsentee\b/.test(text)) return "Absentee Ballot";
  if (/\bearly\b/.test(text)) return "Early Voting";
  if (/\bgotv|reminder|final|vote plan|election\b/.test(text) || (typeof days === "number" && days <= 21)) return "GOTV";
  if (/\bcontrast|choice|defense|attack|record\b/.test(text)) return "Contrast Mail";
  if (/\bendorsement|testimonial|social proof|validator\b/.test(text)) return "Endorsement Mail";
  if (/\bfundraising|donate\b/.test(text)) return "Fundraising";
  if (/\bvolunteer\b/.test(text)) return "Volunteer Recruitment";
  if (/\bevent\b/.test(text)) return "Event Promotion";
  if (/\bissue|priority|policy|plan\b/.test(text)) return "Issue Mail";
  if (/\bmomentum|launch|surge\b/.test(text)) return "Momentum Messaging";
  if (/\bintroduc|name|bio|story\b/.test(text)) return "Candidate Introduction";
  if (/\blocal|county|city|district|community\b/.test(text)) return "Localized Geographic Messaging";
  return "Persuasion";
}

export function buildPoliticalReachCreativeStrategy(
  input: PoliticalReachCreativeInput,
): PoliticalReachCreativeStrategy {
  const brandMode = selectPoliticalReachBrandMode(input);
  const postcardType = inferPoliticalReachPostcardType(input);
  const rule = BRAND_MODE_RULES[brandMode];
  const shortName = input.shortName?.trim() || input.candidateName.split(/\s+/).slice(-1)[0] || input.candidateName;
  const issue = input.issueFocus?.trim() || input.campaignFrame?.trim() || "public leadership";
  const geography = input.geography?.trim() || input.state || "selected campaign geography";
  const phase = input.phaseObjective?.trim() || postcardType;

  const hierarchy = [
    "Emotional attention: one dominant headline or image moment.",
    "Candidate identity: name, office, and visual confidence must be unmistakable.",
    "Core message: one remembered idea, not a crowded issue list.",
    "Key differentiator: one proof point, quote, validator, or public record item after review.",
    "Trust reinforcement: source-backed details, disclaimer, and campaign-approved facts.",
    "Voter action: one CTA with QR or deadline path.",
  ];

  return {
    systemName: POLITICALREACH_NAME,
    brandMode,
    postcardType,
    conceptTitle: `${shortName} ${postcardType} - ${brandMode}`,
    emotionalJob: rule.emotionalJob,
    voterMemoryDevice: `${shortName} plus one clear ${issue.toLowerCase()} idea for ${geography}.`,
    hierarchy,
    typographySystem: rule.typography,
    colorSystem: rule.colors,
    imageStrategy: rule.image,
    layoutModel: rule.layout,
    copyDiscipline: [
      "One primary headline, one subheadline, one CTA.",
      "Back copy should use no more than three proof blocks before the action.",
      "No cramped issue list, no small legal text outside the reserved disclaimer zone.",
      "Every claim must be source-backed or campaign-provided before public use.",
    ],
    ctaStrategy:
      postcardType === "GOTV" || postcardType === "Early Voting" || postcardType === "Absentee Ballot"
        ? "Make the voting action obvious: date, method, QR, and campaign-approved election resource."
        : "Move the voter to one next step: learn, compare, RSVP, volunteer, donate, or make a voting plan.",
    printAndMailRules: [
      "Design front for a two-second mailbox glance.",
      "Preserve safe area, bleed, mailing panel, indicia/disclaimer, and QR quiet zone.",
      "Use high-contrast typography and avoid text over busy imagery.",
      "Keep final output human-reviewed before proof, proposal, payment, or production.",
    ],
    complianceGuardrails: [
      "Aggregate geography and campaign-approved audience context only.",
      "Do not infer individual voter beliefs or create individual persuasion scores.",
      "No deceptive synthetic content, unsupported endorsements, or unsourced contrast claims.",
      "Paid-for-by and authorization language must be finalized before print.",
    ],
    variationDirection: `Use a ${rule.tone} tone with a premium patriotic system, restrained accents, and non-template layout variation.`,
    frontPrompt: `${POLITICALREACH_NAME} front: ${rule.layout} Lead with ${shortName}, ${phase.toLowerCase()}, and one emotionally memorable ${issue.toLowerCase()} idea. Use ${rule.colors.join(", ")} and ${rule.image}`,
    backPrompt: `${POLITICALREACH_NAME} back: structure the message as proof, local relevance for ${geography}, and a single CTA. Reserve QR, source notes, mailing panel, and disclaimer space.`,
  };
}

export function formatPoliticalReachCreativeBrief(input: PoliticalReachCreativeInput): string {
  const strategy = buildPoliticalReachCreativeStrategy(input);
  return [
    `${POLITICALREACH_NAME} creative standard: ${strategy.conceptTitle}.`,
    `Emotional job: ${strategy.emotionalJob}`,
    `Memory device: ${strategy.voterMemoryDevice}`,
    `Visual hierarchy: ${strategy.hierarchy.join(" ")}`,
    `Typography: ${strategy.typographySystem.join("; ")}.`,
    `Color system: ${strategy.colorSystem.join(", ")}.`,
    `Image strategy: ${strategy.imageStrategy}`,
    `Layout: ${strategy.layoutModel}`,
    `Copy discipline: ${strategy.copyDiscipline.join(" ")}`,
    `CTA: ${strategy.ctaStrategy}`,
    `Print rules: ${strategy.printAndMailRules.join(" ")}`,
    `Compliance: ${strategy.complianceGuardrails.join(" ")}`,
  ].join("\n");
}
