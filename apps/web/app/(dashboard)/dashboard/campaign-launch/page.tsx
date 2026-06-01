import type { LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, FileText, MapPinned, ShieldCheck, TrendingUp } from "lucide-react";
import { AdTechActions } from "@/components/ad-tech/ad-tech-actions";
import { loadClientAdTechCenter } from "@/lib/ad-tech/engine";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Campaign Launch Status - HomeReach",
};

export default async function ClientCampaignLaunchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const data = await loadClientAdTechCenter({
    supabase: createServiceClient(),
    user: { id: user.id, email: user.email },
  });
  const topPackage = data.launchPackages[0] ?? null;
  const topApprovals = data.approvals.slice(0, 6);
  const reports = data.reportingImports.slice(0, 3);

  return (
    <main className="max-w-6xl space-y-6 pb-24">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Campaign Launch Center</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-4xl">Campaign Launch Status</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              See what HomeReach is preparing, what needs approval, and what happens next. Campaigns do not go live until approved by a person.
            </p>
          </div>
          <ScoreBadge score={topPackage?.readiness_score ?? 0} ready={topPackage?.ready_status === "ready"} />
        </div>
      </section>

      {data.safeMode ? <SafeMode title="Campaign launch safe mode" body={data.message ?? "Launch status is unavailable."} /> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={FileText} label="Launch Packages" value={String(data.launchPackages.length)} detail="Prepared for review" />
        <Metric icon={ShieldCheck} label="Approvals" value={String(topApprovals.length)} detail="Campaign, creative, budget, tracking" />
        <Metric icon={MapPinned} label="Target Checks" value={String(data.validations.length)} detail="Address/geography review" />
        <Metric icon={TrendingUp} label="Reports" value={String(data.reportingImports.length)} detail="Manual/API-ready metrics" />
      </section>

      {topPackage ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{topPackage.package_status}</Badge>
              <Badge>{topPackage.ready_status}</Badge>
              <Badge>{`${topPackage.readiness_score}% ready`}</Badge>
            </div>
            <h2 className="mt-3 text-xl font-black text-slate-950">{topPackage.package_name}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{topPackage.campaign_summary}</p>
          </div>
          <div className="grid gap-4 p-5 lg:grid-cols-[1fr_20rem]">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">Next Steps</h3>
              <div className="mt-3 grid gap-2">
                {(topPackage.missing_items?.length ? topPackage.missing_items : ["HomeReach will review the package and confirm launch timing."]).map((item) => (
                  <div key={item} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <Clock3 className="mt-0.5 h-4 w-4 text-blue-700" aria-hidden="true" />
                    <p className="text-sm font-semibold leading-5 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-black text-slate-950">Approval</h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                Approve, request changes, or ask a question. This will not launch paid ads.
              </p>
              <div className="mt-3">
                <AdTechActions launchPackageId={String(topPackage.id)} approvalId={String(topApprovals[0]?.id ?? "") || null} />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">No launch package yet.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Your campaign launch package will appear after HomeReach prepares the targeting, creative, approvals, and reporting setup.</p>
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Approval Items</h2>
          <div className="mt-4 space-y-3">
            {topApprovals.map((approval) => (
              <div key={approval.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black capitalize text-slate-950">{String(approval.approval_type ?? "approval").replaceAll("_", " ")}</p>
                  <Badge>{String(approval.status ?? "awaiting_approval")}</Badge>
                </div>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{String(approval.notes ?? "HomeReach needs approval before launch.")}</p>
              </div>
            ))}
            {topApprovals.length === 0 ? <p className="text-sm text-slate-500">No approval items yet.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Performance Summary</h2>
          <div className="mt-4 space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-700" aria-hidden="true" />
                  <p className="text-sm font-black text-slate-950">{String(report.platform ?? "Manual report")}</p>
                </div>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  {Number(report.impressions ?? 0).toLocaleString()} impressions, {Number(report.clicks ?? 0).toLocaleString()} clicks, {Number(report.leads ?? 0).toLocaleString()} leads.
                </p>
              </div>
            ))}
            {reports.length === 0 ? <p className="text-sm text-slate-500">Reports will appear after campaign metrics are entered or imported.</p> : null}
          </div>
          <p className="mt-4 text-xs font-bold leading-5 text-slate-500">Performance reporting is informational. Results vary and attribution may be estimated when platform data is limited.</p>
        </div>
      </section>
    </main>
  );
}

function Metric({ detail, icon: Icon, label, value }: { detail: string; icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p>
    </div>
  );
}

function Badge({ children }: { children: string | number }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black capitalize text-slate-600">{String(children).replaceAll("_", " ")}</span>;
}

function ScoreBadge({ ready, score }: { ready: boolean; score: number }) {
  const styles = ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em]">Launch Readiness</p>
      <p className="mt-1 text-3xl font-black">{score}%</p>
    </div>
  );
}

function SafeMode({ body, title }: { body: string; title: string }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-black">{title}</h1>
          <p className="mt-1 text-sm font-semibold leading-6">{body}</p>
        </div>
      </div>
    </section>
  );
}
