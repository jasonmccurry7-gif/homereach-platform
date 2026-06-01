import type { Metadata } from "next";
import { MarketCaptureCheckoutClient } from "./market-capture-checkout-client";

export const metadata: Metadata = {
  title: "Market Capture Payment Review | HomeReach",
  description: "Review the Market Capture management fee and create the payment path.",
};

export default function MarketCaptureCheckoutPage() {
  return <MarketCaptureCheckoutClient />;
}
