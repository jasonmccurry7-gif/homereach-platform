import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCityBySlug, getCategoryBySlug, getBundleById } from "@/lib/funnel/queries";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = {
  title: "Confirm Your Spot — HomeReach",
};

interface Props {
  params: Promise<{ citySlug: string; categorySlug: string }>;
  searchParams: Promise<{ bundle?: string }>;
}

export default async function CheckoutReviewPage({ params, searchParams }: Props) {
  const { citySlug, categorySlug } = await params;
  const { bundle: bundleId } = await searchParams;

  if (!bundleId) redirect(`/get-started/${citySlug}/${categorySlug}`);

  const [city, category, bundle] = await Promise.all([
    getCityBySlug(citySlug),
    getCategoryBySlug(categorySlug),
    getBundleById(bundleId),
  ]);

  if (!city || !category || !bundle) notFound();

  // Check auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const meta = (bundle.metadata ?? {}) as Record<string, unknown>;
  const features = (meta.features as string[]) ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <div className="pt-8 pb-6 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-blue-600">
          Step 4 of 4
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
          Confirm your spot
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Order summary — right rail on desktop, top on mobile */}
        <div className="order-1 lg:order-2 lg:col-span-2">
          <div className="sticky top-20 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-bold text-gray-900">Order summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">City</span>
                <span className="font-medium text-gray-900">{city.name}, {city.state}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Category</span>
                <span className="font-medium text-gray-900">{category.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Package</span>
                <span className="font-medium text-gray-900">{bundle.name}</span>
              </div>
            </div>

            <div className="my-4 border-t border-gray-100" />

            {/* Features */}
            <ul className="space-y-1.5 mb-4">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                  <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-gray-900">
                  ${Number(bundle.price).toLocaleString()}
                </span>
              </div>
              <p className="mt-0.5 text-right text-xs text-gray-400">One-time payment</p>
            </div>

            {/* Trust signals */}
            <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4">
              {[
                "🔒 Secure Stripe checkout",
                "🏦 We never store your card",
                "📬 Campaign launches in 10–14 days",
              ].map((s) => (
                <p key={s} className="text-xs text-gray-500">{s}</p>
              ))}
            </div>
          </div>
        </div>

        {/* Form — left on desktop */}
        <div className="order-2 lg:order-1 lg:col-span-3">
          <CheckoutForm
            bundleId={bundleId}
            bundleName={bundle.name}
            bundlePrice={bundle.price}
            cityId={city.id}
            cityName={city.name}
            categoryId={category.id}
            categoryName={category.name}
            citySlug={citySlug}
            categorySlug={categorySlug}
            isAuthenticated={!!user}
            userEmail={user?.email ?? null}
          />
        </div>
      </div>
    </div>
  );
}
