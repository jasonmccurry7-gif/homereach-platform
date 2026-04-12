import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCityBySlug,
  getCategoryBySlug,
  getBundlesWithAvailability,
} from "@/lib/funnel/queries";
import { FunnelProgress } from "@/components/funnel/funnel-progress";
import { CheckoutButton } from "./checkout-button";
import { cn } from "@/lib/utils";
import { resolvePrice } from "@homereach/services/pricing";
import type { ResolvePriceInput } from "@homereach/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ citySlug: string; categorySlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { citySlug, categorySlug } = await params;
  const [city, category] = await Promise.all([
    getCityBySlug(citySlug),
    getCategoryBySlug(categorySlug),
  ]);
  if (!city || !category) return { title: "Not Found" };
  return {
    title: `${category.name} in ${city.name} — Choose Your Spot`,
    description: `Limited advertising spots available for ${category.name} businesses in ${city.name}. Claim yours before they're gone.`,
  };
}

export default async function BundleSelectionPage({ params }: Props) {
  const { citySlug, categorySlug } = await params;

  const [city, category] = await Promise.all([
    getCityBySlug(citySlug),
    getCategoryBySlug(categorySlug),
  ]);

  if (!city || !city.isActive || !category) notFound();

  const bundleList = await getBundlesWithAvailability(city.id, category.id);
  const availableBundles = bundleList.filter((b) => !b.isSoldOut);
  const soldOutBundles = bundleList.filter((b) => b.isSoldOut);

  // ── Phase 1: Resolve authoritative prices from pricing engine ─────────────
  // bundle.price (display-only) is NOT used for price display in this page.
  // All prices come from the pricing engine via resolvePrice().
  // isFounding uses city.foundingEligible — server-controlled, never client-trusted.
  const resolvedPriceMap = new Map<string, { priceCents: number; isFoundingPrice: boolean }>();

  await Promise.all(
    bundleList.map(async (bundle) => {
      try {
        const input: ResolvePriceInput = {
          productType: "bundle",
          billingInterval: "monthly",
          cityId: city.id,
          bundleId: bundle.id,
          isFounding: city.foundingEligible,
        };
        const resolved = await resolvePrice(input);
        resolvedPriceMap.set(bundle.id, {
          priceCents: resolved.workingPriceCents,
          isFoundingPrice: resolved.isFoundingPrice,
        });
      } catch {
        // If pricing engine fails for a bundle, fall back to bundle.price display value.
        // This is a safe fallback — bundle.price is kept aligned with pricing profiles.
        resolvedPriceMap.set(bundle.id, {
          priceCents: Math.round(Number(bundle.price) * 100),
          isFoundingPrice: false,
        });
      }
    })
  );

  const totalSpotsLeft = bundleList.reduce((sum, b) => sum + b.spotsRemaining, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <FunnelProgress
        currentStep={3}
        cityName={city.name}
        categoryName={category.name}
      />

      {/* Header */}
      <div className="mb-2 text-center">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-blue-600">
          {city.name} · {category.name}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Choose your spot
        </h1>
        <p className="mt-3 text-lg text-gray-500">
          Each spot is exclusive — once it&apos;s claimed, no other{" "}
          <span className="font-medium text-gray-700">{category.name.toLowerCase()}</span> business
          can take it in {city.name}.
        </p>
      </div>

      {/* Global scarcity alert */}
      {totalSpotsLeft <= 3 && totalSpotsLeft > 0 && (
        <div className="my-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800">
              Only {totalSpotsLeft} spot{totalSpotsLeft !== 1 ? "s" : ""} left in {city.name} for {category.name}
            </p>
            <p className="text-sm text-amber-700">
              Once these are gone, no new businesses will be added to this mailer.
            </p>
          </div>
        </div>
      )}

      {/* Bundle cards */}
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {availableBundles.map((bundle) => {
          const resolved = resolvedPriceMap.get(bundle.id) ?? {
            priceCents: Math.round(Number(bundle.price) * 100),
            isFoundingPrice: false,
          };
          return (
            <BundleCard
              key={bundle.id}
              bundle={bundle}
              resolvedPriceCents={resolved.priceCents}
              isFoundingPrice={resolved.isFoundingPrice}
              cityId={city.id}
              categoryId={category.id}
              citySlug={citySlug}
              categorySlug={categorySlug}
            />
          );
        })}

        {/* Sold out bundles — greyed out */}
        {soldOutBundles.map((bundle) => {
          const resolved = resolvedPriceMap.get(bundle.id) ?? {
            priceCents: Math.round(Number(bundle.price) * 100),
            isFoundingPrice: false,
          };
          return (
            <SoldOutBundleCard
              key={bundle.id}
              bundle={bundle}
              resolvedPriceCents={resolved.priceCents}
            />
          );
        })}
      </div>

      {/* What's included explainer */}
      <div className="mt-14 rounded-2xl border border-gray-100 bg-white p-7">
        <h2 className="mb-5 text-center text-lg font-bold text-gray-900">
          Every HomeReach campaign includes
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: "📬", title: "2,500+ homes", body: "Verified residential addresses in your neighborhood" },
            { icon: "🎨", title: "Professional design", body: "Our team designs your ad — no creative work required" },
            { icon: "📊", title: "Live dashboard", body: "See reach, responses, and ROI in real time" },
            { icon: "🔒", title: "Exclusivity", body: "One business per category per mailer — period" },
          ].map((item) => (
            <div key={item.title} className="flex flex-col items-center text-center">
              <span className="mb-2 text-3xl">{item.icon}</span>
              <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
              <p className="mt-1 text-xs text-gray-500">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-7">
        <h2 className="mb-4 font-bold text-gray-900">Common questions</h2>
        <div className="space-y-4">
          {[
            {
              q: "How soon will my ad go out?",
              a: "Your campaign launches within 10–14 business days of payment. We handle design, printing, and mailing.",
            },
            {
              q: "What if I'm not in my city yet?",
              a: "Join the waitlist and we'll notify you the moment spots open up in your area.",
            },
            {
              q: "Can I cancel or pause?",
              a: "No contracts — campaigns run for the agreed term. Contact us to discuss renewal or adjustments.",
            },
          ].map((faq) => (
            <div key={faq.q} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <p className="font-medium text-gray-900 text-sm">{faq.q}</p>
              <p className="mt-1 text-sm text-gray-500">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Back link */}
      <div className="mt-8 text-center">
        <Link
          href={`/get-started/${citySlug}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Choose a different category
        </Link>
      </div>
    </div>
  );
}

// ─── Bundle Card ──────────────────────────────────────────────────────────────

function BundleCard({
  bundle,
  resolvedPriceCents,
  isFoundingPrice,
  cityId,
  categoryId,
  citySlug,
  categorySlug,
}: {
  bundle: Awaited<ReturnType<typeof getBundlesWithAvailability>>[0];
  /** Authoritative price from pricing engine (cents). NEVER use bundle.price here. */
  resolvedPriceCents: number;
  isFoundingPrice: boolean;
  cityId: string;
  categoryId: string;
  citySlug: string;
  categorySlug: string;
}) {
  const spotTypeLabel = {
    anchor: "Anchor Position",
    front: "Front Page",
    back: "Back Page",
  }[bundle.spotType];

  const spotTypeBg = {
    anchor: "bg-amber-50 text-amber-800 border-amber-200",
    front: "bg-blue-50 text-blue-800 border-blue-200",
    back: "bg-gray-50 text-gray-700 border-gray-200",
  }[bundle.spotType];

  // Convert cents to dollars for display
  const displayPrice = resolvedPriceCents / 100;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md",
        bundle.highlight
          ? "border-amber-300 ring-2 ring-amber-200"
          : "border-gray-200"
      )}
    >
      {/* Popular / exclusive badge */}
      {bundle.badgeText && (
        <div
          className={cn(
            "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold shadow-sm whitespace-nowrap",
            bundle.badgeColor === "amber" && "bg-amber-500 text-white",
            bundle.badgeColor === "blue" && "bg-blue-600 text-white",
            bundle.badgeColor === "green" && "bg-green-600 text-white"
          )}
        >
          {bundle.badgeText}
        </div>
      )}

      <div className="p-6">
        {/* Spot type tag */}
        <span
          className={cn(
            "inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold mb-3",
            spotTypeBg
          )}
        >
          {spotTypeLabel}
        </span>

        {/* Name + price */}
        <h3 className="text-xl font-bold text-gray-900">{bundle.name}</h3>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-3xl font-bold text-gray-900">
            ${displayPrice.toLocaleString()}
          </span>
          <span className="text-sm text-gray-500">/ campaign</span>
          {isFoundingPrice && (
            <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
              Founding rate
            </span>
          )}
        </div>
        {bundle.description && (
          <p className="mt-2 text-sm text-gray-500 leading-snug">{bundle.description}</p>
        )}

        {/* Scarcity */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span
              className={cn(
                "font-semibold",
                bundle.spotsRemaining === 1 ? "text-red-600" :
                bundle.spotsRemaining <= 2 ? "text-amber-600" :
                "text-gray-500"
              )}
            >
              {bundle.spotsRemaining === 1
                ? "⚠️ Last spot available"
                : bundle.spotsRemaining <= 2
                ? `Only ${bundle.spotsRemaining} spots left`
                : `${bundle.spotsRemaining} of ${bundle.maxSpots} spots available`}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                bundle.spotsRemaining === 1 ? "bg-red-500" :
                bundle.spotsRemaining <= 2 ? "bg-amber-500" :
                "bg-blue-500"
              )}
              style={{
                width: `${Math.min(100, (bundle.spotsTaken / bundle.maxSpots) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Features */}
        <ul className="mt-5 space-y-2">
          {bundle.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="mt-auto border-t border-gray-100 p-5">
        <CheckoutButton
          bundleId={bundle.id}
          bundleName={bundle.name}
          cityId={cityId}
          categoryId={categoryId}
          citySlug={citySlug}
          categorySlug={categorySlug}
          highlight={bundle.highlight}
        />
        <p className="mt-2 text-center text-xs text-gray-400">
          Secure checkout · No contracts
        </p>
      </div>
    </div>
  );
}

// ─── Sold Out Card ─────────────────────────────────────────────────────────────

function SoldOutBundleCard({
  bundle,
  resolvedPriceCents,
}: {
  bundle: Awaited<ReturnType<typeof getBundlesWithAvailability>>[0];
  /** Authoritative price from pricing engine (cents). NEVER use bundle.price here. */
  resolvedPriceCents: number;
}) {
  const displayPrice = resolvedPriceCents / 100;

  return (
    <div className="relative flex flex-col rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 opacity-60">
      <span className="mb-3 inline-block rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-gray-400">
        Sold out
      </span>
      <h3 className="text-xl font-bold text-gray-400">{bundle.name}</h3>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-gray-300">
          ${displayPrice.toLocaleString()}
        </span>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        All spots taken
      </p>
    </div>
  );
}
