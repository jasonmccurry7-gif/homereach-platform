import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Inbox,
  MessageSquareText,
  PhoneCall,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UserRoundCheck,
} from "lucide-react";
import { AssistantDemoForm } from "@/components/ai-web-assistant/assistant-demo-form";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAiWebAssistantSnapshot } from "@/lib/ai-web-assistant/sample-data";
import {
  buildBreadcrumbLd,
  buildServiceLd,
  buildSoftwareApplicationLd,
  type JsonLd as JsonLdShape,
} from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "AI Web Assistant for Local Businesses | HomeReach",
  description:
    "HomeReach AI Web Assistant answers website visitors, captures leads, routes urgent requests, summarizes conversations, and helps local businesses respond instantly.",
  alternates: { canonical: "/services/ai-website-assistant" },
  openGraph: {
    title: "Turn More Website Visitors Into Customers",
    description:
      "A premium AI-powered front desk, lead capture, routing, and customer engagement assistant for local businesses.",
  },
};

const useCases = [
  { title: "Answer common questions", detail: "Hours, services, areas served, policies, and next steps.", icon: MessageSquareText },
  { title: "Capture lead details", detail: "Name, phone, email, service need, location, and urgency.", icon: UserRoundCheck },
  { title: "Request appointments", detail: "Collect appointment requests without confirming unapproved times.", icon: CalendarClock },
  { title: "Route urgent issues", detail: "Escalate high-value or time-sensitive leads to the right owner.", icon: Route },
  { title: "Summarize conversations", detail: "Create clean lead summaries and follow-up tasks for the business.", icon: Inbox },
  { title: "Request reviews safely", detail: "Draft review request workflows for happy customers after approval.", icon: Star },
  { title: "Find local SEO gaps", detail: "Turn repeated questions into FAQ, service page, and Google post ideas.", icon: Search },
  { title: "Reduce missed calls", detail: "Keep after-hours visitors from disappearing without a trace.", icon: PhoneCall },
];

const setupSteps = [
  "Enter business basics, services, service areas, hours, and handoff preferences.",
  "HomeReach generates the assistant profile, greeting, FAQ, lead flow, and safety rules.",
  "Review the test assistant preview and approve knowledge base items.",
  "Install the embed code after domain approval and production key creation.",
];

const safetyRules = [
  "Answers only approved FAQs automatically.",
  "Captures leads and summarizes conversations without sending outbound messages.",
  "Requires approval before texts, emails, public replies, or Google/profile changes.",
  "Captures contact info and alerts the business when a question is sensitive or uncertain.",
];

export default function AiWebsiteAssistantPage() {
  const snapshot = getAiWebAssistantSnapshot();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com";
  const schemas: JsonLdShape[] = [
    buildServiceLd({
      name: "HomeReach AI Web Assistant",
      description:
        "AI-powered front desk, lead capture, routing, reputation, and customer engagement assistant for local businesses.",
      category: "LeadCaptureService",
      url: `${base}/services/ai-website-assistant`,
    }),
    buildSoftwareApplicationLd({
      name: "HomeReach AI Web Assistant",
      description:
        "A supervised AI assistant that answers website visitors, captures leads, routes urgent requests, and summarizes conversations.",
      url: `${base}/services/ai-website-assistant`,
      applicationCategory: "BusinessApplication",
    }),
    buildBreadcrumbLd([
      { name: "Home", url: `${base}/` },
      { name: "Services", url: `${base}/services` },
      { name: "AI Web Assistant", url: `${base}/services/ai-website-assistant` },
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
              <p className="inline-flex rounded-full border border-blue-300/25 bg-blue-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-100">
                Never miss a customer again
              </p>
              <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
                Turn More Website Visitors Into Customers
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                HomeReach AI Web Assistant answers questions, captures leads, routes requests, and helps local
                businesses respond instantly, even after hours.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#assistant-demo"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500"
                >
                  Get a Free AI Assistant Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  See How It Works
                </a>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-slate-950/30 backdrop-blur">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-300/20 bg-blue-300/10 p-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-100">AI Front Desk</p>
                  <p className="mt-2 text-xl font-black text-white">Captures, routes, summarizes</p>
                </div>
                <Bot className="h-8 w-8 text-blue-200" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["24/7 response", "After-hours visitors get helped."],
                  ["Lead capture", "Contact info and service need saved."],
                  ["Urgent routing", "High-priority requests surfaced."],
                  ["Approval-first", "Sensitive actions stay controlled."],
                ].map(([label, detail]) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-sm font-black text-white">{label}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
                  <p className="text-sm font-semibold leading-6 text-emerald-50">
                    AI agents help local businesses turn website traffic into named leads, booked conversations, and
                    smarter follow-up.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="assistant-demo" className="px-4 py-14 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <AssistantDemoForm />
          </div>
        </section>

        <section id="how-it-works" className="px-4 pb-14 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">What It Does</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                Simple externally, intelligent internally.
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                This is not a generic chatbot. It is a supervised AI front desk that understands the business profile,
                captures revenue opportunities, and tells the owner exactly who needs follow-up.
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {useCases.map((useCase) => {
                const Icon = useCase.icon;
                return (
                  <div key={useCase.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-base font-black tracking-tight text-slate-950">{useCase.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{useCase.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 pb-14 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Setup Flow</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                Launch-ready without technical friction.
              </h2>
              <div className="mt-5 grid gap-3">
                {setupSteps.map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm font-semibold leading-6 text-slate-700">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Human Control</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                The assistant helps. The business stays in control.
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {safetyRules.map((rule) => (
                  <div key={rule} className="flex gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <p className="text-sm font-semibold leading-6 text-emerald-950">{rule}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-14 lg:px-6">
          <div className="mx-auto max-w-7xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">AI Agent Layer</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                  Built for specialized local-business work.
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Each agent has a job, approval boundaries, and a safe handoff model. It works with reputation, local
                  SEO, postcards, procurement, and follow-up instead of becoming another disconnected tool.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {snapshot.agents.map((agent) => (
                  <div key={agent.name} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-700" />
                      <p className="font-black text-slate-950">{agent.name}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{agent.role}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-3">
            {[
              ["Starter Assistant", "$299/mo", "Lead capture, FAQ setup, simple assistant dashboard, monthly summary."],
              ["Growth Assistant", "$599/mo", "Conversation routing, review request workflows, weekly insight report, follow-up drafts."],
              ["Revenue Assistant", "$999+/mo", "Advanced knowledge base, local SEO insights, multi-location support, owner alerts, strategy review."],
            ].map(([name, price, detail]) => (
              <div key={name} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-lg font-black text-slate-950">{name}</p>
                <p className="mt-2 text-3xl font-black text-blue-700">{price}</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{detail}</p>
                <div className="mt-5 flex gap-2 text-sm font-black text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  Approval-first AI actions
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-950 px-4 py-14 text-white lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-200">HomeReach AI Web Assistant</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Your website can start helping customers today.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Capture the next lead, route the next urgent request, and give the business owner a clear summary
                instead of another missed opportunity.
              </p>
            </div>
            <Link
              href="#assistant-demo"
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-blue-100"
            >
              Get a Free AI Assistant Demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
