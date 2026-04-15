import { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import { IntelligenceClient } from "./intelligence-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Property Intelligence Leads | HomeReach",
  description:
    "Identify homeowners who need your service before they search. Get Property Intelligence leads with founding member pricing.",
};

export default async function IntelligencePage() {
  const supabase = createServiceClient();

  // Fetch all active property intelligence tiers
  const { data: tiers, error: tiersError } = await supabase
    .from("property_intelligence_tiers")
    .select("*")
    .eq("is_active", true)
    .order("tier", { ascending: true })
    .order("category", { ascending: true });

  // Fetch all founding slots for availability info
  const { data: slots, error: slotsError } = await supabase
    .from("founding_slots")
    .select("*")
    .eq("product", "intelligence_t1")
    .then(async (result1) => {
      const { data: data2 } = await supabase
        .from("founding_slots")
        .select("*")
        .eq("product", "intelligence_t2");
      const { data: data3 } = await supabase
        .from("founding_slots")
        .select("*")
        .eq("product", "intelligence_t3");

      return {
        ...result1,
        data: [...(result1.data || []), ...(data2 || []), ...(data3 || [])],
      };
    });

  if (tiersError) {
    console.error("Error fetching tiers:", tiersError);
    throw tiersError;
  }

  return (
    <IntelligenceClient
      tiers={tiers || []}
      slots={slots || []}
    />
  );
}
