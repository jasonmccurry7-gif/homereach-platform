import "server-only";

import { createClient as createUserClient } from "@/lib/supabase/server";
import {
  DEFAULT_TIMELINE,
  MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS,
  POLITICAL_POSTCARD_POSTAGE_ESTIMATE_CENTS,
  POLITICAL_POSTCARD_PRINT_ESTIMATE_CENTS,
} from "@/lib/political/pricing-config";

type SourceStatus = "live" | "empty" | "not_connected";
type RiskSeverity = "critical" | "high" | "medium" | "low";
type WaveStatus = "scheduled" | "in_production" | "mail_entry" | "in_home" | "completed" | "at_risk";

interface ReadResult<T extends Record<string, unknown>> {
  rows: T[];
  source: SourceStatus;
  error?: string;
}

export interface DataSourceStatus {
  table: string;
  label: string;
  status: SourceStatus;
  rows: number;
  detail: string;
}

export interface CampaignBranding {
  campaignName: string;
  candidateName: string;
  raceName: string;
  geography: string;
  electionDate: string | null;
  daysUntilElection: number | null;
  colors: {
    primary: string;
    accent: string;
  };
  sourceLabel: string;
}

export interface CommandStatusMetric {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "amber" | "red" | "slate";
  source: string;
}

export interface CoverageMetric {
  label: string;
  value: string;
  detail: string;
  source: string;
}

export interface MailWave {
  id: string;
  waveNumber: number;
  objective: string;
  audience: string;
  dropDate: string | null;
  inHomeWindow: string;
  mailQuantity: number;
  status: WaveStatus;
  riskLevel: RiskSeverity;
  source: string;
}

export interface DeliveryConfidenceComponent {
  label: string;
  score: number;
  detail: string;
}

export interface DeliveryConfidence {
  score: number;
  methodology: string;
  components: DeliveryConfidenceComponent[];
}

export interface RouteIntelligenceCard {
  id: string;
  routeId: string;
  households: number;
  geography: string;
  objective: string;
  status: string;
  readiness: number;
  flag: string;
  notes: string;
  source: string;
}

export interface FinancialVisibility {
  totalProjectedCostCents: number;
  costPerHouseholdCents: number;
  costPerPieceCents: number;
  printCostCents: number;
  postageCostCents: number;
  dataListCostCents: number;
  estimatedMarginCents: number;
  costByWave: Array<{
    label: string;
    totalCostCents: number;
    pieces: number;
  }>;
  costByGeography: Array<{
    label: string;
    totalCostCents: number;
    households: number;
  }>;
  guardrails: string[];
  source: string;
}

export interface QrAttribution {
  scans: number;
  landingPageVisits: number;
  campaignResponses: number;
  status: SourceStatus;
  detail: string;
}

export interface RiskAlert {
  id: string;
  severity: RiskSeverity;
  reason: string;
  recommendedAction: string;
  owner: string;
  dueDate: string | null;
  actionLabel: string;
  actionHref?: string;
  disabled?: boolean;
}

export interface AgentPanel {
  status: string;
  summary: string;
  risks: string[];
  recommendations: string[];
  activity: string[];
  confidenceScore: number;
}

export interface SimulatorBaseline {
  householdsReached: number;
  totalPieces: number;
  totalCostCents: number;
  routeCount: number;
  costPerPieceCents: number;
  nextInHomeDate: string | null;
}

export interface PoliticalMailCommandCenterData {
  refreshedAt: string;
  dataMode: "live" | "partial" | "empty";
  branding: CampaignBranding;
  statusMetrics: CommandStatusMetric[];
  scaleSignals: CoverageMetric[];
  coverage: {
    metrics: CoverageMetric[];
    undercoveredAreas: string[];
  };
  waves: MailWave[];
  deliveryConfidence: DeliveryConfidence;
  routes: RouteIntelligenceCard[];
  financials: FinancialVisibility;
  qrAttribution: QrAttribution;
  risks: RiskAlert[];
  agentPanel: AgentPanel;
  simulatorBaseline: SimulatorBaseline;
  dataSources: DataSourceStatus[];
  calculationNotes: string[];
  actionAudit: Array<{
    label: string;
    type: string;
    target: string;
    status: "verified" | "local_action" | "disabled";
  }>;
}

type DbRow = Record<string, unknown>;

const SOURCE_LABELS: Record<string, string> = {
  campaign_candidates: "Candidate records",
  political_campaigns: "Campaign engagements",
  political_mail_launch_plans: "Candidate agent launch plans",
  political_mail_launch_phases: "Mail wave launch phases",
  political_mail_phase_geographies: "Phase geography recommendations",
  political_routes: "USPS route catalog",
  political_route_selections: "Route selections",
  political_reservations: "Route reservations",
  political_scenarios: "Scenario snapshots",
  political_proposals: "Political proposals",
  political_orders: "Political orders",
  political_candidate_agents: "Candidate launch agents",
  political_agent_activity_log: "Agent activity",
};

