import { getOwnerIdentity } from "@homereach/services/outreach";

export type HomeReachPersonaKey = "jason" | "josh" | "chelsi" | "heather";

export type HomeReachPersona = {
  key: HomeReachPersonaKey;
  name: string;
  email: string;
  role: string;
  focusAreas: string[];
  tone: string[];
  pacing: string;
  formatting: string;
  ctaStyle: string;
  politicalPriority: "primary" | "support" | "none";
  procurementPriority: "primary" | "support" | "none";
  openingLines: string[];
  valueLines: string[];
  ctas: string[];
  signoffs: string[];
  subjectPatterns: string[];
};

const ownerIdentity = getOwnerIdentity();

export const HOMEREACH_PERSONAS: Record<HomeReachPersonaKey, HomeReachPersona> = {
  jason: {
    key: "jason",
    name: ownerIdentity.name,
    email: ownerIdentity.domainEmail,
    role: "Founder / Operations Executive / Strategic Campaign Execution Partner",
    focusAreas: [
      "political campaigns",
      "statewide and high-value candidates",
      "campaign manager conversations",
      "proposal approvals",
      "strategic operational conversations",
    ],
    tone: ["operational", "executive", "concise", "credible", "strategy-focused"],
    pacing: "Deliberate, lower-volume, highest-value political and strategic outreach first.",
    formatting: "Short paragraphs, clear operational framing, direct next step.",
    ctaStyle: "Ask for a route/pricing review or a quick strategic walkthrough.",
    politicalPriority: "primary",
    procurementPriority: "none",
    openingLines: [
      "I put together a four-option mail planning snapshot so your team can compare the practical paths quickly.",
      "I wanted to make the mail decision easier to review: reach, geography, timing, and execution risk in one place.",
      "I built this as an execution view, not a generic mail pitch.",
    ],
    valueLines: [
      "The goal is to give the campaign a visible mail plan before staff has to rebuild route, timing, and cost assumptions from scratch.",
      "It is designed around operational clarity: where mail goes, how much voter reach it creates, and what has to be approved before production.",
      "This keeps the conversation focused on execution, geography, and timing instead of guesswork.",
    ],
    ctas: [
      "Would it be useful if I sent the voter-reach and route summary for review?",
      "If this is worth a look, I can walk through the cleanest option and the approval path.",
      "The easiest next step is a quick review of the four options and which one fits the calendar.",
    ],
    signoffs: [
      ownerIdentity.name.split(/\s+/)[0] ?? ownerIdentity.name,
      ownerIdentity.name,
      `${ownerIdentity.name}\nHomeReach Political Mail`,
    ],
    subjectPatterns: [
      "{{candidate_name}} mail plan options ready",
      "{{candidate_name}} campaign mail execution view",
      "Four mail paths for {{candidate_name}}",
    ],
  },
  josh: {
    key: "josh",
    name: "Josh HomeReach",
    email: "josh@home-reach.com",
    role: "Campaign and local growth outreach partner",
    focusAreas: [
      "local businesses",
      "shared postcard campaigns",
      "targeted neighborhood campaigns",
      "fast first-touch prospecting",
      "lower-risk campaign follow-up",
    ],
    tone: ["direct", "practical", "confident", "slightly casual", "action-oriented"],
    pacing: "Shorter, quicker follow-up cadence with simple decision points.",
    formatting: "Short messages, fewer sections, fast CTA.",
    ctaStyle: "Ask whether they want the quick version or a walkthrough.",
    politicalPriority: "support",
    procurementPriority: "none",
    openingLines: [
      "I pulled together a quick four-option campaign mail view for your team.",
      "I wanted to make this easy to scan before anyone spends time sorting through mail details.",
      "Quick note from HomeReach: there are four practical mail paths worth comparing.",
    ],
    valueLines: [
      "It shows the main tradeoffs clearly: voter reach, geographic focus, timing, and execution risk.",
      "The point is to help the campaign make a faster call without rebuilding the plan from scratch.",
      "Each option is built to be easy to review and easy to move into a real proposal if it fits.",
    ],
    ctas: [
      "Want me to send the quick route summary?",
      "Would a quick walkthrough help?",
      "Should I send the simplest recommended option?",
    ],
    signoffs: ["Josh", "Josh\nHomeReach", "Josh HomeReach"],
    subjectPatterns: [
      "Quick mail options for {{candidate_name}}",
      "{{candidate_name}} - quick campaign mail view",
      "Four simple mail options for {{candidate_name}}",
    ],
  },
  chelsi: {
    key: "chelsi",
    name: "Chelsi HomeReach",
    email: "chelsi@home-reach.com",
    role: "Client onboarding and procurement follow-up partner",
    focusAreas: [
      "customer follow-up",
      "onboarding",
      "procurement demos",
      "local SMB nurturing",
      "supportive savings review communication",
    ],
    tone: ["friendly", "organized", "approachable", "professional", "supportive"],
    pacing: "Warm, slightly softer follow-up cadence with clear reassurance.",
    formatting: "Polished, easy-to-read paragraphs with low-friction CTA.",
    ctaStyle: "Offer to send the simple intake or help them see whether there is a savings fit.",
    politicalPriority: "none",
    procurementPriority: "support",
    openingLines: [
      "I am reaching out because many owners are seeing supplier costs move without having time to track every change.",
      "HomeReach helps make recurring supply costs easier to understand without adding another task to your week.",
      "I wanted to share a simple way to check whether supplier price drift is quietly affecting your margins.",
    ],
    valueLines: [
      "We can turn receipts, invoices, and inventory lists into a simple savings view with the clearest next steps.",
      "The process is meant to be done-for-you: you send what you already have, and we organize the savings picture.",
      "The dashboard keeps the focus on urgent issues, savings opportunities, and what is worth approving.",
    ],
    ctas: [
      "Would you like me to send the short intake?",
      "Would it help to see what the savings review looks like?",
      "If useful, I can send the easiest way to get started.",
    ],
    signoffs: ["Chelsi", "Chelsi\nHomeReach", "Chelsi HomeReach"],
    subjectPatterns: [
      "A simple supply savings review for {{business_name}}",
      "{{business_name}} supplier cost check",
      "Could HomeReach find hidden supply savings for {{business_name}}?",
    ],
  },
  heather: {
    key: "heather",
    name: "Heather HomeReach",
    email: "heather@home-reach.com",
    role: "Procurement savings and operational efficiency advisor",
    focusAreas: [
      "procurement system",
      "business efficiency",
      "inventory savings",
      "operational improvement",
      "premium client relationships",
    ],
    tone: ["polished", "premium", "composed", "business-oriented", "detail-aware"],
    pacing: "Measured, credibility-focused procurement outreach with structured follow-up.",
    formatting: "Medium-length, structured, ROI and efficiency framed.",
    ctaStyle: "Ask for a savings review or permission to send a clear benchmark view.",
    politicalPriority: "none",
    procurementPriority: "primary",
    openingLines: [
      "I am reaching out because recurring supply costs can quietly reduce margin before owners can see where it is happening.",
      "HomeReach is helping small businesses identify hidden purchasing waste with a simple, done-for-you savings review.",
      "I wanted to introduce a practical way to compare supplier spend, invoice changes, delivery fees, and reorder patterns.",
    ],
    valueLines: [
      "The objective is not procurement complexity. It is a clear savings rollup: what changed, what is overpriced, what is urgent, and what is worth approving.",
      "We benchmark current invoices against available supplier pricing and show the savings opportunity in plain language.",
      "This gives owners more control over margin without asking them to manage a complicated purchasing system.",
    ],
    ctas: [
      "Would a done-for-you supply savings review be useful?",
      "Would you like me to send the short intake for a savings benchmark?",
      "If this is worth exploring, I can send the simple next step.",
    ],
    signoffs: ["Heather", "Heather HomeReach", "Heather\nHomeReach Procurement"],
    subjectPatterns: [
      "Hidden supply savings at {{business_name}}",
      "{{business_name}} procurement savings review",
      "Supplier overspending check for {{business_name}}",
    ],
  },
};

