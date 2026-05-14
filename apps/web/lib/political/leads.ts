// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Political Outreach Leads
//
// Public-portal lead capture (POST from /political/plan submission form).
// Service-role insert: RLS allows anon insert with constraints (status='new',
// no assigned_to, etc.) so we use the service-role client to keep the
// insert path identical to admin-side flows and avoid a second policy.
//
// Strict input validation lives here so the route handler stays thin.
// All political-compliance rules (no voter scoring, etc.) apply: nothing in
// the lead form captures or stores ideology, persuasion, or individual-voter
// fields. This module enforces that boundary at the input contract.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/service";

export interface CreateOutreachLeadInput {
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  candidateName?: string | null;
  officeSought?: string | null;
  organizationName?: string | null;
  state?: string | null;
  geographyType?: "state" | "county" | "city" | "district" | null;
  geographyValue?: string | null;
  districtType?: "federal" | "state" | "local" | null;
  electionDate?: string | null;        // ISO yyyy-mm-dd
  budgetEstimateCents?: number | null;
  desiredDropCount?: number | null;
  notes?: string | null;
  consentMarketing?: boolean;
  plannerIntent?: "request_review" | "generate_proposal";
  strategySnapshot?: Record<string, unknown> | null;
  selectedScenarioSnapshot?: Record<string, unknown> | null;
  scenarioComparisonSnapshot?: unknown[] | null;
  routeCoverageSnapshot?: Record<string, unknown> | null;
  selectedRouteIds?: string[] | null;

  // Provenance (filled in by the route handler from request headers)
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CreateOutreachLeadResult {
  id: string;
}

export class OutreachLeadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutreachLeadValidationError";
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MIN = 2;
const NAME_MAX = 200;
const NOTES_MAX = 4000;

function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function validate(input: CreateOutreachLeadInput): void {
  const name = trimOrNull(input.contactName);
  if (!name || name.length < NAME_MIN || name.length > NAME_MAX) {
    throw new OutreachLeadValidationError("Contact name is required (2-200 chars).");
  }
  const email = trimOrNull(input.contactEmail);
  if (!email || !EMAIL_RE.test(email) || email.length > 320) {
    throw new OutreachLeadValidationError("A valid contact email is required.");
  }
  if (input.notes && input.notes.length > NOTES_MAX) {
    throw new OutreachLeadValidationError("Notes too long.");
  }
  if (input.state && (input.state.length !== 2 || input.state !== input.state.toUpperCase())) {
    throw new OutreachLeadValidationError("State must be a 2-letter uppercase abbreviation.");
  }
}

/**
 * Insert an inbound lead from the public /political portal.
 *
 * Uses the service-role client because the public form has no user session.
 * The migration-068 RLS policy `political_outreach_leads_anon_insert` would
 * also accept this insert, but going through service-role keeps the surface
 * uniform with all other admin paths.
 */
export async function createOutreachLead(
  input: CreateOutreachLeadInput,
): Promise<CreateOutreachLeadResult> {
  validate(input);
  const sb = createServiceClient();

  const row = {
    contact_name:           input.contactName.trim(),
    contact_email:          input.contactEmail.trim().toLowerCase(),
    contact_phone:          trimOrNull(input.contactPhone),
    candidate_name:         trimOrNull(input.candidateName),
    office_sought:          trimOrNull(input.officeSought),
    organization_name:      trimOrNull(input.organizationName),
    state:                  input.state ? input.state.trim().toUpperCase() : null,
    geography_type:         input.geographyType ?? null,
    geography_value:        trimOrNull(input.geographyValue),
    district_type:          input.districtType ?? null,
    election_date:          trimOrNull(input.electionDate),
    budget_estimate_cents:  typeof input.budgetEstimateCents === "number"
      ? Math.max(0, Math.floor(input.budgetEstimateCents))
      : null,
    desired_drop_count:     typeof input.desiredDropCount === "number"
      ? Math.max(0, Math.floor(input.desiredDropCount))
      : null,
    notes:                  trimOrNull(input.notes),
    consent_marketing:      Boolean(input.consentMarketing),

    source:                 "public_portal",
    utm_source:             trimOrNull(input.utmSource),
    utm_medium:             trimOrNull(input.utmMedium),
    utm_campaign:           trimOrNull(input.utmCampaign),
    ip_address:             trimOrNull(input.ipAddress),
    user_agent:             trimOrNull(input.userAgent),
  };

  const extendedRow = {
    ...row,
    planner_intent: input.plannerIntent ?? "request_review",
    strategy_snapshot: input.strategySnapshot ?? {},
    selected_scenario_snapshot: input.selectedScenarioSnapshot ?? {},
    scenario_comparison_snapshot: input.scenarioComparisonSnapshot ?? [],
    route_coverage_snapshot: input.routeCoverageSnapshot ?? {},
    selected_route_ids: input.selectedRouteIds ?? [],
  };

  let { data, error } = await sb
    .from("political_outreach_leads")
    .insert(extendedRow)
    .select("id")
    .single();

  const insertErrorMessage = error?.message.toLowerCase() ?? "";
  if (
    error &&
    insertErrorMessage &&
    [
      "planner_intent",
      "strategy_snapshot",
      "selected_scenario_snapshot",
      "scenario_comparison_snapshot",
      "route_coverage_snapshot",
      "selected_route_ids",
    ]
      .some((column) => insertErrorMessage.includes(column))
  ) {
    const fallback = await sb
      .from("political_outreach_leads")
      .insert(row)
      .select("id")
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    // Don't leak internal error detail to the caller.
    console.error("[political/leads] insert failed", { code: error.code, message: error.message });
    throw new Error("Could not save your request. Please try again or email us directly.");
  }

  if (!data?.id) {
    throw new Error("Could not save your request. Please try again or email us directly.");
  }

  return { id: data.id as string };
}
