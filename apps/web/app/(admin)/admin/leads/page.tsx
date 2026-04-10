import type { Metadata } from "next";
import { MOCK_LEADS } from "@/lib/admin/mock-data";
import { LeadsClient } from "./leads-client";

// TODO: Replace MOCK_LEADS with real DB query

export const metadata: Metadata = { title: "Leads — HomeReach Admin" };

export default async function AdminLeadsPage() {
  return <LeadsClient initialLeads={MOCK_LEADS} />;
}
