"use client";

import { useState } from "react";
import Link from "next/link";
import type { SalesAgent, AgentFollowUp } from "@/lib/engine/types";
import type { Lead } from "@/lib/admin/mock-data";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Agents Management — Admin View
// Full visibility: all agents, all stats, all pipelines
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  agents: SalesAgent[];
  leads: Lead[];
  followUps: AgentFollowUp[];
}

function formatDue(iso: string): { label: string; urgent: boolean } {
  const diff = new Date(iso).getTime() - Date.now();
  const hours = Math.round(diff / 3_600_000);
  if (hours < 0)   return { label: "Overdue", urgent: true };
  if (hours < 24)  return { label: `${hours}h`,        urgent: true };
  return { label: `${Math.round(hours / 24)}d`, urgent: false };
}

function AgentCard({ agent, leads, followUps }: {
  agent: SalesAgent;
  leads: Lead[];
  followUps: AgentFollowUp[];
}) {
  const [expanded, setExpanded] = useState(false);
  const myLeads = leads.filter((l) => agent.assignedLeadIds.includes(l.id));
  const myFUs   = followUps.filter((f) => f.agentId === agent.id && !f.completed);
  const activeLeads  = myLeads.filter((l) => l.status === "interested");
  const closedLeads  = myLeads.filter((l) => l.status === "sold" || l.status === "closed_won");

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm">
            {agent.name.split(" ").map((n) => n[0]).join("")}
          </div>
          <div>
            <p className="text-sm font-bold text-white">{agent.name}</p>
            <p className="text-xs text-gray-500">{agent.email}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-semibold",
                agent.status === "active"
                  ? "bg-green-900/50 text-green-400"
                  : "bg-gray-800 text-gray-500"
              )}>
                {agent.status}
              </span>
              <span className="text-xs text-gray-600">{(agent.commissionRate * 100).toFixed(0)}% commission</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/agent-view`}
            className="text-xs px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition"
          >
            Preview View
          </Link>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        <AgentMini label="Assigned"      value={agent.assignedLeadIds.length} />
        <AgentMini label="Hot Leads"     value={activeLeads.length}           color="amber" />
        <AgentMini label="Closed (mo)"   value={agent.dealsClosedThisMonth}   color="green" />
        <AgentMini label="Follow-ups"    value={myFUs.length}                 color={myFUs.length > 0 ? "red" : "gray"} />
      </div>

      {/* Pipeline value + commission */}
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span>Pipeline: <strong className="text-white">${agent.pipelineValue.toLocaleString()}/mo</strong></span>
        <span>Commission earned: <strong className="text-green-400">${agent.commissionEarnedThisMonth.toFixed(2)}</strong></span>
        <span>All-time: <strong className="text-gray-300">${agent.commissionEarnedAllTime.toLocaleString()}</strong></span>
      </div>

      {/* Assigned cities */}
      <div className="mt-3 flex gap-1.5 flex-wrap">
        {agent.assignedCityIds.map((cid) => (
          <span key={cid} className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full">
            {cid.replace("city-", "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        ))}
      </div>

      {/* Expanded: leads + follow-ups */}
      {expanded && (
        <div className="mt-4 border-t border-gray-800 pt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">Assigned Leads</p>
            {myLeads.length === 0 ? (
              <p className="text-xs text-gray-600">No leads assigned.</p>
            ) : (
              <div className="space-y-1.5">
                {myLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center gap-2 text-xs">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full font-medium",
                      lead.status === "interested" ? "bg-amber-900/50 text-amber-300" :
                      lead.status === "sold"       ? "bg-green-900/50 text-green-300" :
                      "bg-gray-800 text-gray-500"
                    )}>
                      {lead.status}
                    </span>
                    <span className="text-gray-300">{lead.name}</span>
                    <span className="text-gray-500">·</span>
                    <span className="text-gray-500">{lead.city} · {lead.category}</span>
                    {lead.monthlyValue > 0 && (
                      <span className="ml-auto text-green-400 font-semibold">${lead.monthlyValue}/mo</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {myFUs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">Pending Follow-Ups</p>
              <div className="space-y-1.5">
                {myFUs.map((fu) => {
                  const due = formatDue(fu.dueAt);
                  return (
                    <div key={fu.id} className="flex items-center gap-2 text-xs">
                      <span className={cn(
                        "font-semibold",
                        due.urgent ? "text-amber-400" : "text-gray-500"
                      )}>
                        {due.label}
                      </span>
                      <span className="text-gray-300">{fu.leadName}</span>
                      <span className="text-gray-600 truncate">{fu.note}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AgentMini({
  label, value, color = "gray",
}: {
  label: string; value: number; color?: "amber" | "green" | "red" | "gray";
}) {
  const COLORS = {
    amber: "text-amber-400",
    green: "text-green-400",
    red:   "text-red-400",
    gray:  "text-white",
  };
  return (
    <div className="text-center">
      <p className={cn("text-lg font-bold", COLORS[color])}>{value}</p>
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  );
}

export function AgentsClient({ agents, leads, followUps }: Props) {
  // Company-wide stats (admin only)
  const totalPipeline     = agents.reduce((s, a) => s + a.pipelineValue, 0);
  const totalClosedMo     = agents.reduce((s, a) => s + a.dealsClosedThisMonth, 0);
  const totalCommissionMo = agents.reduce((s, a) => s + a.commissionEarnedThisMonth, 0);
  const totalFUs          = followUps.filter((f) => !f.completed).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Sales Agents</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Full agent oversight — performance, pipelines, follow-ups
          </p>
        </div>
        <Link
          href="/admin/agent-view"
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition"
        >
          Preview Agent View →
        </Link>
      </div>

      {/* Company-wide stats (ADMIN ONLY — never visible to sales_agent) */}
      <div className="p-4 bg-blue-900/20 border border-blue-800/30 rounded-xl">
        <p className="text-xs font-semibold text-blue-400 mb-3">📊 Company-Wide Overview (Admin Only)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <CompanyStat label="Total Pipeline"      value={`$${totalPipeline.toLocaleString()}/mo`} />
          <CompanyStat label="Deals Closed (mo)"   value={String(totalClosedMo)} />
          <CompanyStat label="Commission Paid (mo)" value={`$${totalCommissionMo.toFixed(2)}`} />
          <CompanyStat label="Follow-ups Due"       value={String(totalFUs)} />
        </div>
      </div>

      {/* Agent Cards */}
      <div className="space-y-4">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            leads={leads}
            followUps={followUps}
          />
        ))}
      </div>

      {/* RBAC Notice */}
      <div className="pt-4 border-t border-gray-800">
        <p className="text-xs text-gray-600">
          <strong className="text-gray-500">Role enforcement:</strong> Sales agents cannot access this page.
          They only see their own leads, conversations, and commission data via the Agent View.
          Company-wide revenue, pricing config, and all-agent pipelines are admin-only.
        </p>
      </div>
    </div>
  );
}

function CompanyStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-blue-400/70">{label}</p>
      <p className="text-base font-bold text-white mt-0.5">{value}</p>
    </div>
  );
}
