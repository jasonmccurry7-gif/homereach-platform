"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock3,
  DollarSign,
  Edit3,
  Gauge,
  History,
  Loader2,
  Lock,
  Mic2,
  PauseCircle,
  PlayCircle,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  ToggleLeft,
  ToggleRight,
  Users,
  Workflow,
  XCircle,
} from "lucide-react";
import type {
  ExecutiveActionApproval,
  ExecutiveAgent,
  ExecutiveAgentCommitment,
  ExecutiveAgentReport,
  ExecutiveChatData,
  ExecutiveDataAdapterSnapshot,
  ExecutiveDecision,
  ExecutiveMeeting,
  ExecutiveMeetingType,
} from "@/lib/executive-meetings/types";
import { EXECUTIVE_DOMAINS } from "@/lib/executive-meetings/types";
import { cn } from "@/lib/utils";

type ActionState = {
  key: string;
  message: string;
  tone: "success" | "error";
} | null;

type AgentActivationView = {
  agentKey: string;
  status: "joining" | "joined" | "missing_report" | "failed" | "skipped_disabled";
  joinedAt: string | null;
  reportExpected: boolean;
  reportCreated: boolean;
  blockedReason: string | null;
};

export function ExecutiveChatCommandCenter({ data }: { data: ExecutiveChatData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [workingAction, setWorkingAction] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);
  const requestedMeetingId = searchParams?.get("meetingId") ?? null;
  const [selectedMeetingId, setSelectedMeetingId] = useState(
    data.meetings.some((meeting) => meeting.id === requestedMeetingId)
      ? requestedMeetingId ?? ""
      : data.selectedMeeting?.id ?? "",
  );
  const selectedMeeting = useMemo(
    () => data.meetings.find((meeting) => meeting.id === selectedMeetingId) ?? data.selectedMeeting,
    [data.meetings, data.selectedMeeting, selectedMeetingId],
  );
  const selectedReports = useMemo(
    () => data.agentReports.filter((report) => report.meetingId === selectedMeeting?.id),
    [data.agentReports, selectedMeeting?.id],
  );
  const reportByAgent = useMemo(() => {
    const map = new Map<string, ExecutiveAgentReport>();
    selectedReports.forEach((report) => map.set(report.agentKey, report));
    return map;
  }, [selectedReports]);
  const selectedApprovals = useMemo(
    () => data.approvals.filter((approval) => approval.meetingId === selectedMeeting?.id || approval.approvalStatus === "pending"),
    [data.approvals, selectedMeeting?.id],
  );

  async function run(action: string, body: Record<string, unknown> = {}, success = "Saved") {
    setActionState(null);
    setWorkingAction(action);
    try {
      const response = await fetch("/api/admin/executive-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        setActionState({ key: action, message: String(result.error ?? "Action failed"), tone: "error" });
        return;
      }
      setActionState({ key: action, message: result.reused ? "Existing executive call opened." : success, tone: "success" });
      if (typeof result.meetingId === "string") {
        setSelectedMeetingId(result.meetingId);
        window.history.replaceState(null, "", `/admin/executive-chat?meetingId=${encodeURIComponent(result.meetingId)}`);
      }
      startTransition(() => router.refresh());
    } catch (error) {
      setActionState({ key: action, message: error instanceof Error ? error.message : "Action failed", tone: "error" });
    } finally {
      setWorkingAction(null);
    }
  }

  function runMeeting(meetingType: ExecutiveMeetingType) {
    void run(
      "generate_meeting",
      { meetingType },
      meetingType === "morning" ? "Morning executive call generated." : "Afternoon executive call generated.",
    );
  }

  function selectMeeting(meetingId: string) {
    setSelectedMeetingId(meetingId);
    window.history.replaceState(null, "", `/admin/executive-chat?meetingId=${encodeURIComponent(meetingId)}`);
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_30%),linear-gradient(135deg,#07111f,#101827_55%,#111827)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-50">
                <Users className="h-3.5 w-3.5" />
                AI Executive Leadership
              </p>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Executive Daily Meeting</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Morning focus, afternoon accountability, approval-safe decisions, and source-backed agent reporting for the HomeReach operating system.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <CommandButton
                label="Run Morning Call"
                detail={`0800 ${data.settings.timezone}`}
                icon={PlayCircle}
                loading={workingAction === "generate_meeting" && isPending}
                onClick={() => runMeeting("morning")}
                testId="executive-run-morning"
              />
              <CommandButton
                label="Run Afternoon Call"
                detail={`1630 ${data.settings.timezone}`}
                icon={Clock3}
                loading={workingAction === "generate_meeting" && isPending}
                onClick={() => runMeeting("afternoon")}
                testId="executive-run-afternoon"
              />
            </div>
          </div>

          {!data.schemaReady || data.warnings.length > 0 ? (
            <div className="mt-5 rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-50">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-black">{data.schemaReady ? "Executive meeting system loaded with source warnings" : "Executive meeting system is in seed fallback mode"}</p>
                  {data.migrationHint ? <p className="mt-1 text-amber-50/80">{data.migrationHint}</p> : null}
                  {data.warnings.slice(0, 5).map((warning) => (
                    <p key={warning} className="mt-1 text-xs text-amber-50/75">{warning}</p>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Enabled agents" value={data.summary.enabledAgents} icon={Bot} tone="emerald" />
            <KpiCard label="Pending approvals" value={data.summary.pendingApprovals} icon={ShieldCheck} tone="amber" />
            <KpiCard label="Decisions needed" value={data.summary.decisionsNeeded} icon={Target} tone="cyan" />
            <KpiCard label="Blockers" value={data.summary.blockers} icon={AlertTriangle} tone="rose" />
            <KpiCard label="Revenue waiting" value={money(data.summary.estimatedRevenue)} icon={DollarSign} tone="emerald" />
            <KpiCard label="Savings waiting" value={money(data.summary.estimatedSavings)} icon={DollarSign} tone="teal" />
            <KpiCard label="Missed commitments" value={data.summary.missedCommitments} icon={XCircle} tone="rose" />
            <KpiCard label="Data adapters online" value={`${data.summary.adaptersOnline}/${data.sourceSnapshot.adapters.length}`} icon={Workflow} tone="cyan" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-300">
            <Badge icon={History} label={`Latest morning: ${data.latestMorning ? shortDateTime(data.latestMorning.generatedAt) : "Not generated"}`} />
            <Badge icon={History} label={`Latest afternoon: ${data.latestAfternoon ? shortDateTime(data.latestAfternoon.generatedAt) : "Not generated"}`} />
            <Badge icon={Lock} label="External actions disabled by design" tone="amber" />
            <Badge icon={Mic2} label={`Voice mode ${data.settings.voiceModeEnabled ? "ready flag on" : "placeholder"}`} tone="cyan" />
          </div>

          {actionState ? (
            <div className={cn(
              "mt-4 rounded-lg border px-4 py-3 text-sm font-semibold",
              actionState.tone === "success"
                ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-50"
                : "border-rose-300/25 bg-rose-300/10 text-rose-50",
            )}>
              {actionState.message}
            </div>
          ) : null}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
        <div className="space-y-5">
          <MeetingHistory
            meetings={data.meetings}
            selectedMeetingId={selectedMeeting?.id ?? ""}
            onSelect={selectMeeting}
          />
          <SourceAdapterPanel adapters={data.sourceSnapshot.adapters} />
          <VoicePlan settings={data.settings} onToggle={(voiceModeEnabled) => void run("update_settings", { voiceModeEnabled }, "Voice-ready flag updated.")} />
        </div>

        <div className="space-y-5">
          <MeetingOverview meeting={selectedMeeting} reports={selectedReports} />
          <DecisionPanel approvals={selectedApprovals} decisions={selectedMeeting?.decisionsNeededJson ?? []} onAction={run} workingAction={workingAction} />
          <AgentReportGrid agents={data.agents} meeting={selectedMeeting} reportByAgent={reportByAgent} onAction={run} workingAction={workingAction} />
          <AccountabilityPanel commitments={data.commitments} />
        </div>
      </section>
    </main>
  );
}

function CommandButton({
  detail,
  icon: Icon,
  label,
  loading,
  onClick,
  testId,
}: {
  detail: string;
  icon: typeof PlayCircle;
  label: string;
  loading?: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      data-testid={testId}
      className="flex min-h-16 items-center gap-3 rounded-lg border border-white/10 bg-white px-4 text-left text-slate-950 shadow-xl shadow-black/20 transition hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-70"
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      <span>
        <span className="block text-sm font-black">{label}</span>
        <span className="block text-xs font-semibold text-slate-500">{detail}</span>
      </span>
    </button>
  );
}

function KpiCard({ icon: Icon, label, tone, value }: { icon: typeof Bot; label: string; tone: "emerald" | "amber" | "cyan" | "rose" | "teal"; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <Icon className={cn("h-4 w-4", toneClass(tone, "text"))} />
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function MeetingHistory({
  meetings,
  onSelect,
  selectedMeetingId,
}: {
  meetings: ExecutiveMeeting[];
  selectedMeetingId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Panel title="Meeting History" icon={History}>
      {meetings.length === 0 ? (
        <EmptyState title="No saved meetings yet" detail="Run a morning or afternoon call to create the first executive record." />
      ) : (
        <div className="space-y-2">
          {meetings.slice(0, 12).map((meeting) => (
            <button
              key={meeting.id}
              type="button"
              onClick={() => onSelect(meeting.id)}
              className={cn(
                "w-full rounded-lg border px-3 py-3 text-left transition",
                selectedMeetingId === meeting.id
                  ? "border-cyan-300/35 bg-cyan-300/10"
                  : "border-white/10 bg-white/[0.025] hover:bg-white/[0.06]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-white">{meeting.title}</p>
                <StatusPill value={meeting.meetingType} />
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-500">{shortDateTime(meeting.generatedAt)}</p>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

function MeetingOverview({ meeting, reports }: { meeting: ExecutiveMeeting | null; reports: ExecutiveAgentReport[] }) {
  return (
    <Panel title="CEO Summary" icon={Gauge}>
      {!meeting ? (
        <EmptyState title="No meeting selected" detail="Generate a call to see the CEO summary and agent reports." />
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill value={meeting.meetingType} />
            <StatusPill value={meeting.status} tone="emerald" />
            <span className="text-xs font-semibold text-slate-500">{shortDateTime(meeting.generatedAt)}</span>
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white">{meeting.title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">{meeting.ceoSummary}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MiniMetric label="Agent reports" value={reports.length} />
            <MiniMetric label="Decisions" value={meeting.decisionsNeededJson.length} />
            <MiniMetric label="Blockers" value={meeting.blockersJson.length} />
          </div>
          <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100">Revenue / Savings</p>
            <p className="mt-1 text-sm font-semibold text-emerald-50">
              {money(meeting.revenueImpactJson.estimatedRevenue)} revenue awaiting approval and {money(meeting.revenueImpactJson.estimatedSavings)} savings awaiting review.
            </p>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <ListBlock title="Blockers" items={meeting.blockersJson.map((item) => `${item.title}: ${item.detail}`)} />
            <ListBlock title="Tomorrow Priorities" items={meeting.tomorrowPrioritiesJson.map((item) => `${item.title}: ${item.detail}`)} />
          </div>
        </div>
      )}
    </Panel>
  );
}

function DecisionPanel({
  approvals,
  decisions,
  onAction,
  workingAction,
}: {
  approvals: ExecutiveActionApproval[];
  decisions: ExecutiveDecision[];
  onAction: (action: string, body?: Record<string, unknown>, success?: string) => Promise<void>;
  workingAction: string | null;
}) {
  return (
    <Panel title="Decision / Approval Queue" icon={ShieldCheck}>
      {approvals.length === 0 && decisions.length === 0 ? (
        <EmptyState title="No approval decisions open" detail="Agents will place sensitive recommendations here after meetings are generated." />
      ) : (
        <div className="space-y-3">
          {approvals.slice(0, 8).map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} onAction={onAction} workingAction={workingAction} />
          ))}
          {approvals.length === 0
            ? decisions.slice(0, 8).map((decision) => (
                <div key={`${decision.agentKey}-${decision.title}`} className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <RiskPill risk={decision.riskLevel} />
                    <span className="text-xs font-semibold text-slate-500">{decision.agentKey}</span>
                  </div>
                  <p className="mt-2 text-sm font-black text-white">{decision.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{decision.detail}</p>
                </div>
              ))
            : null}
        </div>
      )}
    </Panel>
  );
}

function ApprovalCard({
  approval,
  onAction,
  workingAction,
}: {
  approval: ExecutiveActionApproval;
  onAction: (action: string, body?: Record<string, unknown>, success?: string) => Promise<void>;
  workingAction: string | null;
}) {
  const [editedAction, setEditedAction] = useState(approval.editedAction ?? approval.pendingAction);
  const [decisionReason, setDecisionReason] = useState(approval.decisionReason ?? "");
  const loading = workingAction === "update_approval";
  const canDecide = approval.approvalStatus === "pending" || approval.approvalStatus === "edited";

  function decide(status: ExecutiveActionApproval["approvalStatus"]) {
    void onAction(
      "update_approval",
      {
        approvalId: approval.id,
        approvalStatus: status,
        editedAction: status === "edited" ? editedAction : undefined,
        decisionReason,
      },
      `Approval marked ${status}.`,
    );
  }

  return (
    <article
      className="rounded-lg border border-white/10 bg-[#0b1424] p-3"
      data-testid="executive-approval-card"
      data-approval-id={approval.id}
    >
      <div className="flex flex-wrap items-center gap-2">
        <RiskPill risk={approval.riskLevel} />
        <StatusPill
          value={approval.approvalStatus}
          tone={approval.approvalStatus === "pending" ? "amber" : approval.approvalStatus === "rejected" ? "rose" : "emerald"}
        />
      </div>
      <p className="mt-2 text-sm font-black text-white">{approval.pendingAction}</p>
      <p className="mt-1 text-sm leading-6 text-slate-400">{approval.businessReason}</p>
      {canDecide ? (
        <div className="mt-3 space-y-2">
          <input
            value={editedAction}
            onChange={(event) => setEditedAction(event.target.value)}
            data-testid="executive-approval-edited-action"
            className="min-h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-semibold text-white outline-none"
          />
          <input
            value={decisionReason}
            onChange={(event) => setDecisionReason(event.target.value)}
            placeholder="Decision note"
            data-testid="executive-approval-decision-reason"
            className="min-h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
          />
          <div className="flex flex-wrap gap-2">
            <SmallButton
              label={approval.approvalStatus === "edited" ? "Approve Edited" : "Approve"}
              icon={CheckCircle2}
              loading={loading}
              onClick={() => decide("approved")}
              testId="executive-approval-approve"
            />
            <SmallButton
              label="Edit"
              icon={Edit3}
              loading={loading}
              variant="secondary"
              onClick={() => decide("edited")}
              testId="executive-approval-edit"
            />
            <SmallButton
              label="Reject"
              icon={XCircle}
              loading={loading}
              variant="danger"
              onClick={() => decide("rejected")}
              testId="executive-approval-reject"
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}

function AgentReportGrid({
  agents,
  meeting,
  onAction,
  reportByAgent,
  workingAction,
}: {
  agents: ExecutiveAgent[];
  meeting: ExecutiveMeeting | null;
  reportByAgent: Map<string, ExecutiveAgentReport>;
  onAction: (action: string, body?: Record<string, unknown>, success?: string) => Promise<void>;
  workingAction: string | null;
}) {
  const activationRoster = useMemo(() => agentActivationRoster(meeting), [meeting]);
  const activationByAgent = useMemo(() => {
    const map = new Map<string, AgentActivationView>();
    activationRoster.forEach((item) => map.set(item.agentKey, item));
    return map;
  }, [activationRoster]);
  const expected = activationRoster.filter((item) => item.reportExpected).length;
  const joined = activationRoster.filter((item) => item.status === "joined").length;
  const missing = activationRoster.filter((item) => item.status === "missing_report" || item.status === "failed").length;

  return (
    <Panel title="Executive Agents" icon={Bot}>
      {meeting ? (
        <div className={cn(
          "mb-3 rounded-lg border p-3 text-sm",
          missing > 0 ? "border-rose-300/20 bg-rose-300/10 text-rose-50" : "border-emerald-300/20 bg-emerald-300/10 text-emerald-50",
        )}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-black">
              {joined}/{expected} enabled agents joined the {meeting.meetingType} call
            </p>
            <StatusPill value={missing > 0 ? "activation attention" : "activation complete"} tone={missing > 0 ? "rose" : "emerald"} />
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 xl:grid-cols-2">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            activation={activationByAgent.get(agent.agentKey) ?? null}
            agent={agent}
            report={reportByAgent.get(agent.agentKey) ?? null}
            onAction={onAction}
            workingAction={workingAction}
          />
        ))}
      </div>
    </Panel>
  );
}

function AgentCard({
  activation,
  agent,
  onAction,
  report,
  workingAction,
}: {
  activation: AgentActivationView | null;
  agent: ExecutiveAgent;
  report: ExecutiveAgentReport | null;
  onAction: (action: string, body?: Record<string, unknown>, success?: string) => Promise<void>;
  workingAction: string | null;
}) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [prompt, setPrompt] = useState(agent.systemPrompt);
  const [selectedDomains, setSelectedDomains] = useState<string[]>(agent.assignedDomains);
  const loading = workingAction === "update_agent" || workingAction === "toggle_agent";

  function saveAgent() {
    void onAction(
      "update_agent",
      {
        agentId: agent.id,
        systemPrompt: prompt,
        assignedDomains: selectedDomains,
        permissionsLevel: agent.permissionsLevel,
      },
      `${agent.role} updated.`,
    );
  }

  return (
    <article
      className={cn("rounded-lg border p-4", agent.enabled ? "border-white/10 bg-[#0b1424]" : "border-slate-700 bg-slate-950/60 opacity-75")}
      data-testid="executive-agent-card"
      data-agent-key={agent.agentKey}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill value={agent.permissionsLevel.replace(/_/g, " ")} tone="cyan" />
            {agent.enabled ? <StatusPill value="enabled" tone="emerald" /> : <StatusPill value="disabled" tone="slate" />}
            <StatusPill
              value={activation ? activationLabel(activation) : agent.enabled ? "not called" : "disabled"}
              tone={activationTone(activation, agent.enabled)}
            />
          </div>
          <h3 className="mt-3 text-lg font-black text-white">{agent.role}</h3>
          <p className="text-sm font-semibold text-slate-400">{agent.name}</p>
        </div>
        <button
          type="button"
          onClick={() => void onAction("toggle_agent", { agentId: agent.id, enabled: !agent.enabled }, `${agent.role} ${agent.enabled ? "disabled" : "enabled"}.`)}
          disabled={loading}
          className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:bg-white hover:text-slate-950 disabled:cursor-wait"
          title={agent.enabled ? "Disable agent" : "Enable agent"}
        >
          {agent.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
        </button>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{agent.mission}</p>
      {activation ? (
        <div
          className={cn(
            "mt-3 rounded-lg border p-3 text-xs font-semibold",
            activation.status === "joined"
              ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
              : activation.status === "failed" || activation.status === "missing_report"
                ? "border-rose-300/20 bg-rose-300/10 text-rose-50"
                : "border-white/10 bg-white/[0.035] text-slate-300",
          )}
          data-testid="executive-agent-activation"
          data-agent-key={agent.agentKey}
          data-activation-status={activation.status}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{activationLabel(activation)}</span>
            {activation.joinedAt ? <span className="text-slate-400">{shortDateTime(activation.joinedAt)}</span> : null}
          </div>
          {activation.blockedReason ? <p className="mt-1 text-slate-300">{activation.blockedReason}</p> : null}
        </div>
      ) : null}

      {report ? (
        <div className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100">Latest report</p>
          <p className="mt-1 text-sm leading-6 text-cyan-50">{report.summary}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <MiniMetric label="Priority" value={report.prioritiesJson[0]?.title ?? "None"} />
            <MiniMetric label="Risk" value={report.risksJson[0]?.severity ?? "low"} />
            <MiniMetric label="Confidence" value={`${Math.round(report.confidenceScore)}%`} />
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {agent.assignedDomains.map((domain) => (
          <span key={domain} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-bold text-slate-300">
            {domain}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setPromptOpen((value) => !value)}
        className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-slate-200 transition hover:bg-white hover:text-slate-950"
      >
        <Edit3 className="h-3.5 w-3.5" />
        Edit Prompt / Domains
      </button>

      {promptOpen ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">System prompt</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="mt-2 min-h-36 w-full resize-y rounded-lg border border-white/10 bg-slate-950 p-3 text-sm leading-6 text-white outline-none"
            />
          </label>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {EXECUTIVE_DOMAINS.map((domain) => (
              <label key={domain} className="flex min-h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={selectedDomains.includes(domain)}
                  onChange={(event) => {
                    setSelectedDomains((current) =>
                      event.target.checked
                        ? [...new Set([...current, domain])]
                        : current.filter((item) => item !== domain),
                    );
                  }}
                />
                {domain}
              </label>
            ))}
          </div>
          <SmallButton label="Save agent" icon={Save} loading={loading} onClick={saveAgent} className="mt-3" />
        </div>
      ) : null}
    </article>
  );
}

function AccountabilityPanel({ commitments }: { commitments: ExecutiveAgentCommitment[] }) {
  const groups = useMemo(() => {
    return {
      planned: commitments.filter((item) => item.status === "planned").slice(0, 8),
      completed: commitments.filter((item) => item.status === "completed").slice(0, 8),
      missed: commitments.filter((item) => ["missed", "deferred", "blocked"].includes(item.status)).slice(0, 8),
    };
  }, [commitments]);

  return (
    <Panel title="Accountability" icon={BarChart3}>
      {commitments.length === 0 ? (
        <EmptyState title="No commitments yet" detail="Morning calls create planned work; afternoon calls expose what still needs evidence or follow-up." />
      ) : (
        <div className="grid gap-3 xl:grid-cols-3">
          <CommitmentColumn title="Planned" items={groups.planned} />
          <CommitmentColumn title="Completed" items={groups.completed} />
          <CommitmentColumn title="Needs evidence" items={groups.missed} />
        </div>
      )}
    </Panel>
  );
}

function CommitmentColumn({ items, title }: { items: ExecutiveAgentCommitment[]; title: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <div key={item.id} className="rounded-lg border border-white/10 bg-slate-950/50 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill value={item.status} tone={item.status === "completed" ? "emerald" : item.status === "planned" ? "cyan" : "amber"} />
              <RiskPill risk={item.riskLevel} />
            </div>
            <p className="mt-2 text-sm font-semibold leading-5 text-slate-200">{item.commitmentText}</p>
            <p className="mt-1 text-xs text-slate-500">{item.domain} · {item.commitmentDate}</p>
          </div>
        )) : <p className="text-sm text-slate-500">None</p>}
      </div>
    </div>
  );
}

function SourceAdapterPanel({ adapters }: { adapters: ExecutiveDataAdapterSnapshot[] }) {
  return (
    <Panel title="Data Sources" icon={Workflow}>
      {adapters.length === 0 ? (
        <EmptyState title="No adapters loaded" detail="Source adapters will appear when Supabase service credentials are available." />
      ) : (
        <div className="grid gap-2">
          {adapters.map((adapter) => (
            <div key={adapter.key} className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-white">{adapter.label}</p>
                <StatusPill value={adapter.status} tone={adapter.status === "online" ? "emerald" : adapter.status === "missing" ? "amber" : "slate"} />
              </div>
              <p className="mt-1 text-2xl font-black text-white">{adapter.value}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{adapter.warning ?? adapter.detail}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function VoicePlan({
  onToggle,
  settings,
}: {
  settings: ExecutiveChatData["settings"];
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <Panel title="Voice Ready" icon={Mic2}>
      <div className="space-y-3 text-sm leading-6 text-slate-300">
        <p>Provider abstraction, agent voice assignment, turn-taking, playback, transcript saving, and live meeting hooks are stored as placeholders.</p>
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-amber-50">
          Human approval remains required before any external action in future voice mode.
        </div>
        <button
          type="button"
          onClick={() => onToggle(!settings.voiceModeEnabled)}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-slate-100 transition hover:bg-white hover:text-slate-950"
        >
          {settings.voiceModeEnabled ? <PauseCircle className="h-4 w-4" /> : <Mic2 className="h-4 w-4" />}
          {settings.voiceModeEnabled ? "Disable Voice Flag" : "Enable Voice Flag"}
        </button>
      </div>
    </Panel>
  );
}

function Panel({ children, icon: Icon, title }: { children: React.ReactNode; icon: typeof Bot; title: string }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-200" />
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-300">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.025] p-6 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-slate-500" />
      <p className="mt-3 text-sm font-black text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p>
    </div>
  );
}

function ListBlock({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="mt-2 space-y-2">
        {items.length ? items.slice(0, 5).map((item) => <p key={item} className="text-sm leading-6 text-slate-300">{item}</p>) : <p className="text-sm text-slate-500">None</p>}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-slate-950/40 p-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function SmallButton({
  className,
  icon: Icon,
  label,
  loading,
  onClick,
  testId,
  variant = "primary",
}: {
  className?: string;
  icon: typeof Save;
  label: string;
  loading?: boolean;
  onClick: () => void;
  testId?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      data-testid={testId}
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-black transition disabled:cursor-wait disabled:opacity-70",
        variant === "primary" && "bg-white text-slate-950 hover:bg-emerald-50",
        variant === "secondary" && "border border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white hover:text-slate-950",
        variant === "danger" && "border border-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-200 hover:text-rose-950",
        className,
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function agentActivationRoster(meeting: ExecutiveMeeting | null): AgentActivationView[] {
  const raw = meeting?.voiceReadyJson.activeAgentRoster;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      agentKey: stringValue(item.agentKey),
      status: activationStatus(item.status),
      joinedAt: nullableString(item.joinedAt),
      reportExpected: item.reportExpected === true,
      reportCreated: item.reportCreated === true,
      blockedReason: nullableString(item.blockedReason),
    }))
    .filter((item) => item.agentKey.length > 0);
}

function activationStatus(value: unknown): AgentActivationView["status"] {
  if (
    value === "joining" ||
    value === "joined" ||
    value === "missing_report" ||
    value === "failed" ||
    value === "skipped_disabled"
  ) {
    return value;
  }
  return "missing_report";
}

function activationLabel(activation: AgentActivationView) {
  if (activation.status === "joined") return activation.reportCreated ? "joined call" : "joined, report pending";
  if (activation.status === "joining") return "joining call";
  if (activation.status === "failed") return "join failed";
  if (activation.status === "missing_report") return "missing report";
  return "disabled for call";
}

function activationTone(activation: AgentActivationView | null, enabled: boolean): "emerald" | "amber" | "cyan" | "rose" | "slate" {
  if (!enabled) return "slate";
  if (!activation) return "amber";
  if (activation.status === "joined") return "emerald";
  if (activation.status === "joining") return "cyan";
  if (activation.status === "failed" || activation.status === "missing_report") return "rose";
  return "slate";
}

function Badge({ icon: Icon, label, tone = "slate" }: { icon: typeof History; label: string; tone?: "slate" | "amber" | "cyan" }) {
  return (
    <span className={cn("inline-flex min-h-8 items-center gap-2 rounded-lg border px-3", tone === "amber" ? "border-amber-300/20 bg-amber-300/10 text-amber-50" : tone === "cyan" ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-50" : "border-white/10 bg-white/[0.04] text-slate-300")}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function StatusPill({ tone = "slate", value }: { tone?: "emerald" | "amber" | "cyan" | "rose" | "slate"; value: string }) {
  return (
    <span className={cn(
      "rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
      tone === "emerald" && "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
      tone === "amber" && "border-amber-300/20 bg-amber-300/10 text-amber-100",
      tone === "cyan" && "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
      tone === "rose" && "border-rose-300/20 bg-rose-300/10 text-rose-100",
      tone === "slate" && "border-white/10 bg-white/[0.04] text-slate-300",
    )}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

function RiskPill({ risk }: { risk: "low" | "medium" | "high" | "critical" }) {
  const tone = risk === "critical" || risk === "high" ? "rose" : risk === "medium" ? "amber" : "emerald";
  return (
    <span className={cn(
      "rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
      tone === "rose" && "border-rose-300/20 bg-rose-300/10 text-rose-100",
      tone === "amber" && "border-amber-300/20 bg-amber-300/10 text-amber-100",
      tone === "emerald" && "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    )}>
      {risk} risk
    </span>
  );
}

function toneClass(tone: "emerald" | "amber" | "cyan" | "rose" | "teal", type: "text") {
  if (type === "text") {
    return {
      emerald: "text-emerald-200",
      amber: "text-amber-200",
      cyan: "text-cyan-200",
      rose: "text-rose-200",
      teal: "text-teal-200",
    }[tone];
  }
  return "";
}

function shortDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
