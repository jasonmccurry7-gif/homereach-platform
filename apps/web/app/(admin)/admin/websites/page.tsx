import type { Metadata } from "next";
import type React from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  DollarSign,
  ExternalLink,
  Globe2,
  Link2,
  Plus,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import {
  ACCOUNT_STATUS_LABELS,
  loadWebsiteManagementDashboard,
  MAINTENANCE_PRIORITY_LABELS,
  MAINTENANCE_REQUEST_TYPE_LABELS,
  MAINTENANCE_STATUS_LABELS,
  WEBSITE_STATUS_LABELS,
  type WebsiteClientOption,
  type WebsiteMaintenanceRequest,
  type WebsiteProjectRow,
} from "@/lib/website-management/repository";
import { createWebsiteMaintenanceRequestAction, createWebsiteProjectAction } from "./actions";

export const metadata: Metadata = {
  title: "Website Management - HomeReach Admin",
  description: "Track external client websites, website revenue, launch status, intake details, and operational links.",
};

const statusOptions = Object.entries(WEBSITE_STATUS_LABELS);
const accountStatusOptions = Object.entries(ACCOUNT_STATUS_LABELS);
const requestTypeOptions = Object.entries(MAINTENANCE_REQUEST_TYPE_LABELS);
const requestPriorityOptions = Object.entries(MAINTENANCE_PRIORITY_LABELS);
const requestStatusOptions = Object.entries(MAINTENANCE_STATUS_LABELS);

const checklistLabels = [
  ["logoReceived", "Logo Received"],
  ["photosReceived", "Photos Received"],
  ["testimonialsReceived", "Testimonials Received"],
  ["businessDescriptionReceived", "Business Description Received"],
  ["contactInformationVerified", "Contact Information Verified"],
  ["domainPurchased", "Domain Purchased"],
  ["hostingActive", "Hosting Active"],
  ["contentApproved", "Content Approved"],
  ["launchApproved", "Launch Approved"],
] as const;

