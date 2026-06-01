"use client";

import dynamic from "next/dynamic";
import type { PoliticalMapPlanContext } from "./PoliticalInteractiveMap";

const PoliticalInteractiveMap = dynamic(
  () => import("./PoliticalInteractiveMap").then((module) => module.PoliticalInteractiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-white/10 bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/20">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-blue-400 shadow-[0_0_18px_rgba(96,165,250,0.85)]" />
          <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-100">
            Loading route map
          </p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {["Coverage", "Route gaps", "Budget"].map((label) => (
            <div key={label} className="h-24 rounded-xl border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      </div>
    ),
  },
);

export function PoliticalInteractiveMapLoader({
  initialPlanContext = null,
}: {
  initialPlanContext?: PoliticalMapPlanContext | null;
}) {
  return <PoliticalInteractiveMap initialPlanContext={initialPlanContext} />;
}