export function personaForEmail(email: string | null | undefined): HomeReachPersona {
  const normalized = email?.trim().toLowerCase();
  return Object.values(HOMEREACH_PERSONAS).find((persona) => persona.email.trim().toLowerCase() === normalized) ?? HOMEREACH_PERSONAS.jason;
}

function stableIndex(seed: string, length: number): number {
  if (length <= 0) return 0;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % length;
}

export function pickPersonaText(values: string[], seed: string): string {
  return values[stableIndex(seed, values.length)] ?? values[0] ?? "";
}

export function renderPersonaTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => vars[key] ?? "");
}

export function personaTemplateVars(
  persona: HomeReachPersona,
  input: {
    seed: string;
    candidateName?: string | null;
    businessName?: string | null;
  },
): Record<string, string> {
  const vars = {
    candidate_name: input.candidateName ?? "the campaign",
    business_name: input.businessName ?? "your business",
  };
  return {
    communication_persona: persona.key,
    persona_role: persona.role,
    persona_tone: persona.tone.join(", "),
    persona_pacing: persona.pacing,
    persona_formatting: persona.formatting,
    persona_opening_line: renderPersonaTemplate(pickPersonaText(persona.openingLines, `${input.seed}:open`), vars),
    persona_value_line: renderPersonaTemplate(pickPersonaText(persona.valueLines, `${input.seed}:value`), vars),
    persona_cta: renderPersonaTemplate(pickPersonaText(persona.ctas, `${input.seed}:cta`), vars),
    persona_signoff: renderPersonaTemplate(pickPersonaText(persona.signoffs, `${input.seed}:signoff`), vars),
    persona_subject: renderPersonaTemplate(pickPersonaText(persona.subjectPatterns, `${input.seed}:subject`), vars),
  };
}

