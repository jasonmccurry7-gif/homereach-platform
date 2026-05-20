import type { Metadata } from "next";
import { HomeReachOSShell } from "@/components/homereach-os/home-reach-os-shell";
import { getHomeReachOSData } from "@/lib/homereach-os/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HomeReach OS - Sales Intelligence",
  description: "Sales intelligence, pipeline, communications, and AI-assisted workflow dashboard",
};

export default async function SalesDashboardPage() {
  const data = await getHomeReachOSData();

  return <HomeReachOSShell data={data} mode="sales" />;
}
