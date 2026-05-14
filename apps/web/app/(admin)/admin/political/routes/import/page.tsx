import Link from "next/link";
import { ImportWorkbench } from "../../imports/_components/ImportWorkbench";

// ─────────────────────────────────────────────────────────────────────────────
// /admin/political/routes/import
//
// CSV importer for USPS carrier-route data. Lands rows into political_routes
// tagged with the political_imports row id so they can be rolled back as a
// batch.
//
// Source policy: see /docs/political-csv-formats.md. We only accept files
// the operator certifies were obtained from an approved data source.
// VENDOR EXPORTS: operator-downloaded only. The system NEVER scrapes or
// automates logins on vendor checkout pages.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const metadata = { title: "Import Routes · Political · HomeReach" };

const SOURCE_OPTIONS = [
  {
    value: "usps_eddm_csv",
    label: "USPS — EDDM Retail tool CSV",
    hint: "From eddm.usps.com — operator-downloaded, no scraping. Standard EDDM column set.",
  },
  {
    value: "usps_partner_export",
    label: "USPS — Approved partner / vendor export",
    hint: "Bonded mailing partner's facility-route export. Operator must confirm the partner is on the approved-vendor list.",
  },
  {
    value: "vendor_export_48hrprint",
    label: "Vendor Export — 48HrPrint",
    hint: "Operator-downloaded CSV from 48HrPrint's own UI. The system does not log in or scrape — you export the file yourself and upload it here.",
  },
  {
    value: "vendor_export_other",
    label: "Vendor Export — Other (Lob, Smarty, Melissa, etc.)",
    hint: "Operator-downloaded CSV from any other licensed mailing or address-data vendor. Record the vendor name in the file before upload if helpful.",
  },
  {
    value: "manual_csv",
    label: "Hand-prepared CSV",
    hint: "Operator-built CSV from a primary source they have rights to. Use only when no upstream tool export is available.",
  },
] as const;

const REQUIRED = ["state", "zip5", "carrier_route_id", "total_count"] as const;
const OPTIONAL = [
  "zip4", "route_type", "residential_count", "business_count", "county", "city",
] as const;

export default function PoliticalRoutesImportPage() {
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Import Carrier Routes
          </h1>
          <p className="text-sm text-slate-600">
            Load USPS carrier-route data into <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">political_routes</code>.
            Files are validated and previewed before any insert.
          </p>
        </div>
        <Link
          href="/admin/political/routes/find-source"
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Where do I get the data?
        </Link>
      </header>

      <ImportWorkbench
        kind="routes"
        sourceOptions={SOURCE_OPTIONS}
        requiredColumns={REQUIRED}
        optionalColumns={OPTIONAL}
        formatDocPath="docs/political-csv-formats.md#routes"
      />
    </section>
  );
}
