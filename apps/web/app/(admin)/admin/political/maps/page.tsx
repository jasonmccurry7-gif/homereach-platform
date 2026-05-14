import { loadPoliticalOverviewSection } from "@/lib/political/admin-command";
import { politicalMapSourceRequirements } from "@/lib/political/map-source-plan";
import { CommandSection } from "../_components/CommandSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Maps - Political - HomeReach" };

export default async function PoliticalMapsPage() {
  const data = await loadPoliticalOverviewSection();
  const mvpSources = politicalMapSourceRequirements.filter((source) => source.requiredForMvp);
  const unresolvedMvp = mvpSources.filter((source) =>
    ["USPS EDDM Online Tool", "Licensed USPS carrier route polygons", "Supabase PostGIS"].includes(source.name),
  );

  return (
    <div className="space-y-6">
      <CommandSection
        eyebrow="Geographic Intelligence"
        title="Map and Coverage Operations"
        subtitle="Carrier route inventory, coverage planning, route gap detection, active reservations, and public map handoff."
        primaryHref="/admin/political/routes"
        primaryLabel="Manage Routes"
        secondaryHref="/political/maps"
        secondaryLabel="Public Map"
        data={data}
        emptyLabel="Route and reservation metrics will appear after route catalog imports."
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-white/10 bg-slate-950 p-5 text-slate-100 shadow-2xl shadow-slate-950/30">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-200">
            Dual Map Readiness
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            Political geography is now linked to USPS execution geography
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            The public map supports Ohio, Illinois, and Tennessee with county, ZIP, city, and district selection modes.
            Route selection, household estimates, data confidence labels, and aggregate red/blue/gray context are visible
            in the campaign command center.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ReadinessMetric label="Launch states" value="OH / IL / TN" />
            <ReadinessMetric label="MVP sources" value={`${mvpSources.length}`} />
            <ReadinessMetric label="Pending critical" value={`${unresolvedMvp.length}`} tone="warning" />
          </div>
        </div>

        <div className="rounded-lg border border-amber-300/25 bg-amber-950/30 p-5 text-amber-50">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-200">
            Critical Data Warnings
          </p>
          <ul className="mt-3 space-y-3 text-sm leading-6">
            {unresolvedMvp.map((source) => (
              <li key={source.name} className="rounded border border-amber-300/20 bg-slate-950/40 p-3">
                <div className="font-black text-white">{source.name}</div>
                <p className="mt-1 text-xs text-amber-100/80">{source.provides}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function ReadinessMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={
        tone === "warning"
          ? "rounded-lg border border-amber-300/25 bg-amber-500/10 p-4"
          : "rounded-lg border border-white/10 bg-white/[0.05] p-4"
      }
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-black text-white">{value}</div>
    </div>
  );
}
