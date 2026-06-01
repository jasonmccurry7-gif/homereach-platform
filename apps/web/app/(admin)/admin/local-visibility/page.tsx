import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ExternalLink,
  Globe2,
  MessageSquareText,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { getLocalVisibilitySnapshot } from "@/lib/local-visibility/sample-data";
import { loadGoogleBusinessProfileIntegrationStatus } from "@/lib/google-business-profile/repository";
import { GoogleBusinessProfileSyncButton } from "@/components/local-visibility/google-business-profile-actions";
import { DataModeBanner } from "@/components/admin/data-mode-banner";

type ScanRow = {
  id: string;
  created_at: string;
  business_name: string;
  city: string;
  state: string;
  category: string;
  overall_visibility_score: number;
  trust_score: number;
  listings_score: number;
  review_momentum_score: number;
  status: string;
};

async function loadRecentScans(): Promise<{ rows: ScanRow[]; warning: string | null }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], warning: "Supabase service credentials are not configured." };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("local_visibility_scans")
    .select("id,created_at,business_name,city,state,category,overall_visibility_score,trust_score,listings_score,review_momentum_score,status")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    return { rows: [], warning: "Local Visibility migration is not applied yet, so scan records are not visible." };
  }

  return { rows: (data ?? []) as ScanRow[], warning: null };
}

type AdminLocalVisibilitySearchParams = {
  gbp?: string;
  stored?: string;
  reason?: string;
};

