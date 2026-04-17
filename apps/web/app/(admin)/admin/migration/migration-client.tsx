"use client";

import { useState, useEffect } from "react";
import type { MigratedClient, SpotType, ClientMigrationStatus } from "@/lib/engine/types";
import { MIGRATION_STATUS_META, SPOT_TYPE_META } from "@/lib/admin/mock-clients";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Client Migration System
// Onboard existing/legacy customers, track contracts, prevent duplicate billing
// ─────────────────────────────────────────────────────────────────────────────

// ── Blank form state ──────────────────────────────────────────────────────

const BLANK_FORM = {
  businessName:    "",
  contactName:     "",
  phone:           "",
  email:           "",
  city:            "",
  category:        "",
  spotType:        "front" as SpotType,
  monthlyPrice:    299,
  contractStart:   new Date().toISOString().split("T")[0],
  remainingMonths: 12,
  migrationStatus: "legacy_active" as ClientMigrationStatus,
  notes:           "",
};

type FormState = typeof BLANK_FORM;

// ── Cities / Categories for dropdowns ────────────────────────────────────

const CITY_OPTIONS = [
  { id: "city-medina",          label: "Medina, OH"          },
  { id: "city-stow",            label: "Stow, OH"            },
  { id: "city-hudson",          label: "Hudson, OH"          },
  { id: "city-akron",           label: "Akron, OH"           },
  { id: "city-canton",          label: "Canton, OH"          },
  { id: "city-wooster",         label: "Wooster, OH"         },
  { id: "city-cuyahoga-falls",  label: "Cuyahoga Falls, OH"  },
  { id: "city-kent",            label: "Kent, OH"            },
  { id: "city-brunswick",       label: "Brunswick, OH"       },
  { id: "city-strongsville",    label: "Strongsville, OH"    },
  { id: "city-north-canton",    label: "North Canton, OH"    },
  { id: "city-massillon",       label: "Massillon, OH"       },
  { id: "city-wadsworth",       label: "Wadsworth, OH"       },
  { id: "city-norton",          label: "Norton, OH"          },
  { id: "city-barberton",       label: "Barberton, OH"       },
];

const CATEGORY_OPTIONS = [
  "Plumber", "HVAC", "Electrician", "Landscaper", "Dentist",
  "Chiropractor", "Realtor", "Insurance", "Attorney",
  "Pool Service", "Roofer", "House Cleaning", "Pressure Washing",
  "Pest Control", "Painting", "Flooring", "Windows", "Gutters",
  "Other",
];

// ── Helper: compute contract end date ────────────────────────────────────

function contractEnd(startDate: string, remainingMonths: number): string {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + remainingMonths);
  return d.toISOString().split("T")[0];
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ClientMigrationStatus }) {
  const meta = MIGRATION_STATUS_META[status];
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", meta.color)}>
      {meta.label}
    </span>
  );
}

// ── Contract Bar ──────────────────────────────────────────────────────────

