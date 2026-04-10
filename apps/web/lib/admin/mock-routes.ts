// ─────────────────────────────────────────────────────────────────────────────
// Mock Carrier Routes
// Realistic USPS-style carrier route data for 4 markets.
// Replace with Supabase + real USPS CASS data when ready.
// ─────────────────────────────────────────────────────────────────────────────

import type { CarrierRoute, TargetedCampaign } from "@/lib/engine/types";

// ── Medina, OH ────────────────────────────────────────────────────────────────

const MEDINA_ROUTES: CarrierRoute[] = [
  {
    id: "rt-med-001", cityId: "city-medina", cityName: "Medina, OH",
    routeCode: "OH-MED-C001", name: "Medina Square & Downtown",
    households: 1_842, available: true,
    demographics: { medianHomeValue: "$180k–$260k", medianIncome: "$58k–$72k", homeownerPct: 64, primaryAgeGroup: "35–54" },
    targetingFilters: { incomeRange: "50k-75k", homeValueRange: "150k-250k", zipCluster: "44256" },
  },
  {
    id: "rt-med-002", cityId: "city-medina", cityName: "Medina, OH",
    routeCode: "OH-MED-C002", name: "Weymouth & Guilford",
    households: 2_314, available: true,
    demographics: { medianHomeValue: "$240k–$340k", medianIncome: "$72k–$95k", homeownerPct: 81, primaryAgeGroup: "40–60" },
    targetingFilters: { incomeRange: "75k-100k", homeValueRange: "250k-400k", zipCluster: "44256" },
  },
  {
    id: "rt-med-003", cityId: "city-medina", cityName: "Medina, OH",
    routeCode: "OH-MED-C003", name: "Montville Township",
    households: 1_608, available: true,
    demographics: { medianHomeValue: "$290k–$420k", medianIncome: "$88k–$115k", homeownerPct: 89, primaryAgeGroup: "45–65" },
    targetingFilters: { incomeRange: "75k-100k", homeValueRange: "250k-400k", zipCluster: "44251" },
  },
  {
    id: "rt-med-004", cityId: "city-medina", cityName: "Medina, OH",
    routeCode: "OH-MED-R004", name: "Sharon Center & Seville",
    households: 2_071, available: true,
    demographics: { medianHomeValue: "$210k–$280k", medianIncome: "$65k–$82k", homeownerPct: 76, primaryAgeGroup: "35–55" },
    targetingFilters: { incomeRange: "50k-75k", homeValueRange: "150k-250k", zipCluster: "44274" },
  },
  {
    id: "rt-med-005", cityId: "city-medina", cityName: "Medina, OH",
    routeCode: "OH-MED-R005", name: "Brunswick Hills",
    households: 1_953, available: true,
    demographics: { medianHomeValue: "$265k–$370k", medianIncome: "$80k–$105k", homeownerPct: 84, primaryAgeGroup: "38–58" },
    targetingFilters: { incomeRange: "75k-100k", homeValueRange: "250k-400k", zipCluster: "44212" },
  },
  {
    id: "rt-med-006", cityId: "city-medina", cityName: "Medina, OH",
    routeCode: "OH-MED-C006", name: "Granger & Liverpool",
    households: 1_487, available: true,
    demographics: { medianHomeValue: "$320k–$490k", medianIncome: "$98k–$130k", homeownerPct: 92, primaryAgeGroup: "42–62" },
    targetingFilters: { incomeRange: "100k+", homeValueRange: "400k+", zipCluster: "44256" },
  },
  {
    id: "rt-med-007", cityId: "city-medina", cityName: "Medina, OH",
    routeCode: "OH-MED-R007", name: "Chatham & Homer",
    households: 1_224, available: true,
    demographics: { medianHomeValue: "$195k–$270k", medianIncome: "$60k–$78k", homeownerPct: 79, primaryAgeGroup: "35–55" },
    targetingFilters: { incomeRange: "50k-75k", homeValueRange: "150k-250k", zipCluster: "44253" },
  },
  {
    id: "rt-med-008", cityId: "city-medina", cityName: "Medina, OH",
    routeCode: "OH-MED-C008", name: "Medina West Industrial",
    households: 887, available: false, // unavailable — example
    demographics: { medianHomeValue: "$155k–$215k", medianIncome: "$48k–$62k", homeownerPct: 57, primaryAgeGroup: "28–48" },
    targetingFilters: { incomeRange: "50k-75k", homeValueRange: "150k-250k", zipCluster: "44256" },
  },
];

