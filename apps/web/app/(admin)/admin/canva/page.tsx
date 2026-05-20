import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  FileImage,
  FolderKanban,
  LayoutTemplate,
  Palette,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { buildHomeReachCanvaOperatingModel } from "@/lib/canva/orchestrator";
import { HOMEREACH_CANVA_PROMPT_FRAMEWORKS } from "@/lib/canva/prompt-frameworks";

export const metadata = {
  title: "Canva Design OS - HomeReach Admin",
};

export default function AdminCanvaDesignOsPage({
  searchParams,
}: {
  searchParams?: { connected?: string; stored?: string; reason?: string };
}) {
  const model = buildHomeReachCanvaOperatingModel();
  const connected = searchParams?.connected === "1";
  const failed = searchParams?.connected === "0";

  return (
    <main className="mx-auto max-w-7xl space-y-8">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-white shadow-xl">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-blue-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
              <Palette className="h-4 w-4" />
              Canva Primary Design Engine
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight md:text-5xl">
              HomeReach visual operating system.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
              Canva becomes the editable visual execution layer for campaign decks, postcards, proposals,
              dashboard graphics, map reports, social assets, and brand systems. HomeReach keeps control of
              strategy, campaign records, quote locks, route logic, approvals, and production safety.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/api/admin/canva/oauth/start"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-500"
              >
                Connect Canva
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href="/api/admin/canva/status"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/15"
              >
                View API status
              </Link>
              <a
                href="https://www.canva.dev/docs/connect/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/15"
              >
                Canva Connect docs
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            {connected && (
              <div className="mt-5 rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-100">
                Canva OAuth returned successfully. Token persistence depends on the encrypted token storage migration and
                CANVA_TOKEN_ENCRYPTION_KEY.
              </div>
            )}
            {failed && (
              <div className="mt-5 rounded-lg border border-red-300/20 bg-red-400/10 p-4 text-sm font-semibold text-red-100">
                Canva OAuth did not complete. Reason: {searchParams?.reason ?? "unknown"}.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
              Integration status
            </p>
            <div className="mt-4 grid gap-3">
              <StatusRow label="Mode" value={model.status.mode.replaceAll("_", " ")} />
              <StatusRow label="OAuth redirect" value={model.status.oauthRedirectUri ?? "Not configured"} />
              <StatusRow
                label="Missing env"
                value={model.status.missingRequired.length ? model.status.missingRequired.join(", ") : "None"}
              />
              <StatusRow
                label="Template IDs"
                value={`${model.status.configuredTemplates.filter((template) => template.templateId).length}/${model.status.configuredTemplates.length} configured`}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {model.architecture.map((item, index) => (
          <div key={item} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              {index === 0 ? <ShieldCheck className="h-5 w-5" /> : index === 1 ? <Wand2 className="h-5 w-5" /> : index === 2 ? <Palette className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-700">{item}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Master Brand System" icon={Sparkles}>
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(model.brandSystem.colors).map(([name, color]) => (
              <div key={name} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="h-8 w-8 rounded-md border border-slate-200" style={{ backgroundColor: color }} />
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{name}</div>
                  <div className="text-sm font-bold text-slate-900">{color}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg bg-slate-950 p-4 text-sm leading-6 text-slate-200">
            {model.brandSystem.politicalStandards.join(" ")}
          </div>
        </Panel>

        <Panel title="Canva Template Registry" icon={LayoutTemplate}>
          <div className="space-y-3">
            {model.templates.map((template) => {
              const templateId = model.status.configuredTemplates.find((item) => item.key === template.key)?.templateId;
              return (
                <div key={template.key} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="font-black text-slate-950">{template.label}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{template.description}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${templateId ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {templateId ? "Template linked" : "Needs template ID"}
                    </span>
                  </div>
                  <div className="mt-3 text-xs font-semibold text-slate-500">
                    Env: <span className="font-black text-slate-700">{template.envVar}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="Canva Folder Structure" icon={FolderKanban}>
          <div className="space-y-2">
            {model.folders.map((folder) => (
              <div key={folder.path} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="font-black text-slate-950">{folder.path}</div>
                <p className="mt-1 text-sm leading-5 text-slate-600">{folder.purpose}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="AI Design Prompt Frameworks" icon={FileImage}>
          <div className="space-y-3">
            {HOMEREACH_CANVA_PROMPT_FRAMEWORKS.map((framework) => (
              <div key={framework.key} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">{framework.useCase}</div>
                <h3 className="mt-1 font-black text-slate-950">{framework.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{framework.prompt}</p>
                <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  Guardrails: {framework.complianceNotes.join(" ")}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </main>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-black text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-bold text-white">{value}</div>
    </div>
  );
}
