import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  normalizeCoverageSearch,
  rankCoverageRoutes,
  routeLabel,
  type CoverageSearchInput,
  type NormalizedCoverageSearch,
  type PoliticalRouteSummary,
} from "./coverage-planner";

interface RouteDbRow {
  id: string;
  state: string;
  zip5: string;
  carrier_route_id: string;
  route_type: string | null;
  residential_count: number | null;
  total_count: number | null;
  county: string | null;
  city: string | null;
  source: string | null;
  source_imported_at: string | null;
}

export interface RouteCoverageResult {
  query: NormalizedCoverageSearch;
  routes: PoliticalRouteSummary[];
  totalRoutes: number;
  returnedRoutes: number;
  totalHouseholds: number;
  capped: boolean;
  note: string | null;
}

const ROUTE_COLUMNS = [
  "id",
  "state",
  "zip5",
  "carrier_route_id",
  "route_type",
  "residential_count",
  "total_count",
  "county",
  "city",
  "source",
  "source_imported_at",
].join(", ");

function toRouteSummary(row: RouteDbRow): PoliticalRouteSummary {
  const households = Math.max(0, row.residential_count ?? row.total_count ?? 0);
  const base = {
    id: row.id,
    state: row.state,
    zip5: row.zip5,
    carrierRouteId: row.carrier_route_id,
    routeType: row.route_type,
    households,
    county: row.county,
    city: row.city,
    source: row.source,
    importedAt: row.source_imported_at,
  };

  return {
    ...base,
    densityScore: 0,
    label: routeLabel(base),
  };
}

function buildCoverageNote(query: NormalizedCoverageSearch, capped: boolean): string | null {
  const notes: string[] = [];

  if (query.geographyType === "district" && !query.zip5) {
    notes.push(
      "District boundary overlay is not imported yet, so this view uses the state route catalog until a ZIP, city, or county filter is provided.",
    );
  }

  if (capped) {
    notes.push(
      `Showing the densest ${query.limit.toLocaleString()} routes first. Refine the geography to load a tighter plan.`,
    );
  }

  return notes.length > 0 ? notes.join(" ") : null;
}

export async function loadPoliticalRouteCoverage(
  input: CoverageSearchInput,
): Promise<RouteCoverageResult> {
  const query = normalizeCoverageSearch(input);

  if (!query.state) {
    return {
      query,
      routes: [],
      totalRoutes: 0,
      returnedRoutes: 0,
      totalHouseholds: 0,
      capped: false,
      note: "Enter a two-letter state code to load route coverage.",
    };
  }

  const supabase = createServiceClient();
  let request = supabase
    .from("political_routes")
    .select(ROUTE_COLUMNS, { count: "exact" })
    .eq("active", true)
    .eq("state", query.state)
    .order("total_count", { ascending: false, nullsFirst: false })
    .limit(query.limit);

  if (query.zip5) {
    request = request.eq("zip5", query.zip5);
  } else if (query.geographyType === "county" && query.geographyValue) {
    request = request.ilike("county", `%${query.geographyValue}%`);
  } else if (query.geographyType === "city" && query.geographyValue) {
    request = request.ilike("city", `%${query.geographyValue}%`);
  }

  const { data, error, count } = await request;
  if (error) {
    throw new Error(`loadPoliticalRouteCoverage: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RouteDbRow[];
  const routes = rankCoverageRoutes(rows.map(toRouteSummary));
  const totalRoutes = count ?? routes.length;

  return {
    query,
    routes,
    totalRoutes,
    returnedRoutes: routes.length,
    totalHouseholds: routes.reduce((sum, route) => sum + route.households, 0),
    capped: totalRoutes > routes.length,
    note: buildCoverageNote(query, totalRoutes > routes.length),
  };
}
