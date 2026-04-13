import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SalesDashboardClient from "./sales-dashboard-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sales Intelligence — HomeReach Admin" };

export default async function SalesDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin/sales-dashboard");
  return <SalesDashboardClient />;
}
