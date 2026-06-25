"use client";

import { useMemo, useState } from "react";
import { DailyTargetedOutreachPlan } from "../outreach-command/daily-targeted-outreach-plan";
import { TargetedGrowthCommandCenter } from "./targeted-growth-command-center";

interface LeadRow {
  id: string;
  name: string | null;
  businessName: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  city: string | null;
  notes: string | null;
  intakeToken: string | null;
  intakeSentAt: string | null;
  intakeSubmittedAt: string | null;
  paidAt: string | null;
  mailedAt: string | null;
  reviewRequested: boolean;
  createdAt: string;
}

interface CampaignRow {
  id: string;
  leadId: string | null;
  businessName: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  businessAddress: string | null;
  targetCity: string | null;
  targetAreaNotes: string | null;
  homesCount: number;
  priceCents: number;
  status: string;
  designStatus: string;
  mailingStatus: string;
  reviewRequested: boolean;
  notes: string | null;
  createdAt: string;
}

interface Props {
  leads: LeadRow[];
  campaigns: CampaignRow[];
}

const leadSourceOptions = ["facebook", "web", "manual", "sms", "referral"] as const;

type LeadSource = (typeof leadSourceOptions)[number];

interface LeadForm {
  name: string;
  businessName: string;
  email: string;
  phone: string;
  city: string;
  notes: string;
  source: LeadSource;
}

type FeedbackTone = "success" | "error" | "info";

const LEAD_STATUS_COLORS: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-amber-100 text-amber-800",
  intake_sent: "bg-blue-100 text-blue-700",
  intake_started: "bg-indigo-100 text-indigo-700",
  intake_complete: "bg-violet-100 text-violet-700",
  paid: "bg-emerald-100 text-emerald-700",
  active: "bg-emerald-100 text-emerald-700",
  mailed: "bg-teal-100 text-teal-700",
  review_requested: "bg-orange-100 text-orange-700",
};

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  intake_complete: "bg-violet-100 text-violet-700",
  paid: "bg-emerald-100 text-emerald-700",
  design_queued: "bg-blue-100 text-blue-700",
  design_in_progress: "bg-indigo-100 text-indigo-700",
  design_ready: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-700",
  mailed: "bg-teal-100 text-teal-700",
  complete: "bg-slate-100 text-slate-600",
  cancelled: "bg-red-100 text-red-700",
};

const activeCampaignStatuses = new Set(["paid", "design_queued", "design_in_progress", "design_ready", "approved"]);
const paidCampaignStatuses = new Set(["paid", "design_queued", "design_in_progress", "design_ready", "approved", "mailed", "complete"]);
const designStatusByCampaignStatus: Record<string, CampaignRow["designStatus"]> = {
  intake_complete: "not_started",
  design_queued: "queued",
  design_in_progress: "in_progress",
  design_ready: "ready",
  approved: "approved",
  cancelled: "not_started",
};

const lifecycleActions = [
  {
    from: "paid",
    nextStatus: "design_queued",
    label: "Queue design",
    detail: "Payment confirmed. Move this into creative production.",
  },
  {
    from: "design_queued",
    nextStatus: "design_in_progress",
    label: "Start design",
    detail: "Designer has picked up the campaign proof.",
  },
  {
    from: "design_in_progress",
    nextStatus: "design_ready",
    label: "Mark proof ready",
    detail: "Proof is ready for internal/client review.",
  },
  {
    from: "design_ready",
    nextStatus: "approved",
    label: "Approve proof",
    detail: "Use only after final proof, route, and price have been reviewed.",
  },
] as const;

