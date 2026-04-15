"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronDown, Check, AlertCircle } from "lucide-react";

interface PropertyIntelligenceTier {
  id: string;
  category: string;
  tier: string;
  tier_name: string;
  standard_price_cents: number;
  founding_price_cents: number;
  leads_per_month: number | null;
  market_size: string | null;
  description: string | null;
  features: string[];
  is_active: boolean;
  created_at: string;
}

interface FoundingSlot {
  id: string;
  city: string;
  category: string | null;
  product: string;
  tier: string;
  total_slots: number;
  slots_taken: number;
  slots_remaining: number;
  founding_open: boolean;
  standard_price_cents: number;
  founding_price_cents: number;
  created_at: string;
  updated_at: string;
}

interface IntelligenceClientProps {
  tiers: PropertyIntelligenceTier[];
  slots: FoundingSlot[];
}

// Default cities and categories
const CITIES = [
  "Austin, TX",
  "Denver, CO",
  "Phoenix, AZ",
  "Portland, OR",
  "Tampa, FL",
  "Charlotte, NC",
];

const CATEGORIES = [
  "all",
  "Junk Removal",
  "Pressure Washing",
  "Concrete & Masonry",
  "Roofing",
  "HVAC",
  "Plumbing",
  "Landscaping",
  "Home Remodeling",
  "Electrical",
  "Painting",
];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function PriceCard({
  tier,
  tierName,
  standardPrice,
  foundingPrice,
  isSoldOut,
  slotsRemaining,
  features,
  tier_number,
  city,
  category,
}: {
  tier: string;
  tierName: string;
  standardPrice: number;
  foundingPrice: number;
  isSoldOut: boolean;
  slotsRemaining: number;
  features: string[];
  tier_number: "t1" | "t2" | "t3";
  city: string;
  category: string;
}) {
  const savings = standardPrice - foundingPrice;
  const savingsPercentage = Math.round((savings / standardPrice) * 100);

  let borderColor = "border-gray-300";
  let badge = null;

  if (tier_number === "t1") {
    borderColor = "border-gray-300";
  } else if (tier_number === "t2") {
    borderColor = "border-blue-300";
    badge = (
      <div className="absolute -top-3 left-4 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
        Most Popular
      </div>
    );
  } else if (tier_number === "t3") {
    borderColor = "border-amber-300";
    badge = (
      <div className="absolute -top-3 left-4 bg-amber-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
        Best Value
      </div>
    );
  }

  return (
    <div className={`relative border-2 ${borderColor} rounded-lg p-6 bg-white flex flex-col h-full`}>
      {badge}

      <h3 className="text-lg font-semibold text-gray-900 mt-2">{tierName}</h3>

      {/* Pricing */}
      <div className="mt-6 mb-6">
        {isSoldOut ? (
          <div>
            <div className="text-3xl font-bold text-gray-900">
              {formatPrice(standardPrice)}
            </div>
            <div className="text-sm text-gray-500 mt-1">Standard pricing applies</div>
          </div>
        ) : (
          <div>
            <div className="text-sm text-gray-500 line-through">
              {formatPrice(standardPrice)}
            </div>
            <div className="text-4xl font-bold text-blue-600 mt-2">
              {formatPrice(foundingPrice)}
            </div>
            <div className="mt-2 inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">
              Founding Member Rate
            </div>
            <div className="text-sm text-gray-600 mt-3">
              You save{" "}
              <span className="font-semibold">
                {formatPrice(savings)}/mo
              </span>{" "}
              as a Founding Member
            </div>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="mb-6 space-y-3 flex-grow">
        {features && features.length > 0 ? (
          features.map((feature, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-700">{feature}</span>
            </div>
          ))
        ) : (
          <div className="flex items-start gap-3">
            <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-gray-700">
              {tier === "t1"
                ? "One-time lead pack"
                : tier === "t2"
                  ? "Monthly subscription with leads"
                  : "Exclusive market access"}
            </span>
          </div>
        )}
      </div>

      {/* Scarcity */}
      <div className="mb-6">
        {isSoldOut ? (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded">
            <AlertCircle className="h-4 w-4" />
            <span>Founding slots full — standard pricing applies</span>
          </div>
        ) : (
          <div className="text-sm text-gray-600 font-medium">
            <span className="text-blue-600">{slotsRemaining} slots remaining</span>
          </div>
        )}
      </div>

      {/* CTA */}
      <Link
        href={`/intelligence/checkout?tier=${tier_number}&city=${encodeURIComponent(city)}&category=${encodeURIComponent(category)}`}
        className={`w-full py-3 px-4 rounded-lg font-semibold text-center transition-colors ${
          isSoldOut
            ? "bg-gray-200 text-gray-600 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
        }`}
      >
        {isSoldOut ? "Sold Out" : "Claim Founding Rate"}
      </Link>
    </div>
  );
}

export function IntelligenceClient({ tiers, slots }: IntelligenceClientProps) {
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Group tiers by tier number (t1, t2, t3)
  const tiersByNumber = useMemo(() => {
    const t1 = tiers.filter((t) => t.tier === "t1")[0];
    const t2Tiers = tiers.filter((t) => t.tier === "t2");
    const t3 = tiers.filter((t) => t.tier === "t3")[0];

    return { t1, t2Tiers, t3 };
  }, [tiers]);

  // Get the appropriate tier 2 based on category
  const selectedT2 = useMemo(() => {
    const categoryT2 = tiersByNumber.t2Tiers.find(
      (t) => t.category === selectedCategory
    );
    return categoryT2 || tiersByNumber.t2Tiers.find((t) => t.category === "all");
  }, [tiersByNumber.t2Tiers, selectedCategory]);

  // Get slot availability
  const getSlotInfo = (tier: string) => {
    const slot = slots.find(
      (s) =>
        s.city === selectedCity &&
        (s.category === selectedCategory || s.category === null) &&
        s.tier === tier
    );

    if (!slot) {
      return { slotsRemaining: 0, foundingOpen: false };
    }

    return {
      slotsRemaining: slot.slots_remaining,
      foundingOpen: slot.founding_open,
    };
  };

  const t1Info = getSlotInfo("t1");
  const t2Info = getSlotInfo("t2");
  const t3Info = getSlotInfo("t3");

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-12 px-4">
      <div className="mx-auto max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Property Intelligence Leads
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            We identify homeowners who need your service before they search. Be first.
          </p>
        </div>

        {/* Founding Banner */}
        <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-sm font-semibold text-blue-900">
            🏷️ Founding Member Pricing Active — Lock in your rate before slots fill.
          </p>
        </div>

        {/* Selectors */}
        <div className="mb-12 flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
          {/* City Selector */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City
            </label>
            <div className="relative">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 appearance-none cursor-pointer"
              >
                {CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Category Selector */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 appearance-none cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "all" ? "All Categories" : cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Tier 1 */}
          {tiersByNumber.t1 && (
            <PriceCard
              tier="t1"
              tierName={tiersByNumber.t1.tier_name}
              standardPrice={tiersByNumber.t1.standard_price_cents}
              foundingPrice={tiersByNumber.t1.founding_price_cents}
              isSoldOut={!t1Info.foundingOpen || t1Info.slotsRemaining === 0}
              slotsRemaining={t1Info.slotsRemaining}
              features={Array.isArray(tiersByNumber.t1.features) ? tiersByNumber.t1.features : []}
              tier_number="t1"
              city={selectedCity}
              category={selectedCategory}
            />
          )}

          {/* Tier 2 */}
          {selectedT2 && (
            <PriceCard
              tier="t2"
              tierName={selectedT2.tier_name}
              standardPrice={selectedT2.standard_price_cents}
              foundingPrice={selectedT2.founding_price_cents}
              isSoldOut={!t2Info.foundingOpen || t2Info.slotsRemaining === 0}
              slotsRemaining={t2Info.slotsRemaining}
              features={Array.isArray(selectedT2.features) ? selectedT2.features : []}
              tier_number="t2"
              city={selectedCity}
              category={selectedCategory}
            />
          )}

          {/* Tier 3 */}
          {tiersByNumber.t3 && (
            <PriceCard
              tier="t3"
              tierName={tiersByNumber.t3.tier_name}
              standardPrice={tiersByNumber.t3.standard_price_cents}
              foundingPrice={tiersByNumber.t3.founding_price_cents}
              isSoldOut={!t3Info.foundingOpen || t3Info.slotsRemaining === 0}
              slotsRemaining={t3Info.slotsRemaining}
              features={Array.isArray(tiersByNumber.t3.features) ? tiersByNumber.t3.features : []}
              tier_number="t3"
              city={selectedCity}
              category={selectedCategory}
            />
          )}
        </div>

        {/* FAQ or additional info */}
        <div className="max-w-2xl mx-auto text-center text-gray-600 text-sm">
          <p>
            Questions about which tier is right for you?{" "}
            <a href="mailto:hello@home-reach.com" className="text-blue-600 hover:underline">
              Contact our team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
