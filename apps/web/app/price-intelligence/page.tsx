import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PRICING_INTELLIGENCE_PATH = "/operations-copilot/supplier-prices";

export default async function PriceIntelligenceRedirectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(
    user
      ? PRICING_INTELLIGENCE_PATH
      : `/login?redirect=${encodeURIComponent(PRICING_INTELLIGENCE_PATH)}`
  );
}
