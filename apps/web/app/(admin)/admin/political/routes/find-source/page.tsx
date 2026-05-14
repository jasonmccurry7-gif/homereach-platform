import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// /admin/political/routes/find-source
//
// Operator runbook for getting carrier-route data into HomeReach. Lays out
// every approved source with explicit step-by-step instructions and the
// hard "DO NOT" list (no scraping, no login automation, no checkout
// bypass).
//
// This page is intentionally text-heavy. It exists so an admin who's never
// done a route import can land here and finish a real import in minutes
// without reading any external docs.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const metadata = { title: "Where to Get Route Data · Political · HomeReach" };

export default function FindRouteSourcePage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Where to get carrier-route data
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          HomeReach accepts carrier-route data from several approved sources.
          You always download the file yourself from the source's own UI,
          then upload it through{" "}
          <Link
            href="/admin/political/routes/import"
            className="text-blue-700 hover:underline"
          >
            /admin/political/routes/import
          </Link>
          . The system never logs in to vendor sites, never scrapes checkout
          pages, and never bypasses any access control.
        </p>
      </header>

      <DoDontBanner />

      <SourceCard
        rank="Primary"
        title="USPS — EDDM Retail tool"
        sourceLabel="usps_eddm_csv"
        url="https://eddm.usps.com/eddm/select-routes.action"
        steps={[
          "Open the USPS EDDM Retail tool (link above) in your browser.",
          "Sign in with your USPS Business account.",
          "Search by ZIP code — you can enter a single ZIP or filter by city/state.",
          "Filter by route type and household density if helpful.",
          "Click 'Download' to export the route list as a CSV.",
          "Upload that CSV at /admin/political/routes/import with source 'USPS — EDDM Retail tool CSV'.",
        ]}
        notes={
          <p>
            The USPS EDDM tool is the canonical source. Its CSV columns map
            cleanly to HomeReach's required fields with no manual editing.
          </p>
        }
      />

      <SourceCard
        rank="Primary"
        title="USPS — Approved partner / mailer export"
        sourceLabel="usps_partner_export"
        steps={[
          "Confirm the mailing partner is on HomeReach's approved-vendor list.",
          "Request a facility-route export from the partner directly (email or partner portal).",
          "Save the CSV they send to your local machine.",
          "Upload at /admin/political/routes/import with source 'USPS — Approved partner / vendor export'.",
        ]}
        notes={
          <p>
            Use this when an approved bonded partner has cleaner or more
            granular data than the public EDDM export.
          </p>
        }
      />

      <SourceCard
        rank="Vendor (manual)"
        title="48HrPrint"
        sourceLabel="vendor_export_48hrprint"
        url="https://www.48hourprint.com/"
        steps={[
          "Sign in to your 48HrPrint account in your own browser.",
          "Configure an EDDM mailing list using their tools (ZIP search, route filters, etc.).",
          "Look for a 'Download' / 'Export' / 'Save list' option in the list builder or at checkout.",
          "If 48HrPrint offers a CSV download of the routes you selected, save the file to your local machine.",
          "Upload that CSV at /admin/political/routes/import with source 'Vendor Export — 48HrPrint'.",
        ]}
        notes={
          <div className="space-y-1">
            <p>
              <strong>Hard rule:</strong> HomeReach will never log into 48HrPrint
              for you, scrape their checkout, or call private endpoints. If
              the export option isn't visible in their UI, the data isn't
              available to us — period.
            </p>
            <p>
              If 48HrPrint changes their UI to remove the export option,
              switch to the USPS EDDM tool above; the same routes are
              available there.
            </p>
          </div>
        }
      />

      <SourceCard
        rank="Vendor (manual)"
        title="Other vendors — Lob, Smarty, Melissa, …"
        sourceLabel="vendor_export_other"
        steps={[
          "Sign in to the vendor directly.",
          "Use their export / download feature to save a route CSV locally.",
          "Upload at /admin/political/routes/import with source 'Vendor Export — Other'.",
          "Add the vendor name to the file's 'notes' column or the import audit's notes field so the audit trail records who supplied it.",
        ]}
        notes={
          <p>
            Phase 3 of the Route Data Acquisition layer adds licensed direct
            integrations (paid API keys for Lob / Smarty / Melissa). Until
            those land, treat them all as manual CSV vendors.
          </p>
        }
      />

      <SourceCard
        rank="Last resort"
        title="Hand-prepared CSV"
        sourceLabel="manual_csv"
        steps={[
          "Build a CSV that matches the required columns: state, zip5, carrier_route_id, total_count.",
          "Source the data from a public record you have rights to use (e.g. a county-level public release).",
          "Document the source in the import notes field.",
          "Upload at /admin/political/routes/import with source 'Hand-prepared CSV'.",
        ]}
        notes={
          <p>
            Use this only when no upstream tool export is available. The
            import workflow rejects malformed rows row-by-row, so you'll see
            exactly which rows need fixing.
          </p>
        }
      />

      <FuturesCard />

      <ColumnReferenceCard />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/political/routes/import"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Open the importer
        </Link>
        <Link
          href="/admin/political/data-sources"
          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          See all registered sources
        </Link>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function DoDontBanner() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <h2 className="text-sm font-semibold text-emerald-900">DO</h2>
        <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-emerald-900">
          <li>Sign in to vendors yourself in your own browser.</li>
          <li>Use the vendor's own Download / Export feature.</li>
          <li>Save the resulting CSV to your local machine.</li>
          <li>Upload it through HomeReach's importer.</li>
          <li>Confirm the export is permitted under your account terms before uploading.</li>
        </ul>
      </div>
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
        <h2 className="text-sm font-semibold text-rose-900">DO NOT</h2>
        <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-rose-900">
          <li>Try to make HomeReach log in to a vendor on your behalf.</li>
          <li>Scrape vendor checkout pages or product detail pages.</li>
          <li>Bypass paywalls, captchas, or other access protections.</li>
          <li>Upload paid datasets you don't have a license for.</li>
          <li>Upload personal voter data (names, addresses, party registration).</li>
        </ul>
      </div>
    </div>
  );
}

