"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// /spots/[citySlug]/[categorySlug]
//
// Spot selection + contract acknowledgment page for the shared postcard product.
// Agent 6 — Shared Postcard Product
//
// Flow:
//   1. Checks spot availability via GET /api/spots/availability
//   2. Shows spot types with pricing
//   3. Shows 3-month commitment disclosure + checkbox
//   4. On confirm: POST /api/spots/checkout → redirect to Stripe
// ─────────────────────────────────────────────────────────────────────────────

type SpotType = "anchor" | "front_feature" | "back_feature" | "full_card";

interface SpotOption {
  type:       SpotType;
  label:      string;
  description: string;
  priceLabel: string;
  highlight?: boolean;
}

const SPOT_OPTIONS: SpotOption[] = [
  {
    type:        "front_feature",
    label:       "Front Feature",
    description: "Prominent placement on the front of every shared postcard. Maximum visibility.",
    priceLabel:  "Starting at $299/mo",
  },
  {
    type:        "anchor",
    label:       "Anchor Spot",
    description: "The featured anchor position — the most prominent spot on the mailer.",
    priceLabel:  "Starting at $399/mo",
    highlight:   true,
  },
  {
    type:        "back_feature",
    label:       "Back Feature",
    description: "Featured placement on the back panel. Strong secondary visibility.",
    priceLabel:  "Starting at $249/mo",
  },
  {
    type:        "full_card",
    label:       "Exclusive Full Card",
    description: "You own the entire mailer — no other businesses. Maximum saturation.",
    priceLabel:  "Starting at $699/mo",
  },
];

export default function SpotSelectionPage() {
  const params   = useParams<{ citySlug: string; categorySlug: string }>();
  const router   = useRouter();

  const [availability, setAvailability] = useState<{ available: boolean; message?: string } | null>(null);
  const [selectedType, setSelectedType] = useState<SpotType | null>(null);
  const [committed, setCommitted]       = useState(false);
  const [cityId, setCityId]             = useState<string | null>(null);
  const [categoryId, setCategoryId]     = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Derive commitment end date for display
  const commitmentEndDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // ── Resolve slugs to IDs + check availability ──────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        // Resolve city + category IDs from slugs
        const res = await fetch(
          `/api/spots/resolve?citySlug=${params.citySlug}&categorySlug=${params.categorySlug}`
        );
        const data = await res.json();

        if (!res.ok || !data.cityId || !data.categoryId) {
          setError("This market isn't available yet.");
          setLoading(false);
          return;
        }

        setCityId(data.cityId);
        setCategoryId(data.categoryId);

        // Check availability
        const availRes = await fetch(
          `/api/spots/availability?cityId=${data.cityId}&categoryId=${data.categoryId}`
        );
        const availData = await availRes.json();
        setAvailability(availData);
      } catch {
        setError("Something went wrong. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [params.citySlug, params.categorySlug]);

  // ── Handle checkout ────────────────────────────────────────────────────────
  async function handleClaim() {
    if (!selectedType || !committed || !cityId || !categoryId) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/spots/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityId,
          categoryId,
          spotType: selectedType,
          commitmentAcknowledged: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      // Redirect to Stripe checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 text-lg">Checking availability...</div>
      </div>
    );
  }

  if (error && !availability) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600 text-lg">{error}</div>
      </div>
    );
  }

  if (availability && !availability.available) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-6">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">This Spot is Taken</h1>
          <p className="text-gray-600 mb-6">
            Another business currently holds the exclusive spot for this market.
            Join the waitlist and we'll notify you the moment it becomes available.
          </p>
          <button
            onClick={() => router.push(`/waitlist?city=${params.citySlug}&category=${params.categorySlug}`)}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Join the Waitlist
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-block bg-green-100 text-green-800 text-sm font-semibold px-4 py-1 rounded-full mb-4">
            ✓ Spot Available
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Claim Your Exclusive Spot in{" "}
            <span className="capitalize">{params.citySlug.replace(/-/g, " ")}</span>
          </h1>
          <p className="text-gray-600 text-lg">
            <span className="capitalize">{params.categorySlug.replace(/-/g, " ")}</span>
            {" · "}One business per market. Once it's gone, it's gone.
          </p>
        </div>

        {/* Spot type selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {SPOT_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => setSelectedType(opt.type)}
              className={`relative text-left p-6 rounded-xl border-2 transition-all ${
                selectedType === opt.type
                  ? "border-blue-600 bg-blue-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-blue-300"
              } ${opt.highlight ? "ring-2 ring-blue-200" : ""}`}
            >
              {opt.highlight && (
                <span className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  MOST POPULAR
                </span>
              )}
              <div className="font-bold text-gray-900 text-lg mb-1">{opt.label}</div>
              <div className="text-gray-600 text-sm mb-3">{opt.description}</div>
              <div className="text-blue-700 font-semibold">{opt.priceLabel}</div>
              {selectedType === opt.type && (
                <div className="absolute top-3 left-3 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* 3-month commitment disclosure */}
        {selectedType && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
            <h3 className="font-bold text-amber-900 text-lg mb-3">
              📋 3-Month Minimum Commitment
            </h3>
            <p className="text-amber-800 text-sm mb-4 leading-relaxed">
              HomeReach spots require a minimum 3-month commitment. Postcards are printed and mailed
              monthly — campaigns need time to generate results. Your first cancellation date would be{" "}
              <strong>{commitmentEndDate}</strong>. After that, you can cancel any time.
            </p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={committed}
                onChange={(e) => setCommitted(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-amber-400 text-blue-600 flex-shrink-0"
              />
              <span className="text-amber-900 text-sm font-medium">
                I understand and agree to the 3-month minimum commitment. My first cancellation date is{" "}
                <strong>{commitmentEndDate}</strong>.
              </span>
            </label>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4 text-sm">
            {error}
          </div>
        )}

        {/* CTA button */}
        <button
          onClick={handleClaim}
          disabled={!selectedType || !committed || submitting}
          className={`w-full py-4 px-8 rounded-xl text-white font-bold text-lg transition-all ${
            selectedType && committed && !submitting
              ? "bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl"
              : "bg-gray-300 cursor-not-allowed"
          }`}
        >
          {submitting ? "Redirecting to checkout..." : "Claim My Spot →"}
        </button>

        <p className="text-center text-gray-500 text-sm mt-4">
          Secure checkout · Powered by Stripe · Cancel anytime after {commitmentEndDate}
        </p>
      </div>
    </div>
  );
}
