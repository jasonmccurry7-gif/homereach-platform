import { PRODUCT_OVERVIEW_PATHS } from "@/lib/marketing/product-routes";

export const platformNavItems = [
  { label: "AI Growth OS", href: PRODUCT_OVERVIEW_PATHS.aiGrowthOs },
  { label: "Market Capture", href: "/#market-capture" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Targeting", href: "/#targeting-options" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Direct Mail", href: "/#direct-mail" },
  { label: "Ecosystem", href: "/#ecosystem" },
  { label: "Cost Control", href: PRODUCT_OVERVIEW_PATHS.inventoryIntelligence },
] as const;

export const targetedNavItems = [
  { label: "How It Works", href: "/targeted#how-it-works" },
  { label: "Packages", href: "/targeted#packages" },
  { label: "AI Guidance", href: "/targeted#ai-assistance" },
  { label: "Trust", href: "/targeted#trust-builders" },
  { label: "Shared Campaigns", href: PRODUCT_OVERVIEW_PATHS.sharedPostcards },
] as const;

export const digitalTargetingNavItems = [
  { label: "How It Works", href: `${PRODUCT_OVERVIEW_PATHS.marketCapture}#how-it-works` },
  { label: "Targeting", href: `${PRODUCT_OVERVIEW_PATHS.marketCapture}#targeting-options` },
  { label: "Direct Mail", href: `${PRODUCT_OVERVIEW_PATHS.marketCapture}#direct-mail` },
  { label: "Pricing", href: `${PRODUCT_OVERVIEW_PATHS.marketCapture}#pricing` },
  { label: "FAQ", href: `${PRODUCT_OVERVIEW_PATHS.marketCapture}#faq` },
] as const;

export const growthNavItems = [
  { label: "AI Growth OS", href: PRODUCT_OVERVIEW_PATHS.aiGrowthOs },
  { label: "AI Web Assistant", href: PRODUCT_OVERVIEW_PATHS.aiWebsiteAssistant },
  { label: "Local Visibility", href: PRODUCT_OVERVIEW_PATHS.localVisibility },
  { label: "Social Content", href: PRODUCT_OVERVIEW_PATHS.socialContent },
  { label: "Shared Campaigns", href: PRODUCT_OVERVIEW_PATHS.sharedPostcards },
  { label: "Targeted Campaigns", href: PRODUCT_OVERVIEW_PATHS.targetedCampaigns },
] as const;

export const footerLinkGroups = [
  {
    title: "Platforms",
    links: [
      { label: "Shared Postcards", href: PRODUCT_OVERVIEW_PATHS.sharedPostcards },
      { label: "Targeted Campaigns", href: PRODUCT_OVERVIEW_PATHS.targetedCampaigns },
      { label: "Market Capture", href: PRODUCT_OVERVIEW_PATHS.marketCapture },
      { label: "Political Campaigns", href: PRODUCT_OVERVIEW_PATHS.politicalCampaigns },
      { label: "AI Growth OS", href: PRODUCT_OVERVIEW_PATHS.aiGrowthOs },
      { label: "Inventory Intelligence", href: PRODUCT_OVERVIEW_PATHS.inventoryIntelligence },
      { label: "Property Intelligence", href: PRODUCT_OVERVIEW_PATHS.propertyIntelligence },
      { label: "Local Visibility", href: PRODUCT_OVERVIEW_PATHS.localVisibility },
      { label: "Government Contracts", href: PRODUCT_OVERVIEW_PATHS.governmentContracts },
      { label: "ContractOS", href: PRODUCT_OVERVIEW_PATHS.contractOS },
    ],
  },
  {
    title: "Growth Services",
    links: [
      { label: "AI Web Assistant", href: PRODUCT_OVERVIEW_PATHS.aiWebsiteAssistant },
      { label: "Local SEO", href: PRODUCT_OVERVIEW_PATHS.localSeo },
      { label: "Reputation", href: PRODUCT_OVERVIEW_PATHS.reputation },
      { label: "Social Content", href: PRODUCT_OVERVIEW_PATHS.socialContent },
      { label: "All Services", href: PRODUCT_OVERVIEW_PATHS.services },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "How It Works", href: "/how-it-works" },
      { label: "Login", href: "/login" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
] as const;
