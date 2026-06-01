"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  Clipboard,
  Download,
  Film,
  FlaskConical,
  Library,
  Palette,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Wand2,
  XCircle,
} from "lucide-react";
import {
  creativeAssetTypes,
  creativeBrandVoices,
  creativeOfferTemplates,
  creativePlatforms,
  labelForAssetType,
  labelForBrandVoice,
  labelForPlatform,
} from "@/lib/creative-studio/templates";
import type {
  CreativeAssetType,
  CreativeBrandVoice,
  CreativeGenerationInput,
  CreativeOfferKey,
  CreativePlatform,
  CreativeStudioAsset,
  CreativeStudioCommandCenterData,
} from "@/lib/creative-studio/types";
import { cn } from "@/lib/utils";

type TabKey = "generate" | "review" | "approved" | "winners" | "brand_kits" | "prompts";

const tabs: Array<{ key: TabKey; label: string; icon: typeof Wand2 }> = [
  { key: "generate", label: "Generate New Creative", icon: Wand2 },
  { key: "review", label: "Review Creative", icon: ShieldCheck },
  { key: "approved", label: "Approved Assets", icon: BadgeCheck },
  { key: "winners", label: "Winning Templates", icon: Star },
  { key: "brand_kits", label: "Brand Kits", icon: Palette },
  { key: "prompts", label: "Prompt Library", icon: BookOpen },
];

const defaultInput: CreativeGenerationInput = {
  campaignId: null,
  businessId: null,
  candidateId: null,
  offerKey: "procurement_dashboard",
  assetType: "30_second_ugc_ad",
  platform: "facebook",
  brandVoice: "procurement_margin_protection",
  brandKitId: "seed-brand-procurement",
  audience: "local business owners with recurring supply spend",
  localMarket: "",
  painPoint: "rising supplier costs and no clear spend visibility",
  campaignGoal: "get a free supply cost review request",
  language: "English",
  variationCount: 3,
  advancedPrompt: "",
};

