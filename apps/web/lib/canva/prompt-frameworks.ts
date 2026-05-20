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
      "Create a premium statewide campaign presentation in the HomeReach brand. Make it feel presidential-level, operational, and logistics-driven. Use deep navy, white, muted red, silver UI accents, precise map/route visuals, and complete slide copy. Center the narrative on geographic saturation, multi-wave postcard timing, cost predictability, and execution visibility.",
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
      "Design a complete front/back political postcard that feels gubernatorial, premium, modern, and emotionally intelligent. Use a clear headline, human visual direction, concise back-copy hierarchy, QR zone, mailing panel, CTA, and compliance space. Avoid cheap print-shop styling.",
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
      "Create a clean, premium local-business postcard spot using HomeReach shared postcard rules. Prioritize instant category recognition, strong offer, trustworthy proof, phone/URL clarity, and city-local relevance. Output copy and visual direction suitable for Canva template autofill.",
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
      "Create a premium operational map visual that shows route saturation, coverage, delivery confidence, and campaign readiness. Use dark-map styling, glowing route highlights, compact labels, and executive dashboard clarity.",
  },
] as const;
