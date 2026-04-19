import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SalesDashboardClient from "./sales-dashboard-client";
import ContentIntelCards from "@/components/content-intel/ContentIntelCards";
import HighPriorityLeadsCard from "@/components/lead-intel/HighPriorityLeadsCard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sales Intelligence — HomeReach Admin" };

export default async function SalesDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin/sales-dashboard");
  return (
    <>
      {/* Additive: each renders null when its feature flag is off. */}
      <HighPriorityLeadsCard />
      <ContentIntelCards />
      <SalesDashboardClient />
    </>
  );
}
