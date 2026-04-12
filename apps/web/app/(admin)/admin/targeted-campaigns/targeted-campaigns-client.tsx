"use client";

import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeadRow {
  id:                string;
  name:              string | null;
  businessName:      string | null;
  phone:             string | null;
  email:             string | null;
  source:            string;
  status:            string;
  city:              string | null;
  notes:             string | null;
  intakeToken:       string | null;
  intakeSentAt:      string | null;
  intakeSubmittedAt: string | null;
  paidAt:            string | null;
  mailedAt:          string | null;
  reviewRequested:   boolean;
  createdAt:         string;
}

interface CampaignRow {
  id:              string;
  leadId:          string | null;
  businessName:    string;
  contactName:     string | null;
  email:           string;
  phone:           string | null;
  businessAddress: string | null;
  targetCity:      string | null;
  targetAreaNotes: string | null;
  homesCount:      number;
  priceCents:      number;
  status:          string;
  designStatus:    string;
  mailingStatus:   string;
  reviewRequested: boolean;
  notes:           string | null;
  createdAt:       string;
}

interface Props {
  leads:     LeadRow[];
  campaigns: CampaignRow[];
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const LEAD_STATUS_COLORS: Record<string, string> = {
  new:              "bg-gray-100 text-gray-700",
  contacted:        "bg-yellow-100 text-yellow-700",
  intake_sent:      "bg-blue-100 text-blue-700",
  intake_started:   "bg-indigo-100 text-indigo-700",
  intake_complete:  "bg-purple-100 text-purple-700",
  paid:             "bg-green-100 text-green-700",
  active:           "bg-emerald-100 text-emerald-700",
  mailed:           "bg-teal-100 text-teal-700",
  review_requested: "bg-orange-100 text-orange-700",
};

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  intake_complete:    "bg-purple-100 text-purple-700",
  paid:               "bg-green-100 text-green-700",
  design_queued:      "bg-blue-100 text-blue-700",
  design_in_progress: "bg-indigo-100 text-indigo-700",
  design_ready:       "bg-yellow-100 text-yellow-700",
  approved:           "bg-emerald-100 text-emerald-700",
  mailed:             "bg-teal-100 text-teal-700",
  complete:           "bg-gray-100 text-gray-600",
  cancelled:          "bg-red-100 text-red-700",
};

