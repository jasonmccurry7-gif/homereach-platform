import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import {
  ADMIN_EXECUTIVE_LAYER,
  COMMAND_CENTER_EXPANSION_FREEZE,
  CONTRACT_WORKFLOW_GOVERNANCE,
  DEPLOYMENT_GOVERNANCE,
} from "@/lib/admin/admin-operating-model";

export function AdminOperatingModelStrip() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Admin operating model</p>
          </div>
          <h2 className="mt-2 text-xl font-black text-slate-950">{ADMIN_EXECUTIVE_LAYER.name} is the canonical admin home.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{ADMIN_EXECUTIVE_LAYER.role}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 lg:max-w-md">
          <p className="font-black">Contract workflow ownership</p>
          <p className="mt-1 leading-6">{CONTRACT_WORKFLOW_GOVERNANCE.rule}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
          <p className="font-black">Deployment truth</p>
          <p className="mt-1 leading-6">{DEPLOYMENT_GOVERNANCE.rule}</p>
          <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-blue-700">
            Authoritative: {DEPLOYMENT_GOVERNANCE.authoritativeVercelConfig}
          </p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">
          <p className="font-black">Command-center freeze is {COMMAND_CENTER_EXPANSION_FREEZE.status}</p>
          <p className="mt-1 leading-6">{COMMAND_CENTER_EXPANSION_FREEZE.rule}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {ADMIN_EXECUTIVE_LAYER.modules.slice(0, 8).map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="group rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-blue-50"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-black text-slate-950">{module.label}</p>
              <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-blue-700" aria-hidden="true" />
            </div>
            <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{module.owner}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{module.role}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
