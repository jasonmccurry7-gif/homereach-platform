import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gov Contract Subcontractors - HomeReach Admin" };

type SubcontractorRow = {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  service_category: string | null;
  trade: string | null;
  insurance_status: string | null;
  license_status: string | null;
  pipeline_stage: string;
  reliability_score: number;
  w9_status: string;
  capability_statement_status: string;
  geography_served: unknown;
  certifications: unknown;
  notes: string | null;
};

function hasSupabaseServiceEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function loadSubcontractors(): Promise<{ source: "database" | "sample"; rows: SubcontractorRow[] }> {
  if (!hasSupabaseServiceEnv()) {
    return { source: "sample", rows: sampleSubcontractors() };
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("gov_contract_subcontractors")
      .select("*")
      .eq("hidden", false)
      .order("reliability_score", { ascending: false })
      .limit(100);

    if (error) throw error;
    const rows = (data ?? []) as SubcontractorRow[];
    return rows.length
      ? { source: "database", rows }
      : { source: "sample", rows: sampleSubcontractors() };
  } catch {
    return { source: "sample", rows: sampleSubcontractors() };
  }
}

function sampleSubcontractors(): SubcontractorRow[] {
  return [
    {
      id: "sample-print-partner",
      company_name: "Sample Print And Mail Partner",
      contact_name: "Operations Lead",
      contact_email: "quotes@example.com",
      contact_phone: null,
      website: null,
      service_category: "Print/mail production",
      trade: "Direct mail",
      insurance_status: "Needs verification",
      license_status: "Needs review",
      pipeline_stage: "Identified",
      reliability_score: 72,
      w9_status: "missing",
      capability_statement_status: "missing",
      geography_served: ["Ohio"],
      certifications: [],
      notes: "Sample record. Replace with verified subcontractor after outreach.",
    },
    {
      id: "sample-logistics-partner",
      company_name: "Sample Regional Logistics Partner",
      contact_name: "Dispatch Manager",
      contact_email: "dispatch@example.com",
      contact_phone: null,
      website: null,
      service_category: "Courier/logistics",
      trade: "Delivery",
      insurance_status: "Needs verification",
      license_status: "Needs review",
      pipeline_stage: "Quote Requested",
      reliability_score: 64,
      w9_status: "missing",
      capability_statement_status: "missing",
      geography_served: ["OH", "PA", "MI"],
      certifications: [],
      notes: "Use for workflow QA only.",
    },
  ];
}

function valueList(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (!value) return "Not listed";
  return String(value);
}

function tone(status: string | null) {
  if (!status || status.toLowerCase().includes("missing") || status.toLowerCase().includes("needs")) return "bg-amber-50 text-amber-800 ring-amber-200";
  if (status.toLowerCase().includes("verified") || status.toLowerCase().includes("ready")) return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export default async function GovContractSubcontractorsPage() {
  const data = await loadSubcontractors();
  const quoteReady = data.rows.filter((row) => row.pipeline_stage.toLowerCase().includes("quote")).length;
  const missingDocs = data.rows.filter((row) => row.w9_status !== "verified" || row.capability_statement_status !== "verified").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/admin/gov-contracts" className="text-sm font-bold text-blue-700 hover:text-blue-900">
          Back to Gov Contracts
        </Link>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
          {data.source === "database" ? "Database records" : "Sample records"}
        </span>
      </div>

      <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-200">Subcontractor Fulfillment Engine</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight lg:text-4xl">Gov Contract Subcontractors</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Source, qualify, quote, review compliance, select, onboard, and track subcontractors without creating commitments
          before written approval.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Metric label="Subcontractors" value={String(data.rows.length)} detail="Identified or active partners" />
        <Metric label="Quotes active" value={String(quoteReady)} detail="Quote requested or received" />
        <Metric label="Docs missing" value={String(missingDocs)} detail="W9, insurance, or capability gaps" />
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-black">Compliance guardrail</p>
        <p className="mt-1 leading-6">
          FAR Part 44 consent, advance-notification, flow-down clause, insurance, and subcontractor-document questions
          require human review. This page does not approve subcontractor commitments.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {data.rows.map((row) => (
          <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">{row.service_category ?? row.trade ?? "Service category TBD"}</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">{row.company_name}</h2>
                <p className="mt-2 text-sm text-slate-600">{row.contact_name ?? "Contact not listed"} {row.contact_email ? `- ${row.contact_email}` : ""}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 text-center ring-1 ring-slate-200">
                <p className="text-2xl font-black text-slate-950">{row.reliability_score}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Reliability</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Fact label="Stage" value={row.pipeline_stage} />
              <Fact label="Geography" value={valueList(row.geography_served)} />
              <Fact label="Insurance" value={row.insurance_status ?? "Needs verification"} />
              <Fact label="License / certs" value={row.license_status ?? valueList(row.certifications)} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${tone(row.w9_status)}`}>
                W9 {row.w9_status}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${tone(row.capability_statement_status)}`}>
                Capability {row.capability_statement_status}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${tone(row.insurance_status)}`}>
                Insurance {row.insurance_status ?? "needs review"}
              </span>
            </div>

            {row.notes ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{row.notes}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value || "Not listed"}</p>
    </div>
  );
}
