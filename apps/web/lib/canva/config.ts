export type CanvaEngineMode = "not_configured" | "configured" | "live_token_ready";

export type CanvaTemplateUseCase =
  | "political_deck"
  | "campaign_postcard"
  | "business_postcard"
  | "proposal_deck"
  | "dashboard_visual"
  | "social_graphic"
  | "map_report";

export type CanvaTemplateDefinition = {
  key: string;
  label: string;
  useCase: CanvaTemplateUseCase;
  envVar: string;
  description: string;
  requiredFields: string[];
  recommendedExportTypes: CanvaExportType[];
};

export type CanvaExportType =
  | "pdf"
  | "png"
  | "jpg"
  | "pptx"
  | "csv"
  | "gif"
  | "mp4"
  | "html_bundle"
  | "html_standalone";

export type CanvaFolderDefinition = {
  path: string;
  purpose: string;
};

export const CANVA_OAUTH_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
export const CANVA_OAUTH_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
export const CANVA_CONNECT_API_BASE_URL = "https://api.canva.com/rest/v1";

export const HOMEREACH_CANVA_SCOPES = [
  "profile:read",
  "asset:read",
  "asset:write",
  "brandtemplate:meta:read",
  "brandtemplate:content:read",
  "design:meta:read",
  "design:content:read",
  "design:content:write",
  "folder:read",
  "folder:write",
  "folder:permission:write",
  "comment:read",
  "comment:write",
] as const;

export const HOMEREACH_CANVA_BRAND_SYSTEM = {
  name: "HomeReach Master Brand System",
  typography: {
    headline: "Premium geometric sans, 800-900 weight",
    subheading: "Modern sans, 600-700 weight",
    body: "Readable sans, 400-500 weight",
    operationalLabel: "Uppercase tracking labels, 700-900 weight",
  },
  colors: {
    coreNavy: "#061126",
    commandNavy: "#0B1730",
    royalBlue: "#2563EB",
    electricBlue: "#38BDF8",
    mutedRed: "#DC2626",
    softRed: "#FCA5A5",
    white: "#FFFFFF",
    silver: "#E5E7EB",
    slate: "#64748B",
    success: "#10B981",
    warning: "#F59E0B",
  },
  politicalStandards: [
    "Gubernatorial, premium, emotionally intelligent, and modern.",
    "Use subtle patriotic accents, not loud clip-art styling.",
    "Route and geography visuals must look operational, not decorative.",
    "Never imply campaign approval, endorsement, or unsupported voter impact.",
  ],
} as const;

export const HOMEREACH_CANVA_FOLDERS: CanvaFolderDefinition[] = [
  { path: "HomeReach/Brand System", purpose: "Core logo, colors, typography, icons, and reusable visual rules." },
  { path: "HomeReach/Templates/Political Decks", purpose: "Statewide, county, city, targeting, and donor presentation templates." },
  { path: "HomeReach/Templates/Postcards", purpose: "Political, shared postcard, targeted campaign, and local business postcard templates." },
  { path: "HomeReach/Templates/Proposals", purpose: "Client proposals, campaign summaries, and executive reports." },
  { path: "HomeReach/Templates/Social", purpose: "Facebook, Instagram, testimonial, founder story, and campaign social graphics." },
  { path: "HomeReach/Templates/Dashboard Assets", purpose: "KPI panels, operating-system visuals, route overlays, and map support graphics." },
  { path: "HomeReach/Campaigns/Political/Statewide", purpose: "Statewide candidate and party campaign working folders." },
  { path: "HomeReach/Campaigns/Political/Local", purpose: "County, city, township, and district campaign assets." },
  { path: "HomeReach/Campaigns/Shared Postcards", purpose: "City/category shared postcard creative and client proofs." },
  { path: "HomeReach/Exports/PDF", purpose: "Client-ready PDFs and proposal exports." },
  { path: "HomeReach/Exports/Print Ready", purpose: "Final print-approved postcard exports after human approval." },
  { path: "HomeReach/Exports/Social", purpose: "PNG/JPG social and website asset exports." },
] as const;