function SourceCard(props: {
  rank: string;
  title: string;
  sourceLabel: string;
  url?: string;
  steps: readonly string[];
  notes?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="inline-flex rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {props.rank}
          </span>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{props.title}</h2>
          {props.url && (
            <a
              href={props.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-700 hover:underline"
            >
              {props.url}
            </a>
          )}
        </div>
        <code className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
          {props.sourceLabel}
        </code>
      </header>

      <ol className="ml-5 list-decimal space-y-1 text-sm text-slate-700">
        {props.steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>

      {props.notes && (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          {props.notes}
        </div>
      )}
    </section>
  );
}

function FuturesCard() {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="inline-flex rounded bg-amber-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Phase 3
        </span>
        <h2 className="text-lg font-semibold text-amber-900">Licensed direct integrations (future)</h2>
      </div>
      <p className="text-sm text-amber-900">
        These vendors expose paid APIs for address + carrier-route data. We
        will add direct integrations once we have signed agreements and
        budget approval. Until then, use their UI exports above.
      </p>
      <ul className="ml-4 list-disc text-sm text-amber-900">
        <li><strong>Melissa Data</strong> — address verification + carrier route lookup</li>
        <li><strong>Lob</strong> — full-service mailing API with EDDM endpoints</li>
        <li><strong>Smarty</strong> (formerly SmartyStreets) — US zip / carrier route reference</li>
      </ul>
    </section>
  );
}

function ColumnReferenceCard() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-2 text-sm">
      <h2 className="text-base font-semibold text-slate-900">Required columns</h2>
      <p className="text-slate-700">
        Whichever source you use, the CSV needs at least these columns. The
        importer accepts many common header aliases (see the import page for
        the full list).
      </p>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">Canonical name</th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">Type</th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">Common vendor headers</th>
          </tr>
        </thead>
        <tbody>
          <Row name="state" type="2-letter" aliases="state, USPS_State, ST" />
          <Row name="zip5" type="5 digits" aliases="ZIP, ZIP Code, Postal Code, Mailing ZIP" />
          <Row name="carrier_route_id" type="text" aliases="Carrier Route, Route, Route ID, CRID, Route Code" />
          <Row name="total_count" type="integer" aliases="Total, Total Deliveries, Households, Address Count" />
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        Optional columns: <code className="font-mono">zip4</code>,{" "}
        <code className="font-mono">route_type</code>,{" "}
        <code className="font-mono">residential_count</code>,{" "}
        <code className="font-mono">business_count</code>,{" "}
        <code className="font-mono">county</code>,{" "}
        <code className="font-mono">city</code>.
      </p>
    </section>
  );
}

function Row(props: { name: string; type: string; aliases: string }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="px-3 py-2 font-mono text-xs text-slate-900">{props.name}</td>
      <td className="px-3 py-2 text-xs text-slate-700">{props.type}</td>
      <td className="px-3 py-2 text-xs text-slate-700">{props.aliases}</td>
    </tr>
  );
}
