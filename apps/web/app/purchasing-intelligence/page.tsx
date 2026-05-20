import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PURCHASING_INTELLIGENCE_PATH = "/operations-copilot/supplier-prices";

export default async function PurchasingIntelligenceRedirectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(
    user
      ? PURCHASING_INTELLIGENCE_PATH
      : `/login?redirect=${encodeURIComponent(PURCHASING_INTELLIGENCE_PATH)}`
  );
}
