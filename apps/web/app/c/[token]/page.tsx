// ─────────────────────────────────────────────────────────────────────────────
// Public contract sign page — /c/[token]
//
// No Supabase Auth. The 32-byte public_token IS the authentication.
//
// Flag-gated: returns 404 when ENABLE_POLITICAL is unset.
//
// Two states:
//   • pending  → show terms verbatim + sign form (name, email, consent)
//   • signed   → show terms verbatim + signature block (audit evidence)
//
// Compliance:
//   • terms_text is rendered verbatim from the DB. It already contains the
//     non-political clause. Never modified at render time.
//   • Evidence captured: signer_name, signer_email, signer_ip (from headers),
//     signed_at (timestamptz). All persisted on the contract row.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { notFound } from "next/navigation";
import { isPoliticalEnabled } from "@/lib/political/env";
import { loadPublicContract, markContractViewed } from "@/lib/political/contracts";
import { signContractAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

export default async function ContractSignPage({ params, searchParams }: PageProps) {
  if (!isPoliticalEnabled()) notFound();

  const { token } = await params;
  const sp = await searchParams;
  const signedFlag = first(sp["signed"]) === "1";
  const errorParam = first(sp["error"]) ?? null;

  // Best-effort view tracking
  try {
    await markContractViewed(token);
  } catch {
    // Non-fatal; continue rendering
  }

  const ctx = await loadPublicContract(token);
  if (!ctx) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 py-16 text-center">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">HomeReach</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">This contract link is no longer available.</h1>
          <p className="mt-1 text-sm text-slate-600">
            The contract may have been canceled or expired. Contact HomeReach for an updated agreement.
          </p>
        </div>
      </div>
    );
  }

  const { contract } = ctx;
  const isSigned = contract.status === "signed";

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-slate-50 px-4 py-8">
      {/* Post-sign notice */}
      {signedFlag && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Signed. You&apos;ll receive a copy of this agreement by email.
        </div>
      )}
      {errorParam && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          There was a problem: <code className="rounded bg-rose-100 px-1">{errorParam}</code>
        </div>
      )}

      {/* Header */}
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wider text-slate-500">HomeReach · Services Agreement</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {ctx.candidateName}
        </h1>
        {ctx.candidateOffice && (
          <p className="mt-0.5 text-sm text-slate-600">{ctx.candidateOffice}</p>
        )}
        <p className="mt-2 text-sm text-slate-700">{ctx.campaignName}</p>
        <p className="mt-0.5 text-xs text-slate-500">{ctx.geographyLabel}</p>
        <p className="mt-3 text-xs text-slate-500">
          Status:{" "}
          <span className={isSigned ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
            {isSigned ? "Signed" : "Awaiting signature"}
          </span>
        </p>
      </header>

      {/* Terms */}
      <section
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        aria-label="Agreement terms"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agreement</h2>
        <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800">
          {contract.termsText}
        </pre>
      </section>

      {/* Sign OR signature block */}
      {isSigned ? (
        <section className="rounded-lg border border-emerald-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Signature</h2>
          <dl className="mt-3 grid grid-cols-1 gap-y-2 text-sm md:grid-cols-2 md:gap-x-6">
            <Field label="Signed by"  value={contract.signerName} />
            <Field label="Email"      value={contract.signerEmail} />
            <Field label="Timestamp"  value={formatDateTime(contract.signedAt)} />
            <Field label="IP address" value={contract.signerIp ?? "not recorded"} />
          </dl>
          <p className="mt-3 text-[11px] text-slate-400">
            This signature was captured electronically under the E-SIGN Act and UETA.
            The information above is the audit record of acceptance.
          </p>
          {ctx.proposalToken && (
            <div className="mt-4 border-t border-slate-200 pt-4 text-sm">
              <Link
                href={`/p/${ctx.proposalToken}`}
                className="text-blue-700 hover:underline"
              >
                ← Back to proposal
              </Link>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sign the agreement</h2>
          <p className="mt-1 text-xs text-slate-500">
            Typing your full name and submitting this form is your electronic signature.
          </p>
          <form action={signContractAction} className="mt-4 space-y-3">
            <input type="hidden" name="token" value={token} />

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Full legal name</span>
              <input
                type="text"
                name="signer_name"
                required
                minLength={2}
                maxLength={200}
                autoComplete="name"
                placeholder="e.g. Maria Ortiz"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Email address</span>
              <input
                type="email"
                name="signer_email"
                required
                autoComplete="email"
                placeholder="maria@ortizforcouncil.com"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-1"
              />
              <span>
                I agree that typing my full name above and clicking {`"Sign agreement"`} is
                my electronic signature with the same legal effect as a handwritten
                signature, and I&apos;ve reviewed the terms above.
              </span>
            </label>

            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Sign agreement
            </button>

            {ctx.proposalToken && (
              <p className="text-center text-xs text-slate-500">
                Need to review the plan?{" "}
                <Link href={`/p/${ctx.proposalToken}`} className="text-blue-700 hover:underline">
                  Open proposal
                </Link>
              </p>
            )}
          </form>
        </section>
      )}

      <footer className="pt-4 text-center text-xs text-slate-400">
        HomeReach · {new Date().getFullYear()} · home-reach.com
      </footer>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{value ?? "—"}</dd>
    </div>
  );
}
