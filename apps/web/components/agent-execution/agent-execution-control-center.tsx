"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  LockKeyhole,
  MonitorCheck,
  PauseCircle,
  PlayCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  AgentExecutionReadinessData,
  AgentExecutionStatus,
  AgentExecutionTask,
  AgentPermissionScope,
  BrowserSessionRegistryItem,
} from "@/lib/agent-execution/types";
import { cn } from "@/lib/utils";

type Lane = {
  key: string;
  title: string;
  icon: LucideIcon;
  tasks: AgentExecutionTask[];
};

const SCOPE_LABELS: Record<AgentPermissionScope, string> = {
  read_only: "Read only",
  draft_only: "Draft only",
  prepare_only: "Prepare only",
  send_after_approval: "Send after approval",
  purchase_after_approval: "Purchase after approval",
  submit_after_approval: "Submit after approval",
};

const STATUS_LABELS: Record<AgentExecutionStatus, string> = {
  pending_approval: "Pending approval",
  queued: "Queued",
  approved: "Approved",
  dry_run_ready: "Dry run ready",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  paused: "Paused",
  rejected: "Rejected",
  cancelled: "Cancelled",
  manual_takeover_required: "Manual takeover",
  manual_takeover_needed: "Manual takeover",
  executed_manually: "Executed manually",
};