export default async function AdminLocalVisibilityPage({
  searchParams,
}: {
  searchParams?: Promise<AdminLocalVisibilitySearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const snapshot = getLocalVisibilitySnapshot();
  const { rows, warning } = await loadRecentScans();
  const gbpStatus = await loadGoogleBusinessProfileIntegrationStatus();
  const gbpConnected = resolvedSearchParams.gbp === "1";
  const gbpFailed = resolvedSearchParams.gbp === "0";
  const usingDemoScans = rows.length === 0;

  return (
    <main className="min-h-screen bg-[#07111f] px-4 py-6 text-white lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-slate-950/20 lg:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">HomeReach Local</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Local SEO and Reputation Command Center
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Manage visibility scans, review workflows, listings health, Google profile optimization, local SEO
                recommendations, and AI-agent outputs without exposing internal controls publicly.
              </p>
            </div>
            <Link
              href="/local-visibility"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Public Offer Page
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-slate-950/20">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">Google Business Profile</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">Profile data, reviews, and local visibility signals.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                Connect a manager/owner Google account to import accounts, locations, and reviews for the Local Visibility
                dashboard. Public replies, Google posts, photos, and listing changes remain approval-only.
              </p>
              {gbpConnected && (
                <p className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm font-bold text-emerald-100">
                  Google Business Profile OAuth returned successfully. Token storage depends on the migration and
                  GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY.
                </p>
              )}
              {gbpFailed && (
                <p className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm font-bold text-rose-100">
                  Google Business Profile OAuth did not complete. Reason: {resolvedSearchParams.reason ?? "unknown"}.
                </p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[28rem]">
              <Link
                href="/api/admin/google-business-profile/oauth/start"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-500"
              >
                Connect Google
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
              <GoogleBusinessProfileSyncButton disabled={!gbpStatus.connected} />
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MiniMetric label="Mode" value={gbpStatus.mode.replaceAll("_", " ")} />
            <MiniMetric label="Connections" value={String(gbpStatus.connectionCount)} />
            <MiniMetric label="Locations" value={String(gbpStatus.locationCount)} />
            <MiniMetric label="Reviews imported" value={String(gbpStatus.reviewCount)} />
            <MiniMetric label="Publishing" value={gbpStatus.publishingEnabled ? "Approval gated" : "Disabled"} />
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Next setup actions</p>
            <div className="mt-3 grid gap-2">
              {gbpStatus.nextActions.map((action) => (
                <p key={action} className="text-sm font-semibold leading-6 text-slate-200">
                  {action}
                </p>
              ))}
            </div>
          </div>
        </section>

        {warning && (
          <div className="mt-5 flex gap-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-amber-50">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-semibold leading-6">{warning}</p>
          </div>
        )}

        <div className="mt-5">
          <DataModeBanner
            mode={usingDemoScans ? "demo" : warning ? "partial" : "live"}
            title={usingDemoScans ? "Local Visibility is showing demo scan rows." : "Local Visibility scan data is live."}
            detail={
              usingDemoScans
                ? "No persisted scan leads are available yet, so the scan pipeline is using clearly labeled demo examples. Do not treat these as live customer records."
                : "Recent scan leads are loading from local_visibility_scans. Google Business Profile publishing and replies remain approval-gated."
            }
            items={[
              `${rows.length} live scan row${rows.length === 1 ? "" : "s"}`,
              `Google mode: ${gbpStatus.mode.replaceAll("_", " ")}`,
              gbpStatus.publishingEnabled ? "Publishing approval gate enabled" : "Publishing disabled",
            ]}
          />
        </div>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Live Visibility Scans" value={String(rows.length)} detail={usingDemoScans ? "Demo rows shown below" : "Recent scan leads captured"} icon={Search} />
          <Metric label="Review Requests" value={String(snapshot.metrics.reviewRequestsSent)} detail="Approval-first request opportunities" icon={MessageSquareText} />
          <Metric label="Listing Issues" value={String(snapshot.metrics.listingIssues)} detail="Example issues queued for review" icon={Globe2} />
          <Metric label="Unanswered Reviews" value={String(snapshot.metrics.unansweredReviews)} detail="Need approved response drafts" icon={Star} />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Recent scan leads</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Visibility scan pipeline</h2>
              </div>
              <ShieldCheck className="h-6 w-6 text-emerald-300" />
            </div>
            <div className="mt-4 grid gap-3">
              {(rows.length > 0 ? rows : fallbackRows()).map((row) => (
                <div key={row.id} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-white">{row.business_name}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {row.category} in {row.city}, {row.state}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-400/10 px-2.5 py-1 text-xs font-black text-blue-100 ring-1 ring-blue-300/20">
                      Score {row.overall_visibility_score}
                    </span>
                    {row.status === "demo" ? (
                      <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-xs font-black uppercase text-amber-100 ring-1 ring-amber-300/20">
                        Demo fallback
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <MiniScore label="Trust" value={row.trust_score} />
                    <MiniScore label="Listings" value={row.listings_score} />
                    <MiniScore label="Reviews" value={row.review_momentum_score} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">AI agents</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Human-approved operating model</h2>
            <div className="mt-4 grid gap-3">
              {snapshot.agents.map((agent) => (
                <div key={agent.name} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex gap-3">
                    <Bot className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                    <div>
                      <p className="font-black text-white">{agent.name}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{agent.role}</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-200">
                        Approval required for public actions
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          {snapshot.packages.map((pkg) => (
            <div key={pkg.name} className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
              <p className="text-lg font-black">{pkg.name}</p>
              <p className="mt-2 text-3xl font-black text-emerald-200">{pkg.price}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">{pkg.bestFor}</p>
              <div className="mt-4 grid gap-2">
                {pkg.includes.map((item) => (
                  <div key={item} className="flex gap-2 text-sm font-semibold leading-6 text-slate-200">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Search }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <Icon className="h-5 w-5 text-emerald-300" />
      </div>
      <p className="mt-4 text-4xl font-black">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
    </div>
  );
}

function MiniScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/[0.05] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function fallbackRows(): ScanRow[] {
  return [
    {
      id: "demo-visibility-scan",
      created_at: new Date().toISOString(),
      business_name: "Demo scan appears here after migration",
      city: "Akron",
      state: "OH",
      category: "Home services",
      overall_visibility_score: 72,
      trust_score: 76,
      listings_score: 70,
      review_momentum_score: 62,
      status: "demo",
    },
  ];
}
