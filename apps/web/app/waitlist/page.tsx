import type { Metadata } from "next";
import { WaitlistForm } from "./waitlist-form";
import { db, cities } from "@homereach/db";
import { orderBy } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Join the Waitlist — HomeReach",
  description: "Be the first to know when HomeReach launches in your city.",
};

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const { city: preselectedCitySlug } = await searchParams;

  const allCities = await db
    .select({ id: cities.id, name: cities.name, slug: cities.slug, isActive: cities.isActive })
    .from(cities);

  const comingSoonCities = allCities.filter((c) => !c.isActive);
  const preselected = allCities.find((c) => c.slug === preselectedCitySlug) ?? null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 text-4xl">📬</div>
          <h1 className="text-3xl font-bold text-gray-900">Join the waitlist</h1>
          <p className="mt-2 text-gray-500">
            We&apos;re expanding fast. Get notified the moment spots open in your city.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <WaitlistForm
            cities={comingSoonCities}
            preselectedCityId={preselected?.id ?? null}
          />
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">
          No spam. We&apos;ll only contact you when your city is ready.
        </p>
      </div>
    </div>
  );
}
