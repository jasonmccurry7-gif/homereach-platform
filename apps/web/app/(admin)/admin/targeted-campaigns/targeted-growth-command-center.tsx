"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Copy,
  Crosshair,
  FileCheck,
  Gauge,
  Layers3,
  LockKeyhole,
  MailCheck,
  MapPinned,
  Megaphone,
  MessageSquareText,
  PauseCircle,
  PenLine,
  Radar,
  Rocket,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  Zap,
} from "lucide-react";

type TargetedLead = {
  id: string;
  businessName: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  source: string;
  status: string;
  createdAt: string;
};

type TargetedCampaign = {
  id: string;
  businessName: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  targetCity: string | null;
  targetAreaNotes: string | null;
  businessAddress: string | null;
  homesCount: number;
  priceCents: number;
  status: string;
  designStatus: string;
  mailingStatus: string;
  reviewRequested: boolean;
  createdAt: string;
};

type CommandTone = "success" | "error" | "info";

type Props = {
  leads: TargetedLead[];
  campaigns: TargetedCampaign[];
  onFocusTab: (tab: "leads" | "campaigns") => void;
  onCreateLead: () => void;
  onCampaignCommand: (campaignId: string, message: string, tone?: CommandTone) => void;
};

type AgentPriority = "critical" | "high" | "medium" | "low";

type AgentMission = {
  id: string;
  agent: string;
  role: string;
  icon: LucideIcon;
  priority: AgentPriority;
  count: number;
  focus: string;
  output: string;
  approvalStatus: string;
  nextAction: string;
  relatedEntity: string;
  destination: string;
  sources: string[];
};

type VerticalKey =
  | "roofing"
  | "hvac"
  | "plumbing"
  | "landscaping"
  | "restaurant"
  | "dentist"
  | "realtor"
  | "political";

const verticalPlaybooks: Array<{
  key: VerticalKey;
  label: string;
  icon: LucideIcon;
  avgTicket: number;
  closeRate: number;
  responseRate: number;
  offer: string;
  headline: string;
  target: string;
  cadence: string;
  qrStrategy: string;
}> = [
  {
    key: "roofing",
    label: "Roofing",
    icon: ShieldCheck,
    avgTicket: 9200,
    closeRate: 18,
    responseRate: 1.15,
    offer: "Free roof inspection after recent weather",
    headline: "Know what your roof needs before the next storm.",
    target: "Owner-occupied homes, older roofs, storm-sensitive neighborhoods",
    cadence: "3 drops across 45 days during peak season",
    qrStrategy: "Inspection scheduler with storm-readiness checklist",
  },
  {
    key: "hvac",
    label: "HVAC",
    icon: Activity,
    avgTicket: 6800,
    closeRate: 16,
    responseRate: 1.05,
    offer: "Seasonal tune-up and replacement readiness check",
    headline: "Stay comfortable before the rush hits.",
    target: "High-density homeowner routes near service history",
    cadence: "Pre-season launch plus monthly maintenance reminders",
    qrStrategy: "Tune-up booking page with SMS reminder flow",
  },
  {
    key: "plumbing",
    label: "Plumbing",
    icon: Gauge,
    avgTicket: 1400,
    closeRate: 22,
    responseRate: 0.95,
    offer: "Priority service call for nearby homeowners",
    headline: "A local plumber homeowners can keep on the fridge.",
    target: "Neighborhoods around existing repeat customers",
    cadence: "Quarterly local visibility wave",
    qrStrategy: "Emergency contact save page plus quote request",
  },
  {
    key: "landscaping",
    label: "Landscaping",
    icon: Layers3,
    avgTicket: 2400,
    closeRate: 20,
    responseRate: 0.9,
    offer: "Seasonal cleanup or lawn care route pricing",
    headline: "Make the neighborhood notice your yard first.",
    target: "Subdivisions and high-curb-appeal homeowner clusters",
    cadence: "Spring launch with 2 follow-up drops",
    qrStrategy: "Photo estimate intake with address capture",
  },
  {
    key: "restaurant",
    label: "Restaurants",
    icon: Megaphone,
    avgTicket: 42,
    closeRate: 38,
    responseRate: 2.1,
    offer: "Neighborhood-only family meal or first-order offer",
    headline: "Your next easy dinner is right around the corner.",
    target: "Carrier routes within short drive-time of the store",
    cadence: "Monthly menu waves and seasonal offer drops",
    qrStrategy: "Menu QR with trackable offer code",
  },
  {
    key: "dentist",
    label: "Dentists",
    icon: Sparkles,
    avgTicket: 1250,
    closeRate: 14,
    responseRate: 0.72,
    offer: "New patient welcome exam",
    headline: "A nearby dental team for the whole family.",
    target: "Family homeowner routes and relocation-heavy zones",
    cadence: "Awareness launch plus quarterly retention waves",
    qrStrategy: "New patient scheduler with insurance fit prompts",
  },
  {
    key: "realtor",
    label: "Realtors",
    icon: MapPinned,
    avgTicket: 7200,
    closeRate: 8,
    responseRate: 0.65,
    offer: "Neighborhood home value review",
    headline: "Curious what homes near you are really selling for?",
    target: "High-equity subdivisions and move-up buyer corridors",
    cadence: "Monthly market update series",
    qrStrategy: "Home value landing page with CMA request",
  },
  {
    key: "political",
    label: "Political",
    icon: Radar,
    avgTicket: 0,
    closeRate: 0,
    responseRate: 1.4,
    offer: "Candidate introduction and vote-plan reminder",
    headline: "A clear message delivered to the right geography.",
    target: "Geography, public race context, route density, and timing only",
    cadence: "Introduction, contrast, and GOTV waves",
    qrStrategy: "Campaign-approved voter information or donation page",
  },
];

type VerticalPlaybook = (typeof verticalPlaybooks)[number];

const defaultVertical = verticalPlaybooks[0] as VerticalPlaybook;

function getVerticalPlaybook(key: VerticalKey): VerticalPlaybook {
  return verticalPlaybooks.find((vertical) => vertical.key === key) ?? defaultVertical;
}