export function AgentExecutionControlCenter({
  data,
}: {
  data: AgentExecutionReadinessData;
}) {
  const sensitiveTasks = data.tasks.filter(
    (task) =>
      task.sensitiveActionFlags.length > 0 ||
      task.permissionScope === "send_after_approval" ||
      task.permissionScope === "purchase_after_approval" ||
      task.permissionScope === "submit_after_approval",
  );
  const lanes: Lane[] = [
    {
      key: "pending",
      title: "Pending approvals",
      icon: ShieldCheck,
      tasks: data.tasks.filter((task) => task.status === "pending_approval"),
    },
    {
      key: "approved",
      title: "Approved tasks",
      icon: CheckCircle2,
      tasks: data.tasks.filter(
        (task) => task.status === "approved" || task.status === "dry_run_ready",
      ),
    },
    {
      key: "running",
      title: "Running tasks",
      icon: PlayCircle,
      tasks: data.tasks.filter((task) => task.status === "running"),
    },
    {
      key: "failed",
      title: "Failed tasks",
      icon: XCircle,
      tasks: data.tasks.filter((task) => task.status === "failed"),
    },
    {
      key: "completed",
      title: "Completed tasks",
      icon: FileCheck2,
      tasks: data.tasks.filter(
        (task) =>
          task.status === "completed" || task.status === "executed_manually",
      ),
    },
    {
      key: "manual",
      title: "Manual takeover needed",
      icon: UserCheck,
      tasks: data.tasks.filter(
        (task) =>
          task.manualTakeoverRequired ||
          task.status === "manual_takeover_required",
      ),
    },
    {
      key: "sensitive",
      title: "Sensitive action queue",
      icon: LockKeyhole,
      tasks: sensitiveTasks,
    },
  ];

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <section className="border-b border-white/10 bg-[linear-gradient(135deg,#07111f,#0d1727_55%,#101827)] px-4 py-7 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
            <MonitorCheck className="h-3.5 w-3.5" />
            Agent Execution Readiness
          </div>
          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_520px] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">
                Safe browser/computer-use preparation layer
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                HomeReach can now prepare future Codex browser/computer-use
                tasks through approved mini apps, scoped permissions, dry-run
                checklists, browser session registry records, and audit logs.
                This page does not control the computer.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric
                label="Pending"
                value={data.summary.pendingApprovals}
                tone="amber"
              />
              <Metric
                label="Approved"
                value={data.summary.approvedTasks}
                tone="emerald"
              />
              <Metric
                label="Dry runs"
                value={data.summary.dryRunReady}
                tone="sky"
              />
              <Metric
                label="Manual"
                value={data.summary.manualTakeoverNeeded}
                tone="rose"
              />
              <Metric
                label="Sensitive"
                value={data.summary.sensitiveActionQueue}
                tone="amber"
              />
              <Metric
                label="Failed"
                value={data.summary.failedTasks}
                tone="rose"
              />
              <Metric
                label="Complete"
                value={data.summary.completedTasks}
                tone="slate"
              />
              <Metric
                label="Systems"
                value={data.summary.registeredSystems}
                tone="sky"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        {!data.schemaReady ? (
          <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-black">
                  Agent Execution Readiness is using fallback data.
                </p>
                <p className="mt-1 text-amber-50/80">{data.migrationHint}</p>
                {data.warnings.map((warning) => (
                  <p key={warning} className="mt-1 text-xs text-amber-50/70">
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <Panel title="Execution boundary" icon={ShieldCheck}>
          <div className="grid gap-3 lg:grid-cols-3">
            <InfoCard
              label="No direct browser control"
              detail="This layer prepares task records, approvals, logs, screenshot placeholders, and dry-run checklists. It does not click, type, send, buy, submit, or change external systems."
            />
            <InfoCard
              label="Human approval required"
              detail="Email, SMS, public posts, purchases, bid submissions, contracts, settings changes, deletes, and sensitive exports require human approval before any future execution."
            />
            <InfoCard
              label="Dedicated sessions only"
              detail="Assume sessions are managed outside HomeReach through a dedicated Windows user and dedicated Chrome profile. No passwords, API keys, MFA secrets, cookies, or tokens are stored."
            />
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Permission scopes" icon={LockKeyhole}>
            <div className="space-y-2">
              {data.permissionScopes.map((scope) => (
                <div
                  key={scope}
                  className="rounded-lg border border-white/10 bg-white/[0.035] p-3"
                >
                  <p className="text-sm font-black text-white">
                    {SCOPE_LABELS[scope]}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {scopeDetail(scope)}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Sensitive action guardrails" icon={AlertTriangle}>
            <ul className="space-y-2">
              {data.sensitiveGuardrails.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm leading-6 text-slate-300"
                >
                  <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-amber-200" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Security positioning" icon={ClipboardCheck}>
            <ul className="space-y-2">
              {data.securityRules.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm leading-6 text-slate-300"
                >
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-200" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {lanes.map((lane) => (
            <TaskLane key={lane.key} lane={lane} />
          ))}
        </div>

        <Panel title="Browser session registry settings" icon={MonitorCheck}>
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <RegistryForm />
            <div className="space-y-3">
              {data.registry.map((item) => (
                <RegistryCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Audit log" icon={ClipboardCheck}>
          <div className="space-y-3">
            {data.auditLogs.length === 0 ? (
              <EmptyState label="No persisted Agent Execution audit logs yet." />
            ) : (
              data.auditLogs.slice(0, 40).map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-white/10 bg-white/[0.035] p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-white">
                        {log.eventType.replace(/_/g, " ")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {log.actorLabel} / {log.allowedScope} /{" "}
                        {formatDate(log.createdAt)}
                      </p>
                      {log.notes ? (
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {log.notes}
                        </p>
                      ) : null}
                    </div>
                    <StatusPill status={log.result} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
    </main>
  );
}

function TaskLane({ lane }: { lane: Lane }) {
  const Icon = lane.icon;
  return (
    <Panel title={`${lane.title} (${lane.tasks.length})`} icon={Icon}>
      <div className="space-y-3">
        {lane.tasks.length === 0 ? (
          <EmptyState label="No tasks in this lane." />
        ) : null}
        {lane.tasks.map((task) => (
          <ExecutionTaskCard key={`${lane.key}-${task.id}`} task={task} />
        ))}
      </div>
    </Panel>
  );
}

function ExecutionTaskCard({ task }: { task: AgentExecutionTask }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-white">{task.taskId}</p>
            <StatusPill status={STATUS_LABELS[task.status]} />
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[11px] font-black uppercase text-cyan-100">
              {SCOPE_LABELS[task.permissionScope]}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-200">
            {task.miniAppId} / {task.sourceAgent}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {task.taskType}
            {" -> "}
            {task.targetSystem}
          </p>
          {task.targetUrl ? (
            <a
              href={task.targetUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-sky-200 hover:text-white"
            >
              Target URL <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
          {task.sensitiveActionFlags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {task.sensitiveActionFlags.map((flag) => (
                <span
                  key={flag}
                  className="rounded-full bg-amber-300/15 px-2 py-1 text-[11px] font-black uppercase text-amber-100"
                >
                  {flag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <ExecutionActionButton
            label="Approve dry run"
            icon={ShieldCheck}
            action={{
              action: "update_execution_task",
              id: task.id,
              status: "dry_run_ready",
              permissionScope: "read_only",
              notes:
                "Approved for dry-run checklist only. No browser execution or external mutation is authorized.",
            }}
          />
          <ExecutionActionButton
            label="Draft only"
            icon={FileCheck2}
            action={{
              action: "update_execution_task",
              id: task.id,
              status: "approved",
              permissionScope: "draft_only",
              notes:
                "Approved for draft-only preparation. No sending, posting, submitting, buying, deleting, exporting, or settings changes.",
            }}
          />
          <ExecutionActionButton
            label="Manual takeover"
            icon={UserCheck}
            variant="secondary"
            action={{
              action: "update_execution_task",
              id: task.id,
              status: "manual_takeover_required",
              permissionScope: "read_only",
              notes:
                "Manual takeover required. Future browser agent should stop and hand off to owner.",
            }}
          />
          <ExecutionActionButton
            label="Manual done"
            icon={CheckCircle2}
            variant="success"
            action={{
              action: "update_execution_task",
              id: task.id,
              status: "executed_manually",
              permissionScope: "read_only",
              notes:
                "Marked completed manually by admin. No autonomous browser execution was performed by HomeReach.",
            }}
          />
          <ExecutionActionButton
            label="Pause"
            icon={PauseCircle}
            variant="secondary"
            action={{
              action: "update_execution_task",
              id: task.id,
              status: "paused",
              notes: "Paused from Agent Execution Readiness.",
            }}
          />
        </div>
      </div>
      {task.dryRunChecklist.length > 0 ? (
        <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/35 p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Dry-run checklist
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {task.dryRunChecklist.map((item) => (
              <div
                key={`${task.id}-${item.label}`}
                className="rounded-md border border-white/10 bg-white/[0.025] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-white">{item.label}</p>
                  <StatusPill status={item.status} />
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RegistryCard({ item }: { item: BrowserSessionRegistryItem }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black text-white">{item.systemName}</p>
          <p className="mt-1 text-xs text-slate-500">
            {item.accountOwner} / MFA{" "}
            {item.requiresMfa ? "required" : "not required"}
          </p>
        </div>
        <StatusPill status={item.activeSessionStatus.replace(/_/g, " ")} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{item.purpose}</p>
      {item.loginUrl ? (
        <a
          href={item.loginUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-sky-200 hover:text-white"
        >
          Login URL <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <SmallList label="Allowed" items={item.allowedActions} tone="emerald" />
        <SmallList label="Blocked" items={item.blockedActions} tone="rose" />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{item.notes}</p>
    </div>
  );
}

function RegistryForm() {
  const [systemName, setSystemName] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [purpose, setPurpose] = useState("");
  const [accountOwner, setAccountOwner] = useState("Jason McCurry");
  const [allowedActions, setAllowedActions] = useState(
    "read approved context, prepare checklist, draft only",
  );
  const [blockedActions, setBlockedActions] = useState(
    "send, submit, purchase, delete, export sensitive data, change account settings",
  );
  const [notes, setNotes] = useState(
    "No credentials, API keys, MFA secrets, cookies, or browser session tokens are stored in HomeReach.",
  );
  const [status, setStatus] = useState("manual_login_required");

  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
      <p className="text-sm font-black text-white">Document external system</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        This records access policy only. Do not enter passwords, API keys, MFA
        secrets, cookies, or session tokens.
      </p>
      <div className="mt-4 grid gap-3">
        <TextInput
          label="System name"
          value={systemName}
          setValue={setSystemName}
          placeholder="Example: Supplier portal"
        />
        <TextInput
          label="Login URL"
          value={loginUrl}
          setValue={setLoginUrl}
          placeholder="https://..."
        />
        <TextInput
          label="Purpose"
          value={purpose}
          setValue={setPurpose}
          placeholder="Read-only review and draft preparation"
        />
        <TextInput
          label="Account owner"
          value={accountOwner}
          setValue={setAccountOwner}
        />
        <TextInput
          label="Allowed actions"
          value={allowedActions}
          setValue={setAllowedActions}
        />
        <TextInput
          label="Blocked actions"
          value={blockedActions}
          setValue={setBlockedActions}
        />
        <TextInput label="Notes" value={notes} setValue={setNotes} />
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Session status
          </span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-2 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
          >
            {[
              "not_configured",
              "manual_login_required",
              "active",
              "expired",
              "blocked",
              "do_not_automate",
            ].map((option) => (
              <option key={option} value={option}>
                {option.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <ExecutionActionButton
          label="Save system policy"
          icon={Plus}
          disabled={!systemName.trim()}
          action={{
            action: "upsert_session_registry",
            systemName,
            loginUrl,
            purpose,
            accountOwner,
            allowedActions,
            blockedActions,
            notes,
            activeSessionStatus: status,
          }}
        />
      </div>
    </div>
  );
}

function ExecutionActionButton({
  action,
  disabled = false,
  icon: Icon = RotateCcw,
  label,
  variant = "primary",
}: {
  action: Record<string, unknown>;
  disabled?: boolean;
  icon?: LucideIcon;
  label: string;
  variant?: "primary" | "secondary" | "success";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/agent-execution/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(String(body.error ?? "Action failed"));
        return;
      }
      setMessage("Saved");
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  const styles = {
    primary: "border-sky-300/30 bg-sky-400/15 text-sky-100 hover:bg-sky-300/25",
    secondary:
      "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/10",
    success:
      "border-emerald-300/30 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-300/25",
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={disabled || isSubmitting || isPending}
        onClick={run}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50",
          styles[variant],
        )}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            (isSubmitting || isPending) && "animate-spin",
          )}
        />
        {isSubmitting || isPending ? "Saving" : label}
      </button>
      {message ? (
        <span className="text-[10px] text-slate-500">{message}</span>
      ) : null}
    </div>
  );
}

function Panel({
  children,
  icon: Icon,
  title,
}: {
  children: JSX.Element | JSX.Element[];
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#0b1424] p-4 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-md bg-sky-300/10 p-2 text-sky-100">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-base font-black text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Metric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "sky" | "emerald" | "amber" | "rose" | "slate";
  value: number;
}) {
  const colors = {
    sky: "border-sky-300/20 bg-sky-300/10 text-sky-100",
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    rose: "border-rose-300/20 bg-rose-300/10 text-rose-100",
    slate: "border-white/10 bg-white/[0.04] text-slate-100",
  };
  return (
    <div className={cn("rounded-lg border p-3", colors[tone])}>
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] opacity-75">
        {label}
      </p>
    </div>
  );
}

function InfoCard({ detail, label }: { detail: string; label: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <p className="text-sm font-black text-white">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

function SmallList({
  items,
  label,
  tone,
}: {
  items: string[];
  label: string;
  tone: "emerald" | "rose";
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        tone === "emerald"
          ? "border-emerald-300/15 bg-emerald-300/10"
          : "border-rose-300/15 bg-rose-300/10",
      )}
    >
      <p
        className={cn(
          "text-xs font-black uppercase tracking-[0.14em]",
          tone === "emerald" ? "text-emerald-100" : "text-rose-100",
        )}
      >
        {label}
      </p>
      <ul className="mt-2 space-y-1">
        {items.slice(0, 5).map((item) => (
          <li key={item} className="text-xs leading-5 text-slate-300">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TextInput({
  label,
  placeholder,
  setValue,
  value,
}: {
  label: string;
  placeholder?: string;
  setValue: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600"
      />
    </label>
  );
}

function StatusPill({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const color =
    lower.includes("approved") ||
    lower.includes("ready") ||
    lower.includes("complete") ||
    lower.includes("active")
      ? "bg-emerald-400/15 text-emerald-100"
      : lower.includes("failed") ||
          lower.includes("blocked") ||
          lower.includes("manual") ||
          lower.includes("sensitive")
        ? "bg-rose-400/15 text-rose-100"
        : lower.includes("pending") ||
            lower.includes("approval") ||
            lower.includes("paused")
          ? "bg-amber-400/15 text-amber-100"
          : "bg-slate-400/15 text-slate-200";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 text-[11px] font-black uppercase",
        color,
      )}
    >
      {status}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-5 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function scopeDetail(scope: AgentPermissionScope) {
  if (scope === "read_only")
    return "May inspect approved screen content and produce notes. This is the default for every task.";
  if (scope === "draft_only")
    return "May prepare text, forms, or response drafts but cannot submit or send them.";
  if (scope === "prepare_only")
    return "May organize the browser workflow and prepare fields for human review.";
  if (scope === "send_after_approval")
    return "Sensitive outbound scope. Requires explicit human approval before any send action.";
  if (scope === "purchase_after_approval")
    return "Sensitive spend scope. Requires explicit human approval before any purchase or order.";
  return "Sensitive submission scope. Requires explicit human approval before bid, contract, certification, or form submission.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
