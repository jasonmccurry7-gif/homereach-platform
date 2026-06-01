"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Copy,
  ExternalLink,
  ImageIcon,
  Mail,
  Megaphone,
  MessageCircle,
  MousePointer2,
  Phone,
  Search,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type OutreachSubject = {
  sourceType: "sales_lead" | "campaign_candidate" | "manual";
  sourceId: string;
  businessLine: "targeted_mailing" | "inventory_procurement" | "political" | "unknown";
  displayName: string;
  city?: string | null;
  category?: string | null;
  email?: string | null;
  phone?: string | null;
  facebookUrl?: string | null;
  messengerUrl?: string | null;
  websiteUrl?: string | null;
};

type DraftResponse = {
  ok?: boolean;
  approvalId?: string;
  messageBody?: string;
  browserUrl?: string | null;
  senderEmail?: string | null;
  politicalOptionsImageUrl?: string | null;
  error?: string;
};

const BUTTON =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";

const JASON_EMAIL = "jason@home-reach.com";
const JASON_NAME = "Jason McCurry";
const PUBLIC_HOME_REACH_URL = "https://www.home-reach.com";

function safeUrl(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function messengerFallback(subject: OutreachSubject) {
  if (subject.messengerUrl) return safeUrl(subject.messengerUrl);
  const fb = safeUrl(subject.facebookUrl);
  if (!fb) return null;
  try {
    const parsed = new URL(fb);
    const slug = parsed.pathname.split("/").filter(Boolean)[0];
    return slug ? `https://www.facebook.com/messages/t/${slug}` : fb;
  } catch {
    return fb;
  }
}

function defaultCopy(subject: OutreachSubject) {
  if (subject.businessLine === "political") {
    return [
      `Hi ${subject.displayName} team,`,
      "",
      "I put together a clean four-option campaign mail snapshot so the team can compare voter reach, geography, cost per voter, and execution path.",
      "",
      "Screenshot:",
      politicalOptionsImageUrl(subject),
      "",
      "Would it help if I sent the route and voter-reach summary for review?",
    ].join("\n");
  }
  if (subject.businessLine === "inventory_procurement") {
    return `Hi ${subject.displayName}, HomeReach can review supplier pricing, receipts, invoices, and delivery costs to find hidden savings without adding work for your team. Would a quick savings check be useful?`;
  }
  return `Hi ${subject.displayName}, HomeReach helps local businesses reach nearby customers with AI-assisted outreach and postcard execution. Would you like me to send a quick local growth snapshot?`;
}

function emailSubject(subject: OutreachSubject) {
  if (subject.businessLine === "political") return `${subject.displayName} mail plan options ready`;
  if (subject.businessLine === "inventory_procurement") return `${subject.displayName} supplier cost review`;
  return `${subject.displayName} local growth snapshot`;
}

function jasonSignature() {
  return [JASON_NAME, "Founder | HomeReach", JASON_EMAIL, "Call/Text: +13302069639"].join("\n");
}

function emailBody(subject: OutreachSubject) {
  return [
    defaultCopy(subject),
    "",
    jasonSignature(),
  ].join("\n");
}

function buildJasonMailto(subject: OutreachSubject) {
  if (!subject.email) return undefined;
  const recipient = encodeURIComponent(subject.email);
  const subjectParam = encodeURIComponent(emailSubject(subject));
  const bodyParam = encodeURIComponent(emailBody(subject));
  return `mailto:${recipient}?subject=${subjectParam}&body=${bodyParam}`;
}

function politicalCandidateSlug(subject: OutreachSubject) {
  const name = subject.displayName.toLowerCase();
  if (name.includes("amy") && name.includes("acton")) return "amy-acton";
  return (
    subject.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90) ||
    "amy-acton"
  );
}

function politicalOptionsImageUrl(subject: OutreachSubject) {
  return `${PUBLIC_HOME_REACH_URL}/api/political/candidate-options-image?candidate=${encodeURIComponent(
    politicalCandidateSlug(subject),
  )}`;
}

