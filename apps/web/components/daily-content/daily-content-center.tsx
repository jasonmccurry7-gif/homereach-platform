"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clipboard,
  Clapperboard,
  Download,
  ExternalLink,
  Film,
  Hash,
  Library,
  ListChecks,
  Megaphone,
  Pause,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Smartphone,
  Sparkles,
  TrendingUp,
  Wand2,
  XCircle,
} from "lucide-react";
import type { DailyContentSummary } from "@/lib/daily-content/repository";
import {
  buildBlueprintCopy,
  REVENUE_REEL_BLUEPRINT_VERSION,
  revenueReelBlueprints,
} from "@/lib/daily-content/revenue-reel-blueprints";
import type {
  DailyVideoContentRow,
  DailyVideoPlatform,
  DailyVideoPlatformPostRow,
  StoryboardScene,
} from "@/lib/daily-content/types";
import { cn } from "@/lib/utils";

const verticalLabels = {
  procurement: "Supplyfy",
  targeted_postcard: "HomeReach Targeted Mail",
  political: "Political",
} as const;

const platformLabels: Record<DailyVideoPlatform, string> = {
  facebook_reels: "Facebook",
  instagram_reels: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube_shorts: "YouTube",
};

const platformListFallback: DailyVideoPlatform[] = [
  "facebook_reels",
  "instagram_reels",
  "tiktok",
  "youtube_shorts",
];

const platformPublishLinks: Record<DailyVideoPlatform, string> = {
  facebook_reels: "https://www.facebook.com/reels/create",
  instagram_reels: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/upload",
  linkedin: "https://www.linkedin.com/feed/",
  youtube_shorts: "https://studio.youtube.com/",
};

const statusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  awaiting_approval: "bg-amber-50 text-amber-800",
  approved: "bg-emerald-50 text-emerald-700",
  scheduled: "bg-blue-50 text-blue-700",
  published: "bg-indigo-50 text-indigo-700",
  rejected: "bg-red-50 text-red-700",
  needs_revision: "bg-orange-50 text-orange-800",
  manual_publish_ready: "bg-cyan-50 text-cyan-700",
  failed: "bg-red-50 text-red-700",
};

