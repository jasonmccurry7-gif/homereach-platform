import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  Clock3,
  Inbox,
  Library,
  MessageCircle,
  PlugZap,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { loadApprovalSpine } from "@/lib/approvals/spine";
import type { ApprovalSpineItem, ApprovalSpineSummary } from "@/lib/approvals/types";
import type { GrowthIntegrationStatus } from "@/lib/growth-engine/integrations";
import { ApprovalLedgerSyncButton } from "./approval-ledger-sync-button";
import { ContentReviewActions } from "./content-review-actions";

export const metadata = {
  title: "Executive Review Queue - HomeReach Admin",
};

export default async function ContentReviewPage() {
  const data = await loadApprovalSpine();
  const queue = data.queue;
  const laneSummary = data.summary;
  const highPriority = laneSummary.highPriority;
  const publishReady = laneSummary.publishReady;

  return (
    <main className="mx-auto max-w-7xl space-y-5 pb-24 lg:pb-0">
      <section className="overflow-hidden rounded-xl bg-slate-950 text-white shadow-xl">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
              <ShieldCheck className="h-4 w-4" />
              Executive Review Layer
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
              One executive queue for revenue, political, procurement, creative, and GovCon approvals.
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-300 sm:text-base">
              Review approval-sensitive work without creating duplicate dashboards or sending, publishing, submitting, charging, or committing spend from this page.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Needs Action" value={laneSummary.total.toString()} />
            <MetricCard label="High Priority" value={highPriority.toString()} />
            <MetricCard label="Revenue Drafts" value={laneSummary.sourceCounts.revenue.toString()} />
            <MetricCard label="Procurement" value={laneSummary.sourceCounts.procurement.toString()} />
            <MetricCard label="GovCon" value={laneSummary.sourceCounts.govContracts.toString()} />
            <MetricCard label="Publish Ready" value={`${publishReady}/${data.integrationStatuses.length}`} />
          </div>
        </div>
      </section>

      <MobileCommandBar />

      <section className="grid gap-3 md:grid-cols-5">
        <ShortcutCard icon={<MessageCircle className="h-5 w-5" />} title="Revenue" detail="Approve one-to-one drafts before any send." href="/admin/revenue-operations" />
        <ShortcutCard icon={<ShieldCheck className="h-5 w-5" />} title="Political" detail="Review campaign mail and outreach gates." href="/admin/political" />
        <ShortcutCard icon={<Library className="h-5 w-5" />} title="Procurement" detail="Review savings and invoice actions." href="/admin/procurement" />
        <ShortcutCard icon={<Sparkles className="h-5 w-5" />} title="Creative" detail="Approve generated assets before use." href="/admin/creative-studio" />
        <ShortcutCard icon={<Clapperboard className="h-5 w-5" />} title="Gov Contracts" detail="Route bid decisions through the approval owner." href="/admin/gov-contracts" />
      </section>

      <QueueIntelligencePanel summary={laneSummary} />

      <LedgerStatusPanel
        totalQueue={laneSummary.total}
        mirroredRows={data.ledgerStatus.mirroredRows}
        missingRows={data.ledgerStatus.missingRows}
        available={data.ledgerStatus.available}
        lastSyncedAt={data.ledgerStatus.lastSyncedAt}
        queueSource={data.queueSource}
      />

      <ProviderReadinessPanel statuses={data.integrationStatuses} />

      <section id="review-queue" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">Today&apos;s review queue</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Centralized executive approval stack</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
            Manual approval required
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {queue.length ? (
            queue.map((item) => <ReviewQueueCard key={`${item.source}-${item.id}`} item={item} />)
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
              <h3 className="mt-3 text-xl font-black text-slate-950">No urgent content approvals right now.</h3>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                The queue will populate from revenue, political, procurement, creative, GovCon, daily content, AI Assets, and publication records.
              </p>
            </div>
          )}
        </div>
      </section>

      {data.errors.length ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-black text-amber-950">Setup notes</p>
          <ul className="mt-2 space-y-1">
            {data.errors.map((error) => (
              <li key={error} className="text-sm font-semibold text-amber-800">{error}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function ShortcutCard({ icon, title, detail, href }: { icon: React.JSX.Element; title: string; detail: string; href: string }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">{icon}</div>
      <h2 className="mt-4 text-lg font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{detail}</p>
    </Link>
  );
}

function MobileCommandBar() {
  return (
    <nav
      aria-label="Mobile content review shortcuts"
      className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur lg:hidden"
    >
      <a href="#review-queue" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-2 text-xs font-black text-white">
        <Inbox className="h-4 w-4" />
        Queue
      </a>
      <a href="#provider-readiness" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-2 text-xs font-black text-blue-800">
        <PlugZap className="h-4 w-4" />
        Ready
      </a>
      <Link href="/admin/daily-content" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-2 text-xs font-black text-emerald-800">
        <Clapperboard className="h-4 w-4" />
        Drafts
      </Link>
    </nav>
  );
}

function QueueIntelligencePanel({ summary }: { summary: ApprovalSpineSummary }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">
            <Zap className="h-4 w-4" />
            Mobile command priority
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">What needs executive attention first</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{summary.nextFocus}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
          approval-first mode
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <LaneMetric icon={<AlertTriangle className="h-4 w-4" />} label="Blocked" value={summary.blocked} tone="red" />
        <LaneMetric icon={<ShieldCheck className="h-4 w-4" />} label="Needs Approval" value={summary.needsApproval} tone="amber" />
        <LaneMetric icon={<Send className="h-4 w-4" />} label="Ready to Send" value={summary.readyToSend} tone="emerald" />
        <LaneMetric icon={<PlugZap className="h-4 w-4" />} label="Ready to Publish" value={summary.readyToPublish} tone="blue" />
        <LaneMetric icon={<TrendingUp className="h-4 w-4" />} label="Learning Signals" value={summary.learning} tone="slate" />
      </div>
      {summary.providerBlocked > 0 ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
          {summary.providerBlocked} provider setup issue{summary.providerBlocked === 1 ? "" : "s"} need attention before external publishing can scale.
        </p>
      ) : null}
    </section>
  );
}

function LedgerStatusPanel({
  totalQueue,
  mirroredRows,
  missingRows,
  available,
  lastSyncedAt,
  queueSource,
}: {
  totalQueue: number;
  mirroredRows: number;
  missingRows: number;
  available: boolean;
  lastSyncedAt: string | null;
  queueSource: "projected" | "ledger";
}) {
  const toneClass = !available
    ? "border-amber-200 bg-amber-50 text-amber-900"
    : missingRows > 0
      ? "border-blue-200 bg-blue-50 text-blue-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-900";
  const syncLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "not synced yet";

  return (
    <section className={`rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em]">Canonical approval ledger</p>
          <p className="mt-1 text-sm font-semibold leading-6">
            {available
              ? `${mirroredRows}/${totalQueue} projected approval items are mirrored into the shared ledger.`
              : "The shared approval ledger migration is not visible in this environment yet."}
          </p>
        </div>
        <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black uppercase tracking-[0.12em]">
          {syncLabel}
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold leading-6">
          {available
            ? queueSource === "ledger"
              ? "This queue is currently reading from the canonical approval ledger."
              : "Run a ledger sync after new approvals land so the canonical approval spine can take over as the read source."
            : "Apply the approval ledger migration in this environment before syncing from the executive review queue."}
        </p>
        <ApprovalLedgerSyncButton available={available} disabled={!totalQueue} />
      </div>
      {available && missingRows > 0 ? (
        <p className="mt-3 text-sm font-semibold">
          {missingRows} queue item{missingRows === 1 ? "" : "s"} still need to be mirrored by the sync endpoint before the ledger can act as full executive truth.
        </p>
      ) : null}
    </section>
  );
}

function LaneMetric({ icon, label, value, tone }: { icon: React.JSX.Element; label: string; value: number; tone: "red" | "amber" | "emerald" | "blue" | "slate" }) {
  const toneClass =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : tone === "blue"
            ? "border-blue-200 bg-blue-50 text-blue-800"
            : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/70">{icon}</span>
        <span className="text-2xl font-black">{value}</span>
      </div>
      <p className="mt-2 text-xs font-black uppercase tracking-[0.12em]">{label}</p>
    </div>
  );
}

function ProviderReadinessPanel({ statuses }: { statuses: GrowthIntegrationStatus[] }) {
  const readyCount = statuses.filter((status) => status.canPublish).length;
  const blockedCount = statuses.filter((status) => status.state === "needs_config" || status.state === "blocked").length;

  return (
    <section id="provider-readiness" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">
            <PlugZap className="h-4 w-4" />
            Provider readiness
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Go-live execution checks</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
            Credential and mode visibility for content publishing, SEO drafts, and CMS/RSS handoffs. No secrets are exposed.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
          {readyCount} publish ready / {blockedCount} blocked
        </span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {statuses.map((status) => (
          <ProviderCard key={status.vendor} status={status} />
        ))}
      </div>
    </section>
  );
}

function ProviderCard({ status }: { status: GrowthIntegrationStatus }) {
  const stateClass =
    status.state === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status.state === "review_only"
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950">{status.label}</h3>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{status.mode}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${stateClass}`}>
          {status.state.replaceAll("_", " ")}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
        <span className="rounded-lg bg-white px-2 py-2">API: {status.canCallApi ? "Ready" : "Blocked"}</span>
        <span className="rounded-lg bg-white px-2 py-2">Publish: {status.canPublish ? "Gated" : "Review"}</span>
      </div>
      <p className={`mt-3 text-sm font-semibold leading-6 ${status.issue ? "text-amber-800" : "text-slate-600"}`}>
        {status.issue ?? status.nextAction}
      </p>
    </article>
  );
}

function ReviewQueueCard({ item }: { item: ApprovalSpineItem }) {
  const priorityClass =
    item.priority === "critical"
      ? "border-red-200 bg-red-50 text-red-800"
      : item.priority === "high"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
              {item.source}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${priorityClass}`}>
              {item.priority}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
              {item.lane.replaceAll("_", " ")}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-black text-slate-950">{item.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-slate-600">{item.detail}</p>
          <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2">
              <Clock3 className="h-3.5 w-3.5 text-slate-400" />
              {formatTimeContext(item)}
            </span>
            <span className="rounded-lg bg-slate-50 px-2.5 py-2">{item.status}</span>
          </div>
          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-800">Next action</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-blue-950">{item.nextAction}</p>
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{item.guardrail}</p>
          <ContentReviewActions target={item.actionTarget} />
        </div>
        <Link href={item.href} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black text-white">
          Open
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

function formatTimeContext(item: ApprovalSpineItem) {
  if (item.dueAt) {
    const due = Date.parse(item.dueAt);
    if (Number.isFinite(due)) {
      const hours = Math.round((due - Date.now()) / (60 * 60 * 1000));
      if (hours < -24) return `Due ${Math.abs(Math.round(hours / 24))}d ago`;
      if (hours < 0) return `Due ${Math.abs(hours)}h ago`;
      if (hours === 0) return "Due now";
      if (hours < 24) return `Due in ${hours}h`;
      return `Due in ${Math.round(hours / 24)}d`;
    }
  }

  if (item.createdAt) {
    const created = Date.parse(item.createdAt);
    if (Number.isFinite(created)) {
      const hours = Math.max(0, Math.round((Date.now() - created) / (60 * 60 * 1000)));
      if (hours < 1) return "Created now";
      if (hours < 24) return `${hours}h old`;
      return `${Math.round(hours / 24)}d old`;
    }
  }

  return "Timing unknown";
}