export async function loadPoliticalMailCommandCenter(): Promise<PoliticalMailCommandCenterData> {
  const supabase = await createUserClient();

  const [
    candidatesResult,
    campaignsResult,
    plansResult,
    phasesResult,
    phaseGeographiesResult,
    routesResult,
    selectionsResult,
    reservationsResult,
    scenariosResult,
    proposalsResult,
    ordersResult,
    agentsResult,
    activityResult,
  ] = await Promise.all([
    readRows(supabase, "campaign_candidates", "id,candidate_name,office_sought,race_level,election_year,election_date,district,county,city,state,party_optional_public,campaign_website,data_verified_at,created_at,updated_at", 50, "updated_at"),
    readRows(supabase, "political_campaigns", "id,candidate_id,campaign_name,office,race_type,county,city,district,stage,estimated_deal_value_cents,election_date,created_at,updated_at", 50, "updated_at"),
    readRows(supabase, "political_mail_launch_plans", "id,agent_id,candidate_id,campaign_id,status,plan_name,total_households,total_estimated_cost_cents,confidence_score,human_approved_at,created_at,updated_at", 50, "updated_at"),
    readRows(supabase, "political_mail_launch_phases", "id,plan_id,phase_number,phase_key,objective,recommended_send_date,delivery_window_start,delivery_window_end,target_geography,household_count,estimated_print_cost_cents,estimated_postage_cost_cents,total_estimated_cost_cents,message_theme,creative_brief,qr_recommendation,compliance_notes,why_this_phase_matters,source_labels,created_at", 100, "phase_number", true),
    readRows(supabase, "political_mail_phase_geographies", "id,phase_id,geography_type,geography_key,label,household_count,route_count,estimated_cost_cents,selection_reason,created_at", 150, "created_at"),
    readRows(supabase, "political_routes", "id,state,zip5,carrier_route_id,route_type,residential_count,business_count,total_count,county,city,source,source_imported_at,active,notes,created_at,updated_at", 1000, "updated_at"),
    readRows(supabase, "political_route_selections", "scenario_id,route_id,household_count_snapshot,unit_cost_cents_snapshot,unit_price_cents_snapshot,added_at", 1000, "added_at"),
    readRows(supabase, "political_reservations", "id,campaign_id,route_id,scenario_id,order_id,drop_window_start,drop_window_end,drop_index,status,expires_at,notes,created_at,updated_at", 1000, "updated_at"),
    readRows(supabase, "political_scenarios", "id,plan_id,label,scenario_type,households,drops,total_pieces,total_investment_cents,internal_cost_cents,internal_margin_cents,coverage_pct,computed_at,created_at,updated_at", 100, "updated_at"),
    readRows(supabase, "political_proposals", "id,campaign_id,candidate_id,status,sent_at,viewed_at,approved_at,expires_at,households,drops,total_pieces,total_investment_cents,internal_cost_cents,internal_margin_cents,delivery_window_text,created_at,updated_at", 100, "updated_at"),
    readRows(supabase, "political_orders", "id,proposal_id,campaign_id,total_cents,amount_paid_cents,payment_mode,payment_status,fulfillment_status,approved_at,paid_at,fulfillment_started_at,completed_at,created_at,updated_at", 100, "updated_at"),
    readRows(supabase, "political_candidate_agents", "id,candidate_id,campaign_id,agent_name,status,current_task,last_action,confidence_score,queue_count,compliance_status,human_approval_required,last_run_at,created_at,updated_at", 50, "updated_at"),
    readRows(supabase, "political_agent_activity_log", "id,agent_id,candidate_id,campaign_id,activity_type,status,message,created_at", 20, "created_at"),
  ]);

  const results = [
    candidatesResult,
    campaignsResult,
    plansResult,
    phasesResult,
    phaseGeographiesResult,
    routesResult,
    selectionsResult,
    reservationsResult,
    scenariosResult,
    proposalsResult,
    ordersResult,
    agentsResult,
    activityResult,
  ];

  const dataSources = results.map((result) => ({
    table: result.table,
    label: SOURCE_LABELS[result.table] ?? result.table,
    status: result.source,
    rows: result.rows.length,
    detail: result.error ?? (result.rows.length > 0 ? "Loaded from Supabase." : "No records found yet."),
  }));

  const campaigns = campaignsResult.rows;
  const candidates = candidatesResult.rows;
  const plans = plansResult.rows;
  const phases = phasesResult.rows;
  const phaseGeographies = phaseGeographiesResult.rows;
  const routes = routesResult.rows;
  const routeSelections = selectionsResult.rows;
  const reservations = reservationsResult.rows;
  const scenarios = scenariosResult.rows;
  const proposals = proposalsResult.rows;
  const orders = ordersResult.rows;
  const agents = agentsResult.rows;
  const activity = activityResult.rows;

  const activeCampaign = pickActiveCampaign(campaigns, plans, proposals, orders);
  const activeCandidate = pickActiveCandidate(candidates, activeCampaign, plans, agents);
  const activePlan = pickActivePlan(plans, activeCampaign, activeCandidate);
  const activePlanId = textValue(activePlan?.id);
  const activeCampaignId = textValue(activeCampaign?.id);
  const activeCandidateId = textValue(activeCandidate?.id);

  const relevantPhases = activePlanId
    ? phases.filter((phase) => textValue(phase.plan_id) === activePlanId)
    : phases;
  const relevantPlanIds = new Set(plans.map((plan) => textValue(plan.id)).filter(Boolean));
  const relevantPhaseIds = new Set(relevantPhases.map((phase) => textValue(phase.id)).filter(Boolean));
  const relevantGeographies = phaseGeographies.filter((geo) => relevantPhaseIds.has(textValue(geo.phase_id)));
  const relevantProposals = filterByCampaignOrCandidate(proposals, activeCampaignId, activeCandidateId);
  const relevantOrders = filterByCampaign(orders, activeCampaignId);
  const relevantScenarios = activePlanId
    ? scenarios.filter((scenario) => textValue(scenario.plan_id) === activePlanId)
    : scenarios.filter((scenario) => relevantPlanIds.has(textValue(scenario.plan_id)));

  const activeReservations = reservations.filter((reservation) =>
    ["soft", "firm", "fulfilled"].includes(textValue(reservation.status)),
  );
  const firmReservations = activeReservations.filter((reservation) =>
    ["firm", "fulfilled"].includes(textValue(reservation.status)),
  );

  const selectedRouteIds = new Set<string>();
  routeSelections.forEach((selection) => addIfPresent(selectedRouteIds, textValue(selection.route_id)));
  activeReservations.forEach((reservation) => addIfPresent(selectedRouteIds, textValue(reservation.route_id)));
  const firmRouteIds = new Set(firmReservations.map((reservation) => textValue(reservation.route_id)).filter(Boolean));

  const selectedRoutes = routes.filter((route) => selectedRouteIds.has(textValue(route.id)));
  const firmRoutes = routes.filter((route) => firmRouteIds.has(textValue(route.id)));
  const activeRoutes = routes.filter((route) => booleanValue(route.active, true));

  const totalPiecesScheduled = computeTotalPieces(relevantPhases, relevantProposals, relevantScenarios);
  const householdsReached = computeHouseholdsReached(
    relevantPhases,
    plans,
    relevantProposals,
    relevantScenarios,
    selectedRoutes,
  );
  const availableRouteHouseholds = sum(activeRoutes, (route) => routeHouseholds(route));
  const totalProjectedCostCents = computeTotalProjectedCost(
    relevantPhases,
    relevantProposals,
    relevantOrders,
    relevantScenarios,
    totalPiecesScheduled,
  );
  const printCostCents = computePrintCost(relevantPhases, totalPiecesScheduled);
  const postageCostCents = computePostageCost(relevantPhases, totalPiecesScheduled);
  const internalCostCents = sum(relevantProposals, (proposal) => numberValue(proposal.internal_cost_cents))
    || sum(relevantScenarios, (scenario) => numberValue(scenario.internal_cost_cents))
    || printCostCents + postageCostCents;
  const estimatedMarginCents = Math.max(0, totalProjectedCostCents - internalCostCents);
  const costPerPieceCents = divideCents(totalProjectedCostCents, totalPiecesScheduled);
  const costPerHouseholdCents = divideCents(totalProjectedCostCents, householdsReached);
  const activeMailWaves = relevantPhases.length || max(relevantProposals, (proposal) => numberValue(proposal.drops));
  const piecesInProduction = sum(
    relevantOrders.filter((order) => ["approved", "in_production", "printing", "pending"].includes(textValue(order.fulfillment_status))),
    (order) => numberValue(order.total_cents) > 0 ? inferredPiecesFromOrder(order, costPerPieceCents) : 0,
  );
  const uspsAcceptedPieces = sum(
    relevantOrders.filter((order) => ["mailed", "completed", "delivered"].includes(textValue(order.fulfillment_status))),
    (order) => numberValue(order.total_cents) > 0 ? inferredPiecesFromOrder(order, costPerPieceCents) : 0,
  );
  const inHomeThisWeek = relevantPhases.filter((phase) =>
    overlapsNextDays(textValue(phase.delivery_window_start), textValue(phase.delivery_window_end), 7),
  ).length;

  const waves = buildMailWaves(relevantPhases, relevantProposals);
  const riskAlerts = buildRiskAlerts({
    phases: relevantPhases,
    routes,
    selectedRoutes,
    firmRoutes,
    proposals: relevantProposals,
    totalPiecesScheduled,
    totalProjectedCostCents,
    householdsReached,
    activeCampaign,
    activePlan,
  });
  const deliveryConfidence = computeDeliveryConfidence({
    waves,
    routesLoaded: activeRoutes.length,
    selectedRoutes: selectedRouteIds.size,
    firmRoutes: firmRoutes.length,
    totalPiecesScheduled,
    totalProjectedCostCents,
    householdsReached,
    approvedPlans: plans.filter((plan) => textValue(plan.status) === "approved" || textValue(plan.human_approved_at)).length,
    riskAlerts,
  });

  const coverage = buildCoverageMetrics({
    activeRoutes,
    selectedRoutes,
    firmRoutes,
    householdsReached,
    availableRouteHouseholds,
    totalPiecesScheduled,
    scenarios: relevantScenarios,
  });
  const routesForCards = buildRouteCards(routes, selectedRouteIds, firmRouteIds, relevantPhases);
  const financials = buildFinancials({
    totalProjectedCostCents,
    costPerHouseholdCents,
    costPerPieceCents,
    printCostCents,
    postageCostCents,
    estimatedMarginCents,
    phases: relevantPhases,
    geographies: relevantGeographies,
    totalPiecesScheduled,
  });
  const branding = buildBranding(activeCampaign, activeCandidate);
  const statusMetrics = buildStatusMetrics({
    activeMailWaves,
    totalPiecesScheduled,
    routesLocked: firmRoutes.length,
    piecesInProduction,
    uspsAcceptedPieces,
    inHomeThisWeek,
    deliveryConfidenceScore: deliveryConfidence.score,
    nextDeadline: nextDeadline(relevantPhases),
    pendingPaymentCents: sum(relevantOrders.filter((order) => textValue(order.payment_status) !== "paid"), (order) => Math.max(0, numberValue(order.total_cents) - numberValue(order.amount_paid_cents))),
  });
  const scaleSignals = buildScaleSignals({
    totalPiecesScheduled,
    householdsReached,
    routeCount: selectedRouteIds.size,
    countiesCovered: unique(selectedRoutes.map((route) => textValue(route.county)).filter(Boolean)).length,
    wavesCompleted: waves.filter((wave) => wave.status === "completed").length,
    wavesUpcoming: waves.filter((wave) => ["scheduled", "in_production", "mail_entry", "at_risk"].includes(wave.status)).length,
    nextInHomeWindow: waves.find((wave) => wave.inHomeWindow !== "Not scheduled")?.inHomeWindow ?? "Not scheduled",
  });
  const agentPanel = buildAgentPanel(agents, activity, riskAlerts, coverage.undercoveredAreas, deliveryConfidence.score);

  const dataMode: "live" | "partial" | "empty" =
    results.some((result) => result.rows.length > 0 && result.source === "live")
      ? results.some((result) => result.source === "not_connected")
        ? "partial"
        : "live"
      : "empty";

  return {
    refreshedAt: new Date().toISOString(),
    dataMode,
    branding,
    statusMetrics,
    scaleSignals,
    coverage,
    waves,
    deliveryConfidence,
    routes: routesForCards,
    financials,
    qrAttribution: {
      scans: 0,
      landingPageVisits: 0,
      campaignResponses: 0,
      status: "not_connected",
      detail: "Political QR and campaign-provided response tables are not connected to this admin analytics view yet. No vote impact is inferred or claimed.",
    },
    risks: riskAlerts,
    agentPanel,
    simulatorBaseline: {
      householdsReached,
      totalPieces: totalPiecesScheduled,
      totalCostCents: totalProjectedCostCents,
      routeCount: selectedRouteIds.size,
      costPerPieceCents: costPerPieceCents || MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS,
      nextInHomeDate: firstDate(relevantPhases.map((phase) => textValue(phase.delivery_window_start))),
    },
    dataSources,
    calculationNotes: [
      "All money is handled in integer cents and formatted at render time to avoid floating-point drift.",
      "Households reached uses the largest available unique-household source: launch plan phase households, proposal households, scenario households, or selected route households. Pieces scheduled sum waves/drops and may exceed unique households when a campaign mails multiple phases.",
      "Cost per piece = total projected cost / scheduled pieces, guarded for zero pieces. Cost per household = total projected cost / unique households reached, guarded for zero households.",
      "Delivery confidence is a weighted operational readiness score, not a political outcome score.",
      "Admin-only margin is calculated from proposal/scenario internal cost fields and is excluded from client export payloads.",
    ],
    actionAudit: [
      { label: "Open Maps", type: "route", target: "/admin/political/maps", status: "verified" },
      { label: "Open Routes", type: "route", target: "/admin/political/routes", status: "verified" },
      { label: "Open Plans", type: "route", target: "/admin/political/plans", status: "verified" },
      { label: "Open Reporting", type: "route", target: "/admin/political/reporting", status: "verified" },
      { label: "Data Sources", type: "route", target: "/admin/political/data-sources", status: "verified" },
      { label: "Print / Save PDF", type: "browser-print", target: "window.print()", status: "local_action" },
      { label: "Export Client JSON", type: "download", target: "client-safe JSON blob", status: "local_action" },
      { label: "War Room Mode", type: "modal", target: "same page data", status: "local_action" },
      { label: "Reset Simulation", type: "local-state", target: "scenario simulator state", status: "local_action" },
      { label: "Save Scenario", type: "disabled", target: "requires explicit persistence workflow", status: "disabled" },
    ],
  };
}

