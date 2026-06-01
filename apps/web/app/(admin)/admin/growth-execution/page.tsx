import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Globe2,
  Landmark,
  Mail,
  MessageSquare,
  PackageSearch,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  Workflow,
} from "lucide-react";
import {
  getGrowthExecutionSnapshot,
  type GrowthServiceCategory,
  type GrowthServiceStatus,
} from "@/lib/growth-execution/services";

export const metadata: Metadata = {
  title: "Growth Execution Platform - Admin",
  description: "Unified service registry, data model, AI safety, and build sequence for HomeReach growth execution.",
};

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

const statusStyles: Record<GrowthServiceStatus, string> = {
  live: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  enhanced: "border-blue-300/25 bg-blue-300/10 text-blue-100",
  preview: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  future_ready: "border-slate-300/20 bg-slate-300/10 text-slate-100",
  needs_integration: "border-rose-300/25 bg-rose-300/10 text-rose-100",
};

export default function AdminGrowthExecutionPage() {
  const snapshot = getGrowthExecutionSnapshot();
  const liveCount = snapshot.services.filter((service) => service.status === "live" || service.status === "enhanced").length;
  const approvalGateCount = new Set(snapshot.services.flatMap((service) => service.approvalGates)).size;

  return (
    <div className="-m-6 min-h-screen bg-[#07111f] text-white lg:-m-8">
      <div className="mx-auto max-w-[1800px] space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-slate-950/20">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
                HomeReach Growth Execution Platform
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
                Multi-channel growth, one operating model.
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
                This registry preserves the current postcard, outreach, procurement, political, payment, CRM, map,
                SEO, reputation, and government-contract systems while defining how each service plugs into HomeReach OS.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Services" value={String(snapshot.services.length)} />
              <Metric label="Live/enhanced" value={String(liveCount)} />
              <Metric label="Approval gates" value={String(approvalGateCount)} />
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-3">
          {snapshot.services.map((service) => {
            const Icon = categoryIcons[service.category];
            return (
              <div key={service.slug} className="rounded-lg border border-white/10 bg-slate-950/55 p-4 shadow-xl shadow-slate-950/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-300/20 bg-blue-300/10 text-blue-100">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-white">{service.shortTitle}</h2>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {service.category.replaceAll("_", " ")}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusStyles[service.status]}`}>
                    {service.status.replaceAll("_", " ")}
                  </span>
                </div>

                <p className="mt-4 min-h-16 text-sm leading-6 text-slate-300">{service.outcome}</p>

                <div className="mt-4 grid gap-2">
                  <InfoRow label="Public" value={service.publicPath} href={service.publicPath} />
                  <InfoRow label="Admin" value={service.adminPath} href={service.adminPath} />
                  <InfoRow label="Customer" value={service.customerPath} href={service.customerPath} />
                </div>

                <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Next actions</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {service.executionActions.slice(0, 4).map((action) => (
                      <span key={action} className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] font-semibold text-slate-300">
                        {action}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel title="AI Workforce and Approval Rules" icon={Bot}>
            <div className="grid gap-3 md:grid-cols-2">
              {snapshot.agents.map((agent) => (
                <Link
                  key={agent.name}
                  href={agent.adminPath}
                  className="rounded-lg border border-white/10 bg-white/[0.05] p-4 transition hover:bg-white hover:text-slate-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{agent.name}</p>
                      <p className="mt-1 text-xs leading-5 opacity-70">{agent.purpose}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </div>
                  <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-100 group-hover:text-amber-700">
                      Requires approval for
                    </p>
                    <p className="mt-2 text-xs leading-5 opacity-80">{agent.requiresApprovalFor.join(", ")}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Integration Gaps" icon={ShieldAlert}>
            <div className="space-y-3">
              {snapshot.integrationGaps.map((gap) => (
                <div key={gap.system} className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{gap.system}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{gap.impact}</p>
                    </div>
                    <span className={severityClass(gap.severity)}>{gap.severity}</span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-400">Safe now: {gap.safeCurrentBehavior}</p>
                  <p className="mt-2 text-xs font-semibold text-blue-100">Next: {gap.nextStep}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Data Model Coverage" icon={Database}>
            <div className="space-y-3">
              {snapshot.eventModel.map((model) => (
                <Link
                  key={model.entity}
                  href={model.adminPath}
                  className="block rounded-lg border border-white/10 bg-white/[0.05] p-4 transition hover:bg-white hover:text-slate-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{model.entity}</p>
                      <p className="mt-1 text-xs leading-5 opacity-70">Source: {model.currentSource}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {model.eventExamples.map((event) => (
                      <span key={event} className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] font-semibold">
                        {event}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Audit Findings and Build Sequence" icon={Workflow}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                {snapshot.auditFindings.map((finding) => (
                  <div key={finding.area} className="rounded-lg border border-emerald-300/15 bg-emerald-300/10 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <div>
                        <p className="font-semibold text-emerald-50">{finding.area}</p>
                        <p className="mt-2 text-xs leading-5 text-emerald-50/80">{finding.finding}</p>
                        <p className="mt-2 text-xs font-semibold text-emerald-100">Decision: {finding.decision}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {snapshot.nextBuildSequence.map((step) => (
                  <div key={step.phase} className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-200">Phase {step.phase}</p>
                      <span className={severityClass(step.risk)}>{step.risk}</span>
                    </div>
                    <p className="mt-2 font-semibold text-white">{step.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{step.objective}</p>
                    <Link href={step.ownerSurface} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-blue-100 hover:text-white">
                      {step.ownerSurface}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </section>

        <section className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-100" />
            <div>
              <p className="font-semibold text-amber-50">AI safety posture</p>
              <p className="mt-2 text-sm leading-6 text-amber-50/85">
                AI can draft, recommend, summarize, analyze, and prepare. It cannot autonomously send high-volume outreach,
                submit bids, charge customers, modify payments, publish political content, make compliance claims, launch ads,
                or send sensitive campaign messages without explicit human approval.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
    </div>
  );
}

function InfoRow({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs transition hover:bg-white hover:text-slate-950">
      <span className="font-black uppercase tracking-[0.12em] opacity-60">{label}</span>
      <span className="truncate font-semibold">{value}</span>
    </Link>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/55 p-4 shadow-xl shadow-slate-950/20">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-blue-300/20 bg-blue-300/10 text-blue-100">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function severityClass(severity: "low" | "medium" | "high") {
  if (severity === "high") {
    return "rounded-full border border-rose-300/25 bg-rose-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-rose-100";
  }
  if (severity === "medium") {
    return "rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100";
  }
  return "rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100";
}
