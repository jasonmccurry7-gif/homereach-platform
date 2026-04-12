import { notFound } from "next/navigation";
import { db, intakeSubmissions, spotAssignments, businesses, cities, categories } from "@homereach/db";
import { eq } from "drizzle-orm";
import { IntakeForm } from "./intake-form";
import type { Metadata } from "next";

// ─────────────────────────────────────────────────────────────────────────────
// /intake/[token]
//
// Public intake form — no login required.
// URL contains only the access_token UUID, never internal IDs.
//
// Agent 1 — Revenue Activation
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Complete Your Campaign Setup — HomeReach" };

interface Props {
  params: Promise<{ token: string }>;
}

export default async function IntakePage({ params }: Props) {
  const { token } = await params;

  // Look up intake submission by access token
  const [record] = await db
    .select({
      id:               intakeSubmissions.id,
      status:           intakeSubmissions.status,
      accessToken:      intakeSubmissions.accessToken,
      businessId:       intakeSubmissions.businessId,
      spotAssignmentId: intakeSubmissions.spotAssignmentId,
      submittedAt:      intakeSubmissions.submittedAt,
    })
    .from(intakeSubmissions)
    .where(eq(intakeSubmissions.accessToken, token))
    .limit(1);

  if (!record) {
    notFound();
  }

  // Fetch business info for personalization
  const [business] = await db
    .select({ name: businesses.name, email: businesses.email })
    .from(businesses)
    .where(eq(businesses.id, record.businessId))
    .limit(1);

  // Fetch spot + city + category context
  const [spot] = await db
    .select({
      spotType:     spotAssignments.spotType,
      cityId:       spotAssignments.cityId,
      categoryId:   spotAssignments.categoryId,
    })
    .from(spotAssignments)
    .where(eq(spotAssignments.id, record.spotAssignmentId))
    .limit(1);

  let cityName     = "";
  let categoryName = "";

  if (spot?.cityId) {
    const [city] = await db
      .select({ name: cities.name })
      .from(cities)
      .where(eq(cities.id, spot.cityId))
      .limit(1);
    cityName = city?.name ?? "";
  }

  if (spot?.categoryId) {
    const [cat] = await db
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.id, spot.categoryId))
      .limit(1);
    categoryName = cat?.name ?? "";
  }

  // Already submitted — show confirmation
  if (record.status === "submitted" || record.status === "reviewed") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-6">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">You're all set!</h1>
          <p className="text-gray-600">
            We've received your campaign details. Our team will review them and be in touch
            within 1–2 business days with your postcard design for approval.
          </p>
          <p className="text-gray-500 text-sm mt-4">
            Questions? Email us at{" "}
            <a href="mailto:hello@home-reach.com" className="text-blue-600 underline">
              hello@home-reach.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to HomeReach{business?.name ? `, ${business.name}!` : "!"}
          </h1>
          <p className="text-gray-600">
            Your spot is confirmed
            {cityName && categoryName ? ` — ${categoryName} in ${cityName}` : ""}.
            Complete this 5-minute form so we can build your campaign.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-3">
          <div className="flex items-center gap-2 text-green-700">
            <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <span className="text-sm font-medium">Payment confirmed</span>
          </div>
          <div className="flex-1 h-1 bg-gray-200 rounded" />
          <div className="flex items-center gap-2 text-blue-700">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">2</div>
            <span className="text-sm font-medium font-semibold">Campaign setup</span>
          </div>
          <div className="flex-1 h-1 bg-gray-200 rounded" />
          <div className="flex items-center gap-2 text-gray-400">
            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-xs font-bold">3</div>
            <span className="text-sm">Design & launch</span>
          </div>
        </div>

        {/* Intake form */}
        <IntakeForm token={token} intakeId={record.id} />
      </div>
    </div>
  );
}
