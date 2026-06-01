import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Flag,
  Gauge,
  Inbox,
  Mail,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type {
  FoundationControlTowerData,
  FoundationHealthItem,
  FoundationMetric,
  FoundationRisk,
  FoundationStatus,
} from "@/lib/control-tower/foundation";
import { DataModeBanner } from "@/components/admin/data-mode-banner";
import { cn } from "@/lib/utils";

const statusStyles: Record<FoundationStatus, string> = {
  online: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  watch: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  critical: "border-rose-400/35 bg-rose-500/10 text-rose-100",
  idle: "border-slate-500/30 bg-slate-800 text-slate-200",
};

const dotStyles: Record<FoundationStatus, string> = {
  online: "bg-emerald-300",
  watch: "bg-amber-300",
  critical: "bg-rose-300",
  idle: "bg-slate-400",
};

const severityStyles: Record<FoundationRisk["severity"], string> = {
  info: "border-slate-500/30 bg-slate-800 text-slate-200",
  low: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  medium: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  high: "border-orange-400/30 bg-orange-400/10 text-orange-100",
  critical: "border-rose-400/35 bg-rose-500/10 text-rose-100",
};

function StatusPill({ status }: { status: FoundationStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize", statusStyles[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dotStyles[status])} />
      {status}
    </span>
  );
}

function MetricCard({ metric }: { metric: FoundationMetric }) {
  const body = (
    <div className="h-full rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-300">{metric.label}</p>
        <StatusPill status={metric.status} />
      </div>
      <p className="mt-3 text-3xl font-semibold text-white">{metric.value}</p>
      <p className="mt-2 text-sm leading-5 text-slate-400">{metric.detail}</p>
    </div>
  );

  if (!metric.href) return body;
  return (
    <Link href={metric.href} className="block h-full transition hover:border-sky-300/40">
      {body}
    </Link>
  );
}

function HealthRow({ item }: { item: FoundationHealthItem }) {
  const content = (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{item.name}</p>
          <p className="mt-1 text-sm leading-5 text-slate-400">{item.detail}</p>
        </div>
        <StatusPill status={item.status} />
      </div>
      <p className="mt-3 text-sm text-slate-300">{item.action}</p>
    </div>
  );

  if (!item.href) return content;
  return (
    <Link href={item.href} className="block">
      {content}
    </Link>
  );
}