export const HOMEREACH_CANVA_TEMPLATES: CanvaTemplateDefinition[] = [
  {
    key: "political_statewide_deck",
    label: "Political Statewide Campaign Deck",
    useCase: "political_deck",
    envVar: "CANVA_TEMPLATE_POLITICAL_STATEWIDE_DECK",
    description: "Presidential-level strategy deck for statewide candidate, party, or ballot campaign presentations.",
    requiredFields: ["candidate_name", "race_name", "strategy_title", "targeting_summary", "phase_table", "cost_summary"],
    recommendedExportTypes: ["pdf", "pptx", "png"],
  },
  {
    key: "political_postcard_front_back",
    label: "Political Postcard Front/Back",
    useCase: "campaign_postcard",
    envVar: "CANVA_TEMPLATE_POLITICAL_POSTCARD",
    description: "Editable 9x12 or 6x11 political direct-mail postcard with front/back message zones.",
    requiredFields: ["headline", "subheadline", "body_copy", "cta", "disclaimer", "qr_url", "candidate_name"],
    recommendedExportTypes: ["pdf", "png", "jpg"],
  },
  {
    key: "shared_postcard_business_spot",
    label: "Shared Postcard Business Spot",
    useCase: "business_postcard",
    envVar: "CANVA_TEMPLATE_SHARED_POSTCARD_SPOT",
    description: "City/category shared postcard spot for local business client creative.",
    requiredFields: ["business_name", "headline", "offer", "phone", "website", "logo_or_image"],
    recommendedExportTypes: ["pdf", "png", "jpg"],
  },
  {
    key: "campaign_proposal",
    label: "Campaign Proposal Presentation",
    useCase: "proposal_deck",
    envVar: "CANVA_TEMPLATE_CAMPAIGN_PROPOSAL",
    description: "Proposal deck connecting route strategy, price model, creative, approvals, and fulfillment plan.",
    requiredFields: ["client_name", "campaign_goal", "geography", "quantity", "price", "timeline"],
    recommendedExportTypes: ["pdf", "pptx"],
  },
  {
    key: "route_saturation_report",
    label: "Route Saturation Report",
    useCase: "map_report",
    envVar: "CANVA_TEMPLATE_ROUTE_SATURATION_REPORT",
    description: "Map and route-density report for county, city, ZIP, USPS route, or district planning.",
    requiredFields: ["map_image", "route_table", "household_count", "coverage_percent", "risk_notes"],
    recommendedExportTypes: ["pdf", "png"],
  },
  {
    key: "dashboard_visual_card",
    label: "Dashboard Visual Card",
    useCase: "dashboard_visual",
    envVar: "CANVA_TEMPLATE_DASHBOARD_VISUAL_CARD",
    description: "Reusable visual asset for KPI cards, command-center graphics, and executive dashboard visuals.",
    requiredFields: ["metric_label", "metric_value", "status", "supporting_context"],
    recommendedExportTypes: ["png", "jpg"],
  },
] as const;

export function getCanvaTemplateId(template: CanvaTemplateDefinition) {
  return process.env[template.envVar]?.trim() || null;
}

export function getCanvaAccessToken(explicitToken?: string | null) {
  return explicitToken?.trim() || process.env.CANVA_ACCESS_TOKEN?.trim() || null;
}

export function getCanvaConfigStatus(): {
  mode: CanvaEngineMode;
  missingRequired: string[];
  configuredTemplates: Array<{ key: string; label: string; templateId: string | null }>;
  oauthRedirectUri: string | null;
  scopes: string[];
} {
  const required = ["CANVA_CLIENT_ID", "CANVA_CLIENT_SECRET", "CANVA_REDIRECT_URI"];
  const missingRequired = required.filter((key) => !process.env[key]?.trim());
  const hasToken = Boolean(getCanvaAccessToken());
  const mode: CanvaEngineMode = hasToken
    ? "live_token_ready"
    : missingRequired.length === 0
      ? "configured"
      : "not_configured";

  return {
    mode,
    missingRequired,
    configuredTemplates: HOMEREACH_CANVA_TEMPLATES.map((template) => ({
      key: template.key,
      label: template.label,
      templateId: getCanvaTemplateId(template),
    })),
    oauthRedirectUri: process.env.CANVA_REDIRECT_URI?.trim() || null,
    scopes: [...HOMEREACH_CANVA_SCOPES],
  };
}

export function getCanvaTemplateByKey(key: string) {
  return HOMEREACH_CANVA_TEMPLATES.find((template) => template.key === key) ?? null;
}
