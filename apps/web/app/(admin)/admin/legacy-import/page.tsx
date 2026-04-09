// ─────────────────────────────────────────────────────────────────────────────
// Legacy Import Dashboard — Server Component
// ─────────────────────────────────────────────────────────────────────────────

import { runImport }           from "@/lib/legacy-import/importer";
import { MOCK_LEGACY_EXPORT }  from "@/lib/legacy-import/mock-legacy-data";
import { LegacyImportClient }  from "./legacy-import-client";

export const metadata = {
  title: "Legacy Import | HomeReach",
};

export default function LegacyImportPage() {
  // Run the full import pipeline at render time (server-side, no DB yet)
  const state = runImport(MOCK_LEGACY_EXPORT, []);

  return <LegacyImportClient initialState={state} />;
}
