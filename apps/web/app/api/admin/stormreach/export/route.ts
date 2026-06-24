import { NextResponse } from "next/server";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { createGuardedServiceRoleClient } from "@/lib/security/guarded-service-role";
import { loadStormReachDashboard } from "@/lib/stormreach/repository";

export const dynamic = "force-dynamic";

const EXPORTS = {
  events: ["title", "event_type", "severity_level", "severity_score", "impacted_state", "impacted_counties", "impacted_cities", "impacted_zip_codes", "status", "source", "source_url", "detected_at"],
  prospects: ["business_name", "category", "city", "state", "email", "phone", "website", "source", "suppression_status", "crm_status", "created_at"],
  outreach: ["subject", "channel", "recipient_email", "recipient_phone", "approval_status", "status", "suppression_status", "created_at"],
  packages: ["package_name", "package_type", "industry", "approval_status", "status", "estimated_price_to_client_cents", "created_at"],
  assets: ["title", "asset_type", "format", "status", "approval_status", "generated_by", "created_at"],
  campaigns: ["campaign_name", "campaign_type", "opportunity_level", "status", "approval_status", "recommended_mail_quantity", "estimated_value_cents", "created_at"],
} as const;

type ExportKey = keyof typeof EXPORTS;
type ExportFormat = "csv" | "xlsx" | "word";