async function readRows<T extends DbRow>(
  supabase: Awaited<ReturnType<typeof createUserClient>>,
  table: string,
  columns: string,
  limit: number,
  orderColumn?: string,
  ascending = false,
): Promise<ReadResult<T> & { table: string }> {
  try {
    let query = supabase.from(table).select(columns);
    if (orderColumn) {
      query = query.order(orderColumn, { ascending });
    }
    const { data, error } = await query.limit(limit);
    if (error) {
      return {
        table,
        rows: [],
        source: "not_connected",
        error: error.message,
      };
    }
    const rows = (data ?? []) as unknown as T[];
    return {
      table,
      rows,
      source: rows.length > 0 ? "live" : "empty",
    };
  } catch (error) {
    return {
      table,
      rows: [],
      source: "not_connected",
      error: error instanceof Error ? error.message : "Unknown read error",
    };
  }
}

function pickActiveCampaign(campaigns: DbRow[], plans: DbRow[], proposals: DbRow[], orders: DbRow[]): DbRow | null {
  const campaignIds = [
    textValue(plans[0]?.campaign_id),
    textValue(proposals[0]?.campaign_id),
    textValue(orders[0]?.campaign_id),
  ].filter(Boolean);
  return campaigns.find((campaign) => campaignIds.includes(textValue(campaign.id))) ?? campaigns[0] ?? null;
}

