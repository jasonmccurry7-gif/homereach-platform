import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  Reply,
  Send,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import type {
  DailyRevenueCommandCenterData,
  RevenueHealthGuardrail,
  RevenueMetric,
  RevenuePipelineStageSummary,
  RevenuePriorityAction,
  RevenueTeamPerformance,
  RevenueTone,
} from "@/lib/revenue-os/types";
import { formatRevenueMoney, formatRevenuePercent } from "@/lib/revenue-os/snapshot";
import { cn } from "@/lib/utils";

type Props = {
  data: DailyRevenueCommandCenterData;
};

const metricIcons = [Mail, Send, Reply, TrendingUp, CalendarDays, Workflow, Target, CheckCircle2, Zap];

function toneClasses(tone: RevenueTone) {
  if (tone === "good") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-50";
  if (tone === "danger") return "border-rose-300/30 bg-rose-300/10 text-rose-50";
  if (tone === "watch") return "border-amber-300/30 bg-amber-300/10 text-amber-50";
  return "border-white/10 bg-white/[0.045] text-slate-100";
}

function toneDot(tone: RevenueTone) {
  if (tone === "good") return "bg-emerald-300";
  if (tone === "danger") return "bg-rose-300";
  if (tone === "watch") return "bg-amber-300";
  return "bg-slate-400";
}

function topPipelineStages(stages: RevenuePipelineStageSummary[]) {
  return stages.filter((stage) => stage.count > 0 || stage.attentionCount > 0);
}

function totalPipelineValue(stages: RevenuePipelineStageSummary[]) {
  return stages.reduce((total, stage) => total + stage.estimatedValueCents, 0);
}

function totalPipelineCount(stages: RevenuePipelineStageSummary[]) {
  return stages.reduce((total, stage) => total + stage.count, 0);
}

function updatedAt(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Now";
  }
}