export default async function AdminWebsitesPage() {
  const { rows, clientOptions, maintenanceRequests, summary, dataIssues } = await loadWebsiteManagementDashboard();
  const openMaintenanceRequests = maintenanceRequests.filter((request) => !["completed", "cancelled"].includes(request.status));

  return (
    <main className="min-h-screen bg-slate-100 pb-24 text-slate-950">
      <section className="border-b border-slate-800 bg-[#07111f] px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
                <Globe2 className="h-4 w-4" aria-hidden="true" />
                Website Management
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
                Manage client websites without pulling website code into HomeReach.
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-slate-200">
                Track external builds, status, domains, hosting, revenue, intake notes, assets, and quick links from one
                operational command view.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/10 p-4 shadow-2xl shadow-slate-950/20">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Phase 1 Guardrail</p>
              <p className="mt-2 max-w-xs text-sm font-semibold text-white">
                Management only. No hosting, CMS, builder, publishing, or website repository coupling.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Metric label="Total Websites" value={summary.totalWebsites.toString()} icon={<Globe2 />} />
            <Metric label="Monthly Revenue" value={formatMoney(summary.monthlyWebsiteRevenueCents)} icon={<DollarSign />} />
            <Metric label="In Build" value={summary.websitesInBuild.toString()} icon={<ShieldCheck />} />
            <Metric label="Pending Review" value={summary.pendingReview.toString()} icon={<UserRound />} />
            <Metric label="Live" value={summary.liveWebsites.toString()} icon={<CheckCircle2 />} />
            <Metric label="Past Due" value={summary.pastDueAccounts.toString()} icon={<AlertTriangle />} tone="warn" />
            <Metric label="Upcoming Renewals" value={summary.upcomingRenewals.toString()} icon={<CalendarDays />} />
            <Metric label="Open Requests" value={summary.maintenanceRequestsOpen.toString()} icon={<Wrench />} />
            <Metric label="Urgent Requests" value={summary.urgentMaintenanceRequests.toString()} icon={<Clock />} tone="warn" />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:px-8">
        <section className="space-y-6">
          {dataIssues.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.16em]">Data setup needed</h2>
                  <p className="mt-1 text-sm font-semibold">
                    Apply the Website Management migration before production records can be displayed or created.
                  </p>
                  <ul className="mt-2 space-y-1 text-xs font-semibold">
                    {dataIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Website Records</p>
                <h2 className="mt-1 text-2xl font-black">Active management queue</h2>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                {formatMoney(summary.averageRevenuePerWebsiteCents)} avg MRR
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {rows.length === 0 ? (
                <EmptyState />
              ) : (
                rows.map((row) => <WebsiteRecordCard key={row.website.id} row={row} />)
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Advanced Reporting</p>
                <h2 className="mt-1 text-2xl font-black">Website business health</h2>
              </div>
              <BarChart3 className="h-6 w-6 text-slate-400" aria-hidden="true" />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ReportCard label="Active Websites" value={summary.activeWebsites.toString()} helper="Accounts still marked active." />
              <ReportCard label="Pending Builds" value={summary.pendingBuilds.toString()} helper="Not live, paused, or cancelled." />
              <ReportCard label="Launches This Month" value={summary.launchesThisMonth.toString()} helper="Launch date in current month." />
              <ReportCard label="Monthly Website Revenue" value={formatMoney(summary.monthlyWebsiteRevenueCents)} helper="Active accounts only." />
              <ReportCard label="Average Revenue Per Website" value={formatMoney(summary.averageRevenuePerWebsiteCents)} helper="Active MRR average." />
              <ReportCard label="Maintenance Requests Open" value={summary.maintenanceRequestsOpen.toString()} helper="Needs operational follow-through." />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Maintenance Requests</p>
                <h2 className="mt-1 text-2xl font-black">Open website work queue</h2>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                {summary.maintenanceRequestsOpen} open
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {openMaintenanceRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <ClipboardList className="mx-auto h-7 w-7 text-blue-700" aria-hidden="true" />
                  <p className="mt-3 text-sm font-black">No open maintenance requests</p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    New update requests will appear here without changing any client website code inside HomeReach.
                  </p>
                </div>
              ) : (
                openMaintenanceRequests.map((request) => (
                  <MaintenanceRequestCard key={request.id} request={request} rows={rows} />
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Future Extension Points</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {["Website AI Audit", "SEO Audit", "Conversion Audit", "Content Refresh Suggestions", "Google Business Profile Audit"].map(
                (item) => (
                  <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-black text-slate-950">{item}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      Extension point is tracked, but no audit is auto-run or published.
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <CreateWebsiteForm clientOptions={clientOptions} />
          <CreateMaintenanceRequestForm rows={rows} />
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Revenue Snapshot</p>
            <div className="mt-4 space-y-3">
              <RevenueLine label="Monthly website revenue" value={formatMoney(summary.monthlyWebsiteRevenueCents)} />
              <RevenueLine label="Average revenue per website" value={formatMoney(summary.averageRevenuePerWebsiteCents)} />
              <RevenueLine label="Launches this month" value={summary.launchesThisMonth.toString()} />
              <RevenueLine label="Past due accounts" value={summary.pastDueAccounts.toString()} />
              <RevenueLine label="Open maintenance requests" value={summary.maintenanceRequestsOpen.toString()} />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === "warn" ? "border-amber-300/40 bg-amber-300/10" : "border-white/10 bg-white/[0.06]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-slate-300 [&_svg]:h-4 [&_svg]:w-4">{icon}</div>
        <span className="h-2 w-2 rounded-full bg-cyan-300" />
      </div>
      <p className="mt-4 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">{label}</p>
    </div>
  );
}

function CreateWebsiteForm({ clientOptions }: { clientOptions: WebsiteClientOption[] }) {
  return (
    <form action={createWebsiteProjectAction} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-blue-600 p-2 text-white">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Add Website</p>
          <h2 className="text-xl font-black">New website record</h2>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <fieldset className="grid gap-3">
          <FormSelect label="Link existing client" name="businessId">
            <option value="">No linked HomeReach client</option>
            {clientOptions.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </FormSelect>
          <FormInput label="Business Name" name="businessName" required />
          <FormInput label="Client Name" name="clientName" />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormInput label="Phone" name="phoneNumber" />
            <FormInput label="Email" name="email" type="email" />
          </div>
          <FormInput label="Business Type" name="businessType" placeholder="Restaurant, roofing, med spa..." />
        </fieldset>

        <fieldset className="grid gap-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Status and Revenue</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormSelect label="Build Status" name="status" defaultValue="intake_received">
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </FormSelect>
            <FormSelect label="Account Status" name="accountStatus" defaultValue="active">
              {accountStatusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </FormSelect>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormInput label="Monthly Plan" name="monthlyPlanAmount" inputMode="decimal" placeholder="250" />
            <FormInput label="Setup Fee" name="setupFee" inputMode="decimal" placeholder="1500" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormInput label="Revenue To Date" name="revenueToDate" inputMode="decimal" />
            <FormInput label="Next Billing Date" name="nextBillingDate" type="date" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormInput label="Last Payment Date" name="lastPaymentDate" type="date" />
            <FormInput label="Launch Date" name="launchDate" type="date" />
          </div>
        </fieldset>

        <fieldset className="grid gap-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">External Website Links</p>
          <FormInput label="Domain" name="domain" placeholder="example.com" />
          <FormInput label="Website URL" name="websiteUrl" />
          <FormInput label="Hosting Provider" name="hostingProvider" />
          <FormInput label="GitHub Repository Link" name="githubRepositoryUrl" />
          <FormInput label="Deployment Link" name="deploymentUrl" />
          <FormInput label="Hosting Dashboard" name="hostingDashboardUrl" />
          <FormInput label="Domain Registrar" name="domainRegistrarUrl" />
          <FormInput label="Google Business Profile" name="googleBusinessProfileUrl" />
          <FormInput label="Facebook Page" name="facebookPageUrl" />
          <FormInput label="Analytics Dashboard" name="analyticsDashboardUrl" />
        </fieldset>

        <fieldset className="grid gap-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Intake Storage</p>
          <FormTextarea label="Business Information" name="businessInformation" />
          <FormTextarea label="Service Areas" name="serviceAreas" placeholder="One per line or comma-separated" />
          <FormTextarea label="Services Offered" name="servicesOffered" placeholder="One per line or comma-separated" />
          <FormTextarea label="Customer Avatar" name="customerAvatar" />
          <FormTextarea label="Domain Information" name="domainInformation" />
          <FormTextarea label="Website Goals" name="websiteGoals" />
          <FormTextarea label="Special Requests" name="specialRequests" />
        </fieldset>

        <fieldset className="grid gap-2">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Asset Checklist</p>
          {checklistLabels.map(([name, label]) => (
            <label key={name} className="flex min-h-10 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold">
              <input name={name} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600" />
              {label}
            </label>
          ))}
        </fieldset>

        <fieldset className="grid gap-3">
          <FormInput label="Assigned Team Member" name="assignedTeamMember" />
          <FormTextarea label="Notes" name="notes" />
        </fieldset>

        <button
          type="submit"
          className="min-h-12 w-full rounded-lg bg-slate-950 px-4 text-sm font-black text-white shadow-lg shadow-slate-950/20 transition hover:bg-blue-700"
        >
          Save Website Record
        </button>
      </div>
    </form>
  );
}

function CreateMaintenanceRequestForm({ rows }: { rows: WebsiteProjectRow[] }) {
  return (
    <form action={createWebsiteMaintenanceRequestAction} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-emerald-600 p-2 text-white">
          <Wrench className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Maintenance</p>
          <h2 className="text-xl font-black">New update request</h2>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        <FormSelect label="Website" name="websiteProjectId" required>
          <option value="">Select website</option>
          {rows.map((row) => (
            <option key={row.website.id} value={row.website.id}>
              {row.website.businessName}
            </option>
          ))}
        </FormSelect>
        <FormSelect label="Request Type" name="requestType" defaultValue="other">
          {requestTypeOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </FormSelect>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormSelect label="Priority" name="priority" defaultValue="medium">
            {requestPriorityOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </FormSelect>
          <FormSelect label="Status" name="status" defaultValue="new">
            {requestStatusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </FormSelect>
        </div>
        <FormTextarea label="Description" name="description" required placeholder="Change phone number, replace hero image, add service..." />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormInput label="Assigned To" name="assignedTo" />
          <FormInput label="Completed Date" name="completedDate" type="date" />
        </div>
        <FormTextarea label="Notes" name="notes" />
        <button
          type="submit"
          className="min-h-12 w-full rounded-lg bg-emerald-700 px-4 text-sm font-black text-white shadow-lg shadow-emerald-950/20 transition hover:bg-slate-950"
        >
          Save Maintenance Request
        </button>
      </div>
    </form>
  );
}

function WebsiteRecordCard({ row }: { row: WebsiteProjectRow }) {
  const { website, business } = row;
  const checklistValues = Object.values(website.assetChecklist ?? {});
  const completedAssets = checklistValues.filter(Boolean).length;
  const totalAssets = checklistLabels.length;
  const openRequests = row.maintenanceRequests.filter((request) => !["completed", "cancelled"].includes(request.status));

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={WEBSITE_STATUS_LABELS[website.status]} />
            <AccountBadge label={ACCOUNT_STATUS_LABELS[website.accountStatus]} status={website.accountStatus} />
          </div>
          <h3 className="mt-3 text-xl font-black">{website.businessName}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {website.clientName || business?.name || "No client contact"} {website.businessType ? `- ${website.businessType}` : ""}
          </p>
          {business ? (
            <p className="mt-1 text-xs font-bold text-blue-700">Linked to HomeReach client record: {business.name}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-emerald-700">{formatMoney(website.monthlyPlanAmountCents)}</p>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Monthly plan</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <InfoBlock label="Contact" value={[website.email, website.phoneNumber].filter(Boolean).join(" / ") || "Not recorded"} />
        <InfoBlock label="Hosting" value={website.hostingProvider || "Not recorded"} />
        <InfoBlock label="Next Billing" value={formatDate(website.nextBillingDate) || "Not scheduled"} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <InfoBlock label="Setup Fee" value={formatMoney(website.setupFeeCents)} />
        <InfoBlock label="Revenue To Date" value={formatMoney(website.revenueToDateCents)} />
        <InfoBlock label="Asset Readiness" value={`${completedAssets}/${totalAssets} complete`} />
        <InfoBlock label="Open Requests" value={openRequests.length.toString()} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ExternalLinkButton label="Website" href={website.websiteUrl} />
        <ExternalLinkButton label="GitHub" href={website.githubRepositoryUrl} />
        <ExternalLinkButton label="Deploy" href={website.deploymentUrl} />
        <ExternalLinkButton label="Hosting" href={website.hostingDashboardUrl} />
        <ExternalLinkButton label="Domain" href={website.domainRegistrarUrl} />
        <ExternalLinkButton label="GBP" href={website.googleBusinessProfileUrl} />
        <ExternalLinkButton label="Analytics" href={website.analyticsDashboardUrl} />
      </div>

      {(website.notes || website.intake?.websiteGoals || website.intake?.specialRequests) ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Intake and Notes</p>
          {website.intake?.websiteGoals ? <p className="mt-2 text-sm font-semibold">{website.intake.websiteGoals}</p> : null}
          {website.intake?.specialRequests ? (
            <p className="mt-2 text-sm text-slate-700">{website.intake.specialRequests}</p>
          ) : null}
          {website.notes ? <p className="mt-2 text-sm text-slate-700">{website.notes}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

function MaintenanceRequestCard({
  request,
  rows,
}: {
  request: WebsiteMaintenanceRequest;
  rows: WebsiteProjectRow[];
}) {
  const website = rows.find((row) => row.website.id === request.websiteProjectId)?.website;

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-blue-700">
              {MAINTENANCE_REQUEST_TYPE_LABELS[request.requestType]}
            </span>
            <PriorityBadge priority={request.priority} />
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-600">
              {MAINTENANCE_STATUS_LABELS[request.status]}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-black">{website?.businessName ?? "Website record"}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-700">{request.description}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Assigned</p>
          <p className="mt-1 text-sm font-black text-slate-950">{request.assignedTo || "Unassigned"}</p>
        </div>
      </div>
      {request.notes ? (
        <p className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
          {request.notes}
        </p>
      ) : null}
    </article>
  );
}

function ReportCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-xs font-semibold text-slate-600">{helper}</p>
    </div>
  );
}

function FormInput({
  label,
  name,
  type = "text",
  ...props
}: {
  label: string;
  name: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">
      {label}
      <input
        name={name}
        type={type}
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        {...props}
      />
    </label>
  );
}

function FormTextarea({
  label,
  name,
  ...props
}: {
  label: string;
  name: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">
      {label}
      <textarea
        name={name}
        rows={3}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        {...props}
      />
    </label>
  );
}

function FormSelect({
  label,
  name,
  children,
  ...props
}: {
  label: string;
  name: string;
  children: React.ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">
      {label}
      <select
        name={name}
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

function ExternalLinkButton({ label, href }: { label: string; href: string | null }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </a>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-blue-700">
      {label}
    </span>
  );
}

function AccountBadge({ label, status }: { label: string; status: string }) {
  const tone =
    status === "past_due"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : status === "cancelled"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${tone}`}>{label}</span>;
}

function PriorityBadge({ priority }: { priority: WebsiteMaintenanceRequest["priority"] }) {
  const tone =
    priority === "urgent"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : priority === "high"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${tone}`}>
      {MAINTENANCE_PRIORITY_LABELS[priority]}
    </span>
  );
}

function RevenueLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <span className="text-sm font-black text-slate-950">{value}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
        <Link2 className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-xl font-black">No website records yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-slate-600">
        Add the first external client website record to start tracking status, revenue, domains, assets, and operational links.
      </p>
    </div>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