function pickActiveCandidate(candidates: DbRow[], campaign: DbRow | null, plans: DbRow[], agents: DbRow[]): DbRow | null {
  const candidateIds = [
    textValue(campaign?.candidate_id),
    textValue(plans[0]?.candidate_id),
    textValue(agents[0]?.candidate_id),
  ].filter(Boolean);
  return candidates.find((candidate) => candidateIds.includes(textValue(candidate.id))) ?? candidates[0] ?? null;
}

function pickActivePlan(plans: DbRow[], campaign: DbRow | null, candidate: DbRow | null): DbRow | null {
  const campaignId = textValue(campaign?.id);
  const candidateId = textValue(candidate?.id);
  return (
    plans.find((plan) => campaignId && textValue(plan.campaign_id) === campaignId) ??
    plans.find((plan) => candidateId && textValue(plan.candidate_id) === candidateId) ??
    plans[0] ??
    null
  );
}

function filterByCampaignOrCandidate(rows: DbRow[], campaignId: string, candidateId: string): DbRow[] {
  if (!campaignId && !candidateId) return rows;
  return rows.filter((row) =>
    (campaignId && textValue(row.campaign_id) === campaignId) ||
    (candidateId && textValue(row.candidate_id) === candidateId),
  );
}

function filterByCampaign(rows: DbRow[], campaignId: string): DbRow[] {
  if (!campaignId) return rows;
  return rows.filter((row) => textValue(row.campaign_id) === campaignId);
}

function buildBranding(campaign: DbRow | null, candidate: DbRow | null): CampaignBranding {
  const electionDate = textValue(campaign?.election_date) || textValue(candidate?.election_date) || null;
  const geography = [
    textValue(campaign?.district) || textValue(candidate?.district),
    textValue(campaign?.county) || textValue(candidate?.county),
    textValue(campaign?.city) || textValue(candidate?.city),
    textValue(candidate?.state),
  ].filter(Boolean).join(" / ");

  return {
    campaignName: textValue(campaign?.campaign_name) || "Campaign not selected",
    candidateName: textValue(candidate?.candidate_name) || "Candidate not selected",
    raceName: textValue(campaign?.office) || textValue(candidate?.office_sought) || "Race not configured",
    geography: geography || "Geography not configured",
    electionDate,
    daysUntilElection: electionDate ? daysUntil(electionDate) : null,
    colors: {
      primary: "#2563eb",
      accent: "#ef4444",
    },
    sourceLabel: campaign || candidate ? "Live campaign/candidate record" : "No campaign record selected",
  };
}

function buildStatusMetrics(input: {
  activeMailWaves: number;
  totalPiecesScheduled: number;
  routesLocked: number;
  piecesInProduction: number;
  uspsAcceptedPieces: number;
  inHomeThisWeek: number;
  deliveryConfidenceScore: number;
  nextDeadline: string | null;
  pendingPaymentCents: number;
}): CommandStatusMetric[] {
  return [
    {
      label: "Active mail waves",
      value: formatInteger(input.activeMailWaves),
      detail: input.activeMailWaves > 0 ? "Launch phases or proposal drops scheduled." : "No live wave schedule yet.",
      tone: input.activeMailWaves > 0 ? "green" : "amber",
      source: "political_mail_launch_phases / political_proposals",
    },
    {
      label: "Pieces scheduled",
      value: formatInteger(input.totalPiecesScheduled),
      detail: "Total scheduled postcards across waves/drops.",
      tone: input.totalPiecesScheduled > 0 ? "blue" : "amber",
      source: "phase household counts, proposal totals, or scenario totals",
    },
    {
      label: "Routes locked",
      value: formatInteger(input.routesLocked),
      detail: "Firm or fulfilled route reservations.",
      tone: input.routesLocked > 0 ? "green" : "amber",
      source: "political_reservations",
    },
    {
      label: "Production queue",
      value: formatInteger(input.piecesInProduction),
      detail: "Estimated pieces tied to active fulfillment orders.",
      tone: input.piecesInProduction > 0 ? "blue" : "slate",
      source: "political_orders",
    },
    {
      label: "USPS accepted",
      value: formatInteger(input.uspsAcceptedPieces),
      detail: "Estimated pieces from mailed/completed order statuses.",
      tone: input.uspsAcceptedPieces > 0 ? "green" : "slate",
      source: "political_orders.fulfillment_status",
    },
    {
      label: "In-home this week",
      value: formatInteger(input.inHomeThisWeek),
      detail: "Waves with delivery windows overlapping the next 7 days.",
      tone: input.inHomeThisWeek > 0 ? "green" : "slate",
      source: "political_mail_launch_phases.delivery_window_*",
    },
    {
      label: "Delivery confidence",
      value: `${input.deliveryConfidenceScore}%`,
      detail: "Weighted readiness score, not outcome prediction.",
      tone: input.deliveryConfidenceScore >= 75 ? "green" : input.deliveryConfidenceScore >= 50 ? "amber" : "red",
      source: "transparent readiness formula",
    },
    {
      label: "Upcoming deadline",
      value: input.nextDeadline ?? "None",
      detail: input.pendingPaymentCents > 0 ? `${formatCurrency(input.pendingPaymentCents)} pending payment.` : "Payment blockers not detected.",
      tone: input.nextDeadline ? "amber" : "slate",
      source: "phase send dates and order balances",
    },
  ];
}