const planningModes = [
  { key: "zip", label: "ZIP", multiplier: 1, signal: "Broad market scan" },
  { key: "city", label: "City", multiplier: 1.45, signal: "City-wide saturation view" },
  { key: "route", label: "Route", multiplier: 0.82, signal: "Route-level precision" },
  { key: "radius", label: "Radius", multiplier: 1.2, signal: "Radius around customer base" },
  { key: "neighbor", label: "Neighbors", multiplier: 0.68, signal: "Neighbors of existing customers" },
  { key: "district", label: "District", multiplier: 1.35, signal: "District overlay planning" },
] as const;

const campaignCommandButtons: Array<{ label: string; icon: LucideIcon; tone: "primary" | "neutral" }> = [
  { label: "Prepare Launch Review", icon: Rocket, tone: "primary" },
  { label: "Edit", icon: PenLine, tone: "neutral" },
  { label: "Duplicate", icon: Copy, tone: "neutral" },
  { label: "Pause", icon: PauseCircle, tone: "neutral" },
  { label: "View Analytics", icon: BarChart3, tone: "neutral" },
  { label: "Approve Proof", icon: ClipboardCheck, tone: "neutral" },
  { label: "Expand Territory", icon: Target, tone: "neutral" },
  { label: "AI Recommendations", icon: Brain, tone: "neutral" },
];

