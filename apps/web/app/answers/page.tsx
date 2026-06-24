import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, Globe2, Mail, Search, ShieldCheck, Star } from "lucide-react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  buildBreadcrumbLd,
  buildFaqPageLd,
  buildItemListLd,
  buildWebPageLd,
  type JsonLd as JsonLdShape,
} from "@/lib/seo/schema";
import { listGrowthServiceModules } from "@/lib/growth-execution/services";
import { listMainProductSeoTargets } from "@/lib/seo/product-seo";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com";

export const metadata: Metadata = {
  title: "HomeReach Answers | Local Growth, SEO, Reputation, Mail, and AI Agents",
  description:
    "Clear answers about HomeReach local growth, direct mail, AI web assistant, local SEO, reputation, procurement, and campaign execution services.",
  alternates: { canonical: "/answers" },
  openGraph: {
    title: "HomeReach Answers",
    description:
      "A concise answer hub for local businesses comparing direct mail, local SEO, reputation, AI web assistant, procurement, and growth execution options.",
    url: `${BASE}/answers`,
  },
};

const answerGroups = [
  {
    title: "What is HomeReach?",
    icon: Bot,
    answer:
      "HomeReach is an AI-powered local growth operating system. It helps local businesses get found, capture leads, improve reputation, execute direct mail and digital campaigns, and identify cost-saving procurement opportunities.",
    links: [
      { label: "AI Growth OS", href: "/local-growth-os" },
      { label: "Services", href: "/services" },
    ],
  },
  {
    title: "How does HomeReach drive more local customers?",
    icon: Globe2,
    answer:
      "HomeReach combines visibility, conversion, follow-up, and operational execution. Public offers route buyers into local visibility scans, AI web assistant demos, shared postcards, targeted campaigns, and managed growth plans.",
    links: [
      { label: "Local Visibility", href: "/local-visibility" },
      { label: "Market Capture", href: "/market-capture" },
    ],
  },
  {
    title: "Is HomeReach only direct mail?",
    icon: Mail,
    answer:
      "No. Direct mail is one strong wedge, but the ecosystem also supports local SEO, reputation, AI web assistant lead capture, social content, procurement intelligence, targeted campaigns, and government contract workflows.",
    links: [
      { label: "Shared Postcards", href: "/shared-postcards" },
      { label: "Targeted Campaigns", href: "/targeted" },
    ],
  },
  {
    title: "How does HomeReach help with AI search and answer engines?",
    icon: Search,
    answer:
      "HomeReach publishes clear service pages, structured FAQs, authority hubs, visual proof pages, tools, insights, and schema markup so search engines and AI systems can understand what HomeReach does and cite the right public page.",
    links: [
      { label: "Ohio Authority Hub", href: "/ohio" },
      { label: "Insights", href: "/insights" },
    ],
  },
  {
    title: "How does HomeReach help a business look more trusted?",
    icon: Star,
    answer:
      "HomeReach supports review generation, review response workflows, Google profile optimization, listing-health recommendations, local content, and reputation alerts through a supervised local visibility system.",
    links: [
      { label: "Reputation Service", href: "/services/reputation" },
      { label: "Local Visibility", href: "/local-visibility" },
    ],
  },
  {
    title: "Does AI act without approval?",
    icon: ShieldCheck,
    answer:
      "AI can draft, summarize, recommend, organize, and prepare work. Outbound messages, social publishing, political content, pricing commitments, payments, procurement orders, bid submissions, and sensitive public actions require human approval.",
    links: [
      { label: "AI Web Assistant", href: "/services/ai-website-assistant" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
];

const comparisonRows = [
  ["Get found", "Local SEO, authority pages, Google profile recommendations, service-area content"],
  ["Look trusted", "Reviews, reputation alerts, review replies, listing health, proof pages"],
  ["Capture leads", "AI Web Assistant, forms, intake paths, CTA routing, campaign requests"],
  ["Follow up", "Approval-gated email, SMS, DM drafts, lead summaries, next actions"],
  ["Execute campaigns", "Shared postcards, targeted routes, digital targeting, political mail, fulfillment workflows"],
  ["Protect margin", "Supplyfy procurement insights, vendor risk, smart buy recommendations, savings reports"],
];

const faqPairs = answerGroups.map((group) => ({ question: group.title, answer: group.answer }));

export default function AnswersPage() {
  const productTargets = listMainProductSeoTargets(
    listGrowthServiceModules().filter((service) => service.publicExposure !== "admin_only"),
  );
  const schemas: JsonLdShape[] = [
    buildWebPageLd({
      name: "HomeReach Answers",
      description:
        "A clear answer hub explaining HomeReach local growth, AI web assistant, local SEO, reputation, direct mail, procurement, and campaign execution.",
      url: `${BASE}/answers`,
      about: [
        "AI-powered local business growth",
        "Answer engine optimization",
        "Local SEO",
        "Reputation management",
        "Direct mail marketing",
        "AI web assistant",
      ],
    }),
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Answers", url: `${BASE}/answers` },
    ]),
    buildFaqPageLd(faqPairs),
    buildItemListLd({
      name: "HomeReach answer topics",
      url: `${BASE}/answers`,
      items: [
        ...answerGroups.map((group) => ({
          name: group.title,
          url: `${BASE}/answers#${toId(group.title)}`,
        })),
        ...productTargets.map((target) => ({
          name: target.title,
          url: `${BASE}${target.path}`,
        })),
      ],
    }),
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <JsonLd schemas={schemas} />
      <SiteHeader />
      <main>
        <section className="border-b border-slate-200 bg-slate-950 px-4 py-16 text-white lg:px-6 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <p className="inline-flex rounded-full border border-blue-300/25 bg-blue-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-100">
              HomeReach answers
            </p>
            <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
              Clear answers for local business growth, AI visibility, and execution.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
              This page is built for buyers, search engines, and answer engines. It explains what HomeReach does,
              what problem each system solves, and where to go next.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/local-visibility"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-500"
              >
                Get a Visibility Scan
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/services"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
              >
                See Services
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white px-4 py-14 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Product answers</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                What HomeReach offers and which problem each product solves.
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                Buyers and AI systems need direct product relationships. These summaries map HomeReach services to the
                searches, questions, and business outcomes they support.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {productTargets.map((target) => (
                <Link
                  key={target.slug}
                  href={target.path}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:border-blue-200 hover:bg-white hover:shadow-xl hover:shadow-slate-950/10"
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">{target.primaryKeyword}</p>
                  <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">{target.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{target.answerSummary}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-700">
                    Open product page
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-3">
            {answerGroups.map((group) => {
              const Icon = group.icon;
              return (
                <article id={toId(group.title)} key={group.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 text-xl font-black tracking-tight text-slate-950">{group.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{group.answer}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {group.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-4 py-14 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Outcome map</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                HomeReach is organized around what needs to improve.
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                Search and AI systems need clean relationships. This table connects the customer outcome to the
                HomeReach system that supports it.
              </p>
            </div>
            <div className="mt-8 overflow-hidden rounded-lg border border-slate-200">
              {comparisonRows.map(([outcome, system]) => (
                <div key={outcome} className="grid gap-3 border-b border-slate-200 bg-white p-4 last:border-b-0 md:grid-cols-[0.35fr_0.65fr]">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    <p className="text-sm font-black text-slate-950">{outcome}</p>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{system}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 lg:px-6">
          <div className="mx-auto max-w-7xl rounded-lg bg-slate-950 p-8 text-white shadow-2xl shadow-slate-950/20">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">Next action</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight">Start with the highest-leverage growth gap.</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  If visibility is weak, start with a local visibility scan. If leads are missed, start with AI Web Assistant.
                  If neighborhood awareness is weak, start with Market Capture or direct mail.
                </p>
              </div>
              <Link
                href="/waitlist?product=answers"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-black text-slate-950 hover:bg-blue-50"
              >
                Request Growth Plan
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function toId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