function buildScaleSignals(input: {
  totalPiecesScheduled: number;
  householdsReached: number;
  routeCount: number;
  countiesCovered: number;
  wavesCompleted: number;
  wavesUpcoming: number;
  nextInHomeWindow: string;
}): CoverageMetric[] {
  return [
    {
      label: "Total pieces planned",
      value: formatInteger(input.totalPiecesScheduled),
      detail: "Election-grade mail volume across all planned waves.",
      source: "wave/proposal/scenario totals",
    },
    {
      label: "Households reached",
      value: formatInteger(input.householdsReached),
      detail: "Unique household estimate from the strongest available source.",
      source: "launch phases, proposals, scenarios, route catalog",
    },
    {
      label: "Routes involved",
      value: formatInteger(input.routeCount),
      detail: "Selected, soft-held, or firm route count.",
      source: "route selections and reservations",
    },
    {
      label: "Counties covered",
      value: formatInteger(input.countiesCovered),
      detail: "Covered counties from selected route labels.",
      source: "political_routes.county",
    },
    {
      label: "Waves completed",
      value: formatInteger(input.wavesCompleted),
      detail: `${formatInteger(input.wavesUpcoming)} upcoming or active.`,
      source: "mail wave dates",
    },
    {
      label: "Next in-home window",
      value: input.nextInHomeWindow,
      detail: "Operational date window from launch phases.",
      source: "political_mail_launch_phases",
    },
  ];
}

function buildCoverageMetrics(input: {
  activeRoutes: DbRow[];
  selectedRoutes: DbRow[];
  firmRoutes: DbRow[];
  householdsReached: number;
  availableRouteHouseholds: number;
  totalPiecesScheduled: number;
  scenarios: DbRow[];
}): { metrics: CoverageMetric[]; undercoveredAreas: string[] } {
  const activeCounties = unique(input.activeRoutes.map((route) => textValue(route.county)).filter(Boolean));
  const coveredCounties = unique(input.selectedRoutes.map((route) => textValue(route.county)).filter(Boolean));
  const countyCoveragePct = percent(coveredCounties.length, activeCounties.length);
  const scenarioCoveragePct = max(input.scenarios, (scenario) => numberValue(scenario.coverage_pct));
  const routeDensity = divide(input.householdsReached, Math.max(1, input.selectedRoutes.length || input.firmRoutes.length));
  const remainingHouseholds = Math.max(0, input.availableRouteHouseholds - input.householdsReached);
  const saturation = input.householdsReached > 0 ? input.totalPiecesScheduled / input.householdsReached : 0;
  const undercoveredAreas = topUndercoveredAreas(input.activeRoutes, input.selectedRoutes);

  return {
    metrics: [
      {
        label: "County coverage",
        value: activeCounties.length ? `${countyCoveragePct}%` : "Not connected",
        detail: `${formatInteger(coveredCounties.length)} of ${formatInteger(activeCounties.length)} route counties represented.`,
        source: "selected routes vs active route catalog",
      },
      {
        label: "District coverage",
        value: scenarioCoveragePct > 0 ? `${Math.round(scenarioCoveragePct)}%` : "Needs scenario",
        detail: scenarioCoveragePct > 0 ? "From selected scenario snapshot." : "District coverage needs route scenario snapshots.",
        source: "political_scenarios.coverage_pct",
      },
      {
        label: "Route density",
        value: routeDensity > 0 ? `${formatInteger(Math.round(routeDensity))} HH/route` : "No routes",
        detail: "Households reached divided by selected/firm routes.",
        source: "route selections and household counts",
      },
      {
        label: "Households reached",
        value: formatInteger(input.householdsReached),
        detail: `${formatInteger(remainingHouseholds)} households remain in loaded route catalog.`,
        source: "campaign plan/proposal/scenario/route counts",
      },
      {
        label: "Saturation level",
        value: saturation > 0 ? `${saturation.toFixed(1)}x` : "Not scheduled",
        detail: "Pieces scheduled per reached household.",
        source: "scheduled pieces / households reached",
      },
      {
        label: "Undercovered areas",
        value: undercoveredAreas.length ? formatInteger(undercoveredAreas.length) : "None flagged",
        detail: undercoveredAreas.length ? undercoveredAreas.slice(0, 2).join(", ") : "No route gaps detected from loaded data.",
        source: "political_routes minus selected/reserved routes",
      },
    ],
    undercoveredAreas,
  };
}

function buildMailWaves(phases: DbRow[], proposals: DbRow[]): MailWave[] {
  if (phases.length > 0) {
    return phases
      .slice()
      .sort((left, right) => numberValue(left.phase_number) - numberValue(right.phase_number))
      .map((phase, index) => {
        const status = waveStatus(phase);
        return {
          id: textValue(phase.id) || `phase-${index + 1}`,
          waveNumber: numberValue(phase.phase_number) || index + 1,
          objective: textValue(phase.objective) || textValue(phase.message_theme) || "Mail wave",
          audience: textValue(phase.target_geography) || "Geography not set",
          dropDate: textValue(phase.recommended_send_date) || null,
          inHomeWindow: formatWindow(textValue(phase.delivery_window_start), textValue(phase.delivery_window_end)),
          mailQuantity: numberValue(phase.household_count),
          status,
          riskLevel: status === "at_risk" ? "high" : status === "scheduled" ? "medium" : "low",
          source: "political_mail_launch_phases",
        };
      });
  }

  return proposals.flatMap((proposal, proposalIndex) => {
    const drops = Math.max(1, numberValue(proposal.drops));
    const households = numberValue(proposal.households);
    return Array.from({ length: drops }, (_, index) => ({
      id: `${textValue(proposal.id) || proposalIndex}-drop-${index + 1}`,
      waveNumber: index + 1,
      objective: index === drops - 1 ? "Final reminder" : index === 0 ? "Introduction" : "Reinforcement",
      audience: "Proposal geography snapshot",
      dropDate: null,
      inHomeWindow: textValue(proposal.delivery_window_text) || "Not scheduled",
      mailQuantity: households,
      status: textValue(proposal.approved_at) ? "scheduled" : "at_risk",
      riskLevel: textValue(proposal.approved_at) ? "medium" : "high",
      source: "political_proposals",
    }));
  });
}

