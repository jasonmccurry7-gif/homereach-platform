import type { Metadata } from "next";
import Link from "next/link";
import { PoliticalMailCommandCenter } from "@/app/(admin)/admin/political/_components/PoliticalMailCommandCenter";
import { AmyActonCampaignCommandCenter } from "../_components/AmyActonCampaignCommandCenter";
import { loadPoliticalMailCommandCenter } from "@/lib/political/mail-command-center";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Political Mail Command Center - HomeReach Political",
  description:
    "Customer-safe campaign operations analytics for mail reach, route readiness, delivery windows, cost visibility, risk alerts, and safe engagement reporting.",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function PoliticalAnalyticsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const selectedCandidate = first(sp.candidate);
  const actonSelected =
    selectedCandidate === "amy-acton" ||
    selectedCandidate === "acton" ||
    selectedCandidate === "public-acton-source-backed-profile";
  const data = await loadPoliticalMailCommandCenter();

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      {actonSelected ? (
        <div className="mb-6">
          <AmyActonCampaignCommandCenter compact />
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-blue-300/15 bg-slate-950 p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
            Candidate-specific analytics
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-2xl font-black text-white">Select a candidate to show dedicated intelligence.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                This analytics view stays campaign-neutral until a candidate profile is selected. Candidate-specific
                command-center modules, creative, strategy, and readiness notes only appear after selection.
              </p>
            </div>
            <Link
              href="/political/candidate-agent"
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10"
            >
              Open Candidate Selector
            </Link>
          </div>
        </div>
      )}
      <PoliticalMailCommandCenter data={data} audience="customer" />
    </section>
  );
}
