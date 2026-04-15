"use client";

import { useState } from "react";
import { AlertCircle, ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

interface IntelligenceCheckoutClientProps {
  tier: string;
  city: string;
  category: string;
  market_size: string;
  tier_name: string;
  standard_price_cents: number;
  founding_price_cents: number;
}

export function IntelligenceCheckoutClient({
  tier,
  city,
  category,
  market_size,
  tier_name,
  standard_price_cents,
  founding_price_cents,
}: IntelligenceCheckoutClientProps) {
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const savings = standardPrice - foundingPrice;
  const savingsPercentage = Math.round((savings / standardPrice) * 100);
  const standardPrice = standard_price_cents / 100;
  const foundingPrice = founding_price_cents / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!businessName.trim() || !email.trim() || !phone.trim()) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/intelligence/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          city,
          category,
          market_size,
          businessName,
          email,
          phone,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Checkout failed");
      }

      const { checkoutUrl } = await response.json();
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <Link
          href="/intelligence"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Intelligence Pricing
        </Link>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-8 py-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Summary</h1>
            <p className="text-gray-600 mb-8">
              Complete your Property Intelligence purchase with founding member pricing
            </p>

            {/* Order Details */}
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-sm font-medium text-gray-600">Plan</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{tier_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Market</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {city} {category !== "all" ? `• ${category}` : ""}
                  </p>
                </div>
              </div>

              {/* Pricing */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-baseline justify-between mb-4">
                  <span className="text-gray-600">Standard Price</span>
                  <span className="text-lg text-gray-400 line-through">
                    ${standardPrice.toFixed(2)}/mo
                  </span>
                </div>
                <div className="flex items-baseline justify-between mb-6">
                  <span className="text-lg font-semibold text-gray-900">Founding Member Price</span>
                  <span className="text-3xl font-bold text-blue-600">
                    ${foundingPrice.toFixed(2)}/mo
                  </span>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-green-900">Founding Member Rate Locked In for Life</p>
                    <p className="text-sm text-green-800 mt-1">
                      You save <span className="font-bold">${savings.toFixed(2)}/month</span>{" "}
                      ({savingsPercentage}% off) forever
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Billing Info Form */}
            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Billing Information</h2>

              {error && (
                <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Enter your business name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter your phone number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  {loading ? "Processing..." : `Continue to Payment — $${foundingPrice.toFixed(2)}/mo`}
                </button>
              </form>
            </div>

            {/* Footer notes */}
            <div className="border-t border-gray-200 mt-8 pt-8">
              <p className="text-xs text-gray-500 text-center">
                Your founding member rate is locked in for life, regardless of future price changes.
                All transactions are secure and encrypted.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
