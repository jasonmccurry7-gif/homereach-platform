import type { Metadata } from "next";
import { HomeReachOSShell } from "@/components/homereach-os/home-reach-os-shell";
import { getHomeReachOSData } from "@/lib/homereach-os/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HomeReach OS - Command Center",
  description: "Unified operational intelligence command center for HomeReach",
};

export default async function AdminDashboardPage() {
  const data = await getHomeReachOSData();

  return <HomeReachOSShell data={data} mode="command" />;
}
