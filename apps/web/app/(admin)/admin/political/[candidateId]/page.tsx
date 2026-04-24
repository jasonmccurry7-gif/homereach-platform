import Link from "next/link";
import { notFound } from "next/navigation";
import {
  loadCampaignsForCandidate,
  loadCandidate,
  loadContactsForCandidate,
  type CampaignRow,
  type ContactRow,
  type CandidateRow,
} from "@/lib/political/queries";
import { listProposalsForCandidate, type ProposalRow } from "@/lib/political/proposals";
import { listAllActiveScripts, type ScriptRow } from "@/lib/political/scripts";
import { createClient as createUserClient } from "@/lib/supabase/server";
import {
  StatusBadge,
  DistrictTypeBadge,
  GeographyLabel,
} from "../_components/StatusBadge";
import { QuoteForm } from "./_components/QuoteForm";
import { OutreachPanel } from "./_components/OutreachPanel";
import { NewCampaignButton } from "./_components/NewCampaignButton";

// ─────────────────────────────────────────────────────────────────────────────
// /admin/political/[candidateId] — Candidate Detail (Phase 2, read-only)
//
// Overview + Contacts tabs via URL query (?tab=contacts). Keeps tabs
// shareable and refresh-safe; no client-side state.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ candidateId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Days between two dates; null if either is null. Negative if past. */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return null;
  const now = Date.now();
  return Math.round((target - now) / (24 * 60 * 60 * 1000));
}

type CandidateDetailTab = "overview" | "contacts" | "quote" | "outreach";

export default async function CandidateDetailPage({ params, searchParams }: PageProps) {
  const { candidateId } = await params;
  const sp = await searchParams;
  const rawTab = first(sp["tab"]);
  const tab: CandidateDetailTab =
    rawTab === "contacts"
      ? "contacts"
      : rawTab === "quote"
        ? "quote"
        : rawTab === "outreach"
          ? "outreach"
          : "overview";

  const candidate = await loadCandidate(candidateId);
  if (!candidate) notFound();

  const contacts = tab === "contacts" || tab === "outreach"
    ? await loadContactsForCandidate(candidateId)
    : [];

  const campaigns =
    tab === "quote" || tab === "outreach"
      ? await loadCampaignsForCandidate(candidateId)
      : [];
  const proposals = tab === "quote" ? await listProposalsForCandidate(candidateId) : [];

  // Outreach-tab-specific loads
  const scripts: ScriptRow[] = tab === "outreach" ? await listAllActiveScripts(candidate.state) : [];
  const repName =
    tab === "outreach" ? await loadCurrentRepName() : "";

  const countdown = daysUntil(candidate.electionDate);

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/admin/political"
        className="inline-flex items-center text-xs text-slate-500 hover:text-slate-900"
      >
        ← Back to candidates
      </Link>

      {/* Header */}
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">
              {candidate.candidateName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>{candidate.officeSought ?? "Office not recorded"}</span>
              <span className="text-slate-300">·</span>
              <GeographyLabel
                state={candidate.state}
                geographyType={candidate.geographyType}
                geographyValue={candidate.geographyValue}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={candidate.candidateStatus} />
            <DistrictTypeBadge value={candidate.districtType} />
            {candidate.priorityScore !== null && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                Priority {candidate.priorityScore}
              </span>
            )}
            <NewCampaignButton
              candidate={{
                id: candidate.id,
                candidateName: candidate.candidateName,
                officeSought: candidate.officeSought,
                districtType: candidate.districtType,
                geographyType: candidate.geographyType,
                geographyValue: candidate.geographyValue,
                electionDate: candidate.electionDate,
              }}
            />
          </div>
        </div>

        {/* Election countdown */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
          <span>
            <span className="text-slate-400">Election:</span>{" "}
            <span className="font-medium text-slate-800">
              {formatDate(candidate.electionDate)}
            </span>
          </span>
          {countdown !== null && (
            <span
              className={
                countdown < 0
                  ? "text-slate-400"
                  : countdown <= 30
                    ? "font-medium text-rose-700"
                    : countdown <= 90
                      ? "font-medium text-amber-700"
                      : "font-medium text-slate-700"
              }
            >
              {countdown < 0
                ? `past (${Math.abs(countdown)}d ago)`
                : `in ${countdown} day${countdown === 1 ? "" : "s"}`}
            </span>
          )}
        </div>
      </header>

      {/* Tabs */}
      <nav
        className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm"
        aria-label="Candidate sections"
      >
        <TabLink href={`/admin/political/${candidateId}`} active={tab === "overview"}>
          Overview
        </TabLink>
        <TabLink
          href={`/admin/political/${candidateId}?tab=contacts`}
          active={tab === "contacts"}
        >
          Contacts
        </TabLink>
        <TabLink
          href={`/admin/political/${candidateId}?tab=quote`}
          active={tab === "quote"}
        >
          Quote &amp; Proposals
        </TabLink>
        <TabLink
          href={`/admin/political/${candidateId}?tab=outreach`}
          active={tab === "outreach"}
        >
          Outreach
        </TabLink>
      </nav>

      {tab === "overview" ? (
        <OverviewTab candidate={candidate} formatDateTime={formatDateTime} />
      ) : tab === "contacts" ? (
        <ContactsTab contacts={contacts} />
      ) : tab === "quote" ? (
        <QuoteTab
          candidateId={candidateId}
          campaigns={campaigns.map((c) => ({
            id: c.id,
            label: `${c.campaignName}${c.pipelineStatus ? ` — ${c.pipelineStatus}` : ""}`,
          }))}
          proposals={proposals}
        />
      ) : (
        <OutreachTab
          candidate={candidate}
          campaigns={campaigns}
          contacts={contacts}
          scripts={scripts}
          repName={repName}
        />
      )}

      <p className="text-xs text-slate-400">
        Phase 2 — read-only. Actions (outreach, quotes, proposals) land in
        Phase 3+.
      </p>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-md bg-white px-3 py-1.5 font-medium text-slate-900 shadow-sm ring-1 ring-slate-200"
          : "rounded-md px-3 py-1.5 font-medium text-slate-600 hover:text-slate-900"
      }
    >
      {children}
    </Link>
  );
}

