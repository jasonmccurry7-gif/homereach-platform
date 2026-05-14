import { redirect } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// /admin/political/data-sources/imports
//
// Forwards to the unified import-history page. The original spec called
// for a per-data-sources sub-route; instead of duplicating the table, we
// share the existing /admin/political/imports page since it already shows
// every import (including the FEC API ingestion runs that get audit rows).
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export default function DataSourcesImportsRedirect() {
  redirect("/admin/political/imports");
}