export function DailyRevenueCommandCenter({ data }: Props) {
  const urgentActions = data.priorityActions.filter((action) => action.tone === "danger").length;
  const pipelineValue = totalPipelineValue(data.pipeline);
  const pipelineCount = totalPipelineCount(data.pipeline);
  const activeStages = topPipelineStages(data.pipeline);
  const primaryAction = data.priorityActions[0];
  const bestSender = [...data.teamPerformance].sort((a, b) => b.responseRate - a.responseRate)[0];

  return (
    <main className="min-h-screen bg-[#06111d] text-white">
      <section className="border-b border-white/10 bg-[linear-gradient(135deg,#06111d_0%,#0a1c34_52%,#12313a_100%)]">
        <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-6 px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-5xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                <Zap className="h-3.5 w-3.5" />
                Daily Revenue Command Center
              </div>
              <h1 className="max-w-4xl text-3xl font-black tracking-tight text-white sm:text-5xl">
                See the day, work the money, protect every follow-up.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 sm:text-base">
                {urgentActions > 0
                  ? `${urgentActions} urgent revenue action${urgentActions === 1 ? "" : "s"} need attention before new outbound volume scales.`
                  : primaryAction
                    ? `${primaryAction.organizationName} is the next best revenue action.`
                    : "No urgent revenue blocker is currently surfaced."}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:w-[540px]">
              <ExecutiveLink href="/admin/revenue-operations" icon={ShieldCheck} label="Approvals" detail="Review send gates" />
              <ExecutiveLink href="/admin/inbox" icon={Reply} label="Replies" detail="Work inbound first" />
              <ExecutiveLink href="/admin/daily-outreach" icon={Send} label="Outreach" detail="Today and tomorrow" />
              <ExecutiveLink href="/admin/sales-engine" icon={Target} label="Pipeline" detail="Lead execution" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-9">
            {data.todayMetrics.map((metric, index) => {
              const Icon = metricIcons[index] ?? TrendingUp;
              return <MetricTile key={metric.key} metric={metric} icon={Icon} />;
            })}
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-[1540px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
          <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20">
            <SectionHeader
              eyebrow="Priority Actions"
              title="Work This First"
              detail={`${data.priorityActions.length} visible next action${data.priorityActions.length === 1 ? "" : "s"}`}
              icon={Clock3}
            />
            <div className="mt-4 grid gap-3">
              {data.priorityActions.length === 0 ? (
                <EmptyState label="No urgent revenue actions" detail="The command layer did not find overdue replies, follow-ups, or recovery tasks." />
              ) : (
                data.priorityActions.slice(0, 7).map((action) => <PriorityActionRow key={action.id} action={action} />)
              )}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20">
            <SectionHeader
              eyebrow="AI Decision Engine"
              title="Recommended Focus"
              detail={bestSender ? `${bestSender.name} response rate: ${formatRevenuePercent(bestSender.responseRate)}` : "No sender response data yet"}
              icon={Bot}
            />
            <div className="mt-4 grid gap-3">
              {data.strategyRecommendations.slice(0, 4).map((item) => (
                <article key={item.id} className={cn("rounded-md border p-3", toneClasses(item.tone))}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-black text-white">{item.title}</h3>
                    <span className="shrink-0 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold text-white">
                      {item.confidence}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-slate-100/90">{item.detail}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">{item.recommendation}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20">
          <SectionHeader
            eyebrow="Master Pipeline"
            title={`${pipelineCount} Opportunities`}
            detail={`${formatRevenueMoney(pipelineValue)} estimated active and historical value across primary stages`}
            icon={Workflow}
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {activeStages.length === 0 ? (
              <EmptyState label="No pipeline items yet" detail="New opportunities will appear here after migration and ingestion." />
            ) : (
              activeStages.map((stage) => <PipelineStageTile key={stage.stage} stage={stage} />)
            )}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-4">
          {data.teamPerformance.map((member) => <TeamTile key={member.senderKey} member={member} />)}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20">
            <SectionHeader
              eyebrow="Campaign Intelligence"
              title="What Is Converting"
              detail={`${data.campaignPerformance.length} campaign lane${data.campaignPerformance.length === 1 ? "" : "s"} measured`}
              icon={TrendingUp}
            />
            <div className="mt-4 grid gap-3">
              {data.campaignPerformance.length === 0 ? (
                <EmptyState label="No campaign data yet" detail="Performance appears after sends, replies, and campaign events are captured." />
              ) : (
                data.campaignPerformance.map((campaign) => (
                  <article key={campaign.id} className={cn("rounded-md border p-3", toneClasses(campaign.tone))}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-white">{campaign.label}</h3>
                        <p className="mt-1 text-xs text-slate-200">{campaign.bestSubject}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-white">{formatRevenuePercent(campaign.replyRate)}</p>
                        <p className="text-xs uppercase tracking-[0.14em] text-white/60">reply rate</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-5 text-slate-100/90">{campaign.nextAction}</p>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20">
            <SectionHeader
              eyebrow="Tomorrow Queue"
              title="Next Revenue Moves"
              detail={`${data.tomorrowQueue.length} scheduled or suggested item${data.tomorrowQueue.length === 1 ? "" : "s"}`}
              icon={CalendarDays}
            />
            <div className="mt-4 grid gap-3">
              {data.tomorrowQueue.length === 0 ? (
                <EmptyState label="Tomorrow is clear" detail="No scheduled or suggested outreach is currently queued." />
              ) : (
                data.tomorrowQueue.slice(0, 7).map((item) => (
                  <Link key={item.id} href={item.href} className="group rounded-md border border-white/10 bg-black/20 p-3 transition hover:border-cyan-300/40 hover:bg-cyan-300/10">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-white">{item.title}</h3>
                        <p className="mt-1 text-xs text-slate-300">{item.audience} / {item.owner} / {item.readiness}</p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-cyan-100" />
                    </div>
                    <p className="mt-2 text-sm leading-5 text-slate-100/85">{item.angle}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20">
          <SectionHeader
            eyebrow="Safeguards"
            title="Deliverability And Control"
            detail={`Updated ${updatedAt(data.generatedAt)}`}
            icon={ShieldCheck}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {data.guardrails.map((guardrail) => <GuardrailTile key={guardrail.label} guardrail={guardrail} />)}
          </div>
          {data.sourceErrors.length > 0 ? (
            <div className="mt-4 rounded-md border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-5 text-amber-50">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">Partial data warning</p>
                  <p className="mt-1 text-amber-50/85">{data.sourceErrors[0]}</p>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function ExecutiveLink({ href, icon: Icon, label, detail }: { href: string; icon: typeof ShieldCheck; label: string; detail: string }) {
  return (
    <Link href={href} className="group flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.06] px-3 py-3 transition hover:border-cyan-300/35 hover:bg-cyan-300/10">
      <span className="flex min-w-0 items-center gap-3">
        <span className="rounded-md border border-white/10 bg-black/20 p-2 text-cyan-100">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-white">{label}</span>
          <span className="block truncate text-xs text-slate-300">{detail}</span>
        </span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-cyan-100" />
    </Link>
  );
}

function MetricTile({ metric, icon: Icon }: { metric: RevenueMetric; icon: typeof Mail }) {
  return (
    <article className={cn("rounded-lg border p-3", toneClasses(metric.tone))}>
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-4 w-4 text-white/80" />
        <span className={cn("h-2 w-2 rounded-full", toneDot(metric.tone))} />
      </div>
      <p className="mt-4 text-2xl font-black tracking-tight text-white">{metric.value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-white/65">{metric.label}</p>
      <p className="mt-2 text-xs leading-4 text-slate-100/80">{metric.detail}</p>
    </article>
  );
}

function SectionHeader({ eyebrow, title, detail, icon: Icon }: { eyebrow: string; title: string; detail: string; icon: typeof ShieldCheck }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-300">{detail}</p>
      </div>
      <span className="hidden rounded-md border border-white/10 bg-black/20 p-2 text-cyan-100 sm:inline-flex">
        <Icon className="h-5 w-5" />
      </span>
    </div>
  );
}

function PriorityActionRow({ action }: { action: RevenuePriorityAction }) {
  return (
    <Link href={action.href} className={cn("group block rounded-md border p-3 transition hover:border-cyan-300/40 hover:bg-cyan-300/10", toneClasses(action.tone))}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", toneDot(action.tone))} />
            <h3 className="text-base font-black text-white">{action.title}</h3>
            <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold text-white">{action.score}</span>
          </div>
          <p className="mt-1 text-sm text-slate-100">{action.organizationName} / {action.leadName}</p>
          <p className="mt-1 text-xs text-slate-300">{action.stage} / {action.owner} / {action.channel} / {action.dueLabel}</p>
        </div>
        <div className="flex items-center gap-3 lg:max-w-[48%]">
          <p className="text-sm leading-5 text-slate-100/90">{action.nextAction}</p>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-cyan-100" />
        </div>
      </div>
    </Link>
  );
}

function PipelineStageTile({ stage }: { stage: RevenuePipelineStageSummary }) {
  const tone: RevenueTone = stage.attentionCount > 0 ? "watch" : stage.count > 0 ? "neutral" : "good";
  return (
    <article className={cn("rounded-md border p-3", toneClasses(tone))}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-black text-white">{stage.stage}</h3>
        <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs font-black text-white">{stage.count}</span>
      </div>
      <p className="mt-3 text-lg font-black text-white">{formatRevenueMoney(stage.estimatedValueCents)}</p>
      <p className="mt-1 text-xs text-slate-200">{stage.attentionCount} needing attention</p>
    </article>
  );
}

function TeamTile({ member }: { member: RevenueTeamPerformance }) {
  return (
    <article className={cn("rounded-lg border p-4 shadow-2xl shadow-black/20", toneClasses(member.tone))}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-white">{member.name}</p>
          <p className="mt-1 text-xs text-slate-200">{member.email}</p>
        </div>
        <Users className="h-5 w-5 text-white/75" />
      </div>
      <p className="mt-3 text-sm leading-5 text-slate-100/85">{member.role}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Sent" value={String(member.emailsSent)} />
        <MiniStat label="Replies" value={String(member.repliesReceived)} />
        <MiniStat label="Rate" value={formatRevenuePercent(member.responseRate)} />
      </div>
      <p className="mt-4 text-sm leading-5 text-slate-100/90">{member.nextAction}</p>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-2 py-2">
      <p className="text-base font-black text-white">{value}</p>
      <p className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-white/55">{label}</p>
    </div>
  );
}

function GuardrailTile({ guardrail }: { guardrail: RevenueHealthGuardrail }) {
  return (
    <article className={cn("rounded-md border p-3", toneClasses(guardrail.tone))}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-white">{guardrail.label}</h3>
        <span className={cn("h-2 w-2 rounded-full", toneDot(guardrail.tone))} />
      </div>
      <p className="mt-2 text-lg font-black text-white">{guardrail.value}</p>
      <p className="mt-1 text-xs leading-4 text-slate-100/85">{guardrail.detail}</p>
    </article>
  );
}

function EmptyState({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-4 text-sm text-slate-200">
      <p className="font-bold text-white">{label}</p>
      <p className="mt-1 leading-5">{detail}</p>
    </div>
  );
}
