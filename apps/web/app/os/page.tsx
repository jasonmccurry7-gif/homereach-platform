import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeReachOSShell } from "@/components/homereach-os/home-reach-os-shell";
import { getHomeReachOSData } from "@/lib/homereach-os/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HomeReach OS - Operator Control Center",
  description: "Unified operator control center for HomeReach",
};

export default async function OSPage() {
  const devBypass = process.env.ADMIN_DEV_BYPASS === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (devBypass && isProduction) {
    throw new Error("SECURITY VIOLATION: ADMIN_DEV_BYPASS=true in production.");
  }

  if (!devBypass) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login?redirect=/os");
    const role = user.app_metadata?.user_role as string | undefined;
    if (role !== "admin") redirect("/dashboard");
  }

  const data = await getHomeReachOSData();

  return <HomeReachOSShell data={data} mode="command" />;
}
