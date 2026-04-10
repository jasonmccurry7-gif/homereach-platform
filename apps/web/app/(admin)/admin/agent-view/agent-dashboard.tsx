"use client";

import { useState } from "react";
import Link from "next/link";
import type { SalesAgent, AgentFollowUp } from "@/lib/engine/types";
import type { Lead } from "@/lib/admin/mock-data";
import { MOCK_LEADS, MOCK_CONVERSATIONS } from "@/lib/admin/mock-data";
import { MOCK_FOLLOW_UPS, getAgentFollowUps } from "@/lib/admin/mock-agents";
import { AutomationEngine } from "@/lib/engine/automation";
import { ReviewEngine }     from "@/lib/review/review-engine";
import { cn } from "@/lib/utils";
import { MockDataBanner } from "@/components/admin/mock-data-banner";

// ─────────────────────────────────────────────────────────────────────────────
// Sales Agent Dashboard
// Role: sales_agent — restricted view, personal data only
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  agents: SalesAgent[];
}

const STATUS_STYLES: Record<string, string> = {
  lead:       "bg-gray-800 text-gray-300",
  interested: "bg-amber-900/50 text-amber-300",
  sold:       "bg-green-900/50 text-green-300",
  churned:    "bg-red-900/50 text-red-400",
  closed_won: "bg-emerald-900/50 text-emerald-300",
  closed_lost:"bg-gray-800 text-gray-500",
};

function formatDue(iso: string): { label: string; urgent: boolean } {
  const now = Date.now();
  const diff = new Date(iso).getTime() - now;
  const hours = Math.round(diff / 3_600_000);
  if (hours < 0)   return { label: "Overdue",           urgent: true };
  if (hours < 2)   return { label: `${hours}h`,         urgent: true };
  if (hours < 24)  return { label: `Today, ${hours}h`,  urgent: true };
  const days = Math.round(hours / 24);
  return { label: `${days}d`,                           urgent: false };
}

function FollowUpRow({ fu, onComplete }: {
  fu: AgentFollowUp;
  onComplete: (id: string) => void;
}) {
  const due = formatDue(fu.dueAt);
  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-lg border",
      due.urgent
        ? "bg-amber-900/20 border-amber-800/30"
        : "bg-gray-800/40 border-gray-700/40"
    )}>
      <button
        onClick={() => onComplete(fu.id)}
        className="w-5 h-5 mt-0.5 rounded border border-gray-600 hover:border-green-500 hover:bg-green-500/20 flex items-center justify-center shrink-0 transition"
      >
        <span className="text-xs text-gray-500 hover:text-green-400">✓</span>
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{fu.leadName}</p>
        <p className="text-xs text-gray-400 truncate">{fu.businessName} · {fu.city}</p>
        <p className="text-xs text-gray-500 mt-1 truncate">{fu.note}</p>
      </div>
      <span className={cn(
        "text-xs font-semibold shrink-0",
        due.urgent ? "text-amber-400" : "text-gray-500"
      )}>
        {due.label}
      </span>
    </div>
  );
}

// ── Agent Dashboard View ──────────────────────────────────────────────────

