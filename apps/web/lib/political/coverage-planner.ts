export type CoverageGeographyType = "state" | "county" | "city" | "district";

export interface PoliticalRouteSummary {
  id: string;
  state: string;
  zip5: string;
  carrierRouteId: string;
  routeType: string | null;
  households: number;
  county: string | null;
  city: string | null;
  source: string | null;
  importedAt: string | null;
  densityScore: number;
  label: string;
}

export interface CoverageSearchInput {
  state?: string | null;
  geographyType?: CoverageGeographyType | null;
  geographyValue?: string | null;
  limit?: number | null;
}

export interface NormalizedCoverageSearch {
  state: string;
  geographyType: CoverageGeographyType;
  geographyValue: string;
  zip5: string | null;
  limit: number;
}

export interface CoverageSelectionSummary {
  availableRouteCount: number;
  selectedRouteCount: number;
  availableHouseholds: number;
  selectedHouseholds: number;
  coveragePct: number;
  gapRouteCount: number;
  gapHouseholds: number;
  zipCount: number;
  averageHouseholdsPerRoute: number;
}

const DEFAULT_ROUTE_LIMIT = 120;
const MAX_ROUTE_LIMIT = 250;

function cleanString(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 10_000) / 100;
}

function clampLimit(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? Number.NaN)) return DEFAULT_ROUTE_LIMIT;
  return Math.min(MAX_ROUTE_LIMIT, Math.max(1, Math.floor(value ?? DEFAULT_ROUTE_LIMIT)));
}

export function normalizeCoverageSearch(input: CoverageSearchInput): NormalizedCoverageSearch {
  const geographyValue = cleanString(input.geographyValue);
  const zip5 = geographyValue.match(/\b\d{5}\b/)?.[0] ?? null;
  const geographyType =
    input.geographyType === "county" ||
    input.geographyType === "city" ||
    input.geographyType === "district"
      ? input.geographyType
      : "state";

  return {
    state: cleanString(input.state).toUpperCase().slice(0, 2),
    geographyType,
    geographyValue,
    zip5,
    limit: clampLimit(input.limit),
  };
}

export function routeLabel(route: Omit<PoliticalRouteSummary, "label" | "densityScore">): string {
  const place = [route.city, route.county].filter(Boolean).join(", ");
  return `${route.zip5}-${route.carrierRouteId}${place ? ` - ${place}` : ""}`;
}

export function rankCoverageRoutes(routes: PoliticalRouteSummary[]): PoliticalRouteSummary[] {
  const maxHouseholds = routes.reduce((max, route) => Math.max(max, route.households), 0);

  return routes
    .map((route) => ({
      ...route,
      densityScore: maxHouseholds > 0 ? Math.round((route.households / maxHouseholds) * 100) : 0,
      label: route.label || routeLabel(route),
    }))
    .sort((a, b) => {
      if (b.households !== a.households) return b.households - a.households;
      if (a.zip5 !== b.zip5) return a.zip5.localeCompare(b.zip5);
      return a.carrierRouteId.localeCompare(b.carrierRouteId);
    });
}

export function summarizeCoverageSelection(
  routes: PoliticalRouteSummary[],
  selectedRouteIds: Iterable<string>,
): CoverageSelectionSummary {
  const selected = new Set(selectedRouteIds);
  const selectedRoutes = routes.filter((route) => selected.has(route.id));
  const availableHouseholds = routes.reduce((sum, route) => sum + route.households, 0);
  const selectedHouseholds = selectedRoutes.reduce((sum, route) => sum + route.households, 0);

  return {
    availableRouteCount: routes.length,
    selectedRouteCount: selectedRoutes.length,
    availableHouseholds,
    selectedHouseholds,
    coveragePct: pct(selectedHouseholds, availableHouseholds),
    gapRouteCount: Math.max(0, routes.length - selectedRoutes.length),
    gapHouseholds: Math.max(0, availableHouseholds - selectedHouseholds),
    zipCount: new Set(routes.map((route) => route.zip5)).size,
    averageHouseholdsPerRoute:
      routes.length > 0 ? Math.round(availableHouseholds / routes.length) : 0,
  };
}

export function routesToStrategyRoutes(routes: PoliticalRouteSummary[]) {
  return routes.map((route) => ({
    id: route.id,
    label: route.label,
    households: route.households,
    densityScore: route.densityScore,
  }));
}
