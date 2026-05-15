import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const INVENTORY_DASHBOARD_PATH = "/dashboard?product=inventory-purchasing";

export default async function InventoryPurchasingDashboardRedirectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(
    user
      ? INVENTORY_DASHBOARD_PATH
      : `/login?redirect=${encodeURIComponent(INVENTORY_DASHBOARD_PATH)}`
  );
}