// ── Stow, OH ──────────────────────────────────────────────────────────────────

const STOW_ROUTES: CarrierRoute[] = [
  {
    id: "rt-stow-001", cityId: "city-stow", cityName: "Stow, OH",
    routeCode: "OH-STW-C001", name: "Stow Core & City Center",
    households: 2_540, available: true,
    demographics: { medianHomeValue: "$185k–$265k", medianIncome: "$62k–$80k", homeownerPct: 72, primaryAgeGroup: "33–52" },
    targetingFilters: { incomeRange: "50k-75k", homeValueRange: "150k-250k", zipCluster: "44224" },
  },
  {
    id: "rt-stow-002", cityId: "city-stow", cityName: "Stow, OH",
    routeCode: "OH-STW-C002", name: "Graham Road Corridor",
    households: 1_876, available: true,
    demographics: { medianHomeValue: "$215k–$305k", medianIncome: "$70k–$92k", homeownerPct: 78, primaryAgeGroup: "36–56" },
    targetingFilters: { incomeRange: "75k-100k", homeValueRange: "150k-250k", zipCluster: "44224" },
  },
  {
    id: "rt-stow-003", cityId: "city-stow", cityName: "Stow, OH",
    routeCode: "OH-STW-R003", name: "Fishcreek & Seasons Road",
    households: 2_182, available: true,
    demographics: { medianHomeValue: "$250k–$360k", medianIncome: "$82k–$108k", homeownerPct: 85, primaryAgeGroup: "40–60" },
    targetingFilters: { incomeRange: "75k-100k", homeValueRange: "250k-400k", zipCluster: "44224" },
  },
  {
    id: "rt-stow-004", cityId: "city-stow", cityName: "Stow, OH",
    routeCode: "OH-STW-C004", name: "Kent Road & Darrow",
    households: 1_644, available: true,
    demographics: { medianHomeValue: "$170k–$240k", medianIncome: "$55k–$72k", homeownerPct: 69, primaryAgeGroup: "30–50" },
    targetingFilters: { incomeRange: "50k-75k", homeValueRange: "150k-250k", zipCluster: "44224" },
  },
  {
    id: "rt-stow-005", cityId: "city-stow", cityName: "Stow, OH",
    routeCode: "OH-STW-R005", name: "Stow-Munroe Falls South",
    households: 2_309, available: true,
    demographics: { medianHomeValue: "$280k–$400k", medianIncome: "$90k–$120k", homeownerPct: 88, primaryAgeGroup: "42–62" },
    targetingFilters: { incomeRange: "75k-100k", homeValueRange: "250k-400k", zipCluster: "44224" },
  },
  {
    id: "rt-stow-006", cityId: "city-stow", cityName: "Stow, OH",
    routeCode: "OH-STW-C006", name: "Silver Lake Estates",
    households: 1_411, available: true,
    demographics: { medianHomeValue: "$310k–$480k", medianIncome: "$95k–$135k", homeownerPct: 91, primaryAgeGroup: "44–65" },
    targetingFilters: { incomeRange: "100k+", homeValueRange: "400k+", zipCluster: "44224" },
  },
];

// ── Hudson, OH ────────────────────────────────────────────────────────────────

