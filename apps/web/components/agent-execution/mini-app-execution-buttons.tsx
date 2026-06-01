"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, MonitorCheck, Send, UserCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MiniAppExecutionButtonsProps = {
  miniAppId: string;
  miniAppTitle: string;
  sourceAgent: string;
  taskType: string;
  targetSystem: string;
  targetUrl?: string | null;
  notes?: string;
};

const BUTTONS: Array<{
  label: string;
  mode: string;
  icon: LucideIcon;
  variant: "primary" | "secondary" | "success";
}> = [
  { label: "Approve for Browser Agent", mode: "approve_browser_agent", icon: MonitorCheck, variant: "primary" },
  { label: "Approve Draft Only", mode: "approve_draft_only", icon: FileText, variant: "secondary" },
  { label: "Send to Execution Queue", mode: "send_to_execution_queue", icon: Send, variant: "primary" },
  { label: "Require Manual Takeover", mode: "require_manual_takeover", icon: UserCheck, variant: "secondary" },
  { label: "Mark Executed Manually", mode: "mark_executed_manually", icon: CheckCircle2, variant: "success" },
];

export function MiniAppExecutionButtons({
  miniAppId,
  miniAppTitle,
  notes,
  sourceAgent,
  targetSystem,
  targetUrl,
  taskType,
}: MiniAppExecutionButtonsProps) {
  return (
    <div className="mt-3 rounded-lg border border-cyan-300/15 bg-cyan-300/10 p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100">
        Future browser/computer-use readiness
      </p>
      <p className="mt-1 text-xs leading-5 text-cyan-50/80">
        These buttons only create approved, logged readiness records. They do not control the browser or perform external actions.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {BUTTONS.map((button) => (
          <MiniExecutionButton
            key={button.mode}
            button={button}
            payload={{
              action: "queue_from_mini_app",
              mode: button.mode,
              miniAppId,
              sourceAgent,
              taskType,
              targetSystem,
              targetUrl,
              notes:
                notes ??
                `${miniAppTitle} readiness task. Dry-run first; no sending, posting, submitting, purchasing, deleting, exporting, settings changes, or account mutation.`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MiniExecutionButton({
  button,
  payload,
}: {
  button: (typeof BUTTONS)[number];
  payload: Record<string, unknown>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const Icon = button.icon;

  async function run() {
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/agent-execution/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(String(body.error ?? "Action failed"));
        return;
      }
      setMessage("Queued");
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  const styles = {
    primary: "border-cyan-300/30 bg-cyan-400/15 text-cyan-50 hover:bg-cyan-300/25",
    secondary: "border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/10",
    success: "border-emerald-300/30 bg-emerald-400/15 text-emerald-50 hover:bg-emerald-300/25",
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={run}
        disabled={isSubmitting || isPending}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50",
          styles[button.variant],
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", (isSubmitting || isPending) && "animate-spin")} />
        {isSubmitting || isPending ? "Saving" : button.label}
      </button>
      {message ? <span className="text-[10px] text-cyan-100/70">{message}</span> : null}
    </div>
  );
}
