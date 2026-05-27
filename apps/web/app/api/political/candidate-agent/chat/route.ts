import { NextResponse, type NextRequest } from "next/server";
import {
  answerCandidateAgentChat,
  resolveCandidateAgentChatContext,
  type CandidateAgentChatMessage,
} from "@/lib/political/candidate-agent-chat";
import { isPoliticalEnabled } from "@/lib/political/env";
import {
  checkPublicRateLimit,
  publicRateLimitHeaders,
} from "@/lib/security/public-rate-limit";
import type { OhioCandidateSelectorOption } from "@/lib/political/ohio-candidate-selector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatPayload = {
  candidate?: string;
  candidateProfile?: Partial<OhioCandidateSelectorOption>;
  message?: string;
  messages?: CandidateAgentChatMessage[];
};

const POLITICAL_CHAT_RATE_LIMIT = {
  scope: "political:candidate-agent-chat",
  limit: 30,
  windowMs: 5 * 60_000,
};

export async function POST(req: NextRequest) {
  if (!isPoliticalEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Political Command Center is disabled." },
      { status: 404 },
    );
  }

  const rateLimit = checkPublicRateLimit(req, POLITICAL_CHAT_RATE_LIMIT);
  const headers = publicRateLimitHeaders(rateLimit);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many political chat requests." },
      { status: 429, headers },
    );
  }

  let payload: ChatPayload;
  try {
    payload = (await req.json()) as ChatPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid chat payload." },
      { status: 400, headers },
    );
  }

  const context = resolveCandidateAgentChatContext(payload.candidate, payload.candidateProfile);

  if (!context) {
    return NextResponse.json(
      {
        ok: false,
        error: "Select a supported candidate before opening a campaign-specific chat.",
      },
      { status: 400, headers },
    );
  }

  const message = (payload.message ?? "").trim();
  if (!message) {
    return NextResponse.json(
      { ok: false, error: "Type a question before sending." },
      { status: 400, headers },
    );
  }

  const result = await answerCandidateAgentChat(
    message,
    Array.isArray(payload.messages) ? payload.messages : [],
    context,
  );

  return NextResponse.json({
    ok: true,
    reply: result.reply,
    mode: result.mode,
  }, { headers });
}
