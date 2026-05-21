"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clipboard,
  Copy,
  ExternalLink,
  FileText,
  Flag,
  Mail,
  Map,
  MessageSquare,
  MonitorCheck,
  Phone,
  Printer,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  Text,
  Workflow,
} from "lucide-react";
import type {
  CampaignOutreachTarget,
  OutreachDraft,
  OutreachPriorityTier,
  PoliticalOutreachCommandData,
} from "@/lib/political/outreach-strategy-command";
import { cn } from "@/lib/utils";

interface PoliticalOutreachStrategyCommandProps {
  data: PoliticalOutreachCommandData;
}

const tierOrder: OutreachPriorityTier[] = ["tier-1", "tier-2", "tier-3", "tier-4"];
const tierLabels: Record<OutreachPriorityTier, string> = {
  "tier-1": "Tier 1 - Immediate Outreach",
  "tier-2": "Tier 2 - High Value",
  "tier-3": "Tier 3 - Relationship Building",
  "tier-4": "Tier 4 - Monitor",
};
const tierTone: Record<OutreachPriorityTier, string> = {
  "tier-1": "border-red-300/35 bg-red-950/35 text-red-100",
  "tier-2": "border-amber-300/35 bg-amber-950/35 text-amber-100",
  "tier-3": "border-blue-300/30 bg-blue-950/35 text-blue-100",
  "tier-4": "border-slate-300/20 bg-slate-900/60 text-slate-100",
};

const mockupPalette = {
  blue: "from-blue-800 via-slate-950 to-red-800",
  red: "from-red-800 via-slate-950 to-blue-900",
  neutral: "from-slate-800 via-zinc-950 to-red-900",
} as const;

