"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, Bot, FileImage, FileText, Mail, MapPinned, Play, Search, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ActionKey =
  | "ingest"
  | "continuous_sweep"
  | "run_autopilot"
  | "overdrive_refresh"
  | "run_strategist"
  | "run_operator"
  | "generate_prospects"
  | "draft_outreach"
  | "draft_autopilot_outreach"
  | "build_campaign"
  | "create_storm_campaign"
  | "create_autopilot_campaign"
  | "generate_storm_image"
  | "approve_outreach"
  | "reject_outreach"
  | "approve_package"
  | "archive"
  | "dismiss";

type StormReachActionsProps = {
  eventId?: string;
  messageId?: string;
  packageId?: string;
  compact?: boolean;
};

const ACTIONS: Array<{
  key: ActionKey;
  label: string;
  icon: typeof Play;
  eventScoped: boolean;
  intent?: "danger";
}> = [
  { key: "ingest", label: "Ingest Weather", icon: Play, eventScoped: false },
  { key: "run_autopilot", label: "Run Autopilot", icon: Bot, eventScoped: false },
  { key: "overdrive_refresh", label: "Refresh Overdrive", icon: Bot, eventScoped: false },
  { key: "continuous_sweep", label: "Run 24h Sweep", icon: Search, eventScoped: false },
  { key: "run_operator", label: "Run Operator", icon: Bot, eventScoped: false },
  { key: "run_strategist", label: "Run Strategist", icon: Sparkles, eventScoped: false },
  { key: "generate_prospects", label: "Generate Prospects", icon: Search, eventScoped: true },
  { key: "draft_outreach", label: "Draft Outreach", icon: Mail, eventScoped: true },
  { key: "draft_autopilot_outreach", label: "Autopilot Drafts", icon: Mail, eventScoped: true },
  { key: "generate_storm_image", label: "Generate Image", icon: FileImage, eventScoped: true },
  { key: "build_campaign", label: "Build Campaign", icon: MapPinned, eventScoped: true },
  { key: "create_storm_campaign", label: "Create Storm Campaign", icon: MapPinned, eventScoped: true },
  { key: "create_autopilot_campaign", label: "Autopilot Campaign", icon: MapPinned, eventScoped: true },
  { key: "archive", label: "Archive", icon: Archive, eventScoped: true },
  { key: "dismiss", label: "Dismiss", icon: Trash2, eventScoped: true, intent: "danger" },
];

const MESSAGE_ACTIONS: Array<{ key: ActionKey; label: string; icon: typeof Play; eventScoped: boolean; intent?: "danger" }> = [
  { key: "approve_outreach", label: "Approve", icon: ShieldCheck, eventScoped: false },
  { key: "reject_outreach", label: "Reject", icon: Trash2, eventScoped: false, intent: "danger" },
];

const PACKAGE_ACTIONS: Array<{ key: ActionKey; label: string; icon: typeof Play; eventScoped: boolean; intent?: "danger" }> = [
  { key: "approve_package", label: "Approve Package", icon: ShieldCheck, eventScoped: false },
];

export function StormReachActions({ compact, eventId, messageId, packageId }: StormReachActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<ActionKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const visibleActions = messageId
    ? MESSAGE_ACTIONS
    : packageId
      ? PACKAGE_ACTIONS
      : ACTIONS.filter((action) => !action.eventScoped || eventId);

  async function run(action: ActionKey) {
    setPending(action);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/stormreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, eventId, messageId, packageId }),
      });
      const result = await response.json().catch(() => ({}));
      setMessage(result.error ? String(result.error) : summaryFor(action, result));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "StormReach action failed.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className={cn("flex flex-wrap gap-2", compact && "gap-1.5")}>
        {visibleActions.map((action) => {
          const Icon = action.icon;
          const isPending = pending === action.key;
          return (
            <button
              key={action.key}
              type="button"
              onClick={() => run(action.key)}
              disabled={Boolean(pending)}
              title={action.label}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-black transition disabled:cursor-wait disabled:opacity-60",
                action.intent === "danger"
                  ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                  : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
                compact && "min-h-9 px-2.5 text-xs",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {isPending ? "Working..." : action.label}
            </button>
          );
        })}
        {eventId ? (
          <a
            href={`/admin/stormreach/${eventId}`}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-black text-blue-900 transition hover:bg-blue-100",
              compact && "min-h-9 px-2.5 text-xs",
            )}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Review Event
          </a>
        ) : null}
      </div>
      {message ? <p className="text-xs font-semibold text-slate-600">{message}</p> : null}
    </div>
  );
}

function summaryFor(action: ActionKey, result: Record<string, unknown>) {
  if (action === "ingest") return `Ingest complete: ${String(result.eventsUpserted ?? 0)} events updated.`;
  if (action === "run_autopilot") return `Autopilot complete: ${String(result.eventsProcessed ?? 0)} events, ${String(result.prospectsInserted ?? 0)} prospects, ${String(result.draftsCreated ?? 0)} drafts, ${String(result.assetsCreated ?? 0)} assets.`;
  if (action === "overdrive_refresh") return `Overdrive complete: ${String(result.eventsProcessed ?? 0)} Ohio events, ${String(result.prospectsInserted ?? 0)} prospects, ${String(result.draftsCreated ?? 0)} drafts.`;
  if (action === "continuous_sweep") return `24h sweep complete: ${String(result.eventsProcessed ?? 0)} events, ${String(result.prospectsInserted ?? 0)} prospects, ${String(result.emailsDrafted ?? 0)} drafts.`;
  if (action === "run_operator") return `Operator complete: ${String(result.eventsProcessed ?? 0)} events, ${String(result.operatorOutputsCreated ?? 0)} handoffs, ${String(result.approvalItemsSynced ?? 0)} approvals.`;
  if (action === "run_strategist") return `Strategist complete: ${String(result.inserted ?? 0)} new recommendations.`;
  if (action === "generate_prospects") return `Prospects ready: ${String(result.inserted ?? 0)} inserted.`;
  if (action === "draft_outreach") return `Drafts ready: ${String(result.drafted ?? 0)} emails require approval.`;
  if (action === "draft_autopilot_outreach") return `Autopilot drafts ready: ${String(result.inserted ?? 0)} email/SMS/Messenger messages require approval.`;
  if (action === "generate_storm_image") return `Storm assets ready: ${String(result.inserted ?? 0)} generated.`;
  if (action === "build_campaign") return `Packages ready: ${String(result.packages ?? 0)} campaign packages created.`;
  if (action === "create_storm_campaign") return `Storm campaign ready: ${String(result.inserted ?? 0)} Overdrive packages created.`;
  if (action === "create_autopilot_campaign") return `Autopilot campaign ready: ${String(result.inserted ?? 0)} campaign records created.`;
  if (action === "approve_outreach") return "Draft approved. It was not sent.";
  if (action === "reject_outreach") return "Draft rejected.";
  if (action === "approve_package") return "Package approved for review. It was not launched or charged.";
  return "StormReach action complete.";
}
