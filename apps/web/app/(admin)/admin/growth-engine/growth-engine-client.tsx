"use client";

import Link from "next/link";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  agentDefinitions,
  creativeStandards,
  ctaAuditBlueprint,
  getTopFiveRevenueOpportunities,
  growthEngineBlueprint,
  growthEngineSections,
  integrationRequirements,
  revenuePathTest,
  reviewQueueBlueprint,
  topRevenuePages,
  weeklyGrowthReportTemplate,
} from "@/lib/growth-engine/blueprint";
import type { GrowthEngineStatus, ReviewQueueBlueprintItem } from "@/lib/growth-engine/types";
import { cn } from "@/lib/utils";

const navigationTabs = [
  ["overview", "Blueprint"],
  ["sections", "Command Sections"],
  ["top-revenue-pages", "Top 25 Pages"],
  ["review-queue", "Human Review"],
  ["integrations", "Integrations"],
  ["cta-audit", "CTA Audit"],
  ["revenue-path", "Revenue Path Test"],
  ["agents", "Agents"],
] as const;

const statusStyles: Record<GrowthEngineStatus, string> = {
  connected: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  ready: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  needs_config: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  manual_review: "border-violet-300/30 bg-violet-400/10 text-violet-100",
  blocked: "border-rose-300/30 bg-rose-400/10 text-rose-100",
};

const statusLabels: Record<GrowthEngineStatus, string> = {
  connected: "Connected",
  ready: "Ready",
  needs_config: "Needs config",
  manual_review: "Manual review",
  blocked: "Blocked",
};

const priorityStyles = {
  high: "border-rose-300/30 bg-rose-400/10 text-rose-100",
  medium: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  low: "border-slate-300/20 bg-white/5 text-slate-200",
};

type Props = {
  userEmail: string;
  approvedSocialSources: ApprovedSocialSource[];
};

export type ApprovedSocialSource = {
  id: string;
  type: "daily_video_platform_post" | "ai_output";
  label: string;
  detail: string;
  dailyVideoId?: string;
  platformPostId?: string;
  aiOutputId?: string;
  platform: string;
  text: string;
};

type RuntimeIntegrationStatus = {
  vendor: "arvow" | "blotato" | "rss_cms";
  label: string;
  state: "ready" | "review_only" | "needs_config" | "blocked";
  mode: string;
  canCallApi: boolean;
  canPublish: boolean;
  env: Array<{ name: string; required: boolean; present: boolean }>;
  lastCheckedAt: string;
  issue: string | null;
  nextAction: string;
};

type RuntimeStatusPayload = {
  generatedAt: string;
  integrations: RuntimeIntegrationStatus[];
};

type IntegrationActionResult = {
  ok?: boolean;
  message?: string;
  dryRun?: boolean;
  items?: unknown[];
  payload?: unknown;
  data?: unknown;
  status?: RuntimeIntegrationStatus;
};

type BlotatoAccount = {
  id: string;
  name: string;
  platform: string;
  pages: Array<{ id: string; name: string }>;
};

const runtimeStatusStyles: Record<RuntimeIntegrationStatus["state"], string> = {
  ready: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  review_only: "border-blue-300/30 bg-blue-400/10 text-blue-100",
  needs_config: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  blocked: "border-rose-300/30 bg-rose-400/10 text-rose-100",
};