function AgentDashboard({ agent }: { agent: SalesAgent }) {
  const [completedFUs, setCompletedFUs] = useState<Set<string>>(new Set());
  const [showToast, setShowToast] = useState<string | null>(null);

  // Filtered data — agent sees ONLY their assigned leads
  const myLeads = MOCK_LEADS.filter((l) => agent.assignedLeadIds.includes(l.id));
  const myConversations = MOCK_CONVERSATIONS.filter((c) =>
    agent.assignedLeadIds.includes(c.leadId)
  );
  const myFollowUps = getAgentFollowUps(agent.id).filter(
    (f) => !completedFUs.has(f.id)
  );

  // Stats (RESTRICTED — only this agent's data, no company-wide revenue)
  const closedLeads = myLeads.filter((l) => l.status === "sold" || l.status === "closed_won");
  const activeLeads = myLeads.filter((l) => l.status === "interested");

  // Review prompts — "Ask for review" reminders from ReviewEngine
  const reviewPrompts = ReviewEngine.getAgentReviewPrompts(
    myLeads.map((l) => ({
      id:           l.id,
      name:         l.name,
      businessName: l.businessName,
      status:       l.status,
    })),
    agent.id
  ).filter((p) => p.suggestedAction !== "none");
  const pipelineValue = activeLeads.reduce((s, l) => s + l.monthlyValue, 0);
  const unreadCount = myConversations.reduce((s, c) => s + c.unreadCount, 0);

  function toast(msg: string) {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-800 border border-gray-700 text-sm text-white px-4 py-3 rounded-xl shadow-lg">
          ✅ {showToast}
        </div>
      )}

      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/60 backdrop-blur sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
              {agent.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <p className="text-sm font-bold text-white">{agent.name}</p>
              <p className="text-xs text-gray-500">Sales Agent · HomeReach</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {myFollowUps.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-amber-400">
                ⏰ {myFollowUps.length} follow-up{myFollowUps.length !== 1 ? "s" : ""} due
              </span>
            )}
            <Link
              href="/admin/hub"
              className="text-xs text-gray-500 hover:text-gray-300 transition"
            >
              ← Back to Hub
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto space-y-8">

        {/* Mock Data Warning */}
        <MockDataBanner items={["All agent data"]} />

        {/* ── Performance Strip ───────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <AgentStatCard
            icon="✅"
            label="Closed This Month"
            value={String(agent.dealsClosedThisMonth)}
            sub={`${agent.dealsClosedAllTime} all time`}
            color="green"
          />
          <AgentStatCard
            icon="🔥"
            label="Active Pipeline"
            value={activeLeads.length}
            sub={`$${pipelineValue.toLocaleString()}/mo value`}
            color="amber"
          />
          <AgentStatCard
            icon="💰"
            label="Commission (Month)"
            value={`$${agent.commissionEarnedThisMonth.toFixed(0)}`}
            sub={`$${agent.commissionEarnedAllTime.toLocaleString()} all time`}
            color="blue"
          />
          <AgentStatCard
            icon="💬"
            label="Unread Messages"
            value={unreadCount}
            sub={`${myConversations.length} total convos`}
            color={unreadCount > 0 ? "red" : "gray"}
          />
        </div>

        {/* ── Main Grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: My Leads */}
          <div className="lg:col-span-2 space-y-6">

            {/* My Leads */}
            <AgentPanel title="My Leads" sub={`${myLeads.length} assigned to you`}>
              {myLeads.length === 0 ? (
                <p className="text-sm text-gray-500">No leads assigned yet.</p>
              ) : (
                <div className="divide-y divide-gray-800">
                  {myLeads.map((lead) => (
                    <div key={lead.id} className="py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-white truncate">{lead.name}</p>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            STATUS_STYLES[lead.status] ?? STATUS_STYLES.lead
                          )}>
                            {lead.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">{lead.businessName}</p>
                        <p className="text-xs text-gray-500">{lead.city} · {lead.category}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {lead.monthlyValue > 0 && (
                          <span className="text-xs font-semibold text-green-400">
                            ${lead.monthlyValue}/mo
                          </span>
                        )}
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => toast(`Intake sent to ${lead.name}`)}
                            className="text-xs px-2.5 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition"
                          >
                            Intake
                          </button>
                          {lead.status === "interested" && (
                            <button
                              onClick={() => toast(`${lead.name} marked as closed`)}
                              className="text-xs px-2.5 py-1 bg-green-700 hover:bg-green-600 text-white rounded-lg transition"
                            >
                              Close
                            </button>
                          )}
                          {(lead.status === "sold" || lead.status === "closed_won" || lead.status === "interested") && (
                            <button
                              onClick={() => toast(`⭐ Review request sent to ${lead.name}`)}
                              className="text-xs px-2.5 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded-lg transition"
                            >
                              ⭐ Review
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AgentPanel>

            {/* My Conversations */}
            <AgentPanel title="My Conversations" sub="Your assigned leads only">
              {myConversations.length === 0 ? (
                <p className="text-sm text-gray-500">No conversations yet.</p>
              ) : (
                <div className="space-y-2">
                  {myConversations.map((conv) => {
                    const badge = conv.lastIntent
                      ? AutomationEngine.getIntentBadge(conv.lastIntent as any)
                      : null;
                    return (
                      <div
                        key={conv.id}
                        className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {conv.leadName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{conv.leadName}</p>
                            {badge && (
                              <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", badge.color)}>
                                {badge.label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate">{conv.lastMessage}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-xs text-gray-500">{conv.channel.toUpperCase()}</span>
                          {conv.unreadCount > 0 && (
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link href="/admin/inbox" className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                Open full inbox →
              </Link>
            </AgentPanel>
          </div>

          {/* RIGHT: Sidebar */}
          <div className="space-y-6">

            {/* Follow-ups */}
            <AgentPanel title="⏰ Follow-Ups" sub="Tasks due today & upcoming">
              {myFollowUps.length === 0 ? (
                <p className="text-sm text-gray-500">You're all caught up 🎉</p>
              ) : (
                <div className="space-y-2">
                  {myFollowUps.map((fu) => (
                    <FollowUpRow
                      key={fu.id}
                      fu={fu}
                      onComplete={(id) => {
                        setCompletedFUs((prev) => new Set([...prev, id]));
                        toast("Follow-up marked complete");
                      }}
                    />
                  ))}
                </div>
              )}
            </AgentPanel>

            {/* ── Review Reminders ──────────────────────────────────── */}
            <AgentPanel
              title="⭐ Review Reminders"
              sub={reviewPrompts.length > 0 ? `${reviewPrompts.filter(p => p.suggestedAction === "request_now").length} ready to request` : "All caught up"}
            >
              {reviewPrompts.length === 0 ? (
                <p className="text-sm text-gray-500">No review reminders right now.</p>
              ) : (
                <div className="space-y-2">
                  {reviewPrompts.map((prompt) => (
                    <div
                      key={prompt.leadId}
                      className={cn(
                        "flex items-start gap-2.5 p-3 rounded-lg border text-xs",
                        prompt.suggestedAction === "request_now"
                          ? "bg-amber-900/20 border-amber-800/30"
                          : prompt.suggestedAction === "completed"
                          ? "bg-green-900/10 border-green-800/20"
                          : "bg-gray-800/40 border-gray-700/40"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{prompt.businessName}</p>
                        <p className="text-gray-500 mt-0.5 truncate">{prompt.leadName}</p>
                        <p className={cn(
                          "mt-1",
                          prompt.suggestedAction === "request_now" ? "text-amber-400" :
                          prompt.suggestedAction === "completed"   ? "text-green-400" :
                          prompt.suggestedAction === "follow_up"   ? "text-blue-400" : "text-gray-500"
                        )}>
                          {prompt.suggestedMessage}
                        </p>
                      </div>
                      {prompt.suggestedAction === "request_now" && (
                        <button
                          onClick={() => toast(`⭐ Review request sent to ${prompt.leadName}`)}
                          className="shrink-0 mt-0.5 text-xs px-2.5 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded-lg transition"
                        >
                          Send
                        </button>
                      )}
                      {prompt.suggestedAction === "follow_up" && (
                        <button
                          onClick={() => toast(`Reminder sent to ${prompt.leadName}`)}
                          className="shrink-0 mt-0.5 text-xs px-2.5 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition"
                        >
                          Remind
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Link
                href="/admin/reviews"
                className="mt-3 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                View all review requests →
              </Link>
            </AgentPanel>

            {/* Quick Actions */}
            <AgentPanel title="⚡ Quick Actions" sub="">
              <div className="space-y-2">
                {[
                  { icon: "📝", label: "Send Intake Form",   action: "Intake link sent" },
                  { icon: "✅", label: "Mark Deal Closed",   action: "Deal marked as closed" },
                  { icon: "📞", label: "Log a Follow-Up",    action: "Follow-up logged" },
                  { icon: "💬", label: "Open Inbox",         href: "/admin/inbox" },
                ].map((item) => (
                  item.href ? (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition"
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      key={item.label}
                      onClick={() => toast(item.action!)}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition"
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </button>
                  )
                ))}
              </div>
            </AgentPanel>

            {/* Commission Summary */}
            <AgentPanel title="💰 My Commission" sub="This month's earnings">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Deals closed</span>
                  <span className="text-sm font-semibold text-white">{agent.dealsClosedThisMonth}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Rate</span>
                  <span className="text-sm font-semibold text-white">{(agent.commissionRate * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Earned this month</span>
                  <span className="text-sm font-bold text-green-400">
                    ${agent.commissionEarnedThisMonth.toFixed(2)}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-800">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">All-time earnings</span>
                    <span className="text-sm font-bold text-white">
                      ${agent.commissionEarnedAllTime.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-3">* Commission figures are estimates. Final payout confirmed by admin.</p>
            </AgentPanel>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Wrapper: Agent Selector ───────────────────────────────────────────────

export function AgentDashboardWrapper({ agents }: Props) {
  const [selectedId, setSelectedId] = useState<string>(agents[0]?.id ?? "");
  const agent = agents.find((a) => a.id === selectedId) ?? agents[0];

  if (!agent) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
      No agents found.
    </div>
  );

  return (
    <div>
      {/* Admin preview banner */}
      <div className="bg-blue-900/40 border-b border-blue-800/50 px-6 py-2 flex items-center gap-4">
        <span className="text-xs font-semibold text-blue-300">👀 Admin Preview Mode</span>
        <span className="text-xs text-blue-400">Viewing dashboard as:</span>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="text-xs bg-blue-900/60 border border-blue-700 rounded px-2 py-1 text-white"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.assignedLeadIds.length} leads)</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-blue-500">Agents cannot see company-wide revenue or other agents' data</span>
      </div>
      <AgentDashboard agent={agent} />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function AgentStatCard({
  icon, label, value, sub, color,
}: {
  icon: string;
  label: string;
  value: string | number;
  sub: string;
  color: "green" | "amber" | "blue" | "red" | "gray";
}) {
  const COLORS = {
    green: "from-green-900/40 to-green-900/10 border-green-800/30",
    amber: "from-amber-900/40 to-amber-900/10 border-amber-800/30",
    blue:  "from-blue-900/40  to-blue-900/10  border-blue-800/30",
    red:   "from-red-900/40   to-red-900/10   border-red-800/30",
    gray:  "from-gray-800/60  to-gray-800/20  border-gray-700/30",
  };
  return (
    <div className={cn(
      "rounded-2xl p-5 border bg-gradient-to-br",
      COLORS[color]
    )}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

function AgentPanel({ title, sub, children }: {
  title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