export async function GET(request: Request) {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const type = normalizeType(url.searchParams.get("type"));
  const format = normalizeFormat(url.searchParams.get("format"));
  const state = String(url.searchParams.get("state") ?? "").trim().toUpperCase();
  const eventId = String(url.searchParams.get("eventId") ?? "").trim();
  const { supabase } = createGuardedServiceRoleClient({
    allowedRoles: ["admin", "sales_agent"],
    guard,
    purpose: "Export StormReach data",
    route: "/api/admin/stormreach/export",
  });
  const data = await loadStormReachDashboard(supabase);
  const rows = rowsForExport(type, data, state, eventId);

  if (format === "xlsx") {
    const workbook = buildExcelWorkbook(type, data, rows, state, eventId);
    return new NextResponse(workbook, {
      headers: {
        "content-type": "application/vnd.ms-excel; charset=utf-8",
        "content-disposition": `attachment; filename="stormreach-${type}-${state || "all"}.xls"`,
        "cache-control": "no-store",
      },
    });
  }

  if (format === "word") {
    const html = buildWordHtml(type, data, state, eventId);
    return new NextResponse(html, {
      headers: {
        "content-type": "application/msword; charset=utf-8",
        "content-disposition": `attachment; filename="stormreach-${type}-${state || "all"}.doc"`,
        "cache-control": "no-store",
      },
    });
  }

  const csv = toCsv(EXPORTS[type], rows);

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="stormreach-${type}-${state || "all"}.csv"`,
      "cache-control": "no-store",
    },
  });
}

function normalizeType(value: string | null): ExportKey {
  return value === "prospects" || value === "outreach" || value === "packages" || value === "assets" || value === "campaigns" ? value : "events";
}

function normalizeFormat(value: string | null): ExportFormat {
  return value === "xlsx" || value === "word" ? value : "csv";
}

function rowsForExport(type: ExportKey, data: Awaited<ReturnType<typeof loadStormReachDashboard>>, state: string, eventId: string) {
  const eventFilter = (row: unknown) => {
    const record = row && typeof row === "object" ? row as Record<string, unknown> : {};
    return !eventId || String(record.storm_event_id ?? record.id ?? "") === eventId || String(record.event_id ?? "") === eventId;
  };
  if (type === "events") return (state ? data.events.filter((row) => row.impacted_state === state) : data.events).filter(eventFilter);
  if (type === "prospects") return (state ? data.prospects.filter((row) => String(row.state ?? "").toUpperCase() === state) : data.prospects).filter(eventFilter);
  if (type === "outreach") return data.outreachMessages.filter(eventFilter);
  if (type === "assets") return data.generatedAssets.filter(eventFilter);
  if (type === "campaigns") return data.campaigns.filter(eventFilter);
  return data.packages.filter(eventFilter);
}

function toCsv(columns: readonly string[], rows: Record<string, unknown>[]) {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function buildExcelWorkbook(type: ExportKey, data: Awaited<ReturnType<typeof loadStormReachDashboard>>, rows: Record<string, unknown>[], state: string, eventId: string) {
  const businessRows = buildBusinessBatchRows(data, state, eventId);
  return [
    "<?xml version=\"1.0\"?>",
    "<?mso-application progid=\"Excel.Sheet\"?>",
    "<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\" xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\">",
    excelSheet(labelSheet(type), rows.map((row) => flattenRow(row))),
    businessRows.length ? excelSheet("Business Drafts", businessRows.map((row) => flattenRow(row))) : "",
    "</Workbook>",
  ].join("");
}

function excelSheet(name: string, rows: Record<string, unknown>[]) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [
    `<Worksheet ss:Name="${escapeXml(name.slice(0, 31) || "StormReach")}"><Table>`,
    "<Row>",
    ...columns.map((column) => `<Cell><Data ss:Type="String">${escapeXml(column)}</Data></Cell>`),
    "</Row>",
    ...rows.map((row) => [
      "<Row>",
      ...columns.map((column) => `<Cell><Data ss:Type="String">${escapeXml(row[column])}</Data></Cell>`),
      "</Row>",
    ].join("")),
    "</Table></Worksheet>",
  ].join("");
}

function buildWordHtml(type: ExportKey, data: Awaited<ReturnType<typeof loadStormReachDashboard>>, state: string, eventId: string) {
  const businessRows = buildBusinessBatchRows(data, state, eventId).slice(0, 250);
  const title = `StormReach ${labelSheet(type)} Export${state ? ` - ${state}` : ""}`;
  const batches = chunk(businessRows, 10);
  return [
    "<!doctype html><html><head><meta charset=\"utf-8\">",
    `<title>${escapeHtml(title)}</title>`,
    "<style>body{font-family:Arial,sans-serif;color:#0f172a;margin:36px}h1{font-size:28px}h2{font-size:20px;margin-top:28px}.card{border:1px solid #cbd5e1;border-radius:8px;padding:14px;margin:12px 0}.label{font-weight:700;color:#475569}.draft{white-space:pre-wrap;background:#f8fafc;border-radius:6px;padding:10px;margin-top:6px}.guard{background:#fff7ed;border:1px solid #fed7aa;padding:12px;border-radius:8px;font-weight:700}</style></head><body>",
    `<h1>${escapeHtml(title)}</h1>`,
    "<p class=\"guard\">Human approval is required before sending email, SMS, Facebook Messenger, postcards, payments, or ad launches.</p>",
    ...batches.flatMap((batch, batchIndex) => [
      `<h2>Batch ${batchIndex + 1}</h2>`,
      ...batch.map((row, index) => businessCard(row, batchIndex * 10 + index + 1)),
    ]),
    businessRows.length ? "" : "<p>No businesses matched this export scope.</p>",
    "</body></html>",
  ].join("");
}

function buildBusinessBatchRows(data: Awaited<ReturnType<typeof loadStormReachDashboard>>, state: string, eventId: string) {
  const messagesByProspect = new Map<string, Record<string, Record<string, unknown>>>();
  for (const message of data.outreachMessages) {
    const prospectId = String(message.prospect_id ?? "");
    const channel = String(message.channel ?? "");
    if (!prospectId || !channel) continue;
    const row = messagesByProspect.get(prospectId) ?? {};
    row[channel] = message;
    messagesByProspect.set(prospectId, row);
  }
  return data.prospects
    .filter((row) => !state || String(row.state ?? "").toUpperCase() === state)
    .filter((row) => !eventId || String(row.storm_event_id ?? "") === eventId)
    .slice(0, 500)
    .map((prospect) => {
      const drafts = messagesByProspect.get(String(prospect.id ?? "")) ?? {};
      const metadata = objectValue(prospect.metadata);
      return {
        business_name: prospect.business_name ?? "",
        category: prospect.category ?? "",
        city: prospect.city ?? "",
        state: prospect.state ?? "",
        phone: prospect.phone ?? "Not publicly found",
        email: prospect.email ?? "Not publicly found",
        website: prospect.website ?? "",
        facebook_page: metadata.facebook_page ?? "Not publicly found",
        messenger_link: metadata.messenger_link ?? "Not publicly found",
        distance_to_event: prospect.distance_to_event ?? "",
        lead_score: leadScore(prospect),
        source: prospect.source ?? "",
        source_url: metadata.source_url ?? metadata.formatted_address ?? prospect.website ?? "",
        verification_status: metadata.verification_status ?? (prospect.email ? "partially_verified_public_sources" : "contact_incomplete"),
        email_subject: drafts.email?.subject ?? "",
        email_draft: drafts.email?.body ?? "",
        sms_draft: drafts.sms?.body ?? "",
        messenger_draft: drafts.facebook_dm?.body ?? "",
        outreach_status: drafts.email?.approval_status ?? drafts.sms?.approval_status ?? drafts.facebook_dm?.approval_status ?? "not_drafted",
        suppression_status: prospect.suppression_status ?? "unknown",
        crm_status: prospect.crm_status ?? "new",
      };
    });
}

function businessCard(row: Record<string, unknown>, number: number) {
  return [
    "<div class=\"card\">",
    `<h3>${number}. ${escapeHtml(row.business_name)}</h3>`,
    `<p><span class=\"label\">Category:</span> ${escapeHtml(row.category)} | <span class=\"label\">Location:</span> ${escapeHtml(row.city)}, ${escapeHtml(row.state)}</p>`,
    `<p><span class=\"label\">Phone:</span> ${escapeHtml(row.phone)} | <span class=\"label\">Email:</span> ${escapeHtml(row.email)} | <span class=\"label\">Lead score:</span> ${escapeHtml(row.lead_score)}</p>`,
    `<p><span class=\"label\">Website:</span> ${escapeHtml(row.website)} | <span class=\"label\">Messenger:</span> ${escapeHtml(row.messenger_link)}</p>`,
    `<p><span class=\"label\">Source:</span> ${escapeHtml(row.source)} | <span class=\"label\">Status:</span> ${escapeHtml(row.outreach_status)}</p>`,
    row.email_subject ? `<p><span class=\"label\">Email subject:</span> ${escapeHtml(row.email_subject)}</p>` : "",
    row.email_draft ? `<div class=\"draft\"><strong>Email</strong>\n${escapeHtml(row.email_draft)}</div>` : "",
    row.sms_draft ? `<div class=\"draft\"><strong>SMS</strong>\n${escapeHtml(row.sms_draft)}</div>` : "",
    row.messenger_draft ? `<div class=\"draft\"><strong>Messenger</strong>\n${escapeHtml(row.messenger_draft)}</div>` : "",
    "</div>",
  ].join("");
}

function flattenRow(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Array.isArray(value) ? value.join("; ") : typeof value === "object" && value ? JSON.stringify(value) : value]));
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function leadScore(row: Record<string, unknown>) {
  let score = Number(row.confidence_score ?? 50);
  if (row.email) score += 10;
  if (row.phone) score += 6;
  if (row.website) score += 4;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function labelSheet(type: ExportKey) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function chunk<T>(rows: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < rows.length; index += size) batches.push(rows.slice(index, index + size));
  return batches;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(value: unknown) {
  return escapeHtml(Array.isArray(value) ? value.join("; ") : value).replace(/'/g, "&apos;");
}
