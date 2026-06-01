import { ApprovalActionButtons } from "@/components/operations-copilot/approval-action-buttons";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import {
  formatCopilotMoney,
  listOperationsCopilotApprovals,
} from "@/lib/operations-copilot/intelligence";

export const dynamic = "force-dynamic";

export default async function OperationsCopilotApprovalsPage() {
  const user = await getOperationsCopilotSessionUser();
  if (!user) return null;

  const approvals = await listOperationsCopilotApprovals(user.id);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Decision Governance
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white">Owner decision queue</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-300">
          Every Supplify recommendation is auditable. Low-risk automation can prepare
          work, but purchases, vendor changes, and financial actions remain governed
          by approval rules.
        </p>
      </section>

      <section className="grid gap-4">
        {approvals.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6 text-neutral-300">
            No decision requests yet. Use quick actions in the command center or load demo data.
          </div>
        ) : (
          approvals.map((request) => {
            const payload = request.requestPayload ?? {};
            const estimatedSpend =
              typeof payload.estimatedSpendCents === "number"
                ? payload.estimatedSpendCents
                : request.estimatedSpendCents;
            const estimatedSavings =
              typeof payload.estimatedSavingsCents === "number"
                ? payload.estimatedSavingsCents
                : request.estimatedSavingsCents;

            return (
              <article
                key={request.id}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                        {request.status.replaceAll("_", " ")}
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-neutral-300">
                        Level {request.autonomyLevel} autonomy
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-neutral-300">
                        Risk {request.riskScore}/100
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-bold text-white">{request.title}</h2>
                    <p className="mt-2 text-sm text-neutral-300">
                      {request.actionType.replaceAll("_", " ")} - confidence{" "}
                      {request.confidence}
                    </p>
                  </div>
                  {request.status === "pending_approval" ? (
                    <ApprovalActionButtons requestId={request.id} />
                  ) : null}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Estimated spend" value={formatCopilotMoney(estimatedSpend)} />
                  <Metric
                    label="Estimated savings"
                    value={formatCopilotMoney(estimatedSavings)}
                  />
                  <Metric
                    label="Data basis"
                    value={readPayloadLabel(payload, "sourceQualityLabel", "Estimated")}
                  />
                  <Metric
                    label="Last updated"
                    value={formatDateTimeLabel(request.updatedAt ?? request.createdAt)}
                  />
                </div>

                <div className="mt-5 rounded-lg border border-white/10 bg-neutral-950/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Audit trail
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-neutral-300">
                    {(request.auditLog ?? []).length > 0 ? (
                      (request.auditLog ?? []).map((entry, index) => (
                        <p key={`${request.id}-${index}`}>
                          {String(entry.at ?? "unknown time")} -{" "}
                          {String(entry.actor ?? "system")} -{" "}
                          {String(entry.event ?? "event")}
                        </p>
                      ))
                    ) : (
                      <p>No audit entries yet.</p>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-950/70 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function readPayloadLabel(
  payload: Record<string, unknown>,
  key: string,
  fallback: string
) {
  const value = payload[key];
  return typeof value === "string" && value ? value : fallback;
}

function formatDateTimeLabel(value: Date | string | null | undefined) {
  if (!value) return "Not updated";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not updated";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