const HUDSON_ROUTES: CarrierRoute[] = [
  {
    id: "rt-hud-001", cityId: "city-hudson", cityName: "Hudson, OH",
    routeCode: "OH-HUD-C001", name: "Hudson Green & Downtown",
    households: 1_692, available: true,
    demographics: { medianHomeValue: "$340k–$520k", medianIncome: "$105k–$145k", homeownerPct: 88, primaryAgeGroup: "40–62" },
    targetingFilters: { incomeRange: "100k+", homeValueRange: "400k+", zipCluster: "44236" },
  },
  {
    id: "rt-hud-002", cityId: "city-hudson", cityName: "Hudson, OH",
    routeCode: "OH-HUD-C002", name: "Boston Mills & Peninsula",
    households: 1_418, available: true,
    demographics: { medianHomeValue: "$380k–$580k", medianIncome: "$115k–$160k", homeownerPct: 92, primaryAgeGroup: "45–65" },
    targetingFilters: { incomeRange: "100k+", homeValueRange: "400k+", zipCluster: "44236" },
  },
  {
    id: "rt-hud-003", cityId: "city-hudson", cityName: "Hudson, OH",
    routeCode: "OH-HUD-R003", name: "Barlow Road & Aurora",
    households: 1_986, available: true,
    demographics: { medianHomeValue: "$295k–$410k", medianIncome: "$92k–$122k", homeownerPct: 87, primaryAgeGroup: "38–58" },
    targetingFilters: { incomeRange: "75k-100k", homeValueRange: "250k-400k", zipCluster: "44236" },
  },
  {
    id: "rt-hud-004", cityId: "city-hudson", cityName: "Hudson, OH",
    routeCode: "OH-HUD-R004", name: "Stow Road & Middleton",
    households: 1_553, available: true,
    demographics: { medianHomeValue: "$270k–$370k", medianIncome: "$84k–$110k", homeownerPct: 83, primaryAgeGroup: "36–56" },
    targetingFilters: { incomeRange: "75k-100k", homeValueRange: "250k-400k", zipCluster: "44236" },
  },
  {
    id: "rt-hud-005", cityId: "city-hudson", cityName: "Hudson, OH",
    routeCode: "OH-HUD-C005", name: "Hudson Commons & Industrial",
    households: 924, available: true,
    demographics: { medianHomeValue: "$220k–$295k", medianIncome: "$68k–$88k", homeownerPct: 74, primaryAgeGroup: "32–50" },
    targetingFilters: { incomeRange: "50k-75k", homeValueRange: "150k-250k", zipCluster: "44236" },
  },
];

// ── Akron, OH ─────────────────────────────────────────────────────────────────