function RiskRow({ risk }: { risk: FoundationRisk }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold capitalize", severityStyles[risk.severity])}>
          {risk.severity}
        </span>
        <span className="text-sm font-semibold text-white">{risk.area}</span>
        {risk.implemented && (
          <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-2.5 py-1 text-xs font-semibold text-sky-100">
            guardrail added
          </span>
        )}
      </div>
      <p className="mt-3 text-sm leading-5 text-slate-300">{risk.finding}</p>
      <p className="mt-2 text-sm leading-5 text-slate-500">{risk.remediation}</p>
      {risk.implemented && <p className="mt-2 text-sm leading-5 text-sky-200">{risk.implemented}</p>}
    </div>
  );
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-950/80 p-5 shadow-2xl shadow-slate-950/30">
      <div className="mb-4">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/70">{eyebrow}</p>}
        <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function buildFoundationReadiness(data: FoundationControlTowerData, sourceErrorCount: number) {
  const criticalHealth = data.systemHealth.filter((entry) => entry.status === "critical").length;
  const watchHealth = data.systemHealth.filter((entry) => entry.status === "watch").length;
  const dashboardWatchHealth = data.systemHealth.filter((entry) =>
    entry.status === "watch" && entry.name !== "Executive review queue",
  ).length;
  const criticalRisks = data.securityFindings.filter((risk) => risk.severity === "critical").length;
  const highRisks = data.securityFindings.filter((risk) => risk.severity === "high").length;
  const manualApprovalPenalty = data.controls.manualApprovalMode ? 0 : 18;
  const scaleBlockerPenalty = Math.min(10, criticalRisks * 8 + highRisks * 2);
  const score = Math.max(
    35,
    Math.min(
      100,
      100 -
        criticalHealth * 14 -
        dashboardWatchHealth * 3 -
        Math.min(12, sourceErrorCount * 4) -
        scaleBlockerPenalty -
        manualApprovalPenalty,
    ),
  );
  const status: FoundationStatus =
    criticalHealth > 0 || criticalRisks > 0 || !data.controls.manualApprovalMode
      ? "critical"
      : watchHealth > 0 || highRisks > 0 || sourceErrorCount > 0
        ? "watch"
        : "online";
  const label =
    status === "critical"
      ? "Blocked before scale"
      : status === "watch"
        ? "Operational with scale review"
        : "Approval-gated and clear";
  const blockers = [
    criticalHealth > 0 ? `${criticalHealth} system health item${criticalHealth === 1 ? "" : "s"} are critical.` : null,
    criticalRisks > 0 ? `${criticalRisks} critical risk${criticalRisks === 1 ? "" : "s"} require owner action.` : null,
    highRisks > 0 ? `${highRisks} scale blocker${highRisks === 1 ? "" : "s"} remain before high-volume outreach or automation.` : null,
    sourceErrorCount > 0 ? `${sourceErrorCount} source${sourceErrorCount === 1 ? "" : "s"} did not return data in this environment.` : null,
    data.controls.manualApprovalMode ? "Manual approval mode is on; AI and outbound actions stay review-first." : "Manual approval mode is off; outbound and high-risk automation should stay blocked.",
  ].filter((value): value is string => Boolean(value));
  const actions = [
    !data.controls.manualApprovalMode
      ? {
          label: "Turn on manual approval",
          detail: "Required before campaign-scale outbound, AI execution, political publishing, payment changes, or bid submission.",
          href: "/admin/revenue-operations",
          status: "Required",
        }
      : {
          label: "Manual approval is active",
          detail: "The highest-risk automation gate is now in the safe review-first state.",
          href: "/admin/revenue-operations",
          status: "Done",
        },
    criticalHealth > 0
      ? {
          label: "Fix critical system health",
          detail: "Open the failing connector or provider panel and resolve the critical runtime issue before scaling.",
          href: "/admin/email-infrastructure",
          status: "Required",
        }
      : {
          label: "No critical health failures",
          detail: "The dashboard is not reporting a critical system-health failure in this snapshot.",
          href: "/admin/control-center",
          status: "Clear",
        },
    highRisks > 0 || criticalRisks > 0
      ? {
          label: "Resolve scale blockers",
          detail: "Provider/DNS/sender verification can still block high-volume outreach even when the dashboard is operational.",
          href: "/admin/email-infrastructure",
          status: "Needs verification",
        }
      : {
          label: "No high-risk scale blockers",
          detail: "No critical/high provider or security blockers are surfaced in this snapshot.",
          href: "/admin/control-center",
          status: "Clear",
        },
    sourceErrorCount > 0
      ? {
          label: "Repair source gaps",
          detail: "A source table or view failed to return data; fix before trusting zero-count metrics.",
          href: "/admin/control-center",
          status: "Needs review",
        }
      : {
          label: "All readiness sources responded",
          detail: "Control Tower data sources returned successfully for this snapshot.",
          href: "/admin/control-center",
          status: "Clear",
        },
  ];

  return {
    score,
    status,
    label,
    detail: "This score measures the Control Tower dashboard, safety gates, and observable data flow. Scale authority still depends on sender, webhook, DNS, and provider verification.",
    blockers: blockers.length ? blockers.slice(0, 5) : ["No critical readiness blockers surfaced in the current Control Tower snapshot."],
    actions,
    counts: {
      criticalHealth,
      watchHealth,
      criticalRisks,
    },
  };
}

function buildSurfaceMap(readinessStatus: FoundationStatus) {
  return [
    {
      label: "HomeReach OS",
      role: "Primary daily command layer",
      href: "/admin/os",
      detail: "Executive operating shell for revenue, leads, operations, communications, product lines, and next best actions.",
    },
    {
      label: "Foundation Control Tower",
      role: connectorTruthLabel(readinessStatus),
      href: "/admin/control-center",
      detail: "Safety, provider readiness, approval mode, feature flags, audit logs, daily brief, and source gaps.",
    },
    {
      label: "AI Workforce",
      role: "Task manifest and approval workbench",
      href: "/admin/agents",
      detail: "Agent profiles, tasks, prompt chains, AI outputs, reviews, activity ledger, and human approval locks.",
    },
    {
      label: "SEO Success Module",
      role: "Authority and measurement readiness",
      href: "/admin/marketing/seo-command-center",
      detail: "SEO authority inventory, page opportunities, connector-gated performance labels, and review-first SEO actions.",
    },
  ];
}

function connectorTruthLabel(status: FoundationStatus) {
  switch (status) {
    case "online":
      return "Verified ready";
    case "watch":
      return "Needs verification";
    case "critical":
      return "Blocked";
    case "idle":
      return "Intentionally paused";
  }
}

