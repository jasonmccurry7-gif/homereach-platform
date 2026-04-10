// ─────────────────────────────────────────────────────────────────────────────
// Sales Engine Dashboard — Server Component
// ─────────────────────────────────────────────────────────────────────────────

import { MOCK_SALES_LEADS, MOCK_HOT_ALERTS, computeSalesStats } from "@/lib/sales-engine/mock-sales-data";
import { classifyAll }  from "@/lib/sales-engine/classifier";
import { SalesEngineClient } from "./sales-engine-client";

export const metadata = {
  title: "Sales Engine | HomeReach",
};

export default function SalesEnginePage() {
  const leads  = classifyAll(MOCK_SALES_LEADS);
  const stats  = computeSalesStats(leads);
  const alerts = MOCK_HOT_ALERTS;

  return <SalesEngineClient leads={leads} stats={stats} alerts={alerts} />;
}
