"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /nonprofit — Public Nonprofit Registration Page
//
// Nonprofits register here to be listed for business sponsorship.
// On submission: admin is notified, nonprofit is queued for review.
// Supports URL pre-population from targeted intake redirect:
//   ?orgName=...&contactName=...&email=...&phone=...&city=...
// ─────────────────────────────────────────────────────────────────────────────

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function NonprofitForm() {
  const searchParams = useSearchParams();

  const [form, setForm] = useState({
    orgName:     searchParams.get("orgName")     ?? "",
    ein:         "",
    contactName: searchParams.get("contactName") ?? "",
    email:       searchParams.get("email")       ?? "",
    phone:       searchParams.get("phone")       ?? "",
    website:     "",
    mission:     "",
    city:        searchParams.get("city")        ?? "",
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function update(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    try {
      const res = await fetch("/api/nonprofit", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-green-200 bg-white p-10 text-center shadow-sm">
          <div className="text-5xl mb-4">🤝</div>
          <h1 className="text-2xl font-bold text-gray-900">Application Received!</h1>
          <p className="mt-3 text-gray-500">
            We'll review your nonprofit and reach out within 2 business days. Once approved, local
            businesses will be able to sponsor your cause.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
          >
            Back to HomeReach →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-14">
      <div className="mx-auto max-w-lg">

        {/* Header */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-xs">
              HR
            </div>
            <span className="font-bold text-gray-900">HomeReach</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Register Your Nonprofit
          </h1>
          <p className="mt-2 text-gray-500">
            Local businesses using HomeReach can choose to co-sponsor your cause.
            Get free visibility in every mailer drop.
          </p>
        </div>

        {/* How it works */}
        <div className="mb-6 grid grid-cols-3 gap-3 text-center">
          {[
            { icon: "📋", label: "Apply", desc: "Submit your nonprofit details" },
            { icon: "✅", label: "Verified", desc: "We confirm your 501(c)(3) status" },
            { icon: "📬", label: "Featured", desc: "Businesses sponsor your cause" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-xl mb-1">{s.icon}</div>
              <p className="text-xs font-semibold text-gray-700">{s.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Organization */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-3">
                Your Organization
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Organization name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.orgName}
                    onChange={(e) => update("orgName", e.target.value)}
                    placeholder="Sunshine Animal Rescue"
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      EIN <span className="text-xs text-gray-400">(XX-XXXXXXX)</span>
                    </label>
                    <input
                      type="text"
                      value={form.ein}
                      onChange={(e) => update("ein", e.target.value)}
                      placeholder="12-3456789"
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">City</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => update("city", e.target.value)}
                      placeholder="Austin, TX"
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Mission / What you do
                  </label>
                  <textarea
                    rows={2}
                    value={form.mission}
                    onChange={(e) => update("mission", e.target.value)}
                    placeholder="We rescue and rehome animals in Travis County..."
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Website <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => update("website", e.target.value)}
                    placeholder="https://sunshineanimalrescue.org"
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Contact */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-3">
                Contact Person
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Your name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.contactName}
                    onChange={(e) => update("contactName", e.target.value)}
                    placeholder="Sarah Johnson"
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="sarah@nonprofit.org"
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Phone <span className="text-xs text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      placeholder="(512) 555-0100"
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                status === "submitting" ||
                !form.orgName.trim() ||
                !form.contactName.trim() ||
                !form.email.trim()
              }
              className="w-full rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "submitting" ? "Submitting…" : "Submit Nonprofit Application →"}
            </button>

            <p className="text-center text-xs text-gray-400">
              We&apos;ll verify your 501(c)(3) status before listing you. Free to register.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Wrap in Suspense for useSearchParams ──────────────────────────────────────

export default function NonprofitPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <NonprofitForm />
    </Suspense>
  );
}
