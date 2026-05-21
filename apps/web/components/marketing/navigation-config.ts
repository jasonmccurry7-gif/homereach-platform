import { PRODUCT_OVERVIEW_PATHS } from "@/lib/marketing/product-routes";

export const platformNavItems = [
  { label: "Home", href: "/" },
  { label: "Shared Campaigns", href: PRODUCT_OVERVIEW_PATHS.sharedPostcards },
  { label: "Targeted Campaigns", href: PRODUCT_OVERVIEW_PATHS.targetedCampaigns },
  { label: "Political", href: PRODUCT_OVERVIEW_PATHS.politicalCampaigns },
  { label: "Procurement", href: PRODUCT_OVERVIEW_PATHS.inventoryIntelligence },
  { label: "Government Contracts", href: PRODUCT_OVERVIEW_PATHS.governmentContracts },
  { label: "AI Website Assistant", href: PRODUCT_OVERVIEW_PATHS.aiWebsiteAssistant },
  { label: "Reputation", href: PRODUCT_OVERVIEW_PATHS.reputation },
  { label: "Local SEO", href: PRODUCT_OVERVIEW_PATHS.localSeo },
  { label: "Contact / Demo", href: PRODUCT_OVERVIEW_PATHS.services },
] as const;

export const footerLinkGroups = [
  {
    title: "Platforms",
    links: [
      { label: "Shared Postcards", href: PRODUCT_OVERVIEW_PATHS.sharedPostcards },
      { label: "Targeted Campaigns", href: PRODUCT_OVERVIEW_PATHS.targetedCampaigns },
      { label: "Political Campaigns", href: PRODUCT_OVERVIEW_PATHS.politicalCampaigns },
      { label: "Inventory Intelligence", href: PRODUCT_OVERVIEW_PATHS.inventoryIntelligence },
      { label: "Property Intelligence", href: PRODUCT_OVERVIEW_PATHS.propertyIntelligence },
      { label: "Government Contracts", href: PRODUCT_OVERVIEW_PATHS.governmentContracts },
    ],
  },
  {
    title: "Growth Services",
    links: [
      { label: "AI Website Assistant", href: PRODUCT_OVERVIEW_PATHS.aiWebsiteAssistant },
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