function formatUsd(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number) {
  return `${value.toFixed(value < 1 ? 2 : 1)}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function shortDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysSince(value: string) {
  const createdAt = parseDate(value).getTime();
  return Math.max(0, Math.floor((Date.now() - createdAt) / 86_400_000));
}

function statusProgress(campaign: TargetedCampaign) {
  if (campaign.status === "complete") return 100;
  if (campaign.status === "mailed" || campaign.mailingStatus === "mailed") return 88;
  if (campaign.status === "approved") return 72;
  if (campaign.status === "design_ready" || campaign.designStatus === "ready") return 62;
  if (campaign.status === "design_in_progress" || campaign.designStatus === "in_progress") return 48;
  if (campaign.status === "design_queued" || campaign.designStatus === "queued") return 38;
  if (campaign.status === "paid") return 30;
  if (campaign.status === "intake_complete") return 18;
  return 8;
}

function statusLabel(campaign: TargetedCampaign) {
  if (campaign.status === "intake_complete") return "Quote ready";
  if (campaign.status === "paid") return "Paid - queue design";
  if (campaign.status === "design_queued") return "Design queued";
  if (campaign.status === "design_in_progress") return "Design in progress";
  if (campaign.status === "design_ready") return "Proof ready";
  if (campaign.status === "approved") return "Approved to mail";
  if (campaign.status === "mailed") return "In market";
  if (campaign.status === "complete") return "Complete";
  return campaign.status.replace(/_/g, " ");
}

function campaignMetrics(campaign: TargetedCampaign, vertical: VerticalPlaybook = defaultVertical) {
  const spend = campaign.priceCents / 100;
  const routeNotesBonus = campaign.targetAreaNotes ? 0.18 : 0;
  const paidBonus = ["paid", "design_queued", "design_in_progress", "design_ready", "approved", "mailed", "complete"].includes(campaign.status)
    ? 0.14
    : 0;
  const responseRate = clamp(vertical.responseRate + routeNotesBonus + paidBonus - (campaign.homesCount > 2500 ? 0.1 : 0), 0.35, 3.25);
  const projectedLeads = Math.max(1, Math.round(campaign.homesCount * (responseRate / 100)));
  const projectedConversions = vertical.avgTicket > 0 ? Math.max(1, Math.round(projectedLeads * (vertical.closeRate / 100))) : 0;
  const projectedRevenue = projectedConversions * vertical.avgTicket;
  const projectedRoi = spend > 0 ? projectedRevenue / spend : 0;
  const impressions = Math.round(campaign.homesCount * (campaign.status === "mailed" ? 2.7 : 2.2));
  const progress = statusProgress(campaign);
  const aiScore = clamp(
    56 +
      Math.round(progress * 0.24) +
      (campaign.targetCity ? 6 : 0) +
      (campaign.targetAreaNotes ? 8 : 0) +
      (campaign.homesCount >= 2500 ? 5 : 0),
    48,
    96,
  );
  const performanceScore = clamp(Math.round(aiScore - 7 + projectedLeads / 2), 42, 97);
  const routeDensity = campaign.homesCount >= 5000 ? "High saturation" : campaign.homesCount >= 2500 ? "Strong density" : "Focused route";
  const estimatedDropDate = shortDate(addDays(parseDate(campaign.createdAt), progress > 70 ? 4 : progress > 35 ? 8 : 12));

  return {
    spend,
    responseRate,
    projectedLeads,
    projectedConversions,
    projectedRevenue,
    projectedRoi,
    impressions,
    progress,
    aiScore,
    performanceScore,
    routeDensity,
    estimatedDropDate,
  };
}

function getMarketName(campaigns: TargetedCampaign[], leads: TargetedLead[]) {
  return campaigns.find((campaign) => campaign.targetCity)?.targetCity ?? leads.find((lead) => lead.city)?.city ?? "Primary market";
}

function getMarketSignals(campaigns: TargetedCampaign[], leads: TargetedLead[]) {
  const counts = new Map<string, { leads: number; campaigns: number; homes: number }>();

  for (const lead of leads) {
    if (!lead.city) continue;
    const current = counts.get(lead.city) ?? { leads: 0, campaigns: 0, homes: 0 };
    current.leads += 1;
    counts.set(lead.city, current);
  }

  for (const campaign of campaigns) {
    if (!campaign.targetCity) continue;
    const current = counts.get(campaign.targetCity) ?? { leads: 0, campaigns: 0, homes: 0 };
    current.campaigns += 1;
    current.homes += campaign.homesCount;
    counts.set(campaign.targetCity, current);
  }

  return Array.from(counts.entries())
    .map(([city, value]) => ({ city, ...value }))
    .sort((a, b) => b.campaigns + b.leads - (a.campaigns + a.leads))
    .slice(0, 4);
}

function priorityClass(priority: AgentPriority) {
  if (priority === "critical") return "border-red-200 bg-red-50 text-red-800";
  if (priority === "high") return "border-amber-200 bg-amber-50 text-amber-900";
  if (priority === "medium") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function buildAgentMissions(
  leads: TargetedLead[],
  campaigns: TargetedCampaign[],
  selectedVertical: VerticalPlaybook,
): AgentMission[] {
  const incompleteLeads = leads.filter((lead) =>
    ["new", "contacted", "intake_sent", "intake_started"].includes(lead.status),
  );
  const staleLeads = incompleteLeads.filter((lead) => daysSince(lead.createdAt) >= 2);
  const quoteReady = campaigns.filter((campaign) => campaign.status === "intake_complete");
  const productionReady = campaigns.filter((campaign) =>
    ["paid", "design_queued", "design_in_progress"].includes(campaign.status),
  );
  const proofReady = campaigns.filter(
    (campaign) => campaign.status === "design_ready" || campaign.designStatus === "ready",
  );
  const mailReady = campaigns.filter(
    (campaign) =>
      ["approved", "paid", "design_queued", "design_in_progress", "design_ready"].includes(campaign.status) &&
      campaign.mailingStatus !== "mailed",
  );
  const expansionReady = campaigns.filter(
    (campaign) => campaign.status === "mailed" || campaign.reviewRequested || campaign.mailingStatus === "mailed",
  );
  const missingRouteContext = campaigns.filter(
    (campaign) => !campaign.targetCity || !campaign.targetAreaNotes || campaign.homesCount < 500,
  );
  const pricingRisk = campaigns.filter((campaign) => campaign.priceCents <= 0 || campaign.homesCount <= 0);
  const activeBottlenecks = quoteReady.length + proofReady.length + mailReady.length;

  return [
    {
      id: "orchestrator",
      agent: "Orchestrator Agent",
      role: "Campaign command sequencing",
      icon: Brain,
      priority: activeBottlenecks > 0 ? "critical" : "medium",
      count: activeBottlenecks,
      focus: "Coordinate quote review, proof approval, production readiness, and launch handoff.",
      output: "Task manifest draft with owner, status, expected output, approval flag, and next action.",
      approvalStatus: "Planning only. Human approval required before downstream action.",
      nextAction: activeBottlenecks > 0 ? "Prepare the next-action stack for active bottlenecks." : "Monitor queue and keep priorities current.",
      relatedEntity: activeBottlenecks > 0 ? "targeted_route_campaigns" : "targeted campaign pipeline",
      destination: "ai_workforce_tasks",
      sources: ["targeted_route_campaigns", "leads", "AGENTS.md"],
    },
    {
      id: "revenue-integrity",
      agent: "Revenue Integrity Agent",
      role: "Launch and payment recovery",
      icon: CircleDollarSign,
      priority: quoteReady.length + staleLeads.length > 0 ? "high" : "low",
      count: quoteReady.length + staleLeads.length,
      focus: "Find completed intakes, stalled leads, missed follow-ups, and checkout hesitation.",
      output: "Revenue risk list with recovery draft recommendations and owner decisions needed.",
      approvalStatus: "Draft only. No charges, discounts, or payment state changes.",
      nextAction: quoteReady.length > 0 ? "Review completed intakes for checkout clarity." : "Scan stale leads for gentle follow-up drafts.",
      relatedEntity: "leads and targeted_route_campaigns",
      destination: "ai_outputs",
      sources: ["leads.status", "targeted_route_campaigns.status", "Stripe checkout route"],
    },
    {
      id: "design-brief",
      agent: "Design Brief Agent",
      role: "Creative and proof readiness",
      icon: FileCheck,
      priority: proofReady.length + productionReady.length > 0 ? "high" : "medium",
      count: proofReady.length + productionReady.length,
      focus: "Convert campaign strategy into proof-ready creative requirements and approval notes.",
      output: "Design brief with visual hierarchy, CTA, QR path, required claims review, and asset gaps.",
      approvalStatus: "Review required before production, export, or customer send.",
      nextAction: proofReady.length > 0 ? "Prepare proof approval notes." : "Prepare design intake briefs for paid campaigns.",
      relatedEntity: "campaign creative approval",
      destination: "ai-workforce/design-briefs",
      sources: ["targetAreaNotes", "businessAddress", "selected vertical playbook"],
    },
    {
      id: "qa-system-health",
      agent: "QA / System Health Agent",
      role: "Launch risk and operational QA",
      icon: AlertTriangle,
      priority: missingRouteContext.length + pricingRisk.length > 0 ? "high" : "low",
      count: missingRouteContext.length + pricingRisk.length,
      focus: "Flag missing route notes, pricing anomalies, approval gaps, and launch blockers.",
      output: "QA issue list with severity, expected vs actual, reproduction notes, and fix risk.",
      approvalStatus: "No destructive tests or production data mutation.",
      nextAction: pricingRisk.length > 0 ? "Escalate pricing or household-count anomaly." : "Review campaigns missing route detail.",
      relatedEntity: "targeted campaign launch readiness",
      destination: "ai-workforce/qa",
      sources: ["homesCount", "priceCents", "targetCity", "targetAreaNotes"],
    },
    {
      id: "outreach",
      agent: "Outreach Agent",
      role: "Human-controlled follow-up drafts",
      icon: MessageSquareText,
      priority: staleLeads.length + expansionReady.length > 0 ? "medium" : "low",
      count: staleLeads.length + expansionReady.length,
      focus: "Draft intake nudges, proof reminders, review asks, and expansion prompts without sending.",
      output: "Sender-specific email/SMS draft options with CTA, risk notes, and approval requirement.",
      approvalStatus: "Always requires approval before email, SMS, DM, or post.",
      nextAction: staleLeads.length > 0 ? "Draft non-spammy intake follow-ups." : "Draft repeat visibility prompts for mailed campaigns.",
      relatedEntity: "customer communication queue",
      destination: "ai_outputs",
      sources: ["lead source", "last status", "campaign stage", "communication orchestration rules"],
    },
    {
      id: "data-revenue",
      agent: "Data / Revenue Agent",
      role: "ROI and subscription intelligence",
      icon: BarChart3,
      priority: campaigns.length > 0 ? "medium" : "low",
      count: campaigns.length,
      focus: `Model ${selectedVertical.label} reach, projected leads, territory subscriptions, and expansion value.`,
      output: "Revenue summary with assumptions, metrics, risks, and next best actions.",
      approvalStatus: "Recommendations only. No pricing or subscription changes.",
      nextAction: campaigns.length > 0 ? "Rank campaigns by recurring expansion potential." : "Wait for first completed intake.",
      relatedEntity: "targeted revenue model",
      destination: "ai-workforce/data-revenue",
      sources: ["campaign spend", "homesCount", "vertical playbook", "status history"],
    },
  ];
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function WhiteMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: string;
  body: string;
  action?: unknown;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{body}</p>
      </div>
      {action ? (action as never) : null}
    </div>
  );
}

function AgentCommandCenter({
  leads,
  campaigns,
  selectedVertical,
}: {
  leads: TargetedLead[];
  campaigns: TargetedCampaign[];
  selectedVertical: VerticalPlaybook;
}) {
  const [preparedMissionId, setPreparedMissionId] = useState<string | null>(null);
  const missions = useMemo(
    () => buildAgentMissions(leads, campaigns, selectedVertical),
    [campaigns, leads, selectedVertical],
  );
  const preparedMission = missions.find((mission) => mission.id === preparedMissionId) ?? null;
  const totalWorkItems = missions.reduce((sum, mission) => sum + mission.count, 0);
  const urgentMissions = missions.filter((mission) => mission.priority === "critical" || mission.priority === "high").length;
  const draftOutputs = missions.filter((mission) => mission.count > 0).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <SectionHeader
        eyebrow="AI workforce layer"
        title="Agents prepare the work. Humans approve the action."
        body="Agent recommendations are tied to existing leads, targeted campaigns, approval gates, and AI workforce destinations."
        action={
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
            <LockKeyhole className="h-3.5 w-3.5" /> Approval locked
          </span>
        }
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <WhiteMetric label="Agent work items" value={totalWorkItems.toString()} detail="Prepared from current pipeline" />
        <WhiteMetric label="Priority agents" value={urgentMissions.toString()} detail="Critical or high attention" />
        <WhiteMetric label="Draft outputs" value={draftOutputs.toString()} detail="Human review before use" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {missions.map((mission) => {
          const Icon = mission.icon;
          return (
            <article key={mission.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-black text-slate-950">{mission.agent}</p>
                    <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{mission.role}</p>
                  </div>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${priorityClass(mission.priority)}`}>
                  {mission.count}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-700">{mission.focus}</p>

              <div className="mt-3 grid gap-2 text-xs">
                <div className="rounded-lg bg-white p-2">
                  <span className="font-black text-slate-500">Output:</span>{" "}
                  <span className="text-slate-700">{mission.output}</span>
                </div>
                <div className="rounded-lg bg-white p-2">
                  <span className="font-black text-slate-500">Approval:</span>{" "}
                  <span className="text-slate-700">{mission.approvalStatus}</span>
                </div>
                <div className="rounded-lg bg-white p-2">
                  <span className="font-black text-slate-500">Destination:</span>{" "}
                  <span className="text-slate-700">{mission.destination}</span>
                </div>
              </div>

              <button
                onClick={() => setPreparedMissionId(mission.id)}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-800"
              >
                <UserCheck className="h-4 w-4" aria-hidden="true" />
                Prepare agent brief
              </button>
            </article>
          );
        })}
      </div>

      {preparedMission && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-blue-950">{preparedMission.agent} brief prepared for review</p>
              <p className="mt-1 text-sm leading-6 text-blue-900">{preparedMission.nextAction}</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700">
              Draft only
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-white p-2">
              <p className="font-black uppercase tracking-[0.12em] text-blue-700">Inputs used</p>
              <p className="mt-1 text-blue-900">{preparedMission.sources.join(", ")}</p>
            </div>
            <div className="rounded-lg bg-white p-2">
              <p className="font-black uppercase tracking-[0.12em] text-blue-700">Related entity</p>
              <p className="mt-1 text-blue-900">{preparedMission.relatedEntity}</p>
            </div>
            <div className="rounded-lg bg-white p-2">
              <p className="font-black uppercase tracking-[0.12em] text-blue-700">Approval status</p>
              <p className="mt-1 text-blue-900">{preparedMission.approvalStatus}</p>
            </div>
            <div className="rounded-lg bg-white p-2">
              <p className="font-black uppercase tracking-[0.12em] text-blue-700">Next action</p>
              <p className="mt-1 text-blue-900">{preparedMission.nextAction}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {[
          ["Outbound", "Drafts only until a human approves email, SMS, DM, or post."],
          ["Payments", "No charges, discounts, pricing changes, or subscription changes from this panel."],
          ["Campaign state", "No active campaign, vendor, or mailing status changes from agent preparation."],
          ["Political", "Geography, timing, cost, logistics, and public context only."],
        ].map(([label, body]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TargetedMapPanel({
  campaigns,
  selectedCampaign,
  selectedVertical,
  onSelectCampaign,
}: {
  campaigns: TargetedCampaign[];
  selectedCampaign: TargetedCampaign | null;
  selectedVertical: VerticalPlaybook;
  onSelectCampaign: (campaignId: string) => void;
}) {
  const [mode, setMode] = useState<(typeof planningModes)[number]["key"]>("route");
  const modeConfig = planningModes.find((item) => item.key === mode) ?? planningModes[2];
  const baseHomes = selectedCampaign?.homesCount ?? 2500;
  const liveHomes = Math.round(baseHomes * modeConfig.multiplier);
  const liveSpend = Math.round((selectedCampaign?.priceCents ?? 182500) / 100 * modeConfig.multiplier);
  const liveResponse = clamp(selectedVertical.responseRate + (mode === "neighbor" ? 0.25 : 0) + (mode === "route" ? 0.15 : 0), 0.35, 3.4);
  const liveLeads = Math.max(1, Math.round(liveHomes * (liveResponse / 100)));
  const cells = Array.from({ length: 24 }, (_, index) => {
    const active = index % 3 !== 1 || mode === "city";
    const hot = index === 5 || index === 11 || index === 18 || (mode === "neighbor" && index === 7);
    return { key: `cell-${index}`, active, hot };
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-xl">
      <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative min-h-[430px] p-4 sm:p-5">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:42px_42px]" />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-200">Live targeting map</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">Route-level acquisition view</h2>
              <p className="mt-1 text-sm text-slate-300">
                Planning overlay for ZIP, city, route, radius, neighbor, and district decisions.
              </p>
            </div>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-100">
              Live estimates
            </span>
          </div>

          <div className="relative z-10 mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {planningModes.map((item) => (
              <button
                key={item.key}
                onClick={() => setMode(item.key)}
                className={`min-h-10 rounded-lg border px-2 text-xs font-black transition ${
                  mode === item.key
                    ? "border-blue-300 bg-blue-400 text-slate-950"
                    : "border-white/10 bg-white/10 text-slate-200 hover:bg-white/15"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="relative z-10 mt-6 rounded-xl border border-white/10 bg-slate-900/70 p-4">
            <div className="grid h-[238px] grid-cols-6 gap-2">
              {cells.map((cell, index) => (
                <div
                  key={cell.key}
                  className={`relative rounded-lg border transition ${
                    cell.hot
                      ? "border-amber-300 bg-amber-300/75 shadow-lg shadow-amber-500/20"
                      : cell.active
                        ? "border-blue-300/50 bg-blue-400/30"
                        : "border-white/10 bg-white/5"
                  }`}
                >
                  <span className="absolute left-2 top-2 text-[10px] font-black text-white/80">R{index + 1}</span>
                  {cell.hot && <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-slate-950" />}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-400/15 px-2.5 py-1">
                <Route className="h-3.5 w-3.5" /> Selected routes
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-2.5 py-1">
                <Zap className="h-3.5 w-3.5" /> Expansion opportunities
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
                <Crosshair className="h-3.5 w-3.5" /> {modeConfig.signal}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-white/[0.06] p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile label="Households" value={liveHomes.toLocaleString()} detail="Selected planning reach" />
            <MetricTile label="Impressions" value={Math.round(liveHomes * 2.4).toLocaleString()} detail="Estimated visibility" />
            <MetricTile label="Leads" value={liveLeads.toString()} detail={`${formatPercent(liveResponse)} est. response`} />
            <MetricTile label="Spend" value={formatUsd(liveSpend)} detail={`${formatUsd(liveSpend / Math.max(liveHomes, 1))} per home`} />
          </div>

          <div className="mt-5">
            <p className="text-sm font-black text-white">Campaign overlays</p>
            <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
              {campaigns.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-white/10 p-3 text-sm text-slate-300">
                  No campaigns yet. Add a lead or complete intake to populate territory overlays.
                </div>
              ) : (
                campaigns.slice(0, 8).map((campaign) => {
                  const isSelected = campaign.id === selectedCampaign?.id;
                  return (
                    <button
                      key={campaign.id}
                      onClick={() => onSelectCampaign(campaign.id)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        isSelected
                          ? "border-blue-300 bg-blue-400/15"
                          : "border-white/10 bg-white/10 hover:bg-white/15"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-black text-white">{campaign.businessName}</p>
                        <span className="text-xs font-bold text-blue-100">{campaign.homesCount.toLocaleString()}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {campaign.targetCity ?? "Market needed"} - {statusLabel(campaign)}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RevenueBuilderPanel({
  selectedVertical,
  onVerticalChange,
}: {
  selectedVertical: VerticalPlaybook;
  onVerticalChange: (key: VerticalKey) => void;
}) {
  const [homes, setHomes] = useState(2500);
  const [waves, setWaves] = useState(3);
  const [avgTicket, setAvgTicket] = useState(selectedVertical.avgTicket);
  const [closeRate, setCloseRate] = useState(selectedVertical.closeRate || 12);
  const [recurring, setRecurring] = useState(true);

  const responseRate = selectedVertical.responseRate + (recurring ? 0.2 : 0) + (waves > 1 ? 0.12 : 0);
  const spend = homes * (homes >= 5000 ? 0.7 : homes >= 2500 ? 0.73 : homes >= 1000 ? 0.77 : 0.8) * waves;
  const recurringSavings = recurring && waves >= 3 ? spend * 0.08 : 0;
  const netSpend = spend - recurringSavings;
  const leads = Math.max(1, Math.round(homes * waves * (responseRate / 100)));
  const conversions = selectedVertical.key === "political" ? 0 : Math.max(1, Math.round(leads * (closeRate / 100)));
  const revenue = conversions * avgTicket;
  const costPerLead = netSpend / Math.max(leads, 1);
  const roi = selectedVertical.key === "political" || netSpend === 0 ? 0 : revenue / netSpend;
  const deliveryWindow = waves === 1 ? "10-14 days after approval" : `${waves} waves across ${waves * 21} days`;

  function selectVertical(key: VerticalKey) {
    const next = verticalPlaybooks.find((item) => item.key === key) ?? defaultVertical;
    if (!next) return;
    onVerticalChange(key);
    setAvgTicket(next.avgTicket);
    setCloseRate(next.closeRate || 12);
  }

  return (
    <section id="revenue-builder" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <SectionHeader
        eyebrow="Live revenue builder"
        title="Campaign economics update as the plan changes."
        body="Use this as a planning calculator before a human-approved quote, payment, or recurring campaign recommendation."
        action={
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            {recurring ? "Recurring savings visible" : "One-time campaign"}
          </span>
        }
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Vertical</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {verticalPlaybooks.map((vertical) => {
                const Icon = vertical.icon;
                const active = selectedVertical.key === vertical.key;
                return (
                  <button
                    key={vertical.key}
                    onClick={() => selectVertical(vertical.key)}
                    className={`min-h-12 rounded-lg border px-2 text-xs font-black transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="mx-auto mb-1 h-4 w-4" />
                    {vertical.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-slate-900">Households</p>
              <p className="text-sm font-black text-blue-700">{homes.toLocaleString()}</p>
            </div>
            <input
              type="range"
              min={500}
              max={5000}
              step={500}
              value={homes}
              onChange={(event) => setHomes(Number(event.target.value))}
              className="mt-2 w-full accent-blue-700"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-slate-900">Campaign waves</p>
              <p className="text-sm font-black text-blue-700">{waves}</p>
            </div>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={waves}
              onChange={(event) => setWaves(Number(event.target.value))}
              className="mt-2 w-full accent-blue-700"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-black text-slate-900">Avg. customer value</span>
              <input
                type="number"
                min={0}
                value={avgTicket}
                onChange={(event) => setAvgTicket(Number(event.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-900">Close rate</span>
              <input
                type="number"
                min={0}
                max={100}
                value={closeRate}
                onChange={(event) => setCloseRate(Number(event.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <button
            onClick={() => setRecurring((value) => !value)}
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-black transition ${
              recurring ? "bg-blue-700 text-white hover:bg-blue-800" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <CalendarClock className="h-4 w-4" />
            {recurring ? "Recurring territory subscription on" : "Add recurring territory subscription"}
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <WhiteMetric label="Estimated spend" value={formatUsd(netSpend)} detail={`${formatUsd(spend)} before savings`} />
            <WhiteMetric label="Estimated leads" value={leads.toString()} detail={`${formatPercent(responseRate)} projected response`} />
            <WhiteMetric label="Projected revenue" value={selectedVertical.key === "political" ? "Awareness plan" : formatUsd(revenue)} detail={`${conversions} projected conversions`} />
            <WhiteMetric label="ROI multiple" value={selectedVertical.key === "political" ? "N/A" : `${roi.toFixed(1)}x`} detail={`${formatUsd(costPerLead)} est. cost per lead`} />
          </div>

          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-black text-blue-950">Recommended launch path</p>
            <p className="mt-2 text-sm leading-6 text-blue-900">
              {selectedVertical.cadence}. Delivery window: {deliveryWindow}. Suggested offer: {selectedVertical.offer}.
            </p>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700">
              Human approval required before pricing, payment, creative, or launch changes.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CampaignSnapshotCard({
  campaign,
  selectedVertical,
  onCommand,
  onViewAnalytics,
  onExpandTerritory,
}: {
  campaign: TargetedCampaign;
  selectedVertical: VerticalPlaybook;
  onCommand: (campaignId: string, message: string, tone?: CommandTone) => void;
  onViewAnalytics: () => void;
  onExpandTerritory: () => void;
}) {
  const metrics = campaignMetrics(campaign, selectedVertical);

  function handleCommand(label: string) {
    if (label === "View Analytics") {
      onViewAnalytics();
      onCommand(campaign.id, "Analytics view opened for this campaign.", "info");
      return;
    }
    if (label === "Expand Territory") {
      onExpandTerritory();
      onCommand(campaign.id, "Expansion planner opened. No campaign state was changed.", "info");
      return;
    }
    if (label === "AI Recommendations") {
      document.getElementById("ai-strategy-engine")?.scrollIntoView({ behavior: "smooth", block: "start" });
      onCommand(campaign.id, "AI recommendation panel opened. Review before acting.", "info");
      return;
    }
    if (label === "Approve Proof") {
      onCommand(campaign.id, "Proof approval still requires human creative review. No state was changed.", "info");
      return;
    }
    if (label === "Pause") {
      onCommand(campaign.id, "Pause requires an explicit workflow action. No campaign state was changed.", "info");
      return;
    }
    onCommand(campaign.id, `${label} prepared for review. No campaign state was changed.`, "info");
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Campaign snapshot</p>
          <h3 className="mt-1 truncate text-xl font-black text-slate-950">{campaign.businessName}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {campaign.targetCity ?? "Market needed"} - {statusLabel(campaign)}
          </p>
        </div>
        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
          AI {metrics.aiScore}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <WhiteMetric label="Households" value={campaign.homesCount.toLocaleString()} detail={metrics.routeDensity} />
        <WhiteMetric label="Impressions" value={metrics.impressions.toLocaleString()} detail="Projected local visibility" />
        <WhiteMetric label="Leads" value={metrics.projectedLeads.toString()} detail={`${formatPercent(metrics.responseRate)} est. response`} />
        <WhiteMetric label="ROI" value={selectedVertical.key === "political" ? "Awareness" : `${metrics.projectedRoi.toFixed(1)}x`} detail={formatUsd(metrics.spend)} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Projected ROI</p>
          <p className="mt-1 font-black text-slate-950">
            {selectedVertical.key === "political" ? "Compliance-safe visibility" : formatUsd(metrics.projectedRevenue)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Drop date</p>
          <p className="mt-1 font-black text-slate-950">{metrics.estimatedDropDate}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Performance</p>
          <p className="mt-1 font-black text-slate-950">{metrics.performanceScore}/100 score</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-500">
          <span>Delivery progress</span>
          <span>{metrics.progress}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-blue-700" style={{ width: `${metrics.progress}%` }} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {campaignCommandButtons.map((button) => {
          const Icon = button.icon;
          return (
            <button
              key={button.label}
              onClick={() => handleCommand(button.label)}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-black transition ${
                button.tone === "primary"
                  ? "bg-blue-700 text-white hover:bg-blue-800"
                  : "border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="truncate">{button.label}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function AIStrategyEngine({
  leads,
  campaigns,
  selectedVertical,
}: {
  leads: TargetedLead[];
  campaigns: TargetedCampaign[];
  selectedVertical: VerticalPlaybook;
}) {
  const waitingLeads = leads.filter((lead) => ["new", "contacted", "intake_sent", "intake_started"].includes(lead.status)).length;
  const readyProofs = campaigns.filter((campaign) => campaign.status === "design_ready" || campaign.designStatus === "ready").length;
  const mailedCampaigns = campaigns.filter((campaign) => campaign.status === "mailed" || campaign.mailingStatus === "mailed").length;
  const marketSignals = getMarketSignals(campaigns, leads);
  const expansionZone = marketSignals[0]?.city ?? "the strongest active city";

  const cards = [
    {
      title: "Why this campaign works",
      body: `${selectedVertical.label} buyers respond best when the offer is obvious, local, and repeated. Current pipeline has ${waitingLeads} leads that can be moved toward a reviewed territory plan.`,
      icon: CheckCircle2,
    },
    {
      title: "Recommended improvements",
      body: `${readyProofs} proof-ready campaigns should show route count, offer clarity, QR path, and approval deadline before any production step advances.`,
      icon: ClipboardCheck,
    },
    {
      title: "Suggested expansion zones",
      body: `Prioritize ${expansionZone} and adjacent routes where current lead or campaign density already creates operational context.`,
      icon: MapPinned,
    },
    {
      title: "Expected lead quality",
      body: `${selectedVertical.target}. Use ${selectedVertical.qrStrategy.toLowerCase()} to connect mail response to attribution and follow-up.`,
      icon: Target,
    },
    {
      title: "Recurring retention move",
      body: `${mailedCampaigns} mailed campaigns can be reviewed for repeat visibility, route expansion, seasonal cadence, or category protection.`,
      icon: CalendarClock,
    },
    {
      title: "Copy and CTA direction",
      body: `Headline: "${selectedVertical.headline}" Offer: ${selectedVertical.offer}. Keep the CTA singular and measurable.`,
      icon: PenLine,
    },
  ];

  return (
    <section id="ai-strategy-engine" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <SectionHeader
        eyebrow="AI strategy engine"
        title="A strategist embedded in the campaign workflow."
        body="Recommendations stay approval-first and are designed to help admins prepare better launches, not bypass human judgment."
        action={
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
            <Brain className="h-3.5 w-3.5" /> Review required
          </span>
        }
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="font-black text-slate-950">{card.title}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{card.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ScarcityAndTrustPanel({
  campaigns,
  leads,
}: {
  campaigns: TargetedCampaign[];
  leads: TargetedLead[];
}) {
  const marketSignals = getMarketSignals(campaigns, leads);
  const paidCount = campaigns.filter((campaign) => ["paid", "design_queued", "design_in_progress", "design_ready", "approved", "mailed"].includes(campaign.status)).length;
  const categoriesUnderReview = new Set(campaigns.map((campaign) => campaign.businessName.split(" ").slice(-1)[0]).filter(Boolean)).size;

  return (
    <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-800">Territory control</p>
        <h2 className="mt-1 text-xl font-black text-slate-950">Authentic scarcity from active demand.</h2>
        <div className="mt-4 space-y-3">
          {marketSignals.length === 0 ? (
            <p className="rounded-lg bg-white/70 p-3 text-sm text-amber-900">
              No market density yet. Scarcity signals will strengthen as leads, routes, and campaigns accumulate.
            </p>
          ) : (
            marketSignals.map((signal) => (
              <div key={signal.city} className="rounded-lg border border-amber-200 bg-white/75 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-slate-950">{signal.city}</p>
                  <span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-black text-amber-900">
                    {signal.campaigns + signal.leads} signals
                  </span>
                </div>
                <p className="mt-1 text-sm text-amber-900">
                  {signal.homes.toLocaleString()} households already scoped across campaigns.
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <SectionHeader
          eyebrow="Trust layer"
          title="Make the customer feel protected before they buy."
          body="Use confidence signals that are operationally true: approval gates, Stripe checkout, proof review, route planning, and transparent execution."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <WhiteMetric label="Paid campaigns" value={paidCount.toString()} detail="Payment-to-production visibility" />
          <WhiteMetric label="Category reviews" value={categoriesUnderReview.toString()} detail="Protected placement opportunities" />
          <WhiteMetric label="Approval gates" value="4" detail="Intake, payment, proof, mail" />
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="font-black text-slate-950">Use this message in sales moments</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            HomeReach does not just print mail. It helps businesses secure territory, approve the message, track execution,
            and build repeat local visibility through a guided operating system.
          </p>
        </div>
      </div>
    </section>
  );
}

function AnalyticsAndLogisticsPanel({
  campaigns,
  selectedVertical,
}: {
  campaigns: TargetedCampaign[];
  selectedVertical: VerticalPlaybook;
}) {
  const aggregate = campaigns.reduce(
    (total, campaign) => {
      const metrics = campaignMetrics(campaign, selectedVertical);
      total.homes += campaign.homesCount;
      total.impressions += metrics.impressions;
      total.leads += metrics.projectedLeads;
      total.revenue += metrics.projectedRevenue;
      total.spend += metrics.spend;
      total.progress += metrics.progress;
      return total;
    },
    { homes: 0, impressions: 0, leads: 0, revenue: 0, spend: 0, progress: 0 },
  );
  const avgProgress = campaigns.length ? Math.round(aggregate.progress / campaigns.length) : 0;
  const stages = [
    { label: "Production", value: campaigns.filter((campaign) => ["paid", "design_queued", "design_in_progress"].includes(campaign.status)).length },
    { label: "Proof", value: campaigns.filter((campaign) => campaign.status === "design_ready").length },
    { label: "Mail entry", value: campaigns.filter((campaign) => campaign.status === "approved").length },
    { label: "In-home", value: campaigns.filter((campaign) => campaign.status === "mailed" || campaign.mailingStatus === "mailed").length },
  ];
  const maxStage = Math.max(1, ...stages.map((stage) => stage.value));

  return (
    <section id="analytics-center" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <SectionHeader
        eyebrow="Analytics and logistics intelligence"
        title="Executive visibility without operational overload."
        body="Shows attribution-oriented projections, route-level progress, and production risk signals from the current campaign pipeline."
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <WhiteMetric label="Households" value={aggregate.homes.toLocaleString()} detail="Total targeted reach" />
        <WhiteMetric label="Impressions" value={aggregate.impressions.toLocaleString()} detail="Projected in-market visibility" />
        <WhiteMetric label="Leads" value={aggregate.leads.toString()} detail="Estimated response" />
        <WhiteMetric label="Revenue lift" value={selectedVertical.key === "political" ? "Awareness" : formatUsd(aggregate.revenue)} detail="Projected customer value" />
        <WhiteMetric label="Logistics" value={`${avgProgress}%`} detail="Average progress" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-black text-slate-950">Route performance model</p>
          <div className="mt-4 space-y-3">
            {campaigns.slice(0, 5).map((campaign) => {
              const metrics = campaignMetrics(campaign, selectedVertical);
              return (
                <div key={campaign.id}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-bold text-slate-800">{campaign.businessName}</span>
                    <span className="font-black text-blue-700">{metrics.performanceScore}/100</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-white">
                    <div className="h-2 rounded-full bg-blue-700" style={{ width: `${metrics.performanceScore}%` }} />
                  </div>
                </div>
              );
            })}
            {campaigns.length === 0 && <p className="text-sm text-slate-500">Campaign analytics appear after intake submission.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-black text-slate-950">Delivery timeline</p>
          <div className="mt-4 space-y-3">
            {stages.map((stage) => (
              <div key={stage.label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-slate-800">{stage.label}</span>
                  <span className="font-black text-slate-950">{stage.value}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-white">
                  <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${(stage.value / maxStage) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Logistics dates are planning indicators. Final production, mail entry, and in-home timing remain human-reviewed.
          </p>
        </div>
      </div>
    </section>
  );
}

export function TargetedGrowthCommandCenter({
  leads,
  campaigns,
  onFocusTab,
  onCreateLead,
  onCampaignCommand,
}: Props) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(campaigns[0]?.id ?? null);
  const [selectedVerticalKey, setSelectedVerticalKey] = useState<VerticalKey>("roofing");
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0] ?? null;
  const selectedVertical = getVerticalPlaybook(selectedVerticalKey);

  const commandStats = useMemo(() => {
    const campaignMetricsList = campaigns.map((campaign) => campaignMetrics(campaign, selectedVertical));
    const pipelineSpend = campaigns.reduce((sum, campaign) => sum + campaign.priceCents / 100, 0);
    const projectedLeads = campaignMetricsList.reduce((sum, metric) => sum + metric.projectedLeads, 0);
    const projectedRevenue = campaignMetricsList.reduce((sum, metric) => sum + metric.projectedRevenue, 0);
    const households = campaigns.reduce((sum, campaign) => sum + campaign.homesCount, 0);
    const activeSubscriptions = campaigns.filter((campaign) => ["paid", "design_queued", "design_in_progress", "design_ready", "approved"].includes(campaign.status)).length;
    return { pipelineSpend, projectedLeads, projectedRevenue, households, activeSubscriptions };
  }, [campaigns, selectedVertical]);

  const marketName = getMarketName(campaigns, leads);

  function scrollToBuilder() {
    document.getElementById("revenue-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToAnalytics() {
    document.getElementById("analytics-center")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-white shadow-2xl">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-300/30 bg-blue-400/10 px-3 py-1 text-xs font-black text-blue-100">
                <Sparkles className="h-3.5 w-3.5" /> AI-powered direct mail OS
              </span>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-100">
                {marketName}
              </span>
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Growth command for territory, revenue, execution, and repeat local visibility.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              This dashboard turns targeted mail into an operating system: launch faster, see reach instantly,
              protect approval gates, and identify the next revenue move without making owners decode print operations.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={onCreateLead}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-400"
              >
                <Rocket className="h-4 w-4" />
                Start Campaign Intake
              </button>
              <button
                onClick={() => onFocusTab("campaigns")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
              >
                <MailCheck className="h-4 w-4" />
                View Execution Queue
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile label="Pipeline" value={formatUsd(commandStats.pipelineSpend)} detail="Current targeted campaign value" />
            <MetricTile label="Households" value={commandStats.households.toLocaleString()} detail="Territory reach in queue" />
            <MetricTile label="Projected leads" value={commandStats.projectedLeads.toString()} detail={`${selectedVertical.label} model`} />
            <MetricTile
              label="Revenue impact"
              value={selectedVertical.key === "political" ? "Awareness" : formatUsd(commandStats.projectedRevenue)}
              detail={`${commandStats.activeSubscriptions} recurring-ready campaigns`}
            />
          </div>
        </div>
      </section>

      <AgentCommandCenter leads={leads} campaigns={campaigns} selectedVertical={selectedVertical} />

      {campaigns.length > 0 && (
        <section className="grid gap-4 xl:grid-cols-2">
          {campaigns.slice(0, 2).map((campaign) => (
            <CampaignSnapshotCard
              key={campaign.id}
              campaign={campaign}
              selectedVertical={selectedVertical}
              onCommand={onCampaignCommand}
              onViewAnalytics={scrollToAnalytics}
              onExpandTerritory={scrollToBuilder}
            />
          ))}
        </section>
      )}

      <TargetedMapPanel
        campaigns={campaigns}
        selectedCampaign={selectedCampaign}
        selectedVertical={selectedVertical}
        onSelectCampaign={setSelectedCampaignId}
      />

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <RevenueBuilderPanel selectedVertical={selectedVertical} onVerticalChange={setSelectedVerticalKey} />
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <SectionHeader
            eyebrow="Vertical launch systems"
            title={`${selectedVertical.label} campaign playbook`}
            body="Pre-baked industry logic reduces setup friction and helps owners see a recommended campaign path immediately."
          />
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">{selectedVertical.headline}</p>
            <div className="mt-4 grid gap-3">
              {[
                ["Suggested offer", selectedVertical.offer],
                ["Targeting", selectedVertical.target],
                ["Cadence", selectedVertical.cadence],
                ["QR strategy", selectedVertical.qrStrategy],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-white p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>

      <AIStrategyEngine leads={leads} campaigns={campaigns} selectedVertical={selectedVertical} />
      <ScarcityAndTrustPanel leads={leads} campaigns={campaigns} />
      <AnalyticsAndLogisticsPanel campaigns={campaigns} selectedVertical={selectedVertical} />
    </div>
  );
}
