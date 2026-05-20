import type { HomeownerAudienceBlock } from "@/lib/seo/blocks";

export function HomeownerAudienceBlockView({
  data,
  cityName,
}: {
  data: HomeownerAudienceBlock["data"];
  cityName: string;
}) {
  return (
    <section>
      <h2 className="text-2xl font-bold text-white mb-4">Who you&apos;ll reach in {cityName}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.homeowner_count !== undefined && data.homeowner_count > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <p className="text-3xl font-bold text-white">
              {data.homeowner_count.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-gray-400">homeowners reached monthly</p>
          </div>
        )}
        {data.demographic_profile && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <p className="text-sm font-semibold text-gray-300">Audience profile</p>
            <p className="mt-1 text-sm text-gray-200">{data.demographic_profile}</p>
          </div>
        )}
      </div>
      {data.neighborhoods && data.neighborhoods.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-gray-300 mb-2">Neighborhoods covered</p>
          <div className="flex flex-wrap gap-2">
            {data.neighborhoods.map((n) => (
              <span key={n} className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
                {n}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
