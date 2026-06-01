import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Globe2,
  Megaphone,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Star,
  Wand2,
} from "lucide-react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAiGrowthOsSnapshot } from "@/lib/ai-growth-os/sample-data";
import {
  buildBreadcrumbLd,
  buildServiceLd,
  buildSoftwareApplicationLd,
  type JsonLd as JsonLdShape,
} from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "AI Local Growth OS for Small Businesses | HomeReach",
  description:
    "HomeReach connects AI Web Assistant, local visibility, reviews, content, campaigns, and follow-up into one simple AI-powered local business growth operating system.",
  alternates: { canonical: "/local-growth-os" },
  openGraph: {
    title: "The AI-powered local business growth operating system.",
    description:
      "Make AI useful, simple, actionable, and profitable for local businesses with HomeReach AI agents.",
  },
};

const simpleSteps = [
  "Tell us about the business, city, services, and customers.",
  "AI recommends the assistant, visibility scan, content pack, and campaign path.",
  "Drafts go to review before anything is posted, sent, scheduled, or launched.",
  "The owner sees one clear action center instead of a pile of tools.",
];

const platformOutcomes = [
  { title: "Get found", body: "Visibility Agent surfaces Google profile, local SEO, listings, and trust gaps.", icon: Globe2 },
  { title: "Capture leads", body: "Lead Capture Agent turns website visitors into named follow-up opportunities.", icon: Bot },
  { title: "Create content", body: "Social Content Agent drafts posts, GBP updates, review asks, and campaign ideas.", icon: Wand2 },
  { title: "Build campaigns", body: "Campaign Agent connects offers to postcards, targeted mail, and follow-up.", icon: Megaphone },
  { title: "Protect reputation", body: "Review Agent drafts requests and replies while keeping public actions approval-first.", icon: Star },
  { title: "Know next steps", body: "Insight Agent explains what happened, why it matters, and what to do next.", icon: ClipboardCheck },
];

export default function LocalGrowthOsPage() {
  const snapshot = getAiGrowthOsSnapshot();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com";
  const schemas: JsonLdShape[] = [
    buildServiceLd({
      name: "HomeReach AI Local Growth OS",
      description:
        "AI-powered local business growth operating system connecting lead capture, local visibility, reputation, content, campaigns, and follow-up.",
      category: "LocalBusinessService",
      url: `${base}/local-growth-os`,
    }),
    buildSoftwareApplicationLd({
      name: "HomeReach AI Local Growth OS",
      description: "A supervised AI growth command center for local businesses.",
      url: `${base}/local-growth-os`,
      applicationCategory: "BusinessApplication",
    }),
    buildBreadcrumbLd([
      { name: "Home", url: `${base}/` },
      { name: "AI Local Growth OS", url: `${base}/local-growth-os` },
    ]),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <JsonLd schemas={schemas} />
      <SiteHeader variant="growth" />
      <main>
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-6 lg:py-20">
            <div>
              <p className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
                AI-powered local business growth OS
              </p>
              <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
                AI that helps your business grow without making your life harder.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                HomeReach connects AI Web Assistant, local visibility, reviews, social content, campaigns, and
                follow-up into one simple growth operating center for local businesses. Start with a one-page local
                growth review before committing to the next campaign.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/waitlist?product=local-growth-review"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
                >
                  Request Local Growth Review
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/local-visibility#visibility-scan"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  Launch Visibility Scan
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-slate-950/30 backdrop-blur">
              <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
                  <p className="text-sm font-semibold leading-6 text-cyan-50">{snapshot.positioning.promise}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {snapshot.metrics.map((metric) => (
                  <div key={metric.label} className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
                    <p className="mt-3 text-3xl font-black text-white">{metric.value}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{metric.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Simple setup</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                No prompt engineering. No technical maze. Just one guided path.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-4">
              {simpleSteps.map((step, index) => (
                <div key={step} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <p className="mt-5 text-sm font-semibold leading-7 text-slate-700">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-14 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Growth agents</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                Specialized AI agents focused on local business outcomes.
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                The customer sees clear value. HomeReach keeps the operational depth, approvals, and integrations behind
                the scenes.
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {platformOutcomes.map((outcome) => {
                const Icon = outcome.icon;
                return (
                  <div key={outcome.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-lg font-black tracking-tight text-slate-950">{outcome.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{outcome.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 pb-14 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-700" />
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Approval-first</p>
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                AI drafts and recommends. Humans approve sensitive actions.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Public replies, outbound messages, campaign launches, ads, political content, payment changes, and
                profile updates stay behind review.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {snapshot.approvalRules.map((rule) => (
                <div key={rule} className="flex gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <p className="text-sm font-semibold leading-6 text-emerald-950">{rule}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 px-4 py-14 text-white lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Speed to value</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Start with one scan, one assistant, and one useful content draft.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                HomeReach turns AI into practical growth work: leads captured, trust improved, content drafted, and
                campaigns ready for approval.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/waitlist?product=local-growth-review"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-50"
              >
                Request Growth Review
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/local-visibility#visibility-scan"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
              >
                Launch Visibility Scan
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
