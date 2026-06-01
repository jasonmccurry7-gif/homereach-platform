import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleAlert, ExternalLink, Facebook, Instagram, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { roleOf } from "@/lib/auth/api-guards";
import { loadMetaPublishingConfigStatus } from "@/lib/social-content/meta/config";
import { listMetaConnectionsForUser } from "@/lib/social-content/meta/repository";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";

export default async function SocialPublishingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [connectionData, config] = await Promise.all([
    listMetaConnectionsForUser({ userId: user.id, role: roleOf(user) }),
    Promise.resolve(loadMetaPublishingConfigStatus()),
  ]);
  const connectionCount = connectionData.connections.length;
  const connected = firstParam(params.connected);
  const reason = firstParam(params.reason);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 border-b border-slate-200 bg-slate-950 p-6 text-white lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">
              Managed social content
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Social Publishing
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
              Connect a business Facebook Page and Instagram account so approved HomeReach content can publish on schedule. No passwords, no browser-cookie workarounds, and no unapproved posts.
            </p>
          </div>
          <Link
            href="/api/social-content/meta/oauth/start?returnTo=/dashboard/social-publishing"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-slate-950 shadow-sm transition hover:bg-blue-50"
          >
            Connect Meta Account
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {connected && (
          <div className={connected === "1" ? "border-b border-emerald-100 bg-emerald-50 p-4" : "border-b border-amber-100 bg-amber-50 p-4"}>
            <p className={connected === "1" ? "text-sm font-bold text-emerald-800" : "text-sm font-bold text-amber-800"}>
              {connected === "1"
                ? "Meta connection saved. HomeReach can now prepare approved publishing packets for the connected Page."
                : `Meta connection was not completed${reason ? `: ${reason}` : "."}`}
            </p>
          </div>
        )}

        <div className="grid gap-4 p-6 md:grid-cols-4">
          <StatusTile label="Connected accounts" value={String(connectionCount)} tone={connectionCount > 0 ? "good" : "neutral"} />
          <StatusTile label="OAuth setup" value={config.appConfigured ? "Ready" : "Needs setup"} tone={config.appConfigured ? "good" : "warn"} />
          <StatusTile label="Token storage" value={config.encryptionConfigured ? "Encrypted" : "Missing key"} tone={config.encryptionConfigured ? "good" : "warn"} />
          <StatusTile label="Publishing mode" value={config.publishingMode} tone={config.publishingMode === "live" ? "good" : "warn"} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Authorized destinations
              </p>
              <h2 className="mt-2 text-xl font-black text-slate-950">Connected Pages</h2>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              Approval required
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {connectionData.warning && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                {connectionData.warning}
              </div>
            )}

            {connectionData.connections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
                <p className="text-sm font-bold text-slate-900">No Meta accounts connected yet.</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  The business owner should connect with Facebook Login and choose the Page HomeReach is allowed to manage.
                </p>
              </div>
            ) : (
              connectionData.connections.map((connection) => (
                <div key={connection.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{connection.pageName ?? "Facebook Page"}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Connected {formatDate(connection.updatedAt)}
                      </p>
                    </div>
                    <span className={connection.status === "connected" ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700"}>
                      {connection.status}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Facebook className="h-4 w-4 text-blue-600" aria-hidden="true" />
                      <span>Facebook Page ID: {connection.pageId ?? "not available"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Instagram className="h-4 w-4 text-pink-600" aria-hidden="true" />
                      <span>{connection.instagramUsername ? `@${connection.instagramUsername}` : "Instagram not connected"}</span>
                    </div>
                  </div>
                  {connection.lastError && (
                    <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">
                      {connection.lastError}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Safety controls
          </p>
          <h2 className="mt-2 text-xl font-black text-slate-950">Before anything posts</h2>
          <div className="mt-5 space-y-3">
            <ChecklistItem ok={config.connectedPublishingEnabled} label="Connected publishing feature flag is enabled." />
            <ChecklistItem ok={config.autoPublishingEnabled} label="Auto-publishing feature flag is enabled." />
            <ChecklistItem ok={config.appConfigured} label="Meta app ID, secret, and redirect URI are configured." />
            <ChecklistItem ok={config.encryptionConfigured} label="OAuth tokens are encrypted before storage." />
            <ChecklistItem ok={config.publishingMode === "live"} label="SOCIAL_PUBLISHING_MODE is live." />
            <ChecklistItem ok={connectionCount > 0} label="At least one business Page is connected." />
          </div>

          {config.warnings.length > 0 && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-black text-amber-900">Setup still needed</p>
              <ul className="mt-2 space-y-2 text-sm font-semibold text-amber-800">
                {config.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
              <p className="text-sm leading-6 text-blue-900">
                HomeReach stores authorization only after OAuth. The business can revoke access in Meta at any time, and HomeReach blocks publishing unless the content has already been approved.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-700";
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-start gap-3">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
      ) : (
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
      )}
      <span className="text-sm font-semibold leading-6 text-slate-700">{label}</span>
    </div>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null) {
  if (!value) return "recently";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
