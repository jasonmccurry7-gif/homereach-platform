"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Public /political portal — server actions.
//
// Single action: submit a "Start Plan" form. No auth required (this is the
// front door for new campaigns). Validation + insertion live in
// lib/political/leads.ts so this file stays a thin Next.js binding.
// ─────────────────────────────────────────────────────────────────────────────

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isPoliticalEnabled } from "@/lib/political/env";
import {
  createOutreachLead,
  OutreachLeadValidationError,
  type CreateOutreachLeadInput,
} from "@/lib/political/leads";
import {
  createProposalHandoffFromPlanner,
  type PlannerIntent,
} from "@/lib/political/proposal-handoff";

function s(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function n(formData: FormData, key: string): number | null {
  const raw = s(formData, key);
  if (!raw) return null;
  const num = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function firstNumber(formData: FormData, keys: string[]): number | null {
  for (const key of keys) {
    const value = n(formData, key);
    if (value !== null) return value;
  }
  return null;
}

function firstString(formData: FormData, keys: string[]): string | null {
  for (const key of keys) {
    const value = s(formData, key);
    if (value) return value;
  }
  return null;
}

function stateCode(value: string | null): string | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  return code.length === 2 ? code : value;
}

function compactStrategySummary(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const strategy = typeof parsed.recommendedStrategy === "string"
      ? parsed.recommendedStrategy
      : null;
    const reach = typeof parsed.totalReach === "number"
      ? parsed.totalReach.toLocaleString()
      : null;
    const cost = typeof parsed.totalCostCents === "number"
      ? `$${Math.round(parsed.totalCostCents / 100).toLocaleString()}`
      : null;
    const strength = typeof parsed.coverageStrengthScore === "number"
      ? `${parsed.coverageStrengthScore}/100`
      : null;
    const confidence = typeof parsed.deliveryConfidence === "string"
      ? parsed.deliveryConfidence
      : null;

    return [
      "Strategy engine summary:",
      strategy ? `recommended=${strategy}` : null,
      reach ? `reach=${reach}` : null,
      cost ? `cost=${cost}` : null,
      strength ? `coverage_strength=${strength}` : null,
      confidence ? `delivery_confidence=${confidence}` : null,
    ]
      .filter(Boolean)
      .join(" ");
  } catch {
    return null;
  }
}

function compactRouteCoverageSummary(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const selectedRoutes = typeof parsed.selectedRouteCount === "number"
      ? parsed.selectedRouteCount.toLocaleString()
      : null;
    const availableRoutes = typeof parsed.availableRouteCount === "number"
      ? parsed.availableRouteCount.toLocaleString()
      : null;
    const selectedHouseholds = typeof parsed.selectedHouseholds === "number"
      ? parsed.selectedHouseholds.toLocaleString()
      : null;
    const coveragePct = typeof parsed.coveragePct === "number"
      ? `${Math.round(parsed.coveragePct)}%`
      : null;
    const gapRoutes = typeof parsed.gapRouteCount === "number"
      ? parsed.gapRouteCount.toLocaleString()
      : null;

    return [
      "Route coverage summary:",
      selectedRoutes && availableRoutes ? `routes=${selectedRoutes}/${availableRoutes}` : null,
      selectedHouseholds ? `households=${selectedHouseholds}` : null,
      coveragePct ? `coverage=${coveragePct}` : null,
      gapRoutes ? `gap_routes=${gapRoutes}` : null,
    ]
      .filter(Boolean)
      .join(" ");
  } catch {
    return null;
  }
}

function compactSelectedScenarioSummary(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const label = typeof parsed.label === "string" ? parsed.label : null;
    const strategy = typeof parsed.strategy === "string" ? parsed.strategy : null;
    const routes = typeof parsed.routeCount === "number"
      ? parsed.routeCount.toLocaleString()
      : null;
    const households = typeof parsed.households === "number"
      ? parsed.households.toLocaleString()
      : null;
    const coveragePct = typeof parsed.coveragePct === "number"
      ? `${Math.round(parsed.coveragePct)}%`
      : null;
    const cost = typeof parsed.totalCostCents === "number"
      ? `$${Math.round(parsed.totalCostCents / 100).toLocaleString()}`
      : null;
    const drops = typeof parsed.drops === "number"
      ? parsed.drops.toLocaleString()
      : null;

    return [
      "Selected final scenario:",
      label ? `label=${label}` : null,
      strategy ? `strategy=${strategy}` : null,
      routes ? `routes=${routes}` : null,
      households ? `households=${households}` : null,
      coveragePct ? `coverage=${coveragePct}` : null,
      cost ? `cost=${cost}` : null,
      drops ? `drops=${drops}` : null,
    ]
      .filter(Boolean)
      .join(" ");
  } catch {
    return null;
  }
}

function compactScenarioComparisonSummary(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const options = parsed
      .slice(0, 8)
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const label = typeof row.label === "string" ? row.label : null;
        const households = typeof row.households === "number"
          ? row.households.toLocaleString()
          : null;
        const cost = typeof row.totalCostCents === "number"
          ? `$${Math.round(row.totalCostCents / 100).toLocaleString()}`
          : null;
        if (!label || !households || !cost) return null;
        return `${label}: ${households} households / ${cost}`;
      })
      .filter(Boolean);

    return options.length > 0
      ? `Scenario comparison: ${options.join("; ")}`
      : null;
  } catch {
    return null;
  }
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function parseJsonArray(raw: string | null): unknown[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseCsvList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 250);
}