function computeDeliveryConfidence(input: {
  waves: MailWave[];
  routesLoaded: number;
  selectedRoutes: number;
  firmRoutes: number;
  totalPiecesScheduled: number;
  totalProjectedCostCents: number;
  householdsReached: number;
  approvedPlans: number;
  riskAlerts: RiskAlert[];
}): DeliveryConfidence {
  const nextWave = input.waves.find((wave) => wave.dropDate);
  const daysToDrop = nextWave?.dropDate ? daysUntil(nextWave.dropDate) : null;

  const printReadiness = input.totalPiecesScheduled > 0
    ? input.approvedPlans > 0 ? 90 : 65
    : 25;
  const routeReadiness = input.firmRoutes > 0
    ? 95
    : input.selectedRoutes > 0
      ? 72
      : input.routesLoaded > 0
        ? 45
        : 15;
  const mailEntryTiming = daysToDrop == null
    ? 45
    : daysToDrop >= DEFAULT_TIMELINE.productionDays + DEFAULT_TIMELINE.mailMaxDays
      ? 90
      : daysToDrop >= DEFAULT_TIMELINE.productionDays
        ? 65
        : 30;
  const artworkApproval = input.approvedPlans > 0 ? 88 : input.waves.length > 0 ? 55 : 25;
  const deadlineRisk = input.riskAlerts.some((alert) => ["critical", "high"].includes(alert.severity))
    ? 45
    : input.waves.length > 0
      ? 82
      : 50;
  const logisticsRisk = input.householdsReached > 0 && input.totalProjectedCostCents > 0 ? 85 : 50;

  const components = [
    { label: "Print readiness", score: printReadiness, detail: "Pieces scheduled plus plan approval status." },
    { label: "Route readiness", score: routeReadiness, detail: "Firm reservations outrank soft selections and route catalog availability." },
    { label: "USPS/mail entry timing", score: mailEntryTiming, detail: "Days until the next drop compared with production and delivery windows." },
    { label: "Artwork approval", score: artworkApproval, detail: "Approved launch plans indicate artwork can move toward production." },
    { label: "Deadline risk", score: deadlineRisk, detail: "High-severity operational alerts lower this component." },
    { label: "Weather/logistics risk", score: logisticsRisk, detail: "Currently based on missing operational data only; weather API is not connected." },
  ];

  // Delivery confidence formula:
  // overall = print 20% + route 20% + USPS timing 20% + artwork 20%
  //         + deadline risk 15% + logistics/weather 5%.
  // This is an operational readiness score only. It does not estimate voter
  // behavior, persuasion, turnout, or vote impact.
  const score = Math.round(
    printReadiness * 0.2 +
    routeReadiness * 0.2 +
    mailEntryTiming * 0.2 +
    artworkApproval * 0.2 +
    deadlineRisk * 0.15 +
    logisticsRisk * 0.05,
  );

  return {
    score,
    methodology: "Weighted operational readiness: print 20%, route 20%, USPS timing 20%, artwork 20%, deadline risk 15%, logistics/weather 5%.",
    components,
  };
}

function buildRouteCards(
  routes: DbRow[],
  selectedRouteIds: Set<string>,
  firmRouteIds: Set<string>,
  phases: DbRow[],
): RouteIntelligenceCard[] {
  const objective = textValue(phases[0]?.objective) || "Campaign mail coverage";
  return routes
    .slice()
    .sort((left, right) => routeHouseholds(right) - routeHouseholds(left))
    .slice(0, 8)
    .map((route) => {
      const id = textValue(route.id);
      const isFirm = firmRouteIds.has(id);
      const isSelected = selectedRouteIds.has(id);
      const households = routeHouseholds(route);
      const readiness = isFirm ? 95 : isSelected ? 72 : households > 0 ? 48 : 20;
      return {
        id,
        routeId: `${textValue(route.zip5)}-${textValue(route.carrier_route_id)}`.replace(/^-|-$/g, "") || "Route pending",
        households,
        geography: [textValue(route.city), textValue(route.county), textValue(route.state)].filter(Boolean).join(", ") || "Geography pending",
        objective,
        status: isFirm ? "Locked" : isSelected ? "Selected" : "Available",
        readiness,
        flag: isFirm ? "Ready" : isSelected ? "Needs reservation" : households > 0 ? "Coverage gap" : "Missing household count",
        notes: textValue(route.notes) || `Source: ${textValue(route.source) || "route catalog"}`,
        source: "political_routes",
      };
    });
}

function buildFinancials(input: {
  totalProjectedCostCents: number;
  costPerHouseholdCents: number;
  costPerPieceCents: number;
  printCostCents: number;
  postageCostCents: number;
  estimatedMarginCents: number;
  phases: DbRow[];
  geographies: DbRow[];
  totalPiecesScheduled: number;
}): FinancialVisibility {
  const guardrails: string[] = [
    "Divide-by-zero guarded for pieces, households, and route counts.",
    `Political postcard price cap from config: ${formatCents(MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS)} per piece.`,
  ];
  if (input.costPerPieceCents > MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS) {
    guardrails.push("Review required: effective all-in cost per piece exceeds the configured 70 cent postcard cap, likely due to add-ons or stale proposal data.");
  }
  if (input.totalPiecesScheduled === 0) {
    guardrails.push("No scheduled pieces found, so per-piece values are held at zero until a plan/proposal/scenario is connected.");
  }

  return {
    totalProjectedCostCents: input.totalProjectedCostCents,
    costPerHouseholdCents: input.costPerHouseholdCents,
    costPerPieceCents: input.costPerPieceCents,
    printCostCents: input.printCostCents,
    postageCostCents: input.postageCostCents,
    dataListCostCents: 0,
    estimatedMarginCents: input.estimatedMarginCents,
    costByWave: input.phases.map((phase) => ({
      label: `Wave ${numberValue(phase.phase_number) || 1}: ${textValue(phase.objective) || "Mail phase"}`,
      totalCostCents: numberValue(phase.total_estimated_cost_cents),
      pieces: numberValue(phase.household_count),
    })),
    costByGeography: input.geographies.slice(0, 8).map((geo) => ({
      label: textValue(geo.label) || textValue(geo.geography_key) || "Geography",
      totalCostCents: numberValue(geo.estimated_cost_cents),
      households: numberValue(geo.household_count),
    })),
    guardrails,
    source: "political_mail_launch_phases, political_proposals, political_orders, pricing-config.ts",
  };
}

