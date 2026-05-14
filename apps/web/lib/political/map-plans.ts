import { createServiceClient } from "@/lib/supabase/service";
import {
  MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS,
  POLITICAL_POSTCARD_POSTAGE_ESTIMATE_CENTS,
  POLITICAL_POSTCARD_PRINT_ESTIMATE_CENTS,
} from "./pricing-config";

type DataConfidenceInput =
  | "Exact"
  | "Estimated"
  | "Demo/Sample"
  | "User-Provided"
  | "Public Aggregate"
  | "Paid Vendor Data"
  | "Unavailable"
  | string;

interface PublicMapRouteInput {
  id?: unknown;
  label?: unknown;
  zip5?: unknown;
  carrierRouteId?: unknown;
  households?: unknown;
  deliveryPoints?: unknown;
  confidence?: DataConfidenceInput;
}

interface PublicMapGeographyInput {
  id?: unknown;
  label?: unknown;
  mode?: unknown;
  households?: unknown;
  confidence?: DataConfidenceInput;
  source?: unknown;
}

export interface SavePublicMapPlanInput {
  state?: unknown;
  mode?: unknown;
  dropCount?: unknown;
  selectedLayers?: unknown;
  selectedRoutes?: unknown;
  selectedPoliticalGeographies?: unknown;
  health?: unknown;
  recommendations?: unknown;
  timeline?: unknown;
  liveFeed?: unknown;
  stats?: unknown;
  generatedAt?: unknown;
}

export interface SavePublicMapPlanResult {
  ok: boolean;
  stored: "database" | "local_only";
  planId?: string;
  sessionId?: string;
  reason?: string;
}

const CONFIDENCE_TO_DB: Record<string, string> = {
  Exact: "exact",
  Estimated: "estimated",
  "Demo/Sample": "demo_sample",
  "User-Provided": "user_provided",
  "Public Aggregate": "public_aggregate",
  "Paid Vendor Data": "paid_vendor_data",
  Unavailable: "unavailable",
};

function text(value: unknown, max = 220): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function positiveInt(value: unknown, fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.round(num));
}

function moneyCents(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.round(num * 100));
}

function dataConfidence(value: unknown): string {
  if (typeof value !== "string") return "unavailable";
  return CONFIDENCE_TO_DB[value] ?? "unavailable";
}

function arrayOfObjects<T>(value: unknown): T[] {
  return Array.isArray(value)
    ? value.filter((item): item is T => Boolean(item) && typeof item === "object")
    : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => text(item, 120)).filter((item): item is string => Boolean(item)).slice(0, 80)
    : [];
}

function jsonArray(value: unknown, limit = 40): unknown[] {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object").slice(0, limit)
    : [];
}

function selectedLayers(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  return {
    political: stringArray(row.political),
    usps: stringArray(row.usps),
  };
}

function routeRows(value: unknown) {
  return arrayOfObjects<PublicMapRouteInput>(value)
    .slice(0, 500)
    .map((route) => ({
      routeKey: text(route.id, 140) ?? "unknown-route",
      zip5: text(route.zip5, 5),
      carrierRouteId: text(route.carrierRouteId, 32),
      label: text(route.label, 220) ?? "USPS route",
      deliverableAddressCount: positiveInt(route.deliveryPoints),
      residentialCount: positiveInt(route.households),
      dataConfidence: dataConfidence(route.confidence),
      sourceLabel: dataConfidence(route.confidence) === "demo_sample" ? "Demo/Sample USPS overlay" : "USPS route data",
    }));
}

function geographyRows(value: unknown) {
  return arrayOfObjects<PublicMapGeographyInput>(value)
    .slice(0, 500)
    .map((geo) => ({
      geographyKey: text(geo.id, 140) ?? "unknown-geography",
      geographyType: text(geo.mode, 64) ?? "unknown",
      label: text(geo.label, 220) ?? "Political geography",
      householdCount: positiveInt(geo.households),
      dataConfidence: dataConfidence(geo.confidence),
      sourceLabel: text(geo.source, 220) ?? "Public aggregate geography",
    }));
}

function tableMissingMessage(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("does not exist") || lower.includes("schema cache") || lower.includes("relation");
}

