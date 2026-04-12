"use client";

import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// IntakeForm — client component for /intake/[token]
// Submits to POST /api/intake/[token]
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  token:    string;
  intakeId: string;
}

export function IntakeForm({ token }: Props) {
  const [formData, setFormData] = useState({
    serviceArea:      "",
    targetCustomer:   "",
    keyOffer:         "",
    differentiators:  "",
    additionalNotes:  "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [submitted, setSubmitted]   = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/intake/${token}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="text-5xl mb-4">🚀</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Got it! We're on it.</h2>
        <p className="text-gray-600">
          Our team will review your information and reach out within 1–2 business days
          with your postcard design. Keep an eye on your inbox.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">

      {/* Service Area */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-1">
          Where do you serve customers? *
          <span className="font-normal text-gray-500 ml-1">
            (neighborhoods, zip codes, or general area)
          </span>
        </label>
        <input
          type="text"
          name="serviceArea"
          value={formData.serviceArea}
          onChange={handleChange}
          required
          placeholder="e.g. North Denver, 80203, 80204, and surrounding areas"
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Target Customer */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-1">
          Who is your ideal customer? *
          <span className="font-normal text-gray-500 ml-1">
            (homeowners, families, new residents, etc.)
          </span>
        </label>
        <input
          type="text"
          name="targetCustomer"
          value={formData.targetCustomer}
          onChange={handleChange}
          required
          placeholder="e.g. Homeowners aged 35–65 with homes built before 2000"
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Key Offer */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-1">
          What's your main offer or promotion? *
          <span className="font-normal text-gray-500 ml-1">
            (discount, free estimate, seasonal deal, etc.)
          </span>
        </label>
        <input
          type="text"
          name="keyOffer"
          value={formData.keyOffer}
          onChange={handleChange}
          required
          placeholder="e.g. Free plumbing inspection + 10% off first repair"
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Differentiators */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-1">
          Why should people choose you over competitors? *
          <span className="font-normal text-gray-500 ml-1">
            (years in business, guarantees, specialties, reviews, etc.)
          </span>
        </label>
        <textarea
          name="differentiators"
          value={formData.differentiators}
          onChange={handleChange}
          required
          rows={3}
          placeholder="e.g. Family-owned since 1998, 500+ 5-star reviews, same-day service, 1-year labor guarantee"
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Additional Notes */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-1">
          Anything else we should know?
          <span className="font-normal text-gray-500 ml-1">(optional)</span>
        </label>
        <textarea
          name="additionalNotes"
          value={formData.additionalNotes}
          onChange={handleChange}
          rows={2}
          placeholder="e.g. Please emphasize our emergency service — it's our biggest differentiator."
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className={`w-full py-4 px-8 rounded-xl text-white font-bold text-lg transition-all ${
          submitting
            ? "bg-gray-300 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 shadow-lg"
        }`}
      >
        {submitting ? "Submitting..." : "Submit My Campaign Details →"}
      </button>

      <p className="text-center text-gray-400 text-xs">
        This information is used only to build your HomeReach campaign.
      </p>
    </form>
  );
}
