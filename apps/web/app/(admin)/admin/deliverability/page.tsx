import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Mail,
  PauseCircle,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import {
  buildDeliverabilityCommandCenterSnapshot,
  type ReputationRiskLevel,
} from "@/lib/deliverability/reputation-control";
import { DeliverabilityActions } from "./deliverability-actions";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  if (status === "healthy") return "border-emerald-300/30 bg-emerald-400/10 text-emerald-100";
  if (status === "watch") return "border-sky-300/30 bg-sky-400/10 text-sky-100";
  if (status === "needs_review") return "border-amber-300/40 bg-amber-400/10 text-amber-100";
  if (status === "paused") return "border-orange-300/40 bg-orange-400/10 text-orange-100";
  return "border-rose-300/40 bg-rose-400/10 text-rose-100";
}

function riskClass(level: ReputationRiskLevel) {
  if (level === "low") return "bg-emerald-100 text-emerald-800";
  if (level === "medium") return "bg-amber-100 text-amber-800";
  if (level === "high") return "bg-orange-100 text-orange-800";
  return "bg-rose-100 text-rose-800";
}

function StatCard({
  label,
  value,
  help,
}: {
  label: string;
  value: string | number;
  help: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{help}</p>
    </div>
  );
}

function HealthPanel({
  title,
  icon,
  status,
  issues,
}: {
  title: string;
  icon: LucideIcon;
  status: string;
  issues: string[];
}) {
  const Icon = icon;
  return (
    <div className={`rounded-2xl border p-5 ${statusClass(status)}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/10 p-2">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] opacity-75">Provider health</p>
            <h2 className="mt-1 text-xl font-black">{title}</h2>
          </div>
        </div>
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.16em]">
          {status.replace("_", " ")}
        </span>
      </div>
      <div className="mt-4 space-y-2 text-sm leading-6">
        {issues.length ? issues.map((issue) => (
          <div key={issue} className="flex gap-2">
            <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
            <span>{issue}</span>
          </div>
        )) : (
          <div className="flex gap-2">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" />
            <span>Verified for conservative production sending.</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function DeliverabilityCommandCenterPage() {
  const snapshot = await buildDeliverabilityCommandCenterSnapshot();
  const activeRiskEvents = snapshot.recentRiskEvents.filter((event) =>
    ["block", "pause", "rewrite_required", "approval_required"].includes(String(event.decision ?? "")),
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-[#050b1b] text-white shadow-2xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_0.8fr] lg:p-8">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-sky-100">
                  <ShieldCheck className="h-4 w-4" />
                  Deliverability control layer
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${statusClass(snapshot.overall.status)}`}>
                  {snapshot.overall.status.replace("_", " ")}
                </span>
              </div>
              <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
                Reputation-safe outreach command center
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
                Central controls for HomeReach email, SMS, political outreach, procurement outreach,
                sender health, opt-outs, suppression, and safe volume scaling.
              </p>
              <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-200">
                {snapshot.overall.recommendation}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Risk score</p>
                <p className="mt-2 text-5xl font-black">{snapshot.overall.score}</p>
                <p className="mt-2 text-sm text-slate-300">Lower is safer. Anything unclear routes to review.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Last checked</p>
                <p className="mt-2 text-lg font-black">{new Date(snapshot.generatedAt).toLocaleString()}</p>
                <p className="mt-2 text-sm text-slate-300">Computed from existing message, event, and control tables.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Sends today" value={snapshot.totals.sendsToday} help="Outbound records in the revenue messaging ledger." />
          <StatCard label="Replies 7 days" value={snapshot.totals.replies7d} help="Inbound replies across tracked outreach channels." />
          <StatCard label="Bounces 30 days" value={snapshot.totals.bounces30d} help="Provider bounce signals from email event tables." />
          <StatCard label="Risk holds 7 days" value={snapshot.totals.blockedRiskEvents7d} help="Blocked or paused reputation decisions." />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <HealthPanel
            title="Email domain and Postmark"
            icon={Mail}
            status={snapshot.domainHealth.status}
            issues={snapshot.domainHealth.issues}
          />
          <HealthPanel
            title="SMS and Twilio A2P"
            icon={Smartphone}
            status={snapshot.smsHealth.status}
            issues={snapshot.smsHealth.issues}
          />
        </section>

        <DeliverabilityActions />

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Sender identities</p>
              <h2 className="mt-2 text-2xl font-black">Jason, Josh, Chelsi, Heather health</h2>
            </div>
            <Link
              href="/admin/email-infrastructure"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-950 hover:text-white"
            >
              Email infrastructure
            </Link>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {snapshot.senders.map((sender) => (
              <div key={sender.senderEmail} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black">{sender.senderName}</h3>
                    <p className="text-sm font-semibold text-slate-500">{sender.senderEmail}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${riskClass(sender.level)}`}>
                    {sender.level}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Email today</p>
                    <p className="mt-1 text-xl font-black">{sender.emailSendsToday}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Safe email cap</p>
                    <p className="mt-1 text-xl font-black">{sender.safeEmailLimit}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Replies 7d</p>
                    <p className="mt-1 text-xl font-black">{sender.replies7d}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Risk</p>
                    <p className="mt-1 text-xl font-black">{sender.riskScore}</p>
                  </div>
                </div>
                <p className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
                  {sender.recommendation}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Gauge className="h-5 w-5 text-blue-600" />
              <h2 className="text-2xl font-black">Recent reputation decisions</h2>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.1fr_0.7fr_0.7fr_0.7fr] bg-slate-950 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">
                <span>Sender / Recipient</span>
                <span>Decision</span>
                <span>Risk</span>
                <span>Time</span>
              </div>
              {(activeRiskEvents.length ? activeRiskEvents : snapshot.recentRiskEvents).slice(0, 10).map((event) => (
                <div key={String(event.id)} className="grid grid-cols-[1.1fr_0.7fr_0.7fr_0.7fr] border-t border-slate-200 px-4 py-3 text-sm">
                  <div>
                    <p className="font-black">{String(event.sender_email ?? "Unknown sender")}</p>
                    <p className="truncate text-xs text-slate-500">{String(event.recipient ?? "No recipient")}</p>
                  </div>
                  <p className="font-black">{String(event.decision ?? "allow")}</p>
                  <p>{String(event.risk_level ?? "low")} / {String(event.risk_score ?? 0)}</p>
                  <p className="text-xs text-slate-500">{event.created_at ? new Date(String(event.created_at)).toLocaleString() : "-"}</p>
                </div>
              ))}
              {!snapshot.recentRiskEvents.length ? (
                <div className="px-4 py-8 text-sm font-semibold text-slate-500">
                  No reputation decisions logged yet. The next send attempt will create one.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <PauseCircle className="h-5 w-5 text-rose-600" />
              <h2 className="text-2xl font-black">Active suppressions</h2>
            </div>
            <div className="mt-4 space-y-3">
              {snapshot.suppressions.map((item) => (
                <div key={String(item.id)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-black">{String(item.contact_email ?? item.contact_phone ?? "Suppressed contact")}</p>
                  <p className="mt-1 text-sm text-slate-600">{String(item.channel)} - {String(item.reason)}</p>
                </div>
              ))}
              {!snapshot.suppressions.length ? (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  No active central suppressions are currently loaded.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
