"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Hybrid Sales Engine Dashboard
//
// Layout:
//   - 🔥 HOT LEADS — always at top, "ACT NOW" labels, AI vs Human control
//   - Warm pipeline — engaging, qualifying
//   - Cold queue — outreach sent, follow-up tracking
//   - Alert log — SMS history to Jason
//   - Engine config — signal reference, timing rules
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { SalesLead, SalesEngineStats, HotLeadAlert, MessageRole } from "@/lib/sales-engine/types";
import type { GrowthOpportunity, SalesGrowthPlan } from "@/lib/sales-engine/growth-engine";
import { getTemperatureMeta }   from "@/lib/sales-engine/classifier";
import { getEscalationMeta, getControlMeta } from "@/lib/sales-engine/escalation-client";
import { FOLLOW_UP_SCHEDULE }   from "@/lib/sales-engine/followup-engine";
import { ALERT_CONFIG }         from "@/lib/sales-engine/alert-config-client";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  leads:   SalesLead[];
  stats:   SalesEngineStats;
  alerts:  HotLeadAlert[];
  growth:  SalesGrowthPlan;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "text-white", border = "border-gray-800", pulse = false }: {
  label: string; value: string | number; sub?: string;
  color?: string; border?: string; pulse?: boolean;
}) {
  return (
    <div className={`bg-gray-900 border ${border} rounded-xl p-4 flex flex-col gap-1`}>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2">
        {pulse && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />}
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function TempBadge({ temp }: { temp: SalesLead["classification"]["temperature"] }) {
  const meta = getTemperatureMeta(temp);
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${meta.color} ${meta.bg} border ${meta.border}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

function ControlBadge({ control }: { control: SalesLead["control"] }) {
  const meta = getControlMeta(control);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${meta.color} bg-gray-800`}>
      {meta.icon} {meta.label}
    </span>
  );
}

function EscBadge({ status }: { status: SalesLead["escalation"] }) {
  const meta = getEscalationMeta(status);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${meta.color} ${meta.bg}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

function StageBadge({ stage }: { stage: SalesLead["stage"] }) {
  const map: Record<string, string> = {
    hot_escalated:    "bg-red-900/30 text-red-400",
    qualifying:       "bg-amber-900/30 text-amber-400",
    warm_engaged:     "bg-amber-900/20 text-amber-300",
    follow_up:        "bg-gray-800 text-gray-400",
    awaiting_response:"bg-gray-800 text-gray-500",
    initial_contact:  "bg-blue-900/20 text-blue-400",
    intake_sent:      "bg-teal-900/30 text-teal-400",
    closed_won:       "bg-green-900/30 text-green-400",
    closed_lost:      "bg-gray-800 text-gray-600",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[stage] ?? "bg-gray-800 text-gray-400"}`}>
      {stage.replace(/_/g, " ")}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation Thread
// ─────────────────────────────────────────────────────────────────────────────

function ConversationThread({ lead }: { lead: SalesLead }) {
  function roleColor(role: MessageRole): string {
    if (role === "ai")          return "bg-blue-700 text-white";
    if (role === "human_agent") return "bg-green-700 text-white";
    return "bg-gray-700 text-gray-100";
  }
  function roleAlign(role: MessageRole): string {
    return role === "lead" ? "justify-start" : "justify-end";
  }
  function roleLabel(role: MessageRole): string {
    if (role === "ai")          return "AI";
    if (role === "human_agent") return "Agent";
    return "Lead";
  }

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1 py-1">
      {lead.messages.map((msg) => (
        <div key={msg.id} className={`flex ${roleAlign(msg.role)}`}>
          <div className={`max-w-[75%] px-3 py-2 rounded-xl text-xs ${roleColor(msg.role)}`}>
            <p className="leading-relaxed">{msg.body}</p>
            <div className="flex items-center gap-2 mt-1 opacity-60">
              <span>{roleLabel(msg.role)}</span>
              <span>·</span>
              <span>{new Date(msg.sentAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
              {msg.signals && msg.signals.length > 0 && (
                <span className="text-amber-300">🔥</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOT Lead Card (featured, ACT NOW)
// ─────────────────────────────────────────────────────────────────────────────

function HotLeadCard({ lead, onTakeOver }: { lead: SalesLead; onTakeOver: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const isHumanActive = lead.control === "human";
  const minutesAgo = Math.floor((Date.now() - new Date(lead.lastMessageAt).getTime()) / 60000);

  return (
    <div className="bg-gray-900 border-2 border-red-800/60 rounded-xl overflow-hidden shadow-lg shadow-red-950/40">
      {/* ACT NOW Banner */}
      {!isHumanActive && (
        <div className="bg-red-600 px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white text-xs font-bold tracking-wider uppercase">ACT NOW — HOT LEAD</span>
          </div>
          <span className="text-red-200 text-xs">{minutesAgo < 60 ? `${minutesAgo}m ago` : `${Math.floor(minutesAgo/60)}h ago`}</span>
        </div>
      )}
      {isHumanActive && (
        <div className="bg-green-700 px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white text-xs font-bold tracking-wider uppercase">✋ Agent Active</span>
          </div>
          <span className="text-green-200 text-xs">Human in control</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base font-bold text-white">{lead.businessName}</h3>
            <p className="text-sm text-gray-400">{lead.city}, {lead.state} · {lead.category.replace(/_/g, " ")}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <TempBadge temp={lead.classification.temperature} />
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Score:</span>
              <span className={`text-sm font-bold ${lead.classification.score >= 70 ? "text-red-400" : "text-amber-400"}`}>
                {lead.classification.score}
              </span>
            </div>
          </div>
        </div>

        {/* Signal chips */}
        {lead.classification.signals.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {lead.classification.signals.slice(0, 4).map((s) => (
              <span key={s.type} className="text-xs bg-red-900/30 text-red-300 border border-red-800/40 px-2 py-0.5 rounded-full">
                {s.type.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        {/* Summary */}
        <p className="text-sm text-gray-300 italic mb-3">"{lead.summary}"</p>

        {/* Last message */}
        <div className="bg-gray-800 rounded-lg p-3 mb-3 border border-gray-700">
          <p className="text-xs text-gray-500 mb-1">Last from lead:</p>
          <p className="text-sm text-white font-medium">"{lead.lastMessageBody}"</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <EscBadge status={lead.escalation} />
          <ControlBadge control={lead.control} />
          <StageBadge stage={lead.stage} />
          {lead.monthlyValue && (
            <span className="text-xs text-green-400 bg-green-900/20 px-2 py-0.5 rounded">
              ~${lead.monthlyValue}/mo
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setOpen(!open)}
              className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition"
            >
              {open ? "Hide Thread" : "View Thread"}
            </button>
            {!isHumanActive && (
              <button
                onClick={() => onTakeOver(lead.id)}
                className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition"
              >
                Manual takeover
              </button>
            )}
          </div>
        </div>

        {open && (
          <div className="mt-4 border-t border-gray-800 pt-4">
            <ConversationThread lead={lead} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard Lead Row (warm/cold)
// ─────────────────────────────────────────────────────────────────────────────

function LeadRow({ lead, onTakeOver }: { lead: SalesLead; onTakeOver: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const minutesAgo = Math.floor((Date.now() - new Date(lead.lastMessageAt).getTime()) / 60000);
  const timeLabel = minutesAgo < 60 ? `${minutesAgo}m ago` :
                    minutesAgo < 1440 ? `${Math.floor(minutesAgo / 60)}h ago` :
                    `${Math.floor(minutesAgo / 1440)}d ago`;

  return (
    <div className={`bg-gray-900 border rounded-xl overflow-hidden transition-all ${
      lead.classification.temperature === "warm" ? "border-amber-900/40" : "border-gray-800"
    }`}>
      <div
        className="p-4 flex items-start gap-3 cursor-pointer hover:bg-gray-800/50 transition"
        onClick={() => setOpen(!open)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-white">{lead.businessName}</span>
            <TempBadge temp={lead.classification.temperature} />
            <StageBadge stage={lead.stage} />
          </div>
          <p className="text-xs text-gray-500">{lead.city} · {lead.category.replace(/_/g, " ")} · {timeLabel}</p>
          <p className="text-xs text-gray-400 mt-1 truncate">
            {lead.lastMessageRole === "lead" ? "💬 " : "🤖 "}
            {lead.lastMessageBody.slice(0, 80)}
            {lead.lastMessageBody.length > 80 ? "…" : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-xs text-gray-500">{lead.classification.score}</span>
          <ControlBadge control={lead.control} />
          {open ? <span className="text-gray-600 text-xs">▲</span> : <span className="text-gray-600 text-xs">▼</span>}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-800 px-4 pb-4 pt-3">
          {/* Qualification status */}
          <div className="grid grid-cols-3 gap-2 text-xs mb-3">
            {[
              { label: "City",     value: lead.qualification.city     ?? "—" },
              { label: "Category", value: lead.qualification.category ?? "—" },
              { label: "Intent",   value: lead.qualification.interestLevel ?? "unknown" },
              { label: "Timeline", value: lead.qualification.timeline ?? "unknown" },
              { label: "Replies",  value: String(lead.messages.filter((m) => m.role === "lead").length) },
              { label: "Follow-ups", value: `${lead.followUpCount}/${lead.maxFollowUps}` },
            ].map((item) => (
              <div key={item.label} className="bg-gray-800 rounded p-2">
                <p className="text-gray-600 uppercase tracking-wider text-[10px]">{item.label}</p>
                <p className="text-gray-300 font-medium mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          <ConversationThread lead={lead} />

          <div className="flex gap-2 mt-3">
            <EscBadge status={lead.escalation} />
            {lead.classification.temperature === "warm" && (
              <button
                onClick={() => onTakeOver(lead.id)}
                className="text-xs px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-lg transition"
              >
                Manual takeover
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert History Row
// ─────────────────────────────────────────────────────────────────────────────

function AlertRow({ alert }: { alert: HotLeadAlert }) {
  const [open, setOpen] = useState(false);
  const minutesAgo = Math.floor((Date.now() - new Date(alert.sentAt).getTime()) / 60000);
  const timeLabel = minutesAgo < 60 ? `${minutesAgo}m ago` :
                    minutesAgo < 1440 ? `${Math.floor(minutesAgo / 60)}h ago` :
                    `${Math.floor(minutesAgo / 1440)}d ago`;

  return (
    <div className="border-b border-gray-800 last:border-0">
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 cursor-pointer transition"
        onClick={() => setOpen(!open)}
      >
        <span className="text-xl">🔥</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{alert.businessName}</p>
          <p className="text-xs text-gray-500">{alert.city} · {alert.category} · Last: "{alert.lastMessage.slice(0, 50)}…"</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs text-gray-500">{timeLabel}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            alert.status === "sent"      ? "bg-green-900/30 text-green-400" :
            alert.status === "delivered" ? "bg-teal-900/30 text-teal-400"  : "bg-red-900/30 text-red-400"
          }`}>{alert.status}</span>
        </div>
        <span className="text-gray-600 text-xs">{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div className="px-4 pb-4">
          <pre className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap font-mono">
            {alert.formattedMessage}
          </pre>
          <p className="text-xs text-gray-600 mt-2">Sent to: {alert.sentTo}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function PriorityBadge({ priority }: { priority: GrowthOpportunity["priority"] }) {
  const classes = {
    critical: "border-red-700 bg-red-950/50 text-red-200",
    high: "border-amber-700 bg-amber-950/40 text-amber-200",
    medium: "border-blue-800 bg-blue-950/30 text-blue-200",
  }[priority];

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${classes}`}>
      {priority}
    </span>
  );
}

function GrowthOpportunityCard({
  opportunity,
  onCopy,
}: {
  opportunity: GrowthOpportunity;
  onCopy: (opportunity: GrowthOpportunity) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={opportunity.priority} />
            <span className="rounded-full border border-gray-700 bg-gray-950 px-2.5 py-1 text-[11px] font-semibold text-gray-300">
              {opportunity.urgency}
            </span>
            <span className="rounded-full border border-emerald-900/60 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              {formatMoney(opportunity.estimatedValue)} est.
            </span>
          </div>
          <h3 className="mt-3 text-base font-bold text-white">{opportunity.businessName}</h3>
          <p className="mt-1 text-xs text-gray-500">
            {opportunity.city} - {opportunity.category.replace(/_/g, " ")} - {opportunity.source}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs uppercase tracking-wider text-gray-500">Priority score</p>
          <p className="text-2xl font-black text-white">{opportunity.score}</p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-gray-300">{opportunity.reason}</p>
      <div className="mt-3 rounded-lg border border-gray-800 bg-gray-950/70 p-3">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Recommended next step</p>
        <p className="mt-1 text-sm leading-6 text-white">{opportunity.recommendedAction}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {opportunity.safeActions.map((action) => {
          if (action.kind === "copy") {
            return (
              <button
                key={action.label}
                onClick={() => onCopy(opportunity)}
                className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-gray-700"
              >
                {action.label}
              </button>
            );
          }

          return (
            <a
              key={action.label}
              href={action.href}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-gray-700"
            >
              {action.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function GrowthCommandCenter({
  growth,
  onCopy,
}: {
  growth: SalesGrowthPlan;
  onCopy: (opportunity: GrowthOpportunity) => void;
}) {
  const top = growth.topOpportunities.slice(0, 5);

  return (
    <section className="mb-6 rounded-2xl border border-blue-900/50 bg-gradient-to-br from-blue-950/60 via-gray-900 to-gray-950 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-300">Growth command center</p>
          <h2 className="mt-2 text-xl font-black text-white">Do this first</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100/80">{growth.ownerFocus}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-red-300">Act now</p>
            <p className="mt-1 text-2xl font-black text-white">{growth.immediateCount}</p>
          </div>
          <div className="rounded-xl border border-amber-900/50 bg-amber-950/25 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Due follow-ups</p>
            <p className="mt-1 text-2xl font-black text-white">{growth.followUpDueCount}</p>
          </div>
          <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/25 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Pipeline</p>
            <p className="mt-1 text-2xl font-black text-white">{formatMoney(growth.estimatedPipeline)}</p>
          </div>
          <div className="rounded-xl border border-blue-900/50 bg-blue-950/25 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-300">At risk</p>
            <p className="mt-1 text-2xl font-black text-white">{formatMoney(growth.estimatedRevenueAtRisk)}</p>
          </div>
        </div>
      </div>

      {top.length > 0 && (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {top.map((opportunity) => (
            <GrowthOpportunityCard key={opportunity.id} opportunity={opportunity} onCopy={onCopy} />
          ))}
        </div>
      )}

      {growth.sourceSummaries.length > 0 && (
        <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {growth.sourceSummaries.map((source) => (
            <div key={source.source} className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-bold text-white">{source.source}</p>
                <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300">{source.leads} leads</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <p className="font-bold text-red-300">{source.hot}</p>
                  <p className="text-gray-600">Hot</p>
                </div>
                <div>
                  <p className="font-bold text-amber-300">{source.warm}</p>
                  <p className="text-gray-600">Warm</p>
                </div>
                <div>
                  <p className="font-bold text-blue-300">{source.actionNeeded}</p>
                  <p className="text-gray-600">Action</p>
                </div>
                <div>
                  <p className="font-bold text-emerald-300">{formatMoney(source.estimatedPipeline)}</p>
                  <p className="text-gray-600">Value</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type Tab = "pipeline" | "alerts" | "config";

export function SalesEngineClient({ leads, stats, alerts, growth }: Props) {
  const [tab, setTab]     = useState<Tab>("pipeline");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function handleTakeOver(leadId: string) {
    setToastMessage(`Manual takeover noted for ${leadId.slice(0, 8)}. AI should stay in assist mode until the owner clears the thread.`);
    setTimeout(() => setToastMessage(null), 3000);
  }

  function handleCopyOpportunity(opportunity: GrowthOpportunity) {
    const text = `${opportunity.businessName}\n${opportunity.recommendedAction}\n\nReason: ${opportunity.reason}`;
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    setToastMessage("Recommended next step copied.");
    setTimeout(() => setToastMessage(null), 3000);
  }

  const hotLeads  = leads.filter((l) => l.classification.temperature === "hot").sort((a, b) => b.classification.score - a.classification.score);
  const warmLeads = leads.filter((l) => l.classification.temperature === "warm").sort((a, b) => b.classification.score - a.classification.score);
  const coldLeads = leads.filter((l) => l.classification.temperature === "cold");
  const hotNeedsOwner = hotLeads.filter((l) => l.control !== "human").length;
  const repliesNeedOwner = leads.filter((l) => l.lastMessageRole === "lead" && l.stage !== "closed_won" && l.control !== "human").length;
  const paymentDecisions = leads.filter((l) => l.stage === "intake_sent" || l.stage === "qualifying").length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-800 border border-green-600 text-sm text-white px-4 py-3 rounded-xl shadow-lg">
          {toastMessage}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Live Data Indicator */}
        <div className="mb-6 rounded-xl border border-green-800/50 bg-green-900/10 px-4 py-2.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
          <p className="text-sm text-green-400 font-medium">LIVE - production lead data</p>
          <p className="text-xs text-green-600 sm:ml-1">Read-only until a human takes over, approves, or sends.</p>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Sales Engine</h1>
            <p className="text-sm text-gray-500 mt-1">
              Revenue replies, hot leads, and payment-ready conversations for owner-controlled closing.
              Alerts route to <span className="text-gray-400 font-mono">{ALERT_CONFIG.recipientPhone}</span>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hotNeedsOwner > 0 && (
              <div className="flex items-center gap-2 bg-red-900/40 border border-red-800/60 px-3 py-2 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-300 text-sm font-bold">
                  {hotNeedsOwner} owner decision{hotNeedsOwner !== 1 ? "s" : ""} now
                </span>
              </div>
            )}
          </div>
        </div>

        <GrowthCommandCenter growth={growth} onCopy={handleCopyOpportunity} />

        <div className="grid gap-3 mb-6 md:grid-cols-3">
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-red-300">Reply-speed queue</p>
            <p className="mt-2 text-3xl font-black text-white">{hotNeedsOwner}</p>
            <p className="mt-1 text-xs leading-5 text-red-100/80">Hot conversations where a human should answer, qualify payment timing, or move to manual close.</p>
          </div>
          <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Inbound replies</p>
            <p className="mt-2 text-3xl font-black text-white">{repliesNeedOwner}</p>
            <p className="mt-1 text-xs leading-5 text-amber-100/80">Latest message came from a lead. Draft, approve, or take over before momentum cools.</p>
          </div>
          <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Revenue decisions</p>
            <p className="mt-2 text-3xl font-black text-white">{paymentDecisions}</p>
            <p className="mt-1 text-xs leading-5 text-emerald-100/80">Qualification or intake stages that need an owner decision before pricing, payment, or onboarding moves.</p>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 mb-6">
          <StatCard label="Total Leads"  value={stats.totalLeads} />
          <StatCard label="🔥 HOT"       value={stats.hot}        color="text-red-400"    border="border-red-900/40" pulse={stats.hot > 0} />
          <StatCard label="🌡️ Warm"      value={stats.warm}       color="text-amber-400"  border="border-amber-900/30" />
          <StatCard label="❄️ Cold"      value={stats.cold}       color="text-blue-400" />
          <StatCard label="Escalated"    value={stats.escalated}  color="text-orange-400" />
          <StatCard label="Human Active" value={stats.humanActive} color="text-green-400" />
          <StatCard label="Alerts Today" value={stats.alertsSentToday} color={stats.alertsSentToday > 0 ? "text-red-400" : "text-gray-500"} />
          <StatCard label="Avg Response" value={`${stats.avgResponseTimeMin}m`} color="text-blue-400" />
          <StatCard label="Conv. Rate"   value={`${stats.conversionRate}%`} color="text-green-400" />
          <StatCard label="Total MRR"    value={`$${stats.totalMRR}`} color="text-green-400" border="border-green-900/30" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto border-b border-gray-800">
          {([
            { key: "pipeline" as Tab, label: `Pipeline (${leads.length})` },
            { key: "alerts"   as Tab, label: `Alert Log (${alerts.length})` },
            { key: "config"   as Tab, label: "Engine Config" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? "border-red-500 text-red-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Pipeline ───────────────────────────────────────────────── */}
        {tab === "pipeline" && (
          <div className="space-y-8">

            {/* HOT — top priority */}
            {hotLeads.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider">Hot leads - human priority</h2>
                  <span className="text-xs bg-red-900/30 text-red-400 border border-red-800/40 px-2 py-0.5 rounded-full">
                    {hotLeads.length} active
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {hotLeads.map((lead) => (
                    <HotLeadCard key={lead.id} lead={lead} onTakeOver={handleTakeOver} />
                  ))}
                </div>
              </section>
            )}

            {/* WARM */}
            {warmLeads.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider">Warm - qualify and decide</h2>
                  <span className="text-xs bg-amber-900/30 text-amber-400 border border-amber-800/40 px-2 py-0.5 rounded-full">
                    {warmLeads.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {warmLeads.map((lead) => (
                    <LeadRow key={lead.id} lead={lead} onTakeOver={handleTakeOver} />
                  ))}
                </div>
              </section>
            )}

            {/* COLD */}
            {coldLeads.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Cold - follow-up watchlist</h2>
                  <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">{coldLeads.length}</span>
                </div>
                <div className="space-y-2">
                  {coldLeads.map((lead) => (
                    <LeadRow key={lead.id} lead={lead} onTakeOver={handleTakeOver} />
                  ))}
                </div>
              </section>
            )}

            {leads.length === 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-600">
                No leads yet. Sales engine is ready.
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Alert Log ───────────────────────────────────────────────── */}
        {tab === "alerts" && (
          <div className="space-y-4">
            <div className="bg-gray-900/60 border border-amber-800/30 rounded-xl p-4 text-sm text-amber-300">
              Owner SMS alerts go to <strong>{ALERT_CONFIG.recipientPhone}</strong> when a hot lead needs human attention.
              Max {ALERT_CONFIG.maxAlertsPerLead} alerts per lead · {ALERT_CONFIG.dedupeWindowMs / 60000}m dedupe window.
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {alerts.length === 0 ? (
                <div className="p-12 text-center text-gray-600">No alerts yet.</div>
              ) : (
                alerts
                  .slice()
                  .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
                  .map((alert) => <AlertRow key={alert.id} alert={alert} />)
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Config ──────────────────────────────────────────────────── */}
        {tab === "config" && (
          <div className="space-y-6">

            {/* Operating principles */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Operating Principles</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <p className="text-blue-400 font-bold text-sm">🤖 AI Role</p>
                  {["Generate conversations at scale", "Qualify within 2-4 messages", "Detect intent instantly", "Escalate at the right moment", "Hold attention until human arrives", "Never close, negotiate, discount, or charge"].map((item) => (
                    <p key={item} className="flex items-start gap-2 text-gray-400"><span className="text-blue-500 mt-0.5">→</span>{item}</p>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-green-400 font-bold text-sm">✋ Human Role</p>
                  {["Respond within minutes", "Build trust and rapport", "Handle objections", "Approve pricing/payment language", "Close the deal", "Confirm onboarding"].map((item) => (
                    <p key={item} className="flex items-start gap-2 text-gray-400"><span className="text-green-500 mt-0.5">→</span>{item}</p>
                  ))}
                </div>
              </div>
            </div>

            {/* HOT signal triggers */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">🔥 HOT Signal Triggers</h3>
              <p className="text-xs text-gray-500 mb-3">Any of these immediately classify as HOT and fire an SMS alert:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { signal: "Asked about pricing",       example: "How much does this cost?" },
                  { signal: "Said interested",           example: "I'm definitely interested" },
                  { signal: "Asked how it works (detail)", example: "What exactly do you send?" },
                  { signal: "Asked how to get started",  example: "How do I sign up?" },
                  { signal: "Asked about availability",  example: "Is the spot still open?" },
                  { signal: "Expressed urgency",         example: "Need this ASAP / Spring is coming" },
                  { signal: "Asked for next steps",      example: "What do I need to do next?" },
                  { signal: "Mentioned budget",          example: "I have budget for marketing" },
                  { signal: "Mentioned readiness",       example: "Ready to move forward" },
                ].map((item) => (
                  <div key={item.signal} className="bg-red-900/10 border border-red-900/30 rounded-lg p-2.5">
                    <p className="text-xs font-medium text-red-300">{item.signal}</p>
                    <p className="text-xs text-gray-600 mt-0.5 italic">"{item.example}"</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Follow-up schedule */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">📅 Follow-Up Schedule (No Reply)</h3>
              <div className="space-y-3">
                {FOLLOW_UP_SCHEDULE.map((fu) => (
                  <div key={fu.attemptNumber} className="flex items-start gap-4 py-3 border-b border-gray-800 last:border-0">
                    <span className="w-7 h-7 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {fu.attemptNumber}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 font-mono mb-1 text-gray-300">{fu.body}</p>
                    </div>
                    <span className="text-xs text-amber-400 bg-amber-900/20 px-2 py-0.5 rounded shrink-0">+{fu.delayHours}h</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3">AI stops automatically after attempt 3. Lead moves to cold/exhausted state.</p>
            </div>

            {/* Alert config */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">📲 SMS Alert Configuration</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: "Alert Phone",      value: ALERT_CONFIG.recipientPhone },
                  { label: "Dedupe Window",    value: `${ALERT_CONFIG.dedupeWindowMs / 60000} minutes` },
                  { label: "Max Per Lead",     value: String(ALERT_CONFIG.maxAlertsPerLead) },
                  { label: "Send Mode",        value: "Instant — zero delay" },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <p className="text-gray-500 uppercase tracking-wider text-[10px]">{item.label}</p>
                    <p className="text-white font-medium mt-0.5 font-mono">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
                <p className="text-xs text-gray-500 font-medium mb-1">Alert Format:</p>
                <pre className="text-xs text-gray-300 font-mono whitespace-pre">{`🔥 HOT LEAD
[Business Name] – [City]
[Category]
Last: '[Lead message]'
[AI summary]
Act now.`}</pre>
              </div>
              <p className="text-xs text-gray-600 mt-3">
                Production: wire <code className="text-gray-500">TWILIO_ACCOUNT_SID</code> + <code className="text-gray-500">TWILIO_AUTH_TOKEN</code> env vars, then uncomment 4 lines in <code className="text-gray-500">alert-engine.ts</code>.
              </p>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
