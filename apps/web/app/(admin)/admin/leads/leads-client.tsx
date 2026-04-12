"use client";

import { useState } from "react";
import Link from "next/link";
import type { Lead, LeadStatus } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Leads Client Component
// Handles status changes, quick actions, and filtering.
// TODO: Replace local state mutations with server actions + Supabase calls.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_PIPELINE: LeadStatus[] = ["lead", "interested", "sold", "churned"];

const STATUS_STYLES: Record<LeadStatus, string> = {
  lead:       "bg-gray-100 text-gray-700 border-gray-200",
  interested: "bg-amber-50 text-amber-700 border-amber-200",
  sold:       "bg-green-50 text-green-700 border-green-200",
  churned:    "bg-red-50 text-red-600 border-red-200",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  lead:       "Lead",
  interested: "Interested",
  sold:       "Sold ✓",
  churned:    "Churned",
};

function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function QuickActionsMenu({
  lead,
  onStatusChange,
  onClose,
}: {
  lead: Lead;
  onStatusChange: (id: string, status: LeadStatus) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-8 z-20 w-52 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick Actions</p>
      </div>

      {/* Status transitions */}
      {STATUS_PIPELINE.filter((s) => s !== lead.status).map((s) => (
        <button
          key={s}
          onClick={() => { onStatusChange(lead.id, s); onClose(); }}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className={`w-2 h-2 rounded-full ${s === "sold" ? "bg-green-500" : s === "interested" ? "bg-amber-400" : s === "churned" ? "bg-red-400" : "bg-gray-400"}`} />
          Move to {STATUS_LABELS[s]}
        </button>
      ))}

      <div className="border-t border-gray-100" />

      <Link
        href={`/admin/inbox`}
        onClick={onClose}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
      >
        💬 View Conversation
      </Link>

      <button
        onClick={() => {
          navigator.clipboard.writeText(
            `Hi ${lead.name.split(" ")[0]}, this is Jason from HomeReach — ready to send you the intake link for the ${lead.category} spot in ${lead.city}. Want me to send it over now?`
          );
          onClose();
        }}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        📋 Copy Intake Message
      </button>

      <button
        onClick={() => { onStatusChange(lead.id, "sold"); onClose(); }}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-green-700 hover:bg-green-50 transition-colors font-medium"
      >
        💰 Mark as Sold
      </button>
    </div>
  );
}

export function LeadsClient({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  function handleStatusChange(id: string, newStatus: LeadStatus) {
    // TODO: Call server action to update Supabase
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
    );
  }

  const filtered = leads.filter((l) => {
    const matchesFilter = filter === "all" || l.status === filter;
    const matchesSearch =
      search === "" ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.businessName.toLowerCase().includes(search.toLowerCase()) ||
      l.city.toLowerCase().includes(search.toLowerCase()) ||
      l.category.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const counts = STATUS_PIPELINE.reduce(
    (acc, s) => ({ ...acc, [s]: leads.filter((l) => l.status === s).length }),
    {} as Record<LeadStatus, number>
  );

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="mt-1 text-sm text-gray-500">{leads.length} total leads</p>
        </div>
        <Link
          href="/admin/inbox"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          💬 Open Inbox
        </Link>
      </div>

      {/* Pipeline Summary */}
      <div className="grid grid-cols-4 gap-3">
        {STATUS_PIPELINE.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? "all" : s)}
            className={`rounded-xl border p-4 text-left transition-all ${
              filter === s
                ? `${STATUS_STYLES[s]} ring-2 ring-offset-1 ring-blue-400`
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <p className="text-2xl font-bold text-gray-900">{counts[s]}</p>
            <p className="text-sm font-medium text-gray-600 mt-0.5">{STATUS_LABELS[s]}</p>
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by name, business, city, category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as LeadStatus | "all")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All statuses</option>
          {STATUS_PIPELINE.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Leads Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Lead</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">City / Category</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Contact</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Value</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                  No leads match your filter.
                </td>
              </tr>
            )}
            {filtered.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4">
                  <p className="font-semibold text-gray-900">{lead.name}</p>
                  <p className="text-xs text-gray-500">{lead.businessName}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="text-gray-700">{lead.phone}</p>
                  <p className="text-xs text-gray-400">{lead.email}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="text-gray-700">{lead.city}</p>
                  <p className="text-xs text-gray-400">{lead.category}</p>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-4">
                  <span className="capitalize text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                    {lead.source}
                  </span>
                </td>
                <td className="px-4 py-4 text-xs text-gray-500">
                  {new Date(lead.lastContact).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="px-4 py-4 font-semibold text-green-700 text-sm">
                  {lead.monthlyValue > 0 ? `$${lead.monthlyValue}/mo` : "—"}
                </td>
                <td className="px-4 py-4">
                  <div className="relative flex justify-end">
                    <button
                      onClick={() =>
                        setOpenMenuId(openMenuId === lead.id ? null : lead.id)
                      }
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Actions ▾
                    </button>
                    {openMenuId === lead.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <QuickActionsMenu
                          lead={lead}
                          onStatusChange={handleStatusChange}
                          onClose={() => setOpenMenuId(null)}
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <p className="text-xs text-gray-400 text-center">
        Data sourced live from waitlist entries and businesses table
      </p>
    </div>
  );
}
