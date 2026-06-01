import type { LucideIcon } from "lucide-react";
import { AlertTriangle, BadgeCheck, ClipboardList, Gauge, HeartPulse, MapPinned, RadioTower, ShieldCheck, UploadCloud } from "lucide-react";
import { AdTechActions } from "@/components/ad-tech/ad-tech-actions";
import { AdTechSyncButton } from "@/components/ad-tech/ad-tech-sync-button";
import { ReportingImportForm } from "@/components/ad-tech/reporting-import-form";
import { hasAdTechPersistence } from "@/lib/ad-tech/config";
import { loadAdminAdTechCenter } from "@/lib/ad-tech/engine";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ad-Tech Integration Layer - HomeReach Admin",
};

export default async function AdminAdTechPage() {
  if (!hasAdTechPersistence()) {
    return <SafeMode title="Ad-Tech safe mode" body="Database persistence is not configured, so draft and launch-package workflows are offline." />;
  }

  const data = await loadAdminAdTechCenter({
    supabase: createServiceClient(),
  });
  const topPackages = data.launchPackages.slice(0, 10);
  const draftQueue = data.drafts.slice(0, 12);
  const campaignOptions = data.campaigns
    .map((campaign) => ({ id: String(campaign.id), name: String(campaign.campaign_name ?? campaign.business_name ?? "Campaign") }))
    .filter((campaign) => campaign.id);

  return (
    <main className="space-y-6 pb-20">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ad-Tech Integration Layer</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Integration Health</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              Prepare Meta and Google drafts, validate target areas, assemble launch packages, capture approvals, and import reporting. This center does not launch paid ads or spend money.
            </p>
          </div>
          <AdTechSyncButton />
        </div>
      </section>

      {data.safeMode ? <SafeMode title="Ad-Tech safe mode" body={data.message ?? "Integration workflows are unavailable."} /> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Metric icon={ClipboardList} label="Drafts" value={String(data.metrics.draftCount)} detail="Meta, Google, tracking, budget" />
        <Metric icon={ShieldCheck} label="Approvals Needed" value={String(data.metrics.approvalsNeeded)} detail="Client/admin review" />
        <Metric icon={BadgeCheck} label="Launch Ready" value={String(data.metrics.launchReady)} detail="Still manual approval only" />
        <Metric icon={UploadCloud} label="Imports Needed" value={String(data.metrics.reportingImportsNeeded)} detail="Manual/API-ready reporting" />
        <Metric icon={Gauge} label="Avg Readiness" value={`${data.metrics.averageReadiness}%`} detail="Across launch packages" />
        <Metric icon={RadioTower} label="Manual Launches" value={String(data.metrics.manualLaunches)} detail="Human-recorded only" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 className="text-xl font-black text-slate-950">Integration Health</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.integrationHealth.map((item) => (
              <div key={item.id ?? item.integration_key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-950">{item.integration_name}</p>
                  <Badge>{item.status}</Badge>
                </div>
                <p className="mt-2 text-xs font-bold text-slate-500">API key: {item.api_key_status}</p>
                <ul className="mt-3 space-y-1 text-xs font-semibold leading-5 text-slate-600">
                  {(item.warnings ?? []).slice(0, 2).map((warning) => <li key={warning}>{warning}</li>)}
                  {(item.errors ?? []).slice(0, 2).map((error) => <li key={error} className="text-rose-600">{error}</li>)}
                </ul>
              </div>
            ))}
            {data.integrationHealth.length === 0 ? <p className="text-sm text-slate-500">Sync integration health to populate statuses.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <MapPinned className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 className="text-xl font-black text-slate-950">Target Validation</h2>
          </div>
          <div className="mt-4 space-y-3">
            {data.validations.slice(0, 8).map((validation) => (
              <div key={validation.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-950">{String(validation.target_label ?? "Target area")}</p>
                  <Badge>{String(validation.status ?? "warning")}</Badge>
                </div>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{String(validation.recommended_action ?? "Review target area.")}</p>
              </div>
            ))}
            {data.validations.length === 0 ? <p className="text-sm text-slate-500">Target validation will appear after sync.</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-xl font-black text-slate-950">Launch Packages</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">A Launch Package is the prepared checklist and draft set for manual/admin review. It is not an ad launch.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {topPackages.map((item) => (
              <article key={item.id} className="p-5">
                <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{item.package_status}</Badge>
                      <Badge>{item.ready_status}</Badge>
                      <Badge>{`${item.readiness_score}%`}</Badge>
                    </div>
                    <h3 className="mt-3 text-lg font-black text-slate-950">{item.package_name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.campaign_summary}</p>
                    <p className="mt-3 text-sm font-black text-slate-900">Next: {item.recommended_next_action ?? "Review package."}</p>
                    {item.missing_items?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.missing_items.slice(0, 5).map((missing) => <Badge key={missing}>{missing}</Badge>)}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Approval Controls</p>
                    <div className="mt-3">
                      <AdTechActions launchPackageId={String(item.id)} admin />
                    </div>
                  </div>
                </div>
              </article>
            ))}
            {topPackages.length === 0 ? <p className="p-6 text-sm text-slate-500">No launch packages yet. Sync the draft layer.</p> : null}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Campaign Draft Queue</h2>
            <div className="mt-4 space-y-3">
              {draftQueue.map((draft) => (
                <div key={draft.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-950">{draft.name}</p>
                    <Badge>{draft.platform}</Badge>
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{draft.summary ?? "Draft requires review."}</p>
                </div>
              ))}
              {draftQueue.length === 0 ? <p className="text-sm text-slate-500">No drafts yet.</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Manual Reporting Import</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Enter platform metrics without claiming attribution certainty.</p>
            <div className="mt-4">
              <ReportingImportForm campaigns={campaignOptions} />
            </div>
          </section>

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950 shadow-sm">
            <h2 className="text-lg font-black">Safety Rules</h2>
            <p className="mt-2 text-sm font-semibold leading-6">
              No auto-launch, no auto-spend, no creative publishing, no platform submission, and no attribution certainty unless source data proves it.
            </p>
          </section>
        </aside>
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
