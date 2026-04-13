import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCityBySlug, getCategoriesForCity } from "@/lib/funnel/queries";
import { FunnelProgress } from "@/components/funnel/funnel-progress";
import { OtherCategoryCard } from "./other-category-card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ citySlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { citySlug } = await params;
  const city = await getCityBySlug(citySlug);
  if (!city) return { title: "Not Found" };
  return {
    title: `${city.name} — Choose Your Category`,
    description: `See available advertising spots for your business type in ${city.name}, ${city.state}.`,
  };
}

export default async function CategorySelectionPage({ params }: Props) {
  const { citySlug } = await params;
  const city = await getCityBySlug(citySlug);

  if (!city || !city.isActive) notFound();

  const categoryList = await getCategoriesForCity(city.id);

  // Separate "Other" from the rest
  const otherCategory = categoryList.find((c) => c.slug === "other");
  const regularCategories = categoryList.filter((c) => c.slug !== "other");
  const available = regularCategories.filter((c) => c.isAvailable);
  const full = regularCategories.filter((c) => !c.isAvailable);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <FunnelProgress currentStep={2} cityName={city.name} />

      {/* Header */}
      <div className="mb-10 text-center">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-blue-600">
          {city.name}, {city.state}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          What type of business are you?
        </h1>
        <p className="mt-3 text-lg text-gray-500">
          One business per category. Choose yours before a competitor does.
        </p>

        {full.length > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5">
            <span className="flex h-1.5 w-1.5 rounded-full bg-green-500" />
            <p className="text-sm font-medium text-green-700">
              {full.length} categor{full.length === 1 ? "y" : "ies"} already claimed in {city.name}
            </p>
          </div>
        )}
      </div>

      {/* Available categories */}
      {available.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {available.map((cat) => (
            <CategoryCard key={cat.id} category={cat} citySlug={citySlug} />
          ))}

          {/* Other card — always last */}
          {otherCategory && (
            <OtherCategoryCard citySlug={citySlug} />
          )}
        </div>
      )}

      {/* Sold out */}
      {full.length > 0 && (
        <div className="mt-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Already claimed — these spots are taken
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {full.map((cat) => (
              <SoldOutCategoryCard key={cat.id} category={cat} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 text-center">
        <Link href="/get-started" className="text-sm text-gray-500 hover:text-gray-700">
          ← Choose a different city
        </Link>
      </div>
    </div>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({
  category,
  citySlug,
}: {
  category: Awaited<ReturnType<typeof getCategoriesForCity>>[0];
  citySlug: string;
}) {
  const urgency =
    category.spotsRemaining <= 1 ? "critical" :
    category.spotsRemaining <= 3 ? "high" : "normal";

  return (
    <Link
      href={`/get-started/${citySlug}/${category.slug}`}
      className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
    >
      {urgency === "critical" && (
        <div className="absolute -top-2 left-3 rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white shadow">
          1 spot left
        </div>
      )}
      <div className="mb-3 text-3xl">{category.icon ?? "🏢"}</div>
      <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors leading-tight">
        {category.name}
      </h3>
      {category.description && (
        <p className="mt-1 text-xs text-gray-500 leading-snug line-clamp-2">
          {category.description}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between">
        <span className={cn(
          "text-xs font-medium",
          urgency === "critical" ? "text-red-600" :
          urgency === "high" ? "text-amber-600" : "text-green-600"
        )}>
          {urgency === "critical" ? "⚠️ Almost full" :
           urgency === "high" ? `${category.spotsRemaining} left` : "Available"}
        </span>
        <svg className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}

// ─── Sold Out Card ─────────────────────────────────────────────────────────────

function SoldOutCategoryCard({
  category,
}: {
  category: Awaited<ReturnType<typeof getCategoriesForCity>>[0];
}) {
  return (
    <div className="relative flex flex-col rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 opacity-60">
      <div className="mb-3 text-3xl grayscale">{category.icon ?? "🏢"}</div>
      <h3 className="font-semibold text-gray-400 leading-tight">{category.name}</h3>
      <span className="mt-3 text-xs font-semibold uppercase text-gray-400">Sold out</span>
    </div>
  );
}
