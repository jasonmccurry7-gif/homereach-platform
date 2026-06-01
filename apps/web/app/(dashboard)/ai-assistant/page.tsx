import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Clock3,
  MessageSquareText,
  Route,
  Settings,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { getAiWebAssistantSnapshot } from "@/lib/ai-web-assistant/sample-data";

export default function CustomerAiAssistantPage() {
  const snapshot = getAiWebAssistantSnapshot();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-lg bg-slate-950 p-5 text-white shadow-sm lg:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">AI Web Assistant</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                See what the assistant handled and who needs follow-up.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Website conversations, captured leads, routing alerts, knowledge gaps, performance, and recommended
                next actions stay in one simple command center.
              </p>
            </div>
            <div className="rounded-lg border border-blue-300/20 bg-blue-300/10 p-4 text-blue-50">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-100">Next best action</p>
              <p className="mt-2 text-lg font-black">Call the urgent lead</p>
              <p className="mt-1 text-sm leading-6 text-blue-50/85">One after-hours request is marked high urgency.</p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Conversations" value={String(snapshot.metrics.conversationsHandled)} detail="Handled by assistant" icon={MessageSquareText} />
          <Metric label="Leads Captured" value={String(snapshot.metrics.leadsCaptured)} detail="Named opportunities" icon={UserRoundCheck} />
          <Metric label="Conversion Rate" value={snapshot.metrics.conversionRate} detail="Visitor to lead estimate" icon={Sparkles} />
          <Metric label="After-Hours Leads" value={String(snapshot.metrics.afterHoursLeads)} detail="Captured outside hours" icon={Clock3} />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">AI Executive Assistant</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Your site is capturing demand.</h2>
              </div>
              <Bot className="h-6 w-6 text-blue-600" />
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              I handled {snapshot.metrics.conversationsHandled} conversations, captured {snapshot.metrics.leadsCaptured} leads,
              and flagged {snapshot.metrics.followUpsNeeded} follow-ups. The most important move today is to respond to the
              high-urgency lead and approve the FAQ update for repeated pricing questions.
            </p>
            <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Revenue role</p>
              <p className="mt-2 text-sm font-bold leading-6 text-emerald-950">
                The assistant is turning anonymous website traffic into named follow-up opportunities.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Action Center</p>
            <div className="mt-4 grid gap-3">
              {snapshot.actions.map((action) => (
                <div key={action.title} className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-950">{action.title}</p>
                      <span className={urgencyBadge(action.urgency)}>{action.urgency}</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{action.detail}</p>
                  </div>
                  <button className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-700">
                    {action.cta}
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <Panel title="Conversations" icon={MessageSquareText}>
            {snapshot.conversations.map((conversation) => (
              <div key={`${conversation.visitor}-${conversation.service}`} className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-slate-950">{conversation.visitor}</p>
                  <span className={urgencyBadge(conversation.urgency)}>{conversation.urgency}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">{conversation.service} from {conversation.sourcePage}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{conversation.summary}</p>
              </div>
            ))}
          </Panel>

          <Panel title="Leads Captured" icon={UserRoundCheck}>
            {snapshot.leads.map((lead) => (
              <div key={`${lead.name}-${lead.serviceNeed}`} className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm font-black text-slate-950">{lead.name}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{lead.serviceNeed}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs font-black">
                  <span className="text-blue-700">{lead.estimatedValue}</span>
                  <span className="text-slate-500">{lead.nextAction}</span>
                </div>
              </div>
            ))}
          </Panel>

          <Panel title="AI Knowledge Base" icon={Settings}>
            <Stat label="Services" value="Needs approval" />
            <Stat label="Service areas" value="Loaded" />
            <Stat label="Hours" value="Verify" />
            <Stat label="Pricing guidance" value="Restricted" danger />
            <Stat label="Emergency rules" value="Draft ready" />
          </Panel>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <Panel title="Assistant Settings" icon={Route}>
            <Stat label="Tone" value="Helpful + direct" />
            <Stat label="Greeting" value="Approved draft" />
            <Stat label="Handoff rules" value="Needs owner" danger />
            <Stat label="Restricted topics" value="Active" />
          </Panel>
          <Panel title="Performance" icon={Sparkles}>
            <Stat label="After-hours leads" value={String(snapshot.metrics.afterHoursLeads)} />
            <Stat label="Unanswered questions" value={String(snapshot.metrics.unansweredQuestions)} danger />
            <Stat label="Common question" value="Starting price" />
            <Stat label="Recommended update" value="FAQ" />
          </Panel>
          <Panel title="Alerts" icon={AlertTriangle}>
            {snapshot.alerts.map((alert) => (
              <div key={alert.title} className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                <p className="text-sm font-black text-amber-950">{alert.title}</p>
                <p className="mt-1 text-sm leading-6 text-amber-900">{alert.detail}</p>
              </div>
            ))}
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof MessageSquareText;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <Icon className="h-5 w-5 text-blue-700" />
      </div>
      <p className="mt-4 text-4xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof MessageSquareText; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
        <Icon className="h-5 w-5 text-blue-700" />
      </div>
      <div className="mt-4 grid gap-2">{children}</div>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span className={danger ? "text-sm font-black text-amber-700" : "text-sm font-black text-slate-950"}>{value}</span>
    </div>
  );
}

function urgencyBadge(urgency: "high" | "medium" | "low") {
  if (urgency === "high") return "rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-rose-700";
  if (urgency === "medium") return "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700";
  return "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700";
}
