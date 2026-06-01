export type CanvaPromptFramework = {
  key: string;
  label: string;
  useCase: string;
  prompt: string;
  requiredInputs: string[];
  complianceNotes: string[];
};

export const HOMEREACH_CANVA_PROMPT_FRAMEWORKS: CanvaPromptFramework[] = [
  {
    key: "statewide_campaign_deck",
    label: "Statewide Campaign Deck",
    useCase: "Political presentation",
    requiredInputs: ["candidate_name", "office", "state", "core_message", "target_geographies", "mail_phases"],
    complianceNotes: [
      "Use aggregate geography and public campaign context only.",
      "Do not claim endorsement, voter impact, or individual persuasion scoring.",
      "Mark route counts and pricing as estimates until HomeReach quote lock.",
    ],
    prompt:
      "Create a premium statewide campaign presentation in the HomeReach brand. Make it feel presidential-level, calm, confident, and operationally superior. Use deep navy, white, muted red, silver UI accents, precise map/route visuals, and complete slide copy. Center the narrative on campaign confidence: geographic clarity, multi-wave postcard timing, cost predictability, approval checkpoints, and execution visibility.",
  },
  {
    key: "political_postcard",
    label: "Political Postcard",
    useCase: "Direct mail creative",
    requiredInputs: ["candidate_name", "phase", "headline", "cta", "geography", "disclaimer"],
    complianceNotes: [
      "Use campaign-approved facts only.",
      "Reserve disclaimer and paid-for-by zones.",
      "No deceptive synthetic content or unsupported claims.",
    ],
    prompt:
      "Design a complete front/back PoliticalReach political postcard that feels like it came from a top national campaign consulting operation, not a local print template. Build the card as an emotional persuasion asset and voter memory device: one dominant emotional attention point, unmistakable candidate identity, one core message, one key differentiator, trust reinforcement, and one voter action. Use presidential navy, restrained liberty red, matte white, steel gray, and only subtle premium patriotic accents. Prioritize bold modern typography, strong portrait or authentic community imagery, generous spacing, fast mailbox readability, QR zone, mailing panel, CTA, and compliance space. Avoid clutter, generic flags, repetitive issue lists, weak hierarchy, cheesy patriotism, and unsupported claims.",
  },
  {
    key: "shared_postcard_business",
    label: "Shared Postcard Business Spot",
    useCase: "Local business direct mail",
    requiredInputs: ["business_name", "category", "offer", "city", "phone_or_url"],
    complianceNotes: [
      "Respect city/category exclusivity and assigned spot dimensions.",
      "Do not invent offers or credentials.",
      "Keep design inside print safe areas.",
    ],
    prompt:
      "Create a clean, premium local-business postcard spot using HomeReach shared postcard rules. Prioritize instant category recognition, a clear offer, trustworthy proof, phone/URL clarity, city-local relevance, and the emotional outcome of helping a serious local business stay remembered without carrying the full advertising cost alone. Output copy and visual direction suitable for Canva template autofill.",
  },
  {
    key: "route_saturation_visual",
    label: "Route Saturation Visual",
    useCase: "Map and dashboard asset",
    requiredInputs: ["geography", "route_count", "households", "coverage_percent", "status"],
    complianceNotes: [
      "Clearly label demo/sample route data.",
      "Do not imply final USPS quote until verified.",
      "Keep data aggregate and operational.",
    ],
    prompt:
      "Create a premium operational map visual that shows route saturation, coverage, delivery confidence, and campaign readiness. The visual should create clarity and control at a glance, not clutter. Use dark-map styling, glowing route highlights, compact labels, and executive dashboard clarity.",
  },
] as const;