function buildRiskAlerts(input: {
  phases: DbRow[];
  routes: DbRow[];
  selectedRoutes: DbRow[];
  firmRoutes: DbRow[];
  proposals: DbRow[];
  totalPiecesScheduled: number;
  totalProjectedCostCents: number;
  householdsReached: number;
  activeCampaign: DbRow | null;
  activePlan: DbRow | null;
}): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  const nextPhase = input.phases
    .filter((phase) => textValue(phase.recommended_send_date))
    .sort((left, right) => textValue(left.recommended_send_date).localeCompare(textValue(right.recommended_send_date)))[0];
  const daysToNextDrop = nextPhase ? daysUntil(textValue(nextPhase.recommended_send_date)) : null;

  if (!input.activeCampaign) {
    alerts.push({
      id: "missing-campaign",
      severity: "high",
      reason: "No active political campaign record is selected for this dashboard.",
      recommendedAction: "Open Political Campaigns and attach the analytics view to a campaign engagement.",
      owner: "Admin",
      dueDate: null,
      actionLabel: "Open Campaigns",
      actionHref: "/admin/political/campaigns",
    });
  }
  if (input.phases.length === 0 && input.proposals.length === 0) {
    alerts.push({
      id: "missing-wave-plan",
      severity: "high",
      reason: "No mail wave timeline or proposal drops are available.",
      recommendedAction: "Generate or approve a candidate launch plan before production planning.",
      owner: "Sales/Ops",
      dueDate: null,
      actionLabel: "Open Plans",
      actionHref: "/admin/political/plans",
    });
  }
  if (input.routes.length === 0) {
    alerts.push({
      id: "route-catalog-empty",
      severity: "critical",
      reason: "No route catalog rows are loaded for operational route intelligence.",
      recommendedAction: "Import USPS route data or open the route source finder.",
      owner: "Operations",
      dueDate: null,
      actionLabel: "Find Route Source",
      actionHref: "/admin/political/routes/find-source",
    });
  } else if (input.selectedRoutes.length === 0) {
    alerts.push({
      id: "no-routes-selected",
      severity: "high",
      reason: "Route catalog is present, but no route selections or active reservations are connected.",
      recommendedAction: "Use Maps or Routes to lock the campaign geography.",
      owner: "Operations",
      dueDate: null,
      actionLabel: "Open Maps",
      actionHref: "/admin/political/maps",
    });
  } else if (input.firmRoutes.length === 0) {
    alerts.push({
      id: "routes-not-firm",
      severity: "medium",
      reason: "Routes are selected/soft-held but not firm locked.",
      recommendedAction: "Convert route holds to firm reservations once the campaign approves the plan.",
      owner: "Operations",
      dueDate: null,
      actionLabel: "Open Routes",
      actionHref: "/admin/political/routes",
    });
  }
  if (input.totalPiecesScheduled === 0) {
    alerts.push({
      id: "missing-pieces",
      severity: "high",
      reason: "Scheduled piece count is missing.",
      recommendedAction: "Add household counts to launch phases or connect a proposal/scenario snapshot.",
      owner: "Sales/Ops",
      dueDate: null,
      actionLabel: "Open Candidate Agent",
      actionHref: "/admin/political/candidate-agent",
    });
  }
  if (input.householdsReached === 0) {
    alerts.push({
      id: "missing-households",
      severity: "high",
      reason: "Household reach cannot be calculated from current campaign data.",
      recommendedAction: "Connect route, scenario, proposal, or launch phase household totals.",
      owner: "Operations",
      dueDate: null,
      actionLabel: "Open Data Sources",
      actionHref: "/admin/political/data-sources",
    });
  }
  if (input.totalProjectedCostCents === 0) {
    alerts.push({
      id: "missing-cost",
      severity: "medium",
      reason: "Projected cost is missing.",
      recommendedAction: "Generate a priced proposal or add phase cost estimates before client review.",
      owner: "Sales",
      dueDate: null,
      actionLabel: "Open Proposals",
      actionHref: "/admin/political/proposals",
    });
  }
  if (daysToNextDrop != null && daysToNextDrop < DEFAULT_TIMELINE.productionDays) {
    alerts.push({
      id: "print-deadline-risk",
      severity: "critical",
      reason: "The next recommended drop date is inside the normal production window.",
      recommendedAction: "Move the drop date or confirm rush production before approving the plan.",
      owner: "Operations",
      dueDate: textValue(nextPhase?.recommended_send_date) || null,
      actionLabel: "Open Delivery",
      actionHref: "/admin/political/delivery",
    });
  }
  if (input.activePlan && !textValue(input.activePlan.human_approved_at) && textValue(input.activePlan.status) !== "approved") {
    alerts.push({
      id: "plan-not-approved",
      severity: "medium",
      reason: "Launch plan exists but has not been human-approved.",
      recommendedAction: "Review compliance notes, costs, and wave dates before client-facing proposal or production handoff.",
      owner: "Admin",
      dueDate: null,
      actionLabel: "Open Plans",
      actionHref: "/admin/political/plans",
    });
  }
  alerts.push({
    id: "qr-not-connected",
    severity: "low",
    reason: "Political QR and campaign-provided response analytics are not connected to this view yet.",
    recommendedAction: "Connect QR scan events before reporting engagement by wave/geography.",
    owner: "Analytics",
    dueDate: null,
    actionLabel: "Not Connected",
    disabled: true,
  });

  return alerts;
}