export function CreativeStudioCommandCenter({ data }: { data: CreativeStudioCommandCenterData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("generate");
  const [form, setForm] = useState<CreativeGenerationInput>(defaultInput);
  const [assets, setAssets] = useState<CreativeStudioAsset[]>(data.assets);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reviewAssets = useMemo(
    () => assets.filter((asset) => asset.approvalStatus === "needs_review" || asset.status === "awaiting_review"),
    [assets],
  );
  const selectedBrandKitId = data.brandKits.some((kit) => kit.id === form.brandKitId) ? form.brandKitId ?? "" : "";
  const approvedAssets = useMemo(
    () => assets.filter((asset) => asset.approvalStatus === "approved" || asset.status === "approved"),
    [assets],
  );
  const winners = useMemo(() => assets.filter((asset) => asset.winningAsset), [assets]);

  function updateForm<K extends keyof CreativeGenerationInput>(key: K, value: CreativeGenerationInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function runAction(action: () => Promise<void>) {
    setNotice(null);
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Creative Studio action failed.");
      }
    });
  }

  async function generateCreative() {
    const payload = sanitizeGenerationInput(form);
    const response = await fetch("/api/admin/creative-studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", ...payload }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error ?? "Unable to generate creative.");
    setAssets((current) => [...(result.assets as CreativeStudioAsset[]), ...current]);
    setNotice(result.message ?? "Creative queued for review.");
    setActiveTab("review");
    router.refresh();
  }

  async function assetAction(assetId: string, action: string, notes?: string) {
    const response = await fetch("/api/admin/creative-studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, assetId, notes }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error ?? "Creative action failed.");
    if (result.asset) {
      setAssets((current) =>
        current.map((asset) => (asset.id === assetId ? (result.asset as CreativeStudioAsset) : asset)),
      );
    } else if (Array.isArray(result.assets)) {
      setAssets((current) => [...(result.assets as CreativeStudioAsset[]), ...current]);
    }
    setNotice(result.message ?? "Creative asset updated.");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-xl bg-slate-950 text-white shadow-xl">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
              <Sparkles className="h-4 w-4" />
              AI Creative Production Studio
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
              Generate, review, score, and reuse campaign creative from one approval-first studio.
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-slate-300 sm:text-base">
              Create scripts, storyboards, captions, image concepts, UGC ads, and provider-ready video prompts for
              shared postcards, targeted campaigns, political mail, procurement, government contracts, DMs, and social.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <HeroMetric label="Review Queue" value={reviewAssets.length.toString()} />
              <HeroMetric label="Approved Assets" value={approvedAssets.length.toString()} />
              <HeroMetric label="Winning Templates" value={winners.length.toString()} />
              <HeroMetric label="Provider" value={data.providerStatus.providerKey} />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <StatusRow
              label="Feature flag"
              value={data.featureEnabled ? "creative_studio_enabled active" : "creative_studio_enabled off"}
              ok={data.featureEnabled}
            />
            <StatusRow
              label="Schema"
              value={data.schemaReady ? "Database-backed library ready" : "Seed mode until migration is applied"}
              ok={data.schemaReady}
            />
            <StatusRow
              label="Provider"
              value={data.providerStatus.message}
              ok={data.providerStatus.configured}
            />
            <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-100" />
                <p className="text-xs font-semibold leading-5 text-amber-50">
                  Nothing generated here posts, sends, launches, submits, or attaches to paid ads without human approval.
                  Political assets also require compliance review.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {(notice || data.warnings.length > 0 || data.migrationHint) && (
        <div className="space-y-2">
          {notice ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
              {notice}
            </div>
          ) : null}
          {data.warnings.map((warning) => (
            <div key={warning} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {warning}
            </div>
          ))}
          {data.migrationHint ? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
              {data.migrationHint}
            </div>
          ) : null}
        </div>
      )}

      <nav className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Creative Studio tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-black transition",
                active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "generate" ? (
        <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Intake</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Generate New Creative</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  Pick the business context and creative type. Advanced AI settings stay tucked away.
                </p>
              </div>
              <Wand2 className="h-6 w-6 text-blue-700" />
            </div>

            <div className="mt-5 grid gap-4">
              <SelectField
                label="Offer"
                value={form.offerKey}
                onChange={(value) => {
                  const offerKey = value as CreativeOfferKey;
                  updateForm("offerKey", offerKey);
                  if (offerKey === "political_mail" || offerKey === "candidate_explainer") {
                    updateForm("brandVoice", "political_compliance_neutral");
                  } else if (offerKey === "procurement_dashboard") {
                    updateForm("brandVoice", "procurement_margin_protection");
                  }
                  updateForm("brandKitId", preferredBrandKitId(offerKey, data.brandKits));
                }}
                options={Object.entries(creativeOfferTemplates).map(([key, offer]) => ({
                  value: key,
                  label: offer.label,
                }))}
              />
              <SelectField
                label="Asset type"
                value={form.assetType}
                onChange={(value) => updateForm("assetType", value as CreativeAssetType)}
                options={creativeAssetTypes}
              />
              <SelectField
                label="Platform"
                value={form.platform}
                onChange={(value) => updateForm("platform", value as CreativePlatform)}
                options={creativePlatforms}
              />
              <SelectField
                label="Brand voice"
                value={form.brandVoice}
                onChange={(value) => updateForm("brandVoice", value as CreativeBrandVoice)}
                options={creativeBrandVoices.map((voice) => ({ value: voice.value, label: voice.label }))}
              />
              <SelectField
                label="Brand kit"
                value={selectedBrandKitId}
                onChange={(value) => updateForm("brandKitId", value || null)}
                options={[
                  { value: "", label: "Use default HomeReach kit" },
                  ...data.brandKits.map((kit) => ({ value: kit.id, label: kit.name })),
                ]}
              />
              <SelectField
                label="Campaign"
                value={form.campaignId ?? ""}
                onChange={(value) => updateForm("campaignId", value || null)}
                options={[
                  { value: "", label: "No campaign selected" },
                  ...data.references.campaigns.map((item) => ({ value: item.id, label: item.label })),
                ]}
              />
              <SelectField
                label="Business"
                value={form.businessId ?? ""}
                onChange={(value) => updateForm("businessId", value || null)}
                options={[
                  { value: "", label: "No business selected" },
                  ...data.references.businesses.map((item) => ({ value: item.id, label: item.label })),
                ]}
              />
              <SelectField
                label="Candidate"
                value={form.candidateId ?? ""}
                onChange={(value) => updateForm("candidateId", value || null)}
                options={[
                  { value: "", label: "No candidate selected" },
                  ...data.references.candidates.map((item) => ({ value: item.id, label: item.label })),
                ]}
              />

              <TextInput label="Audience" value={form.audience ?? ""} onChange={(value) => updateForm("audience", value)} />
              <TextInput label="Local market" value={form.localMarket ?? ""} onChange={(value) => updateForm("localMarket", value)} />
              <TextInput label="Pain point" value={form.painPoint ?? ""} onChange={(value) => updateForm("painPoint", value)} />
              <TextInput label="Campaign goal" value={form.campaignGoal ?? ""} onChange={(value) => updateForm("campaignGoal", value)} />

              <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-slate-800 [&::-webkit-details-marker]:hidden">
                  <Settings2 className="h-4 w-4" />
                  Advanced Settings
                </summary>
                <div className="mt-4 grid gap-4">
                  <SelectField
                    label="Variations"
                    value={String(form.variationCount ?? 1)}
                    onChange={(value) => updateForm("variationCount", Number(value))}
                    options={[
                      { value: "1", label: "1 variation" },
                      { value: "3", label: "3 variations" },
                      { value: "5", label: "5 variations" },
                      { value: "10", label: "10 variations" },
                    ]}
                  />
                  <TextInput label="Language" value={form.language ?? ""} onChange={(value) => updateForm("language", value)} />
                  <TextArea
                    label="Additional operator direction"
                    value={form.advancedPrompt ?? ""}
                    onChange={(value) => updateForm("advancedPrompt", value)}
                  />
                </div>
              </details>

              <button
                type="button"
                disabled={pending || !data.featureEnabled || !data.schemaReady}
                onClick={() => runAction(generateCreative)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/15 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className={cn("h-4 w-4", pending && "animate-pulse")} />
                Generate
              </button>
            </div>
          </div>

          <CreativePreview form={form} />
        </section>
      ) : null}

      {activeTab === "review" ? (
        <AssetGrid
          title="Review Creative"
          description="Every asset remains in review until a human approves, rejects, or requests revision."
          assets={reviewAssets}
          pending={pending}
          onAction={(assetId, action, notes) => runAction(() => assetAction(assetId, action, notes))}
        />
      ) : null}

      {activeTab === "approved" ? (
        <AssetGrid
          title="Approved Assets"
          description="Approved inside Creative Studio. Publishing, sending, paid usage, and political compliance still depend on destination workflows."
          assets={approvedAssets}
          pending={pending}
          onAction={(assetId, action, notes) => runAction(() => assetAction(assetId, action, notes))}
        />
      ) : null}

      {activeTab === "winners" ? (
        <AssetGrid
          title="Winning Templates"
          description="Reusable scripts, prompts, and styles marked as winners for future creative batches."
          assets={winners}
          pending={pending}
          onAction={(assetId, action, notes) => runAction(() => assetAction(assetId, action, notes))}
        />
      ) : null}

      {activeTab === "brand_kits" ? <BrandKits kits={data.brandKits} /> : null}
      {activeTab === "prompts" ? <PromptLibrary templates={data.promptTemplates} /> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <InfoPanel title="Reused Systems" items={data.reusedSystems} />
        <InfoPanel title="Safety Rules" items={data.safetyNotes} />
      </section>
    </main>
  );
}

