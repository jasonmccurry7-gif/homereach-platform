"use client";

import type React from "react";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleStop,
  ClipboardList,
  Download,
  Gauge,
  Loader2,
  Mic2,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  XCircle,
} from "lucide-react";
import type {
  ExecutiveActionApproval,
  ExecutiveAgent,
  ExecutiveAgentCommitment,
  ExecutiveAgentReport,
  ExecutiveBoardroomMode,
  ExecutiveChatData,
  ExecutiveMeeting,
  ExecutiveMeetingOutcome,
  ExecutiveMeetingParticipant,
  ExecutiveMeetingTranscriptEntry,
  ExecutiveMeetingType,
  ExecutiveRiskLevel,
} from "@/lib/executive-meetings/types";
import { cn } from "@/lib/utils";

type ActionState = {
  tone: "success" | "error";
  message: string;
} | null;

type VoiceState = "idle" | "connecting" | "connected" | "error";

type ParticipantView = {
  key: string;
  name: string;
  title: string;
  status: "Working" | "Researching" | "Analyzing" | "Writing" | "Executing" | "Waiting" | "Blocked" | "Needs Approval" | "Completed";
  assignment: string;
  performance: string;
  voice: string;
  seatIndex: number;
  active: boolean;
  enabled: boolean;
  roleInMeeting: string;
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

function recognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scopedWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scopedWindow.SpeechRecognition ?? scopedWindow.webkitSpeechRecognition ?? null;
}

