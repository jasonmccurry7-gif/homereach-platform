import type { Metadata } from "next";
import { loadPoliticalRouteCoverage } from "@/lib/political/coverage-data";
import { CommandPanel, PublicHero } from "../_components/PublicCommand";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Campaign Mail Routes - HomeReach Political",
  description: "Live carrier-route coverage catalog used by the campaign planner.",
};

export default async function PoliticalRoutesPage() {
  const coverage = await loadPoliticalRouteCoverage({
    state: "OH",
    geographyType: "state",
    geographyValue: "",
    limit: 30,
  });

  return (
    <>
      <PublicHero
        eyebrow="Carrier Route Coverage"
        title="Route Inventory Built for Campaign Mail Planning"
        subtitle="The public planner uses aggregate USPS-style route counts to calculate reach, postcards, coverage, and cost. No voter-level data is required."
        primaryHref="/political/maps"
        primaryLabel="Select Routes in Map"
        primaryRequiresAccount={false}
        secondaryHref="/political/data-sources"
        secondaryLabel="Methodology"
      />
      <section className="mx-auto max-w-7xl space-y-6 px-5 py-12">
        <CommandPanel
          title="Live Route Catalog"
          body={coverage.note ?? "Showing the densest imported routes first for the default Ohio catalog view."}
        >
          {coverage.routes.length === 0 ? (
            <div className="rounded-lg border border-amber-300/25 bg-amber-950/30 p-4 text-sm text-amber-100">
              No public route records are loaded for this default view yet. Import the route catalog in the admin portal to power full visual coverage.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/10 text-left text-xs uppercase tracking-[0.18em] text-slate-300">
                  <tr>
                    <th className="px-3 py-3">Route</th>
                    <th className="px-3 py-3">Place</th>
                    <th className="px-3 py-3 text-right">Households</th>
                    <th className="px-3 py-3 text-right">Density</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-slate-200">
                  {coverage.routes.map((route) => (
                    <tr key={route.id}>
                      <td className="px-3 py-3 font-mono">{route.zip5}-{route.carrierRouteId}</td>
                      <td className="px-3 py-3">{[route.city, route.county].filter(Boolean).join(", ") || route.state}</td>
                      <td className="px-3 py-3 text-right">{route.households.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right">{route.densityScore}/100</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CommandPanel>
      </section>
    </>
  );
}
