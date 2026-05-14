import { ImportWorkbench } from "../../imports/_components/ImportWorkbench";

// ─────────────────────────────────────────────────────────────────────────────
// /admin/political/organizations/import
//
// CSV importer for political_organizations.
//
// Approved sources:
//   • FEC committee master file (cm.txt converted to CSV — pipe → comma)
//   • Ohio Secretary of State PAC filings (CSV download)
//   • Operator-prepared CSV from another approved primary source
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const metadata = { title: "Import Organizations · Political · HomeReach" };

const SOURCE_OPTIONS = [
  {
    value: "fec_committees",
    label: "FEC committee master file",
    hint: "From fec.gov/data/browse-data/?tab=bulk-data — committee master (cm.txt). Convert to CSV before upload.",
  },
  {
    value: "oh_sos_pacs",
    label: "Ohio Secretary of State — PAC filings",
    hint: "From ohiosos.gov campaign-finance downloads. CSV format only.",
  },
  {
    value: "manual_csv",
    label: "Hand-prepared CSV",
    hint: "Operator-built CSV from a primary source they have rights to. Use only when no bulk download is available.",
  },
] as const;

const REQUIRED = ["legal_name", "org_type", "state"] as const;
const OPTIONAL = [
  "display_name", "ein",
  "primary_contact_name", "primary_contact_email", "primary_contact_phone",
  "website", "notes",
] as const;

export default function PoliticalOrganizationsImportPage() {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Import Organizations
        </h1>
        <p className="text-sm text-slate-600">
          Load real PACs, party committees, and advocacy orgs into{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
            political_organizations
          </code>
          . FEC single-letter committee_type codes are auto-mapped to our org_type enum.
        </p>
      </header>

      <ImportWorkbench
        kind="organizations"
        sourceOptions={SOURCE_OPTIONS}
        requiredColumns={REQUIRED}
        optionalColumns={OPTIONAL}
        formatDocPath="docs/political-csv-formats.md#organizations"
      />
    </section>
  );
}
