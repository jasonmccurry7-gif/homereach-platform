import { NextResponse, type NextRequest } from "next/server";
import {
  answerCandidateAgentChat,
  type CandidateAgentChatMessage,
} from "@/lib/political/candidate-agent-chat";
import { isPoliticalEnabled } from "@/lib/political/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatPayload = {
  candidate?: string;
  message?: string;
  messages?: CandidateAgentChatMessage[];
};

function isSupportedCandidate(candidate: string | undefined) {
  return candidate === "amy-acton" || candidate === "acton" || candidate === "public-acton-source-backed-profile";
}

export async function POST(req: NextRequest) {
  if (!isPoliticalEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Political Command Center is disabled." },
      { status: 404 },
    );
  }

  let payload: ChatPayload;
  try {
    payload = (await req.json()) as ChatPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid chat payload." },
      { status: 400 },
    );
  }

  if (!isSupportedCandidate(payload.candidate)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Select a supported candidate before opening a campaign-specific chat.",
      },
      { status: 400 },
    );
  }

  const message = (payload.message ?? "").trim();
  if (!message) {
    return NextResponse.json(
      { ok: false, error: "Type a question before sending." },
      { status: 400 },
    );
  }

  const result = await answerCandidateAgentChat(
    message,
    Array.isArray(payload.messages) ? payload.messages : [],
  );

  return NextResponse.json({
    ok: true,
    reply: result.reply,
    mode: result.mode,
  });
}
