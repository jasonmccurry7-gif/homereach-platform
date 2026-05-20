"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Maximize2,
  MonitorPlay,
  ShieldCheck,
} from "lucide-react";
import type {
  AmyActonCampaignPhase,
  AmyActonPostcardConcept,
  AmyActonPresentationSlide,
  AmyActonTargetingArea,
} from "@/lib/political/amy-acton-presentation";

interface PresentationDeckClientProps {
  slides: AmyActonPresentationSlide[];
  phases: AmyActonCampaignPhase[];
  targetingAreas: AmyActonTargetingArea[];
  postcardConcepts: AmyActonPostcardConcept[];
  assets: {
    pptxHref: string;
    pdfHref: string;
    outlineHref: string;
  };
}

export function PresentationDeckClient({
  slides,
  phases,
  targetingAreas,
  postcardConcepts,
  assets,
}: PresentationDeckClientProps) {
  const [current, setCurrent] = useState(0);
  const [showNotes, setShowNotes] = useState(true);
  const slide = slides[current] ?? slides[0]!;
  const progress = useMemo(() => Math.round(((current + 1) / slides.length) * 100), [current, slides.length]);

  function move(delta: -1 | 1) {
    setCurrent((value) => (value + delta + slides.length) % slides.length);
  }

  return (
    <section className="rounded-lg border border-blue-300/15 bg-slate-950 shadow-2xl shadow-blue-950/30">
      <div className="flex flex-col gap-4 border-b border-white/10 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">
            Live Presentation System
          </p>
          <h2 className="mt-1 text-xl font-black text-white">Amy Acton campaign deck review</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <DownloadLink href={assets.pptxHref} label="Download PPTX" />
          <DownloadLink href={assets.pdfHref} label="Download PDF" />
          <DownloadLink href={assets.outlineHref} label="Outline + notes" />
          <button
            type="button"
            onClick={() => setShowNotes((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
          >
            <FileText className="h-4 w-4" />
            {showNotes ? "Hide notes" : "Show notes"}
          </button>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[1fr_340px]">
        <div className="p-4">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-[#071126]">
            <div className="relative aspect-video bg-[radial-gradient(circle_at_18%_15%,rgba(37,99,235,0.25),transparent_34%),linear-gradient(135deg,#071126,#0f1830_54%,#24111c)] p-6 sm:p-8 lg:p-10">
              <div className="absolute inset-x-0 top-0 h-1 bg-white/10">
                <div className="h-full bg-blue-400 transition-all" style={{ width: `${progress}%` }} />
              </div>

              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-full border border-blue-200/30 bg-blue-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-100">
                    {slide.kicker}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {String(slide.number).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
                  </div>
                </div>

                <div className="mt-5 grid flex-1 gap-6 lg:grid-cols-[0.92fr_1fr] lg:items-center">
                  <div>
                    <h3 className="text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
                      {slide.title}
                    </h3>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                      {slide.summary}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {slide.bullets.map((bullet) => (
                        <span
                          key={bullet}
                          className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-200"
                        >
                          {bullet}
                        </span>
                      ))}
                    </div>
                  </div>

                  <SlideVisual
                    slideNumber={slide.number}
                    phases={phases}
                    targetingAreas={targetingAreas}
                    postcardConcepts={postcardConcepts}
                    proofObject={slide.proofObject}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => move(-1)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/political/candidate-agent?candidate=amy-acton"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <MonitorPlay className="h-4 w-4" />
                Open AI agent
              </Link>
              <Link
                href="/political/maps"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <Maximize2 className="h-4 w-4" />
                Validate map
              </Link>
            </div>
          </div>

          {showNotes && (
            <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-500/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
                Speaker notes
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-50">{slide.speakerNotes}</p>
            </div>
          )}
        </div>

        <aside className="border-t border-white/10 p-4 xl:border-l xl:border-t-0">
          <div className="rounded-lg border border-emerald-300/15 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-50">
              <ShieldCheck className="h-4 w-4" />
              Proposal guardrails
            </div>
            <p className="mt-3 text-xs leading-5 text-emerald-50/80">
              This deck is a strategic proposal. It does not imply endorsement or campaign approval. Route counts,
              carrier-route IDs, postage, print cost, and checkout remain locked until verified in the political
              command workflow.
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {slides.map((item, index) => {
              const active = index === current;
              return (
                <button
                  key={item.number}
                  type="button"
                  onClick={() => setCurrent(index)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    active
                      ? "border-blue-300/50 bg-blue-500/20"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Slide {item.number}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm font-bold text-white">{item.title}</div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}

function DownloadLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-500"
    >
      <Download className="h-4 w-4" />
      {label}
    </a>
  );
}

function SlideVisual({
  slideNumber,
  phases,
  targetingAreas,
  postcardConcepts,
  proofObject,
}: {
  slideNumber: number;
  phases: AmyActonCampaignPhase[];
  targetingAreas: AmyActonTargetingArea[];
  postcardConcepts: AmyActonPostcardConcept[];
  proofObject: string;
}) {
  if (slideNumber === 5) {
    return <TargetingVisual targetingAreas={targetingAreas} />;
  }

  if (slideNumber === 6) {
    return <PhaseVisual phases={phases} />;
  }

  if (slideNumber === 7) {
    return <PostcardVisual postcardConcepts={postcardConcepts} />;
  }

  if (slideNumber === 9) {
    return <CostVisual />;
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">Proof object</div>
      <p className="mt-3 text-sm leading-6 text-slate-200">{proofObject}</p>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {["Intelligence", "Maps", "Execution"].map((label, index) => (
          <div key={label} className="rounded-lg border border-white/10 bg-slate-950/70 p-3">
            <div className="text-2xl font-black text-white">{index + 1}</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 h-28 rounded-lg border border-blue-300/20 bg-[linear-gradient(135deg,rgba(37,99,235,0.22),rgba(225,29,72,0.15))] p-4">
        <div className="grid h-full grid-cols-5 gap-2">
          {Array.from({ length: 15 }).map((_, index) => (
            <span
              key={index}
              className={`rounded-sm ${index % 4 === 0 ? "bg-red-400/70" : index % 3 === 0 ? "bg-blue-300/75" : "bg-white/20"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TargetingVisual({ targetingAreas }: { targetingAreas: AmyActonTargetingArea[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {targetingAreas.slice(0, 4).map((area) => (
          <div key={area.name} className="rounded-lg border border-white/10 bg-slate-950/70 p-3">
            <div className="text-sm font-black text-white">{area.name}</div>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-300">{area.whyItMatters}</p>
            <div className="mt-3 rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase text-amber-100">
              {area.estimatedReach}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhaseVisual({ phases }: { phases: AmyActonCampaignPhase[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
      <div className="space-y-3">
        {phases.map((phase, index) => (
          <div key={phase.name} className="grid grid-cols-[42px_1fr] gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-sm font-black text-white">
              {index + 1}
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-950/70 p-3">
              <div className="text-sm font-black text-white">{phase.name}</div>
              <div className="mt-1 text-xs leading-5 text-slate-300">{phase.quantity}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostcardVisual({ postcardConcepts }: { postcardConcepts: AmyActonPostcardConcept[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {postcardConcepts.map((concept) => (
        <div key={concept.category} className="rounded-lg bg-white p-2 text-slate-950 shadow-xl">
          <div className="min-h-28 rounded-md bg-gradient-to-br from-blue-900 to-red-950 p-3 text-white">
            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-100">{concept.category}</div>
            <div className="mt-2 text-sm font-black leading-tight">{concept.frontHeadline}</div>
            <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-white/80">{concept.frontCopy}</p>
          </div>
          <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[10px] leading-4 text-slate-700">
            <span className="font-black text-slate-950">Back:</span> {concept.backHeadline}
          </div>
        </div>
      ))}
    </div>
  );
}

function CostVisual() {
  const rows = [
    ["Intro", "1.0M", "$0.54-$0.68"],
    ["Trust", "850k", "$0.54-$0.68"],
    ["Contrast", "650k", "$0.56-$0.70"],
    ["GOTV", "900k", "$0.54-$0.68"],
  ];

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
      <div className="grid grid-cols-3 border-b border-white/10 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        <span>Wave</span>
        <span>Pieces</span>
        <span>Planning c/p</span>
      </div>
      <div className="mt-2 space-y-2">
        {rows.map(([wave, pieces, cost]) => (
          <div key={wave} className="grid grid-cols-3 rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm">
            <span className="font-black text-white">{wave}</span>
            <span className="text-slate-200">{pieces}</span>
            <span className="text-blue-100">{cost}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">Planning estimates only. Quote lock requires USPS counts, print cost, postage, source timestamp, and human approval.</p>
    </div>
  );
}