function ContractBar({ contract }: { contract: MigratedClient["contract"] }) {
  const days = daysUntil(contract.endDate);
  const totalDays = Math.round(
    (new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const pct = Math.max(0, Math.min(100, Math.round((days / totalDays) * 100)));
  const urgentColor = days <= 60 ? "bg-amber-500" : days <= 30 ? "bg-red-500" : "bg-blue-500";

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{contract.startDate}</span>
        <span className={cn(days <= 60 ? "text-amber-400 font-semibold" : "")}>
          {days > 0 ? `${contract.remainingMonths}mo left` : "Expired"}
        </span>
        <span>{contract.endDate}</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", urgentColor)} style={{ width: `${pct}%` }} />
      </div>
      {contract.isNearingRenewal && (
        <p className="text-xs text-amber-400 mt-1">⚠️ Nearing renewal — initiate conversation</p>
      )}
    </div>
  );
}

// ── Intake Form ───────────────────────────────────────────────────────────

function MigrationForm({ onSubmit }: { onSubmit: (client: MigratedClient) => void }) {
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const cityObj = CITY_OPTIONS.find((c) => c.id === form.city || c.label === form.city);
    const startDate = form.contractStart;
    const endDate   = contractEnd(startDate, form.remainingMonths);

    const newClient: MigratedClient = {
      id:              `mc-${Date.now()}`,
      businessName:    form.businessName,
      contactName:     form.contactName,
      phone:           form.phone,
      email:           form.email,
      cityId:          cityObj?.id ?? "city-custom",
      city:            cityObj?.label ?? form.city,
      categoryId:      `cat-${form.category.toLowerCase().replace(/\s/g, "-")}`,
      category:        form.category,
      spotId:          null,
      spotType:        form.spotType,
      monthlyPrice:    Number(form.monthlyPrice),
      migrationStatus: form.migrationStatus,
      contract: {
        startDate,
        endDate,
        remainingMonths:    form.remainingMonths,
        isNearingRenewal:   daysUntil(endDate) <= 60,
        renewalTriggered:   false,
      },
      notes:            form.notes,
      migratedAt:       new Date().toISOString(),
      migratedBy:       "Admin",
      appearsInDashboard: form.migrationStatus !== "legacy_pending",
      appearsInROI:       form.migrationStatus !== "legacy_pending",
      billingPrevented:   form.migrationStatus === "legacy_active" || form.migrationStatus === "legacy_pending",
    };

    setTimeout(() => {
      onSubmit(newClient);
      setForm(BLANK_FORM);
      setSubmitting(false);
    }, 600);
  }

  const endDate = contractEnd(form.contractStart, form.remainingMonths);

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
      <div>
        <h2 className="text-base font-bold text-white">Add Legacy / Migrated Client</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Existing paid customers — no new billing will be triggered for legacy_active status.
        </p>
      </div>

      {/* Business Info */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Business Info</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Business Name" required>
            <input value={form.businessName} onChange={(e) => set("businessName", e.target.value)}
              placeholder="Harrington Plumbing" required />
          </Field>
          <Field label="Contact Name" required>
            <input value={form.contactName} onChange={(e) => set("contactName", e.target.value)}
              placeholder="Mike Harrington" required />
          </Field>
          <Field label="Phone" required>
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)}
              placeholder="+13301234567" required />
          </Field>
          <Field label="Email" required>
            <input value={form.email} onChange={(e) => set("email", e.target.value)}
              type="email" placeholder="mike@example.com" required />
          </Field>
        </div>
      </fieldset>

      {/* City / Category / Spot */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Location & Spot</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" required>
            <select value={form.city} onChange={(e) => set("city", e.target.value)} required>
              <option value="">Select city…</option>
              {CITY_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Category" required>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} required>
              <option value="">Select category…</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Spot Type" required>
            <select value={form.spotType} onChange={(e) => set("spotType", e.target.value as SpotType)}>
              {Object.entries(SPOT_TYPE_META).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label} — {meta.description}</option>
              ))}
            </select>
          </Field>
          <Field label="Monthly Price ($)" required>
            <input
              type="number" min={0} value={form.monthlyPrice}
              onChange={(e) => set("monthlyPrice", Number(e.target.value))} required
            />
          </Field>
        </div>
      </fieldset>

      {/* Contract */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Contract</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contract Start Date" required>
            <input type="date" value={form.contractStart}
              onChange={(e) => set("contractStart", e.target.value)} required />
          </Field>
          <Field label="Remaining Term (months)" required>
            <input type="number" min={1} max={60} value={form.remainingMonths}
              onChange={(e) => set("remainingMonths", Number(e.target.value))} required />
          </Field>
        </div>
        <div className="px-3 py-2 bg-gray-800 rounded-lg text-xs text-gray-400 flex items-center gap-2">
          <span>📅 Projected end date:</span>
          <span className="font-semibold text-white">{endDate}</span>
          {daysUntil(endDate) <= 60 && (
            <span className="text-amber-400">⚠️ Nearing renewal</span>
          )}
        </div>
      </fieldset>

      {/* Migration Status */}
      <fieldset>
        <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Migration Status</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["legacy_active", "legacy_pending", "new_system"] as const).map((status) => {
            const meta = MIGRATION_STATUS_META[status];
            return (
              <label key={status} className={cn(
                "flex flex-col gap-1 p-3 rounded-xl border cursor-pointer transition",
                form.migrationStatus === status
                  ? "border-blue-500 bg-blue-900/20"
                  : "border-gray-700 hover:border-gray-500"
              )}>
                <input
                  type="radio" name="migrationStatus" value={status}
                  checked={form.migrationStatus === status}
                  onChange={() => set("migrationStatus", status)}
                  className="sr-only"
                />
                <span className={cn("text-xs px-2 py-0.5 rounded-full w-fit font-semibold", meta.color)}>
                  {meta.label}
                </span>
                <span className="text-xs text-gray-500">{meta.description}</span>
              </label>
            );
          })}
        </div>

        {form.migrationStatus === "legacy_active" && (
          <div className="mt-2 px-3 py-2 bg-amber-900/20 border border-amber-800/30 rounded-lg">
            <p className="text-xs text-amber-300 font-semibold">⚠️ Billing Prevention Active</p>
            <p className="text-xs text-amber-400 mt-0.5">
              This client will NOT be billed. They will be marked active immediately with no payment trigger.
            </p>
          </div>
        )}
      </fieldset>

      {/* Notes */}
      <Field label="Notes">
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Contract details, verbal agreements, custom pricing rationale…"
          rows={3}
        />
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className={cn(
          "w-full py-3 rounded-xl font-semibold text-sm transition",
          submitting
            ? "bg-gray-700 text-gray-400 cursor-wait"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        )}
      >
        {submitting ? "Adding client…" : "Add Migrated Client"}
      </button>
    </form>
  );
}