const AKRON_ROUTES: CarrierRoute[] = [
  {
    id: "rt-akr-001", cityId: "city-akron", cityName: "Akron, OH",
    routeCode: "OH-AKR-C001", name: "Chapel Hill & Portage",
    households: 3_124, available: true,
    demographics: { medianHomeValue: "$155k–$225k", medianIncome: "$52k–$68k", homeownerPct: 65, primaryAgeGroup: "30–50" },
    targetingFilters: { incomeRange: "50k-75k", homeValueRange: "150k-250k", zipCluster: "44313" },
  },
  {
    id: "rt-akr-002", cityId: "city-akron", cityName: "Akron, OH",
    routeCode: "OH-AKR-C002", name: "Fairlawn & Bath Road",
    households: 2_687, available: true,
    demographics: { medianHomeValue: "$210k–$305k", medianIncome: "$72k–$95k", homeownerPct: 78, primaryAgeGroup: "38–58" },
    targetingFilters: { incomeRange: "75k-100k", homeValueRange: "150k-250k", zipCluster: "44333" },
  },
  {
    id: "rt-akr-003", cityId: "city-akron", cityName: "Akron, OH",
    routeCode: "OH-AKR-R003", name: "Copley & Revere",
    households: 2_895, available: true,
    demographics: { medianHomeValue: "$245k–$355k", medianIncome: "$80k–$108k", homeownerPct: 82, primaryAgeGroup: "40–60" },
    targetingFilters: { incomeRange: "75k-100k", homeValueRange: "250k-400k", zipCluster: "44321" },
  },
  {
    id: "rt-akr-004", cityId: "city-akron", cityName: "Akron, OH",
    routeCode: "OH-AKR-C004", name: "Ellet & Springfield",
    households: 2_441, available: true,
    demographics: { medianHomeValue: "$135k–$195k", medianIncome: "$46k–$60k", homeownerPct: 61, primaryAgeGroup: "28–48" },
    targetingFilters: { incomeRange: "50k-75k", homeValueRange: "150k-250k", zipCluster: "44312" },
  },
  {
    id: "rt-akr-005", cityId: "city-akron", cityName: "Akron, OH",
    routeCode: "OH-AKR-R005", name: "Tallmadge & Mogadore",
    households: 1_982, available: true,
    demographics: { medianHomeValue: "$175k–$250k", medianIncome: "$58k–$76k", homeownerPct: 73, primaryAgeGroup: "33–52" },
    targetingFilters: { incomeRange: "50k-75k", homeValueRange: "150k-250k", zipCluster: "44278" },
  },
  {
    id: "rt-akr-006", cityId: "city-akron", cityName: "Akron, OH",
    routeCode: "OH-AKR-C006", name: "Goodyear Heights & Firestone",
    households: 2_214, available: true,
    demographics: { medianHomeValue: "$120k–$175k", medianIncome: "$40k–$55k", homeownerPct: 58, primaryAgeGroup: "28–48" },
    targetingFilters: { incomeRange: "50k-75k", homeValueRange: "150k-250k", zipCluster: "44305" },
  },
  {
    id: "rt-akr-007", cityId: "city-akron", cityName: "Akron, OH",
    routeCode: "OH-AKR-R007", name: "Norton & Barberton",
    households: 2_668, available: true,
    demographics: { medianHomeValue: "$155k–$220k", medianIncome: "$52k–$68k", homeownerPct: 67, primaryAgeGroup: "32–52" },
    targetingFilters: { incomeRange: "50k-75k", homeValueRange: "150k-250k", zipCluster: "44203" },
  },
  {
    id: "rt-akr-008", cityId: "city-akron", cityName: "Akron, OH",
    routeCode: "OH-AKR-C008", name: "Kenmore & Coventry",
    households: 1_876, available: true,
    demographics: { medianHomeValue: "$140k–$200k", medianIncome: "$44k–$58k", homeownerPct: 60, primaryAgeGroup: "30–50" },
    targetingFilters: { incomeRange: "50k-75k", homeValueRange: "150k-250k", zipCluster: "44314" },
  },
  {
    id: "rt-akr-009", cityId: "city-akron", cityName: "Akron, OH",
    routeCode: "OH-AKR-R009", name: "Green & Uniontown",
    households: 2_533, available: true,
    demographics: { medianHomeValue: "$230k–$330k", medianIncome: "$76k–$100k", homeownerPct: 80, primaryAgeGroup: "38–58" },
    targetingFilters: { incomeRange: "75k-100k", homeValueRange: "250k-400k", zipCluster: "44232" },
  },
  {
    id: "rt-akr-010", cityId: "city-akron", cityName: "Akron, OH",
    routeCode: "OH-AKR-C010", name: "Montrose & Merriman",
    households: 1_748, available: true,
    demographics: { medianHomeValue: "$285k–$420k", medianIncome: "$92k–$125k", homeownerPct: 84, primaryAgeGroup: "42–62" },
    targetingFilters: { incomeRange: "75k-100k", homeValueRange: "250k-400k", zipCluster: "44333" },
  },
  {
    id: "rt-akr-011", cityId: "city-akron", cityName: "Akron, OH",
    routeCode: "OH-AKR-R011", name: "Cuyahoga Falls North",
    households: 2_109, available: true,
    demographics: { medianHomeValue: "$195k–$275k", medianIncome: "$65k–$85k", homeownerPct: 74, primaryAgeGroup: "35–55" },
    targetingFilters: { incomeRange: "50k-75k", homeValueRange: "150k-250k", zipCluster: "44221" },
  },
  {
    id: "rt-akr-012", cityId: "city-akron", cityName: "Akron, OH",
    routeCode: "OH-AKR-C012", name: "West Akron & Hawkins",
    households: 2_382, available: false,
    demographics: { medianHomeValue: "$115k–$165k", medianIncome: "$38k–$50k", homeownerPct: 55, primaryAgeGroup: "26–46" },
    targetingFilters: { incomeRange: "50k-75k", homeValueRange: "150k-250k", zipCluster: "44303" },
  },
];

