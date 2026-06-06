"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CirclePause,
  ClipboardCheck,
  Loader2,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Volume2,
  XCircle,
} from "lucide-react";
import type {
  AgentBriefingRow,
  VoiceActionRow,
  VoiceCommandCenterData,
  VoiceSessionRow,
} from "@/lib/voice-command-center/repository";
import { cn } from "@/lib/utils";

type Props = {
  data: VoiceCommandCenterData;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type ConversationMessage = {
  id: string;
  speaker: string;
  role: "admin" | "executive";
  text: string;
  createdAt: string;
};

function recognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scopedWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scopedWindow.SpeechRecognition ?? scopedWindow.webkitSpeechRecognition ?? null;
}

export function VoiceCommandCenter({ data }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [session, setSession] = useState<VoiceSessionRow | null>(null);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(data.queueError);
  const [selectedAction, setSelectedAction] = useState<VoiceActionRow | null>(null);
  const [rewriteBody, setRewriteBody] = useState("");
  const [latestBriefing, setLatestBriefing] = useState<AgentBriefingRow | null>(data.briefings[0] ?? null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [conversationBusy, setConversationBusy] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceSessionActiveRef = useRef(false);
  const voiceTurnPendingRef = useRef(false);

  const pendingActions = useMemo(
    () => data.actions.filter((action) => action.status === "draft" || action.status === "pending_approval"),
    [data.actions],
  );
  const approvedActions = useMemo(
    () => data.actions.filter((action) => action.status === "approved"),
    [data.actions],
  );
  const recentlySent = useMemo(
    () => data.actions.filter((action) => action.status === "sent").slice(0, 6),
    [data.actions],
  );

  async function postJson(path: string, payload: Record<string, unknown>) {
    setErrorMessage(null);
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.ok === false) {
      throw new Error(typeof result?.error === "string" ? result.error : "Command failed");
    }
    return result;
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function syncQueue() {
    try {
      setStatusMessage("Syncing approval queue...");
      const result = await postJson("/api/admin/voice-command-center/sync", {});
      setStatusMessage(`Synced ${result.synced ?? 0} approval item${result.synced === 1 ? "" : "s"}.`);
      refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sync failed");
    }
  }

  async function startSession() {
    try {
      const result = await postJson("/api/admin/voice-command-center/session", {
        intent: "start",
        modelUsed: "browser_transcript_phase_1",
      });
      setSession(result.session);
      setTranscript("");
      setInterimTranscript("");
      setConversationMessages([]);
      setStatusMessage("Voice session started. Ask the executive team for live feedback.");

      const Recognition = recognitionCtor();
      if (!Recognition) {
        setStatusMessage("Voice session started. Browser speech capture is unavailable in this browser.");
        return;
      }

      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let index = 0; index < event.results.length; index += 1) {
          const resultItem = event.results[index];
          if (!resultItem) continue;
          if (resultItem.isFinal) finalText += `${resultItem[0]?.transcript ?? ""} `;
          else interimText += `${resultItem[0]?.transcript ?? ""} `;
        }
        if (finalText.trim()) {
          const spoken = finalText.trim();
          setTranscript((current) => `${current} ${spoken}`.trim());
          void sendExecutiveConversationTurn(spoken);
        }
        setInterimTranscript(interimText.trim());
      };
      recognition.onerror = (event) => {
        setErrorMessage(`Speech capture issue: ${event.error ?? "unknown"}`);
      };
      recognition.onend = () => {
        if (voiceSessionActiveRef.current && !voiceTurnPendingRef.current) {
          try {
            recognition.start();
          } catch {
            setStatusMessage("Voice capture paused. End and restart the session if it does not resume.");
          }
        }
      };
      recognitionRef.current = recognition;
      voiceSessionActiveRef.current = true;
      recognition.start();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not start voice session");
    }
  }

  async function endSession() {
    try {
      voiceSessionActiveRef.current = false;
      voiceTurnPendingRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      const activeTranscript = [transcript, interimTranscript].filter(Boolean).join(" ").trim();
      const summary = activeTranscript
        ? `Session captured ${activeTranscript.split(/\s+/).length} spoken words for review.`
        : "Session ended without captured transcript.";
      if (session) {
        await postJson("/api/admin/voice-command-center/session", {
          intent: "end",
          sessionId: session.id,
          transcript: activeTranscript,
          summary,
        });
      }
      setStatusMessage(summary);
      setSession(null);
      setInterimTranscript("");
      refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not end voice session");
    }
  }

  async function generateBriefing(briefingType: "morning" | "afternoon" | "on_demand") {
    try {
      const result = await postJson("/api/admin/voice-command-center/briefing", { briefingType });
      setLatestBriefing(result.briefing);
      setStatusMessage(`${briefingType.replace("_", " ")} briefing generated.`);
      refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not generate briefing");
    }
  }

  function speakBriefing() {
    if (!latestBriefing || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(latestBriefing.summary);
    utterance.rate = 0.95;
    utterance.pitch = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  async function sendExecutiveConversationTurn(spokenText?: string) {
    const utterance = (spokenText ?? transcript).trim();
    if (!utterance || voiceTurnPendingRef.current) return;
    voiceTurnPendingRef.current = true;
    setConversationBusy(true);
    recognitionRef.current?.stop();
    const now = new Date().toISOString();
    const adminMessage: ConversationMessage = {
        id: `admin-${Date.now()}`,
        speaker: "Administrator",
        role: "admin",
        text: utterance,
        createdAt: now,
    };
    setConversationMessages((current) => [...current, adminMessage].slice(-12));
    setStatusMessage("Executive team is answering...");

    try {
      const result = await postJson("/api/admin/executive-chat/voice-turn", {
        utterance,
        preferredAgentKey: "ceo",
        contextSource: "voice_command_center",
      });
      const reply = typeof result.reply === "string" ? result.reply : "I do not have a response yet.";
      const speaker = typeof result.speakerTitle === "string" ? result.speakerTitle : "Executive Leadership";
      const executiveMessage: ConversationMessage = {
          id: `executive-${Date.now()}`,
          speaker,
          role: "executive",
          text: reply,
          createdAt: new Date().toISOString(),
      };
      setConversationMessages((current) => [...current, executiveMessage].slice(-12));
      setStatusMessage(`${speaker} responded${result.persisted === false ? " without DB transcript persistence" : ""}.`);
      speakText(reply, () => {
        voiceTurnPendingRef.current = false;
        setConversationBusy(false);
        restartRecognition();
      });
    } catch (error) {
      voiceTurnPendingRef.current = false;
      setConversationBusy(false);
      setErrorMessage(error instanceof Error ? error.message : "Executive voice conversation failed");
      restartRecognition();
    }
  }

  function restartRecognition() {
    if (!voiceSessionActiveRef.current || !recognitionRef.current) return;
    try {
      recognitionRef.current.start();
    } catch {
      setStatusMessage("Voice chat is ready, but capture paused. End and restart the session if it does not resume.");
    }
  }

  function speakText(text: string, onDone: () => void) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onDone();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    utterance.pitch = 0.98;
    utterance.onend = onDone;
    utterance.onerror = onDone;
    window.speechSynthesis.speak(utterance);
  }

  async function runAction(intent: "approve" | "reject" | "pause" | "send_now", action: VoiceActionRow) {
    try {
      const result = await postJson("/api/admin/voice-command-center/actions", {
        intent,
        actionId: action.id,
        sessionId: session?.id ?? null,
        approvalPhrase: transcript || `${intent} ${action.subject ?? action.business_name ?? action.id}`,
        transcriptSnippet: transcript.slice(-500),
        confidenceScore: transcript ? 0.82 : 1,
      });
      setStatusMessage(
        intent === "send_now" && result.error
          ? result.error
          : `${intent.replace("_", " ")} recorded.`,
      );
      refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Action failed");
    }
  }

  async function rewriteSelected() {
    if (!selectedAction || !rewriteBody.trim()) return;
    try {
      await postJson("/api/admin/voice-command-center/actions", {
        intent: "rewrite",
        actionId: selectedAction.id,
        messageBody: rewriteBody,
        sessionId: session?.id ?? null,
        approvalPhrase: transcript || "Rewrite this approval item",
        transcriptSnippet: transcript.slice(-500),
        confidenceScore: transcript ? 0.78 : 1,
      });
      setSelectedAction(null);
      setRewriteBody("");
      setStatusMessage("Rewrite saved and returned to pending approval.");
      refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Rewrite failed");
    }
  }

  async function pauseAll() {
    try {
      const result = await postJson("/api/admin/voice-command-center/actions", {
        intent: "pause_all",
        sessionId: session?.id ?? null,
        approvalPhrase: transcript || "Pause all outbound",
        transcriptSnippet: transcript.slice(-500),
        confidenceScore: transcript ? 0.86 : 1,
      });
      setStatusMessage(`Paused ${result.paused ?? 0} outbound queue item${result.paused === 1 ? "" : "s"}.`);
      refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Pause all failed");
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 pb-24 lg:pb-0">
      <section className="overflow-hidden rounded-xl bg-slate-950 text-white shadow-xl">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.08fr_0.92fr] lg:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
              <Mic className="h-4 w-4" />
              Voice Approval + Executive Feedback Center
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
              Speak with the executive team and keep every outbound action gated.
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-300 sm:text-base">
              Ask what is being worked on, hear outcome feedback, review approvals, and keep external sends blocked until explicit human approval.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={session ? endSession : startSession}
                disabled={isPending}
                className={cn(
                  "inline-flex min-h-12 items-center gap-2 rounded-lg px-4 text-sm font-black transition",
                  session
                    ? "bg-white text-slate-950 hover:bg-slate-100"
                    : "bg-cyan-300 text-slate-950 hover:bg-cyan-200",
                )}
              >
                {session ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {session ? "End Voice Session" : "Start Voice Session"}
              </button>
              <button
                type="button"
                onClick={syncQueue}
                className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/15"
              >
                <RefreshCw className="h-4 w-4" />
                Sync Queue
              </button>
              <button
                type="button"
                onClick={pauseAll}
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-red-500 px-4 text-sm font-black text-white transition hover:bg-red-400"
              >
                <CirclePause className="h-4 w-4" />
                Pause All Outbound
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Pending Approval" value={data.metrics.pendingApproval} tone="amber" />
            <Metric label="Approved Unsent" value={data.metrics.approvedUnsent} tone="emerald" />
            <Metric label="High Risk" value={data.metrics.highRisk} tone="red" />
            <Metric label="Approval Backlog" value={data.metrics.approvalBacklog} tone="blue" />
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-4">
        <SafetyPanel label="Mode" value={data.safety.mode.replace("_", " ")} ok={data.safety.mode !== "live"} />
        <SafetyPanel label="External Sends" value={data.safety.externalSendingEnabled ? "Enabled" : "Blocked"} ok={!data.safety.externalSendingEnabled} />
        <SafetyPanel label="SMS Sends" value={data.safety.smsSendingEnabled ? "Enabled" : "Blocked"} ok={!data.safety.smsSendingEnabled} />
        <SafetyPanel label="Global Pause" value={data.safety.globalOutboundPaused ? "On" : "Off"} ok />
      </section>

      {(statusMessage || errorMessage || !data.enabled) ? (
        <section className={cn(
          "rounded-xl border p-4 text-sm font-bold",
          errorMessage || !data.enabled
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-emerald-200 bg-emerald-50 text-emerald-900",
        )}>
          {errorMessage ?? statusMessage ?? "Voice Command Center feature flag is currently disabled. The admin-safe shell is available, but activation should happen through environment settings."}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">Live transcript</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Current session</h2>
            </div>
            <span className={cn(
              "rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em]",
              session ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
            )}>
              {session ? "listening" : "idle"}
            </span>
          </div>
          <div className="mt-4 min-h-52 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">
            {transcript || interimTranscript ? (
              <>
                <p>{transcript}</p>
                {interimTranscript ? <p className="text-slate-400">{interimTranscript}</p> : null}
              </>
            ) : (
              <p className="text-slate-500">No transcript captured yet.</p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void sendExecutiveConversationTurn()}
              disabled={!transcript.trim() || conversationBusy}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {conversationBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Ask Executive Team
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-200"
            >
              <MicOff className="h-4 w-4" />
              Stop Speaking
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">Current speaking agent</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                {latestBriefing?.agent_name ?? "CEO Agent"}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => generateBriefing("morning")} className="min-h-10 rounded-lg bg-slate-950 px-3 text-xs font-black text-white">Morning</button>
              <button type="button" onClick={() => generateBriefing("afternoon")} className="min-h-10 rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-800">Afternoon</button>
              <button type="button" onClick={speakBriefing} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-50 px-3 text-xs font-black text-blue-800">
                <Volume2 className="h-4 w-4" />
                Speak
              </button>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold leading-6 text-blue-950">
              {latestBriefing?.summary ?? "Generate a briefing to hear the executive summary for today."}
            </p>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-600">Live executive conversation</p>
              <span className={cn(
                "rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
                conversationBusy ? "bg-blue-100 text-blue-700" : "bg-white text-slate-500",
              )}>
                {conversationBusy ? "answering" : "ready"}
              </span>
            </div>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {conversationMessages.length ? conversationMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "rounded-lg border p-3",
                    message.role === "admin"
                      ? "border-slate-200 bg-white text-slate-800"
                      : "border-blue-100 bg-blue-50 text-blue-950",
                  )}
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{message.speaker}</p>
                  <p className="mt-1 text-sm font-semibold leading-6">{message.text}</p>
                </div>
              )) : (
                <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm font-semibold text-slate-600">
                  Start a voice session and ask the executive team what is being worked on, what changed, or what needs a decision.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <QueuePanel title="Pending approval queue" actions={pendingActions} empty="No pending voice actions." onRun={runAction} onRewrite={(action) => {
          setSelectedAction(action);
          setRewriteBody(action.body);
        }} />
        <QueuePanel title="Approved but unsent queue" actions={approvedActions} empty="No approved unsent actions." onRun={runAction} onRewrite={(action) => {
          setSelectedAction(action);
          setRewriteBody(action.body);
        }} approved />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Recently sent communications</h2>
          <div className="mt-4 space-y-3">
            {recentlySent.length ? recentlySent.map((action) => (
              <ActionMiniRow key={action.id} action={action} />
            )) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                No sent communications in the current voice queue snapshot.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Audit trail</h2>
          <div className="mt-4 space-y-3">
            {data.audits.length ? data.audits.map((audit) => (
              <div key={audit.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-black text-slate-950">{audit.event_type.replaceAll("_", " ")}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{audit.notes ?? "Logged event"}</p>
              </div>
            )) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                Audit entries appear after session, approval, rewrite, pause, or send-now events.
              </p>
            )}
          </div>
        </div>
      </section>

      {selectedAction ? (
        <section className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">Rewrite action</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">{selectedAction.subject ?? selectedAction.business_name ?? selectedAction.action_type}</h2>
            </div>
            <button type="button" onClick={() => setSelectedAction(null)} className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
          <textarea
            value={rewriteBody}
            onChange={(event) => setRewriteBody(event.target.value)}
            className="mt-3 min-h-32 w-full rounded-lg border border-slate-200 p-3 text-sm font-semibold leading-6 text-slate-800 outline-none focus:border-blue-400"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setSelectedAction(null)} className="min-h-10 rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-700">Cancel</button>
            <button type="button" onClick={rewriteSelected} className="min-h-10 rounded-lg bg-slate-950 px-3 text-xs font-black text-white">Save Rewrite</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "amber" | "emerald" | "red" | "blue" }) {
  const toneClass =
    tone === "amber"
      ? "text-amber-100"
      : tone === "emerald"
        ? "text-emerald-100"
        : tone === "red"
          ? "text-red-100"
          : "text-blue-100";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={cn("mt-2 text-3xl font-black", toneClass)}>{value}</p>
    </div>
  );
}

function SafetyPanel({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border p-4 shadow-sm",
      ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900",
    )}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-[0.16em]">{label}</p>
        {ok ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      </div>
      <p className="mt-2 text-lg font-black capitalize">{value}</p>
    </div>
  );
}

function QueuePanel({
  title,
  actions,
  empty,
  approved = false,
  onRun,
  onRewrite,
}: {
  title: string;
  actions: VoiceActionRow[];
  empty: string;
  approved?: boolean;
  onRun: (intent: "approve" | "reject" | "pause" | "send_now", action: VoiceActionRow) => void;
  onRewrite: (action: VoiceActionRow) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-slate-950">{title}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{actions.length}</span>
      </div>
      <div className="mt-4 space-y-3">
        {actions.length ? actions.map((action) => (
          <article key={action.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <Badge label={action.channel} />
                  <Badge label={action.risk_level} tone={action.risk_level === "high" ? "red" : "slate"} />
                  <Badge label={action.status.replace("_", " ")} tone={approved ? "green" : "amber"} />
                </div>
                <h3 className="mt-2 text-base font-black text-slate-950">{action.subject ?? action.business_name ?? action.action_type}</h3>
                <p className="mt-1 line-clamp-3 text-sm font-semibold leading-6 text-slate-600">{action.body}</p>
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-48">
                {!approved ? (
                  <button type="button" onClick={() => onRun("approve", action)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 text-xs font-black text-white">
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </button>
                ) : (
                  <button type="button" onClick={() => onRun("send_now", action)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-slate-950 px-2 text-xs font-black text-white">
                    <Send className="h-4 w-4" />
                    Send
                  </button>
                )}
                <button type="button" onClick={() => onRun("reject", action)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-red-50 px-2 text-xs font-black text-red-700">
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
                <button type="button" onClick={() => onRewrite(action)} className="min-h-10 rounded-lg bg-blue-50 px-2 text-xs font-black text-blue-800">Rewrite</button>
                <button type="button" onClick={() => onRun("pause", action)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-amber-50 px-2 text-xs font-black text-amber-800">
                  <CirclePause className="h-4 w-4" />
                  Hold
                </button>
              </div>
            </div>
          </article>
        )) : (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-600">{empty}</p>
        )}
      </div>
    </section>
  );
}

function Badge({ label, tone = "slate" }: { label: string; tone?: "slate" | "red" | "amber" | "green" }) {
  const toneClass =
    tone === "red"
      ? "bg-red-50 text-red-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-800"
        : tone === "green"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-white text-slate-600";
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]", toneClass)}>
      {label}
    </span>
  );
}

function ActionMiniRow({ action }: { action: VoiceActionRow }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-950">{action.subject ?? action.business_name ?? action.action_type}</p>
        <ClipboardCheck className="h-4 w-4 text-emerald-600" />
      </div>
      <p className="mt-1 text-xs font-semibold text-slate-600">{action.channel} / {action.sent_at ?? "sent"}</p>
    </div>
  );
}
