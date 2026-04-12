import type { Metadata } from "next";
import Link from "next/link";
import { getActiveCities } from "@/lib/funnel/queries";
import { FunnelProgress } from "@/components/funnel/funnel-progress";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Choose Your City — Get Started",
  description: "Select your city to see available advertising spots in your neighborhood.",
};

// Always render at request time — requires live DB
export const dynamic = "force-dynamic";

export default async function CitySelectionPage() {
  const cities = await getActiveCities();

  const activeCities = cities.filter((c) => c.isActive);
  const comingSoonCities = cities.filter((c) => !c.isActive);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <FunnelProgress currentStep={1} />

      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Where is your business located?
        </h1>
        <p className="mt-3 text-lg text-gray-500">
          We reach 2,500+ targeted homeowners per city, every month. Choose your city to see available spots.
        </p>
      </div>

      {/* Active cities */}
      {activeCities.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              Now accepting businesses
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeCities.map((city) => (
              <CityCard key={city.id} city={city} />
            ))}
          </div>
        </section>
      )}

      {/* Coming soon cities */}
      {comingSoonCities.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gray-300" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
              Coming soon
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {comingSoonCities.map((city) => (
              <ComingSoonCard key={city.id} city={city} />
            ))}
          </div>
        </section>
      )}

      {/* Trust bar */}
      <div className="mt-14 rounded-2xl border border-gray-100 bg-white p-6">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { icon: "📬", title: "2,500+ homes per mailer", body: "We target verified residential addresses in your neighborhood." },
            { icon: "📍", title: "Hyper-local targeting", body: "Your ad stays in your zip code — no wasted spend." },
            { icon: "📊", title: "Real-time tracking", body: "See exactly how many people responded to your campaign." },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                <p className="mt-0.5 text-sm text-gray-500">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── City Card ─────────────────────────────────────────────────────────────────

function CityCard({ city }: { city: Awaited<ReturnType<typeof getActiveCities>>[0] }) {
  const urgency =
    city.totalSpotsRemaining <= 2
      ? "critical"
      : city.totalSpotsRemaining <= 6
      ? "high"
      : "normal";

  return (
    <Link
      href={`/get-started/${city.slug}`}
      className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
    >
      {/* Scarcity indicator */}
      {urgency === "critical" && (
        <div className="absolute -top-2.5 left-4 rounded-full bg-red-500 px-3 py-0.5 text-xs font-bold text-white shadow-sm">
          Almost full
        </div>
      )}
      {urgency === "high" && (
        <div className="absolute -top-2.5 left-4 rounded-full bg-amber-500 px-3 py-0.5 text-xs font-bold text-white shadow-sm">
          Filling fast
        </div>
      )}

      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
            {city.name}
          </h3>
          <p className="text-sm text-gray-500">{city.state}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xl group-hover:bg-blue-100 transition-colors">
          🏙️
        </div>
      </div>

      <div className="mt-auto space-y-2">
        {/* Spots bar */}
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              urgency === "critical" ? "bg-red-500" :
              urgency === "high" ? "bg-amber-500" :
              "bg-blue-500"
            )}
            style={{ width: `${Math.min(100, ((24 - city.totalSpotsRemaining) / 24) * 100)}%` }}
          />
        </div>
        <p className={cn(
          "text-xs font-medium",
          urgency === "critical" ? "text-red-600" :
          urgency === "high" ? "text-amber-600" :
          "text-gray-500"
        )}>
          {urgency === "critical"
            ? `Only ${city.totalSpotsRemaining} spot${city.totalSpotsRemaining !== 1 ? "s" : ""} left`
            : `${city.totalSpotsRemaining} spots available`}
        </p>
      </div>

      <div className="mt-4 flex items-center text-sm font-semibold text-blue-600 group-hover:text-blue-700">
        View spots
        <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}

// ─── Coming Soon Card ──────────────────────────────────────────────────────────

function ComingSoonCard({ city }: { city: Awaited<ReturnType<typeof getActiveCities>>[0] }) {
  return (
    <div className="relative flex flex-col rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 opacity-70">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-500">{city.name}</h3>
          <p className="text-sm text-gray-400">{city.state}</p>
        </div>
        <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-500">
          Coming soon
        </span>
      </div>
      <Link
        href={`/waitlist?city=${city.slug}`}
        className="mt-auto text-sm font-medium text-blue-500 hover:text-blue-600"
      >
        Join the waitlist →
      </Link>
    </div>
  );
}