export function GrowthEngineClient({ userEmail, approvedSocialSources }: Props) {
  const [activeSection, setActiveSection] = useState("overview");
  const [copied, setCopied] = useState<string | null>(null);
  const topFive = useMemo(() => getTopFiveRevenueOpportunities(), []);

  const reportText = useMemo(
    () =>
      [
        "HomeReach Weekly Growth Report",
        `Prepared for: ${userEmail}`,
        "",
        "Blueprint status: approved for additive MVP.",
        "Publishing mode: review-first. No auto-publishing is enabled by this dashboard.",
        "",
        "Top 5 revenue opportunities:",
        ...topFive.map((page) => `${page.rank}. ${page.title} - ${page.ctaRecommendation}`),
        "",
        "Report sections:",
        ...weeklyGrowthReportTemplate.map((item) => `- ${item}`),
      ].join("\n"),
    [topFive, userEmail],
  );

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied("failed");
      window.setTimeout(() => setCopied(null), 1800);
    }
  }

  return (
    <div className="min-h-screen bg-[#06111f] text-white">
      <section className="border-b border-sky-200/10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.32),transparent_34%),linear-gradient(135deg,#06111f,#081626_52%,#0b1020)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" />
                Review-first growth system
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl">
                HomeReach Growth Engine
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
                A single internal command layer for SEO pages, local landing pages, blogs,
                social drafts, postcard concepts, political content, human review, reporting,
                and revenue path QA.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => copyText("report", reportText)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-slate-950"
              >
                <ClipboardCheck className="h-4 w-4" />
                {copied === "report" ? "Copied" : "Copy Weekly Report"}
              </button>
              <Link
                href="/api/admin/growth-engine/top-pages/export"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400"
              >
                <Download className="h-4 w-4" />
                Export Top 25 CSV
              </Link>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Engine sections" value={growthEngineSections.length.toString()} />
            <MetricCard label="Revenue pages planned" value={topRevenuePages.length.toString()} />
            <MetricCard label="Review items staged" value={reviewQueueBlueprint.length.toString()} />
            <MetricCard label="Auto-publish" value="Off" tone="safe" />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-slate-950/30">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-300" />
              <div>
                <h2 className="text-base font-black text-white">Blueprint internally approved for additive MVP</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {growthEngineBlueprint.internalApproval.reason}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside className="h-fit rounded-2xl border border-white/10 bg-[#091625] p-3 lg:sticky lg:top-4">
          {navigationTabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold transition",
                activeSection === id
                  ? "bg-white text-slate-950"
                  : "text-slate-300 hover:bg-white/10 hover:text-white",
              )}
            >
              {label}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ))}
        </aside>

        <main className="space-y-6">
          {activeSection === "overview" && <BlueprintPanel />}
          {activeSection === "sections" && <SectionsPanel setActiveSection={setActiveSection} />}
          {activeSection === "top-revenue-pages" && <TopRevenuePagesPanel />}
          {activeSection === "review-queue" && <ReviewQueuePanel copyText={copyText} copied={copied} />}
          {activeSection === "integrations" && <IntegrationsPanel approvedSocialSources={approvedSocialSources} />}
          {activeSection === "cta-audit" && <CtaAuditPanel />}
          {activeSection === "revenue-path" && <RevenuePathPanel />}
          {activeSection === "agents" && <AgentsPanel />}
        </main>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: "safe" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={cn("mt-2 text-3xl font-black text-white", tone === "safe" && "text-emerald-200")}>
        {value}
      </p>
    </div>
  );
}

function PanelShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#091625] p-5 shadow-xl shadow-slate-950/20">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-white">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function BlueprintPanel() {
  return (
    <PanelShell
      eyebrow="Blueprint"
      title={growthEngineBlueprint.title}
      description={growthEngineBlueprint.summary}
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <h3 className="font-black text-white">System flow</h3>
          <div className="mt-4 space-y-3">
            {growthEngineBlueprint.flow.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-lg border border-white/10 bg-slate-950/35 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-black text-white">
                  {index + 1}
                </span>
                <p className="text-sm leading-6 text-slate-200">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-200" />
            <h3 className="font-black text-emerald-50">Protected flows</h3>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {growthEngineBlueprint.protectedFlows.map((flow) => (
              <span
                key={flow}
                className="rounded-full border border-emerald-200/20 bg-emerald-950/30 px-3 py-1 text-xs font-bold text-emerald-100"
              >
                {flow}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {growthEngineBlueprint.connections.map((connection) => (
          <div key={`${connection.from}-${connection.to}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-black text-white">
              {connection.from} <span className="text-blue-200">to</span> {connection.to}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{connection.handoff}</p>
            <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-100">
              Guardrail: {connection.guardrail}
            </p>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function SectionsPanel({ setActiveSection }: { setActiveSection: (section: string) => void }) {
  return (
    <PanelShell
      eyebrow="Command Center"
      title="Twelve Growth Engine sections"
      description="Each section is a control surface over an existing HomeReach system or a review-only integration placeholder."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {growthEngineSections.map((section) => (
          <article key={section.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white">{section.title}</h3>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{section.owner}</p>
              </div>
              <span className={cn("rounded-full border px-3 py-1 text-xs font-black", statusStyles[section.status])}>
                {statusLabels[section.status]}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{section.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {section.connectedSystems.map((system) => (
                <span key={system} className="rounded-full border border-white/10 bg-slate-950/35 px-3 py-1 text-xs font-bold text-slate-200">
                  {system}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionLink action={section.primaryAction} primary setActiveSection={setActiveSection} />
              {section.secondaryAction ? (
                <ActionLink action={section.secondaryAction} setActiveSection={setActiveSection} />
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </PanelShell>
  );
}

function ActionLink({
  action,
  primary,
  setActiveSection,
}: {
  action: { label: string; href: string };
  primary?: boolean;
  setActiveSection?: (section: string) => void;
}) {
  const className = cn(
    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition",
    primary
      ? "bg-blue-500 text-white hover:bg-blue-400"
      : "border border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white hover:text-slate-950",
  );

  if (action.href.startsWith("#")) {
    const target = action.href.replace("#", "");
    return (
      <button type="button" onClick={() => setActiveSection?.(target)} className={className}>
        {action.label}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <Link href={action.href} className={className}>
      {action.label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function TopRevenuePagesPanel() {
  return (
    <PanelShell
      eyebrow="SEO Plan"
      title="Top 25 revenue pages"
      description="Prioritized by buyer intent, revenue potential, local/political relevance, conversion fit, and ability to route into existing HomeReach revenue flows."
    >
      <div id="top-revenue-pages" className="overflow-hidden rounded-xl border border-white/10">
        <div className="max-h-[680px] overflow-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-[#0d1a2a] text-xs uppercase tracking-[0.14em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Page</th>
                <th className="px-4 py-3">Keyword</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">CTA</th>
                <th className="px-4 py-3">Intent</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {topRevenuePages.map((page) => (
                <tr key={page.slug} className="bg-white/[0.025] align-top hover:bg-white/[0.05]">
                  <td className="px-4 py-4 font-black text-blue-200">{page.rank}</td>
                  <td className="px-4 py-4">
                    <p className="font-black text-white">{page.title}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">{page.slug}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{page.whyItMatters}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-100">{page.primaryKeyword}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{page.supportingKeywords.join(", ")}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-300">{page.targetAudience}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-lg bg-blue-500/15 px-3 py-1 text-xs font-black text-blue-100">
                      {page.ctaRecommendation}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn("rounded-full border px-3 py-1 text-xs font-black", priorityStyles[page.buyerIntent])}>
                      {page.buyerIntent}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-300">
                    {page.status.replaceAll("_", " ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PanelShell>
  );
}

function ReviewQueuePanel({
  copyText,
  copied,
}: {
  copyText: (key: string, text: string) => Promise<void>;
  copied: string | null;
}) {
  const queueText = reviewQueueBlueprint
    .map((item) => `${item.contentType}: ${item.title} - ${item.status} - ${item.nextAction}`)
    .join("\n");

  return (
    <PanelShell
      eyebrow="Human Review"
      title="Publishing queue defaults to review"
      description="SEO pages, articles, social posts, postcard concepts, political content, emails, SMS drafts, and image prompts should land here before publishing or production."
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => copyText("queue", queueText)}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-black text-white transition hover:bg-white hover:text-slate-950"
        >
          <ClipboardCheck className="h-4 w-4" />
          {copied === "queue" ? "Copied" : "Copy Queue Summary"}
        </button>
        <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-100">
          <Lock className="h-4 w-4" />
          Publish buttons stay disabled until approved
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {reviewQueueBlueprint.map((item) => (
          <ReviewCard key={item.id} item={item} />
        ))}
      </div>
    </PanelShell>
  );
}

function ReviewCard({ item }: { item: ReviewQueueBlueprintItem }) {
  const reviewHref = item.contentType.includes("Postcard")
    ? "/admin/ad-designer"
    : item.contentType.includes("Political")
      ? "/admin/political"
      : "/admin/content-intel";

  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-200">{item.contentType}</p>
          <h3 className="mt-2 font-black text-white">{item.title}</h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black text-slate-200">
          {item.status}
        </span>
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Channel" value={item.channel} />
        <Row label="Created by" value={item.createdBy} />
        <Row label="Audience" value={item.targetAudience} />
        <Row label="Source" value={item.sourceSystem} />
      </dl>
      <p className="mt-4 rounded-lg border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-xs font-bold leading-5 text-sky-100">
        Next: {item.nextAction}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href={reviewHref} className="rounded-lg bg-white px-3 py-2 text-center text-xs font-black text-slate-950">
          Open Review Source
        </Link>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-500"
          title="Publishing is disabled until source, QA, and human approval are complete."
        >
          Publish After Approval
        </button>
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-200">{value}</dd>
    </div>
  );
}

function vendorKeyFor(label: string): RuntimeIntegrationStatus["vendor"] {
  const normalized = label.toLowerCase();
  if (normalized.includes("arvow")) return "arvow";
  if (normalized.includes("blotato")) return "blotato";
  return "rss_cms";
}

function runtimeLabel(state: RuntimeIntegrationStatus["state"]) {
  return state.replaceAll("_", " ");
}

function IntegrationsPanel({ approvedSocialSources }: { approvedSocialSources: ApprovedSocialSource[] }) {
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatusPayload | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<Record<string, IntegrationActionResult>>({});
  const [selectedSourceId, setSelectedSourceId] = useState(approvedSocialSources[0]?.id ?? "");
  const [blotatoAccounts, setBlotatoAccounts] = useState<BlotatoAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"next_slot" | "specific_time">("next_slot");
  const [scheduledLocalTime, setScheduledLocalTime] = useState("");

  const selectedSource = approvedSocialSources.find((source) => source.id === selectedSourceId) ?? approvedSocialSources[0] ?? null;
  const selectedAccount = blotatoAccounts.find((account) => account.id === selectedAccountId) ?? blotatoAccounts[0] ?? null;
  const selectedPage = selectedAccount?.pages.find((page) => page.id === selectedPageId) ?? selectedAccount?.pages[0] ?? null;

  async function refreshStatus() {
    setLoadingStatus(true);
    try {
      const response = await fetch("/api/admin/growth-engine/integrations/status", {
        cache: "no-store",
      });
      const data = (await response.json()) as RuntimeStatusPayload;
      if (response.ok) {
        setRuntimeStatus(data);
      } else {
        setActionResult((current) => ({
          ...current,
          status: { ok: false, message: "Unable to load integration status." },
        }));
      }
    } catch (err) {
      setActionResult((current) => ({
        ...current,
        status: {
          ok: false,
          message: err instanceof Error ? err.message : "Unable to load integration status.",
        },
      }));
    } finally {
      setLoadingStatus(false);
    }
  }

  async function runAction(action: "arvow-batch" | "blotato-accounts" | "blotato-schedule") {
    setRunningAction(action);
    try {
      const response =
        action === "blotato-accounts"
          ? await fetch("/api/admin/growth-engine/integrations/blotato/accounts", { cache: "no-store" })
          : await fetch(
              action === "arvow-batch"
                ? "/api/admin/growth-engine/integrations/arvow/batch"
                : "/api/admin/growth-engine/integrations/blotato/schedule",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                  action === "arvow-batch"
                    ? {
                        dryRun: true,
                        keyword: "AI-powered local growth execution platform",
                        title: "How HomeReach Turns Local Operations Into Growth",
                      }
                    : buildBlotatoScheduleBody(selectedSource, {
                        accountId: selectedAccount?.id,
                        pageId: selectedPage?.id,
                        scheduledLocalTime,
                        useNextFreeSlot: scheduleMode === "next_slot",
                      }),
                ),
              },
            );
      const data = (await response.json()) as IntegrationActionResult;
      setActionResult((current) => ({ ...current, [action]: data }));
      if (action === "blotato-accounts" && Array.isArray(data.items)) {
        const accounts = data.items.map(normalizeBlotatoAccount).filter((item): item is BlotatoAccount => Boolean(item));
        setBlotatoAccounts(accounts);
        if (!selectedAccountId && accounts[0]) setSelectedAccountId(accounts[0].id);
        if (!selectedPageId && accounts[0]?.pages[0]) setSelectedPageId(accounts[0].pages[0].id);
      }
      await refreshStatus();
    } catch (err) {
      setActionResult((current) => ({
        ...current,
        [action]: {
          ok: false,
          message: err instanceof Error ? err.message : "Integration action failed.",
        },
      }));
    } finally {
      setRunningAction(null);
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  return (
    <PanelShell
      eyebrow="Integrations"
      title="Prepared SEO, RSS, and social integrations"
      description="No API keys are hardcoded. These connectors now expose live readiness checks, safe dry-run actions, webhook intake, and review-first gates before anything publishes."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/35 p-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Connector runtime</p>
          <p className="mt-1 text-sm text-slate-300">
            Last checked:{" "}
            {runtimeStatus?.generatedAt ? new Date(runtimeStatus.generatedAt).toLocaleString() : "not checked yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refreshStatus()}
          disabled={loadingStatus}
          className="rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingStatus ? "Checking..." : "Check status"}
        </button>
      </div>
      <div id="integrations" className="grid gap-4">
        {integrationRequirements.map((integration) => {
          const vendorKey = vendorKeyFor(integration.vendor);
          const live = runtimeStatus?.integrations.find((item) => item.vendor === vendorKey);
          const resultKeys =
            vendorKey === "arvow"
              ? ["arvow-batch"]
              : vendorKey === "blotato"
                ? ["blotato-accounts", "blotato-schedule"]
                : [];

          return (
            <article key={integration.vendor} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-white">{integration.vendor}</h3>
                  <p className="mt-1 text-sm text-slate-300">{integration.purpose}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-black",
                    live ? runtimeStatusStyles[live.state] : "border-amber-300/30 bg-amber-400/10 text-amber-100",
                  )}
                >
                  {live ? runtimeLabel(live.state) : integration.mode.replaceAll("_", " ")}
                </span>
              </div>

              {live ? (
                <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/35 p-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Row label="Mode" value={live.mode} />
                    <Row label="API call" value={live.canCallApi ? "Ready" : "Blocked"} />
                    <Row label="Publish" value={live.canPublish ? "Approval-gated" : "Review-only"} />
                  </div>
                  <p className={cn("mt-3 text-xs font-bold", live.issue ? "text-amber-100" : "text-emerald-100")}>
                    {live.issue ?? live.nextAction}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Workflow</p>
                  <ol className="mt-2 space-y-2">
                    {integration.workflow.map((step, index) => (
                      <li key={step} className="flex gap-2 text-sm leading-6 text-slate-300">
                        <span className="font-black text-blue-200">{index + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Environment</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(live?.env ?? integration.envVars.map((envVar) => ({ name: envVar, present: false, required: false }))).map(
                      (envVar) => (
                        <code
                          key={envVar.name}
                          className={cn(
                            "rounded-lg border px-2 py-1 text-xs",
                            envVar.present
                              ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                              : envVar.required
                                ? "border-amber-300/20 bg-amber-400/10 text-amber-100"
                                : "border-white/10 bg-slate-950/60 text-sky-100",
                          )}
                        >
                          {envVar.name}
                        </code>
                      ),
                    )}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-300">{integration.notes}</p>
                  {integration.sourceUrl !== "internal" ? (
                    <a
                      href={integration.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-blue-200 hover:text-blue-100"
                    >
                      Source documentation
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </div>

              {vendorKey !== "rss_cms" ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  {vendorKey === "arvow" ? (
                    <button
                      type="button"
                      onClick={() => runAction("arvow-batch")}
                      disabled={runningAction === "arvow-batch"}
                      className="rounded-lg bg-blue-500 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {runningAction === "arvow-batch" ? "Preparing..." : "Prepare Arvow batch"}
                    </button>
                  ) : null}
                  {vendorKey === "blotato" ? (
                    <>
                      <div className="w-full rounded-lg border border-blue-300/15 bg-blue-400/10 p-3">
                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-[0.14em] text-blue-100">
                            Approved source for Blotato dry-run
                          </span>
                          <select
                            value={selectedSource?.id ?? ""}
                            onChange={(event) => setSelectedSourceId(event.target.value)}
                            className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-blue-300"
                          >
                            {approvedSocialSources.length ? (
                              approvedSocialSources.map((source) => (
                                <option key={source.id} value={source.id}>
                                  {source.label}
                                </option>
                              ))
                            ) : (
                              <option value="">No approved social sources available</option>
                            )}
                          </select>
                        </label>
                        <p className="mt-2 text-xs font-semibold leading-5 text-blue-100/80">
                          {selectedSource
                            ? selectedSource.detail
                            : "Approve a Daily Content platform post or verified AI Asset before preparing a scheduling payload."}
                        </p>
                      </div>
                      <div className="w-full rounded-lg border border-white/10 bg-slate-950/35 p-3">
                        <div className="grid gap-3 lg:grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                              Blotato account
                            </span>
                            <select
                              value={selectedAccount?.id ?? ""}
                              onChange={(event) => {
                                const accountId = event.target.value;
                                const account = blotatoAccounts.find((item) => item.id === accountId);
                                setSelectedAccountId(accountId);
                                setSelectedPageId(account?.pages[0]?.id ?? "");
                              }}
                              className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-blue-300"
                            >
                              {blotatoAccounts.length ? (
                                blotatoAccounts.map((account) => (
                                  <option key={account.id} value={account.id}>
                                    {account.name} ({account.platform})
                                  </option>
                                ))
                              ) : (
                                <option value="">Fetch accounts to select destination</option>
                              )}
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                              Page / destination
                            </span>
                            <select
                              value={selectedPage?.id ?? ""}
                              onChange={(event) => setSelectedPageId(event.target.value)}
                              className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-blue-300"
                            >
                              {selectedAccount?.pages.length ? (
                                selectedAccount.pages.map((page) => (
                                  <option key={page.id} value={page.id}>
                                    {page.name}
                                  </option>
                                ))
                              ) : (
                                <option value="">Default account target</option>
                              )}
                            </select>
                          </label>
                        </div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
                          <label className="block">
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                              Schedule mode
                            </span>
                            <select
                              value={scheduleMode}
                              onChange={(event) => setScheduleMode(event.target.value === "specific_time" ? "specific_time" : "next_slot")}
                              className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-blue-300"
                            >
                              <option value="next_slot">Use next free slot</option>
                              <option value="specific_time">Specific time</option>
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                              Specific time
                            </span>
                            <input
                              type="datetime-local"
                              value={scheduledLocalTime}
                              disabled={scheduleMode !== "specific_time"}
                              onChange={(event) => setScheduledLocalTime(event.target.value)}
                              className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </label>
                        </div>
                        <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
                          Live scheduling still requires `SOCIAL_PUBLISHING_MODE=live`, a connected account, and persisted approval from the selected source.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => runAction("blotato-accounts")}
                        disabled={runningAction === "blotato-accounts"}
                        className="rounded-lg bg-blue-500 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {runningAction === "blotato-accounts" ? "Fetching..." : "Fetch Blotato accounts"}
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction("blotato-schedule")}
                        disabled={runningAction === "blotato-schedule" || !selectedSource}
                        className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-white transition hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {runningAction === "blotato-schedule" ? "Preparing..." : "Dry-run approved payload"}
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}

              {resultKeys.map((key) => {
                const result = actionResult[key];
                if (!result) return null;
                return (
                  <div
                    key={key}
                    className={cn(
                      "mt-3 rounded-lg border px-3 py-2 text-xs font-bold",
                      result.ok
                        ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                        : "border-amber-300/20 bg-amber-400/10 text-amber-100",
                    )}
                  >
                    {result.message ?? (result.ok ? "Action completed." : "Action needs review.")}
                    {typeof result.items?.length === "number" ? ` Accounts: ${result.items.length}.` : ""}
                    {result.dryRun ? " Dry run only." : ""}
                  </div>
                );
              })}
            </article>
          );
        })}
      </div>
    </PanelShell>
  );
}

function buildBlotatoScheduleBody(
  source: ApprovedSocialSource | null,
  options: {
    accountId?: string;
    pageId?: string;
    scheduledLocalTime?: string;
    useNextFreeSlot: boolean;
  },
) {
  const scheduledTime = options.useNextFreeSlot ? undefined : toIsoDateTime(options.scheduledLocalTime);
  const base = {
    dryRun: true,
    useNextFreeSlot: options.useNextFreeSlot || !scheduledTime,
    accountId: options.accountId,
    pageId: options.pageId,
    platform: source?.platform ?? "linkedin",
    text: source?.text || "Approved HomeReach social content prepared for review-first scheduling.",
    scheduledTime,
  };

  if (!source) return base;
  if (source.type === "daily_video_platform_post") {
    return {
      ...base,
      dailyVideoId: source.dailyVideoId,
      platformPostId: source.platformPostId,
    };
  }

  return {
    ...base,
    aiOutputId: source.aiOutputId,
  };
}

function normalizeBlotatoAccount(value: unknown): BlotatoAccount | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = stringValue(record.id) || stringValue(record.accountId) || stringValue(record._id);
  if (!id) return null;
  const name = stringValue(record.name) || stringValue(record.username) || stringValue(record.label) || "Blotato account";
  const platform = stringValue(record.platform) || stringValue(record.type) || "social";
  const rawPages = Array.isArray(record.pages) ? record.pages : Array.isArray(record.targets) ? record.targets : [];
  const pages = rawPages
    .map((page) => {
      if (!page || typeof page !== "object") return null;
      const pageRecord = page as Record<string, unknown>;
      const pageId = stringValue(pageRecord.id) || stringValue(pageRecord.pageId) || stringValue(pageRecord.targetId);
      if (!pageId) return null;
      return {
        id: pageId,
        name: stringValue(pageRecord.name) || stringValue(pageRecord.title) || stringValue(pageRecord.handle) || "Default page",
      };
    })
    .filter((page): page is { id: string; name: string } => Boolean(page));

  return { id, name, platform, pages };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function toIsoDateTime(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function CtaAuditPanel() {
  return (
    <PanelShell
      eyebrow="CTA Audit"
      title="Revenue-critical buttons and handoffs"
      description="This is the starting audit table for high-priority CTA QA. It tracks expected behavior, actual connection, status, priority, and revenue impact."
    >
      <div id="cta-audit" className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="bg-[#0d1a2a] text-xs uppercase tracking-[0.14em] text-slate-400">
            <tr>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Expected behavior</th>
              <th className="px-4 py-3">Connection</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {ctaAuditBlueprint.map((item) => (
              <tr key={`${item.location}-${item.label}`} className="bg-white/[0.025] align-top">
                <td className="px-4 py-4 font-bold text-white">{item.location}</td>
                <td className="px-4 py-4 text-slate-200">{item.label}</td>
                <td className="px-4 py-4 text-slate-300">{item.expectedBehavior}</td>
                <td className="px-4 py-4 font-mono text-xs text-sky-200">{item.currentConnection}</td>
                <td className="px-4 py-4 text-xs font-bold uppercase tracking-[0.1em] text-slate-300">
                  {item.status.replaceAll("_", " ")}
                </td>
                <td className="px-4 py-4">
                  <span className={cn("rounded-full border px-3 py-1 text-xs font-black", priorityStyles[item.revenueImpact])}>
                    {item.revenueImpact}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelShell>
  );
}

function RevenuePathPanel() {
  return (
    <PanelShell
      eyebrow="Revenue QA"
      title="Revenue path test plan"
      description="A feature is not considered launch-ready until this journey passes from content discovery through intake, approval, payment, dashboard visibility, follow-up, and reporting."
    >
      <div id="revenue-path" className="space-y-3">
        {revenuePathTest.map((step, index) => (
          <div key={step.step} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 lg:grid-cols-[52px_1fr_1fr]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-black text-white">
              {index + 1}
            </div>
            <div>
              <h3 className="font-black text-white">{step.step}</h3>
              <p className="mt-1 text-sm text-slate-400">{step.system}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">{step.expectedSignal}</p>
              <p className="mt-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-100">
                {step.guardrail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function AgentsPanel() {
  return (
    <PanelShell
      eyebrow="AI Workforce"
      title="Internal agent structure"
      description="These are documented orchestration roles. They do not auto-publish, auto-charge, or overwrite production systems."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {agentDefinitions.map((agent) => (
          <article key={agent.name} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 h-5 w-5 shrink-0 text-blue-200" />
              <div>
                <h3 className="font-black text-white">{agent.name}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-300">{agent.job}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <MiniList title="Inputs" items={agent.inputs} />
              <MiniList title="Outputs" items={agent.outputs} />
              <MiniList title="Guardrails" items={agent.guardrails} />
            </div>
          </article>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Creative standards</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {creativeStandards.map((standard) => (
            <div key={standard.name} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <p className="font-black text-white">{standard.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {standard.rules.map((rule) => (
                  <span key={rule} className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-slate-200">
                    {rule}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PanelShell>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-xs leading-5 text-slate-300">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