function OverviewTab({
  candidate,
  formatDateTime,
}: {
  candidate: Awaited<ReturnType<typeof loadCandidate>>;
  formatDateTime: (iso: string | null) => string;
}) {
  if (!candidate) return null;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Panel title="Campaign">
        <Field label="Campaign website" value={candidate.campaignWebsite} link />
        <Field label="Campaign email" value={candidate.campaignEmail} mailto />
        <Field label="Campaign phone" value={candidate.campaignPhone} tel />
        <Field label="Facebook" value={candidate.facebookUrl} link />
        <Field label="Messenger" value={candidate.messengerUrl} link />
        <Field label="Campaign manager" value={candidate.campaignManagerName} />
        <Field label="Manager email" value={candidate.campaignManagerEmail} mailto />
      </Panel>

      <Panel title="Race">
        <Field label="Office" value={candidate.officeSought} />
        <Field
          label="Election year"
          value={candidate.electionYear !== null ? String(candidate.electionYear) : null}
        />
        <Field
          label="Election date"
          value={candidate.electionDate}
          formatter={(v) => new Date(v).toLocaleDateString("en-US", { dateStyle: "medium" })}
        />
        <Field
          label="Party (public record)"
          value={candidate.partyOptionalPublic}
          hint="Operational field only — used for records, never for persuasion."
        />
      </Panel>

      <Panel title="Pipeline">
        <Field label="Last contacted" value={candidate.lastContactedAt} formatter={formatDateTime} />
        <Field label="Next follow-up" value={candidate.nextFollowUpAt} formatter={formatDateTime} />
        <Field
          label="Completeness"
          value={
            candidate.completenessScore !== null
              ? `${candidate.completenessScore} / 100`
              : null
          }
        />
        <Field
          label="Priority"
          value={
            candidate.priorityScore !== null ? `${candidate.priorityScore} / 100` : null
          }
        />
      </Panel>

      <Panel title="Compliance">
        <ComplianceRow label="Do not contact" on={candidate.doNotContact} />
        <ComplianceRow label="Do not email" on={candidate.doNotEmail} />
        <ComplianceRow label="Do not text" on={candidate.doNotText} />
      </Panel>

      {candidate.notes && (
        <Panel title="Notes" full>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{candidate.notes}</p>
        </Panel>
      )}

      <Panel title="Provenance" full>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3">
          <Field label="Source URL" value={candidate.sourceUrl} link />
          <Field label="Source type" value={candidate.sourceType} />
          <Field label="Last verified" value={candidate.dataVerifiedAt} formatter={formatDateTime} />
        </div>
      </Panel>
    </div>
  );
}

