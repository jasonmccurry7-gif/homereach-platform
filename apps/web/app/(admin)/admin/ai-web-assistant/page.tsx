import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Code2,
  Inbox,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { getAiWebAssistantSnapshot } from "@/lib/ai-web-assistant/sample-data";
import { createServiceClient } from "@/lib/supabase/service";

type AssistantRow = {
  id: string;
  created_at: string;
  business_name: string;
  business_category: string;
  website_url: string | null;
  status: string;
  widget_enabled: boolean;
  embed_key: string;
  metadata?: {
    contactName?: string;
    email?: string;
    preferredPlan?: string;
    salesStatus?: string;
    nextAction?: string;
  } | null;
};

async function loadRecentAssistants(): Promise<{ rows: AssistantRow[]; warning: string | null }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], warning: "Supabase service credentials are not configured." };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("ai_web_assistants")
    .select("id,created_at,business_name,business_category,website_url,status,widget_enabled,embed_key,metadata")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    return { rows: [], warning: "AI Web Assistant migration is not applied yet, so assistant records are not visible." };
  }

  return { rows: (data ?? []) as AssistantRow[], warning: null };
}

export default async function AdminAiWebAssistantPage() {
  const snapshot = getAiWebAssistantSnapshot();
  const { rows, warning } = await loadRecentAssistants();

  return (
    <main className="min-h-screen bg-[#07111f] px-4 py-6 text-white lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-slate-950/20 lg:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">AI Web Assistant</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Front Desk, Lead Capture, and Routing Command Center
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Manage assistant setup requests, knowledge base items, conversation routing, lead capture, owner alerts,
                review workflows, and supervised AI actions without exposing internal controls publicly.
              </p>
            </div>
            <Link
              href="/services/ai-website-assistant"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-400"
            >
              Public Offer Page
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </section>

        {warning && (
          <div className="mt-5 flex gap-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-amber-50">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-semibold leading-6">{warning}</p>
          </div>
        )}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Assistants" value={String(rows.length)} detail="Recent demo/setup requests" icon={Bot} />
          <Metric label="Conversations" value={String(snapshot.metrics.conversationsHandled)} detail="Example handled conversations" icon={MessageSquareText} />
          <Metric label="Leads Captured" value={String(snapshot.metrics.leadsCaptured)} detail="Named opportunities created" icon={UserRoundCheck} />
          <Metric label="Follow-Ups" value={String(snapshot.metrics.followUpsNeeded)} detail="Need owner attention" icon={Inbox} />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Setup Pipeline</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Assistant demo requests</h2>
              </div>
              <ShieldCheck className="h-6 w-6 text-blue-300" />
            </div>
            <div className="mt-4 grid gap-3">
              {(rows.length > 0 ? rows : fallbackRows()).map((row) => (
                <div key={row.id} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-white">{row.business_name}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {row.business_category}
                        {row.website_url ? ` - ${row.website_url}` : ""}
                      </p>
                      {row.metadata?.contactName || row.metadata?.email ? (
                        <p className="mt-1 text-sm font-semibold text-blue-100">
                          {row.metadata?.contactName ?? "Contact"}{row.metadata?.email ? ` - ${row.metadata.email}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-blue-400/10 px-2.5 py-1 text-xs font-black text-blue-100 ring-1 ring-blue-300/20">
                      {row.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <MiniStatus label="Widget" value={row.widget_enabled ? "Enabled" : "Off"} />
                    <MiniStatus label="Plan" value={row.metadata?.preferredPlan ?? "Not selected"} />
                    <MiniStatus label="Next action" value={row.metadata?.nextAction ?? "Review setup"} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">AI agents</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Supervised operating model</h2>
            <div className="mt-4 grid gap-3">
              {snapshot.agents.map((agent) => (
                <div key={agent.name} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
                    <div>
                      <p className="font-black text-white">{agent.name}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{agent.role}</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-200">
                        Approval required for outbound or public actions
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <Panel title="Conversation Visibility" icon={MessageSquareText}>
            {snapshot.conversations.map((conversation) => (
              <div key={`${conversation.visitor}-${conversation.service}`} className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                <p className="text-sm font-black text-white">{conversation.visitor}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-blue-200">{conversation.status}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{conversation.summary}</p>
              </div>
            ))}
          </Panel>
          <Panel title="Approval Gates" icon={ShieldCheck}>
            {[
              "Outbound texts and emails",
              "Appointment confirmation",
              "Pricing promises or discounts",
              "Public review replies",
              "Listing or Google profile changes",
            ].map((item) => (
              <div key={item} className="flex gap-2 text-sm font-semibold leading-6 text-slate-200">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                {item}
              </div>
            ))}
          </Panel>
          <Panel title="Integration Status" icon={Code2}>
            <MiniStatus label="Live widget" value="Pending domain approval" />
            <MiniStatus label="SMS follow-up" value="Wait for Twilio A2P" />
            <MiniStatus label="Email follow-up" value="Postmark-ready after template approval" />
            <MiniStatus label="Calendar booking" value="Needs calendar rules" />
            <MiniStatus label="Reputation upsell" value="Connected to Local Visibility" />
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
  icon: typeof Bot;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <Icon className="h-5 w-5 text-blue-300" />
      </div>
      <p className="mt-4 text-4xl font-black">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Bot; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black tracking-tight text-white">{title}</h2>
        <Icon className="h-5 w-5 text-blue-300" />
      </div>
      <div className="mt-4 grid gap-2">{children}</div>
    </div>
  );
}

function MiniStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.05] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function fallbackRows(): AssistantRow[] {
  return [
    {
      id: "demo-ai-web-assistant",
      created_at: new Date().toISOString(),
      business_name: "Demo assistant appears here after migration",
      business_category: "Home services",
      website_url: "https://example.com",
      status: "demo_requested",
      widget_enabled: false,
      embed_key: "demo_key_pending",
      metadata: {
        contactName: "Demo Contact",
        email: "demo@example.com",
        preferredPlan: "Starter Assistant",
        nextAction: "Review setup",
      },
    },
  ];
}