export function ExecutiveBoardroom({
  data,
  requestedMeetingId,
}: {
  data: ExecutiveChatData;
  requestedMeetingId?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedMeetingId, setSelectedMeetingId] = useState(
    data.meetings.some((meeting) => meeting.id === requestedMeetingId)
      ? requestedMeetingId ?? ""
      : data.selectedMeeting?.id ?? "",
  );
  const selectedMeeting = useMemo(
    () => data.meetings.find((meeting) => meeting.id === selectedMeetingId) ?? data.selectedMeeting,
    [data.meetings, data.selectedMeeting, selectedMeetingId],
  );
  const [mode, setMode] = useState<ExecutiveBoardroomMode>(modeForMeeting(selectedMeeting?.meetingType ?? "morning"));
  const [workingAction, setWorkingAction] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [activeSpeakerKey, setActiveSpeakerKey] = useState("executive_secretary");
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<ExecutiveMeetingTranscriptEntry[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceActiveRef = useRef(false);
  const voiceProcessingRef = useRef(false);

  const selectedReports = useMemo(
    () => data.agentReports.filter((report) => report.meetingId === selectedMeeting?.id),
    [data.agentReports, selectedMeeting?.id],
  );
  const reportByAgent = useMemo(() => {
    const map = new Map<string, ExecutiveAgentReport>();
    selectedReports.forEach((report) => map.set(report.agentKey, report));
    return map;
  }, [selectedReports]);
  const selectedParticipants = useMemo(
    () => data.participants.filter((participant) => participant.meetingId === selectedMeeting?.id),
    [data.participants, selectedMeeting?.id],
  );
  const selectedTranscript = useMemo(() => {
    const persisted = data.transcriptEntries.filter((entry) => entry.meetingId === selectedMeeting?.id);
    const derived = persisted.length ? persisted : deriveTranscript(selectedMeeting, selectedReports);
    return [...derived, ...liveTranscript.filter((entry) => entry.meetingId === selectedMeeting?.id)]
      .sort((a, b) => a.sequence - b.sequence);
  }, [data.transcriptEntries, liveTranscript, selectedMeeting, selectedReports]);
  const selectedOutcomes = useMemo(
    () => data.outcomes.filter((outcome) => outcome.meetingId === selectedMeeting?.id),
    [data.outcomes, selectedMeeting?.id],
  );
  const selectedApprovals = useMemo(
    () => data.approvals.filter((approval) => approval.meetingId === selectedMeeting?.id || approval.approvalStatus === "pending"),
    [data.approvals, selectedMeeting?.id],
  );
  const selectedCommitments = useMemo(
    () => data.commitments.filter((commitment) => !selectedMeeting?.id || commitment.meetingId === selectedMeeting.id).slice(0, 18),
    [data.commitments, selectedMeeting?.id],
  );
  const participants = useMemo(
    () => buildParticipants({
      agents: data.agents,
      meeting: selectedMeeting,
      participants: selectedParticipants,
      reportByAgent,
      activeSpeakerKey,
    }),
    [activeSpeakerKey, data.agents, reportByAgent, selectedMeeting, selectedParticipants],
  );

  async function run(action: string, body: Record<string, unknown> = {}, success = "Saved") {
    setActionState(null);
    setWorkingAction(action);
    try {
      const response = await fetch("/api/admin/executive-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        setActionState({ tone: "error", message: String(result.error ?? "Action failed") });
        return;
      }
      setActionState({ tone: "success", message: result.reused ? "Existing executive session opened." : success });
      if (typeof result.meetingId === "string") {
        setSelectedMeetingId(result.meetingId);
        window.history.replaceState(null, "", `/admin/executive-chat?meetingId=${encodeURIComponent(result.meetingId)}`);
      }
      startTransition(() => router.refresh());
    } catch (error) {
      setActionState({ tone: "error", message: error instanceof Error ? error.message : "Action failed" });
    } finally {
      setWorkingAction(null);
    }
  }

  function generateMeeting(meetingType: ExecutiveMeetingType) {
    setMode(modeForMeeting(meetingType));
    const label =
      meetingType === "morning"
        ? "Morning standup generated."
        : meetingType === "afternoon"
          ? "Afternoon review generated."
          : meetingType === "emergency"
            ? "Emergency operations meeting generated."
            : "Strategic planning session generated.";
    void run("generate_meeting", { meetingType }, label);
  }

  function selectMeeting(meeting: ExecutiveMeeting) {
    setSelectedMeetingId(meeting.id);
    setMode(modeForMeeting(meeting.meetingType));
    window.history.replaceState(null, "", `/admin/executive-chat?meetingId=${encodeURIComponent(meeting.id)}`);
  }

  async function connectVoice() {
    if (!selectedMeeting) {
      setVoiceState("error");
      setVoiceMessage("Generate or select a meeting before starting voice.");
      return;
    }
    const Recognition = recognitionCtor();
    if (!Recognition) {
      setVoiceState("error");
      setVoiceMessage("This browser does not expose speech recognition. Use Chrome or Edge for live voice chat.");
      return;
    }

    setVoiceState("connecting");
    setVoiceMessage("Starting browser voice conversation...");
    try {
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        const finalText = Array.from({ length: event.results.length }, (_, index) => event.results[index])
          .filter((item) => item?.isFinal)
          .map((item) => item?.[0]?.transcript ?? "")
          .join(" ")
          .trim();
        if (finalText) void handleBrowserVoiceTurn(finalText);
      };
      recognition.onerror = (event) => {
        setVoiceState("error");
        setVoiceMessage(`Speech capture issue: ${event.error ?? "unknown"}`);
      };
      recognition.onend = () => {
        if (voiceActiveRef.current && !voiceProcessingRef.current) {
          try {
            recognition.start();
          } catch {
            setVoiceMessage("Voice capture paused. Press End Voice, then Start Voice to reconnect.");
          }
        }
      };
      recognitionRef.current = recognition;
      voiceActiveRef.current = true;
      recognition.start();
      setVoiceState("connected");
      setVoiceMessage("Executive voice chat is live. Ask the team what is being worked on, what changed, or what needs a decision.");
    } catch (error) {
      disconnectVoice();
      setVoiceState("error");
      setVoiceMessage(error instanceof Error ? error.message : "Voice chat failed.");
    }
  }

  function disconnectVoice() {
    voiceActiveRef.current = false;
    voiceProcessingRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setVoiceState("idle");
    setVoiceMessage("Executive voice chat ended.");
  }

  async function handleBrowserVoiceTurn(utterance: string) {
    if (!selectedMeeting || voiceProcessingRef.current) return;
    voiceProcessingRef.current = true;
    recognitionRef.current?.stop();
    const baseSequence = selectedTranscript.length + liveTranscript.length + 1;
    const humanEntry = localTranscriptEntry({
      meeting: selectedMeeting,
      statement: utterance,
      speakerKey: "human_admin",
      speakerName: "Administrator",
      speakerTitle: "Administrator",
      speakerType: "human_admin",
      sequence: baseSequence,
    });
    setLiveTranscript((current) => [...current, humanEntry]);
    setActiveSpeakerKey("human_admin");
    setVoiceMessage("Executive team is answering...");

    try {
      const response = await fetch("/api/admin/executive-chat/voice-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: selectedMeeting.id,
          utterance,
          preferredAgentKey: activeSpeakerKey,
          meetingMode: mode,
          contextSource: "executive_boardroom",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(String(result.error ?? "Executive voice turn failed."));
      }
      const reply = stringValue(result.reply, "I do not have a response yet.");
      const speakerKey = stringValue(result.speakerKey, "executive_secretary");
      const speakerName = stringValue(result.speakerName, "Executive Secretary");
      const speakerTitle = stringValue(result.speakerTitle, "Executive Secretary");
      const replyEntry = localTranscriptEntry({
        meeting: selectedMeeting,
        statement: reply,
        speakerKey,
        speakerName,
        speakerTitle,
        speakerType: speakerKey === "executive_secretary" ? "facilitator" : "ai_executive",
        sequence: baseSequence + 1,
      });
      setLiveTranscript((current) => [...current, replyEntry]);
      setActiveSpeakerKey(speakerKey);
      setVoiceMessage(`${speakerTitle} responded${result.persisted === false ? " without DB transcript persistence" : ""}.`);
      speakReply(reply, () => {
        voiceProcessingRef.current = false;
        restartRecognition();
      });
    } catch (error) {
      voiceProcessingRef.current = false;
      setVoiceState("error");
      setVoiceMessage(error instanceof Error ? error.message : "Executive voice turn failed.");
      restartRecognition();
    }
  }

  function restartRecognition() {
    if (!voiceActiveRef.current || !recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setVoiceState("connected");
    } catch {
      setVoiceMessage("Voice chat is ready, but capture paused. End Voice and Start Voice if it does not resume.");
    }
  }

  function speakReply(text: string, onDone: () => void) {
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

  const actionItems = selectedOutcomes.filter((item) => item.outcomeType === "action_item");
  const decisions = selectedOutcomes.filter((item) => item.outcomeType === "decision");
  const risks = selectedOutcomes.filter((item) => item.outcomeType === "risk");
  const scorecards = selectedOutcomes.filter((item) => item.outcomeType === "scorecard_update");
  const visibleTranscript = selectedTranscript.filter((entry) =>
    transcriptSearch.trim()
      ? `${entry.speakerName} ${entry.speakerTitle} ${entry.statement}`.toLowerCase().includes(transcriptSearch.toLowerCase())
      : true,
  );

  return (
    <main className="min-h-screen bg-[#060a12] text-white" data-testid="executive-boardroom">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col">
        <BoardroomHeader
          actionState={actionState}
          data={data}
          isPending={isPending}
          mode={mode}
          selectedMeeting={selectedMeeting}
          setMode={setMode}
          voiceMessage={voiceMessage}
          voiceState={voiceState}
          workingAction={workingAction}
          onDisconnectVoice={disconnectVoice}
          onGenerateMeeting={generateMeeting}
          onStartVoice={() => void connectVoice()}
        />

        <section className="grid flex-1 gap-4 px-3 pb-4 pt-3 lg:px-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="grid min-h-[720px] gap-4 2xl:grid-cols-[280px_minmax(0,1fr)]">
            <MeetingRail meetings={data.meetings} selectedMeeting={selectedMeeting} onSelect={selectMeeting} />
            <div className="space-y-4">
              <BoardroomScene
                actionItems={actionItems.length}
                approvals={selectedApprovals.length}
                decisions={decisions.length}
                mode={mode}
                participants={participants}
                selectedMeeting={selectedMeeting}
                risks={risks.length}
                setActiveSpeakerKey={setActiveSpeakerKey}
              />
              <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                <OutcomePanel actionItems={actionItems} decisions={decisions} risks={risks} />
                <ApprovalPanel approvals={selectedApprovals} onAction={run} workingAction={workingAction} />
              </div>
              <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                <CommitmentPanel commitments={selectedCommitments} />
                <ScorecardPanel agents={data.agents} reports={selectedReports} scorecards={scorecards} />
              </div>
            </div>
          </div>

          <TranscriptPanel
            entries={visibleTranscript}
            fullEntries={selectedTranscript}
            search={transcriptSearch}
            setActiveSpeakerKey={setActiveSpeakerKey}
            setSearch={setTranscriptSearch}
          />
        </section>
      </div>
    </main>
  );
}

function BoardroomHeader({
  actionState,
  data,
  isPending,
  mode,
  selectedMeeting,
  setMode,
  voiceMessage,
  voiceState,
  workingAction,
  onDisconnectVoice,
  onGenerateMeeting,
  onStartVoice,
}: {
  actionState: ActionState;
  data: ExecutiveChatData;
  isPending: boolean;
  mode: ExecutiveBoardroomMode;
  selectedMeeting: ExecutiveMeeting | null;
  setMode: (mode: ExecutiveBoardroomMode) => void;
  voiceMessage: string | null;
  voiceState: VoiceState;
  workingAction: string | null;
  onDisconnectVoice: () => void;
  onGenerateMeeting: (meetingType: ExecutiveMeetingType) => void;
  onStartVoice: () => void;
}) {
  const emergencyActive = data.sourceSnapshot.totals.failedOrRiskEvents > 0 || data.sourceSnapshot.warnings.length > 0;
  return (
    <header className="border-b border-white/10 bg-[#080d17]/95 px-3 py-4 shadow-2xl shadow-black/30 backdrop-blur-xl lg:px-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-300">
            <span className="inline-flex min-h-8 items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 text-emerald-100">
              <Users className="h-3.5 w-3.5" />
              Executive Leadership Team
            </span>
            <span className="inline-flex min-h-8 items-center rounded-md border border-white/10 bg-white/[0.05] px-3">
              {selectedMeeting ? selectedMeeting.title : "No meeting selected"}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">AI Executive Boardroom</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-400">
            <span>{data.summary.enabledAgents} executives online</span>
            <span>{data.summary.pendingApprovals} approvals</span>
            <span>{money(data.summary.estimatedRevenue)} revenue awaiting approval</span>
            <span>{money(data.summary.estimatedSavings)} savings awaiting review</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <ModeButton active={mode === "morning_standup"} label="Morning Standup" onClick={() => setMode("morning_standup")} />
            <ModeButton active={mode === "afternoon_review"} label="Afternoon Review" onClick={() => setMode("afternoon_review")} />
            <ModeButton active={mode === "strategic_planning"} label="Strategic Planning" onClick={() => setMode("strategic_planning")} />
            <ModeButton active={mode === "emergency_operations"} alert={emergencyActive} label="Emergency Ops" onClick={() => setMode("emergency_operations")} />
          </div>
          <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
            <CommandButton
              icon={Play}
              label="Run Morning"
              loading={workingAction === "generate_meeting" && isPending}
              onClick={() => onGenerateMeeting("morning")}
              testId="executive-run-morning"
            />
            <CommandButton
              icon={Gauge}
              label="Run Afternoon"
              loading={workingAction === "generate_meeting" && isPending}
              onClick={() => onGenerateMeeting("afternoon")}
              testId="executive-run-afternoon"
            />
            <CommandButton
              icon={Target}
              label="Strategic"
              loading={workingAction === "generate_meeting" && isPending}
              onClick={() => onGenerateMeeting("strategic")}
              testId="executive-run-strategic"
            />
            <CommandButton
              icon={AlertTriangle}
              label="Emergency"
              loading={workingAction === "generate_meeting" && isPending}
              onClick={() => onGenerateMeeting("emergency")}
              testId="executive-run-emergency"
            />
            <CommandButton
              icon={voiceState === "connected" ? CircleStop : Mic2}
              label={voiceState === "connected" ? "End Voice" : voiceState === "connecting" ? "Connecting" : "Start Voice"}
              loading={voiceState === "connecting"}
              onClick={voiceState === "connected" ? onDisconnectVoice : onStartVoice}
              testId="executive-start-voice"
            />
          </div>
        </div>
      </div>
      {(actionState || voiceMessage) ? (
        <div className={cn(
          "mt-3 rounded-md border px-3 py-2 text-sm font-semibold",
          actionState?.tone === "error" || voiceState === "error"
            ? "border-rose-300/25 bg-rose-300/10 text-rose-50"
            : "border-emerald-300/25 bg-emerald-300/10 text-emerald-50",
        )}>
          {actionState?.message ?? voiceMessage}
        </div>
      ) : null}
    </header>
  );
}

function BoardroomScene({
  actionItems,
  approvals,
  decisions,
  mode,
  participants,
  risks,
  selectedMeeting,
  setActiveSpeakerKey,
}: {
  actionItems: number;
  approvals: number;
  decisions: number;
  mode: ExecutiveBoardroomMode;
  participants: ParticipantView[];
  selectedMeeting: ExecutiveMeeting | null;
  risks: number;
  setActiveSpeakerKey: (key: string) => void;
}) {
  const visibleSeats = participants.slice(0, 14);
  const overflow = Math.max(0, participants.length - visibleSeats.length);
  return (
    <section className="relative min-h-[620px] overflow-hidden rounded-lg border border-white/10 bg-[#0a101c] shadow-2xl shadow-black/30">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01)),radial-gradient(circle_at_50%_55%,rgba(20,184,166,0.18),transparent_36%)]" />
      <div className="absolute inset-x-0 top-0 h-28 border-b border-white/5 bg-[linear-gradient(180deg,rgba(148,163,184,0.12),transparent)]" />

      <div className="relative z-10 flex min-h-[620px] items-center justify-center p-4">
        <div className="relative h-[520px] w-full max-w-5xl">
          <div className="absolute left-1/2 top-1/2 h-[240px] w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-[44px] border border-white/15 bg-[linear-gradient(135deg,rgba(30,41,59,0.98),rgba(2,6,23,0.98))] shadow-[0_32px_120px_rgba(0,0,0,0.55)]">
            <div className="absolute inset-5 rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
            <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
              <p className="text-xs font-bold uppercase text-cyan-100">{labelForMode(mode)}</p>
              <h2 className="mt-2 max-w-2xl text-2xl font-black text-white sm:text-3xl">
                {selectedMeeting?.title ?? "Executive Leadership Team"}
              </h2>
              <p className="mt-3 line-clamp-3 max-w-3xl text-sm leading-6 text-slate-300">
                {selectedMeeting?.ceoSummary ?? "Generate a boardroom session to assemble the executive team."}
              </p>
              <div className="mt-5 grid w-full max-w-2xl grid-cols-4 gap-2">
                <BoardMetric label="Decisions" value={decisions} />
                <BoardMetric label="Approvals" value={approvals} />
                <BoardMetric label="Risks" value={risks} />
                <BoardMetric label="Actions" value={actionItems} />
              </div>
            </div>
          </div>

          {visibleSeats.map((participant, index) => (
            <ParticipantSeat
              key={participant.key}
              participant={participant}
              seatStyle={seatStyle(index, visibleSeats.length)}
              onSelect={() => setActiveSpeakerKey(participant.key)}
            />
          ))}

          {overflow > 0 ? (
            <div className="absolute bottom-2 right-2 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-slate-200">
              +{overflow} additional participants ready
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ParticipantSeat({
  onSelect,
  participant,
  seatStyle,
}: {
  onSelect: () => void;
  participant: ParticipantView;
  seatStyle: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={seatStyle}
      data-testid="executive-agent-card"
      data-agent-key={participant.key}
      className={cn(
        "absolute flex w-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-lg border p-2 text-center transition",
        participant.active
          ? "border-cyan-200 bg-cyan-200/15 shadow-[0_0_46px_rgba(34,211,238,0.35)]"
          : "border-white/10 bg-black/35 hover:border-white/25 hover:bg-white/10",
      )}
    >
      <div className={cn(
        "relative flex h-14 w-14 items-center justify-center rounded-full border text-sm font-black",
        participant.active ? "border-cyan-200 bg-cyan-100 text-slate-950" : "border-white/10 bg-slate-900 text-slate-100",
      )}>
        {initials(participant.name)}
        {participant.active ? (
          <span className="absolute -inset-2 rounded-full border border-cyan-200/50 animate-ping" />
        ) : null}
      </div>
      <p className="mt-2 w-full truncate text-xs font-black text-white">{participant.name}</p>
      <p className="w-full truncate text-[11px] font-semibold text-slate-400">{participant.title}</p>
      <div
        className="mt-2 w-full"
        data-testid="executive-agent-activation"
        data-agent-key={participant.key}
        data-activation-status={participant.status === "Blocked" ? "failed" : participant.enabled ? "joined" : "skipped_disabled"}
      >
        <StatusPill value={participant.status} tone={toneForStatus(participant.status)} />
      </div>
      <div className="mt-2 flex h-4 items-end gap-0.5" aria-hidden="true">
        {[0, 1, 2, 3].map((item) => (
          <span
            key={item}
            className={cn("w-1 rounded-full bg-cyan-200", participant.active ? "animate-pulse" : "opacity-25")}
            style={{ height: participant.active ? `${8 + item * 2}px` : "5px" }}
          />
        ))}
      </div>
    </button>
  );
}

function MeetingRail({
  meetings,
  onSelect,
  selectedMeeting,
}: {
  meetings: ExecutiveMeeting[];
  onSelect: (meeting: ExecutiveMeeting) => void;
  selectedMeeting: ExecutiveMeeting | null;
}) {
  return (
    <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-cyan-200" />
        <h2 className="text-sm font-black">Meeting Memory</h2>
      </div>
      <div className="space-y-2">
        {meetings.slice(0, 18).map((meeting) => (
          <button
            key={meeting.id}
            type="button"
            onClick={() => onSelect(meeting)}
            className={cn(
              "w-full rounded-md border px-3 py-3 text-left transition",
              selectedMeeting?.id === meeting.id
                ? "border-cyan-300/40 bg-cyan-300/10"
                : "border-white/10 bg-white/[0.025] hover:bg-white/[0.07]",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-black text-white">{meeting.title}</p>
              <StatusPill value={meeting.meetingType} tone={toneForMeeting(meeting.meetingType)} />
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">{shortDateTime(meeting.generatedAt)}</p>
          </button>
        ))}
        {meetings.length === 0 ? <EmptyState title="No meetings" detail="Run a boardroom session to create memory." /> : null}
      </div>
    </aside>
  );
}

function TranscriptPanel({
  entries,
  fullEntries,
  search,
  setActiveSpeakerKey,
  setSearch,
}: {
  entries: ExecutiveMeetingTranscriptEntry[];
  fullEntries: ExecutiveMeetingTranscriptEntry[];
  search: string;
  setActiveSpeakerKey: (key: string) => void;
  setSearch: (value: string) => void;
}) {
  function exportTranscript() {
    const lines = fullEntries.map((entry) => `[${shortTime(entry.startedAt)}] ${entry.speakerName} (${entry.speakerTitle}): ${entry.statement}`);
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `executive-boardroom-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <aside className="flex min-h-[720px] flex-col rounded-lg border border-white/10 bg-white/[0.04]">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-cyan-100">Live Meeting Transcript</p>
            <h2 className="mt-1 text-lg font-black">Boardroom Record</h2>
          </div>
          <button
            type="button"
            onClick={exportTranscript}
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-xs font-black text-slate-100 hover:bg-white hover:text-slate-950"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
        <label className="mt-3 flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-slate-950 px-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent text-sm font-semibold text-white outline-none"
            placeholder="Search transcript"
          />
        </label>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {entries.length ? entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setActiveSpeakerKey(entry.speakerKey)}
            className="block w-full rounded-md border border-white/10 bg-slate-950/55 p-3 text-left transition hover:bg-slate-900"
          >
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
              <span>{shortTime(entry.startedAt)}</span>
              <StatusPill value={entry.statementType} tone={entry.statementType === "risk" ? "rose" : entry.statementType === "decision" ? "amber" : "cyan"} />
            </div>
            <p className="mt-2 text-sm font-black text-white">{entry.speakerName}</p>
            <p className="text-xs font-semibold text-slate-400">{entry.speakerTitle}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{entry.statement}</p>
          </button>
        )) : <EmptyState title="No transcript entries" detail="Generated and live voice entries appear here." />}
      </div>
    </aside>
  );
}

function OutcomePanel({
  actionItems,
  decisions,
  risks,
}: {
  actionItems: ExecutiveMeetingOutcome[];
  decisions: ExecutiveMeetingOutcome[];
  risks: ExecutiveMeetingOutcome[];
}) {
  return (
    <Panel icon={Target} title="Meeting Deliverables">
      <div className="grid gap-3">
        <OutcomeColumn items={decisions} title="Decision Log" />
        <OutcomeColumn items={actionItems} title="Action Item Register" />
        <OutcomeColumn items={risks} title="Risk Register" />
      </div>
    </Panel>
  );
}

function OutcomeColumn({ items, title }: { items: ExecutiveMeetingOutcome[]; title: string }) {
  return (
    <div className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black text-white">{title}</p>
        <span className="text-xs font-bold text-slate-500">{items.length}</span>
      </div>
      <div className="mt-2 space-y-2">
        {items.slice(0, 5).map((item) => (
          <div key={item.id} className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="flex items-center gap-2">
              <StatusPill value={item.priority} tone={item.priority === "urgent" ? "rose" : item.priority === "high" ? "amber" : "slate"} />
              <StatusPill value={item.status} tone={item.status === "needs_approval" ? "amber" : item.status === "blocked" ? "rose" : "emerald"} />
            </div>
            <p className="mt-2 text-sm font-bold text-slate-100">{item.title}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
          </div>
        ))}
        {items.length === 0 ? <p className="text-sm text-slate-500">None recorded.</p> : null}
      </div>
    </div>
  );
}

function ApprovalPanel({
  approvals,
  onAction,
  workingAction,
}: {
  approvals: ExecutiveActionApproval[];
  onAction: (action: string, body?: Record<string, unknown>, success?: string) => Promise<void>;
  workingAction: string | null;
}) {
  return (
    <Panel icon={ShieldCheck} title="Approval Queue">
      <div className="space-y-3">
        {approvals.slice(0, 6).map((approval) => (
          <ApprovalCard key={approval.id} approval={approval} onAction={onAction} workingAction={workingAction} />
        ))}
        {approvals.length === 0 ? <EmptyState title="No approvals" detail="Approval-sensitive executive decisions appear here." /> : null}
      </div>
    </Panel>
  );
}

function ApprovalCard({
  approval,
  onAction,
  workingAction,
}: {
  approval: ExecutiveActionApproval;
  onAction: (action: string, body?: Record<string, unknown>, success?: string) => Promise<void>;
  workingAction: string | null;
}) {
  const [editedAction, setEditedAction] = useState(approval.editedAction ?? approval.pendingAction);
  const [decisionReason, setDecisionReason] = useState(approval.decisionReason ?? "");
  const loading = workingAction === "update_approval";
  const canDecide = approval.approvalStatus === "pending" || approval.approvalStatus === "edited";

  function decide(approvalStatus: ExecutiveActionApproval["approvalStatus"]) {
    void onAction(
      "update_approval",
      {
        approvalId: approval.id,
        approvalStatus,
        editedAction: approvalStatus === "edited" ? editedAction : undefined,
        decisionReason,
      },
      `Approval marked ${approvalStatus}.`,
    );
  }

  return (
    <article className="rounded-md border border-white/10 bg-black/25 p-3" data-testid="executive-approval-card" data-approval-id={approval.id}>
      <div className="flex flex-wrap items-center gap-2">
        <RiskPill risk={approval.riskLevel} />
        <StatusPill value={approval.approvalStatus} tone={approval.approvalStatus === "pending" ? "amber" : approval.approvalStatus === "rejected" ? "rose" : "emerald"} />
      </div>
      <p className="mt-2 text-sm font-black text-white">{approval.pendingAction}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{approval.businessReason}</p>
      {canDecide ? (
        <div className="mt-3 space-y-2">
          <input
            value={editedAction}
            onChange={(event) => setEditedAction(event.target.value)}
            data-testid="executive-approval-edited-action"
            className="min-h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-semibold text-white outline-none"
          />
          <input
            value={decisionReason}
            onChange={(event) => setDecisionReason(event.target.value)}
            data-testid="executive-approval-decision-reason"
            className="min-h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-semibold text-white outline-none"
            placeholder="Decision note"
          />
          <div className="flex flex-wrap gap-2">
            <SmallButton icon={CheckCircle2} label="Approve" loading={loading} onClick={() => decide("approved")} testId="executive-approval-approve" />
            <SmallButton icon={ClipboardList} label="Edit" loading={loading} onClick={() => decide("edited")} testId="executive-approval-edit" variant="secondary" />
            <SmallButton icon={XCircle} label="Reject" loading={loading} onClick={() => decide("rejected")} testId="executive-approval-reject" variant="danger" />
          </div>
        </div>
      ) : null}
    </article>
  );
}

function CommitmentPanel({ commitments }: { commitments: ExecutiveAgentCommitment[] }) {
  return (
    <Panel icon={ClipboardList} title="Commitment Tracker">
      <div className="space-y-2">
        {commitments.slice(0, 8).map((item) => (
          <div key={item.id} className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill value={item.status} tone={item.status === "completed" ? "emerald" : item.status === "blocked" || item.status === "missed" ? "rose" : "cyan"} />
              <RiskPill risk={item.riskLevel} />
            </div>
            <p className="mt-2 text-sm font-bold text-slate-100">{item.commitmentText}</p>
            <p className="mt-1 text-xs text-slate-500">{item.domain} / {item.followUpDate ?? item.commitmentDate}</p>
          </div>
        ))}
        {commitments.length === 0 ? <EmptyState title="No commitments" detail="Agent commitments appear after generated meetings." /> : null}
      </div>
    </Panel>
  );
}

function ScorecardPanel({
  agents,
  reports,
  scorecards,
}: {
  agents: ExecutiveAgent[];
  reports: ExecutiveAgentReport[];
  scorecards: ExecutiveMeetingOutcome[];
}) {
  return (
    <Panel icon={BarChart3} title="Executive Scorecard">
      <div className="grid gap-2 sm:grid-cols-2">
        {agents.filter((agent) => agent.enabled).slice(0, 10).map((agent) => {
          const report = reports.find((item) => item.agentKey === agent.agentKey);
          const acceptedSignals = scorecards.filter((item) => item.ownerKey === agent.agentKey).length;
          return (
            <div key={agent.id} className="rounded-md border border-white/10 bg-black/20 p-2">
              <p className="truncate text-sm font-black text-white">{agent.role.replace(/\s+Agent$/i, "")}</p>
              <p className="mt-1 text-xs text-slate-500">{agent.name}</p>
              <div className="mt-2 grid grid-cols-3 gap-1 text-center text-xs font-bold text-slate-300">
                <span>{report ? Math.round(report.confidenceScore) : 0}%</span>
                <span>{report?.decisionsNeededJson.length ?? 0} recs</span>
                <span>{acceptedSignals} KPIs</span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Panel({ children, icon: Icon, title }: { children: React.ReactNode; icon: typeof Users; title: string }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/20">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-200" />
        <h2 className="text-sm font-black text-slate-200">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ModeButton({ active, alert, label, onClick }: { active: boolean; alert?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative min-h-10 rounded-md border px-3 text-xs font-black transition",
        active ? "border-cyan-200 bg-cyan-200 text-slate-950" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white",
      )}
    >
      {alert ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-400" /> : null}
      {label}
    </button>
  );
}

function CommandButton({
  icon: Icon,
  label,
  loading,
  onClick,
  testId,
}: {
  icon: typeof Play;
  label: string;
  loading?: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={loading}
      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-white px-3 text-xs font-black text-slate-950 transition hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-70"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

function SmallButton({
  icon: Icon,
  label,
  loading,
  onClick,
  testId,
  variant = "primary",
}: {
  icon: typeof CheckCircle2;
  label: string;
  loading?: boolean;
  onClick: () => void;
  testId?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      data-testid={testId}
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-black transition disabled:cursor-wait disabled:opacity-70",
        variant === "primary" && "bg-white text-slate-950 hover:bg-emerald-50",
        variant === "secondary" && "border border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white hover:text-slate-950",
        variant === "danger" && "border border-rose-300/25 bg-rose-300/10 text-rose-100 hover:bg-rose-200 hover:text-rose-950",
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function BoardMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 px-3 py-2">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function StatusPill({ tone = "slate", value }: { tone?: "emerald" | "amber" | "cyan" | "rose" | "slate"; value: string }) {
  return (
    <span className={cn(
      "inline-flex min-h-6 items-center rounded-md border px-2 text-[11px] font-black capitalize",
      tone === "emerald" && "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
      tone === "amber" && "border-amber-300/25 bg-amber-300/10 text-amber-100",
      tone === "cyan" && "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
      tone === "rose" && "border-rose-300/25 bg-rose-300/10 text-rose-100",
      tone === "slate" && "border-white/10 bg-white/[0.05] text-slate-300",
    )}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

function RiskPill({ risk }: { risk: ExecutiveRiskLevel }) {
  return <StatusPill value={`${risk} risk`} tone={risk === "critical" || risk === "high" ? "rose" : risk === "medium" ? "amber" : "emerald"} />;
}

function EmptyState({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="rounded-md border border-dashed border-white/10 bg-white/[0.025] p-5 text-center">
      <Sparkles className="mx-auto h-5 w-5 text-slate-500" />
      <p className="mt-2 text-sm font-black text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function buildParticipants(input: {
  agents: ExecutiveAgent[];
  meeting: ExecutiveMeeting | null;
  participants: ExecutiveMeetingParticipant[];
  reportByAgent: Map<string, ExecutiveAgentReport>;
  activeSpeakerKey: string;
}): ParticipantView[] {
  if (input.participants.length > 0) {
    return input.participants
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((participant) => {
        const report = input.reportByAgent.get(participant.participantKey);
        return {
          key: participant.participantKey,
          name: participant.displayName,
          title: participant.title,
          status: statusForParticipant(participant, report),
          assignment: participant.currentAssignment || report?.prioritiesJson[0]?.title || "Meeting attendance",
          performance: performanceFor(participant.performanceJson, report),
          voice: participant.voiceProfileKey ?? "openai_voice_marin",
          seatIndex: participant.seatIndex,
          active: input.activeSpeakerKey === participant.participantKey,
          enabled: participant.attendanceStatus !== "blocked",
          roleInMeeting: participant.roleInMeeting,
        };
      });
  }

  const enabledAgents = input.agents.filter((agent) => agent.enabled && !agent.archivedAt);
  return [
    secretaryParticipant(input.activeSpeakerKey),
    ...enabledAgents.map((agent, index) => {
      const report = input.reportByAgent.get(agent.agentKey);
      return {
        key: agent.agentKey,
        name: agent.name,
        title: cleanTitle(agent.role),
        status: statusForAgent(agent, report),
        assignment: report?.prioritiesJson[0]?.title ?? report?.plannedWorkJson[0]?.title ?? agent.dailyResponsibilities[0] ?? agent.mission,
        performance: report ? `${Math.round(report.confidenceScore)}% confidence` : "Waiting for report",
        voice: voiceForAgent(agent.agentKey),
        seatIndex: index + 1,
        active: input.activeSpeakerKey === agent.agentKey,
        enabled: true,
        roleInMeeting: "voting_member",
      };
    }),
    chiefOfStaffParticipant(input.activeSpeakerKey, enabledAgents.length + 1),
  ];
}

function secretaryParticipant(activeSpeakerKey: string): ParticipantView {
  return {
    key: "executive_secretary",
    name: "Executive Secretary",
    title: "Executive Secretary",
    status: "Executing",
    assignment: "Agenda, speaker order, action capture",
    performance: "Structure active",
    voice: "openai_voice_cedar",
    seatIndex: 0,
    active: activeSpeakerKey === "executive_secretary",
    enabled: true,
    roleInMeeting: "facilitator",
  };
}

function chiefOfStaffParticipant(activeSpeakerKey: string, seatIndex: number): ParticipantView {
  return {
    key: "chief_of_staff",
    name: "Chief of Staff",
    title: "Chief of Staff",
    status: "Writing",
    assignment: "Notes, decisions, owners, due dates",
    performance: "Silent capture",
    voice: "openai_voice_sage",
    seatIndex,
    active: activeSpeakerKey === "chief_of_staff",
    enabled: true,
    roleInMeeting: "silent_note_taker",
  };
}

function statusForParticipant(participant: ExecutiveMeetingParticipant, report: ExecutiveAgentReport | undefined): ParticipantView["status"] {
  if (participant.attendanceStatus === "blocked") return "Blocked";
  if (participant.roleInMeeting === "facilitator") return "Executing";
  if (participant.roleInMeeting === "silent_note_taker") return "Writing";
  if (report?.blockersJson.some((item) => item.needsHuman)) return "Needs Approval";
  if (report?.risksJson.some((item) => item.severity === "critical" || item.severity === "high")) return "Analyzing";
  if (report) return "Completed";
  return "Waiting";
}

function statusForAgent(agent: ExecutiveAgent, report: ExecutiveAgentReport | undefined): ParticipantView["status"] {
  if (!agent.enabled) return "Waiting";
  if (report?.blockersJson.some((item) => item.needsHuman)) return "Needs Approval";
  if (report?.risksJson.some((item) => item.severity === "critical" || item.severity === "high")) return "Analyzing";
  if (report) return "Completed";
  if (agent.permissionsLevel === "draft_only") return "Writing";
  if (agent.permissionsLevel === "analysis_only") return "Researching";
  return "Working";
}

function performanceFor(performance: Record<string, unknown>, report: ExecutiveAgentReport | undefined) {
  const confidence = Number(performance.confidenceScore ?? report?.confidenceScore ?? 0);
  if (confidence > 0) return `${Math.round(confidence)}% confidence`;
  return report ? `${report.kpiSnapshotJson.length} KPI signals` : "Waiting for report";
}

function deriveTranscript(meeting: ExecutiveMeeting | null, reports: ExecutiveAgentReport[]): ExecutiveMeetingTranscriptEntry[] {
  if (!meeting) return [];
  let sequence = 1;
  const now = meeting.generatedAt;
  const entry = (
    speakerKey: string,
    speakerName: string,
    speakerTitle: string,
    statement: string,
    statementType: ExecutiveMeetingTranscriptEntry["statementType"],
  ): ExecutiveMeetingTranscriptEntry => ({
    id: `derived-${meeting.id}-${sequence}`,
    meetingId: meeting.id,
    participantId: null,
    speakerKey,
    speakerName,
    speakerTitle,
    speakerType: speakerKey === "executive_secretary" ? "facilitator" : speakerKey === "chief_of_staff" ? "observer" : "ai_executive",
    sequence: sequence++,
    startedAt: now,
    endedAt: null,
    statement,
    statementType,
    source: "generated_report",
    metadataJson: { derivedFromAgentReports: true, externalActionAuthorized: false },
    createdAt: now,
  });

  return [
    entry("executive_secretary", "Executive Secretary", "Executive Secretary", `Opening ${meeting.title}.`, "opening"),
    ...reports.map((report) =>
      entry(report.agentKey, report.agentName, cleanTitle(report.role), `${report.summary} ${report.prioritiesJson[0]?.detail ?? ""}`.trim(), "agent_report"),
    ),
    entry("chief_of_staff", "Chief of Staff", "Chief of Staff", meeting.ceoSummary, "summary"),
  ];
}

function localTranscriptEntry(input: {
  meeting: ExecutiveMeeting;
  statement: string;
  speakerKey: string;
  speakerName: string;
  speakerTitle: string;
  speakerType: ExecutiveMeetingTranscriptEntry["speakerType"];
  sequence: number;
}): ExecutiveMeetingTranscriptEntry {
  const now = new Date().toISOString();
  return {
    id: `live-${input.meeting.id}-${Date.now()}`,
    meetingId: input.meeting.id,
    participantId: null,
    speakerKey: input.speakerKey,
    speakerName: input.speakerName,
    speakerTitle: input.speakerTitle,
    speakerType: input.speakerType,
    sequence: input.sequence,
    startedAt: now,
    endedAt: null,
    statement: input.statement,
    statementType: input.speakerType === "human_admin" ? "user" : "summary",
    source: "live_voice",
    metadataJson: { source: "browser_voice_conversation", externalActionAuthorized: false },
    createdAt: now,
  };
}

function modeForMeeting(meetingType: ExecutiveMeetingType): ExecutiveBoardroomMode {
  if (meetingType === "afternoon") return "afternoon_review";
  if (meetingType === "strategic") return "strategic_planning";
  if (meetingType === "emergency") return "emergency_operations";
  return "morning_standup";
}

function labelForMode(mode: ExecutiveBoardroomMode) {
  if (mode === "afternoon_review") return "Afternoon Executive Review";
  if (mode === "strategic_planning") return "Strategic Planning Session";
  if (mode === "emergency_operations") return "Emergency Operations Meeting";
  return "Morning Executive Standup";
}

function voiceForAgent(agentKey: string) {
  const voiceByAgent: Record<string, string> = {
    ceo: "marin",
    cto: "cedar",
    cmo: "coral",
    cro: "verse",
    cfo: "sage",
    operations: "ash",
    chief_outreach_officer: "ballad",
    continuous_improvement: "echo",
    qa_risk: "cedar",
    customer_success: "shimmer",
  };
  return voiceByAgent[agentKey] ?? "marin";
}

function cleanTitle(role: string) {
  return role.replace(/\s+Agent$/i, "").trim() || "Executive Leader";
}

function seatStyle(index: number, total: number): React.CSSProperties {
  const angle = (-90 + (360 / Math.max(total, 1)) * index) * (Math.PI / 180);
  const x = 50 + Math.cos(angle) * 43;
  const y = 50 + Math.sin(angle) * 39;
  return { left: `${x}%`, top: `${y}%` };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function toneForStatus(status: ParticipantView["status"]): "emerald" | "amber" | "cyan" | "rose" | "slate" {
  if (status === "Completed") return "emerald";
  if (status === "Needs Approval") return "amber";
  if (status === "Blocked") return "rose";
  if (status === "Waiting") return "slate";
  return "cyan";
}

function toneForMeeting(meetingType: ExecutiveMeetingType): "emerald" | "amber" | "cyan" | "rose" | "slate" {
  if (meetingType === "emergency") return "rose";
  if (meetingType === "strategic") return "amber";
  if (meetingType === "afternoon") return "emerald";
  return "cyan";
}

function shortDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function shortTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(new Date(value));
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