function ContactsTab({ contacts }: { contacts: Awaited<ReturnType<typeof loadContactsForCandidate>> }) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">
          No contacts recorded for this candidate yet.
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {contacts.map((c) => (
        <li
          key={c.id}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{c.name}</span>
                {c.isPrimary && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    Primary
                  </span>
                )}
              </div>
              {c.role && (
                <div className="mt-0.5 text-xs text-slate-500">{c.role}</div>
              )}
              <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm md:grid-cols-2">
                {c.email && (
                  <div className="flex gap-2">
                    <dt className="text-slate-400">Email:</dt>
                    <dd className="truncate">
                      <a className="text-blue-700 hover:underline" href={`mailto:${c.email}`}>
                        {c.email}
                      </a>
                    </dd>
                  </div>
                )}
                {c.phone && (
                  <div className="flex gap-2">
                    <dt className="text-slate-400">Phone:</dt>
                    <dd className="truncate">
                      <a className="text-blue-700 hover:underline" href={`tel:${c.phone}`}>
                        {c.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {c.preferredContactMethod && (
                  <div className="flex gap-2">
                    <dt className="text-slate-400">Prefers:</dt>
                    <dd>{c.preferredContactMethod.replace("_", " ")}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="flex flex-col items-end gap-1 text-[10px]">
              {c.doNotContact && (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                  DNC
                </span>
              )}
              {c.doNotEmail && !c.doNotContact && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                  No email
                </span>
              )}
              {c.doNotText && !c.doNotContact && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                  No text
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────

function Panel({
  title,
  children,
  full,
}: {
  title: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${full ? "md:col-span-2" : ""}`}
    >
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="space-y-1.5 text-sm">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  link,
  mailto,
  tel,
  formatter,
  hint,
}: {
  label: string;
  value: string | null;
  link?: boolean;
  mailto?: boolean;
  tel?: boolean;
  formatter?: (v: string) => string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 md:flex-row md:gap-3">
      <dt className="w-40 shrink-0 text-xs text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-slate-800">
        {value ? (
          link ? (
            <a
              href={value.startsWith("http") ? value : `https://${value}`}
              className="truncate text-blue-700 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {value}
            </a>
          ) : mailto ? (
            <a href={`mailto:${value}`} className="text-blue-700 hover:underline">
              {value}
            </a>
          ) : tel ? (
            <a href={`tel:${value}`} className="text-blue-700 hover:underline">
              {value}
            </a>
          ) : formatter ? (
            formatter(value)
          ) : (
            value
          )
        ) : (
          <span className="text-slate-400">—</span>
        )}
        {hint && <div className="mt-0.5 text-[10px] text-slate-400">{hint}</div>}
      </dd>
    </div>
  );
}

function ComplianceRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-700">{label}</span>
      {on ? (
        <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
          Blocked
        </span>
      ) : (
        <span className="text-xs text-slate-400">Allowed</span>
      )}
    </div>
  );
}

// ── Quote & Proposals tab ────────────────────────────────────────────────────

function QuoteTab({
  candidateId,
  campaigns,
  proposals,
}: {
  candidateId: string;
  campaigns: Array<{ id: string; label: string }>;
  proposals: ProposalRow[];
}) {
  return (
    <div className="space-y-4">
      <QuoteForm
        candidateId={candidateId}
        campaigns={campaigns}
        needsCampaign={campaigns.length === 0}
      />
      <ProposalsList proposals={proposals} />
    </div>
  );
}

function ProposalsList({ proposals }: { proposals: ProposalRow[] }) {
  if (proposals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">No proposals sent for this candidate yet.</p>
      </div>
    );
  }
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Recent proposals
      </header>
      <ul className="divide-y divide-slate-100">
        {proposals.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <ProposalStatusBadge status={p.status} />
                <span className="text-xs text-slate-400">
                  {new Date(p.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-slate-600">
                <span>
                  <span className="text-slate-400">Households:</span> {p.households.toLocaleString()}
                </span>
                <span>
                  <span className="text-slate-400">Drops:</span> {p.drops}
                </span>
                <span>
                  <span className="text-slate-400">Pieces:</span> {p.totalPieces.toLocaleString()}
                </span>
                <span>
                  <span className="text-slate-400">Total:</span>{" "}
                  <span className="font-medium text-slate-800">
                    {(p.totalInvestmentCents / 100).toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}
                  </span>
                </span>
              </div>
            </div>
            {p.publicToken && (p.status === "sent" || p.status === "viewed" || p.status === "approved") && (
              <Link
                href={`/p/${p.publicToken}`}
                target="_blank"
                className="text-xs text-blue-700 hover:underline"
              >
                Open public link →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProposalStatusBadge({ status }: { status: ProposalRow["status"] }) {
  const cls: Record<ProposalRow["status"], string> = {
    draft:    "bg-slate-100 text-slate-700 ring-slate-200",
    sent:     "bg-blue-50 text-blue-700 ring-blue-200",
    viewed:   "bg-cyan-50 text-cyan-700 ring-cyan-200",
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    declined: "bg-rose-50 text-rose-700 ring-rose-200",
    expired:  "bg-amber-50 text-amber-700 ring-amber-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls[status]}`}>
      {status}
    </span>
  );
}

// ── Outreach tab ─────────────────────────────────────────────────────────────

function OutreachTab({
  candidate,
  campaigns,
  contacts,
  scripts,
  repName,
}: {
  candidate: CandidateRow;
  campaigns: CampaignRow[];
  contacts: ContactRow[];
  scripts: ScriptRow[];
  repName: string;
}) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">No political campaign on file for this candidate yet.</p>
        <p className="mt-1 text-xs text-amber-800">
          Outreach is scoped to a specific campaign engagement so activity
          lands on the right timeline. Create a{" "}
          <code className="rounded bg-amber-100 px-1">political_campaigns</code> row
          first (SQL editor) and refresh.
        </p>
      </div>
    );
  }

  // Phase 6 scopes outreach to the most recent campaign. Later phases can add
  // a picker if a candidate typically has multiple parallel engagements.
  const primary = campaigns[0]!;
  const label = `${primary.campaignName}${primary.pipelineStatus ? ` — ${primary.pipelineStatus}` : ""}`;

  return (
    <OutreachPanel
      candidate={candidate}
      campaignId={primary.id}
      campaignLabel={label}
      contacts={contacts}
      scripts={scripts}
      repName={repName}
    />
  );
}

/** Reads the signed-in rep's full_name from profiles. Used as a {{rep_name}}
 *  template variable in scripts. Falls back to "HomeReach" when unavailable. */
async function loadCurrentRepName(): Promise<string> {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return "HomeReach";
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  const row = data as { full_name: string | null; email: string | null } | null;
  return row?.full_name?.trim() || row?.email?.split("@")[0] || "HomeReach";
}