export function MultiChannelActionRow({
  subject,
  compact = false,
}: {
  subject: OutreachSubject;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const facebookUrl = safeUrl(subject.facebookUrl);
  const websiteUrl = safeUrl(subject.websiteUrl);
  const messengerUrl = messengerFallback(subject);
  const hasSocialTarget = Boolean(facebookUrl || messengerUrl);
  const isPolitical = subject.businessLine === "political";
  const aiDraftChannel: "facebook_dm" | "manual" = hasSocialTarget ? "facebook_dm" : "manual";
  const aiDraftLoadingKey = `${aiDraftChannel}:dm`;
  const emailDraftLoadingKey = "email:email";
  const screenshotUrl = useMemo(() => (isPolitical ? politicalOptionsImageUrl(subject) : null), [isPolitical, subject]);
  const draftPreview = useMemo(() => defaultCopy(subject), [subject]);
  const emailHref = useMemo(() => buildJasonMailto(subject), [subject]);

  async function copyText(text = draftPreview) {
    await navigator.clipboard.writeText(text);
    setError(null);
    setFeedback("Copied.");
  }

  async function queueDraft(channel: "facebook_dm" | "email" | "sms" | "manual", mode = "dm") {
    setLoadingAction(`${channel}:${mode}`);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/social-outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...subject, channel, mode }),
      });
      const payload = (await response.json().catch(() => ({}))) as DraftResponse;
      if (!response.ok) {
        setError(payload.error ?? "Could not queue outreach draft.");
        return;
      }
      setFeedback(
        channel === "email" && payload.senderEmail
          ? `Email queued for approval from ${payload.senderEmail}.`
          : mode === "browser_assist"
            ? "Browser workflow queued."
            : "Draft queued for approval.",
      );
      startTransition(() => router.refresh());
      if (payload.browserUrl && mode === "browser_assist") {
        window.open(payload.browserUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not queue outreach draft.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className={cn("rounded-lg border border-slate-800 bg-slate-950/70 p-3", compact && "p-2")}>
      <div className="flex flex-wrap items-center gap-2">
        {isPolitical ? (
          <button
            type="button"
            title={`Queues a reviewed HomeReach email draft from ${JASON_EMAIL} with the four-option campaign screenshot.`}
            onClick={() => queueDraft("email", "email")}
            disabled={isPending || Boolean(loadingAction) || !subject.email}
            className={cn(
              BUTTON,
              "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
              !subject.email && "opacity-40",
            )}
          >
            <Mail className="h-3.5 w-3.5" />
            {loadingAction === emailDraftLoadingKey ? "Queueing..." : "Queue Email"}
          </button>
        ) : (
          <a
            href={emailHref}
            title={`Opens a Jason McCurry email draft. Confirm your mail client is sending from ${JASON_EMAIL} before sending.`}
            onClick={() => {
              if (emailHref) {
                setError(null);
                setFeedback(`Opening email draft for ${JASON_EMAIL}. Confirm sender before sending.`);
              }
            }}
            className={cn(
              BUTTON,
              "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
              !subject.email && "pointer-events-none opacity-40",
            )}
          >
            <Mail className="h-3.5 w-3.5" />
            Email
          </a>
        )}
        {isPolitical && (
          <a
            href={screenshotUrl ?? undefined}
            target="_blank"
            rel="noreferrer"
            title="Open the clean four-option campaign screenshot."
            className={cn(
              BUTTON,
              "border-amber-300/25 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20",
              !screenshotUrl && "pointer-events-none opacity-40",
            )}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Screenshot
          </a>
        )}
        <a
          href={subject.phone ? `tel:${subject.phone}` : undefined}
          className={cn(
            BUTTON,
            "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
            !subject.phone && "pointer-events-none opacity-40",
          )}
        >
          <Phone className="h-3.5 w-3.5" />
          Call
        </a>
        <a
          href={subject.phone ? `sms:${subject.phone}` : undefined}
          className={cn(
            BUTTON,
            "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
            !subject.phone && "pointer-events-none opacity-40",
          )}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          SMS
        </a>
        <a
          href={facebookUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          className={cn(
            BUTTON,
            "border-blue-300/25 bg-blue-400/10 text-blue-100 hover:bg-blue-400/20",
            !facebookUrl && "pointer-events-none opacity-40",
          )}
        >
          <Megaphone className="h-3.5 w-3.5" />
          Facebook
        </a>
        <a
          href={messengerUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          className={cn(
            BUTTON,
            "border-sky-300/25 bg-sky-400/10 text-sky-100 hover:bg-sky-400/20",
            !messengerUrl && "pointer-events-none opacity-40",
          )}
        >
          <Send className="h-3.5 w-3.5" />
          Messenger
        </a>
        <a
          href={websiteUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          className={cn(
            BUTTON,
            "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
            !websiteUrl && "pointer-events-none opacity-40",
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Website
        </a>
        <button
          type="button"
          onClick={() => queueDraft(aiDraftChannel, "dm")}
          disabled={isPending || Boolean(loadingAction)}
          className={cn(BUTTON, "border-emerald-300/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20")}
        >
          <Bot className="h-3.5 w-3.5" />
          {loadingAction === aiDraftLoadingKey ? "Drafting..." : hasSocialTarget ? "AI Draft DM" : "AI Draft"}
        </button>
        <button
          type="button"
          onClick={() => queueDraft("manual", "social_research")}
          disabled={isPending || Boolean(loadingAction)}
          className={cn(BUTTON, "border-amber-300/25 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20")}
        >
          <Search className="h-3.5 w-3.5" />
          Social Research
        </button>
        <button
          type="button"
          onClick={() => queueDraft("manual", "browser_assist")}
          disabled={isPending || Boolean(loadingAction)}
          className={cn(BUTTON, "border-purple-300/25 bg-purple-400/10 text-purple-100 hover:bg-purple-400/20")}
        >
          <MousePointer2 className="h-3.5 w-3.5" />
          Browser Assist
        </button>
        {!isPolitical && (
          <button
            type="button"
            onClick={() => copyText()}
            className={cn(BUTTON, "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800")}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Message
          </button>
        )}
      </div>
      {(feedback || error) && (
        <p className={cn("mt-2 text-xs font-semibold", error ? "text-rose-200" : "text-emerald-200")}>
          {error ?? feedback}
        </p>
      )}
      {!compact && (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Political email queues a reviewed HomeReach draft from {JASON_EMAIL} with the four-option screenshot. Other email links open a clean manual draft. Browser Assist opens the public page/profile and logs a manual workflow.
        </p>
      )}
    </div>
  );
}