function StatusBadge({ status, colorMap }: { status: string; colorMap: Record<string, string> }) {
  const color = colorMap[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Create Lead Modal ─────────────────────────────────────────────────────────

function CreateLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", businessName: "", email: "", phone: "", city: "", notes: "", source: "facebook" as const });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/targeted/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); setLoading(false); return; }
      onCreated();
      onClose();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="font-bold text-gray-900 mb-4">Add New Lead</h2>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="space-y-3">
          {[
            { label: "Name", field: "name", placeholder: "Jane Smith" },
            { label: "Business Name", field: "businessName", placeholder: "Jane's Cleaning Co." },
            { label: "Email", field: "email", placeholder: "jane@business.com", type: "email" },
            { label: "Phone", field: "phone", placeholder: "(512) 555-0100" },
            { label: "City", field: "city", placeholder: "Austin, TX" },
          ].map(({ label, field, placeholder, type }) => (
            <div key={field}>
              <label className="text-sm font-medium text-gray-700">{label}</label>
              <input
                type={type ?? "text"}
                value={(form as any)[field]}
                onChange={(e) => update(field, e.target.value)}
                placeholder={placeholder}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          ))}
          <div>
            <label className="text-sm font-medium text-gray-700">Source</label>
            <select
              value={form.source}
              onChange={(e) => update("source", e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            >
              {["facebook", "web", "manual", "sms", "referral"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TargetedCampaignsClient({ leads: initialLeads, campaigns: initialCampaigns }: Props) {
  const [leads, setLeads]         = useState<LeadRow[]>(initialLeads);
  const [campaigns]               = useState<CampaignRow[]>(initialCampaigns);
  const [activeTab, setActiveTab] = useState<"leads" | "campaigns">("leads");
  const [showCreate, setShowCreate] = useState(false);

  const [sending, setSending]     = useState<string | null>(null);
  const [mailing, setMailing]     = useState<string | null>(null);
  const [feedback, setFeedback]   = useState<{ id: string; msg: string } | null>(null);

  function showFeedback(id: string, msg: string) {
    setFeedback({ id, msg });
    setTimeout(() => setFeedback(null), 3000);
  }

  async function sendIntake(leadId: string) {
    setSending(leadId);
    try {
      const res = await fetch("/api/targeted/admin/send-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (res.ok) {
        setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: "intake_sent", intakeSentAt: new Date().toISOString() } : l));
        showFeedback(leadId, "✓ Intake link sent");
      } else {
        showFeedback(leadId, `✗ ${data.error}`);
      }
    } catch {
      showFeedback(leadId, "✗ Network error");
    } finally {
      setSending(null);
    }
  }

  async function markMailed(campaignId: string) {
    setMailing(campaignId);
    try {
      const res = await fetch("/api/targeted/admin/mark-mailed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      if (res.ok) {
        showFeedback(campaignId, "✓ Marked mailed — review request sent");
      } else {
        const d = await res.json();
        showFeedback(campaignId, `✗ ${d.error}`);
      }
    } catch {
      showFeedback(campaignId, "✗ Network error");
    } finally {
      setMailing(null);
    }
  }

  function copyIntakeLink(token: string | null) {
    if (!token) return;
    const base = window.location.origin;
    navigator.clipboard.writeText(`${base}/targeted/intake?token=${token}`);
    alert("Intake link copied to clipboard!");
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = {
    newLeads:         leads.filter((l) => l.status === "new").length,
    intakeSent:       leads.filter((l) => l.status === "intake_sent").length,
    intakeComplete:   leads.filter((l) => l.status === "intake_complete").length,
    paid:             leads.filter((l) => l.status === "paid" || l.status === "active").length,
    mailed:           leads.filter((l) => l.status === "mailed" || l.status === "review_requested").length,
    activeCampaigns:  campaigns.filter((c) => c.status === "paid" || c.status === "design_queued" || c.status === "design_in_progress").length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {showCreate && (
        <CreateLeadModal
          onClose={() => setShowCreate(false)}
          onCreated={() => window.location.reload()}
        />
      )}

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Targeted Route Campaigns</h1>
            <p className="text-sm text-gray-500 mt-0.5">Facebook leads → intake → payment → mail → review</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            + Add Lead
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 mb-6">
          {[
            { label: "New Leads",       value: stats.newLeads,        color: "text-gray-700" },
            { label: "Intake Sent",     value: stats.intakeSent,      color: "text-blue-700" },
            { label: "Intake Done",     value: stats.intakeComplete,  color: "text-purple-700" },
            { label: "Paid",            value: stats.paid,            color: "text-green-700" },
            { label: "Mailed",          value: stats.mailed,          color: "text-teal-700" },
            { label: "Active Campaigns",value: stats.activeCampaigns, color: "text-emerald-700" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white border border-gray-200 p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {(["leads", "campaigns"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition ${
                activeTab === tab
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab} ({tab === "leads" ? leads.length : campaigns.length})
            </button>
          ))}
        </div>

        {/* ── Leads Tab ───────────────────────────────────────────────────── */}
        {activeTab === "leads" && (
          <div className="space-y-2">
            {leads.length === 0 && (
              <div className="rounded-xl bg-white border border-gray-200 p-8 text-center text-gray-400">
                No leads yet. Add one with the button above or wait for Facebook form submissions.
              </div>
            )}
            {leads.map((lead) => (
              <div key={lead.id} className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 truncate">
                        {lead.name ?? lead.businessName ?? lead.email ?? "Unknown"}
                      </p>
                      <StatusBadge status={lead.status} colorMap={LEAD_STATUS_COLORS} />
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        {lead.source}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                      {lead.businessName && <span>🏢 {lead.businessName}</span>}
                      {lead.email && <span>📧 {lead.email}</span>}
                      {lead.phone && <span>📞 {lead.phone}</span>}
                      {lead.city && <span>📍 {lead.city}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
                      <span>Added {fmt(lead.createdAt)}</span>
                      {lead.intakeSentAt && <span>• Intake sent {fmt(lead.intakeSentAt)}</span>}
                      {lead.intakeSubmittedAt && <span>• Intake done {fmt(lead.intakeSubmittedAt)}</span>}
                      {lead.paidAt && <span>• Paid {fmt(lead.paidAt)}</span>}
                    </div>
                    {lead.notes && (
                      <p className="mt-1 text-xs text-gray-400 italic">{lead.notes}</p>
                    )}
                    {feedback?.id === lead.id && (
                      <p className="mt-1 text-xs font-semibold text-green-600">{feedback.msg}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 min-w-[140px]">
                    {/* Send intake link — available until intake_complete */}
                    {["new", "contacted", "intake_sent"].includes(lead.status) && lead.email && (
                      <button
                        onClick={() => sendIntake(lead.id)}
                        disabled={sending === lead.id}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {sending === lead.id ? "Sending…" : "📨 Send Intake Link"}
                      </button>
                    )}

                    {/* Copy intake link */}
                    {lead.intakeToken && (
                      <button
                        onClick={() => copyIntakeLink(lead.intakeToken)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        📋 Copy Intake Link
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Campaigns Tab ────────────────────────────────────────────────── */}
        {activeTab === "campaigns" && (
          <div className="space-y-2">
            {campaigns.length === 0 && (
              <div className="rounded-xl bg-white border border-gray-200 p-8 text-center text-gray-400">
                No campaigns yet. Campaigns are created when customers submit the intake form.
              </div>
            )}
            {campaigns.map((c) => (
              <div key={c.id} className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 truncate">{c.businessName}</p>
                      <StatusBadge status={c.status} colorMap={CAMPAIGN_STATUS_COLORS} />
                    </div>

                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                      {c.email && <span>📧 {c.email}</span>}
                      {c.phone && <span>📞 {c.phone}</span>}
                      {c.targetCity && <span>📍 {c.targetCity}</span>}
                      <span>🏠 {c.homesCount.toLocaleString()} homes</span>
                      <span>💰 ${(c.priceCents / 100).toLocaleString()}</span>
                    </div>

                    {c.businessAddress && (
                      <p className="mt-1 text-xs text-gray-400">📌 {c.businessAddress}</p>
                    )}
                    {c.targetAreaNotes && (
                      <p className="mt-1 text-xs text-gray-500 italic">"{c.targetAreaNotes}"</p>
                    )}

                    <div className="mt-2 flex gap-2 flex-wrap">
                      <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500">
                        Design: {c.designStatus.replace(/_/g, " ")}
                      </span>
                      <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500">
                        Mail: {c.mailingStatus.replace(/_/g, " ")}
                      </span>
                      {c.reviewRequested && (
                        <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-xs font-medium">
                          Review requested ✓
                        </span>
                      )}
                    </div>

                    {feedback?.id === c.id && (
                      <p className="mt-1 text-xs font-semibold text-green-600">{feedback.msg}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 min-w-[140px]">
                    {/* Mark as mailed — only available when status is paid/approved */}
                    {["paid", "design_queued", "design_in_progress", "design_ready", "approved"].includes(c.status) && (
                      <button
                        onClick={() => markMailed(c.id)}
                        disabled={mailing === c.id}
                        className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                      >
                        {mailing === c.id ? "Marking…" : "📬 Mark Mailed"}
                      </button>
                    )}
                    <p className="text-xs text-gray-400 text-center">
                      {fmt(c.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