// ── Client Card ───────────────────────────────────────────────────────────

function ClientCard({ client, onStatusChange }: {
  client: MigratedClient;
  onStatusChange: (id: string, status: ClientMigrationStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      "bg-gray-900 border rounded-2xl p-5 transition",
      client.contract.isNearingRenewal
        ? "border-amber-800/50"
        : "border-gray-800"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-white truncate">{client.businessName}</h3>
            <StatusBadge status={client.migrationStatus} />
            {client.billingPrevented && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                🚫 No billing
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {client.contactName} · {client.city} · {client.category}
          </p>
          <p className="text-xs text-gray-500">
            {SPOT_TYPE_META[client.spotType].label} spot ·{" "}
            <span className="text-white font-semibold">${client.monthlyPrice}/mo</span>
          </p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-300 shrink-0"
        >
          {expanded ? "▲ Less" : "▼ More"}
        </button>
      </div>

      {/* Contract bar */}
      <div className="mt-4">
        <ContractBar contract={client.contract} />
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 space-y-3 border-t border-gray-800 pt-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-500">Phone</p>
              <p className="text-white">{client.phone}</p>
            </div>
            <div>
              <p className="text-gray-500">Email</p>
              <p className="text-white">{client.email}</p>
            </div>
            <div>
              <p className="text-gray-500">Spot ID</p>
              <p className="text-white">{client.spotId ?? "Not yet assigned"}</p>
            </div>
            <div>
              <p className="text-gray-500">Migrated by</p>
              <p className="text-white">{client.migratedBy}</p>
            </div>
            <div>
              <p className="text-gray-500">Dashboard</p>
              <p className={client.appearsInDashboard ? "text-green-400" : "text-gray-500"}>
                {client.appearsInDashboard ? "✓ Visible" : "✗ Hidden"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">ROI Dashboard</p>
              <p className={client.appearsInROI ? "text-green-400" : "text-gray-500"}>
                {client.appearsInROI ? "✓ Visible" : "✗ Hidden"}
              </p>
            </div>
          </div>
          {client.notes && (
            <div className="p-3 bg-gray-800 rounded-lg text-xs text-gray-400">
              {client.notes}
            </div>
          )}
          {/* Status transition */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Transition status:</p>
            <div className="flex gap-2 flex-wrap">
              {(["legacy_active", "legacy_pending", "new_system"] as const)
                .filter((s) => s !== client.migrationStatus)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => onStatusChange(client.id, s)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition"
                  >
                    → {MIGRATION_STATUS_META[s].label}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

interface Props {
  initialClients: MigratedClient[];
}

export function MigrationClient({ initialClients }: Props) {
  const [clients, setClients] = useState<MigratedClient[]>(initialClients);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<"all" | ClientMigrationStatus>("all");
  const [showForm, setShowForm] = useState(false);

  // ── Load real clients from DB on mount ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/migration")
      .then((r) => r.json())
      .then((data: { clients?: MigratedClient[] }) => {
        if (!cancelled && data.clients) setClients(data.clients);
      })
      .catch((err) => console.error("[MigrationClient] load error:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleAdd(client: MigratedClient) {
    try {
      const res = await fetch("/api/admin/migration", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          businessName:    client.businessName,
          contactName:     client.contactName,
          phone:           client.phone,
          email:           client.email,
          cityId:          client.cityId || undefined,
          city:            client.city,
          categoryId:      client.categoryId || undefined,
          category:        client.category,
          spotType:        client.spotType,
          monthlyPrice:    client.monthlyPrice,
          contractStart:   client.contract.startDate,
          remainingMonths: client.contract.remainingMonths,
          migrationStatus: client.migrationStatus,
          notes:           client.notes,
          migratedBy:      client.migratedBy,
        }),
      });
      const data = await res.json() as { id?: string; error?: unknown };
      if (!res.ok) {
        console.error("[MigrationClient] save error:", data.error);
        showToast("⚠️ Save failed — check console for details");
        return;
      }
      // Use DB-assigned ID in local state
      const saved: MigratedClient = { ...client, id: data.id ?? client.id };
      setClients((prev) => [saved, ...prev]);
      setShowForm(false);
      showToast(`✅ ${client.businessName} saved to database`);
    } catch (err) {
      console.error("[MigrationClient] network error:", err);
      showToast("⚠️ Network error — client not saved");
    }
  }

  function handleStatusChange(id: string, status: ClientMigrationStatus) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              migrationStatus: status,
              billingPrevented: status !== "new_system",
              appearsInDashboard: status !== "legacy_pending",
              appearsInROI: status !== "legacy_pending",
            }
          : c
      )
    );
    showToast(`Status updated to ${MIGRATION_STATUS_META[status].label}`);
  }

  const filtered = filter === "all" ? clients : clients.filter((c) => c.migrationStatus === filter);
  const renewalWarnings = clients.filter((c) => c.contract.isNearingRenewal);

  // Stats
  const totalMRR = clients
    .filter((c) => c.migrationStatus !== "legacy_pending")
    .reduce((s, c) => s + c.monthlyPrice, 0);
  const legacyCount = clients.filter((c) => c.migrationStatus === "legacy_active").length;
  const pendingCount = clients.filter((c) => c.migrationStatus === "legacy_pending").length;
  const newSystemCount = clients.filter((c) => c.migrationStatus === "new_system").length;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-800 border border-gray-700 text-sm text-white px-4 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400 animate-pulse">Loading migration records from database…</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Client Migration</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage existing customers — legacy contracts, billing protection, renewal tracking
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-semibold transition",
            showForm
              ? "bg-gray-700 text-gray-300"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          )}
        >
          {showForm ? "✕ Cancel" : "+ Add Client"}
        </button>
      </div>

      {/* Renewal Warnings */}
      {renewalWarnings.length > 0 && (
        <div className="p-4 bg-amber-900/20 border border-amber-800/40 rounded-xl">
          <p className="text-sm font-semibold text-amber-300 mb-2">
            ⚠️ {renewalWarnings.length} contract{renewalWarnings.length !== 1 ? "s" : ""} nearing renewal
          </p>
          <div className="flex flex-wrap gap-2">
            {renewalWarnings.map((c) => (
              <span key={c.id} className="text-xs px-2.5 py-1 bg-amber-900/40 border border-amber-700/40 text-amber-300 rounded-lg">
                {c.businessName} · {c.contract.remainingMonths}mo left
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MigrationStat icon="💰" label="Legacy MRR"      value={`$${totalMRR.toLocaleString()}`}  sub="from migrated clients" />
        <MigrationStat icon="🔒" label="Legacy Active"   value={String(legacyCount)}               sub="billing prevented" />
        <MigrationStat icon="⏳" label="Pending"         value={String(pendingCount)}              sub="awaiting finalization" />
        <MigrationStat icon="✅" label="New System"      value={String(newSystemCount)}            sub="digital billing active" />
      </div>

      {/* Form */}
      {showForm && <MigrationForm onSubmit={handleAdd} />}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
        {(["all", "legacy_active", "legacy_pending", "new_system"] as const).map((f) => {
          const count = f === "all"
            ? clients.length
            : clients.filter((c) => c.migrationStatus === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition",
                filter === f
                  ? "bg-gray-700 text-white"
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              {f === "all" ? "All" : MIGRATION_STATUS_META[f].label} ({count})
            </button>
          );
        })}
        <span className="ml-auto text-xs text-gray-600 italic">
          Future: bulk CSV import supported
        </span>
      </div>

      {/* Client Grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-600">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">No clients in this category yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-sm text-blue-400 hover:text-blue-300"
          >
            + Add the first one
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      <div className="pt-4 border-t border-gray-800">
        <p className="text-xs text-gray-600">
          All migrated clients with <strong className="text-gray-500">legacy_active</strong> status are fully
          protected from billing. Transition to <strong className="text-gray-500">new_system</strong> at contract
          end to enable digital subscription. CSV bulk import can be added to this interface.
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function MigrationStat({ icon, label, value, sub }: {
  icon: string; label: string; value: string; sub: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-600 mt-0.5">{sub}</p>
    </div>
  );
}

function Field({
  label, required, children,
}: {
  label: string; required?: boolean; children: React.ReactElement;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-400">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {React.cloneElement(children, {
        className: cn(
          "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600",
          "focus:outline-none focus:border-blue-500",
          children.props.className
        ),
      })}
    </div>
  );
}

// Need React for cloneElement
import React from "react";