function StatusBadge({ status, colorMap }: { status: string; colorMap: Record<string, string> }) {
  const color = colorMap[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function fmt(iso: string | null) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function leadTitle(lead: LeadRow) {
  return lead.businessName ?? lead.name ?? lead.email ?? "Unassigned lead";
}

function campaignRouteLabel(campaign: CampaignRow) {
  if (campaign.targetCity && campaign.targetAreaNotes) return `${campaign.targetCity} route notes ready`;
  if (campaign.targetCity) return `${campaign.targetCity} route scoped`;
  return "Route needs review";
}

function isCampaignMailReady(campaign: CampaignRow) {
  return campaign.status === "approved" && campaign.designStatus === "approved" && campaign.mailingStatus !== "mailed";
}

function getCampaignLifecycleAction(campaign: CampaignRow) {
  if (campaign.status === "approved" && campaign.designStatus !== "approved") {
    return lifecycleActions.find((action) => action.nextStatus === "approved") ?? null;
  }

  return lifecycleActions.find((action) => action.from === campaign.status) ?? null;
}

function getLeadNextStep(lead: LeadRow) {
  if (["new", "contacted"].includes(lead.status)) {
    return lead.email
      ? { title: "Send intake link", detail: "Customer can start quote details before creating an account.", tone: "high" as const }
      : { title: "Add email before intake", detail: "This lead needs a reachable email to keep the flow done-for-you.", tone: "high" as const };
  }
  if (lead.status === "intake_sent") {
    return { title: "Watch for intake", detail: "Resend only if the customer stalls or asks for help.", tone: "medium" as const };
  }
  if (lead.status === "intake_started") {
    return { title: "Help finish intake", detail: "Customer has started. A quick human nudge may save the lead.", tone: "medium" as const };
  }
  if (lead.status === "intake_complete") {
    return { title: "Review quote and payment", detail: "Route, price, and payment handoff should be checked next.", tone: "high" as const };
  }
  if (lead.status === "paid" || lead.status === "active") {
    return { title: "Campaign is active", detail: "HomeReach should move design and route execution forward.", tone: "low" as const };
  }
  if (lead.status === "mailed" || lead.status === "review_requested") {
    return { title: "Track proof and review", detail: "Customer should see that delivery and follow-up are handled.", tone: "low" as const };
  }
  return { title: "Review lead", detail: "Confirm the next customer-facing step.", tone: "medium" as const };
}

function getCampaignNextStep(campaign: CampaignRow) {
  if (campaign.status === "intake_complete") {
    return { title: "Confirm quote and payment", detail: "Customer has finished intake. The next visible win is payment clarity.", tone: "high" as const };
  }
  if (campaign.designStatus === "ready" || campaign.status === "design_ready") {
    return { title: "Approve creative", detail: "Design is ready. Review it before mailing anything.", tone: "high" as const };
  }
  if (isCampaignMailReady(campaign)) {
    return { title: "Prepare mailing", detail: "Proof is approved. Confirm route count, drop timing, and notification readiness.", tone: "medium" as const };
  }
  if (campaign.status === "mailed" || campaign.mailingStatus === "mailed") {
    return { title: "Verify delivery proof", detail: "Campaign is in market. Keep proof and review follow-up visible.", tone: "low" as const };
  }
  if (campaign.status === "complete") {
    return { title: "Campaign complete", detail: "Use results and customer feedback to tee up the next drop.", tone: "low" as const };
  }
  return { title: "Review campaign", detail: "Confirm route, price, payment, design, and mail readiness.", tone: "medium" as const };
}

function toneClass(tone: "high" | "medium" | "low") {
  if (tone === "high") return "border-red-200 bg-red-50 text-red-800";
  if (tone === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function feedbackClass(tone: FeedbackTone) {
  if (tone === "error") return "text-red-700";
  if (tone === "success") return "text-emerald-700";
  return "text-blue-700";
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
      <span className="font-semibold text-slate-800">{label}:</span> {value}
    </span>
  );
}

function CreateLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<LeadForm>({
    name: "",
    businessName: "",
    email: "",
    phone: "",
    city: "",
    notes: "",
    source: "facebook",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof LeadForm>(field: K, value: LeadForm[K]) {
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
      if (!res.ok) {
        setError(data.error ?? "Lead could not be created.");
        setLoading(false);
        return;
      }
      onCreated();
      onClose();
    } catch {
      setError("Network error. The lead was not created.");
      setLoading(false);
    }
  }

  const fields: Array<{ label: string; field: Exclude<keyof LeadForm, "source" | "notes">; placeholder: string; type?: string }> = [
    { label: "Name", field: "name", placeholder: "Jane Smith" },
    { label: "Business Name", field: "businessName", placeholder: "Jane's Cleaning Co." },
    { label: "Email", field: "email", placeholder: "jane@business.com", type: "email" },
    { label: "Phone", field: "phone", placeholder: "(330) 555-0100" },
    { label: "City", field: "city", placeholder: "Akron, OH" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Targeted campaign lead</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Add a customer and keep the intake simple</h2>
          <p className="mt-1 text-sm text-slate-500">
            They can start the quote first. Account creation can happen later when it is actually needed.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {fields.map(({ label, field, placeholder, type }) => (
            <div key={field}>
              <label className="text-sm font-medium text-slate-700">{label}</label>
              <input
                type={type ?? "text"}
                value={form[field]}
                onChange={(event) => update(field, event.target.value)}
                placeholder={placeholder}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          ))}

          <div>
            <label className="text-sm font-medium text-slate-700">Source</label>
            <select
              value={form.source}
              onChange={(event) => update("source", event.target.value as LeadSource)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {leadSourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="What does this customer want to accomplish?"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 rounded-xl bg-blue-700 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MailConfirmationModal({
  campaign,
  loading,
  onClose,
  onConfirm,
}: {
  campaign: CampaignRow;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Proof-approved mail action</p>
        <h2 className="mt-1 text-xl font-bold text-slate-950">Mark campaign mailed and notify the customer?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This sends customer-facing mailed and review-request messages. Use it only after proof approval, route count,
          print handoff, and mail entry have been verified.
        </p>

        <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Campaign</span>
            <span className="text-right font-bold text-slate-950">{campaign.businessName}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Households</span>
            <span className="font-bold text-slate-950">{campaign.homesCount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Proof status</span>
            <span className="font-bold text-slate-950">{campaign.designStatus.replace(/_/g, " ")}</span>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-teal-700 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending..." : "Confirm mailed + notify"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TargetedCampaignsClient({ leads: initialLeads, campaigns: initialCampaigns }: Props) {
  const [leads, setLeads] = useState<LeadRow[]>(initialLeads);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(initialCampaigns);
  const [activeTab, setActiveTab] = useState<"leads" | "campaigns">("leads");
  const [showCreate, setShowCreate] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [mailing, setMailing] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [mailConfirmCampaignId, setMailConfirmCampaignId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; msg: string; tone: FeedbackTone } | null>(null);

  const stats = useMemo(() => {
    const waitingOnCustomer = leads.filter((lead) => ["intake_sent", "intake_started"].includes(lead.status)).length;
    const readyForQuote = leads.filter((lead) => lead.status === "intake_complete").length;
    const paidOrActive = leads.filter((lead) => lead.status === "paid" || lead.status === "active").length;
    const activeCampaigns = campaigns.filter((campaign) => activeCampaignStatuses.has(campaign.status)).length;
    const readyToMail = campaigns.filter((campaign) => isCampaignMailReady(campaign)).length;
    const mailed = campaigns.filter((campaign) => campaign.status === "mailed" || campaign.mailingStatus === "mailed" || campaign.reviewRequested).length;
    const pipelineCents = campaigns.reduce((sum, campaign) => sum + campaign.priceCents, 0);
    const homesQueued = campaigns
      .filter((campaign) => activeCampaignStatuses.has(campaign.status) || campaign.status === "mailed")
      .reduce((sum, campaign) => sum + campaign.homesCount, 0);
    const ownerActions =
      leads.filter((lead) => ["new", "contacted", "intake_complete"].includes(lead.status)).length +
      campaigns.filter((campaign) => campaign.status === "intake_complete" || campaign.designStatus === "ready" || isCampaignMailReady(campaign)).length;

    return {
      newLeads: leads.filter((lead) => lead.status === "new").length,
      waitingOnCustomer,
      readyForQuote,
      paidOrActive,
      activeCampaigns,
      readyToMail,
      mailed,
      pipelineCents,
      homesQueued,
      ownerActions,
    };
  }, [campaigns, leads]);

  const mailConfirmCampaign = campaigns.find((campaign) => campaign.id === mailConfirmCampaignId) ?? null;

  const actionItems = useMemo(() => {
    const leadItems = leads
      .map((lead) => ({ type: "lead" as const, id: lead.id, title: leadTitle(lead), next: getLeadNextStep(lead), createdAt: lead.createdAt }))
      .filter((item) => item.next.tone !== "low");
    const campaignItems = campaigns
      .map((campaign) => ({
        type: "campaign" as const,
        id: campaign.id,
        title: campaign.businessName,
        next: getCampaignNextStep(campaign),
        createdAt: campaign.createdAt,
      }))
      .filter((item) => item.next.tone !== "low");

    const priority = { high: 0, medium: 1, low: 2 };
    return [...leadItems, ...campaignItems]
      .sort((a, b) => priority[a.next.tone] - priority[b.next.tone])
      .slice(0, 5);
  }, [campaigns, leads]);

  const aiRecommendations = useMemo(() => {
    const incompleteLeads = leads.filter((lead) => ["new", "contacted", "intake_sent", "intake_started"].includes(lead.status));
    const highIntentCampaigns = campaigns.filter((campaign) => campaign.status === "intake_complete");
    const expansionCampaigns = campaigns.filter((campaign) => campaign.status === "mailed" || campaign.mailingStatus === "mailed");

    return [
      {
        title: "Turn incomplete demand into territory reviews",
        detail: `${incompleteLeads.length} leads can be moved toward a simple intake or quote review before they cool off.`,
        action: "Prioritize intake nudges",
      },
      {
        title: "Protect the paid path",
        detail: `${highIntentCampaigns.length} completed intakes need quote clarity, checkout confidence, or approval prep.`,
        action: "Review quote handoff",
      },
      {
        title: "Find expansion moments",
        detail: `${expansionCampaigns.length} mailed campaigns may be ready for repeat visibility, adjacent routes, or review follow-up.`,
        action: "Review next drop fit",
      },
    ];
  }, [campaigns, leads]);

  function showFeedback(id: string, msg: string, tone: FeedbackTone = "success") {
    setFeedback({ id, msg, tone });
    window.setTimeout(() => setFeedback(null), 3500);
  }

  async function sendIntake(leadId: string) {
    setSending(leadId);
    try {
      const res = await fetch("/api/targeted/admin/send-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, confirmSend: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setLeads((prev) =>
          prev.map((lead) =>
            lead.id === leadId
              ? { ...lead, status: "intake_sent", intakeSentAt: new Date().toISOString() }
              : lead,
          ),
        );
        showFeedback(leadId, "Intake link sent. Customer can start the quote now.");
      } else {
        showFeedback(leadId, data.error ?? "Intake link could not be sent.", "error");
      }
    } catch {
      showFeedback(leadId, "Network error. Intake link was not sent.", "error");
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
        body: JSON.stringify({ campaignId, confirmNotify: true }),
      });
      if (res.ok) {
        setCampaigns((prev) =>
          prev.map((campaign) =>
            campaign.id === campaignId
              ? {
                  ...campaign,
                  status: "mailed",
                  mailingStatus: "mailed",
                  reviewRequested: true,
                }
              : campaign,
          ),
        );
        setMailConfirmCampaignId(null);
        showFeedback(campaignId, "Marked mailed. Customer notification and review request were sent.");
      } else {
        const data = await res.json();
        showFeedback(campaignId, data.error ?? "Campaign could not be marked mailed.", "error");
      }
    } catch {
      showFeedback(campaignId, "Network error. Campaign was not marked mailed.", "error");
    } finally {
      setMailing(null);
    }
  }

  async function updateCampaignLifecycle(campaignId: string, nextStatus: string) {
    setStatusUpdating(campaignId);
    try {
      const res = await fetch("/api/targeted/admin/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "campaign", id: campaignId, status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setCampaigns((prev) =>
          prev.map((campaign) =>
            campaign.id === campaignId
              ? {
                  ...campaign,
                  status: nextStatus,
                  designStatus: designStatusByCampaignStatus[nextStatus] ?? campaign.designStatus,
                }
              : campaign,
          ),
        );
        showFeedback(campaignId, `Campaign moved to ${nextStatus.replace(/_/g, " ")}.`);
      } else {
        showFeedback(campaignId, data.error ?? "Campaign status could not be updated.", "error");
      }
    } catch {
      showFeedback(campaignId, "Network error. Campaign status was not updated.", "error");
    } finally {
      setStatusUpdating(null);
    }
  }

  async function copyIntakeLink(leadId: string, token: string | null) {
    if (!token) {
      showFeedback(leadId, "No intake token exists yet.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(`${window.location.origin}/targeted/intake?token=${token}`);
      showFeedback(leadId, "Intake link copied.");
    } catch {
      showFeedback(leadId, "Clipboard access failed. Open the lead and copy manually.", "error");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {showCreate && <CreateLeadModal onClose={() => setShowCreate(false)} onCreated={() => window.location.reload()} />}
      {mailConfirmCampaign && (
        <MailConfirmationModal
          campaign={mailConfirmCampaign}
          loading={mailing === mailConfirmCampaign.id}
          onClose={() => setMailConfirmCampaignId(null)}
          onConfirm={() => markMailed(mailConfirmCampaign.id)}
        />
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <DailyTargetedOutreachPlan />

        <TargetedGrowthCommandCenter
          leads={leads}
          campaigns={campaigns}
          onFocusTab={setActiveTab}
          onCreateLead={() => setShowCreate(true)}
          onCampaignCommand={(campaignId, message, tone = "info") => showFeedback(campaignId, message, tone)}
        />

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Pipeline value", value: money(stats.pipelineCents), detail: "quoted targeted campaigns" },
            { label: "Homes queued", value: stats.homesQueued.toLocaleString(), detail: "active or mailed reach" },
            { label: "Ready for quote", value: stats.readyForQuote.toString(), detail: "completed intakes" },
            { label: "Ready to mail", value: stats.readyToMail.toString(), detail: "proof-approved only" },
            { label: "Waiting on customer", value: stats.waitingOnCustomer.toString(), detail: "intake still open" },
          ].map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{metric.value}</p>
              <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
            </div>
          ))}
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.72fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Do this first</h2>
                <p className="text-sm text-slate-500">The shortest path to money collected and postcards in market.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {actionItems.length} active priorities
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {actionItems.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  No urgent targeted-campaign actions. The current pipeline is clear enough for normal monitoring.
                </div>
              ) : (
                actionItems.map((item) => (
                  <div key={`${item.type}-${item.id}`} className={`rounded-xl border p-4 ${toneClass(item.next.tone)}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-75">
                          {item.type === "lead" ? "Lead" : "Campaign"} - {fmt(item.createdAt)}
                        </p>
                        <p className="mt-1 font-bold">{item.title}</p>
                        <p className="mt-1 text-sm">{item.next.title}</p>
                        <p className="mt-1 text-xs opacity-80">{item.next.detail}</p>
                      </div>
                      <button
                        onClick={() => setActiveTab(item.type === "lead" ? "leads" : "campaigns")}
                        className="rounded-lg bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-white"
                      >
                        View {item.type}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Done-for-you flow</h2>
            <p className="mt-1 text-sm text-slate-500">Each campaign should move through these owner-visible gates.</p>
            <div className="mt-4 space-y-3">
              {[
                ["1", "Intake", `${stats.newLeads} new leads, ${stats.waitingOnCustomer} waiting`],
                ["2", "Quote and payment", `${stats.readyForQuote} ready for review, ${stats.paidOrActive} paid or active`],
                ["3", "Design and route", `${stats.activeCampaigns} active campaigns`],
                ["4", "Mail and review", `${stats.mailed} mailed or review requested`],
              ].map(([step, title, detail]) => (
                <div key={step} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
                    {step}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{title}</p>
                    <p className="text-xs text-slate-500">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">AI recommendations</h2>
              <p className="text-sm text-slate-500">
                Recommendations prepare the next human-controlled action. They do not send, publish, charge, or mail.
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Approval-first
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {aiRecommendations.map((item) => (
              <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-950">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-blue-700">{item.action}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
            <div className="flex gap-1">
              {(["leads", "campaigns"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-semibold capitalize transition ${
                    activeTab === tab
                      ? "border-b-2 border-blue-700 text-blue-700"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab} ({tab === "leads" ? leads.length : campaigns.length})
                </button>
              ))}
            </div>

            <p className="pb-3 text-xs font-medium text-slate-500">
              Actions stay human-controlled. This dashboard prepares the next step; it does not launch mail without review.
            </p>
          </div>

          {activeTab === "leads" && (
            <div className="mt-4 space-y-3">
              {leads.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <h3 className="text-lg font-bold text-slate-950">No targeted leads yet</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Add a lead manually or let Facebook and web forms feed this queue. The first step is always a simple intake link.
                  </p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="mt-5 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800"
                  >
                    Add first lead
                  </button>
                </div>
              ) : (
                leads.map((lead) => {
                  const next = getLeadNextStep(lead);
                  const canSendIntake = ["new", "contacted", "intake_sent"].includes(lead.status) && Boolean(lead.email);
                  return (
                    <div key={lead.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-lg font-bold text-slate-950">{leadTitle(lead)}</p>
                            <StatusBadge status={lead.status} colorMap={LEAD_STATUS_COLORS} />
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                              {lead.source}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {lead.name && <InfoPill label="Contact" value={lead.name} />}
                            {lead.email && <InfoPill label="Email" value={lead.email} />}
                            {lead.phone && <InfoPill label="Phone" value={lead.phone} />}
                            {lead.city && <InfoPill label="Market" value={lead.city} />}
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-4">
                            <span>Added {fmt(lead.createdAt)}</span>
                            <span>Intake sent {fmt(lead.intakeSentAt)}</span>
                            <span>Intake done {fmt(lead.intakeSubmittedAt)}</span>
                            <span>Paid {fmt(lead.paidAt)}</span>
                          </div>

                          {lead.notes && (
                            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{lead.notes}</p>
                          )}

                          <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${toneClass(next.tone)}`}>
                            <p className="font-bold">Customer next step: {next.title}</p>
                            <p className="mt-0.5 text-xs opacity-80">{next.detail}</p>
                          </div>

                          {feedback?.id === lead.id && (
                            <p className={`mt-2 text-xs font-semibold ${feedbackClass(feedback.tone)}`}>{feedback.msg}</p>
                          )}
                        </div>

                        <div className="flex w-full flex-col gap-2 sm:w-44">
                          {canSendIntake ? (
                            <button
                              onClick={() => sendIntake(lead.id)}
                              disabled={sending === lead.id}
                              className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {sending === lead.id ? "Sending..." : "Send intake link"}
                            </button>
                          ) : ["new", "contacted", "intake_sent"].includes(lead.status) ? (
                            <button
                              disabled
                              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-400"
                              title="Add an email before sending an intake link."
                            >
                              Email needed
                            </button>
                          ) : null}

                          {lead.intakeToken && (
                            <button
                              onClick={() => copyIntakeLink(lead.id, lead.intakeToken)}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Copy intake link
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "campaigns" && (
            <div className="mt-4 space-y-3">
              {campaigns.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <h3 className="text-lg font-bold text-slate-950">No targeted campaigns yet</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Campaigns appear here after a customer submits the intake form. The admin path will then show route,
                    quote, payment, design, and mail readiness.
                  </p>
                </div>
              ) : (
                campaigns.map((campaign) => {
                  const next = getCampaignNextStep(campaign);
                  const paidLabel = paidCampaignStatuses.has(campaign.status) ? "Paid" : "Waiting";
                  const routeLabel = campaign.homesCount > 0 ? "Scoped" : "Needs review";
                  const lifecycleAction = getCampaignLifecycleAction(campaign);

                  return (
                    <div key={campaign.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-lg font-bold text-slate-950">{campaign.businessName}</p>
                            <StatusBadge status={campaign.status} colorMap={CAMPAIGN_STATUS_COLORS} />
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {campaign.contactName && <InfoPill label="Contact" value={campaign.contactName} />}
                            {campaign.email && <InfoPill label="Email" value={campaign.email} />}
                            {campaign.phone && <InfoPill label="Phone" value={campaign.phone} />}
                            <InfoPill label="Market" value={campaign.targetCity ?? "Needs city"} />
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                            {[
                              ["Route", routeLabel, campaignRouteLabel(campaign)],
                              ["Quote", money(campaign.priceCents), `${campaign.homesCount.toLocaleString()} homes`],
                              ["Payment", paidLabel, campaign.status.replace(/_/g, " ")],
                              ["Design", campaign.designStatus.replace(/_/g, " "), "Creative approval gate"],
                              ["Mail", campaign.mailingStatus.replace(/_/g, " "), campaign.reviewRequested ? "Review requested" : "Review not requested"],
                            ].map(([label, value, detail]) => (
                              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
                                <p className="mt-1 font-bold text-slate-950">{value}</p>
                                <p className="mt-1 text-xs text-slate-500">{detail}</p>
                              </div>
                            ))}
                          </div>

                          {campaign.businessAddress && (
                            <p className="mt-3 text-sm text-slate-500">Business address: {campaign.businessAddress}</p>
                          )}

                          {campaign.targetAreaNotes && (
                            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              Route notes: {campaign.targetAreaNotes}
                            </p>
                          )}

                          <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${toneClass(next.tone)}`}>
                            <p className="font-bold">Admin next step: {next.title}</p>
                            <p className="mt-0.5 text-xs opacity-80">{next.detail}</p>
                          </div>

                          {feedback?.id === campaign.id && (
                            <p className={`mt-2 text-xs font-semibold ${feedbackClass(feedback.tone)}`}>{feedback.msg}</p>
                          )}
                        </div>

                        <div className="flex w-full flex-col gap-2 sm:w-44">
                          {lifecycleAction && (
                            <button
                              onClick={() => updateCampaignLifecycle(campaign.id, lifecycleAction.nextStatus)}
                              disabled={statusUpdating === campaign.id}
                              title={lifecycleAction.detail}
                              className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {statusUpdating === campaign.id ? "Updating..." : lifecycleAction.label}
                            </button>
                          )}
                          {isCampaignMailReady(campaign) && (
                            <button
                              onClick={() => setMailConfirmCampaignId(campaign.id)}
                              disabled={mailing === campaign.id}
                              className="rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {mailing === campaign.id ? "Marking..." : "Mark mailed + notify"}
                            </button>
                          )}
                          <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-medium text-slate-500">
                            Created {fmt(campaign.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
