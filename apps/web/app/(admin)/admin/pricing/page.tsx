import { createServiceClient } from "@/lib/supabase/service";
import PricingClient from "./pricing-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing — HomeReach Admin" };

export default async function PricingPage() {
  const db = createServiceClient();
  const [{ data: bundles }, { data: cities }] = await Promise.all([
    db.from("bundles").select("id, name, slug, standard_price, founding_price, price").in("slug", ["anchor-spot", "front-feature", "back-feature"]).order("metadata->>'sortOrder'"),
    db.from("cities").select("id, name, state, founding_eligible, is_active").eq("is_active", true).order("name"),
  ]);
  return <PricingClient bundles={bundles ?? []} cities={cities ?? []} />;
}
