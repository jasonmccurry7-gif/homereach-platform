import type { RouteTargetingBlock } from "@/lib/seo/blocks";

export function RouteTargetingBlockView({
  data,
  cityName,
}: {
  data: RouteTargetingBlock["data"];
  cityName: string;
}) {
  return (
    <section>
      <h2 className="text-2xl font-bold text-white mb-4">Targeted mail routes in {cityName}</h2>
      <p className="text-gray-200 leading-relaxed">{data.route_map_description}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {data.household_count !== undefined && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <p className="text-xl font-bold text-white">{data.household_count.toLocaleString()}</p>
            <p className="mt-1 text-xs text-gray-400">households per mailing</p>
          </div>
        )}
        {data.frequency && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <p className="text-xl font-bold text-white">{data.frequency}</p>
            <p className="mt-1 text-xs text-gray-400">mailing cadence</p>
          </div>
        )}
        {data.postcard_format && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <p className="text-xl font-bold text-white">{data.postcard_format}</p>
            <p className="mt-1 text-xs text-gray-400">format</p>
          </div>
        )}
      </div>
    </section>
  );
}
