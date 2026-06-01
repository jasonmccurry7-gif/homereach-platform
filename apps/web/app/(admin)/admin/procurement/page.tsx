import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  DollarSign,
  FileWarning,
  PackageSearch,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  db,
  opcopilotActionRequests,
  opcopilotAiEvents,
  opcopilotBusinessContexts,
  opcopilotDeliveries,
  opcopilotInventoryItems,
  opcopilotInvoiceAudits,
  opcopilotOperationalAlerts,
  opcopilotPriceSnapshots,
  opcopilotReceivingRecords,
  opcopilotSavingsRecommendations,
  opcopilotSupplierQuotes,
  opcopilotSuppliers,
} from "@homereach/db";
import { desc } from "drizzle-orm";
import { formatCopilotMoney } from "@/lib/operations-copilot/intelligence";
import {
  formatLastUpdatedLabel,
  isLiveSupplierFeedSource,
  resolvePriceSourceQuality,
  type PriceSourceQuality,
} from "@/lib/operations-copilot/price-confidence";
import { buildSupplierFreshnessSummary } from "@/lib/operations-copilot/price-ingestion";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Procurement Command - HomeReach Admin",
};

type ContextRow = typeof opcopilotBusinessContexts.$inferSelect;
type ActionRequestRow = typeof opcopilotActionRequests.$inferSelect;
type AiEventRow = typeof opcopilotAiEvents.$inferSelect;
type DeliveryRow = typeof opcopilotDeliveries.$inferSelect;
type InventoryRow = typeof opcopilotInventoryItems.$inferSelect;
type PriceSnapshotRow = typeof opcopilotPriceSnapshots.$inferSelect;
type ReceivingRow = typeof opcopilotReceivingRecords.$inferSelect;
type SavingsRecommendationRow = typeof opcopilotSavingsRecommendations.$inferSelect;
type SupplierQuoteRow = typeof opcopilotSupplierQuotes.$inferSelect;
type SupplierRow = typeof opcopilotSuppliers.$inferSelect;

type ProcurementDataIssue = {
  source: string;
  message: string;
};

const PROCUREMENT_PENDING_APPROVAL_STATUSES = new Set([
  "draft",
  "queued",
  "pending",
  "pending_approval",
  "needs_approval",
  "needs_review",
]);

function isProcurementPendingApprovalStatus(status: string | null | undefined) {
  return Boolean(status && PROCUREMENT_PENDING_APPROVAL_STATUSES.has(status));
}