function ReadinessCount({
  label,
  status,
  value,
}: {
  label: string;
  status: FoundationStatus;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-300">{label}</p>
        <span className={cn("h-2 w-2 rounded-full", dotStyles[status])} />
      </div>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{connectorTruthLabel(status)}</p>
    </div>
  );
}

export function FoundationControlTower({ data }: { data: FoundationControlTowerData }) {
  const criticalRisks = data.securityFindings.filter((risk) => risk.severity === "critical").length;
  const highRisks = data.securityFindings.filter((risk) => risk.severity === "high").length;
  const sourceErrorCount = Object.keys(data.sourceErrors).length;
  const readiness = buildFoundationReadiness(data, sourceErrorCount);
  const connectorRows = data.systemHealth.filter((entry) =>
    ["Postmark", "Twilio", "Stripe", "Supabase", "Vercel deployment", "Webhook health"].includes(entry.name),
  );

  return (
    <div className="bg-[#07111f] px-4 py-5 text-white md:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-xl border border-sky-300/20 bg-gradient-to-br from-slate-900 via-slate-950 to-[#07111f] p-5 shadow-2xl shadow-slate-950/50">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-xs font-semibold text-sky-100">
                  <Gauge className="h-3.5 w-3.5" />
                  Foundation + Control Tower
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-300">
                  Generated {new Date(data.generatedAt).toLocaleString()}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
                HomeReach readiness and safety control tower
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Central visibility for communications, approvals, safety controls, provider health, audit events, and scaling readiness.
                The /admin executive shell remains the primary operating home; this tower explains what is safe, blocked, paused, or connector-gated.
              </p>
            </div>
            <div className="grid min-w-72 grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-medium text-slate-400">Critical risks</p>
                <p className="mt-2 text-3xl font-semibold text-rose-100">{criticalRisks}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-medium text-slate-400">High risks</p>
                <p className="mt-2 text-3xl font-semibold text-orange-100">{highRisks}</p>
              </div>
            </div>
          </div>
        </div>

        <DataModeBanner
          mode={sourceErrorCount > 0 ? "partial" : "live"}
          title={sourceErrorCount > 0 ? "Control Tower is using partial live readiness." : "Control Tower readiness is loading from live sources."}
          detail={
            sourceErrorCount > 0
              ? "One or more readiness sources did not respond, so this page is live but incomplete. Treat missing sources as blockers before scaling automation."
              : "Provider health, feature flags, audit events, communications, security findings, and readiness metrics are coming from the configured runtime and database."
          }
          items={[
            `${sourceErrorCount} source gap${sourceErrorCount === 1 ? "" : "s"}`,
            `${criticalRisks} critical risk${criticalRisks === 1 ? "" : "s"}`,
            `${highRisks} high risk${highRisks === 1 ? "" : "s"}`,
          ]}
        />

        <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
          <Section title="Readiness Snapshot" eyebrow="Truth state">
            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className={cn("rounded-lg border p-4", statusStyles[readiness.status])}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-75">Dashboard readiness</p>
                    <p className="mt-2 text-5xl font-semibold text-white">{readiness.score}</p>
                  </div>
                  <StatusPill status={readiness.status} />
                </div>
                <p className="mt-3 text-sm font-semibold text-white">{readiness.label}</p>
                <p className="mt-2 text-xs leading-5 opacity-80">{readiness.detail}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadinessCount label="Critical health" value={readiness.counts.criticalHealth} status={readiness.counts.criticalHealth > 0 ? "critical" : "online"} />
                <ReadinessCount label="Watch items" value={readiness.counts.watchHealth} status={readiness.counts.watchHealth > 0 ? "watch" : "online"} />
                <ReadinessCount label="Critical risks" value={readiness.counts.criticalRisks} status={readiness.counts.criticalRisks > 0 ? "critical" : "online"} />
                <ReadinessCount label="Source gaps" value={sourceErrorCount} status={sourceErrorCount > 0 ? "watch" : "online"} />
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {readiness.blockers.map((blocker) => (
                <div key={blocker} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm leading-6 text-slate-300">
                  {blocker}
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {readiness.actions.map((action) => (
                <Link key={action.label} href={action.href} className="rounded-lg border border-white/10 bg-slate-950/70 p-3 transition hover:border-sky-300/40 hover:bg-sky-300/10">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{action.label}</p>
                    <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-sky-100">
                      {action.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{action.detail}</p>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="Admin Surface Map" eyebrow="No duplicate command centers">
            <p className="mb-4 text-sm leading-6 text-slate-300">
              /admin is the single executive shell. These routes are modules with specific jobs: revenue movement, review, readiness,
              AI workforce tasks, and authority measurement. New command-center expansion is frozen unless an existing owner cannot safely hold the workflow.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {buildSurfaceMap(readiness.status).map((surface) => (
                <Link key={surface.href} href={surface.href} className="rounded-lg border border-white/10 bg-white/[0.035] p-4 transition hover:border-sky-300/40 hover:bg-sky-300/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{surface.label}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{surface.role}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-sky-200" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{surface.detail}</p>
                </Link>
              ))}
            </div>
          </Section>
        </div>

        <Section title="Connector Readiness Labels" eyebrow="Provider truth">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {connectorRows.map((entry) => (
              <div key={entry.name} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{entry.name}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {connectorTruthLabel(entry.status)}
                    </p>
                  </div>
                  <StatusPill status={entry.status} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{entry.detail}</p>
                <p className="mt-2 text-xs leading-5 text-sky-200">{entry.action}</p>
              </div>
            ))}
          </div>
        </Section>

        <div className="grid gap-4 lg:grid-cols-4">
          <Link href="/admin/email-infrastructure" className="rounded-xl border border-white/10 bg-slate-950 p-4 transition hover:border-sky-300/40">
            <Mail className="h-5 w-5 text-sky-200" />
            <p className="mt-3 text-sm font-semibold text-white">Email infrastructure</p>
            <p className="mt-1 text-sm text-slate-400">{data.communicationAudit.blockingIssues.length} blocker{data.communicationAudit.blockingIssues.length === 1 ? "" : "s"}</p>
          </Link>
          <Link href="/admin/content-review" className="rounded-xl border border-white/10 bg-slate-950 p-4 transition hover:border-sky-300/40">
            <ClipboardCheck className="h-5 w-5 text-sky-200" />
            <p className="mt-3 text-sm font-semibold text-white">Executive review queue</p>
            <p className="mt-1 text-sm text-slate-400">{data.approvalQueue[0]?.value ?? "0"} review item{data.approvalQueue[0]?.value === "1" ? "" : "s"}</p>
          </Link>
          <Link href="/admin/inbox" className="rounded-xl border border-white/10 bg-slate-950 p-4 transition hover:border-sky-300/40">
            <Inbox className="h-5 w-5 text-sky-200" />
            <p className="mt-3 text-sm font-semibold text-white">Communications hub</p>
            <p className="mt-1 text-sm text-slate-400">{data.businessHealth.find((m) => m.label === "Unread replies")?.value ?? "0"} unread</p>
          </Link>
          <Link href="/admin/control-center" className="rounded-xl border border-white/10 bg-slate-950 p-4 transition hover:border-sky-300/40">
            <Zap className="h-5 w-5 text-sky-200" />
            <p className="mt-3 text-sm font-semibold text-white">Safety controls</p>
            <p className="mt-1 text-sm text-slate-400">{data.controls.allPaused ? "Global pause on" : data.controls.manualApprovalMode ? "Approval mode on" : "Approval mode off"}</p>
          </Link>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Section title="System Health" eyebrow="Control">
            <div className="grid gap-3 md:grid-cols-2">
              {data.systemHealth.map((entry) => (
                <HealthRow key={entry.name} item={entry} />
              ))}
            </div>
          </Section>

          <Section title="Daily Executive Brief" eyebrow="5 PM ready">
            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <p className="text-sm leading-6 text-slate-300">{data.dailyBrief.summary}</p>
              <div className="mt-4 grid gap-3">
                {data.dailyBrief.priorities.slice(0, 4).map((priority) => (
                  <div key={priority} className="flex gap-3 rounded-lg border border-white/10 bg-slate-900/60 p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                    <p className="text-sm leading-5 text-slate-300">{priority}</p>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Section title="Business Health" eyebrow="What needs attention">
            <div className="grid gap-3 md:grid-cols-2">
              {data.businessHealth.map((entry) => (
                <MetricCard key={entry.label} metric={entry} />
              ))}
            </div>
          </Section>

          <Section title="Communication Health" eyebrow="Deliverability">
            <div className="grid gap-3 md:grid-cols-2">
              {data.communicationHealth.map((entry) => (
                <MetricCard key={entry.label} metric={entry} />
              ))}
            </div>
          </Section>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Section title="Agent And Approval Health" eyebrow="AI assisted, human approved">
            <div className="grid gap-3 md:grid-cols-2">
              {data.agentHealth.map((entry) => (
                <MetricCard key={entry.label} metric={entry} />
              ))}
              {data.approvalQueue.map((entry) => (
                <MetricCard key={entry.label} metric={entry} />
              ))}
            </div>
          </Section>

          <Section title="Feature Flags And Kill Switches" eyebrow="Safety registry">
            {data.featureFlags.length > 0 ? (
              <div className="grid gap-3">
                {data.featureFlags.slice(0, 8).map((flag) => (
                  <div key={flag.key} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-sky-200" />
                        <p className="font-semibold text-white">{flag.label}</p>
                      </div>
                      <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold capitalize", flag.killSwitch ? severityStyles.high : severityStyles.low)}>
                        {flag.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{flag.backingControl ?? "registry controlled"} / approval {flag.requiresApproval ? "required" : "not required"} / {flag.safetyLevel}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
                Apply migration 096 to populate the platform feature flag registry.
              </div>
            )}
          </Section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Section title="Security And Scaling Risks" eyebrow="Blockers">
            <div className="space-y-3">
              {data.securityFindings.slice(0, 8).map((risk) => (
                <RiskRow key={`${risk.area}-${risk.finding}`} risk={risk} />
              ))}
            </div>
          </Section>

          <Section title="Audit Log" eyebrow="Universal events">
            {data.auditEvents.length > 0 ? (
              <div className="space-y-3">
                {data.auditEvents.slice(0, 8).map((event) => (
                  <div key={event.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-sky-200" />
                        <p className="font-semibold text-white">{event.module} / {event.actionType}</p>
                      </div>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-300">{event.resultStatus}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{event.message || "No message recorded."}</p>
                    <p className="mt-1 text-xs text-slate-600">{new Date(event.occurredAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
                Apply migration 096, then control changes, verification sends, webhook events, and daily briefs will appear here.
              </div>
            )}
          </Section>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Section title="Architecture Audit" eyebrow="Preserved systems">
            <div className="space-y-3">
              {data.architectureAudit.map((entry) => (
                <div key={entry.title} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{entry.title}</p>
                    <StatusPill status={entry.status} />
                  </div>
                  <p className="mt-2 text-sm leading-5 text-slate-400">{entry.detail}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Implementation Order" eyebrow="Next">
            <div className="space-y-3">
              {data.nextImplementationOrder.slice(0, 7).map((entry, index) => (
                <div key={entry} className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-300/15 text-xs font-semibold text-sky-100">{index + 1}</span>
                  <p className="text-sm leading-5 text-slate-300">{entry}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Controls Snapshot" eyebrow="Runtime">
            <div className="grid gap-3">
              {[
                ["Global pause", data.controls.allPaused ? "On" : "Off", data.controls.allPaused ? "critical" : "online"],
                ["Email pause", data.controls.emailPaused ? "On" : "Off", data.controls.emailPaused ? "watch" : "online"],
                ["SMS pause", data.controls.smsPaused ? "On" : "Off", data.controls.smsPaused ? "watch" : "online"],
                ["Facebook pause", data.controls.facebookPaused ? "On" : "Off", data.controls.facebookPaused ? "watch" : "online"],
                ["Manual approval", data.controls.manualApprovalMode ? "On" : "Off", data.controls.manualApprovalMode ? "online" : "critical"],
                ["SMS live", data.controls.smsLive ? "On" : "Off", data.controls.smsLive ? "watch" : "idle"],
              ].map(([label, value, status]) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.035] p-3">
                  <p className="text-sm text-slate-300">{label}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{value}</p>
                    <span className={cn("h-2 w-2 rounded-full", dotStyles[status as FoundationStatus])} />
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <p className="text-sm text-slate-300">Email cap per sender</p>
                <p className="mt-1 text-xl font-semibold text-white">{data.controls.dailyEmailCapPerSender}/day</p>
              </div>
            </div>
          </Section>
        </div>

        {sourceErrorCount > 0 && (
          <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-100" />
              <div>
                <p className="font-semibold text-amber-50">Some sources are not queryable yet</p>
                <p className="mt-1 text-sm leading-6 text-amber-100/80">
                  This is expected before migration 096 is applied or when a legacy table is not present in this environment. The panel degrades safely and leaves existing systems untouched.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 rounded-xl border border-white/10 bg-slate-950 p-4">
          <Link href="/admin/email-infrastructure" className="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300">
            <Mail className="h-4 w-4" />
            Verify Email
          </Link>
          <Link href="/admin/revenue-operations" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-300/40">
            <Bot className="h-4 w-4" />
            Review AI Approvals
          </Link>
          <Link href="/admin/inbox" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-300/40">
            <Inbox className="h-4 w-4" />
            Open Inbox
          </Link>
          <Link href="/admin" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-300/40">
            <ShieldCheck className="h-4 w-4" />
            HomeReach OS
          </Link>
        </div>
      </div>
    </div>
  );
}
