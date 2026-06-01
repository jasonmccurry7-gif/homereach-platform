import Link from "next/link";
import {
  ArrowRight,
  Bot,
  ClipboardCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { loadAiWorkforceCommandCenter } from "@/lib/ai-workforce/repository";
import { getAiGrowthOsSnapshot } from "@/lib/ai-growth-os/sample-data";

export const dynamic = "force-dynamic";

export default async function AdminAiGrowthOsPage() {
  const snapshot = getAiGrowthOsSnapshot();
  const workforce = await loadAiWorkforceCommandCenter();
  const growthTasks = workforce.tasks
    .filter((task) => task.workflowName === "AI Local Growth OS")
    .slice(0, 6);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 pb-24 text-white lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-slate-950/30 lg:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">AI Growth OS</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Supervise the local growth operating system.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                This admin view connects AI Web Assistant, Local Visibility, Social Content, Review, Campaign, and
                follow-up work without creating a duplicate publishing or messaging system.
              </p>
            </div>
            <Link
              href="/growth-center"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
            >
              Open Client Growth Center
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {snapshot.metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
              <p className="mt-4 text-4xl font-black text-white">{metric.value}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{metric.detail}</p>
            </div>
          ))}
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Approval queues</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Keep public actions controlled.</h2>
              </div>
              <ShieldCheck className="h-6 w-6 text-emerald-300" />
            </div>
            <div className="mt-4 grid gap-3">
              {[
                { title: "Content Review", body: "Approve posts, Google profile drafts, campaign copy, and Canva handoffs.", href: "/admin/content-review" },
                { title: "Daily Content", body: "Generate and review platform content packets without auto-publishing.", href: "/admin/daily-content" },
                { title: "AI Web Assistant", body: "Review assistants, setup requests, and lead capture readiness.", href: "/admin/ai-web-assistant" },
                { title: "Local Visibility", body: "Review visibility scans and reputation opportunities.", href: "/admin/local-visibility" },
              ].map(({ title, body, href }) => (
                <Link key={title} href={href} className="rounded-lg border border-white/10 bg-slate-950/60 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-300/10">
                  <p className="font-black text-white">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
                  <span className="mt-3 inline-flex items-center text-xs font-black text-cyan-200">
                    Open queue
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Agent registry</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Growth agents mapped to existing systems.</h2>
              </div>
              <Bot className="h-6 w-6 text-cyan-200" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {snapshot.agents.map((agent) => (
                <div key={agent.name} className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-200" />
                    <p className="font-black text-white">{agent.name}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{agent.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Connected surfaces</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">Public demand in, protected execution out.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Public pages sell the outcome. Admin queues supervise generated content, captured leads, review tasks,
                and campaign handoffs.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {snapshot.connectedModules.map((module) => (
                <Link key={module.title} href={module.href} className="rounded-lg border border-white/10 bg-slate-950/60 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-300/10">
                  <p className="font-black text-white">{module.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{module.body}</p>
                  <span className="mt-3 inline-flex items-center text-xs font-black text-cyan-200">
                    {module.cta}
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Agent hardening</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Controls before autonomy.</h2>
              </div>
              <ShieldCheck className="h-6 w-6 text-emerald-300" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {snapshot.agentControls.map((control) => (
                <div key={control.title} className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-white">{control.title}</p>
                    <span className={adminControlBadge(control.status)}>{control.status.replaceAll("_", " ")}</span>
                  </div>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-200">{control.owner}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{control.guardrail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Recent manifest tasks</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Growth agent work.</h2>
              </div>
              <ClipboardCheck className="h-6 w-6 text-cyan-200" />
            </div>
            <div className="mt-4 grid gap-3">
              {growthTasks.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-sm font-semibold leading-6 text-slate-300">
                    No AI Growth OS tasks are in the manifest yet. Customer drafts will appear here after they are added
                    to the review queue.
                  </p>
                </div>
              ) : (
                growthTasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-black text-white">{task.taskId}</p>
                      <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100">
                        {task.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-cyan-100">{task.assignedAgent}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{task.expectedOutput}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["AI drafts", "Posts, replies, content, and campaigns."],
            ["Humans approve", "Public actions stay review-first."],
            ["Ledgers preserved", "No duplicate messaging or publishing system."],
            ["Revenue focus", "Leads, trust, content, and campaigns connect."],
          ].map(([title, body]) => (
            <div key={title} className="flex gap-3 rounded-lg bg-slate-950/70 p-3">
              <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <div>
                <p className="text-sm font-black text-white">{title}</p>
                <p className="mt-1 text-sm leading-6 text-emerald-50/80">{body}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function adminControlBadge(status: "active" | "needs_integration" | "review_required") {
  if (status === "active") return "rounded-full bg-emerald-300/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100";
  if (status === "needs_integration") return "rounded-full bg-cyan-300/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100";
  return "rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100";
}
