import { Metadata } from "next";
import { IntelligenceCheckoutClient } from "./intelligence-checkout-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intelligence Checkout | HomeReach",
  description: "Complete your Property Intelligence order with founding member pricing.",
};

interface IntelligenceCheckoutPageProps {
  searchParams: Promise<{
    tier?: string;
    city?: string;
    category?: string;
    market_size?: string;
    tier_name?: string;
    standard_price_cents?: string;
    founding_price_cents?: string;
  }>;
}

export default async function IntelligenceCheckoutPage({
  searchParams,
}: IntelligenceCheckoutPageProps) {
  const params = await searchParams;

  const {
    tier = "t1",
    city = "",
    category = "all",
    market_size = "",
    tier_name = "Tier 1",
    standard_price_cents = "9999",
    founding_price_cents = "6999",
  } = params;

  return (
    <IntelligenceCheckoutClient
      tier={tier}
      city={city}
      category={category}
      market_size={market_size}
      tier_name={tier_name}
      standard_price_cents={parseInt(standard_price_cents, 10)}
      founding_price_cents={parseInt(founding_price_cents, 10)}
    />
  );
}