function CreativePreview({ form }: { form: CreativeGenerationInput }) {
  const offer = creativeOfferTemplates[form.offerKey];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Draft Preview</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {offer.label}: {labelForAssetType(form.assetType)}
      </h2>
      <div className="mt-4 rounded-xl bg-slate-950 p-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black text-emerald-100">
            {labelForPlatform(form.platform)}
          </span>
          <Film className="h-5 w-5 text-blue-200" />
        </div>
        <p className="mt-5 text-xl font-black leading-tight">{offer.promise}</p>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
          Audience: {form.audience || offer.audience}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {["Script", "Scenes", "Quality Review"].map((label) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
              <p className="text-sm font-black">{label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Queued for human approval</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <PreviewRow label="Brand voice" value={labelForBrandVoice(form.brandVoice)} />
        <PreviewRow label="Pain point" value={form.painPoint || offer.painPoint} />
        <PreviewRow label="Goal" value={form.campaignGoal || "drive a review-ready next step"} />
        <PreviewRow label="Guardrails" value={offer.guardrails.join(" ")} />
      </div>
    </div>
  );
}

function AssetGrid({
  title,
  description,
  assets,
  pending,
  onAction,
}: {
  title: string;
  description: string;
  assets: CreativeStudioAsset[];
  pending: boolean;
  onAction: (assetId: string, action: string, notes?: string) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Library</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">{description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
          {assets.length} assets
        </span>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {assets.length ? (
          assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} pending={pending} onAction={onAction} />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <Library className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-lg font-black text-slate-950">No assets in this view yet.</p>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Generate a draft or move an asset through review to fill this queue.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function AssetCard({
  asset,
  pending,
  onAction,
}: {
  asset: CreativeStudioAsset;
  pending: boolean;
  onAction: (assetId: string, action: string, notes?: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const isPolitical = asset.offerKey === "political_mail" || asset.offerKey === "candidate_explainer";

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">
            {creativeOfferTemplates[asset.offerKey]?.label ?? asset.offerKey}
          </p>
          <h3 className="mt-1 break-words text-xl font-black text-slate-950">{labelForAssetType(asset.assetType)}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{labelForPlatform(asset.platform)}</p>
        </div>
        <QualityScore score={asset.qualityScore} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <StatusPill label="Status" value={asset.status} />
        <StatusPill label="Approval" value={asset.approvalStatus} />
        <StatusPill label="Compliance" value={asset.complianceReviewStatus} warn={isPolitical} />
      </div>

      <div className="mt-4 rounded-lg bg-white p-3 ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Script</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{asset.scriptUsed}</p>
      </div>

      <div className="mt-3 rounded-lg bg-white p-3 ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">AI quality review</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <ReviewList title="Strengths" items={asset.strengths} />
          <ReviewList title="Weaknesses" items={asset.weaknesses} />
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{asset.recommendedImprovement}</p>
      </div>

      <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer list-none text-sm font-black text-slate-800 [&::-webkit-details-marker]:hidden">
          Scene breakdown
        </summary>
        <div className="mt-3 space-y-2">
          {asset.storyboard.map((scene) => (
            <div key={scene.sceneNumber} className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-black text-slate-950">Scene {scene.sceneNumber}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{scene.visualDescription}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Overlay: {scene.textOverlay}</p>
            </div>
          ))}
        </div>
      </details>

      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Optional review note"
        className="mt-3 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <ActionButton
          label="Approve"
          icon={<CheckCircle2 className="h-4 w-4" />}
          disabled={pending}
          onClick={() => onAction(asset.id, "approve", notes)}
        />
        <ActionButton
          label="Needs Revision"
          icon={<RefreshCw className="h-4 w-4" />}
          disabled={pending}
          onClick={() => onAction(asset.id, "needs_revision", notes)}
          tone="amber"
        />
        <ActionButton
          label="Reject"
          icon={<XCircle className="h-4 w-4" />}
          disabled={pending}
          onClick={() => onAction(asset.id, "reject", notes)}
          tone="red"
        />
        <ActionButton
          label="Copy Caption"
          icon={<Clipboard className="h-4 w-4" />}
          disabled={pending}
          onClick={() => void navigator.clipboard?.writeText(asset.caption)}
          tone="slate"
        />
        <ActionButton
          label="Export"
          icon={<Download className="h-4 w-4" />}
          disabled={pending}
          onClick={() => downloadAsset(asset)}
          tone="slate"
        />
        <ActionButton
          label="Save to Campaign"
          icon={<Save className="h-4 w-4" />}
          disabled={pending}
          onClick={() => onAction(asset.id, "save_to_campaign", notes)}
          tone="slate"
        />
        <ActionButton
          label="Regenerate"
          icon={<FlaskConical className="h-4 w-4" />}
          disabled={pending}
          onClick={() => onAction(asset.id, "regenerate_variation", notes)}
          tone="blue"
        />
        <ActionButton
          label="Mark Winner"
          icon={<Star className="h-4 w-4" />}
          disabled={pending}
          onClick={() => onAction(asset.id, "mark_winner", notes)}
          tone="green"
        />
      </div>
    </article>
  );
}

function BrandKits({ kits }: { kits: CreativeStudioCommandCenterData["brandKits"] }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {kits.map((kit) => (
        <article key={kit.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">{kit.ownerType}</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">{kit.name}</h2>
            </div>
            <Palette className="h-6 w-6 text-blue-700" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {kit.colors.map((color) => (
              <span key={color} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
                <span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: color }} />
                {color}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{kit.tone}</p>
          <ReviewList title="CTA language" items={kit.ctaLanguage} />
          <ReviewList title="Forbidden claims" items={kit.forbiddenClaims} />
        </article>
      ))}
    </section>
  );
}

function PromptLibrary({ templates }: { templates: CreativeStudioCommandCenterData["promptTemplates"] }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {templates.map((template) => (
        <article key={template.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
            {creativeOfferTemplates[template.offerKey]?.label ?? template.offerKey}
          </p>
          <h2 className="mt-2 text-xl font-black text-slate-950">{template.name}</h2>
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">
            {template.promptText}
          </p>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Compliance notes</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{template.complianceNotes}</p>
        </article>
      ))}
    </section>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
      <p className="text-xl font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="border-b border-white/10 py-3 first:pt-0 last:border-0">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", ok ? "bg-emerald-400" : "bg-amber-400")} />
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      </div>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-200">{value}</p>
    </div>
  );
}

function StatusPill({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-lg px-3 py-2", warn ? "bg-amber-50 text-amber-800" : "bg-white text-slate-700")}>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xs font-black">{value.replaceAll("_", " ")}</p>
    </div>
  );
}

function QualityScore({ score }: { score: number }) {
  const tone = score >= 8 ? "bg-emerald-50 text-emerald-700" : score >= 6 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700";
  return (
    <div className={cn("rounded-xl px-3 py-2 text-center", tone)}>
      <p className="text-2xl font-black">{score}</p>
      <p className="text-[10px] font-black uppercase tracking-[0.12em]">Quality</p>
    </div>
  );
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.length ? items.map((item) => (
          <li key={item} className="text-sm font-semibold leading-5 text-slate-600">
            {item}
          </li>
        )) : (
          <li className="text-sm font-semibold text-slate-400">No items recorded yet.</li>
        )}
      </ul>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  tone = "green",
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "green" | "blue" | "amber" | "red" | "slate";
}) {
  const tones = {
    green: "bg-emerald-600 text-white hover:bg-emerald-500",
    blue: "bg-blue-600 text-white hover:bg-blue-500",
    amber: "bg-amber-500 text-slate-950 hover:bg-amber-400",
    red: "bg-red-600 text-white hover:bg-red-500",
    slate: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-100",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50",
        tones[tone],
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-5 text-slate-700">{value}</p>
    </div>
  );
}

function InfoPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 rounded-lg bg-slate-50 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-sm font-semibold leading-5 text-slate-600">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function sanitizeGenerationInput(input: CreativeGenerationInput): CreativeGenerationInput {
  return {
    ...input,
    campaignId: input.campaignId || null,
    businessId: input.businessId || null,
    candidateId: input.candidateId || null,
    brandKitId: input.brandKitId?.startsWith("seed-") ? null : input.brandKitId || null,
    audience: trimOptional(input.audience),
    localMarket: trimOptional(input.localMarket),
    painPoint: trimOptional(input.painPoint),
    campaignGoal: trimOptional(input.campaignGoal),
    language: trimOptional(input.language),
    advancedPrompt: trimOptional(input.advancedPrompt),
    variationCount: Number(input.variationCount ?? 1),
  };
}

function preferredBrandKitId(
  offerKey: CreativeOfferKey,
  kits: CreativeStudioCommandCenterData["brandKits"],
) {
  const ownerType =
    offerKey === "procurement_dashboard"
      ? "inventory_procurement"
      : offerKey === "political_mail" || offerKey === "candidate_explainer"
        ? "political_campaign"
        : offerKey === "government_contracts"
          ? "government_contracts"
          : "homereach";
  return kits.find((kit) => kit.ownerType === ownerType)?.id ?? null;
}

function trimOptional(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function downloadAsset(asset: CreativeStudioAsset) {
  const blob = new Blob([JSON.stringify(asset, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `homereach-creative-${asset.id}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