function buildAgentPanel(
  agents: DbRow[],
  activity: DbRow[],
  risks: RiskAlert[],
  undercoveredAreas: string[],
  deliveryConfidenceScore: number,
): AgentPanel {
  const agent = agents[0];
  const riskHighlights = risks
    .filter((risk) => ["critical", "high"].includes(risk.severity))
    .slice(0, 3)
    .map((risk) => risk.reason);
  const recommendations = [
    undercoveredAreas.length ? `Review undercovered geography: ${undercoveredAreas.slice(0, 2).join(", ")}.` : "No undercovered route areas detected from loaded data.",
    deliveryConfidenceScore < 70 ? "Raise delivery confidence by locking routes, approving artwork, and resolving missing counts." : "Delivery confidence is in an operationally healthy range.",
    "Keep recommendations geographic, logistical, and campaign-provided; do not infer voter beliefs or vote impact.",
  ];

  return {
    status: textValue(agent?.status) || "not_connected",
    summary: textValue(agent?.current_task) || "Candidate Campaign Launch Agent is ready to summarize plan status once campaign data is connected.",
    risks: riskHighlights.length ? riskHighlights : ["No critical operational risks detected from loaded data."],
    recommendations,
    activity: activity.slice(0, 4).map((item) => textValue(item.message) || textValue(item.activity_type)).filter(Boolean),
    confidenceScore: numberValue(agent?.confidence_score) || deliveryConfidenceScore,
  };
}

function computeTotalPieces(phases: DbRow[], proposals: DbRow[], scenarios: DbRow[]): number {
  const phasePieces = sum(phases, (phase) => numberValue(phase.household_count));
  if (phasePieces > 0) return phasePieces;
  const proposalPieces = sum(proposals, (proposal) => numberValue(proposal.total_pieces));
  if (proposalPieces > 0) return proposalPieces;
  const scenarioPieces = max(scenarios, (scenario) => numberValue(scenario.total_pieces));
  return scenarioPieces;
}

function computeHouseholdsReached(
  phases: DbRow[],
  plans: DbRow[],
  proposals: DbRow[],
  scenarios: DbRow[],
  selectedRoutes: DbRow[],
): number {
  return Math.max(
    max(phases, (phase) => numberValue(phase.household_count)),
    max(plans, (plan) => numberValue(plan.total_households)),
    max(proposals, (proposal) => numberValue(proposal.households)),
    max(scenarios, (scenario) => numberValue(scenario.households)),
    sum(selectedRoutes, (route) => routeHouseholds(route)),
  );
}

function computeTotalProjectedCost(
  phases: DbRow[],
  proposals: DbRow[],
  orders: DbRow[],
  scenarios: DbRow[],
  totalPieces: number,
): number {
  return (
    sum(phases, (phase) => numberValue(phase.total_estimated_cost_cents)) ||
    sum(proposals, (proposal) => numberValue(proposal.total_investment_cents)) ||
    sum(orders, (order) => numberValue(order.total_cents)) ||
    max(scenarios, (scenario) => numberValue(scenario.total_investment_cents)) ||
    totalPieces * MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS
  );
}

function computePrintCost(phases: DbRow[], totalPieces: number): number {
  return sum(phases, (phase) => numberValue(phase.estimated_print_cost_cents))
    || totalPieces * POLITICAL_POSTCARD_PRINT_ESTIMATE_CENTS;
}

function computePostageCost(phases: DbRow[], totalPieces: number): number {
  return sum(phases, (phase) => numberValue(phase.estimated_postage_cost_cents))
    || totalPieces * POLITICAL_POSTCARD_POSTAGE_ESTIMATE_CENTS;
}

function inferredPiecesFromOrder(order: DbRow, costPerPieceCents: number): number {
  const denominator = costPerPieceCents > 0 ? costPerPieceCents : MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS;
  return Math.round(numberValue(order.total_cents) / denominator);
}

function waveStatus(phase: DbRow): WaveStatus {
  const today = startOfDay(new Date());
  const dropDate = parseDate(textValue(phase.recommended_send_date));
  const windowStart = parseDate(textValue(phase.delivery_window_start));
  const windowEnd = parseDate(textValue(phase.delivery_window_end));

  if (windowEnd && windowEnd < today) return "completed";
  if (windowStart && windowEnd && windowStart <= today && windowEnd >= today) return "in_home";
  if (dropDate && dropDate < today) return "mail_entry";
  if (dropDate && daysUntil(textValue(phase.recommended_send_date)) < DEFAULT_TIMELINE.productionDays) return "at_risk";
  return "scheduled";
}

function nextDeadline(phases: DbRow[]): string | null {
  return firstDate(phases.map((phase) => textValue(phase.recommended_send_date)));
}

function firstDate(values: string[]): string | null {
  const dates = values.filter(Boolean).sort();
  return dates[0] ?? null;
}

function topUndercoveredAreas(activeRoutes: DbRow[], selectedRoutes: DbRow[]): string[] {
  const selectedIds = new Set(selectedRoutes.map((route) => textValue(route.id)));
  const groups = new Map<string, number>();

  activeRoutes.forEach((route) => {
    if (selectedIds.has(textValue(route.id))) return;
    const label = [textValue(route.city), textValue(route.county), textValue(route.state)].filter(Boolean).join(", ");
    if (!label) return;
    groups.set(label, (groups.get(label) ?? 0) + routeHouseholds(route));
  });

  return Array.from(groups.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([label, households]) => `${label} (${formatInteger(households)} HH)`);
}

function routeHouseholds(route: DbRow): number {
  return numberValue(route.residential_count) || numberValue(route.total_count);
}

function addIfPresent(set: Set<string>, value: string) {
  if (value) set.add(value);
}

function sum(rows: DbRow[], mapper: (row: DbRow) => number): number {
  return rows.reduce((total, row) => total + mapper(row), 0);
}

function max(rows: DbRow[], mapper: (row: DbRow) => number): number {
  return rows.reduce((largest, row) => Math.max(largest, mapper(row)), 0);
}

function divide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
}

function divideCents(numeratorCents: number, denominator: number): number {
  return Math.round(divide(numeratorCents, denominator));
}

function percent(numerator: number, denominator: number): number {
  return Math.round(divide(numerator, denominator) * 100);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysUntil(dateValue: string): number {
  const date = parseDate(dateValue);
  if (!date) return 0;
  const today = startOfDay(new Date());
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

function overlapsNextDays(start: string, end: string, days: number): boolean {
  const startDate = parseDate(start);
  const endDate = parseDate(end) ?? startDate;
  if (!startDate || !endDate) return false;
  const today = startOfDay(new Date());
  const horizon = new Date(today);
  horizon.setDate(today.getDate() + days);
  return startDate <= horizon && endDate >= today;
}

function formatWindow(start: string, end: string): string {
  if (!start && !end) return "Not scheduled";
  if (start && end) return `${start} to ${end}`;
  return start || end;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(value)));
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatCents(cents: number): string {
  return `${Math.round(cents)}c`;
}