export function PoliticalOutreachStrategyCommand({ data }: PoliticalOutreachStrategyCommandProps) {
  const [selectedId, setSelectedId] = useState(data.targets[0]?.id ?? "");
  const [tierFilter, setTierFilter] = useState<OutreachPriorityTier | "all">("all");
  const [draftKey, setDraftKey] = useState(data.targets[0]?.drafts[0]?.key ?? "initialEmail");
  const [mockupSide, setMockupSide] = useState<"front" | "back">("front");
  const [notice, setNotice] = useState("");

  const selected = useMemo(
    () => data.targets.find((target) => target.id === selectedId) ?? data.targets[0],
    [data.targets, selectedId],
  );

  const activeDraft = useMemo(
    () => selected?.drafts.find((draft) => draft.key === draftKey) ?? selected?.drafts[0],
    [draftKey, selected],
  );

  const [editableDraft, setEditableDraft] = useState(activeDraft?.body ?? "");

  useEffect(() => {
    setEditableDraft(activeDraft?.body ?? "");
  }, [activeDraft?.body, selected?.id]);

  const filteredTargets = useMemo(
    () =>
      data.targets.filter((target) =>
        tierFilter === "all" ? true : target.priorityTier === tierFilter,
      ),
    [data.targets, tierFilter],
  );

  if (!selected || !activeDraft) {
    return (
      <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.04] p-8 text-center text-sm text-slate-300">
        No political outreach targets are available yet.
      </div>
    );
  }

  const selectedTarget = selected;
  const selectedMockup = selectedTarget.mockups[0];
  const emailHref = buildMailto(selected, activeDraft, editableDraft);
  const smsHref = buildSms(selected, selected.drafts.find((draft) => draft.key === "sms")?.body ?? editableDraft);

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch {
      setNotice(`Copy failed for ${label}. Select the text and copy manually.`);
    }
  }

  function copyPackageSummary() {
    const option = selectedTarget.optionPackages[0];
    const payload = [
      `${selectedTarget.name} - ${selectedTarget.race}`,
      `Best method: ${selectedTarget.recommendedOutreachMethod}`,
      `Option: ${option?.optionName ?? selectedTarget.assignedCampaignOption}`,
      `Coverage: ${selectedTarget.mapPackage.counties.join(", ")}`,
      `Mockups: ${selectedTarget.mockups.map((mockup) => mockup.type).join(", ")}`,
      `Next action: ${selectedTarget.strategy.bestFollowUpMethod}`,
    ].join("\n");
    void copyText("Outreach package summary", payload);
  }

  return (
    <section className="space-y-5 text-slate-100">
      <header className="overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(127,29,29,0.52),rgba(15,23,42,0.9)_42%,rgba(30,64,175,0.44))] p-5 shadow-2xl shadow-slate-950/40">
        <div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-100">
              Political Outreach Strategy
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-5xl">
              Political Outreach Command Center
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-200">
              Prioritized targets, campaign strategy, outreach drafts, execution actions, maps,
              proposal packages, creative mockups, follow-up cadence, and pipeline visibility.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/admin/political/candidate-agent" label="Campaign Agents" icon={<Sparkles className="h-4 w-4" />} />
            <LinkButton href="/admin/political/maps" label="Ohio Maps" icon={<Map className="h-4 w-4" />} />
            <LinkButton href="/admin/canva" label="Canva Design OS" icon={<MonitorCheck className="h-4 w-4" />} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {data.metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-white/10 bg-white/[0.08] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">
                {metric.label}
              </p>
              <p className="mt-2 text-2xl font-black text-white">{metric.value}</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">{metric.detail}</p>
            </div>
          ))}
        </div>
      </header>

      {notice && (
        <div className="rounded-lg border border-emerald-300/25 bg-emerald-950/35 px-4 py-3 text-sm font-semibold text-emerald-100">
          {notice}
        </div>
      )}

      <ComplianceStrip items={data.complianceGuardrails} />

      <div className="grid gap-4 2xl:grid-cols-[360px_minmax(0,1fr)_430px]">
        <aside className="space-y-4">
          <Panel eyebrow="Targets" title="Campaign Targets" icon={<Target className="h-5 w-5" />}>
            <div className="flex flex-wrap gap-2">
              <FilterButton active={tierFilter === "all"} onClick={() => setTierFilter("all")}>
                All
              </FilterButton>
              {tierOrder.map((tier) => (
                <FilterButton key={tier} active={tierFilter === tier} onClick={() => setTierFilter(tier)}>
                  {tier.replace("tier-", "T")}
                </FilterButton>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {filteredTargets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(target.id);
                    setDraftKey(target.drafts[0]?.key ?? "initialEmail");
                    setMockupSide("front");
                  }}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition",
                    selected.id === target.id
                      ? "border-white bg-white text-slate-950 shadow-xl"
                      : "border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{target.name}</p>
                      <p className={cn("mt-1 text-xs", selected.id === target.id ? "text-slate-600" : "text-slate-400")}>
                        {target.race}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-950 px-2 py-1 text-xs font-black text-white">
                      {target.opportunityScore}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Mini label="Party" value={target.party} active={selected.id === target.id} />
                    <Mini label="Value" value={target.estimatedOpportunityValue} active={selected.id === target.id} />
                    <Mini label="Method" value={target.recommendedOutreachMethod} active={selected.id === target.id} />
                    <Mini label="Follow-up" value={target.followUpStatus} active={selected.id === target.id} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide", tierTone[target.priorityTier])}>
                      {tierLabels[target.priorityTier]}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold">
                      {target.raceType}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </aside>

        <main className="space-y-4">
          <Panel eyebrow="Strategy" title={selected.name} icon={<Flag className="h-5 w-5" />}>
            <div className="grid gap-3 md:grid-cols-3">
              <InfoTile label="Office/Race" value={selected.race} />
              <InfoTile label="Geography" value={selected.geography} />
              <InfoTile label="Assigned Agent" value={selected.assignedAgent} />
              <InfoTile label="Campaign Status" value={selected.campaignStatus} />
              <InfoTile label="Outreach Status" value={selected.outreachStatus} />
              <InfoTile label="Next Follow-Up" value={selected.nextFollowUp} />
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <StrategyBlock title="Why this campaign matters" body={selected.strategy.whyItMatters} />
              <StrategyBlock title="Ideal HomeReach positioning" body={selected.strategy.idealHomeReachPositioning} />
              <StrategyBlock title="Geographic strategy" body={selected.strategy.geographicStrategy} />
              <StrategyBlock title="Campaign style" body={selected.strategy.campaignStyle} />
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <ListBlock title="Likely pain points" items={selected.strategy.likelyPainPoints} />
              <ListBlock title="Recommended postcard concepts" items={selected.strategy.recommendedPostcardConcepts.slice(0, 5)} />
            </div>
          </Panel>

          <Panel eyebrow="Drafts" title="Ready-to-Send Outreach Drafts" icon={<MessageSquare className="h-5 w-5" />}>
            <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {selected.drafts.map((draft) => (
                <button
                  key={draft.key}
                  type="button"
                  onClick={() => setDraftKey(draft.key)}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition",
                    activeDraft.key === draft.key
                      ? "bg-white text-slate-950"
                      : "border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]",
                  )}
                >
                  {draft.label}
                </button>
              ))}
            </div>

            <label className="mt-3 block">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Editable draft
              </span>
              <textarea
                value={editableDraft}
                onChange={(event) => setEditableDraft(event.target.value)}
                rows={8}
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm leading-6 text-white outline-none transition focus:border-blue-300/60"
              />
            </label>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <CopyButton label="Copy" onClick={() => void copyText(activeDraft.label, editableDraft)} icon={<Copy className="h-4 w-4" />} />
              <CopyButton label="Quick Copy" onClick={() => void copyText("Quick version", activeDraft.shortVersion)} icon={<Clipboard className="h-4 w-4" />} />
              <CopyButton label="Copy Without Formatting" onClick={() => void copyText("Plain text", stripFormatting(editableDraft))} icon={<Text className="h-4 w-4" />} />
              <CopyButton label="Copy Short Version" onClick={() => void copyText("Short version", activeDraft.shortVersion)} icon={<Copy className="h-4 w-4" />} />
              <CopyButton label="Copy Long Version" onClick={() => void copyText("Long version", activeDraft.longVersion)} icon={<FileText className="h-4 w-4" />} />
              <CopyAndOpenButton draft={activeDraft} selected={selected} copyText={copyText} />
            </div>
          </Panel>

          <Panel eyebrow="Execution" title="One-Click Outreach Layer" icon={<Send className="h-5 w-5" />}>
            <div className="grid gap-3 xl:grid-cols-2">
              <ExecutionGroup title="Email system">
                <ActionAnchor href={emailHref} label="One-Click Email" icon={<Mail className="h-4 w-4" />} disabled={!selected.contact.email} />
                <ActionAnchor href={emailHref} label="Send Now" icon={<Send className="h-4 w-4" />} disabled={!selected.contact.email} />
                <ActionButton label="Save Draft" icon={<FileText className="h-4 w-4" />} onClick={() => void copyText("Email draft", editableDraft)} />
                <ActionButton label="Preview Email" icon={<MonitorCheck className="h-4 w-4" />} onClick={() => setNotice("Email preview is the editable draft above. Provider send stays manual until approved.")} />
                <ActionButton label="Edit Before Send" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setNotice("Edit mode is active in the draft box. No message has been sent.")} />
              </ExecutionGroup>

              <ExecutionGroup title="Text system">
                <ActionAnchor href={smsHref} label="One-Click Text" icon={<MessageSquare className="h-4 w-4" />} disabled={!selected.contact.phone} />
                <ActionAnchor href={smsHref} label="Send Text" icon={<Send className="h-4 w-4" />} disabled={!selected.contact.phone} />
                <ActionButton label="Edit Text" icon={<RotateCcw className="h-4 w-4" />} onClick={() => {
                  setDraftKey("sms");
                  setNotice("SMS draft selected for editing.");
                }} />
                <ActionButton label="Copy Text" icon={<Copy className="h-4 w-4" />} onClick={() => void copyText("SMS draft", selected.drafts.find((draft) => draft.key === "sms")?.body ?? editableDraft)} />
                <ActionButton label="Save Template" icon={<FileText className="h-4 w-4" />} onClick={() => void copyText("SMS template", selected.drafts.find((draft) => draft.key === "sms")?.body ?? editableDraft)} />
              </ExecutionGroup>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <ActionButton label="Copy Facebook DM" icon={<Copy className="h-4 w-4" />} onClick={() => void copyDraftByKey(selected, "shortFacebookDm", copyText)} />
              <ActionButton label="Copy LinkedIn Message" icon={<Copy className="h-4 w-4" />} onClick={() => void copyDraftByKey(selected, "linkedInMessage", copyText)} />
              <ActionButton label="Copy Website Form Message" icon={<Copy className="h-4 w-4" />} onClick={() => void copyDraftByKey(selected, "websiteForm", copyText)} />
              <ActionAnchor href={selected.contact.website} label="Open Campaign Website" icon={<ExternalLink className="h-4 w-4" />} disabled={!selected.contact.website} />
              <ActionAnchor href={selected.contact.facebook} label="Open Facebook Page" icon={<ExternalLink className="h-4 w-4" />} disabled={!selected.contact.facebook} />
              <ActionAnchor href={selected.contact.instagram} label="Open Instagram" icon={<ExternalLink className="h-4 w-4" />} disabled={!selected.contact.instagram} />
              <ActionAnchor href={selected.contact.xTwitter} label="Open X/Twitter" icon={<ExternalLink className="h-4 w-4" />} disabled={!selected.contact.xTwitter} />
              <ActionAnchor href={selected.contact.linkedIn} label="Open LinkedIn" icon={<ExternalLink className="h-4 w-4" />} disabled={!selected.contact.linkedIn} />
              <ActionAnchor href={selected.contact.phone ? `tel:${selected.contact.phone}` : null} label="Call Campaign" icon={<Phone className="h-4 w-4" />} disabled={!selected.contact.phone} />
              <ActionButton label="Log Outreach" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => void copyText("Outreach log template", buildLogTemplate(selected, activeDraft))} />
              <ActionButton label="Schedule Follow-Up" icon={<CalendarClock className="h-4 w-4" />} onClick={() => void copyText("Follow-up schedule", selected.cadence.map(formatCadence).join("\n"))} />
              <ActionButton label="Copy Package Summary" icon={<PackageIcon />} onClick={copyPackageSummary} />
            </div>
          </Panel>
        </main>

        <aside className="space-y-4">
          <Panel eyebrow="Packages" title="Campaign Option Package" icon={<Workflow className="h-5 w-5" />}>
            <div className="space-y-3">
              {selected.optionPackages.map((option) => (
                <div key={option.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-white">{option.optionName}</h3>
                      <p className="mt-1 text-xs text-slate-400">{option.deploymentSchedule}</p>
                    </div>
                    <span className="rounded-full border border-amber-300/25 bg-amber-950/35 px-2 py-1 text-xs font-black text-amber-100">
                      {option.estimatedCost}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <InfoTile label="Reach" value={option.voterReach} compact />
                    <InfoTile label="Households" value={option.householdReach} compact />
                    <InfoTile label="Drops" value={String(option.drops)} compact />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{option.strategicRationale}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="Map" title={selected.mapPackage.title} icon={<Map className="h-5 w-5" />}>
            <OhioMapCard target={selected} />
          </Panel>

          <Panel eyebrow="Creative" title="Campaign Creative Mockup Engine" icon={<Printer className="h-5 w-5" />}>
            {selectedMockup && (
              <>
                <div className="flex flex-wrap gap-2">
                  <FilterButton active={mockupSide === "front"} onClick={() => setMockupSide("front")}>
                    Front
                  </FilterButton>
                  <FilterButton active={mockupSide === "back"} onClick={() => setMockupSide("back")}>
                    Back
                  </FilterButton>
                </div>
                <PostcardPreview mockup={selectedMockup} side={mockupSide} />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <LinkButton href="/admin/canva" label="Open in Canva" icon={<ExternalLink className="h-4 w-4" />} />
                  <ActionButton label="Open in Figma" icon={<ExternalLink className="h-4 w-4" />} onClick={() => setNotice("Figma handoff spec is ready; connect Figma to export editable components.")} />
                  <ActionButton label="Export PNG" icon={<Printer className="h-4 w-4" />} onClick={() => setNotice("PNG export queued as a local mockup action. Use Canva/Figma for layered export.")} />
                  <ActionButton label="Export PDF" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()} />
                  <ActionButton label="Duplicate Variation" icon={<Copy className="h-4 w-4" />} onClick={() => setNotice("Variation duplicated locally for review. Persistent save requires approval workflow wiring.")} />
                  <ActionButton label="Comments" icon={<MessageSquare className="h-4 w-4" />} onClick={() => setNotice("Comment prompt copied into the creative review queue.")} />
                  <ActionButton label="Approval Workflow" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setNotice("Approval workflow stays staged until a production campaign is selected.")} />
                  <ActionButton label="Version History" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setNotice("Version history panel ready for persisted creative records.")} />
                </div>
              </>
            )}
          </Panel>
        </aside>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr_0.9fr]">
        <Panel eyebrow="Cadence" title="Follow-Up Cadence Engine" icon={<CalendarClock className="h-5 w-5" />}>
          <div className="space-y-3">
            {selected.cadence.map((step) => (
              <div key={`${step.day}-${step.method}`} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-white">{step.day}: {step.method}</p>
                  <span className="rounded-full border border-white/10 bg-slate-950/60 px-2 py-1 text-[11px] font-black uppercase text-slate-300">
                    {step.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-300">{step.timing} / {step.tone}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Attach: {step.attachments.join(", ")} / CTA: {step.cta}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="Timeline" title="Outreach Timeline View" icon={<Workflow className="h-5 w-5" />}>
          <div className="space-y-3">
            {selected.timeline.map((item) => (
              <div key={`${item.label}-${item.date}`} className="grid grid-cols-[auto_1fr] gap-3">
                <div className="mt-1 h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.8)]" />
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-sm font-black text-white">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.date} / {item.status}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="Intelligence" title="Smart Recommendations" icon={<Sparkles className="h-5 w-5" />}>
          <ListBlock title="Today" items={selected.recommendations} />
          <div className="mt-4 rounded-lg border border-blue-300/20 bg-blue-950/35 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-100">
              Response Intelligence
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{selected.responseIntelligence.summary}</p>
            <p className="mt-3 text-sm font-bold text-white">{selected.responseIntelligence.nextAction}</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">{selected.responseIntelligence.suggestedReply}</p>
          </div>
        </Panel>
      </section>

      <Panel eyebrow="Executive" title="Command View: Pipeline, History, Follow-Up Queue" icon={<Clipboard className="h-5 w-5" />}>
        <div className="grid gap-4 lg:grid-cols-3">
          <ListBlock title="Top campaigns to contact today" items={data.targets.filter((target) => target.priorityTier === "tier-1").slice(0, 5).map((target) => `${target.name} - ${target.recommendedOutreachMethod}`)} />
          <ListBlock title="Highest value opportunities" items={data.targets.slice(0, 5).map((target) => `${target.name} - ${target.estimatedOpportunityValue}`)} />
          <ListBlock title="System recommendations" items={data.smartRecommendations} />
        </div>
      </Panel>
    </section>
  );
}

function Panel({
  eyebrow,
  title,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-950/58 p-4 shadow-xl shadow-slate-950/30">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-white">{title}</h2>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-blue-100">{icon}</div>
      </div>
      {children}
    </section>
  );
}

function ComplianceStrip({ items }: { items: string[] }) {
  return (
    <div className="rounded-xl border border-emerald-300/20 bg-emerald-950/25 p-4 text-sm leading-6 text-emerald-50">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">
        Compliance Guardrails
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-2 text-xs font-black transition",
        active ? "bg-white text-slate-950" : "border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]",
      )}
    >
      {children}
    </button>
  );
}

function InfoTile({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-lg border border-white/10 bg-white/[0.04]", compact ? "p-2" : "p-3")}>
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("mt-1 font-bold text-white", compact ? "text-xs" : "text-sm")} title={value}>
        {value}
      </p>
    </div>
  );
}

function Mini({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className={cn("rounded border px-2 py-1", active ? "border-slate-300 bg-slate-100" : "border-white/10 bg-slate-950/60")}>
      <p className={cn("text-[9px] font-black uppercase", active ? "text-slate-500" : "text-slate-500")}>{label}</p>
      <p className={cn("mt-0.5 truncate font-semibold", active ? "text-slate-900" : "text-slate-200")} title={value}>
        {value}
      </p>
    </div>
  );
}

function StrategyBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{body}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-200" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExecutionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function CopyButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return <ActionButton label={label} onClick={onClick} icon={icon} />;
}

function ActionButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-100 transition hover:bg-white/10"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ActionAnchor({
  href,
  label,
  icon,
  disabled,
}: {
  href: string | null;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  if (disabled || !href) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex min-h-10 cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/8 bg-slate-900/70 px-3 py-2 text-xs font-bold text-slate-500"
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  }
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-100 transition hover:bg-white/10"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

