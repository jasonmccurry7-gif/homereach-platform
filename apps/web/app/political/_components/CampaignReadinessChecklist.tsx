import { AlertTriangle, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import type {
  CandidateLaunchReadiness,
  CandidateReadinessGate,
} from "@/lib/political/candidate-readiness";

interface CampaignReadinessChecklistProps {
  title?: string;
  candidateName: string;
  readiness: CandidateLaunchReadiness;
  compact?: boolean;
}

const STATUS_STYLE: Record<CandidateReadinessGate["status"], string> = {
  complete: "border-emerald-300/20 bg-emerald-950/35 text-emerald-50",
  review: "border-amber-300/20 bg-amber-950/35 text-amber-50",
  blocked: "border-red-300/20 bg-red-950/35 text-red-50",
};

function StatusIcon({ status }: { status: CandidateReadinessGate["status"] }) {
  if (status === "complete") return <CheckCircle2 className="h-4 w-4 text-emerald-200" />;
  if (status === "review") return <AlertTriangle className="h-4 w-4 text-amber-200" />;
  return <Lock className="h-4 w-4 text-red-200" />;
}

export function CampaignReadinessChecklist({
  title = "Campaign Readiness Checklist",
  candidateName,
  readiness,
  compact = false,
}: CampaignReadinessChecklistProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-slate-950/20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-200" />
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              {title}
            </p>
          </div>
          <h2 className="mt-2 text-xl font-black text-white">{candidateName}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            This gate turns a prebuilt research profile into a verified launch package. Proposal
            drafts can be prepared for internal review, but checkout stays locked until USPS counts,
            quote math, and human approval are complete.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 lg:text-right">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Readiness
          </div>
          <div className="mt-1 text-2xl font-black text-white">{readiness.score}%</div>
          <div className="text-xs font-semibold text-slate-300">{readiness.statusLabel}</div>
        </div>
      </div>

      <div className={compact ? "mt-5 grid gap-3" : "mt-5 grid gap-3 lg:grid-cols-2"}>
        {readiness.gates.map((gate) => (
          <article key={gate.key} className={`rounded-lg border p-4 ${STATUS_STYLE[gate.status]}`}>
            <div className="flex items-start gap-3">
              <StatusIcon status={gate.status} />
              <div className="min-w-0">
                <div className="text-sm font-black text-white">{gate.label}</div>
                <p className="mt-1 text-xs leading-5 opacity-85">{gate.detail}</p>
                <p className="mt-2 text-xs font-bold opacity-95">Next: {gate.action}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-blue-300/15 bg-blue-950/25 p-4 text-sm leading-6 text-blue-50">
        <span className="font-black">Current next action:</span> {readiness.nextRequiredAction}
      </div>
    </section>
  );
}
