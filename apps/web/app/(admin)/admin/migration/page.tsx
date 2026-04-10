import type { Metadata } from "next";
import { MigrationClient } from "./migration-client";

export const metadata: Metadata = { title: "Client Migration — HomeReach Admin" };

// Migration page — loads real clients from DB via API route.
// MOCK_MIGRATED_CLIENTS removed — data is persisted to the businesses table.
export default function MigrationPage() {
  // Pass empty initial array — MigrationClient fetches real data on mount.
  return <MigrationClient initialClients={[]} />;
}