function LinkButton({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.08] px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function CopyAndOpenButton({
  draft,
  selected,
  copyText,
}: {
  draft: OutreachDraft;
  selected: CampaignOutreachTarget;
  copyText: (label: string, value: string) => Promise<void>;
}) {
  const href =
    draft.key === "linkedInMessage"
      ? selected.contact.linkedIn
      : draft.key === "websiteForm"
        ? selected.contact.website
        : selected.contact.facebook;
  const handleClick = () => {
    void copyText(draft.label, draft.body).then(() => {
      if (href) window.open(href, "_blank", "noopener,noreferrer");
    });
  };
  if (!href) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex min-h-10 cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/8 bg-slate-900/70 px-3 py-2 text-xs font-bold text-slate-500"
      >
        <ExternalLink className="h-4 w-4" />
        <span>Copy + Open Platform</span>
      </button>
    );
  }
  return (
    <ActionButton
      label="Copy + Open Platform"
      icon={<ExternalLink className="h-4 w-4" />}
      onClick={handleClick}
    />
  );
}

function OhioMapCard({ target }: { target: CampaignOutreachTarget }) {
  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_25%_20%,rgba(248,250,252,0.16),transparent_20%),linear-gradient(145deg,rgba(30,64,175,0.7),rgba(127,29,29,0.68))] p-4">
        <div className="mx-auto flex aspect-[4/5] max-h-72 w-full max-w-64 items-center justify-center rounded-[42%_58%_47%_53%/38%_46%_54%_62%] border border-white/25 bg-slate-950/62 shadow-2xl shadow-slate-950/50">
          <div className="text-center">
            <p className="text-5xl font-black tracking-tight text-white">OH</p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.22em] text-amber-100">coverage</p>
          </div>
        </div>
        <div className="absolute left-5 top-5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-black text-white">
          {target.mapPackage.counties[0] ?? "Ohio"}
        </div>
        <div className="absolute bottom-5 right-5 rounded-full border border-amber-200/40 bg-amber-300/20 px-3 py-1 text-xs font-black text-amber-50">
          route-ready
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        <ChipList label="Counties" items={target.mapPackage.counties} />
        <ChipList label="Cities" items={target.mapPackage.cities} />
        <ChipList label="Districts" items={target.mapPackage.districts} />
        <ChipList label="Routes" items={target.mapPackage.routes} />
      </div>
    </div>
  );
}