// ── Aggregated ────────────────────────────────────────────────────────────────

export const ALL_MOCK_ROUTES: CarrierRoute[] = [
  ...MEDINA_ROUTES,
  ...STOW_ROUTES,
  ...HUDSON_ROUTES,
  ...AKRON_ROUTES,
];

export const MOCK_CITY_ROUTE_MAP: Record<string, CarrierRoute[]> = {
  "city-medina": MEDINA_ROUTES,
  "city-stow":   STOW_ROUTES,
  "city-hudson": HUDSON_ROUTES,
  "city-akron":  AKRON_ROUTES,
};

// ── Campaign Cities for selector ──────────────────────────────────────────────

export const CAMPAIGN_CITIES = [
  { id: "city-medina", name: "Medina, OH",  totalRoutes: MEDINA_ROUTES.filter((r) => r.available).length, totalHomes: MEDINA_ROUTES.filter((r) => r.available).reduce((s, r) => s + r.households, 0) },
  { id: "city-stow",   name: "Stow, OH",    totalRoutes: STOW_ROUTES.filter((r) => r.available).length,   totalHomes: STOW_ROUTES.filter((r) => r.available).reduce((s, r) => s + r.households, 0) },
  { id: "city-hudson", name: "Hudson, OH",  totalRoutes: HUDSON_ROUTES.filter((r) => r.available).length, totalHomes: HUDSON_ROUTES.filter((r) => r.available).reduce((s, r) => s + r.households, 0) },
  { id: "city-akron",  name: "Akron, OH",   totalRoutes: AKRON_ROUTES.filter((r) => r.available).length,  totalHomes: AKRON_ROUTES.filter((r) => r.available).reduce((s, r) => s + r.households, 0) },
];

// ── Mock Existing Campaigns ───────────────────────────────────────────────────

export const MOCK_TARGETED_CAMPAIGNS: TargetedCampaign[] = [
  {
    id: "tc-1",
    campaignType: "targeted",
    businessId: "biz-1",
    businessName: "Harrington Plumbing",
    contactName: "Mike Harrington",
    phone: "+13303041111",
    email: "mike@harringtonplumbing.com",
    cityId: "city-medina",
    city: "Medina, OH",
    selectedRouteIds: ["rt-med-002", "rt-med-003", "rt-med-005"],
    totalHouseholds: 5_875,
    pricePerThousand: 37,
    totalPrice: 217,
    pricingTierLabel: "Growth",
    targetingFilters: { homeValueRange: "250k-400k" },
    status: "active",
    createdAt: "2026-03-15T10:00:00Z",
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    notes: "Targeting higher-value homes in Medina for plumbing service ads.",
    appearsInAdminDashboard: true,
    appearsInClientDashboard: true,
    metrics: {
      homesReached: 5_875,
      responseRate: 1.4,
      leadsGenerated: 82,
      estimatedROI: 2_460,
    },
  },
  {
    id: "tc-2",
    campaignType: "targeted",
    businessId: "biz-9",
    businessName: "Frost Realty",
    contactName: "Angela Frost",
    phone: "+13303048888",
    email: "angela@frostrealty.com",
    cityId: "city-hudson",
    city: "Hudson, OH",
    selectedRouteIds: ["rt-hud-001", "rt-hud-002"],
    totalHouseholds: 3_110,
    pricePerThousand: 40,
    totalPrice: 124,
    pricingTierLabel: "Starter",
    targetingFilters: { homeValueRange: "400k+", incomeRange: "100k+" },
    status: "pending_review",
    createdAt: "2026-04-07T15:00:00Z",
    notes: "Premium Hudson neighborhoods — targeting luxury home buyers.",
    appearsInAdminDashboard: true,
    appearsInClientDashboard: false,
  },
];
