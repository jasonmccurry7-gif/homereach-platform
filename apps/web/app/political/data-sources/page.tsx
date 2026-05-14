import Link from "next/link";
import type { Metadata } from "next";
import {
  dataQualityLabels,
  politicalMapSourceRequirements,
  sourceRequirementsByPriority,
} from "@/lib/political/map-source-plan";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Data Sources & Methodology - HomeReach Campaign Mail",
  description:
    "How HomeReach labels political map data, USPS route data, household counts, pricing estimates, and compliance safeguards.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-black text-white">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-gray-300">
        {children}
      </div>
    </section>
  );
}

function SourceGroup({
  title,
  priority,
}: {
  title: string;
  priority: "MVP" | "Phase 2" | "Phase 3";
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h3 className="text-sm font-black uppercase tracking-[0.18em] text-blue-200">
        {title}
      </h3>
      <div className="mt-4 divide-y divide-white/10">
        {sourceRequirementsByPriority(priority).map((source) => (
          <article key={source.name} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-black text-white">{source.name}</h4>
              <span className="rounded-full border border-white/10 bg-slate-950 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300">
                {source.sourceType}
              </span>
              <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-100">
                {source.difficulty}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{source.provides}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Format: {source.expectedFormat}. Coverage: {source.coverage}. Refresh: {source.refreshCadence}.
            </p>
            {source.url && (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex text-xs font-bold text-blue-300 hover:text-blue-200"
              >
                Review source
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function DataSourcesPage() {
  const mvpCount = politicalMapSourceRequirements.filter((source) => source.requiredForMvp).length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-10">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-red-300">
          Transparency
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          Data Sources &amp; Methodology
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-gray-400">
          HomeReach separates verified production data from estimates and demo map layers. Every campaign plan should show
          what is exact, what is estimated, what is public aggregate, and what still requires a paid or official source.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-blue-300/20 bg-blue-500/10 p-5">
          <div className="text-3xl font-black text-white">{mvpCount}</div>
          <div className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-100">
            MVP source requirements
          </div>
        </div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-5">
          <div className="text-3xl font-black text-white">3</div>
          <div className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-100">
            launch states: OH / IL / TN
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-5">
          <div className="text-3xl font-black text-white">0</div>
          <div className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">
            individual voter scores
          </div>
        </div>
      </div>

      <div className="mt-10 space-y-10">
        <Section title="What the dual map uses today">
          <p>
            The current public map uses public Census county geometry for Ohio, Illinois, and Tennessee. Ohio District
            mode uses the official 2026-2032 congressional district layer published through Ohio public GIS after the
            October 2025 Redistricting Commission adoption.
          </p>
          <p>
            USPS route cells are clearly marked demo/sample so the synced political-to-mail workflow can be tested before
            licensed carrier-route polygons are imported.
          </p>
          <p>
            Production quotes must verify USPS route counts, delivery-point counts, and exclusions before approval or Stripe
            checkout. Demo/sample labels are intentionally visible anywhere estimated route data appears.
          </p>
        </Section>

        <Section title="Data confidence labels">
          <div className="grid gap-3 sm:grid-cols-2">
            {dataQualityLabels.map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-sm font-black text-white">{item.label}</div>
                <p className="mt-1 text-sm leading-6 text-slate-400">{item.meaning}</p>
              </div>
            ))}
          </div>
        </Section>

        <div className="grid gap-4 xl:grid-cols-3">
          <SourceGroup title="MVP Required" priority="MVP" />
          <SourceGroup title="Phase 2 Data" priority="Phase 2" />
          <SourceGroup title="Phase 3 Data" priority="Phase 3" />
        </div>

        <Section title="Compliance safeguards">
          <ul className="list-disc space-y-1.5 pl-6 text-gray-300">
            <li>HomeReach does not predict individual political beliefs, votes, turnout, or persuasion likelihood.</li>
            <li>Political red/blue/gray color coding is aggregate geography context only.</li>
            <li>Historical election overlays must remain precinct, county, district, or other aggregate summaries.</li>
            <li>Campaign-provided lists are treated as user-provided data and must be kept separate from prohibited inference.</li>
            <li>Any estimate must display a data confidence label before proposal, approval, payment, or production.</li>
          </ul>
        </Section>

        <Section title="Pricing and timing methodology">
          <p>
            Estimates combine selected route households, deliverable address count assumptions, print cost, postage, service
            cost, and drop count. Timing recommendations use production lead time, print windows, USPS delivery assumptions,
            and election deadlines. They do not forecast campaign outcomes.
          </p>
        </Section>

        <div className="border-t border-gray-800 pt-8 text-center">
          <p className="text-sm text-gray-400">
            Ready to map your district and compare mail coverage?
          </p>
          <Link
            href="/political/maps"
            className="mt-3 inline-flex rounded-xl bg-red-600 px-8 py-3.5 text-sm font-black text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-red-500"
          >
            Open Political Maps
          </Link>
        </div>
      </div>
    </div>
  );
}
