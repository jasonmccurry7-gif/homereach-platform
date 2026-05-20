import Link from "next/link";
import type { Metadata } from "next";
import { PresentationDeckClient } from "./PresentationDeckClient";
import {
  AMY_ACTON_CAMPAIGN_PHASES,
  AMY_ACTON_POSTCARD_CONCEPTS,
  AMY_ACTON_PRESENTATION_ASSETS,
  AMY_ACTON_PRESENTATION_SLIDES,
  AMY_ACTON_PRESENTATION_SOURCES,
  AMY_ACTON_TARGETING_AREAS,
} from "@/lib/political/amy-acton-presentation";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Amy Acton Campaign Presentation - HomeReach Political",
  description:
    "A premium HomeReach political mail execution presentation for Dr. Amy Acton for Governor.",
};

export default function AmyActonPresentationPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <section className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-200">
            Campaign presentation
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight text-white sm:text-5xl">
            Amy Acton statewide mail strategy deck.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
            A proposal-ready presentation layer for HomeReach Political Command: route-level targeting intelligence,
            geographic saturation strategy, multi-phase postcard creative, cost predictability, and operational
            execution visibility.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={AMY_ACTON_PRESENTATION_ASSETS.pptxHref}
              className="rounded-lg bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500"
            >
              Download PowerPoint
            </a>
            <a
              href={AMY_ACTON_PRESENTATION_ASSETS.pdfHref}
              className="rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Download PDF
            </a>
            <Link
              href="/political/candidate-agent?candidate=amy-acton"
              className="rounded-lg border border-blue-300/30 bg-blue-500/10 px-5 py-3 text-sm font-bold text-blue-50 transition hover:bg-blue-500/20"
            >
              Open Amy agent
            </Link>
          </div>
        </div>

        <aside className="rounded-lg border border-amber-300/20 bg-amber-500/10 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100">
            Quote protection
          </p>
          <p className="mt-3 text-sm leading-6 text-amber-50">
            The deck uses source-backed strategy and labeled planning estimates. Final carrier routes, mail counts,
            print cost, postage, and checkout remain locked until validated through HomeReach Political Command.
          </p>
        </aside>
      </section>

      <section className="mt-10">
        <PresentationDeckClient
          slides={AMY_ACTON_PRESENTATION_SLIDES}
          phases={AMY_ACTON_CAMPAIGN_PHASES}
          targetingAreas={AMY_ACTON_TARGETING_AREAS}
          postcardConcepts={AMY_ACTON_POSTCARD_CONCEPTS}
          assets={AMY_ACTON_PRESENTATION_ASSETS}
        />
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">Connected workflow</p>
          <h2 className="mt-2 text-xl font-black text-white">Presentation to campaign plan</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            The review layer links back to the existing AI agent, maps, pricing, and campaign plan flow instead of
            creating a duplicate sales path.
          </p>
        </article>
        <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">Creative system</p>
          <h2 className="mt-2 text-xl font-black text-white">Complete postcard concepts</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            The deck shows full front/back message systems for emotional, issue, trust, and urgency creative lanes.
            Campaign approval and legal sourcing still control final output.
          </p>
        </article>
        <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">Data boundary</p>
          <h2 className="mt-2 text-xl font-black text-white">Aggregate and operational only</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Targeting is geography, route density, public election context, household logistics, and campaign-provided
            messaging. No individual voter scoring or ideology prediction is used.
          </p>
        </article>
      </section>

      <section className="mt-10 rounded-lg border border-white/10 bg-slate-950/70 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">Sources and assumptions</p>
            <h2 className="mt-2 text-2xl font-black text-white">Research is source-labeled and quote-safe.</h2>
          </div>
          <Link
            href="/political/data-sources"
            className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
          >
            Open data sources
          </Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {AMY_ACTON_PRESENTATION_SOURCES.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/10 bg-white/[0.04] p-4 transition hover:border-blue-300/40 hover:bg-blue-500/10"
            >
              <div className="text-sm font-black text-white">{source.label}</div>
              <p className="mt-2 text-xs leading-5 text-slate-300">{source.note}</p>
              <div className="mt-3 text-xs font-bold text-blue-200">{source.url}</div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
