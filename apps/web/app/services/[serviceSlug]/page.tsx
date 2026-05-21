import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Globe2,
  Landmark,
  Mail,
  MessageSquare,
  PackageSearch,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import {
  getGrowthServiceModule,
  getPublicServiceSlug,
  listPublicGrowthServiceSlugs,
  type GrowthServiceCategory,
} from "@/lib/growth-execution/services";

type ServicePageParams = Promise<{ serviceSlug: string }>;

const categoryIcons: Record<GrowthServiceCategory, typeof Mail> = {
  postcards: Mail,
  lead_capture: Bot,
  follow_up: MessageSquare,
  seo: Search,
  reputation: Star,
  content: Globe2,
  paid_media: ClipboardCheck,
  procurement: PackageSearch,
  government: Landmark,
};

export function generateStaticParams() {
  return listPublicGrowthServiceSlugs();
}

export async function generateMetadata({ params }: { params: ServicePageParams }): Promise<Metadata> {
  const { serviceSlug } = await params;
  const service = getGrowthServiceModule(serviceSlug);
  if (!service) {
    return {
      title: "HomeReach Service",
    };
  }

  const canonical = service.publicPath.startsWith("/services/")
    ? service.publicPath
    : `/services/${getPublicServiceSlug(service)}`;

  return {
    title: `${service.shortTitle} | HomeReach`,
    description: service.outcome,
    alternates: { canonical },
    openGraph: {
      title: `${service.shortTitle} | HomeReach`,
      description: service.outcome,
    },
  };
}

export default async function ServiceDetailPage({ params }: { params: ServicePageParams }) {
  const { serviceSlug } = await params;
  const service = getGrowthServiceModule(serviceSlug);
  if (!service) notFound();

  const Icon = categoryIcons[service.category];
  const related = service.crossSells.slice(0, 4);
  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-6 lg:py-20">
            <div>
              <Link href="/services" className="text-sm font-bold text-blue-200 hover:text-white">
                Services
              </Link>
              <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-lg bg-white text-blue-700">
                <Icon className="h-6 w-6" />
              </div>
              <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                {service.shortTitle}
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{service.headline}</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300">{service.outcome}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={service.primaryCtaHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500"
                >
                  {service.primaryCtaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/services"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  See All Services
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.08] p-5 backdrop-blur">
              <div className="grid gap-3 sm:grid-cols-3">
                {service.metrics.map((metric) => (
                  <div key={metric.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
                    <p className="mt-3 text-2xl font-black text-white">{metric.value}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{metric.detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
                  <div>
                    <p className="text-sm font-black text-emerald-50">Production-safe model</p>
                    <p className="mt-2 text-sm leading-6 text-emerald-50/85">
                      AI may draft, recommend, summarize, and prepare. Sensitive sending, publishing, bidding, ads,
                      payment changes, and political content stay behind approval.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.78fr_1.22fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">What It Does</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                Simple customer outcome, connected operating layer.
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">{service.whatItDoes}</p>
              <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">Customer promise</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-blue-950">{service.publicPromise}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ServiceList title="Preserved Systems" items={service.preservedSystems} />
              <ServiceList title="Enhancements" items={service.enhancements} />
              <ServiceList title="Execution Actions" items={service.executionActions} />
              <ServiceList title="Tracked Events" items={service.eventTypes} />
            </div>
          </div>
        </section>

        <section className="px-4 pb-14 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Best for</p>
              <p className="mt-3 text-sm leading-7 text-slate-700">{service.whoFor}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Admin source</p>
              <Link href={service.adminPath} className="mt-3 inline-flex items-center gap-2 text-sm font-black text-blue-700 hover:text-blue-900">
                Open source module
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Advanced controls stay in the admin command center, not on the public website.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Customer path</p>
              <Link href={service.customerPath} className="mt-3 inline-flex items-center gap-2 text-sm font-black text-blue-700 hover:text-blue-900">
                View customer surface
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Customer-facing views stay simple: status, results, next action, and upgrade options.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 pb-14 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">AI role</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Useful assistance without unsafe autonomy.</h2>
              <div className="mt-4 grid gap-2">
                {service.aiAgents.map((agent) => (
                  <div key={agent} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <Bot className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                    <p className="text-sm font-semibold text-slate-700">{agent}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Approval gates</p>
              <div className="mt-4 grid gap-2">
                {service.approvalGates.map((gate) => (
                  <div key={gate} className="flex gap-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <p className="text-sm font-semibold capitalize text-amber-900">{gate.replaceAll("_", " ")}</p>
                  </div>
                ))}
              </div>
              {service.integrationGaps.length > 0 && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Integration notes</p>
                  <ul className="mt-3 space-y-2">
                    {service.integrationGaps.map((gap) => (
                      <li key={gap} className="text-sm leading-6 text-slate-600">
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 lg:px-6">
          <div className="mx-auto max-w-7xl rounded-lg bg-slate-950 p-6 text-white lg:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                  Connected services
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight">Build the next offer from the same customer relationship.</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {related.map((item) => (
                    <span key={item} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <Link
                href={service.primaryCtaHref}
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-blue-50"
              >
                {service.primaryCtaLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function ServiceList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div key={item} className="flex gap-3">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-sm leading-6 text-slate-700">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
