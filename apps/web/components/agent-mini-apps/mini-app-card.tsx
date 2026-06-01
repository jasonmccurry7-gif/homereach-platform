"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Edit3,
  FileText,
  Loader2,
  Send,
  UserPlus,
  X,
} from "lucide-react";
import type {
  AgentMiniApp,
  AgentMiniAppEvent,
  MiniAppAction,
  MiniAppType,
} from "@/lib/agent-mini-apps/types";
import { cn } from "@/lib/utils";

type ActionVariant = "primary" | "secondary" | "success" | "danger";

export function MiniAppCard({
  events,
  miniApp,
}: {
  events: AgentMiniAppEvent[];
  miniApp: AgentMiniApp;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [workingAction, setWorkingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const payload = miniApp.editedPayloadJson ?? miniApp.payloadJson;
  const [payloadText, setPayloadText] = useState(JSON.stringify(payload, null, 2));
  const [scheduleValue, setScheduleValue] = useState(toDatetimeLocal(miniApp.dueAt));
  const [assignedUserId, setAssignedUserId] = useState(miniApp.assignedUserId ?? "");
  const primaryAction = getPrimaryAction(miniApp);
  const activeEvents = useMemo(() => [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [events]);

  async function run(action: MiniAppAction, body: Record<string, unknown> = {}, success = "Saved") {
    setMessage(null);
    setWorkingAction(action);
    try {
      const response = await fetch(`/api/admin/agent-mini-apps/${miniApp.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        setMessage(String(result.error ?? "Action failed"));
        return;
      }
      setMessage(result.taskId ? `${success}: ${result.taskId}` : success);
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setWorkingAction(null);
    }
  }

  function savePayloadEdit() {
    try {
      const editedPayloadJson = JSON.parse(payloadText) as Record<string, unknown>;
      void run("edit_payload", { editedPayloadJson }, "Edited payload saved");
      setEditOpen(false);
    } catch {
      setMessage("Payload edit must be valid JSON.");
    }
  }

  function schedule() {
    if (!scheduleValue) {
      setMessage("Choose a schedule time first.");
      return;
    }
    void run("schedule", { dueAt: new Date(scheduleValue).toISOString() }, "Mini app scheduled");
    setScheduleOpen(false);
  }

  function assign() {
    if (!assignedUserId.trim()) {
      setMessage("Paste an assigned user id first.");
      return;
    }
    void run("assign", { assignedUserId: assignedUserId.trim() }, "Mini app assigned");
    setAssignOpen(false);
  }

  return (
    <article
      data-testid="mini-app-card"
      data-mini-app-id={miniApp.id}
      data-mini-app-status={miniApp.status}
      data-mini-app-type={miniApp.miniAppType}
      className="rounded-lg border border-white/10 bg-[#0b1424] p-4 shadow-2xl shadow-black/20"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100">
              {labelFor(miniApp.miniAppType)}
            </span>
            <StatusBadge status={miniApp.status} />
            <PriorityBadge priority={miniApp.priority} />
          </div>
          <h3 className="mt-3 text-lg font-black leading-tight text-white">{miniApp.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">{miniApp.description}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:w-72">
          <MiniMetric label="Money" value={moneyImpact(miniApp)} />
          <MiniMetric label="Risk" value={labelFor(miniApp.riskLevel)} tone={riskTone(miniApp.riskLevel)} />
          <MiniMetric label="Confidence" value={`${Math.round(miniApp.confidenceScore)}%`} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-3">
          <InfoLine label="Source agent" value={miniApp.sourceAgent} />
          <InfoLine label="Related module" value={miniApp.relatedModule} />
          <InfoLine label="Related entity" value={relatedEntity(payload)} />
          <InfoLine label="Due" value={miniApp.dueAt ? formatDate(miniApp.dueAt) : "No due date"} />
          <InfoLine label="Approval" value={miniApp.approvalRequired ? "Required" : "Not required"} />
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Recommended action</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-200">{miniApp.recommendedAction || "Review and choose the next approved action."}</p>
          <div className="mt-3 border-t border-white/10 pt-3">
            <MiniAppTypeDetail miniAppType={miniApp.miniAppType} payload={payload} />
          </div>
        </div>
      </div>

      {miniApp.editedPayloadJson ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-100">Versioning</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Original payload is preserved. Edited payload is active for review and execution queue handoff.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {primaryAction ? (
            <ActionButton
              action={primaryAction.action}
              label={primaryAction.label}
              icon={primaryAction.icon}
              variant="primary"
              loading={isPending || workingAction === primaryAction.action}
              onClick={() => run(primaryAction.action, primaryAction.body, primaryAction.success)}
            />
          ) : null}
          <ActionButton action="edit_payload" label="Edit" icon={Edit3} variant="secondary" disabled={isClosed(miniApp)} onClick={() => setEditOpen((value) => !value)} />
          <ActionButton action="reject" label="Reject" icon={X} variant="danger" disabled={isClosed(miniApp)} loading={workingAction === "reject"} onClick={() => run("reject", { reason: "Rejected from Today's Agent Stack." }, "Mini app rejected")} />
          <ActionButton action="archive" label="Archive" icon={Archive} variant="secondary" disabled={isClosed(miniApp)} loading={workingAction === "archive"} onClick={() => run("archive", { reason: "Archived from Today's Agent Stack." }, "Mini app archived")} />
          <ActionButton action="schedule" label="Schedule" icon={CalendarClock} variant="secondary" disabled={miniApp.status !== "approved"} onClick={() => setScheduleOpen((value) => !value)} />
          <ActionButton action="assign" label="Assign" icon={UserPlus} variant="secondary" disabled={isClosed(miniApp)} onClick={() => setAssignOpen((value) => !value)} />
          <ActionButton action="send_to_execution_queue" label="Queue" icon={Send} variant="secondary" disabled={miniApp.status !== "approved"} loading={workingAction === "send_to_execution_queue"} onClick={() => run("send_to_execution_queue", {}, "Sent to execution queue")} />
          <TypeActionButtons miniApp={miniApp} run={run} workingAction={workingAction} />
        </div>
        <div className="min-w-0 lg:w-64">
          {message ? <p className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300">{message}</p> : null}
        </div>
      </div>

      {editOpen ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Edited payload JSON</span>
            <textarea
              value={payloadText}
              onChange={(event) => setPayloadText(event.target.value)}
              className="mt-2 min-h-64 w-full resize-y rounded-md border border-white/10 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 outline-none"
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button type="button" data-testid="mini-app-save-payload-edit" onClick={savePayloadEdit} className="rounded-md bg-white px-3 py-2 text-xs font-black text-slate-950">Save edit</button>
            <button type="button" onClick={() => setEditOpen(false)} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-300">Cancel</button>
          </div>
        </div>
      ) : null}

      {scheduleOpen ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <label className="block max-w-sm">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Schedule for</span>
            <input
              type="datetime-local"
              value={scheduleValue}
              onChange={(event) => setScheduleValue(event.target.value)}
              className="mt-2 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button type="button" data-testid="mini-app-confirm-schedule" onClick={schedule} className="rounded-md bg-white px-3 py-2 text-xs font-black text-slate-950">Schedule</button>
            <button type="button" onClick={() => setScheduleOpen(false)} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-300">Cancel</button>
          </div>
        </div>
      ) : null}

      {assignOpen ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <label className="block max-w-sm">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Assigned user id</span>
            <input
              value={assignedUserId}
              onChange={(event) => setAssignedUserId(event.target.value)}
              placeholder="Supabase profile UUID"
              className="mt-2 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600"
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button type="button" data-testid="mini-app-confirm-assign" onClick={assign} className="rounded-md bg-white px-3 py-2 text-xs font-black text-slate-950">Assign</button>
            <button type="button" onClick={() => setAssignOpen(false)} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-300">Cancel</button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 border-t border-white/10 pt-4">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Audit history</p>
        {activeEvents.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No audit events yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {activeEvents.slice(0, 4).map((event) => (
              <div key={event.id} className="flex gap-2 text-xs leading-5 text-slate-400">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-200" />
                <span>
                  <span className="font-black text-slate-200">{labelFor(event.eventType)}</span>
                  {" / "}
                  {event.eventSummary}
                  <span className="text-slate-600"> / {formatDate(event.createdAt)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function TypeActionButtons({
  miniApp,
  run,
  workingAction,
}: {
  miniApp: AgentMiniApp;
  run: (action: MiniAppAction, body?: Record<string, unknown>, success?: string) => Promise<void>;
  workingAction: string | null;
}) {
  const approved = miniApp.status === "approved";
  if (miniApp.miniAppType === "route_density") {
    return (
      <>
        <ActionButton action="send_to_execution_queue" label="Generate Quote" icon={FileText} variant="secondary" disabled={!approved} loading={workingAction === "send_to_execution_queue"} onClick={() => run("send_to_execution_queue", { taskType: "generate_quote", permissionScope: "prepare_only" }, "Quote task queued")} />
        <ActionButton action="send_to_execution_queue" label="Generate Creative" icon={ClipboardList} variant="secondary" disabled={!approved} onClick={() => run("send_to_execution_queue", { taskType: "generate_creative", permissionScope: "prepare_only" }, "Creative task queued")} />
      </>
    );
  }
  if (miniApp.miniAppType === "political_plan" || miniApp.miniAppType === "samgov_bid") {
    return (
      <ActionButton action="send_to_execution_queue" label="Generate Proposal" icon={FileText} variant="secondary" disabled={!approved} onClick={() => run("send_to_execution_queue", { taskType: miniApp.miniAppType === "samgov_bid" ? "generate_bid_draft" : "generate_proposal", permissionScope: "prepare_only" }, "Proposal task queued")} />
    );
  }
  if (miniApp.miniAppType === "outreach_approval") {
    return (
      <ActionButton action="send_to_execution_queue" label="Queue Send" icon={Send} variant="success" disabled={!approved} onClick={() => run("send_to_execution_queue", { taskType: "approved_outreach_send_review", permissionScope: "send_after_approval" }, "Approved send review queued")} />
    );
  }
  if (miniApp.miniAppType === "procurement_savings") {
    return (
      <ActionButton action="manual_takeover_requested" label="More Options" icon={ClipboardList} variant="secondary" disabled={isClosed(miniApp)} onClick={() => run("manual_takeover_requested", { reason: "Ask agent for more supplier options before any reorder decision." }, "More-options request logged")} />
    );
  }
  if (miniApp.miniAppType === "website_build") {
    return (
      <ActionButton action="send_to_execution_queue" label="Codex Prompt" icon={FileText} variant="secondary" disabled={!approved} onClick={() => run("send_to_execution_queue", { taskType: "generate_codex_build_prompt", permissionScope: "prepare_only" }, "Codex prompt task queued")} />
    );
  }
  return null;
}

function MiniAppTypeDetail({ miniAppType, payload }: { miniAppType: MiniAppType; payload: Record<string, unknown> }) {
  if (miniAppType === "outreach_approval") return <OutreachApprovalDetail payload={payload} />;
  if (miniAppType === "political_plan") return <PoliticalPlanDetail payload={payload} />;
  if (miniAppType === "route_density") return <RouteDensityDetail payload={payload} />;
  if (miniAppType === "procurement_savings") return <ProcurementSavingsDetail payload={payload} />;
  if (miniAppType === "samgov_bid") return <SamGovBidDetail payload={payload} />;
  if (miniAppType === "website_build") return <WebsiteBuildDetail payload={payload} />;
  return <PreviewText value={readString(payload.summary) ?? JSON.stringify(payload).slice(0, 240)} />;
}

function OutreachApprovalDetail({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="space-y-2 text-sm leading-6">
      <InfoLine label="Recipient" value={`${readString(payload.recipient_name) ?? "Unknown"} / ${readString(payload.channel) ?? "channel"}`} />
      <InfoLine label="Subject" value={readString(payload.subject) ?? "SMS/DM"} />
      <PreviewText value={readString(payload.message_body) ?? "No message preview."} />
      <InfoLine label="CTA" value={readString(payload.call_to_action) ?? "Review next step"} />
      <WarningLine value={readString(payload.compliance_warning)} />
    </div>
  );
}

function PoliticalPlanDetail({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="space-y-2 text-sm leading-6">
      <InfoLine label="Candidate" value={`${readString(payload.candidate_name) ?? "Unknown"} / ${readString(payload.race_type) ?? "race"}`} />
      <InfoLine label="Geography" value={readString(payload.geography) ?? "Not set"} />
      <InfoLine label="Election" value={readString(payload.election_date) ?? "Not set"} />
      <PreviewText value={readString(payload.proposal_summary) ?? readString(payload.geofence_strategy) ?? "No plan summary."} />
      <WarningLine value={readString(payload.compliance_notes)} />
    </div>
  );
}

function RouteDensityDetail({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="space-y-2 text-sm leading-6">
      <InfoLine label="Route" value={`${readString(payload.route_id) ?? "Route pending"} / ${readString(payload.target_area) ?? "Area pending"}`} />
      <InfoLine label="Households" value={readString(payload.household_count) ?? String(payload.household_count ?? "Not set")} />
      <InfoLine label="Lead range" value={readString(payload.estimated_lead_range) ?? "Estimate pending"} />
      <PreviewText value={readString(payload.client_facing_summary) ?? readString(payload.recommended_offer) ?? "No route summary."} />
    </div>
  );
}

function ProcurementSavingsDetail({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="space-y-2 text-sm leading-6">
      <InfoLine label="Current" value={readString(payload.current_supplier) ?? "Unknown supplier"} />
      <InfoLine label="Recommended" value={readString(payload.recommended_supplier) ?? "Not selected"} />
      <InfoLine label="Reorder" value={readString(payload.reorder_timing) ?? "Not set"} />
      <PreviewText value={readString(payload.savings_summary) ?? "No savings summary."} />
      <WarningLine value={readString(payload.quality_risk_notes)} />
    </div>
  );
}

function SamGovBidDetail({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="space-y-2 text-sm leading-6">
      <InfoLine label="Agency" value={readString(payload.agency) ?? "Unknown"} />
      <InfoLine label="Notice" value={readString(payload.notice_id) ?? "Not set"} />
      <InfoLine label="Deadline" value={readString(payload.deadline) ?? "Not set"} />
      <InfoLine label="Fit" value={`${String(payload.fit_score ?? "0")}% / ${readString(payload.bid_no_bid_recommendation) ?? "review"}`} />
      <WarningLine value={readString(payload.compliance_requirements)} />
    </div>
  );
}

function WebsiteBuildDetail({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="space-y-2 text-sm leading-6">
      <InfoLine label="Business" value={`${readString(payload.business_name) ?? "Unknown"} / ${readString(payload.owner_name) ?? "owner"}`} />
      <InfoLine label="Domain" value={readString(payload.domain_status) ?? "Not checked"} />
      <InfoLine label="Payment" value={readString(payload.payment_status) ?? "Not checked"} />
      <InfoLine label="Intake" value={readString(payload.intake_completeness) ?? "Unknown"} />
      <PreviewText value={readString(payload.codex_build_prompt_preview) ?? "No Codex prompt preview."} />
    </div>
  );
}

function ActionButton({
  action,
  disabled = false,
  icon: Icon,
  label,
  loading = false,
  onClick,
  variant,
}: {
  action: MiniAppAction;
  disabled?: boolean;
  icon: typeof Check;
  label: string;
  loading?: boolean;
  onClick: () => void;
  variant: ActionVariant;
}) {
  const styles: Record<ActionVariant, string> = {
    primary: "border-cyan-200/40 bg-cyan-200 text-slate-950 hover:bg-cyan-100",
    secondary: "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/10",
    success: "border-emerald-300/30 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-300/25",
    danger: "border-rose-300/30 bg-rose-400/15 text-rose-100 hover:bg-rose-300/25",
  };
  return (
    <button
      type="button"
      data-testid={`mini-app-action-${slugifyForTestId(label)}`}
      data-mini-app-action={action}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-2.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-45",
        styles[variant],
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {loading ? "Working" : label}
    </button>
  );
}

function slugifyForTestId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function getPrimaryAction(miniApp: AgentMiniApp): { label: string; action: MiniAppAction; body?: Record<string, unknown>; success: string; icon: typeof Check } | null {
  if (miniApp.status === "generated") return { label: "Review", action: "mark_needs_review", success: "Moved to review", icon: ClipboardList };
  if (miniApp.status === "needs_review" || miniApp.status === "edited") return { label: "Approve", action: "approve", success: "Mini app approved", icon: Check };
  if (miniApp.status === "approved") return { label: "Send to Queue", action: "send_to_execution_queue", success: "Sent to execution queue", icon: Send };
  if (miniApp.status === "scheduled" || miniApp.status === "sent_to_execution_queue") return { label: "Mark Complete", action: "mark_executed", success: "Marked complete", icon: CheckCircle2 };
  if (miniApp.status === "failed") return { label: "Manual Takeover", action: "manual_takeover_requested", success: "Manual takeover logged", icon: UserPlus };
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "approved" || status === "executed"
      ? "bg-emerald-400/15 text-emerald-100"
      : status === "failed" || status === "rejected"
        ? "bg-rose-400/15 text-rose-100"
        : status === "needs_review" || status === "edited"
          ? "bg-amber-400/15 text-amber-100"
          : "bg-slate-400/15 text-slate-200";
  return <span className={cn("rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em]", color)}>{labelFor(status)}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn(
      "rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em]",
      priority === "urgent" ? "bg-rose-400/15 text-rose-100" : priority === "high" ? "bg-amber-400/15 text-amber-100" : "bg-slate-400/15 text-slate-200",
    )}>
      {priority}
    </span>
  );
}

function MiniMetric({ label, tone = "slate", value }: { label: string; tone?: "slate" | "amber" | "rose"; value: string }) {
  const colors = {
    slate: "text-slate-200",
    amber: "text-amber-100",
    rose: "text-rose-100",
  };
  return (
    <div>
      <p className={cn("text-sm font-black", colors[tone])}>{value}</p>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">{label}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 text-sm leading-5">
      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-600">{label}</span>
      <span className="min-w-0 text-slate-300">{value}</span>
    </div>
  );
}

function PreviewText({ value }: { value: string }) {
  return <p className="line-clamp-4 text-sm leading-6 text-slate-300">{value}</p>;
}

function WarningLine({ value }: { value: string | null }) {
  if (!value) return null;
  return <p className="text-xs font-semibold leading-5 text-amber-100">{value}</p>;
}

function readString(value: unknown) {
  if (typeof value === "number") return new Intl.NumberFormat("en-US").format(value);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function relatedEntity(payload: Record<string, unknown>) {
  return (
    readString(payload.related_entity) ??
    readString(payload.business_name) ??
    readString(payload.candidate_name) ??
    readString(payload.opportunity_title) ??
    readString(payload.recipient_name) ??
    "Unlinked"
  );
}

function moneyImpact(miniApp: AgentMiniApp) {
  if (miniApp.estimatedRevenue > 0) return `${formatMoney(miniApp.estimatedRevenue)} rev`;
  if (miniApp.estimatedSavings > 0) return `${formatMoney(miniApp.estimatedSavings)} save`;
  if (miniApp.estimatedCost > 0) return `${formatMoney(miniApp.estimatedCost)} cost`;
  return "$0";
}

function riskTone(risk: string): "slate" | "amber" | "rose" {
  if (risk === "critical" || risk === "high") return "rose";
  if (risk === "medium") return "amber";
  return "slate";
}

function isClosed(miniApp: AgentMiniApp) {
  return miniApp.status === "executed" || miniApp.status === "rejected" || miniApp.status === "archived";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function labelFor(value: string) {
  return value.replace(/_/g, " ");
}

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