export async function submitPlanIntent(
  formData: FormData,
): Promise<void> {
  if (!isPoliticalEnabled()) {
    // Flag-off: silently redirect home; the page itself renders 404 anyway.
    redirect("/");
  }

  const h = await headers();
  const utmSource    = s(formData, "utm_source");
  const utmMedium    = s(formData, "utm_medium");
  const utmCampaign  = s(formData, "utm_campaign");

  const districtTypeRaw = firstString(formData, ["districtType", "strategyDistrictType"]);
  const districtType =
    districtTypeRaw === "federal" || districtTypeRaw === "state" || districtTypeRaw === "local"
      ? districtTypeRaw
      : null;

  const geographyTypeRaw = firstString(formData, ["geographyType", "strategyGeographyType"]);
  const geographyType =
    geographyTypeRaw === "state" ||
    geographyTypeRaw === "county" ||
    geographyTypeRaw === "city" ||
    geographyTypeRaw === "district"
      ? geographyTypeRaw
      : null;

  const budgetDollars = firstNumber(formData, ["budgetEstimate", "strategyBudgetEstimate"]);
  const budgetCents = budgetDollars !== null ? Math.round(budgetDollars * 100) : null;
  const campaignGoal = s(formData, "campaignGoal");
  const userNotes = s(formData, "notes");
  const strategySnapshotRaw = s(formData, "strategySnapshot");
  const selectedScenarioSnapshotRaw = s(formData, "selectedScenarioSnapshot");
  const scenarioComparisonSnapshotRaw = s(formData, "scenarioComparisonSnapshot");
  const routeCoverageSnapshotRaw = s(formData, "routeCoverageSnapshot");
  const selectedRouteIds = parseCsvList(s(formData, "selectedRouteIds"));
  const plannerIntent: PlannerIntent =
    s(formData, "plannerIntent") === "generate_proposal"
      ? "generate_proposal"
      : "request_review";

  const strategySnapshot = parseJsonObject(strategySnapshotRaw);
  const selectedScenarioSnapshot = parseJsonObject(selectedScenarioSnapshotRaw);
  const scenarioComparisonSnapshot = parseJsonArray(scenarioComparisonSnapshotRaw);
  const routeCoverageSnapshot = parseJsonObject(routeCoverageSnapshotRaw);

  const strategySummary = compactStrategySummary(strategySnapshotRaw);
  const selectedScenarioSummary = compactSelectedScenarioSummary(selectedScenarioSnapshotRaw);
  const scenarioComparisonSummary = compactScenarioComparisonSummary(
    scenarioComparisonSnapshotRaw,
  );
  const routeCoverageSummary = compactRouteCoverageSummary(routeCoverageSnapshotRaw);
  const notes = [
    userNotes,
    campaignGoal ? `Campaign goal: ${campaignGoal}` : null,
    strategySummary,
    selectedScenarioSummary,
    scenarioComparisonSummary,
    routeCoverageSummary,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 3900);

  const input: CreateOutreachLeadInput = {
    contactName:          s(formData, "contactName")    ?? "",
    contactEmail:         s(formData, "contactEmail")   ?? "",
    contactPhone:         s(formData, "contactPhone"),
    candidateName:        s(formData, "candidateName"),
    officeSought:         s(formData, "officeSought"),
    organizationName:     s(formData, "organizationName"),
    state:                stateCode(firstString(formData, ["state", "strategyState"])),
    geographyType,
    geographyValue:       firstString(formData, ["geographyValue", "strategyGeographyValue"]),
    districtType,
    electionDate:         s(formData, "electionDate"),
    budgetEstimateCents:  budgetCents,
    desiredDropCount:     firstNumber(formData, ["desiredDropCount", "strategyDropCount"]),
    notes,
    consentMarketing:     formData.get("consentMarketing") === "on",
    plannerIntent,
    strategySnapshot,
    selectedScenarioSnapshot,
    scenarioComparisonSnapshot,
    routeCoverageSnapshot,
    selectedRouteIds,

    utmSource,
    utmMedium,
    utmCampaign,
    ipAddress:            h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent:            h.get("user-agent"),
  };

  try {
    const { id } = await createOutreachLead(input);
    if (plannerIntent === "generate_proposal") {
      let publicToken: string | null = null;
      try {
        const handoff = await createProposalHandoffFromPlanner(id, input, {
          strategySnapshot,
          selectedScenarioSnapshot,
          scenarioComparisonSnapshot,
          routeCoverageSnapshot,
          selectedRouteIds,
        });
        publicToken = handoff.proposal.publicToken;
      } catch (err) {
        console.error("[political/submitPlanIntent] proposal handoff failed", err);
        redirect(`/political/thanks?ref=${encodeURIComponent(id)}&proposal=queued`);
      }
      if (publicToken) redirect(`/p/${publicToken}`);
    }
    redirect(`/political/thanks?ref=${encodeURIComponent(id)}`);
  } catch (err) {
    // redirect() throws — let it propagate so Next.js can complete the navigation.
    if (err && typeof err === "object" && "digest" in err) throw err;

    if (err instanceof OutreachLeadValidationError) {
      const params = new URLSearchParams({ error: err.message });
      // Re-stuff a few high-signal fields so the user doesn't lose their work.
      if (input.contactName)  params.set("contactName",  input.contactName);
      if (input.contactEmail) params.set("contactEmail", input.contactEmail);
      redirect(`/political/plan?${params.toString()}`);
    }

    console.error("[political/submitPlanIntent] failed", err);
    redirect(`/political/plan?error=${encodeURIComponent("Something went wrong. Please try again.")}`);
  }
}
