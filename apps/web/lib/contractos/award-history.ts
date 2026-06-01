import "server-only";

import type { GovContractOpportunity } from "@/lib/gov-contracts/types";

const USA_SPENDING_AWARD_URL =
  process.env.USA_SPENDING_AWARD_URL || "https://api.usaspending.gov/api/v2/search/spending_by_award/";

type UsaSpendingAwardRow = Record<string, unknown>;

export type ContractOSHistoricalAward = {
  awardId: string;
  recipientName: string;
  awardAmountCents: number | null;
  startDate: string | null;
  endDate: string | null;
  awardingAgency: string | null;
  awardingSubAgency: string | null;
  naicsCode: string | null;
  pscCode: string | null;
  awardType: string | null;
  sourceUrl: string | null;
};

export type ContractOSAwardHistoryInsight = {
  status: "verified" | "partial" | "needs_codes" | "unavailable";
  generatedAt: string;
  sourceLabel: string;
  sourceUrl: string;
  summary: string;
  competitiveRangeSummary: string;
  pricingSignals: string[];
  awards: ContractOSHistoricalAward[];
  warnings: string[];
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function fiveYearsAgoIsoDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 5);
  return date.toISOString().slice(0, 10);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function moneyCents(value: unknown) {
  const dollars = numberValue(value);
  return dollars === null ? null : Math.round(dollars * 100);
}

function field(row: UsaSpendingAwardRow, ...keys: string[]) {
  for (const key of keys) {
    if (key in row) return row[key];
  }
  return null;
}

function sourceUrl(row: UsaSpendingAwardRow) {
  const generatedId = stringValue(field(row, "generated_internal_id", "Generated Internal ID", "internal_id"));
  if (!generatedId) return null;
  return `https://www.usaspending.gov/award/${encodeURIComponent(generatedId)}`;
}

function mapAward(row: UsaSpendingAwardRow): ContractOSHistoricalAward {
  return {
    awardId:
      stringValue(field(row, "Award ID", "award_id", "award_generated_unique_id")) ??
      stringValue(field(row, "generated_internal_id", "Generated Internal ID")) ??
      "Award ID not listed",
    recipientName: stringValue(field(row, "Recipient Name", "recipient_name")) ?? "Recipient not listed",
    awardAmountCents: moneyCents(field(row, "Award Amount", "award_amount", "generated_pragmatic_obligation")),
    startDate: stringValue(field(row, "Start Date", "period_of_performance_start_date", "start_date")),
    endDate: stringValue(field(row, "End Date", "period_of_performance_current_end_date", "end_date")),
    awardingAgency: stringValue(field(row, "Awarding Agency", "awarding_agency_name")),
    awardingSubAgency: stringValue(field(row, "Awarding Sub Agency", "awarding_sub_agency_name")),
    naicsCode: stringValue(field(row, "NAICS", "naics_code")),
    pscCode: stringValue(field(row, "PSC", "product_or_service_code")),
    awardType: stringValue(field(row, "Contract Award Type", "type_description", "award_type")),
    sourceUrl: sourceUrl(row),
  };
}

