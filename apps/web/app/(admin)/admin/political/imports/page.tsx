import { createServiceClient } from "@/lib/supabase/service";
import { listImports } from "@/lib/political/imports/pipeline";
import { ImportLogTable } from "./_components/ImportLogTable";
import type { ImportKind } from "@/lib/political/imports/types";

// ─────────────────────────────────────────────────────────────────────────────
// /admin/political/imports
//
// Audit log of every CSV import attempt. Operators can roll back any
// committed batch from here. Routes-only or organizations-only filter via
// ?kind=routes / ?kind=organizations.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const metadata = { title: "Import History · Political · HomeReach" };

interface SearchParams {
  kind?: string;
  highlight?: string;
}

export default async function PoliticalImportsPage(
  props: { searchParams: Promise<SearchParams> }
) {
  const params = await props.searchParams;
  const kindParam = params.kind === "routes" || params.kind === "organizations"
    ? (params.kind as ImportKind)
    : undefined;
  const highlight = params.highlight ?? null;

  const supabase = createServiceClient();
  const rows = await listImports({ supabase, kind: kindParam, limit: 200 });

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Import history
          </h1>
          <p className="text-sm text-slate-600">
            Every CSV upload, with provenance, row counts, and a one-click
            rollback. Rollback is blocked for organization batches whose rows
            are already referenced by real campaigns.
          </p>
        </div>
        <KindFilter active={kindParam} />
      </header>

      <ImportLogTable rows={rows} highlight={highlight} />
    </section>
  );
}

function KindFilter(props: { active?: ImportKind }) {
  const buttons: { label: string; href: string; active: boolean }[] = [
    { label: "All",           href: "/admin/political/imports",                     active: !props.active },
    { label: "Routes",        href: "/admin/political/imports?kind=routes",         active: props.active === "routes" },
    { label: "Organizations", href: "/admin/political/imports?kind=organizations",  active: props.active === "organizations" },
  ];
  return (
    <nav className="flex items-center gap-1 rounded border border-slate-200 bg-white p-1">
      {buttons.map((b) => (
        <a
          key={b.href}
          href={b.href}
          className={
            b.active
              ? "rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
              : "rounded px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          }
        >
          {b.label}
        </a>
      ))}
    </nav>
  );
}