export function communicationPolicyMetadata(persona: HomeReachPersona) {
  return {
    communication_persona: persona.key,
    communication_role: persona.role,
    communication_tone: persona.tone,
    communication_pacing: persona.pacing,
    communication_formatting: persona.formatting,
    communication_cta_style: persona.ctaStyle,
    messaging_diversity_required: true,
    duplicate_copy_block_required: true,
    human_approval_required: true,
  };
}

export type PoliticalCandidateLike = {
  id?: string | null;
  candidateName?: string | null;
  officeSought?: string | null;
  geographyType?: string | null;
  districtType?: string | null;
  priorityScore?: number | null;
};

export function isHighValuePoliticalCandidate(candidate: PoliticalCandidateLike): boolean {
  const office = `${candidate.officeSought ?? ""} ${candidate.geographyType ?? ""} ${candidate.districtType ?? ""}`.toLowerCase();
  return (
    office.includes("governor") ||
    office.includes("senate") ||
    office.includes("attorney general") ||
    office.includes("secretary of state") ||
    office.includes("auditor") ||
    office.includes("treasurer") ||
    office.includes("supreme court") ||
    office.includes("congress") ||
    office.includes("u.s.") ||
    office.includes("statewide") ||
    candidate.geographyType === "state" ||
    candidate.districtType === "federal" ||
    Number(candidate.priorityScore ?? 0) >= 80
  );
}

export function selectPoliticalSenderPersona(candidate: PoliticalCandidateLike): HomeReachPersona {
  if (isHighValuePoliticalCandidate(candidate)) return HOMEREACH_PERSONAS.jason;
  const seed = `${candidate.id ?? ""}:${candidate.candidateName ?? ""}:${candidate.officeSought ?? ""}`;
  return stableIndex(seed, 3) === 0 ? HOMEREACH_PERSONAS.josh : HOMEREACH_PERSONAS.jason;
}
