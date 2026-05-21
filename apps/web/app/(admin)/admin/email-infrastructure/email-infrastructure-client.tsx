"use client";

import type React from "react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SenderAudit = {
  email: string;
  name: string;
  databaseIdentity: {
    exists: boolean;
    active: boolean;
    fromName: string | null;
    replyTo: string | null;
    emailDailyLimit: number | null;
    smsDailyLimit: number | null;
    rampDay: number | null;
  };
  senderHealth: Record<string, unknown> | null;
  recentEvents: Record<string, unknown>[];
  verificationStatus: "ready" | "blocked" | "needs_postmark_confirmation" | "not_configured";
  notes: string[];
};

type EmailInfrastructureAudit = {
  generatedAt: string;
  environment: {
    emailProvider: string;
    postmarkApiTokenConfigured: boolean;
    postmarkAccountTokenConfigured: boolean;
    postmarkFromEmailConfigured: boolean;
    postmarkFromNameConfigured: boolean;
    postmarkMessageStream: string;
    postmarkWebhookEnabled: boolean;
    postmarkWebhookAuthConfigured: boolean;
    defaultFromEmail: string | null;
    defaultReplyToEmail: string | null;
    resendConfigured: boolean;
    mailgunConfigured: boolean;
    twilioConfigured: boolean;
    nodeEnv: string;
  };
  dns: {
    spf: {
      status: string;
      values: string[];
      hasSpf: boolean;
      includesPostmark: boolean;
      includesWorkspaceProvider: boolean;
    };
    dmarc: {
      status: string;
      values: string[];
      hasDmarc: boolean;
      policy: string | null;
    };
    returnPath: {
      status: string;
      values: string[];
      pointsToPostmark: boolean;
    };
    dkimCandidates: Array<{ name: string; status: string; values: string[]; error?: string }>;
    dkimLikelyConfigured: boolean;
  };
  postmarkCredentialProbe: {
    status: string;
    httpStatus?: number;
    message: string;
  };
  senderIdentities: SenderAudit[];
  webhook: {
    route: string;
    enabled: boolean;
    authConfigured: boolean;
    recentEvents: Record<string, unknown>[];
    eventCounts: Record<string, number>;
  };
  suppression: {
    destination: string;
    recentTerminalEvents: Record<string, unknown>[];
    status: string;
  };
  emailFirstAutomation: {
    mode: string;
    status: string;
    outboundEmailAllowed: boolean;
    smsLiveSendingAllowed: boolean;
    manualApprovalMode: boolean;
    dailyEmailCapPerSender: number;
    automationBatchLimit: number;
    safeguards: string[];
  };
  sourceErrors: Record<string, string | undefined>;
  blockingIssues: string[];
  recommendations: string[];
};

type SendResult = {
  ok: boolean;
  sender?: string;
  recipient?: string;
  subject?: string;
  timestamp?: string;
  provider?: string;
  messageId?: string | null;
  error?: string | null;
  logStatus?: string;
};

type Props = {
  initialAudit: EmailInfrastructureAudit;
  defaultDestination: string;
};

const statusTone: Record<string, string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  configured: "border-emerald-200 bg-emerald-50 text-emerald-700",
  present: "border-emerald-200 bg-emerald-50 text-emerald-700",
  sent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blocked: "border-rose-200 bg-rose-50 text-rose-700",
  invalid: "border-rose-200 bg-rose-50 text-rose-700",
  missing: "border-rose-200 bg-rose-50 text-rose-700",
  not_configured: "border-rose-200 bg-rose-50 text-rose-700",
  needs_postmark_confirmation: "border-amber-200 bg-amber-50 text-amber-700",
  unknown: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-amber-200 bg-amber-50 text-amber-700",
};