export function DailyContentCenter({ summary }: { summary: DailyContentSummary }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(summary.videos[0]?.id ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => summary.videos.find((video) => video.id === selectedId) ?? summary.videos[0] ?? null,
    [selectedId, summary.videos],
  );

  const posts = useMemo(
    () => summary.platformPosts.filter((post) => post.video_id === selected?.id),
    [selected?.id, summary.platformPosts],
  );

  function refreshWith(action: () => Promise<void>) {
    setNotice(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Action failed");
      }
    });
  }

  function renderSelectedWithHiggsfield() {
    if (!selected) return;
    refreshWith(async () => {
      const res = await fetch(`/api/admin/daily-content/${selected.id}/higgsfield`, { method: "POST" });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? "Unable to render with the AI video provider");
      const result = payload.result as { dryRun?: boolean; fileUrl?: string | null; providerStatus?: string };
      setNotice(
        result.dryRun
          ? "AI b-roll render prompt prepared in dry-run mode."
          : result.fileUrl
            ? "AI b-roll MP4 attached. Watch it before approving."
            : `AI b-roll job ${result.providerStatus ?? "queued"}. Refresh shortly for the video URL.`,
      );
    });
  }

  function regenerateSelectedCreative(kind: "script" | "cta" | "visuals" | "voice") {
    if (!selected) return;
    refreshWith(async () => {
      const variation = `${selected.vertical}-${kind}-${Date.now()}`;
      const res = await fetch(
        `/api/admin/daily-content/generate?date=${summary.contentDate}&fresh=1&variation=${encodeURIComponent(variation)}`,
        { method: "POST" },
      );
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? `Unable to regenerate ${kind}`);
      const label = kind === "cta" ? "CTA" : kind.charAt(0).toUpperCase() + kind.slice(1);
      setNotice(`${label} regenerated. Review the new draft, then render fresh AI b-roll before approval.`);
    });
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-xl bg-slate-950 text-white shadow-xl">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-sky-100">
              <Clapperboard className="h-4 w-4" />
              AI Reel Command Center
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
              Two daily reels built to create comments, DMs, and booked conversations.
            </h1>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <HeroMetric label="Reels Today" value={summary.generatedCount.toString()} />
              <HeroMetric label="Awaiting Approval" value={summary.approvalCount.toString()} />
              <HeroMetric label="Comments" value={summary.totalComments.toString()} />
              <HeroMetric label="DMs Tracked" value={summary.totalDms.toString()} />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Today</p>
                <p className="mt-1 text-2xl font-black">{summary.contentDate}</p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  refreshWith(async () => {
                    const res = await fetch(`/api/admin/daily-content/generate?date=${summary.contentDate}&fresh=1&variation=${Date.now()}`, {
                      method: "POST",
                    });
                    const payload = await res.json();
                    if (!res.ok || !payload.ok) throw new Error(payload.error ?? "Unable to generate videos");
                    setNotice("Fresh reel draft previews generated. Pick a draft, then click Render AI b-roll to create the MP4.");
                  })
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-100 disabled:opacity-60"
              >
                <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
                Generate Fresh Drafts
              </button>
            </div>
            <div className="mt-5 space-y-2">
              {summary.readiness.map((item) => (
                <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black">{item.label}</span>
                    <span className={cn(
                      "rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
                      item.status === "Ready" ? "bg-emerald-400/15 text-emerald-100" : "bg-amber-400/15 text-amber-100",
                    )}>
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {notice && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {notice}
        </div>
      )}

      <section id="today-video-drafts" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-blue-800">
              <Film className="h-3.5 w-3.5" />
              Today&apos;s video drafts
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
              Pick a draft, then watch the preview below.
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              These are the two daily reel drafts. Use Generate Fresh Drafts to create new concepts for today. Use Render AI b-roll in the player to attach a new MP4 preview for the selected draft.
            </p>
          </div>
          <a
            href="#video-preview"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
          >
            <Play className="h-4 w-4" />
            Jump to player
          </a>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {summary.videos.map((video, index) => (
            <button
              type="button"
              key={video.id}
              onClick={() => {
                setSelectedId(video.id);
                window.requestAnimationFrame(() => {
                  document.getElementById("video-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
              className={cn(
                "rounded-xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                selected?.id === video.id ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">
                    Draft {index + 1} - {verticalLabels[video.vertical]}
                  </div>
                  <h3 className="mt-2 text-lg font-black text-slate-950">{video.title}</h3>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={video.status} />
                  {summary.intelligence[video.id] ? <PerformanceBadge intelligence={summary.intelligence[video.id]!} /> : null}
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{video.video_hook}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <MiniPill icon={<Play className="h-3.5 w-3.5" />} text="Preview this draft" />
                <MiniPill icon={<Film className="h-3.5 w-3.5" />} text="9:16" />
                <MiniPill icon={<ShieldCheck className="h-3.5 w-3.5" />} text="Approval" />
                <MiniPill icon={<Sparkles className="h-3.5 w-3.5" />} text="AI b-roll" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {summary.videos.length === 0 ? (
        <EmptyState pending={pending} onGenerate={() => refreshWith(async () => {
          const res = await fetch(`/api/admin/daily-content/generate?date=${summary.contentDate}&fresh=1&variation=${Date.now()}`, { method: "POST" });
          const payload = await res.json();
          if (!res.ok || !payload.ok) throw new Error(payload.error ?? "Unable to generate videos");
        })} />
      ) : selected ? (
        <section id="video-preview" className="scroll-mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <VideoDetail video={selected} pending={pending} onHiggsfield={renderSelectedWithHiggsfield} onAction={(action, body = {}) => refreshWith(async () => {
            const res = await fetch(`/api/admin/daily-content/${selected.id}/action`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action, ...body }),
            });
            const payload = await res.json();
            if (!res.ok || !payload.ok) throw new Error(payload.error ?? "Unable to update video");
            setNotice(`${selected.title} updated.`);
          })} />
          <PublishingPanel video={selected} posts={posts} pending={pending} onHiggsfield={renderSelectedWithHiggsfield} onRegenerateCreative={regenerateSelectedCreative} onCanva={() => refreshWith(async () => {
            const res = await fetch(`/api/admin/daily-content/${selected.id}/canva`, { method: "POST" });
            const payload = await res.json();
            if (!res.ok || !payload.ok) throw new Error(payload.error ?? "Unable to prepare Canva job");
            setNotice(payload.result?.dryRun ? "Canva job plan prepared in dry-run mode." : "Canva job submitted.");
          })} onPlatformAction={(postId, action, body = {}) => refreshWith(async () => {
            const res = await fetch(`/api/admin/daily-content/${selected.id}/platform-posts/${postId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action, ...body }),
            });
            const payload = await res.json();
            if (!res.ok || !payload.ok) throw new Error(payload.error ?? "Unable to update platform post");
            setNotice("Platform post updated.");
          })} />
        </section>
      ) : null}

      <ContentEngineCommandCenter summary={summary} selected={selected} posts={posts} />
      <RevenueReelBlueprintLibrary />
    </main>
  );
}

function VideoPreviewPlayer({
  video,
  pending,
  onHiggsfield,
}: {
  video: DailyVideoContentRow;
  pending: boolean;
  onHiggsfield: () => void;
}) {
  const fallbackScene = {
    time: "0-6s",
    visual: video.thumbnail_concept || video.angle,
    caption: video.video_hook,
    motion: "Static preview until storyboard is generated.",
    voiceover: video.voiceover_script || video.full_script,
  };
  const scenes = video.storyboard.length
    ? video.storyboard
    : [fallbackScene];
  const [sceneIndex, setSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [renderedCurrentTime, setRenderedCurrentTime] = useState(0);
  const scene = scenes[sceneIndex] ?? fallbackScene;
  const videoAsset = resolveVideoAsset(video);
  const renderedOverlay = buildRenderedVideoOverlay(video, scenes, renderedCurrentTime);
  const progress = ((sceneIndex + 1) / scenes.length) * 100;
  const fullVoiceover = video.voiceover_script || scenes.map((item) => item.voiceover).join(" ");

  const stopNarration = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsNarrating(false);
  }, []);

  const speakNarration = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setAudioNotice("Voiceover preview is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.96;
    utterance.pitch = 0.92;
    utterance.volume = 1;
    utterance.onend = () => setIsNarrating(false);
    utterance.onerror = () => {
      setIsNarrating(false);
      setAudioNotice("Voiceover preview stopped. Check browser audio permissions and system volume.");
    };
    setAudioNotice(null);
    setIsNarrating(true);
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    setSceneIndex(0);
    setIsPlaying(false);
    stopNarration();
    setRenderedCurrentTime(0);
  }, [stopNarration, video.id]);

  useEffect(() => {
    return () => stopNarration();
  }, [stopNarration]);

  useEffect(() => {
    if (!isPlaying || videoAsset.url) return;
    const timer = window.setInterval(() => {
      setSceneIndex((current) => {
        if (current >= scenes.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 3300);

    return () => window.clearInterval(timer);
  }, [isPlaying, scenes.length, videoAsset.url]);

  useEffect(() => {
    if (!isPlaying || videoAsset.url) return;
    speakNarration(scene.voiceover || scene.caption);
  }, [isPlaying, scene.caption, scene.voiceover, speakNarration, videoAsset.url]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">
            Watch preview
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">
            {videoAsset.url ? "Video draft player" : "Animated draft preview"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
            {videoAsset.url
              ? "Playable MP4 detected. Review the final asset here before approving or posting."
              : "No MP4 is attached yet, so this player generates an animated 9:16 preview using the exact scenes, captions, voiceover, music direction, and CTA."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={video.status} />
          <button
            type="button"
            disabled={pending}
            onClick={onHiggsfield}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Sparkles className={cn("h-4 w-4", pending && "animate-pulse")} />
            {videoAsset.url ? "Regenerate AI b-roll" : videoAsset.error ? "Retry AI b-roll" : "Render AI b-roll"}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-800">AI b-roll render status</p>
            <p className="mt-1 text-sm font-bold leading-6 text-blue-950">
              {videoAsset.url
                ? "Rendered MP4 is attached. Watch the full video here before approving."
                : videoAsset.error
                  ? `Previous render failed: ${videoAsset.error}. Click Retry AI b-roll to run a fresh render.`
                  : videoAsset.dryRun
                    ? "Dry-run prompt is prepared. Turn off dry-run to create the MP4."
                    : "No rendered MP4 is attached yet. You can still watch the animated draft preview below, then use Render AI b-roll for provider footage."}
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-blue-800">
            {videoAsset.providerStatus ?? "needs render"}
          </span>
        </div>
      </div>

      {videoAsset.url ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
          <div className="relative mx-auto aspect-[9/16] max-h-[640px] w-full max-w-[360px] bg-black">
            <video
              className="h-full w-full bg-black object-contain"
              controls
              playsInline
              preload="metadata"
              src={videoAsset.url}
              onTimeUpdate={(event) => setRenderedCurrentTime(event.currentTarget.currentTime)}
              onLoadedMetadata={() => setRenderedCurrentTime(0)}
            />
            <div className="pointer-events-none absolute inset-x-3 top-3 rounded-full bg-black/65 px-3 py-1 text-center text-[10px] font-black uppercase tracking-[0.16em] text-white backdrop-blur">
              English overlay preview
            </div>
            <div className="pointer-events-none absolute inset-x-4 bottom-16 rounded-2xl border border-white/20 bg-black/70 p-4 text-center shadow-2xl backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                {video.vertical === "procurement" ? "Supplyfy" : "HomeReach"}
              </p>
              <p className="mt-2 text-xl font-black leading-tight text-white">
                {renderedOverlay.caption}
              </p>
            </div>
          </div>
          {videoAsset.sourceUrl ? (
            <div className="border-t border-white/10 p-3">
              <a
                href={videoAsset.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-950 hover:bg-slate-100"
              >
                <ExternalLink className="h-4 w-4" />
                Open {videoAsset.provider}
              </a>
            </div>
          ) : null}
          <div className="border-t border-white/10 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Controlled voiceover preview</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">
                  If the rendered MP4 is silent, use this to hear the approved English script.
                </p>
              </div>
              <button
                type="button"
                onClick={() => (isNarrating ? stopNarration() : speakNarration(fullVoiceover))}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-950 hover:bg-slate-100"
              >
                {isNarrating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isNarrating ? "Stop voiceover" : "Play voiceover"}
              </button>
            </div>
            {audioNotice ? <p className="mt-3 text-xs font-bold text-amber-200">{audioNotice}</p> : null}
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(260px,360px)_1fr]">
          <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[1.75rem] border border-slate-900 bg-slate-950 p-3 shadow-2xl shadow-slate-300/60">
            <AnimatedDraftReel
              video={video}
              scene={scene}
              sceneIndex={sceneIndex}
              sceneCount={scenes.length}
            />
          </div>

          <div className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Scene {sceneIndex + 1} of {scenes.length}
                </p>
                <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-black text-white">
                  9:16 preview
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <h3 className="mt-5 text-xl font-black text-slate-950">{scene.caption}</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{scene.voiceover}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InsightBlock label="Music vibe" value={video.suggested_music_vibe} />
                <InsightBlock label="Final CTA" value={video.primary_cta} />
              </div>
              <div className="mt-4 rounded-lg border border-blue-200 bg-white p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Audio preview</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                      The storyboard player now plays a browser voiceover preview for the script.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => (isNarrating ? stopNarration() : speakNarration(scene.voiceover || scene.caption))}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-800 hover:bg-slate-50"
                  >
                    {isNarrating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {isNarrating ? "Stop voiceover" : "Play scene audio"}
                  </button>
                </div>
                {audioNotice ? <p className="mt-3 text-xs font-bold text-amber-700">{audioNotice}</p> : null}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <ActionButton
                label="Back"
                icon={<SkipBack className="h-4 w-4" />}
                onClick={() => setSceneIndex((current) => Math.max(0, current - 1))}
              />
              <ActionButton
                label={isPlaying ? "Pause" : "Play with voice"}
                icon={isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                onClick={() => {
                  if (isPlaying) {
                    setIsPlaying(false);
                    stopNarration();
                    return;
                  }
                  if (sceneIndex >= scenes.length - 1) setSceneIndex(0);
                  setIsPlaying(true);
                }}
                tone="green"
              />
              <ActionButton
                label="Next"
                icon={<SkipForward className="h-4 w-4" />}
                onClick={() => setSceneIndex((current) => Math.min(scenes.length - 1, current + 1))}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AnimatedDraftReel({
  video,
  scene,
  sceneIndex,
  sceneCount,
}: {
  video: DailyVideoContentRow;
  scene: StoryboardScene;
  sceneIndex: number;
  sceneCount: number;
}) {
  const isSupplyfy = video.vertical === "procurement";
  const brand = isSupplyfy ? "Supplyfy" : "HomeReach";
  const caption = sceneIndex === 0 ? video.video_hook : scene.caption;
  const finalCaption = sceneIndex === sceneCount - 1 ? video.primary_cta : caption;

  return (
    <div
      key={`${video.id}-${sceneIndex}`}
      className={cn(
        "relative aspect-[9/16] overflow-hidden rounded-[1.25rem]",
        isSupplyfy
          ? "bg-[radial-gradient(circle_at_40%_8%,rgba(34,197,94,0.22),transparent_34%),linear-gradient(160deg,#06121d,#0f172a_52%,#111827)]"
          : "bg-[radial-gradient(circle_at_50%_12%,rgba(59,130,246,0.32),transparent_34%),linear-gradient(160deg,#04111f,#0f172a_52%,#111827)]",
      )}
    >
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-4">
        <span className="rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">
          {verticalLabels[video.vertical]}
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-950">
          {scene.time}
        </span>
      </div>

      <div className="absolute inset-0 z-0">
        {isSupplyfy ? (
          <SupplyfyPreviewScene sceneIndex={sceneIndex} />
        ) : (
          <HomeReachPreviewScene sceneIndex={sceneIndex} />
        )}
      </div>

      <div className="absolute inset-x-4 top-[16%] z-20 rounded-xl border border-white/10 bg-black/45 p-4 shadow-2xl backdrop-blur-sm">
        <p className={cn("text-[10px] font-black uppercase tracking-[0.18em]", isSupplyfy ? "text-emerald-200" : "text-sky-100")}>
          {brand}
        </p>
        <h3 className="mt-2 text-2xl font-black leading-tight text-white">
          {caption}
        </h3>
      </div>

      <div className="absolute inset-x-4 bottom-24 z-20 rounded-xl border border-white/10 bg-slate-950/75 p-4 backdrop-blur-sm">
        <p className="text-sm font-bold leading-6 text-white">{scene.visual}</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          {scene.motion}
        </p>
      </div>

      <div className="absolute inset-x-5 bottom-5 z-20">
        <div className={cn("rounded-xl px-4 py-3 text-center text-sm font-black shadow-lg", isSupplyfy ? "bg-emerald-400 text-slate-950" : "bg-white text-slate-950")}>
          {finalCaption}
        </div>
      </div>

      <style jsx global>{`
        @keyframes previewSlideRight {
          0% { transform: translateX(-32px); opacity: 0.88; }
          55% { transform: translateX(18px); opacity: 1; }
          100% { transform: translateX(34px); opacity: 0.94; }
        }
        @keyframes previewFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes previewPulse {
          0%, 100% { opacity: 0.62; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes previewRoute {
          0% { stroke-dashoffset: 160; opacity: 0.45; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        .preview-slide-right { animation: previewSlideRight 3s ease-in-out infinite alternate; }
        .preview-float { animation: previewFloat 2.6s ease-in-out infinite; }
        .preview-pulse { animation: previewPulse 1.8s ease-in-out infinite; }
        .preview-route-line { stroke-dasharray: 160; animation: previewRoute 2.7s ease-out infinite; }
      `}</style>
    </div>
  );
}

function SupplyfyPreviewScene({ sceneIndex }: { sceneIndex: number }) {
  const step = sceneIndex % 5;
  if (step === 2) {
    return (
      <div className="absolute inset-0 p-6 pt-28">
        <div className="grid h-[58%] grid-cols-2 gap-3">
          <div className="rounded-2xl border border-red-300/30 bg-red-500/15 p-4 shadow-2xl">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-red-100">Old vendor</div>
            <div className="mt-8 space-y-2">
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item} className="h-5 rounded bg-red-300/80 shadow" />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-300/40 bg-emerald-500/20 p-4 shadow-2xl">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">Better option</div>
            <div className="mt-16 space-y-2 preview-float">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-5 rounded bg-emerald-300 shadow" />
              ))}
            </div>
          </div>
        </div>
        <div className="absolute left-1/2 top-[43%] flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-white text-xl font-black text-slate-950 shadow-2xl">
          $
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="absolute inset-0 p-6 pt-28">
        <div className="absolute left-8 top-36 h-32 w-24 rounded-full bg-slate-200/80 shadow-2xl" />
        <div className="absolute left-12 top-52 h-28 w-36 rounded-3xl bg-slate-700 shadow-2xl" />
        <div className="absolute bottom-40 left-8 right-8 rounded-2xl border border-emerald-300/30 bg-emerald-400/20 p-5">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">Savings found</div>
          <div className="mt-5 flex items-end gap-3">
            <div className="h-12 w-12 rounded bg-emerald-300" />
            <div className="h-20 w-12 rounded bg-emerald-300" />
            <div className="h-28 w-12 rounded bg-emerald-300 preview-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-400 text-5xl font-black text-slate-950 shadow-2xl preview-float">
          $
        </div>
        <div className="mt-6 text-4xl font-black text-white">Supplyfy</div>
        <div className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-emerald-200">Supply savings done for you</div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 p-6 pt-28">
      <div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(180deg,rgba(15,23,42,0),rgba(120,53,15,0.42))]" />
      <div className="absolute left-6 right-6 top-32 h-24 rounded-2xl bg-amber-100/15 shadow-inner" />
      <div className="absolute left-8 top-44 h-28 w-24 rounded-full bg-slate-200/80 shadow-2xl" />
      <div className="absolute left-12 top-60 h-28 w-36 rounded-3xl bg-slate-700 shadow-2xl" />
      <div className="preview-slide-right absolute bottom-36 right-8 flex items-end gap-1">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="h-7 w-14 rounded bg-emerald-200 shadow-lg" />
        ))}
      </div>
      <div className="absolute bottom-24 right-10 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white">
        Supplier payment
      </div>
    </div>
  );
}

function HomeReachPreviewScene({ sceneIndex }: { sceneIndex: number }) {
  const step = sceneIndex % 5;
  if (step === 0) {
    return (
      <div className="absolute inset-0 overflow-hidden bg-emerald-950">
        <div className="absolute inset-x-0 top-0 h-40 bg-sky-300/20" />
        <div className="absolute left-10 top-28 h-28 w-40 rounded-t-3xl bg-slate-100 shadow-2xl" />
        <div className="absolute left-20 top-20 h-20 w-28 rotate-45 bg-slate-300" />
        <div className="absolute inset-x-0 bottom-0 h-[66%] bg-emerald-600" />
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="absolute bottom-0 h-[66%] w-3 bg-emerald-400/45" style={{ left: `${item * 18 + 4}%` }} />
        ))}
        <div className="preview-slide-right absolute bottom-32 left-8 flex items-center gap-2">
          <div className="h-9 w-20 rounded-lg bg-slate-950 shadow-xl" />
          <div className="h-12 w-12 rounded-full border-4 border-slate-950 bg-slate-600" />
          <div className="h-12 w-12 rounded-full border-4 border-slate-950 bg-slate-600" />
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <NeighborhoodReactivationMap mode="proof" />
    );
  }

  if (step === 2) {
    return (
      <PostcardMailboxScene />
    );
  }

  if (step === 3) {
    return (
      <NeighborhoodReactivationMap mode="density" />
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_20%,rgba(34,197,94,0.3),transparent_38%),#020617] p-8 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-white/20 bg-white text-5xl font-black text-slate-950 shadow-2xl preview-float">
        H
      </div>
      <div className="mt-6 text-4xl font-black text-white">HomeReach</div>
      <div className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-lime-200">Route density made simple</div>
    </div>
  );
}

function NeighborhoodReactivationMap({ mode }: { mode: "proof" | "density" }) {
  const dense = mode === "density";
  const homes = [
    [70, 132], [154, 118], [236, 138],
    [48, 214], [132, 216], [214, 226], [284, 214],
    [74, 304], [156, 304], [244, 314],
    [48, 394], [130, 392], [214, 402], [286, 388],
  ];
  const active = dense ? new Set([1, 3, 4, 5, 7, 8, 9, 11, 12]) : new Set([4]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#12070a]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.16),transparent_38%),linear-gradient(180deg,rgba(185,28,28,0.54),rgba(15,23,42,0.92))]" />
      <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle,rgba(255,255,255,0.42)_1px,transparent_1px)] [background-size:10px_10px]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 568" aria-hidden="true">
        <path d="M36 456 C98 402 130 340 160 284 C198 214 238 176 292 126" fill="none" stroke="#ef4444" strokeWidth="10" strokeLinecap="round" opacity="0.24" />
        <path className="preview-route-line" d="M36 456 C98 402 130 340 160 284 C198 214 238 176 292 126" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        {[42, 76, 112].map((radius) => (
          <circle
            key={radius}
            cx="132"
            cy="216"
            r={radius}
            fill="none"
            stroke={dense ? "#f8fafc" : "#ef4444"}
            strokeWidth={dense ? "2" : "3"}
            opacity={dense ? "0.42" : "0.7"}
          />
        ))}
      </svg>
      {homes.map(([left, top], index) => {
        const isActive = active.has(index);
        return (
          <div
            key={`${left}-${top}`}
            className={cn(
              "absolute h-10 w-12 rounded-md border border-white/25 bg-slate-100 shadow-xl",
              isActive && "preview-pulse ring-4 ring-red-400",
            )}
            style={{ left, top }}
          >
            <div className="absolute -right-2 top-3 h-4 w-2 rounded bg-white/80" />
            {index === 4 ? (
              <div className="absolute -top-5 left-3 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white shadow-lg">
                1
              </div>
            ) : null}
          </div>
        );
      })}
      <div className="absolute left-5 right-5 top-24 rounded-2xl border border-white/15 bg-black/50 p-3 text-center shadow-2xl backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-100">
          {dense ? "Route density" : "Neighborhood reactivation"}
        </p>
        <p className="mt-1 text-2xl font-black leading-tight text-white">
          {dense ? "Mail the homes around your work." : "Start with one completed job."}
        </p>
      </div>
      <div className="absolute bottom-24 left-5 right-5 grid grid-cols-3 gap-2">
        {["Job", "Neighbors", "Routes"].map((label, index) => (
          <div key={label} className="rounded-xl border border-white/15 bg-white/10 p-2 text-center backdrop-blur">
            <div className={cn("mx-auto h-2.5 w-2.5 rounded-full", index === 0 ? "bg-red-400" : dense ? "bg-white" : "bg-red-300")} />
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostcardMailboxScene() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-950 p-6 pt-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.36),transparent_48%)]" />
      <div className="absolute left-7 right-7 top-28 rounded-2xl border border-white/15 bg-black/50 p-4 text-center backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-100">Targeted postcards</p>
        <p className="mt-1 text-2xl font-black leading-tight text-white">Reach the neighbors next.</p>
      </div>
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="absolute right-8 h-16 w-24 rounded-2xl border-4 border-slate-300 bg-slate-700 shadow-2xl"
          style={{ top: `${210 + item * 68}px` }}
        >
          <div className="absolute left-2 top-2 h-2 w-14 rounded bg-slate-500" />
          <div className="absolute -left-20 top-4 h-10 w-14 rounded border border-red-200 bg-white shadow-xl preview-slide-right">
            <div className="mx-auto mt-2 h-2 w-8 rounded bg-red-500" />
            <div className="mx-auto mt-1 h-1.5 w-6 rounded bg-slate-300" />
          </div>
        </div>
      ))}
      <div className="absolute bottom-20 left-7 right-7 rounded-2xl border border-red-200/30 bg-red-500/15 p-4 text-center backdrop-blur">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-red-100">Not random mail</p>
        <p className="mt-1 text-lg font-black text-white">A route plan around real work.</p>
      </div>
    </div>
  );
}

function ContentEngineCommandCenter({
  summary,
  selected,
  posts,
}: {
  summary: DailyContentSummary;
  selected: DailyVideoContentRow | null;
  posts: DailyVideoPlatformPostRow[];
}) {
  const approvedCount = summary.videos.filter((video) => video.status === "approved" || video.status === "scheduled" || video.status === "published").length;
  const intelligenceItems = Object.values(summary.intelligence ?? {});
  const winnerCount = intelligenceItems.filter((item) => item.label === "Winner").length;
  const paidCandidateCount = intelligenceItems.filter((item) => item.paidAdCandidate).length;
  const selectedIntelligence = selected ? summary.intelligence[selected.id] : null;
  const readiness =
    !selected
      ? "Generate drafts"
      : selected.status === "published"
        ? "Published"
        : selected.status === "scheduled"
          ? "Scheduled"
          : selected.status === "approved"
            ? "Ready to export"
            : "Approval required";
  const publishReadyCount = posts.filter((post) => post.status === "approved" || post.status === "scheduled" || post.status === "published").length;
  const layers = [
    {
      label: "Today's generated reels",
      value: `${summary.videos.length}/2`,
      detail: "One Supplyfy savings reel and one HomeReach targeted-mail reel.",
      icon: TrendingUp,
    },
    {
      label: "Hook + script engine",
      value: selected ? `${selected.alternate_hooks.length + 1} hooks` : "Hooks queued",
      detail: "Scroll-stopping hook, owner pain, voiceover, CTA, and alternate openings.",
      icon: Wand2,
    },
    {
      label: "Offer-led production plan",
      value: selected ? `${selected.storyboard.length || 1} scenes` : "Storyboard",
      detail: "Provider b-roll is optional. HomeReach controls captions, proof, CTA, and final message.",
      icon: Film,
    },
    {
      label: "Publish ops queue",
      value: `${publishReadyCount}/${posts.length || platformListFallback.length}`,
      detail: "Manual publish prep across Facebook, Instagram, TikTok, and Shorts.",
      icon: Smartphone,
    },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-blue-800">
            <Sparkles className="h-3.5 w-3.5" />
            AI Reel Command Center
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            Generate, review, approve, export, and learn from daily conversion reels.
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
            This replaces generic creative content with approval-gated daily reels focused on comments, DMs, inbound leads, and booked conversations. Higgsfield is treated as textless b-roll, while the offer logic, captions, proof, CTA, and final message stay controlled by HomeReach.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5 lg:min-w-[560px]">
          <ContentMetric label="Approved" value={approvedCount.toString()} />
          <ContentMetric label="Winners" value={winnerCount.toString()} />
          <ContentMetric label="Paid Tests" value={paidCandidateCount.toString()} />
          <ContentMetric label="DMs" value={summary.totalDms.toLocaleString()} />
          <ContentMetric label="Readiness" value={readiness} compact />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {layers.map((layer) => {
          const Icon = layer.icon;
          return (
            <div key={layer.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-lg bg-white p-2 text-blue-700 shadow-sm">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-right text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  {layer.value}
                </span>
              </div>
              <h3 className="mt-4 text-sm font-black text-slate-950">{layer.label}</h3>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{layer.detail}</p>
            </div>
          );
        })}
      </div>

      {selectedIntelligence ? <PerformanceIntelligencePanel intelligence={selectedIntelligence} /> : null}
      {selected ? <RepurposingPanel video={selected} /> : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <SectionHeader icon={<ShieldCheck className="h-5 w-5" />} title="Quality governance" />
          <div className="mt-4 grid gap-2">
            {[
              "Human approval required before publishing.",
              "Supplyfy claims stay review-based unless verified by real customer data.",
              "HomeReach targeted-mail claims stay route-density and local-visibility focused.",
              "No mass auto-posting, repetitive spam, fake guarantees, or unsupported savings claims.",
            ].map((item) => (
              <div key={item} className="flex gap-2 text-sm font-bold leading-5 text-emerald-950">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-white">
          <SectionHeader icon={<Library className="h-5 w-5" />} title="Content library loop" light />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <LibraryStat label="Clone" value="Hooks" detail="Reuse winners without copying spam." />
            <LibraryStat label="Remix" value="Visuals" detail="Turn one winner into daily native variants." />
            <LibraryStat label="Learn" value="CTAs" detail="Track comments, DMs, leads, saves, and shares." />
          </div>
        </div>
      </div>
    </section>
  );
}

function PerformanceIntelligencePanel({
  intelligence,
}: {
  intelligence: DailyContentSummary["intelligence"][string];
}) {
  const tone =
    intelligence.label === "Winner"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : intelligence.label === "Underperforming"
        ? "border-rose-200 bg-rose-50 text-rose-950"
        : "border-blue-200 bg-blue-50 text-blue-950";

  return (
    <div className={cn("mt-5 rounded-xl border p-4", tone)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-70">
            Content performance intelligence
          </p>
          <h3 className="mt-2 text-xl font-black">
            {intelligence.label} / score {Math.round(intelligence.score)}
          </h3>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-6">
            {intelligence.recommendedAction}
          </p>
        </div>
        <div className="grid min-w-full grid-cols-2 gap-2 text-center sm:min-w-[360px] sm:grid-cols-4">
          <MiniMetric label="Baseline" value={Math.round(intelligence.baselineScore).toString()} />
          <MiniMetric label="Leads" value={intelligence.totals.leads_generated.toString()} />
          <MiniMetric label="DMs" value={intelligence.totals.dms_generated.toString()} />
          <MiniMetric label="Confidence" value={intelligence.confidence} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <InsightList title="Signals" items={intelligence.signals} />
        <InsightList title="Reusable hooks" items={intelligence.reusableHooks.slice(0, 3)} />
        <InsightList title="Pain points" items={intelligence.painPoints.slice(0, 3)} />
      </div>

      {intelligence.paidAdCandidate ? (
        <div className="mt-4 rounded-lg border border-white/50 bg-white/70 p-3 text-sm font-black">
          Potential Paid Ad Candidate: {intelligence.paidAdReason}
        </div>
      ) : null}
    </div>
  );
}

type RepurposeDisplayAsset = {
  channel: string;
  label: string;
  copy: string;
  recommendedUse: string;
  approvalRequired: boolean;
  humanAction: string;
};

function RepurposingPanel({ video }: { video: DailyVideoContentRow }) {
  const assets = extractRepurposedAssets(video.source_context);
  const paidPlan = extractOrganicToPaidPlan(video.source_context);

  if (assets.length === 0 && !paidPlan) return null;

  return (
    <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-950">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-700">
            Create once / deploy everywhere
          </p>
          <h3 className="mt-2 text-xl font-black">Repurposing engine</h3>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-indigo-900/80">
            Every draft now carries optional versions for social, groups, email, SMS, DMs, ad tests, video scripts, and landing pages. Nothing sends, posts, or spends without human approval.
          </p>
        </div>
        <div className="grid min-w-full grid-cols-2 gap-2 text-center sm:min-w-[360px] sm:grid-cols-3">
          <MiniMetric label="Assets" value={assets.length.toString()} />
          <MiniMetric label="Approval" value="Required" />
          <MiniMetric label="Paid" value={paidPlan ? "Gated" : "Manual"} />
        </div>
      </div>

      {paidPlan ? (
        <div className="mt-4 rounded-lg border border-indigo-200 bg-white/70 p-3 text-sm font-bold leading-6">
          <span className="font-black">Organic-to-paid rule:</span> {paidPlan.recommendationTrigger}
          <span className="mt-1 block text-indigo-800">Suggested test: {paidPlan.budgetSuggestion} / {paidPlan.ctaSuggestion}</span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {assets.slice(0, 6).map((asset) => (
          <div key={`${video.id}-${asset.channel}`} className="rounded-lg border border-indigo-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600">{asset.label}</p>
                <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{asset.recommendedUse}</p>
              </div>
              <QuickCopyButton label="Copy" value={asset.copy} icon={<Clipboard className="h-4 w-4" />} />
            </div>
            <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm font-semibold leading-6 text-slate-800">{asset.copy}</p>
            <p className="mt-3 rounded-md bg-indigo-50 p-2 text-xs font-black leading-5 text-indigo-900">
              {asset.approvalRequired ? "Approval required: " : "Manual review: "}
              {asset.humanAction}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RevenueReelBlueprintLibrary() {
  const primaryBlueprints = revenueReelBlueprints.slice(0, 4);
  const supportBlueprints = revenueReelBlueprints.slice(4);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-indigo-800">
            <Megaphone className="h-3.5 w-3.5" />
            Revenue reel blueprint library
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            Offer-first reels built for DMs, comments, and booked conversations.
          </h2>
          <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-600">
            These are the production recipes the daily system should pull from before any AI video provider is used. Each blueprint starts with the revenue offer, the person feeling the pain, the DM keyword, and the proof needed to make the reel believable.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4 lg:min-w-[520px]">
          <ContentMetric label="Offers mapped" value={revenueReelBlueprints.length.toString()} />
          <ContentMetric label="Daily active" value="2" />
          <ContentMetric label="Approval" value="Required" compact />
          <ContentMetric label="Version" value={REVENUE_REEL_BLUEPRINT_VERSION.includes("-v") ? `v${REVENUE_REEL_BLUEPRINT_VERSION.split("-v")[1]?.split("-")[0]}` : "v1"} compact />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-950 p-4 text-white">
        <div className="grid gap-3 md:grid-cols-3">
          <LibraryStat label="Strategy" value="Offer first" detail="Start with pain, promise, proof, and a comment keyword." />
          <LibraryStat label="Production" value="Textless b-roll" detail="Use AI footage only where it helps, then overlay English in post." />
          <LibraryStat label="Revenue" value="DM path" detail="Every reel routes to a specific intake or consult path." />
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {primaryBlueprints.map((blueprint) => (
          <BlueprintCard key={blueprint.id} blueprint={blueprint} featured />
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {supportBlueprints.map((blueprint) => (
          <BlueprintCard key={blueprint.id} blueprint={blueprint} />
        ))}
      </div>
    </section>
  );
}

function BlueprintCard({
  blueprint,
  featured = false,
}: {
  blueprint: (typeof revenueReelBlueprints)[number];
  featured?: boolean;
}) {
  const visualStoryPreview = blueprint.visualStory.slice(0, featured ? 4 : 2);

  return (
    <article
      className={cn(
        "rounded-xl border bg-white p-4 shadow-sm",
        featured ? "border-blue-200 ring-1 ring-blue-50" : "border-slate-200",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">{blueprint.offer}</p>
          <h3 className="mt-2 text-lg font-black leading-6 text-slate-950">{blueprint.hook}</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
          Comment {blueprint.commentKeyword}
        </span>
      </div>

      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{blueprint.audience}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InsightBlock label="Pain" value={blueprint.pain} />
        <InsightBlock label="Promise" value={blueprint.promise} />
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Visual story</p>
        <div className="mt-3 space-y-2">
          {visualStoryPreview.map((scene, index) => (
            <div key={scene} className="flex gap-2 text-sm font-semibold leading-5 text-slate-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-blue-700 shadow-sm">
                {index + 1}
              </span>
              <span>{scene}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-800">DM goal</p>
        <p className="mt-2 text-sm font-bold leading-6 text-amber-950">{blueprint.dmGoal}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={blueprint.route}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-800 hover:bg-slate-50"
        >
          <ExternalLink className="h-4 w-4" />
          Offer page
        </a>
        <a
          href={blueprint.startRoute}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500"
        >
          <Send className="h-4 w-4" />
          CTA path
        </a>
        <QuickCopyButton
          label="Copy blueprint"
          value={buildBlueprintCopy(blueprint)}
          icon={<Clipboard className="h-4 w-4" />}
        />
      </div>
    </article>
  );
}

function VideoDetail({
  video,
  pending,
  onHiggsfield,
  onAction,
}: {
  video: DailyVideoContentRow;
  pending: boolean;
  onHiggsfield: () => void;
  onAction: (action: string, body?: Record<string, string>) => void;
}) {
  const videoAsset = resolveVideoAsset(video);

  function confirmAction(label: string, action: string, body?: Record<string, string>) {
    const approved = window.confirm(`${label} this content draft?\n\nPublishing still remains manual and approval-logged.`);
    if (approved) onAction(action, body);
  }

  return (
    <div className="space-y-6">
      <VideoPreviewPlayer video={video} pending={pending} onHiggsfield={onHiggsfield} />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Selected Draft</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">{video.title}</h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">{video.angle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton disabled={pending || !videoAsset.url} label="Approve" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => confirmAction("Approve", "approve")} tone="green" />
            <ActionButton disabled={pending} label="Revise" icon={<Wand2 className="h-4 w-4" />} onClick={() => confirmAction("Request revision for", "needs_revision", { reason: "Needs revision before publishing." })} />
            <ActionButton disabled={pending} label="Reject" icon={<XCircle className="h-4 w-4" />} onClick={() => confirmAction("Reject", "reject", { reason: "Rejected in AI Reel Command Center." })} tone="red" />
          </div>
        </div>

        {!videoAsset.url ? (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-800">
            Approval is locked until a provider-rendered MP4 is attached and reviewed in the player above.
          </p>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <InsightBlock label="Hook" value={video.video_hook} />
          <InsightBlock label="CTA" value={video.primary_cta} />
          <InsightBlock label="Tone" value={video.emotional_tone} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader icon={<Film className="h-5 w-5" />} title="Scene-by-scene storyboard" />
        <div className="mt-4 space-y-3">
          {video.storyboard.map((scene) => (
            <div key={`${scene.time}-${scene.caption}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-black text-white">{scene.time}</span>
                <span className="text-sm font-black text-slate-950">{scene.caption}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{scene.visual}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{scene.motion}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader icon={<Megaphone className="h-5 w-5" />} title="Script and hook tests" />
        <CopyBlock label="Voiceover" value={video.voiceover_script} />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {video.alternate_hooks.map((hook) => (
            <CopyBlock key={hook} label="Alternate hook" value={hook} compact />
          ))}
        </div>
      </section>
    </div>
  );
}

function PublishingPanel({
  video,
  posts,
  pending,
  onHiggsfield,
  onRegenerateCreative,
  onCanva,
  onPlatformAction,
}: {
  video: DailyVideoContentRow;
  posts: DailyVideoPlatformPostRow[];
  pending: boolean;
  onHiggsfield: () => void;
  onRegenerateCreative: (kind: "script" | "cta" | "visuals" | "voice") => void;
  onCanva: () => void;
  onPlatformAction: (postId: string, action: "manual_publish_ready" | "schedule" | "mark_published" | "fail" | "reset", body?: Record<string, string>) => void;
}) {
  const videoAsset = resolveVideoAsset(video);
  const exportManifest = buildExportManifest(video, posts);
  const bestCaption = posts[0]?.caption ?? video.platform_posts.facebook_reels ?? video.video_hook;
  const hashtagText = video.hashtags.join(" ");
  const scriptRegenerationBrief = buildRegenerationBrief(video, "script");
  const ctaRegenerationBrief = buildRegenerationBrief(video, "cta");
  const visualRegenerationBrief = buildRegenerationBrief(video, "visuals");
  const voiceRegenerationBrief = buildRegenerationBrief(video, "voice");

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-200">
              <Smartphone className="h-3.5 w-3.5" />
              Mobile publish kit
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight">Approve once. Export and post manually in seconds.</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
              One-tap render, export notes, captions, CTAs, hashtags, and platform links keep the posting workflow fast while preserving human approval.
            </p>
          </div>
          <StatusBadge status={video.status} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickCopyButton label="Copy export brief" value={exportManifest} icon={<Clipboard className="h-4 w-4" />} dark />
          <QuickCopyButton label="Copy caption" value={bestCaption} icon={<ListChecks className="h-4 w-4" />} dark />
          <QuickCopyButton label="Copy hashtags" value={hashtagText} icon={<Hash className="h-4 w-4" />} dark />
          <QuickCopyButton label="Copy CTA" value={video.primary_cta} icon={<Megaphone className="h-4 w-4" />} dark />
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Regeneration controls</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <button
              type="button"
              disabled={pending}
              onClick={onHiggsfield}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-950 hover:bg-slate-100 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              Regenerate b-roll
            </button>
            <RegenerateButton label="Regenerate script" icon={<Wand2 className="h-4 w-4" />} disabled={pending} onClick={() => onRegenerateCreative("script")} />
            <RegenerateButton label="Regenerate CTA" icon={<Megaphone className="h-4 w-4" />} disabled={pending} onClick={() => onRegenerateCreative("cta")} />
            <RegenerateButton label="Regenerate visuals" icon={<Film className="h-4 w-4" />} disabled={pending} onClick={() => onRegenerateCreative("visuals")} />
            <RegenerateButton label="Regenerate voice" icon={<ListChecks className="h-4 w-4" />} disabled={pending} onClick={() => onRegenerateCreative("voice")} />
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-slate-400">
            Regeneration creates a fresh approval-gated draft for today and clears stale provider b-roll. Use the brief copies below only when producing manually.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <QuickCopyButton label="Copy script brief" value={scriptRegenerationBrief} icon={<Clipboard className="h-4 w-4" />} dark />
            <QuickCopyButton label="Copy CTA brief" value={ctaRegenerationBrief} icon={<Clipboard className="h-4 w-4" />} dark />
            <QuickCopyButton label="Copy visual brief" value={visualRegenerationBrief} icon={<Clipboard className="h-4 w-4" />} dark />
            <QuickCopyButton label="Copy voice brief" value={voiceRegenerationBrief} icon={<Clipboard className="h-4 w-4" />} dark />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onHiggsfield}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-100 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            Render AI b-roll
          </button>
          {videoAsset.url ? (
            <a
              href={videoAsset.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/15"
            >
              <Download className="h-4 w-4" />
              Open export
            </a>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={onCanva}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/15 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            Prepare Canva
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Governance</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
            This panel prepares manual posting only. It does not auto-send, auto-publish, charge, or change active customer/campaign settings.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
        <SectionHeader icon={<Sparkles className="h-5 w-5" />} title="AI b-roll production package" light />
          <button
            type="button"
            disabled={pending}
            onClick={onHiggsfield}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-950 hover:bg-slate-100 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            Render b-roll
          </button>
        </div>
        <CopyBlock label="AI b-roll and editor prompt" value={video.canva_prompt} dark />
        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">3D Outro</p>
          <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.25),transparent_36%),#020617] p-5">
            <LogoOutroPreview />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">{video.logo_outro_spec.visualStyle}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader icon={<CalendarClock className="h-5 w-5" />} title="Publishing queue" />
        <div className="mt-4 space-y-3">
          {posts.map((post) => (
            <PlatformPostCard
              key={post.id}
              video={video}
              post={post}
              pending={pending}
              onPlatformAction={onPlatformAction}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader icon={<BarChart3 className="h-5 w-5" />} title="Optimization signals" />
        <div className="mt-4 grid gap-3">
          {video.engagement_strategy.map((item) => (
            <div key={item} className="rounded-lg bg-blue-50 p-3 text-sm font-semibold leading-6 text-blue-950">
              {item}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Manual publish checklist</p>
          <ul className="mt-3 space-y-2">
            {video.manual_publish_checklist.map((item) => (
              <li key={item} className="flex gap-2 text-sm font-semibold leading-5 text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function PlatformPostCard({
  video,
  post,
  pending,
  onPlatformAction,
}: {
  video: DailyVideoContentRow;
  post: DailyVideoPlatformPostRow;
  pending: boolean;
  onPlatformAction: (postId: string, action: "manual_publish_ready" | "schedule" | "mark_published" | "fail" | "reset", body?: Record<string, string>) => void;
}) {
  const [externalUrl, setExternalUrl] = useState(post.external_url ?? "");
  const [externalPostId, setExternalPostId] = useState(post.external_post_id ?? "");
  const approved = video.approval_status === "approved";

  useEffect(() => {
    setExternalUrl(post.external_url ?? "");
    setExternalPostId(post.external_post_id ?? "");
  }, [post.external_post_id, post.external_url, post.id]);

  function publishProofBody() {
    return {
      external_url: externalUrl.trim(),
      external_post_id: externalPostId.trim(),
    };
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-black text-slate-950">{platformLabels[post.platform]}</div>
          <p className="mt-1 text-xs font-bold text-slate-500">{post.recommended_posting_time}</p>
        </div>
        <StatusBadge status={post.status} />
      </div>

      <CopyBlock label="Caption" value={`${post.caption}\n\n${post.hashtags.join(" ")}`} compact />

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Live post URL</span>
          <input
            value={externalUrl}
            onChange={(event) => setExternalUrl(event.target.value)}
            placeholder="Paste public post URL"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold text-slate-800 outline-none ring-blue-100 transition focus:border-blue-400 focus:ring-2"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Post ID</span>
          <input
            value={externalPostId}
            onChange={(event) => setExternalPostId(event.target.value)}
            placeholder="Optional platform ID"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold text-slate-800 outline-none ring-blue-100 transition focus:border-blue-400 focus:ring-2"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <QuickCopyButton label="Caption" value={post.caption} icon={<Clipboard className="h-4 w-4" />} />
        <QuickCopyButton label="Hashtags" value={post.hashtags.join(" ")} icon={<Hash className="h-4 w-4" />} />
        <QuickCopyButton label="CTA" value={video.primary_cta} icon={<Megaphone className="h-4 w-4" />} />
        <a
          href={platformPublishLinks[post.platform]}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-800 transition hover:bg-slate-50"
        >
          <ExternalLink className="h-4 w-4" />
          Open platform
        </a>
        {post.external_url ? (
          <a
            href={post.external_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 transition hover:bg-emerald-100"
          >
            <ExternalLink className="h-4 w-4" />
            Open live post
          </a>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <ActionButton
          disabled={pending || !approved}
          label="Ready"
          icon={<Smartphone className="h-4 w-4" />}
          onClick={() => onPlatformAction(post.id, "manual_publish_ready")}
        />
        <ActionButton
          disabled={pending || !approved}
          label="Scheduled"
          icon={<CalendarClock className="h-4 w-4" />}
          onClick={() => onPlatformAction(post.id, "schedule")}
          tone="green"
        />
        <ActionButton
          disabled={pending || !approved}
          label="Mark posted"
          icon={<CheckCircle2 className="h-4 w-4" />}
          onClick={() => {
            const hasProof = externalUrl.trim() || externalPostId.trim();
            if (!hasProof) {
              window.alert("Paste the live post URL or platform post ID first.");
              return;
            }
            const confirmed = window.confirm("Mark this platform post as published?\n\nThis records the public proof link or post ID in the content ledger.");
            if (confirmed) onPlatformAction(post.id, "mark_published", publishProofBody());
          }}
          tone="green"
        />
        <ActionButton
          disabled={pending}
          label="Reset"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={() => onPlatformAction(post.id, "reset")}
        />
      </div>

      {!approved ? (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
          Approve this video draft before preparing, scheduling, or confirming platform publication.
        </p>
      ) : null}
    </div>
  );
}

function EmptyState({ pending, onGenerate }: { pending: boolean; onGenerate: () => void }) {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        <Clapperboard className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-2xl font-black text-slate-950">No daily reels generated yet.</h2>
      <button
        type="button"
        disabled={pending}
        onClick={onGenerate}
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-60"
      >
        <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
        Generate daily reels
      </button>
    </section>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );
}

function ContentMetric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={cn("mt-2 font-black text-slate-950", compact ? "text-sm leading-5" : "text-2xl")}>{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/60 bg-white/70 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] opacity-60">{label}</div>
      <div className="mt-1 text-lg font-black capitalize">{value}</div>
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-white/60 bg-white/70 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-60">{title}</p>
      <div className="mt-2 space-y-1.5">
        {items.length > 0 ? (
          items.map((item) => (
            <p key={item} className="text-xs font-bold leading-5">
              {item}
            </p>
          ))
        ) : (
          <p className="text-xs font-bold leading-5 opacity-70">More data needed.</p>
        )}
      </div>
    </div>
  );
}

function PerformanceBadge({
  intelligence,
}: {
  intelligence: DailyContentSummary["intelligence"][string];
}) {
  const classes =
    intelligence.label === "Winner"
      ? "bg-emerald-50 text-emerald-700"
      : intelligence.label === "Underperforming"
        ? "bg-rose-50 text-rose-700"
        : intelligence.label === "Learning"
          ? "bg-slate-100 text-slate-600"
          : "bg-blue-50 text-blue-700";

  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]", classes)}>
      {intelligence.label}
      {intelligence.paidAdCandidate ? " / paid test" : ""}
    </span>
  );
}

function LibraryStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-black text-white">{value}</div>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">{detail}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]", statusStyles[status] ?? statusStyles.draft)}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function MiniPill({ icon, text }: { icon: JSX.Element; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
      {icon}
      {text}
    </span>
  );
}

function SectionHeader({ icon, title, light = false }: { icon: JSX.Element; title: string; light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", light ? "bg-white/10 text-white" : "bg-blue-50 text-blue-700")}>
        {icon}
      </div>
      <h2 className={cn("text-xl font-black", light ? "text-white" : "text-slate-950")}>{title}</h2>
    </div>
  );
}

function InsightBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-bold leading-6 text-slate-800">{value}</div>
    </div>
  );
}

function extractRepurposedAssets(sourceContext: Record<string, unknown>): RepurposeDisplayAsset[] {
  const raw = sourceContext.repurposedAssets;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const label = stringValue(record.label);
      const copy = stringValue(record.copy);
      if (!label || !copy) return null;
      return {
        channel: stringValue(record.channel) ?? label,
        label,
        copy,
        recommendedUse: stringValue(record.recommendedUse) ?? "Review before use.",
        approvalRequired: record.approvalRequired !== false,
        humanAction: stringValue(record.humanAction) ?? "Review, edit, and approve before use.",
      };
    })
    .filter((item): item is RepurposeDisplayAsset => Boolean(item));
}

function extractOrganicToPaidPlan(sourceContext: Record<string, unknown>) {
  const raw = sourceContext.organicToPaidPlan;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const recommendationTrigger = stringValue(record.recommendationTrigger);
  const budgetSuggestion = stringValue(record.budgetSuggestion);
  const ctaSuggestion = stringValue(record.ctaSuggestion);
  if (!recommendationTrigger || !budgetSuggestion || !ctaSuggestion) return null;
  return { recommendationTrigger, budgetSuggestion, ctaSuggestion };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function CopyBlock({ label, value, compact = false, dark = false }: { label: string; value: string; compact?: boolean; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn("mt-4 rounded-lg border p-4", dark ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50")}>
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", dark ? "text-slate-400" : "text-slate-500")}>{label}</p>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-black", dark ? "bg-white/10 text-white hover:bg-white/15" : "bg-white text-slate-700 hover:bg-slate-100")}
        >
          <Clipboard className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className={cn("mt-2 whitespace-pre-line text-sm font-semibold leading-6", compact && "line-clamp-4", dark ? "text-slate-200" : "text-slate-700")}>
        {value}
      </p>
    </div>
  );
}

function QuickCopyButton({
  label,
  value,
  icon,
  dark = false,
}: {
  label: string;
  value: string;
  icon: JSX.Element;
  dark?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition",
        dark
          ? "border border-white/10 bg-white/10 text-white hover:bg-white/15"
          : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
      )}
    >
      {icon}
      {copied ? "Copied" : label}
    </button>
  );
}

function RegenerateButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: JSX.Element;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {icon}
      {label}
    </button>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  tone = "blue",
}: {
  label: string;
  icon: JSX.Element;
  onClick: () => void;
  disabled?: boolean;
  tone?: "blue" | "green" | "red";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-black text-white disabled:opacity-60",
        tone === "green" ? "bg-emerald-600 hover:bg-emerald-500" : tone === "red" ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function buildExportManifest(video: DailyVideoContentRow, posts: DailyVideoPlatformPostRow[]) {
  const leadPost = posts[0];
  const storyboard = (video.storyboard.length ? video.storyboard : [
    {
      time: "0-6s",
      visual: video.thumbnail_concept || video.angle,
      caption: video.video_hook,
      motion: "Static preview until storyboard is generated.",
      voiceover: video.voiceover_script || video.full_script,
    },
  ])
    .map((scene, index) => `${index + 1}. ${scene.time} - ${scene.caption}\nVisual: ${scene.visual}\nMotion: ${scene.motion}\nVoiceover: ${scene.voiceover}`)
    .join("\n\n");

  return [
    "HomeReach Social Video Export",
    `Title: ${video.title}`,
    `Status: ${video.status}`,
    `Vertical: ${verticalLabels[video.vertical]}`,
    `Hook: ${video.video_hook}`,
    `CTA: ${video.primary_cta}`,
    `Voiceover:\n${video.voiceover_script}`,
    `Thumbnail: ${video.thumbnail_concept}`,
    `Caption:\n${leadPost?.caption ?? video.platform_posts.facebook_reels ?? video.video_hook}`,
    `Hashtags: ${video.hashtags.join(" ")}`,
    `Storyboard:\n${storyboard}`,
    "Approval note: Publish manually only after human review.",
  ].join("\n\n");
}

function buildRenderedVideoOverlay(video: DailyVideoContentRow, scenes: StoryboardSceneLike[], currentTime: number) {
  if (currentTime >= 8) return { caption: scenes[4]?.caption ?? video.primary_cta };
  if (currentTime >= 6) return { caption: scenes[3]?.caption ?? video.primary_cta };
  if (currentTime >= 4) return { caption: scenes[2]?.caption ?? video.primary_cta };
  if (currentTime >= 2) return { caption: scenes[1]?.caption ?? video.video_hook };
  return { caption: video.video_hook };
}

type StoryboardSceneLike = {
  caption: string;
};

function buildRegenerationBrief(video: DailyVideoContentRow, mode: "script" | "cta" | "visuals" | "voice") {
  const base = [
    "AI Reel Command Center regeneration brief",
    `Mode: ${mode}`,
    `Vertical: ${verticalLabels[video.vertical]}`,
    `Title: ${video.title}`,
    `Hook: ${video.video_hook}`,
    `CTA: ${video.primary_cta}`,
    `Tone: ${video.emotional_tone}`,
    `Music: ${video.suggested_music_vibe}`,
  ];

  if (mode === "script") {
    return [
      ...base,
      "Rewrite the reel script for stronger first-3-second retention, more emotional owner recognition, and a clearer direct-response CTA.",
      "Keep claims approval-safe. Do not invent verified savings, customers, or guarantees.",
      `Current script:\n${video.full_script}`,
    ].join("\n\n");
  }

  if (mode === "cta") {
    return [
      ...base,
      "Generate 10 social-native CTA variations optimized for comments, DMs, and booked conversations.",
      "Favor simple comment prompts like SAVE, MAP, SUPPLY, or GROWTH. Avoid fake urgency and unsupported guarantees.",
    ].join("\n\n");
  }

  if (mode === "voice") {
    return [
      ...base,
      "Regenerate the voiceover direction so it sounds natural, emotionally believable, confident, and not corporate.",
      `Current voiceover:\n${video.voiceover_script}`,
    ].join("\n\n");
  }

  return [
    ...base,
    "Regenerate the visual direction for realistic AI b-roll with believable people, real business environments, no provider-rendered text, and a premium final-card background.",
    "HomeReach will add controlled English captions and final-card text after render. Do not create generic SaaS dashboard montages, random graphics, or cartoon visuals.",
    `Storyboard:\n${video.storyboard.map((scene, index) => `${index + 1}. ${scene.time} - ${scene.visual}`).join("\n")}`,
  ].join("\n\n");
}

function resolveVideoAsset(video: DailyVideoContentRow) {
  const higgsfield = resolveHiggsfieldRender(video.canva_job);
  const candidates = collectUrls(video.canva_job);
  const videoUrl =
    higgsfield.fileUrl ??
    candidates.find((url) => /\.(mp4|mov|webm)(\?|#|$)/i.test(url)) ??
    candidates.find((url) => /video|render|download|export/i.test(url)) ??
    null;
  const sourceUrl =
    higgsfield.sourceUrl ??
    candidates.find((url) => /higgsfield|generation|job|canva\.com|design|edit/i.test(url)) ??
    videoUrl;
  return {
    url: videoUrl,
    sourceUrl,
    provider: higgsfield.fileUrl ? "Higgsfield" : sourceUrl?.includes("canva") ? "source" : "source",
    providerStatus: higgsfield.providerStatus,
    dryRun: higgsfield.dryRun,
    error: higgsfield.error,
  };
}

function resolveHiggsfieldRender(value: unknown) {
  const root = asRecord(value);
  const render = asRecord(root.higgsfield);
  const urls = collectUrls(render);
  return {
    fileUrl: asString(render.fileUrl) ?? asString(render.videoUrl) ?? urls.find((url) => /\.(mp4|mov|webm)(\?|#|$)/i.test(url)) ?? null,
    sourceUrl: asString(render.sourceUrl) ?? urls.find((url) => /higgsfield|generation|job/i.test(url)) ?? null,
    providerStatus: asString(render.providerStatus),
    dryRun: render.dryRun === true,
    error: asString(render.error),
  };
}

function collectUrls(value: unknown): string[] {
  const urls = new Set<string>();
  function walk(input: unknown) {
    if (!input) return;
    if (typeof input === "string") {
      if (/^https?:\/\//i.test(input)) urls.add(input);
      return;
    }
    if (Array.isArray(input)) {
      input.forEach(walk);
      return;
    }
    if (typeof input === "object") {
      Object.values(input as Record<string, unknown>).forEach(walk);
    }
  }
  walk(value);
  return [...urls];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function LogoOutroPreview() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center">
      <div className="relative h-28 w-28 [perspective:700px]">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_22%,#ffffff,#cbd5e1_24%,#475569_58%,#0f172a)] shadow-[0_24px_60px_rgba(15,23,42,0.65)] [animation:homeReachCoinSpin_4s_ease-in-out_infinite] [transform-style:preserve-3d]">
          <div className="absolute inset-3 flex items-center justify-center rounded-full border border-white/40 bg-slate-950/20 text-4xl font-black text-white shadow-inner">
            H
          </div>
        </div>
      </div>
      <div className="mt-6 text-center">
        <div className="text-2xl font-black tracking-tight text-white">HomeReach</div>
        <div className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-300">AI-Powered Operational Execution</div>
      </div>
      <style jsx>{`
        @keyframes homeReachCoinSpin {
          0% { transform: rotateX(64deg) rotateZ(0deg); }
          35% { transform: rotateX(64deg) rotateZ(80deg); }
          72% { transform: rotateX(64deg) rotateZ(720deg); }
          100% { transform: rotateX(64deg) rotateZ(760deg); }
        }
      `}</style>
    </div>
  );
}
