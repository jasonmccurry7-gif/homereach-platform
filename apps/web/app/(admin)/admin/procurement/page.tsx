import type { Metadata } from "next";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  DollarSign,
  PackageSearch,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  db,
  opcopilotActionRequests,
  opcopilotAiEvents,
  opcopilotBusinessContexts,
  opcopilotInventoryItems,
  opcopilotSuppliers,
} from "@homereach/db";
import { desc } from "drizzle-orm";
import { formatCopilotMoney } from "@/lib/operations-copilot/intelligence";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Procurement Command - HomeReach Admin",
};

type ContextRow = typeof opcopilotBusinessContexts.$inferSelect;

export default async function AdminProcurementCommandPage() {
  const [businesses, events, actions, suppliers, inventory] = await Promise.all([
    db.select().from(opcopilotBusinessContexts).orderBy(desc(opcopilotBusinessContexts.updatedAt)).limit(80),
    db.select().from(opcopilotAiEvents).orderBy(desc(opcopilotAiEvents.createdAt)).limit(120),
    db.select().from(opcopilotActionRequests).orderBy(desc(opcopilotActionRequests.createdAt)).limit(120),
    db.select().from(opcopilotSuppliers).limit(200),
    db.select().from(opcopilotInventoryItems).limit(300),
  ]);

  const activeAlerts = events.filter((event) => event.status === "open");
  const pendingApprovals = actions.filter((action) => action.status === "pending_approval");
  const savingsFoundCents = activeAlerts.reduce(
    (sum, event) => sum + Math.max(0, event.estimatedImpactCents),
    0
  );
  const vendorIssues = suppliers.filter((supplier) => supplier.reliabilityScore < 75);
  const onboardingGaps = businesses.filter((business) => profileCompleteness(business) < 100);

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
          Read-only admin visibility into businesses using Operations Copilot. Ordering and billing remain governed by
          the existing customer approval workflow.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Building2} label="Businesses" value={String(businesses.length)} detail="Loaded procurement profiles" />
        <Metric icon={DollarSign} label="Savings found" value={formatCopilotMoney(savingsFoundCents)} detail="Open AI events and deterministic signals" />
        <Metric icon={ShieldCheck} label="Pending approvals" value={String(pendingApprovals.length)} detail="Owner/admin decisions required" />
        <Metric icon={AlertTriangle} label="Vendor issues" value={String(vendorIssues.length)} detail="Suppliers below reliability threshold" />
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
            items={activeAlerts.slice(0, 5).map((event) => ({
              id: event.id,
              title: event.title,
              detail: `${event.urgency} urgency / ${formatCopilotMoney(event.estimatedImpactCents)} impact`,
            }))}
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
        </div>
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

function profileCompleteness(business: ContextRow) {
  const delivery = business.preferenceMemory?.deliveryProfile ?? {};
  const checks = [
    Boolean(delivery.businessAddress),
    Boolean(delivery.deliveryInstructions),
    Boolean(delivery.receivingContact),
    Boolean(delivery.preferredDeliveryWindows?.length),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
