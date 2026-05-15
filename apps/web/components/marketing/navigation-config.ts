import { PRODUCT_OVERVIEW_PATHS } from "@/lib/marketing/product-routes";

export const platformNavItems = [
  { label: "Home", href: "/" },
  { label: "Shared Postcards", href: PRODUCT_OVERVIEW_PATHS.sharedPostcards },
  { label: "Targeted Campaigns", href: PRODUCT_OVERVIEW_PATHS.targetedCampaigns },
  { label: "Political Campaigns", href: PRODUCT_OVERVIEW_PATHS.politicalCampaigns },
  { label: "Inventory Intelligence", href: PRODUCT_OVERVIEW_PATHS.inventoryIntelligence },
  { label: "Property Intelligence", href: PRODUCT_OVERVIEW_PATHS.propertyIntelligence },
  { label: "Yard Signs", href: "/#yard-signs" },
  { label: "Door Hangers", href: "/#door-hangers" },
  { label: "Business Cards", href: "/#business-cards" },
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
    ],
  },
  {
    title: "Print Products",
    links: [
      { label: "Yard Signs", href: "/#yard-signs" },
      { label: "Door Hangers", href: "/#door-hangers" },
      { label: "Business Cards", href: "/#business-cards" },
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