export async function savePublicMapPlan(
  input: SavePublicMapPlanInput,
): Promise<SavePublicMapPlanResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      stored: "local_only",
      reason: "Supabase service credentials are not configured in this environment.",
    };
  }

  const state = text(input.state, 2) ?? "OH";
  const mode = text(input.mode, 40) ?? "county";
  const drops = Math.min(5, Math.max(1, positiveInt(input.dropCount, 1)));
  const layers = selectedLayers(input.selectedLayers);
  const routes = routeRows(input.selectedRoutes);
  const geographies = geographyRows(input.selectedPoliticalGeographies);
  const stats = input.stats && typeof input.stats === "object"
    ? input.stats as Record<string, unknown>
    : {};
  const health = input.health && typeof input.health === "object"
    ? input.health as Record<string, unknown>
    : {};
  const confidence = dataConfidence(stats.confidence);
  const healthToneRaw = text(health.tone, 12);
  const healthTone =
    healthToneRaw === "green" || healthToneRaw === "yellow" || healthToneRaw === "red"
      ? healthToneRaw
      : null;
  const healthScore = Math.min(100, positiveInt(health.score));
  const households = positiveInt(stats.households);
  const deliveryPoints = positiveInt(stats.deliveryPoints);
  const printQuantity = positiveInt(stats.printQuantity);
  const printCostCents = moneyCents(stats.printCost);
  const postageCents = moneyCents(stats.postage);
  const totalCents = moneyCents(stats.total);
  const grossMarginCents = moneyCents(stats.margin);
  const serviceCostCents = Math.max(0, totalCents - printCostCents - postageCents);
  const now = typeof input.generatedAt === "string" ? input.generatedAt : new Date().toISOString();
  const supabase = createServiceClient();

  const planningObject = {
    state,
    mode,
    drops,
    selectedRouteCount: routes.length,
    selectedPoliticalGeographyCount: geographies.length,
    households,
    deliveryPoints,
    printQuantity,
    totalCostCents: totalCents,
    dataConfidence: confidence,
    generatedAt: now,
  };

  const { data: session, error: sessionError } = await supabase
    .from("map_selection_sessions")
    .insert({
      public_session_id: `public-map-${Date.now()}`,
      state,
      status: "saved",
      selected_layers: layers,
      planning_object: planningObject,
      data_confidence: confidence,
      last_event_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (sessionError || !session?.id) {
    if (sessionError && tableMissingMessage(sessionError.message)) {
      return {
        ok: false,
        stored: "local_only",
        reason: "Map planning migration has not been applied to Supabase yet.",
      };
    }
    console.error("[political/map-plans] session insert failed", sessionError);
    return {
      ok: false,
      stored: "local_only",
      reason: "Could not save the map session to Supabase.",
    };
  }

  const selectedPolygons = routes.map((route) => ({
    routeKey: route.routeKey,
    label: route.label,
    zip5: route.zip5,
    carrierRouteId: route.carrierRouteId,
  }));

  const { data: plan, error: planError } = await supabase
    .from("campaign_map_plans")
    .insert({
      session_id: session.id,
      plan_name: `${state} ${mode} mail coverage plan`,
      state,
      selected_map_type: "dual_synced",
      selected_layers: layers,
      selected_polygons: selectedPolygons,
      total_households: households,
      total_delivery_points: deliveryPoints,
      total_estimated_postcards: printQuantity,
      estimated_print_cost_cents: printCostCents,
      estimated_postage_cents: postageCents,
      estimated_total_cost_cents: totalCents,
      estimated_gross_margin_cents: grossMarginCents,
      selected_number_of_drops: drops,
      selected_schedule: [],
      proposal_status: "not_started",
      payment_status: "not_started",
      data_confidence: confidence,
      source_labels: ["Public Aggregate", "Estimated", confidence === "demo_sample" ? "Demo/Sample" : "USPS route data"],
      campaign_health_score: healthScore,
      campaign_health_tone: healthTone,
      ai_recommendations: jsonArray(input.recommendations, 12),
      operational_alerts: jsonArray(input.liveFeed, 20),
      timeline_snapshot: jsonArray(input.timeline, 20),
      status: "saved",
    })
    .select("id")
    .single();

  if (planError || !plan?.id) {
    console.error("[political/map-plans] plan insert failed", planError);
    return {
      ok: false,
      stored: "local_only",
      sessionId: session.id as string,
      reason: "Could not save the normalized map plan to Supabase.",
    };
  }

  if (geographies.length > 0) {
    const { error } = await supabase.from("campaign_selected_geographies").insert(
      geographies.map((geo) => ({
        plan_id: plan.id,
        geography_key: geo.geographyKey,
        geography_type: geo.geographyType,
        label: geo.label,
        overlap_percentage: "100",
        household_count: geo.householdCount,
        data_confidence: geo.dataConfidence,
        source_label: geo.sourceLabel,
      })),
    );
    if (error) console.error("[political/map-plans] selected geography insert failed", error);
  }

  if (routes.length > 0) {
    const { error } = await supabase.from("campaign_selected_usps_routes").insert(
      routes.map((route) => ({
        plan_id: plan.id,
        route_key: route.routeKey,
        zip5: route.zip5,
        carrier_route_id: route.carrierRouteId,
        label: route.label,
        overlap_percentage: "100",
        deliverable_address_count: route.deliverableAddressCount,
        residential_count: route.residentialCount,
        business_count: 0,
        estimated_postage_cents: Math.round(
          route.deliverableAddressCount * drops * POLITICAL_POSTCARD_POSTAGE_ESTIMATE_CENTS,
        ),
        data_confidence: route.dataConfidence,
        source_label: route.sourceLabel,
      })),
    );
    if (error) console.error("[political/map-plans] selected route insert failed", error);
  }

  await supabase.from("campaign_cost_estimates").insert({
    plan_id: plan.id,
    estimate_type: "public_dual_map",
    households,
    delivery_points: deliveryPoints,
    print_quantity: printQuantity,
    print_cost_cents: printCostCents,
    postage_cents: postageCents,
    service_cost_cents: serviceCostCents,
    total_price_cents: totalCents,
    gross_margin_cents: grossMarginCents,
    cost_inputs: {
      printRateCents: POLITICAL_POSTCARD_PRINT_ESTIMATE_CENTS,
      postageRateCents: POLITICAL_POSTCARD_POSTAGE_ESTIMATE_CENTS,
      maxPostcardPriceCents: MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS,
      dropCount: drops,
    },
    data_confidence: confidence,
  });

  await supabase.from("campaign_map_events").insert({
    session_id: session.id,
    plan_id: plan.id,
    event_type: "public_map_plan_saved",
    event_payload: planningObject,
  });

  return {
    ok: true,
    stored: "database",
    planId: plan.id as string,
    sessionId: session.id as string,
  };
}