export function EmailInfrastructureClient({ initialAudit, defaultDestination }: Props) {
  const [audit, setAudit] = useState(initialAudit);
  const [selectedSender, setSelectedSender] = useState(initialAudit.senderIdentities[0]?.email ?? "");
  const [destination, setDestination] = useState(defaultDestination);
  const [sending, setSending] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);

  const selected = useMemo(
    () => audit.senderIdentities.find((sender) => sender.email === selectedSender),
    [audit.senderIdentities, selectedSender],
  );

  async function refreshAudit() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/email-infrastructure/audit", { cache: "no-store" });
      if (!response.ok) throw new Error(`Audit refresh failed: ${response.status}`);
      setAudit(await response.json());
    } catch (err) {
      setResults((current) => [
        {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        },
        ...current,
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function sendOne(senderEmail = selectedSender) {
    setSending(senderEmail);
    try {
      const response = await fetch("/api/admin/email-infrastructure/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderEmail, destinationEmail: destination }),
      });
      const payload = await response.json();
      setResults((current) => [payload, ...current].slice(0, 12));
      await refreshAudit();
    } catch (err) {
      setResults((current) => [
        {
          ok: false,
          sender: senderEmail,
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        },
        ...current,
      ]);
    } finally {
      setSending(null);
    }
  }

  async function sendAll() {
    for (const sender of audit.senderIdentities) {
      await sendOne(sender.email);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_0.42fr] lg:p-8">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin - Email Infrastructure
            </p>
            <h1 className="mt-5 text-4xl font-black leading-tight">Outbound email verification</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
              A safe Postmark-first audit surface for sender identity checks, DNS authentication, webhook observability, suppression signals, and one-recipient verification sends.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Runtime provider</p>
            <p className="mt-2 text-2xl font-black">{audit.environment.emailProvider}</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Generated {new Date(audit.generatedAt).toLocaleString()}
            </p>
            <button
              type="button"
              onClick={() => void refreshAudit()}
              disabled={refreshing}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-black text-slate-950 transition hover:bg-blue-50 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              Refresh audit
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Postmark token"
          value={audit.environment.postmarkApiTokenConfigured ? "Available" : "Missing"}
          tone={audit.environment.postmarkApiTokenConfigured ? "green" : "red"}
        />
        <MetricCard
          label="SPF includes Postmark"
          value={audit.dns.spf.includesPostmark ? "Yes" : "No"}
          tone={audit.dns.spf.includesPostmark ? "green" : "red"}
        />
        <MetricCard
          label="DKIM visible"
          value={audit.dns.dkimLikelyConfigured ? "Yes" : "Needs check"}
          tone={audit.dns.dkimLikelyConfigured ? "green" : "amber"}
        />
        <MetricCard
          label="Webhook"
          value={audit.webhook.enabled ? "Enabled" : "Disabled"}
          tone={audit.webhook.enabled ? "green" : "amber"}
        />
      </section>

      {audit.blockingIssues.length > 0 && (
        <Panel title="Blocking Checks" icon={<AlertTriangle className="h-5 w-5" />}>
          <div className="grid gap-2">
            {audit.blockingIssues.map((issue) => (
              <div key={issue} className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {issue}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Safe Verification Sender" icon={<Mail className="h-5 w-5" />}>
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Sender identity</span>
                <select
                  value={selectedSender}
                  onChange={(event) => setSelectedSender(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-blue-400"
                >
                  {audit.senderIdentities.map((sender) => (
                    <option key={sender.email} value={sender.email}>
                      {sender.name} - {sender.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Destination</span>
                <input
                  type="email"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-blue-400"
                />
              </label>
            </div>

            {selected && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{selected.name}</p>
                    <p className="text-sm font-semibold text-slate-600">{selected.email}</p>
                  </div>
                  <StatusPill status={selected.verificationStatus} />
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
                  <MiniFact label="DB identity" value={selected.databaseIdentity.exists ? "Found" : "Missing"} />
                  <MiniFact label="Active" value={selected.databaseIdentity.active ? "Yes" : "No"} />
                  <MiniFact label="Daily cap" value={selected.databaseIdentity.emailDailyLimit ?? "n/a"} />
                </div>
                {selected.notes.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {selected.notes.map((note) => (
                      <p key={note} className="text-sm font-semibold text-amber-700">{note}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void sendOne()}
                disabled={!selectedSender || Boolean(sending)}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending === selectedSender ? "Sending..." : "Send test email"}
              </button>
              <button
                type="button"
                onClick={() => void sendAll()}
                disabled={Boolean(sending)}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-950 transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
              >
                <Clock3 className="h-4 w-4" />
                Send all four, one each
              </button>
            </div>
          </div>
        </Panel>

        <Panel title="Latest Test Results" icon={<CheckCircle2 className="h-5 w-5" />}>
          {results.length === 0 ? (
            <p className="text-sm leading-6 text-slate-600">
              No verification sends in this browser session yet. Use the safe test sender to send one email from a selected HomeReach identity.
            </p>
          ) : (
            <div className="space-y-3">
              {results.map((result, index) => (
                <div key={`${result.timestamp}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-black text-slate-950">{result.sender ?? "Verification send"}</p>
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black", result.ok ? statusTone.sent : statusTone.blocked)}>
                      {result.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {result.ok ? "Sent" : "Failed"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                    <MiniFact label="Recipient" value={result.recipient ?? destination} />
                    <MiniFact label="Provider" value={result.provider ?? "postmark"} />
                    <MiniFact label="Message ID" value={result.messageId ?? "n/a"} />
                    <MiniFact label="Log" value={result.logStatus ?? "n/a"} />
                  </div>
                  {result.error && <p className="mt-3 text-sm font-semibold text-rose-700">{result.error}</p>}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title="DNS Authentication" icon={<ShieldCheck className="h-5 w-5" />}>
          <DnsLine label="SPF" status={audit.dns.spf.includesPostmark ? "present" : "missing"} values={audit.dns.spf.values} />
          <DnsLine label="DMARC" status={audit.dns.dmarc.hasDmarc ? "present" : "missing"} values={audit.dns.dmarc.values} note={`Policy: ${audit.dns.dmarc.policy ?? "n/a"}`} />
          <DnsLine label="Return-Path" status={audit.dns.returnPath.pointsToPostmark ? "present" : audit.dns.returnPath.status} values={audit.dns.returnPath.values} />
          <div className="mt-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">DKIM candidates</p>
            <div className="mt-2 space-y-2">
              {audit.dns.dkimCandidates.map((record) => (
                <DnsLine key={record.name} label={record.name} status={record.status} values={record.values} compact />
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Webhook History" icon={<RefreshCw className="h-5 w-5" />}>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {Object.entries(audit.webhook.eventCounts).map(([key, value]) => (
              <MiniFact key={key} label={key} value={value} />
            ))}
          </div>
          <EventList events={audit.webhook.recentEvents} />
        </Panel>

        <Panel title="Email-First Automation" icon={<ShieldCheck className="h-5 w-5" />}>
          <StatusPill status={audit.emailFirstAutomation.mode} />
          <p className="mt-3 text-sm leading-6 text-slate-700">{audit.emailFirstAutomation.status}</p>
          <div className="mt-4 grid gap-2">
            <MiniFact label="Outbound email" value={audit.emailFirstAutomation.outboundEmailAllowed ? "Allowed" : "Blocked"} />
            <MiniFact label="SMS live" value={audit.emailFirstAutomation.smsLiveSendingAllowed ? "Enabled" : "Disabled"} />
            <MiniFact label="Manual approval" value={audit.emailFirstAutomation.manualApprovalMode ? "On" : "Off"} />
            <MiniFact label="Email cap" value={`${audit.emailFirstAutomation.dailyEmailCapPerSender}/sender/day`} />
          </div>
          <div className="mt-4 space-y-2">
            {audit.emailFirstAutomation.safeguards.map((item) => (
              <p key={item} className="text-sm font-semibold text-slate-600">{item}</p>
            ))}
          </div>
        </Panel>
      </section>

      <Panel title="Sender Identity Matrix" icon={<Mail className="h-5 w-5" />}>
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.12em] text-slate-500">
                {["Sender", "DB Active", "Reply-To", "Email Cap", "Health", "Recent Events"].map((heading) => (
                  <th key={heading} className="border-b border-slate-200 px-3 py-3 font-black">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audit.senderIdentities.map((sender) => (
                <tr key={sender.email} className="align-top">
                  <td className="border-b border-slate-100 px-3 py-3">
                    <p className="font-black text-slate-950">{sender.name}</p>
                    <p className="text-xs font-semibold text-slate-500">{sender.email}</p>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">{sender.databaseIdentity.active ? "Yes" : "No"}</td>
                  <td className="border-b border-slate-100 px-3 py-3">{sender.databaseIdentity.replyTo ?? "n/a"}</td>
                  <td className="border-b border-slate-100 px-3 py-3">{sender.databaseIdentity.emailDailyLimit ?? "n/a"}</td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    <StatusPill status={String(sender.senderHealth?.health_status ?? sender.verificationStatus)} />
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    {sender.recentEvents.length ? `${sender.recentEvents.length} verification event(s)` : "No sender-specific test events yet"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Suppression Status" icon={<XCircle className="h-5 w-5" />}>
          <p className="text-sm leading-6 text-slate-700">{audit.suppression.status}</p>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">Destination</p>
          <p className="mt-1 font-black text-slate-950">{audit.suppression.destination}</p>
        </Panel>
        <Panel title="Recommended Next Steps" icon={<AlertTriangle className="h-5 w-5" />}>
          <div className="space-y-2">
            {audit.recommendations.map((item) => (
              <p key={item} className="text-sm font-semibold leading-6 text-slate-700">{item}</p>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "red" }) {
  const color = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-rose-700" : "text-amber-700";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={cn("mt-2 text-2xl font-black", color)}>{value}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-blue-700">{icon}</span>
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-black", statusTone[status] ?? "border-slate-200 bg-slate-50 text-slate-700")}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function MiniFact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  );
}

function DnsLine({
  label,
  status,
  values,
  note,
  compact,
}: {
  label: string;
  status: string;
  values: string[];
  note?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-md border border-slate-200 bg-slate-50 p-3", !compact && "mb-3")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-black text-slate-950">{label}</p>
        <StatusPill status={status} />
      </div>
      {note && <p className="mt-2 text-xs font-bold text-slate-500">{note}</p>}
      {values.length > 0 && (
        <div className="mt-2 space-y-1">
          {values.map((value) => (
            <p key={value} className="break-all text-xs font-semibold leading-5 text-slate-600">{value}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function EventList({ events }: { events: Record<string, unknown>[] }) {
  if (events.length === 0) {
    return <p className="text-sm leading-6 text-slate-600">No recent webhook events found.</p>;
  }

  return (
    <div className="space-y-2">
      {events.slice(0, 8).map((event, index) => (
        <div key={`${event.message_id}-${event.received_at}-${index}`} className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-black text-slate-950">{String(event.event_type ?? "event")}</p>
            <p className="text-xs font-bold text-slate-500">
              {event.received_at ? new Date(String(event.received_at)).toLocaleString() : "time n/a"}
            </p>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-600">{String(event.recipient ?? "recipient n/a")}</p>
          {Boolean(event.message_id) && <p className="mt-1 break-all text-xs text-slate-500">{String(event.message_id)}</p>}
        </div>
      ))}
    </div>
  );
}