function ChipList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] font-semibold text-slate-200">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function PostcardPreview({
  mockup,
  side,
}: {
  mockup: CampaignOutreachTarget["mockups"][number];
  side: "front" | "back";
}) {
  return (
    <div className="mt-3">
      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
        <div className={cn("aspect-[1.68/1] overflow-hidden rounded-lg border border-white/20 bg-gradient-to-br p-4 shadow-2xl", mockupPalette[mockup.palette])}>
          {side === "front" ? (
            <div className="flex h-full flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100">
                  {mockup.type}
                </p>
                <h3 className="mt-3 max-w-[80%] text-2xl font-black leading-tight text-white">
                  {mockup.frontHeadline}
                </h3>
                <p className="mt-2 max-w-[72%] text-xs leading-5 text-slate-100">
                  {mockup.frontSubheadline}
                </p>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="rounded bg-white px-3 py-2 text-xs font-black text-slate-950">
                  {mockup.cta}
                </div>
                <div className="h-16 w-16 rounded-full border border-white/30 bg-white/15" />
              </div>
            </div>
          ) : (
            <div className="grid h-full grid-cols-[1fr_0.45fr] gap-4 bg-white/95 p-3 text-slate-950">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Message side
                  </p>
                  <p className="mt-3 text-sm font-bold leading-5">{mockup.backBody}</p>
                </div>
                <p className="text-[10px] text-slate-500">
                  Paid for by [Committee Name]. Final disclaimer and approvals required before print.
                </p>
              </div>
              <div className="border-l border-slate-300 pl-3">
                <div className="h-9 rounded border border-slate-400 text-center text-[9px] font-bold leading-9 text-slate-500">
                  INDICIA
                </div>
                <div className="mt-5 space-y-2">
                  <div className="h-2 rounded bg-slate-300" />
                  <div className="h-2 rounded bg-slate-300" />
                  <div className="h-2 w-2/3 rounded bg-slate-300" />
                </div>
                <div className="mt-8 h-14 rounded border border-dashed border-slate-400 text-center text-[10px] font-bold leading-[3.5rem] text-slate-400">
                  USPS SAFE ZONE
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
        <InfoTile label="Emotional Strategy" value={mockup.emotionalStrategy} compact />
        <InfoTile label="Target Geography" value={mockup.targetGeography} compact />
        <InfoTile label="Deployment Timing" value={mockup.deploymentTiming} compact />
        <InfoTile label="Campaign Phase" value={mockup.campaignPhase} compact />
      </div>
    </div>
  );
}

function copyDraftByKey(
  selected: CampaignOutreachTarget,
  key: OutreachDraft["key"],
  copyText: (label: string, value: string) => Promise<void>,
) {
  const draft = selected.drafts.find((item) => item.key === key);
  if (!draft) return Promise.resolve();
  return copyText(draft.label, draft.body);
}

function buildMailto(selected: CampaignOutreachTarget, draft: OutreachDraft, body: string) {
  if (!selected.contact.email) return null;
  const subject = encodeURIComponent(draft.subject ?? `${selected.name} outreach`);
  const encodedBody = encodeURIComponent(body);
  return `mailto:${selected.contact.email}?subject=${subject}&body=${encodedBody}`;
}

function buildSms(selected: CampaignOutreachTarget, body: string) {
  if (!selected.contact.phone) return null;
  return `sms:${selected.contact.phone}?&body=${encodeURIComponent(body)}`;
}

function stripFormatting(value: string) {
  return value.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function buildLogTemplate(selected: CampaignOutreachTarget, draft: OutreachDraft) {
  return [
    `Campaign: ${selected.name}`,
    `Method: ${draft.channel}`,
    `Draft: ${draft.label}`,
    `Visuals attached: ${selected.strategy.recommendedVisualPackage}`,
    `Map attached: ${selected.mapPackage.title}`,
    `Mockups attached: ${selected.mockups.map((mockup) => mockup.type).join(", ")}`,
    `Outcome: `,
    `Next follow-up: ${selected.strategy.bestFollowUpMethod}`,
  ].join("\n");
}

function formatCadence(step: CampaignOutreachTarget["cadence"][number]) {
  return `${step.day}: ${step.method} at ${step.timing} - ${step.tone} - attach ${step.attachments.join(", ")} - CTA: ${step.cta}`;
}

function PackageIcon() {
  return <Clipboard className="h-4 w-4" />;
}