async function safeAdminProcurementQuery<T>(
  source: string,
  read: () => unknown,
  issues: ProcurementDataIssue[]
): Promise<T[]> {
  try {
    const result = await (read() as PromiseLike<T[]> | T[]);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[admin/procurement] ${source} failed`, error);
    issues.push({ source, message });
    return [];
  }
}

export default async function AdminProcurementCommandPage() {
  const dataIssues: ProcurementDataIssue[] = [];
  const [
    businesses,
    events,
    actions,
    suppliers,
    inventory,
    savingsRecommendations,
    deliveries,
    receivingRecords,
    invoiceAudits,
    operationalAlerts,
    supplierQuotes,
    priceSnapshots,
  ] = await Promise.all([
    safeAdminProcurementQuery<ContextRow>(
      "Business profiles",
      () => db.select().from(opcopilotBusinessContexts).orderBy(desc(opcopilotBusinessContexts.updatedAt)).limit(80),
      dataIssues
    ),
    safeAdminProcurementQuery<AiEventRow>(
      "AI events",
      () => db.select().from(opcopilotAiEvents).orderBy(desc(opcopilotAiEvents.createdAt)).limit(120),
      dataIssues
    ),
    safeAdminProcurementQuery<ActionRequestRow>(
      "Approval actions",
      () => db.select().from(opcopilotActionRequests).orderBy(desc(opcopilotActionRequests.createdAt)).limit(120),
      dataIssues
    ),
    safeAdminProcurementQuery<SupplierRow>(
      "Suppliers",
      () => db.select().from(opcopilotSuppliers).limit(200),
      dataIssues
    ),
    safeAdminProcurementQuery<InventoryRow>(
      "Inventory items",
      () => db.select().from(opcopilotInventoryItems).limit(300),
      dataIssues
    ),
    safeAdminProcurementQuery<SavingsRecommendationRow>(
      "Savings recommendations",
      () => db.select().from(opcopilotSavingsRecommendations).orderBy(desc(opcopilotSavingsRecommendations.createdAt)).limit(120),
      dataIssues
    ),
    safeAdminProcurementQuery<DeliveryRow>(
      "Deliveries",
      () => db.select().from(opcopilotDeliveries).orderBy(desc(opcopilotDeliveries.createdAt)).limit(120),
      dataIssues
    ),
    safeAdminProcurementQuery<ReceivingRow>(
      "Receiving records",
      () => db.select().from(opcopilotReceivingRecords).orderBy(desc(opcopilotReceivingRecords.createdAt)).limit(120),
      dataIssues
    ),
    safeAdminProcurementQuery<typeof opcopilotInvoiceAudits.$inferSelect>(
      "Invoice audits",
      () => db.select().from(opcopilotInvoiceAudits).orderBy(desc(opcopilotInvoiceAudits.createdAt)).limit(120),
      dataIssues
    ),
    safeAdminProcurementQuery<typeof opcopilotOperationalAlerts.$inferSelect>(
      "Operational alerts",
      () => db.select().from(opcopilotOperationalAlerts).orderBy(desc(opcopilotOperationalAlerts.createdAt)).limit(120),
      dataIssues
    ),
    safeAdminProcurementQuery<SupplierQuoteRow>(
      "Supplier quotes",
      () => db.select().from(opcopilotSupplierQuotes).orderBy(desc(opcopilotSupplierQuotes.updatedAt)).limit(500),
      dataIssues
    ),
    safeAdminProcurementQuery<PriceSnapshotRow>(
      "Price snapshots",
      () => db.select().from(opcopilotPriceSnapshots).orderBy(desc(opcopilotPriceSnapshots.capturedAt)).limit(500),
      dataIssues
    ),
  ]);

  const activeAlerts = events.filter((event) => event.status === "open");
  const pendingApprovals = actions.filter((action) => isProcurementPendingApprovalStatus(action.status));
  const savingsFoundCents = activeAlerts.reduce(
    (sum, event) => sum + Math.max(0, event.estimatedImpactCents),
    0
  ) + savingsRecommendations.reduce(
    (sum, recommendation) => sum + Math.max(0, recommendation.projectedMonthlySavingsCents),
    0
  );
  const vendorIssues = suppliers.filter((supplier) => supplier.reliabilityScore < 75);
  const onboardingGaps = businesses.filter((business) => profileCompleteness(business) < 100);
  const openDeliveryIssues = deliveries.filter((delivery) =>
    ["delayed", "partial", "problem"].includes(String(delivery.status ?? ""))
  );
  const receivingProblems = receivingRecords.filter((record) =>
    record.damagedItemCount > 0 ||
    record.missingItemCount > 0 ||
    record.invoiceMismatchCount > 0
  );
  const openInvoiceAudits = invoiceAudits.filter((audit) => audit.status !== "resolved");
  const openOperationalAlerts = operationalAlerts.filter((alert) => alert.status === "open");
  const readiness = buildProcurementReadiness({
    businesses,
    deliveries,
    inventory,
    priceSnapshots,
    receivingRecords,
    supplierQuotes,
    suppliers,
  });
  const liveFeedSnapshotCount = priceSnapshots.filter((snapshot) =>
    isLiveSupplierFeedSource(snapshot.sourceType)
  ).length;
  const priceFreshnessSummary = buildSupplierFreshnessSummary(priceSnapshots);
  const stalePriceSnapshots = priceSnapshots.filter((snapshot) =>
    daysSince(snapshot.capturedAt) > 7
  );
  const unmappedInventoryCount = inventory.filter(
    (item) => supplierQuotes.every((quote) => quote.inventoryItemId !== item.id)
  ).length;
  const suppliersWithoutQuotes = suppliers.filter(
    (supplier) => supplierQuotes.every((quote) => quote.supplierId !== supplier.id)
  );
  const businessesWithoutApprovals = businesses.filter(
    (business) => approvalAutonomyLevel(business) < 1
  );
  const quoteCoverage =
    inventory.length > 0
      ? Math.round(((inventory.length - unmappedInventoryCount) / inventory.length) * 100)
      : 0;
  const savingsRollup = buildAdminSavingsRollup({
    actions,
    businesses,
    events,
    savingsRecommendations,
  });
  const priceSnapshotLabels = {
    verified: latestPriceSnapshotLabel(priceSnapshots, "verified"),
    observed: latestPriceSnapshotLabel(priceSnapshots, "observed"),
    estimated: latestPriceSnapshotLabel(priceSnapshots, "estimated"),
    liveFeed: latestLiveFeedSnapshotLabel(priceSnapshots),
  };

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
          Inventory + Procurement Admin
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
          Cost Reduction Control Center
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
          Admin readiness view for Operations Copilot. This shows stored quotes, benchmark snapshots, delivery records,
          and approval queues. It does not represent live daily supplier pricing unless connected feeds are present.
          Ordering, vendor switching, pricing, and billing remain human-controlled.
        </p>
      </section>

      {dataIssues.length > 0 ? <ProcurementDataIssuesPanel issues={dataIssues} /> : null}

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Operational readiness
              </p>
              <p className="mt-2 text-5xl font-black text-slate-950">{readiness.score}/100</p>
            </div>
            <span className={readiness.score >= 80 ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-800" : readiness.score >= 55 ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-amber-800" : "rounded-full bg-rose-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-rose-800"}>
              {readiness.label}
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            {readiness.summary}
          </p>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-900">
            Live feed status: {liveFeedSnapshotCount > 0 ? `${liveFeedSnapshotCount} connected-feed snapshots found` : "no verified live supplier feeds connected"}. Treat savings as approval-ready recommendations, not automated purchase authority.
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {readiness.checks.map((check) => (
            <div key={check.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    {check.label}
                  </p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{check.value}</p>
                </div>
                <span className={check.status === "ready" ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800" : check.status === "watch" ? "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800" : "rounded-full bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-800"}>
                  {check.status}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{check.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Building2} label="Businesses" value={String(businesses.length)} detail="Loaded procurement profiles" />
        <Metric icon={DollarSign} label="Savings found" value={formatCopilotMoney(savingsFoundCents)} detail="Open AI events, recommendations, and deterministic signals awaiting review" />
        <Metric icon={ShieldCheck} label="Pending approvals" value={String(pendingApprovals.length)} detail="Owner/admin decisions required" />
        <Metric icon={AlertTriangle} label="Vendor issues" value={String(vendorIssues.length)} detail="Suppliers below reliability threshold" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={DollarSign} label="Savings recommendations" value={String(savingsRecommendations.length)} detail="AI savings engine records" />
        <Metric icon={Truck} label="Delivery issues" value={String(openDeliveryIssues.length)} detail="Delayed, partial, or problem deliveries" />
        <Metric icon={PackageSearch} label="Quote coverage" value={`${quoteCoverage}%`} detail={`${supplierQuotes.length} stored quotes across ${inventory.length} tracked items`} />
        <Metric icon={AlertTriangle} label="Invoice audits" value={String(openInvoiceAudits.length + openOperationalAlerts.length)} detail="Open invoice and operational alerts" />
      </section>

      <AdminSavingsRollup rollup={savingsRollup} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Supplier pricing truth layer
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-950">
              Verified vs observed vs estimated
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Verified prices come from invoices, manual quotes, API, EDI, cXML, or approved portal data.
              Observed prices are public web/search benchmarks. Estimated prices are planning signals only.
            </p>
          </div>
          <Link
            href="/operations-copilot/supplier-prices"
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-black text-white"
          >
            Import price data
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <PriceTruthMetric
            label="Verified"
            value={priceFreshnessSummary.verified.total}
            detail={`${priceFreshnessSummary.verified.fresh} fresh / ${priceFreshnessSummary.verified.stale} stale`}
            lastUpdated={priceSnapshotLabels.verified}
            tone="emerald"
          />
          <PriceTruthMetric
            label="Observed"
            value={priceFreshnessSummary.observed.total}
            detail={`${priceFreshnessSummary.observed.fresh} fresh / ${priceFreshnessSummary.observed.stale} stale`}
            lastUpdated={priceSnapshotLabels.observed}
            tone="cyan"
          />
          <PriceTruthMetric
            label="Estimated"
            value={priceFreshnessSummary.estimated.total}
            detail={`${priceFreshnessSummary.estimated.fresh} fresh / ${priceFreshnessSummary.estimated.stale} stale`}
            lastUpdated={priceSnapshotLabels.estimated}
            tone="amber"
          />
          <PriceTruthMetric
            label="Live feeds"
            value={priceFreshnessSummary.liveFeed.total}
            detail="Supplier API, EDI, cXML, or approved portal feeds"
            lastUpdated={priceSnapshotLabels.liveFeed}
            tone={priceFreshnessSummary.liveFeed.total > 0 ? "emerald" : "rose"}
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ControlCard
            icon={ShieldCheck}
            label="Customer gate"
            value="Urgent only"
            detail="Owner views should show pending approvals, high-risk supply issues, or delivery exceptions. Routine supplier analysis stays admin-side."
          />
          <ControlCard
            icon={Database}
            label="Proof gate"
            value={`${unmappedInventoryCount} unmapped`}
            detail="Map critical inventory to supplier quotes before presenting high-confidence savings."
          />
          <ControlCard
            icon={FileWarning}
            label="Freshness gate"
            value={`${stalePriceSnapshots.length} stale`}
            detail="Refresh stale snapshots before using them in owner-facing savings estimates."
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <h2 className="text-xl font-black text-slate-950">Business Savings Watchlist</h2>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[1.1fr_0.6fr_0.6fr_0.6fr] bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              <span>Business</span>
              <span>Items</span>
              <span>Suppliers</span>
              <span>Profile</span>
            </div>
            <div className="divide-y divide-slate-100">
              {businesses.map((business) => {
                const itemCount = inventory.filter((item) => item.userId === business.userId).length;
                const supplierCount = suppliers.filter((supplier) => supplier.userId === business.userId).length;
                const completeness = profileCompleteness(business);
                return (
                  <div key={business.id} className="grid grid-cols-[1.1fr_0.6fr_0.6fr_0.6fr] gap-3 px-3 py-3 text-sm">
                    <div>
                      <p className="font-bold text-slate-950">{business.companyName}</p>
                      <p className="mt-1 text-xs text-slate-500">{business.businessType}</p>
                    </div>
                    <span className="font-semibold text-slate-700">{itemCount}</span>
                    <span className="font-semibold text-slate-700">{supplierCount}</span>
                    <span className={completeness >= 100 ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>
                      {completeness}%
                    </span>
                  </div>
                );
              })}
              {businesses.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-slate-500">
                  No procurement business profiles yet.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <AdminPanel
            icon={AlertTriangle}
            title="Active Alerts"
            items={[
              ...openOperationalAlerts.slice(0, 3).map((alert) => ({
                id: alert.id,
                title: alert.title,
                detail: `${alert.severity} severity / ${formatCopilotMoney(alert.estimatedImpactCents)} impact`,
              })),
              ...activeAlerts.slice(0, 5).map((event) => ({
                id: event.id,
                title: event.title,
                detail: `${event.urgency} urgency / ${formatCopilotMoney(event.estimatedImpactCents)} impact`,
              })),
            ].slice(0, 5)}
            empty="No active procurement alerts."
          />
          <AdminPanel
            icon={Truck}
            title="Vendor Issues"
            items={vendorIssues.slice(0, 5).map((supplier) => ({
              id: supplier.id,
              title: supplier.supplierName,
              detail: `${supplier.reliabilityScore}/100 reliability / ${supplier.averageLeadTimeDays}d lead time`,
            }))}
            empty="No supplier reliability issues."
          />
          <AdminPanel
            icon={CheckCircle2}
            title="Onboarding Gaps"
            items={onboardingGaps.slice(0, 5).map((business) => ({
              id: business.id,
              title: business.companyName,
              detail: `Profile ${profileCompleteness(business)}% complete. Add address, delivery notes, and receiving contact.`,
            }))}
            empty="All loaded profiles have complete delivery memory."
          />
          <AdminPanel
            icon={ShieldCheck}
            title="Data Quality Gaps"
            items={[
              ...(liveFeedSnapshotCount === 0
                ? [{
                    id: "gap-live-feeds",
                    title: "Live daily pricing is not connected",
                    detail: "Use supplier APIs, portal exports, EDI, invoice uploads, or approved collectors before showing live daily pricing claims.",
                  }]
                : []),
              ...(unmappedInventoryCount > 0
                ? [{
                    id: "gap-unmapped-items",
                    title: `${unmappedInventoryCount} items need quote coverage`,
                    detail: "Map each critical item to at least two supplier quotes before ranking savings as high confidence.",
                  }]
                : []),
              ...(suppliersWithoutQuotes.length > 0
                ? [{
                    id: "gap-suppliers-without-quotes",
                    title: `${suppliersWithoutQuotes.length} suppliers have no stored quotes`,
                    detail: "Supplier records exist, but quote/account pricing has not been loaded for them.",
                  }]
                : []),
              ...(stalePriceSnapshots.length > 0
                ? [{
                    id: "gap-stale-snapshots",
                    title: `${stalePriceSnapshots.length} price snapshots are older than 7 days`,
                    detail: "Refresh or label stale snapshots before using them in owner-facing savings estimates.",
                  }]
                : []),
              ...(businessesWithoutApprovals.length > 0
                ? [{
                    id: "gap-approval-policy",
                    title: `${businessesWithoutApprovals.length} profiles need approval policy review`,
                    detail: "Set owner approval rules before preparing order, vendor, or spend recommendations.",
                  }]
                : []),
            ].slice(0, 5)}
            empty="No major procurement data-quality gaps from loaded records."
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <AdminPanel
          icon={DollarSign}
          title="Savings Engine"
          items={savingsRecommendations.slice(0, 6).map((recommendation) => ({
            id: recommendation.id,
            title: recommendation.title,
            detail: `${formatCopilotMoney(recommendation.projectedMonthlySavingsCents)}/mo / ${statusLabel(recommendation.status)}`,
          }))}
          empty="No stored savings recommendations yet."
        />
        <AdminPanel
          icon={Truck}
          title="Delivery Intelligence"
          items={deliveries.slice(0, 6).map((delivery) => ({
            id: delivery.id,
            title: `${delivery.supplierName} - ${delivery.itemSummary}`,
            detail: `${statusLabel(delivery.status)} / ${delivery.deliveryWindow ?? "window not set"}`,
          }))}
          empty="No delivery records yet."
        />
        <AdminPanel
          icon={PackageSearch}
          title="Invoice + Receiving"
          items={[
            ...receivingProblems.slice(0, 3).map((record) => ({
              id: record.id,
              title: `Receiving issue - ${record.status}`,
              detail: `${record.missingItemCount} missing / ${record.damagedItemCount} damaged / ${record.invoiceMismatchCount} invoice mismatches`,
            })),
            ...openInvoiceAudits.slice(0, 3).map((audit) => ({
              id: audit.id,
              title: audit.issueSummary,
              detail: `${formatCopilotMoney(audit.varianceCents)} variance / ${statusLabel(audit.status)}`,
            })),
          ].slice(0, 6)}
          empty="No receiving or invoice exceptions yet."
        />
      </section>
    </main>
  );
}

function Metric({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <Icon className="h-5 w-5 text-emerald-600" aria-hidden="true" />
      </div>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

function AdminSavingsRollup({
  rollup,
}: {
  rollup: ReturnType<typeof buildAdminSavingsRollup>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Savings signal ledger
          </p>
          <h2 className="mt-2 text-xl font-black text-slate-950">
            Weekly, monthly, and enrollment rollups
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Admin rollup across action requests, AI savings recommendations, and open procurement events.
            Totals are review signals, not guaranteed savings, and may overlap until reconciled against invoices.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-700">
          <p>Since {rollup.enrollmentStartLabel}</p>
          <p className="text-slate-500">Updated {rollup.lastUpdatedLabel}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <RollupMetric
          icon={CalendarDays}
          label="Found this week"
          value={formatCopilotMoney(rollup.foundThisWeekCents)}
          detail={`${rollup.signalCountThisWeek} savings signals reviewed`}
        />
        <RollupMetric
          icon={CalendarDays}
          label="Found this month"
          value={formatCopilotMoney(rollup.foundThisMonthCents)}
          detail={`${rollup.signalCountThisMonth} signals in current month`}
        />
        <RollupMetric
          icon={DollarSign}
          label="Since enrollment"
          value={formatCopilotMoney(rollup.totalSinceEnrollmentCents)}
          detail="Identified signal total awaiting reconciliation"
        />
        <RollupMetric
          icon={CheckCircle2}
          label="Captured approved"
          value={formatCopilotMoney(rollup.capturedSinceEnrollmentCents)}
          detail={`${formatCopilotMoney(rollup.capturedThisMonthCents)} captured this month`}
        />
        <RollupMetric
          icon={Clock3}
          label="Pending approval"
          value={formatCopilotMoney(rollup.pendingApprovalCents)}
          detail={`${rollup.pendingApprovalCount} action record${rollup.pendingApprovalCount === 1 ? "" : "s"} ${rollup.pendingApprovalCount === 1 ? "needs" : "need"} decision`}
        />
      </div>
    </section>
  );
}

function RollupMetric({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <Icon className="h-5 w-5 text-emerald-600" aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

function PriceTruthMetric({
  detail,
  label,
  lastUpdated,
  tone,
  value,
}: {
  detail: string;
  label: string;
  lastUpdated: string;
  tone: "emerald" | "cyan" | "amber" | "rose";
  value: number;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "cyan"
        ? "border-cyan-200 bg-cyan-50 text-cyan-800"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-2 text-sm font-semibold leading-6">{detail}</p>
      <p className="mt-1 text-xs font-bold opacity-75">Last updated: {lastUpdated}</p>
    </div>
  );
}

function ControlCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-emerald-600" aria-hidden="true" />
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      </div>
      <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

function AdminPanel({
  empty,
  icon: Icon,
  items,
  title,
}: {
  empty: string;
  icon: typeof Building2;
  items: Array<{ id: string; title: string; detail: string }>;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-emerald-600" aria-hidden="true" />
        <h2 className="font-black text-slate-950">{title}</h2>
      </div>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="font-bold text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">{empty}</p>
        )}
      </div>
    </div>
  );
}

function ProcurementDataIssuesPanel({ issues }: { issues: ProcurementDataIssue[] }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <h2 className="font-black">Procurement data source needs review</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6">
            This page is still online using safe empty fallbacks for failed sources. Review the failed source,
            apply the missing migration or provider fix, then refresh the page.
          </p>
        </div>
        <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-amber-800">
          {issues.length} source issue{issues.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {issues.map((issue) => (
          <div key={`${issue.source}-${issue.message}`} className="rounded-xl border border-amber-200 bg-white p-3">
            <p className="text-sm font-black">{issue.source}</p>
            <p className="mt-1 text-sm leading-6">{issue.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function profileCompleteness(business: ContextRow) {
  const delivery = deliveryProfileForBusiness(business);
  const checks = [
    Boolean(delivery.businessAddress),
    Boolean(delivery.deliveryInstructions),
    Boolean(delivery.receivingContact),
    Boolean(delivery.preferredDeliveryWindows?.length),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function deliveryProfileForBusiness(business: ContextRow) {
  const memory = business.preferenceMemory;
  if (!memory || typeof memory !== "object" || Array.isArray(memory)) return {};
  const profile = memory.deliveryProfile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return {};
  return profile;
}

function approvalAutonomyLevel(business: ContextRow) {
  const policy = business.approvalPolicy;
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return 0;
  const level = Number(policy.autonomyLevel ?? 0);
  return Number.isFinite(level) ? level : 0;
}

function buildAdminSavingsRollup({
  actions,
  businesses,
  events,
  savingsRecommendations,
}: {
  actions: ActionRequestRow[];
  businesses: ContextRow[];
  events: AiEventRow[];
  savingsRecommendations: SavingsRecommendationRow[];
}) {
  const now = new Date();
  const weekStart = startOfBusinessWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const enrollmentStart = earliestDate([
    ...businesses.map((business) => business.createdAt),
    ...actions.map((action) => action.createdAt),
    ...savingsRecommendations.map((recommendation) => recommendation.createdAt),
    ...events.map((event) => event.createdAt),
  ]) ?? now;
  const actionSignals = actions
    .filter((action) => action.estimatedSavingsCents > 0)
    .map((action) => ({
      cents: action.estimatedSavingsCents,
      status: action.status,
      createdAt: action.createdAt,
      updatedAt: action.updatedAt,
    }));
  const recommendationSignals = savingsRecommendations
    .filter((recommendation) => recommendation.projectedMonthlySavingsCents > 0)
    .map((recommendation) => ({
      cents: recommendation.projectedMonthlySavingsCents,
      status: recommendation.status,
      createdAt: recommendation.createdAt,
      updatedAt: recommendation.updatedAt,
    }));
  const eventSignals = events
    .filter((event) => event.estimatedImpactCents > 0)
    .map((event) => ({
      cents: event.estimatedImpactCents,
      status: event.status,
      createdAt: event.createdAt,
      updatedAt: event.createdAt,
    }));
  const identifiedSignals = [...actionSignals, ...recommendationSignals, ...eventSignals].filter(
    (signal) => !["rejected", "ignored", "dismissed"].includes(signal.status ?? "")
  );
  const approvedActions = actionSignals.filter((action) => action.status === "approved");
  const pendingActions = actionSignals.filter((action) =>
    isProcurementPendingApprovalStatus(action.status)
  );
  const lastUpdated = latestDate([
    ...identifiedSignals.map((signal) => signal.updatedAt),
    ...identifiedSignals.map((signal) => signal.createdAt),
  ]) ?? now;

  return {
    enrollmentStartLabel: formatAdminDate(enrollmentStart),
    lastUpdatedLabel: formatLastUpdatedLabel(lastUpdated),
    foundThisWeekCents: sumSignalsSince(identifiedSignals, weekStart),
    foundThisMonthCents: sumSignalsSince(identifiedSignals, monthStart),
    totalSinceEnrollmentCents: sumSignalsSince(identifiedSignals, enrollmentStart),
    capturedThisMonthCents: sumSignalsSince(approvedActions, monthStart),
    capturedSinceEnrollmentCents: sumSignalsSince(approvedActions, enrollmentStart),
    pendingApprovalCents: sumSignals(pendingActions),
    pendingApprovalCount: pendingActions.length,
    signalCountThisWeek: countSignalsSince(identifiedSignals, weekStart),
    signalCountThisMonth: countSignalsSince(identifiedSignals, monthStart),
  };
}

function latestPriceSnapshotLabel(
  snapshots: PriceSnapshotRow[],
  quality: PriceSourceQuality
) {
  const latest = latestDate(
    snapshots
      .filter((snapshot) => resolvePriceSourceQuality(snapshot.sourceType) === quality)
      .map((snapshot) => snapshot.capturedAt)
  );
  return latest ? formatLastUpdatedLabel(latest) : "Not updated";
}

function latestLiveFeedSnapshotLabel(snapshots: PriceSnapshotRow[]) {
  const latest = latestDate(
    snapshots
      .filter((snapshot) => isLiveSupplierFeedSource(snapshot.sourceType))
      .map((snapshot) => snapshot.capturedAt)
  );
  return latest ? formatLastUpdatedLabel(latest) : "No connected feed";
}

function startOfBusinessWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function sumSignals(signals: Array<{ cents: number }>) {
  return signals.reduce((sum, signal) => sum + Math.max(0, signal.cents), 0);
}

function sumSignalsSince<T extends { cents: number; createdAt: Date | string | null | undefined }>(
  signals: T[],
  since: Date
) {
  return sumSignals(
    signals.filter((signal) => {
      const createdAt = coerceDate(signal.createdAt);
      return Boolean(createdAt && createdAt >= since);
    })
  );
}

function countSignalsSince<T extends { createdAt: Date | string | null | undefined }>(
  signals: T[],
  since: Date
) {
  return signals.filter((signal) => {
    const createdAt = coerceDate(signal.createdAt);
    return Boolean(createdAt && createdAt >= since);
  }).length;
}

function earliestDate(values: Array<Date | string | null | undefined>) {
  return values
    .map(coerceDate)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
}

function latestDate(values: Array<Date | string | null | undefined>) {
  return values
    .map(coerceDate)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

function formatAdminDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function buildProcurementReadiness({
  businesses,
  deliveries,
  inventory,
  priceSnapshots,
  receivingRecords,
  supplierQuotes,
  suppliers,
}: {
  businesses: ContextRow[];
  deliveries: DeliveryRow[];
  inventory: InventoryRow[];
  priceSnapshots: PriceSnapshotRow[];
  receivingRecords: ReceivingRow[];
  supplierQuotes: SupplierQuoteRow[];
  suppliers: SupplierRow[];
}) {
  const completeProfiles = businesses.filter((business) => profileCompleteness(business) === 100).length;
  const profileCoverage = percentage(completeProfiles, businesses.length);
  const itemsWithQuotes = new Set(supplierQuotes.map((quote) => quote.inventoryItemId)).size;
  const quoteCoverage = percentage(itemsWithQuotes, inventory.length);
  const suppliersWithQuotes = new Set(supplierQuotes.map((quote) => quote.supplierId)).size;
  const supplierCoverage = percentage(suppliersWithQuotes, suppliers.length);
  const liveFeedCount = priceSnapshots.filter((snapshot) =>
    isLiveSupplierFeedSource(snapshot.sourceType)
  ).length;
  const freshSnapshotCount = priceSnapshots.filter((snapshot) =>
    daysSince(snapshot.capturedAt) <= 7
  ).length;
  const priceFreshness = percentage(freshSnapshotCount, priceSnapshots.length);
  const receivingCoverage = deliveries.length > 0
    ? percentage(receivingRecords.length, deliveries.length)
    : receivingRecords.length > 0 ? 100 : 0;
  const rawScore = Math.round(
    profileCoverage * 0.2 +
    quoteCoverage * 0.25 +
    supplierCoverage * 0.15 +
    priceFreshness * 0.15 +
    receivingCoverage * 0.15 +
    (liveFeedCount > 0 ? 100 : 35) * 0.1
  );
  const score = liveFeedCount > 0 ? rawScore : Math.min(rawScore, 82);
  const label = score >= 80 ? "owner-ready" : score >= 55 ? "needs data" : "not ready";

  return {
    score,
    label,
    summary:
      liveFeedCount > 0
        ? "Enough records exist to support admin review, but recommendations still require owner approval before action."
        : "Good for internal procurement review and owner approval drafts. Not ready to claim live daily supplier pricing until connected feeds and refresh governance are active.",
    checks: [
      {
        label: "Business profiles",
        value: `${profileCoverage}%`,
        detail: `${completeProfiles} of ${businesses.length} profiles include delivery memory.`,
        status: readinessStatus(profileCoverage),
      },
      {
        label: "Quote coverage",
        value: `${quoteCoverage}%`,
        detail: `${itemsWithQuotes} of ${inventory.length} tracked items have stored supplier quotes.`,
        status: readinessStatus(quoteCoverage),
      },
      {
        label: "Supplier pricing",
        value: `${supplierCoverage}%`,
        detail: `${suppliersWithQuotes} of ${suppliers.length} suppliers have quote records.`,
        status: readinessStatus(supplierCoverage),
      },
      {
        label: "Price freshness",
        value: priceSnapshots.length > 0 ? `${priceFreshness}%` : "0%",
        detail: priceSnapshots.length > 0
          ? `${freshSnapshotCount} of ${priceSnapshots.length} snapshots are 7 days old or newer.`
          : "No benchmark/account price snapshots are stored yet.",
        status: priceSnapshots.length === 0 ? "blocked" : readinessStatus(priceFreshness),
      },
      {
        label: "Receiving loop",
        value: `${receivingCoverage}%`,
        detail: deliveries.length > 0
          ? `${receivingRecords.length} receiving records for ${deliveries.length} delivery records.`
          : "Delivery/receiving reconciliation has not been loaded.",
        status: deliveries.length === 0 ? "watch" : readinessStatus(receivingCoverage),
      },
      {
        label: "Live price feeds",
        value: String(liveFeedCount),
        detail: liveFeedCount > 0
          ? "Connected-feed snapshots exist. Verify cadence and credentials before owner-facing claims."
          : "No supplier API, EDI, portal, or approved live collector snapshots detected.",
        status: liveFeedCount > 0 ? "watch" : "blocked",
      },
    ],
  };
}

function readinessStatus(value: number): "ready" | "watch" | "blocked" {
  if (value >= 80) return "ready";
  if (value >= 40) return "watch";
  return "blocked";
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function daysSince(value: Date | string | null | undefined) {
  const date = coerceDate(value);
  if (!date) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function coerceDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function statusLabel(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "status not set";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown procurement data source error";
}