function formatMoney(cents: number | null) {
  if (!cents) return "value not listed";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function buildSummary(awards: ContractOSHistoricalAward[], opportunity: GovContractOpportunity) {
  if (!awards.length) {
    return {
      summary:
        "USAspending.gov returned no recent comparable awards for the available opportunity codes. Use this as a source gap, not proof that no market exists.",
      competitiveRangeSummary:
        "Competitive range cannot be verified from historical awards yet. Pricing should stay blocked until solicitation quantity, scope, and prior award references are reviewed.",
      pricingSignals: [
        "No historical award value was found for the available NAICS/PSC signals.",
        "Do not use estimated opportunity value as a bid floor without official quantity and scope support.",
        "Ask for incumbent, award history, and pricing basis during human review.",
      ],
    };
  }

  const amounts = awards
    .map((award) => award.awardAmountCents)
    .filter((amount): amount is number => typeof amount === "number" && amount > 0)
    .sort((a, b) => a - b);
  const low = amounts[0] ?? null;
  const high = amounts[amounts.length - 1] ?? null;
  const average = amounts.length
    ? Math.round(amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length)
    : null;
  const recipients = Array.from(new Set(awards.map((award) => award.recipientName).filter(Boolean))).slice(0, 4);

  return {
    summary: `${awards.length} recent USAspending.gov award${awards.length === 1 ? "" : "s"} were found for ${opportunity.naicsCode ? `NAICS ${opportunity.naicsCode}` : "the available opportunity signal"}. Prior recipients include ${recipients.join(", ") || "vendors not listed"}.`,
    competitiveRangeSummary:
      amounts.length > 0
        ? `Observed award values range from ${formatMoney(low)} to ${formatMoney(high)}, with an average around ${formatMoney(average)}. Treat this as market context, not a bid price.`
        : "Award records were found, but usable award amounts were not available. Keep pricing blocked until value and quantity basis are verified.",
    pricingSignals: [
      `Comparable low signal: ${formatMoney(low)}.`,
      `Comparable average signal: ${formatMoney(average)}.`,
      `Comparable high signal: ${formatMoney(high)}.`,
      "Compare these against labor, subcontractor, equipment, compliance burden, overhead, and cash-flow timing before pricing.",
    ],
  };
}

function needsCodes(opportunity: GovContractOpportunity) {
  return !opportunity.naicsCode && !opportunity.pscCode;
}

export async function loadContractOSAwardHistory(
  opportunity: GovContractOpportunity,
  limit = 5,
): Promise<ContractOSAwardHistoryInsight> {
  const generatedAt = new Date().toISOString();
  const sourceUrl = "https://www.usaspending.gov/";

  if (needsCodes(opportunity)) {
    return {
      status: "needs_codes",
      generatedAt,
      sourceLabel: "USAspending.gov",
      sourceUrl,
      summary: "Historical award intelligence needs a NAICS or PSC code before ContractOS can run a comparable-award search.",
      competitiveRangeSummary: "Competitive range is unavailable until official classification codes are verified.",
      pricingSignals: [
        "Verify NAICS/PSC on the official notice.",
        "Do not estimate a competitive range from title text alone.",
      ],
      awards: [],
      warnings: ["Missing opportunity NAICS/PSC code."],
    };
  }

  const filters: Record<string, unknown> = {
    time_period: [{ start_date: fiveYearsAgoIsoDate(), end_date: todayIsoDate() }],
    award_type_codes: ["A", "B", "C", "D"],
  };

  if (opportunity.naicsCode) {
    filters.naics_codes = { require: [opportunity.naicsCode] };
  }

  const body = {
    filters,
    fields: [
      "Award ID",
      "Recipient Name",
      "Award Amount",
      "Start Date",
      "End Date",
      "Awarding Agency",
      "Awarding Sub Agency",
      "Contract Award Type",
      "NAICS",
      "PSC",
    ],
    sort: "Award Amount",
    order: "desc",
    limit: Math.min(Math.max(limit, 1), 20),
    page: 1,
  };

  try {
    const response = await fetch(USA_SPENDING_AWARD_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return {
        status: "unavailable",
        generatedAt,
        sourceLabel: "USAspending.gov",
        sourceUrl,
        summary: `Historical award connector is present, but USAspending.gov returned HTTP ${response.status}.`,
        competitiveRangeSummary: "Competitive range is unavailable until the connector returns comparable awards.",
        pricingSignals: ["Run market research again before pricing.", "Keep underbid controls active."],
        awards: [],
        warnings: [`USAspending.gov request failed with HTTP ${response.status}.`],
      };
    }

    const payload = (await response.json()) as { results?: UsaSpendingAwardRow[] };
    const awards = (payload.results ?? []).map(mapAward);
    const summary = buildSummary(awards, opportunity);

    return {
      status: awards.length > 0 ? "verified" : "partial",
      generatedAt,
      sourceLabel: "USAspending.gov",
      sourceUrl,
      ...summary,
      awards,
      warnings: [
        "Historical awards are market context only and do not replace official solicitation pricing instructions.",
        ...(opportunity.pscCode ? [] : ["PSC code is missing; the search used available classification signals only."]),
      ],
    };
  } catch (error) {
    return {
      status: "unavailable",
      generatedAt,
      sourceLabel: "USAspending.gov",
      sourceUrl,
      summary: "Historical award connector is configured, but the live request could not complete.",
      competitiveRangeSummary: "Competitive range remains blocked until historical awards or another verified pricing source is available.",
      pricingSignals: ["Retry USAspending.gov research.", "Attach prior award references if available."],
      awards: [],
      warnings: [error instanceof Error ? error.message : "Unknown USAspending.gov connector error."],
    };
  }
}
