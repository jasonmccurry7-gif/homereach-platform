"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Mail, MessageSquare, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  row: Record<string, unknown>;
  compact?: boolean;
};

export function StormReachOutreachActions({ compact, row }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const channel = clean(row.channel).toLowerCase();
  const subject = clean(row.subject) || "StormReach opportunity";
  const body = clean(row.body);
  const email = clean(row.recipient_email);
  const phone = clean(row.recipient_phone);
  const metadata = objectValue(row.metadata);
  const approvalStatus = clean(row.approval_status).toLowerCase();
  const approved = approvalStatus === "approved";
  const alreadySent = clean(row.status).toLowerCase() === "sent" || Boolean(row.sent_at);
  const messengerLink = firstUrl(metadata.messenger_link) ?? firstUrl(metadata.facebook_page);
  const phoneTextBody = buildPhoneTextBody({ body, channel, subject });
  const phoneSmsHref = phone ? `sms:${encodeURIComponent(phone)}?&body=${encodeURIComponent(phoneTextBody)}` : "";

  const action = useMemo(() => {
    if (channel === "email") {
      return email
        ? { label: "Open Email", href: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, icon: Mail }
        : { label: "No Email", href: "", icon: Mail };
    }

    if (channel === "sms") {
      return phone
        ? { label: "Open Text", href: `sms:${encodeURIComponent(phone)}?&body=${encodeURIComponent(body)}`, icon: MessageSquare }
        : { label: "No Phone", href: "", icon: MessageSquare };
    }

    if (channel === "facebook_dm") {
      return messengerLink
        ? { label: "Open Messenger", href: messengerLink, icon: ExternalLink }
        : { label: "No Messenger Link", href: "", icon: ExternalLink };
    }

    return null;
  }, [body, channel, email, messengerLink, phone, subject]);

  async function copyDraft() {
    await navigator.clipboard?.writeText(formatCopy({ body, channel, email, phone, subject }));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function sendApprovedDraft() {
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/stormreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_outreach", messageId: String(row.id ?? "") }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        setStatus(result.error ? String(result.error) : "Send failed.");
      } else {
        setStatus(channel === "sms" ? "Text sent." : "Email sent.");
        router.refresh();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Send failed.");
    } finally {
      setPending(false);
    }
  }

  const copyLabel = channel === "sms" ? "Copy Text" : channel === "facebook_dm" ? "Copy DM" : "Copy Email";

  return (
    <div className={cn("mt-3 space-y-2", compact && "mt-2")}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyDraft}
          className={cn(
            "inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 hover:bg-slate-50",
            compact && "min-h-8 px-2.5",
          )}
        >
          {copied ? <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? "Copied" : copyLabel}
        </button>

        {(channel === "email" || channel === "sms") && action?.href && approved && !alreadySent ? (
          <button
            type="button"
            onClick={sendApprovedDraft}
            disabled={pending}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-900 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60",
              compact && "min-h-8 px-2.5",
            )}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {pending ? "Sending..." : channel === "sms" ? "Send Text" : "Send Email"}
          </button>
        ) : action?.href && approved && !alreadySent ? (
          <a
            href={action.href}
            target={channel === "facebook_dm" ? "_blank" : undefined}
            rel={channel === "facebook_dm" ? "noreferrer" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-900 hover:bg-blue-100",
              compact && "min-h-8 px-2.5",
            )}
          >
            <action.icon className="h-4 w-4" aria-hidden="true" />
            {action.label}
          </a>
        ) : alreadySent ? (
          <span
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-900",
              compact && "min-h-8 px-2.5",
            )}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Sent
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-900",
              compact && "min-h-8 px-2.5",
            )}
            title={action?.href ? "Approve this draft before opening a send handoff." : "The required contact destination was not found."}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {action?.href ? "Approve First" : action?.label ?? "No Send Action"}
          </span>
        )}

        {phone && approved && !alreadySent ? (
          <a
            href={phoneSmsHref}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-900 hover:bg-blue-100",
              compact && "min-h-8 px-2.5",
            )}
            title="Opens your computer's SMS app or connected phone texting app with this message prefilled."
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Text from Phone
          </a>
        ) : phone && !alreadySent ? (
          <span
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-900",
              compact && "min-h-8 px-2.5",
            )}
            title="Approve this draft before opening the phone text handoff."
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Approve Text
          </span>
        ) : null}
      </div>
      <p className="text-[11px] font-bold leading-4 text-slate-500">
        {status ?? (alreadySent
          ? "Provider send was recorded."
          : approved
            ? channel === "facebook_dm" ? "Messenger opens as a manual handoff. Review before sending." : "Manual approved send. Phone text opens your connected SMS app when available."
            : "Approve the draft first. Nothing is sent automatically.")}
      </p>
    </div>
  );
}

function formatCopy(input: { body: string; channel: string; email: string; phone: string; subject: string }) {
  if (input.channel === "email") {
    return [`To: ${input.email || "Not publicly found"}`, `Subject: ${input.subject}`, "", input.body].join("\n");
  }
  if (input.channel === "sms") {
    return [`To: ${input.phone || "Not publicly found"}`, input.body].join("\n");
  }
  return input.body;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstUrl(value: unknown) {
  const text = clean(value);
  return /^https?:\/\//i.test(text) ? text : null;
}

function buildPhoneTextBody(input: { body: string; channel: string; subject: string }) {
  if (input.channel === "sms" && input.body) return limitSms(input.body);
  const subject = input.subject.replace(/\s+/g, " ").trim();
  return limitSms(
    [
      "Jason with HomeReach.",
      subject ? `Quick StormReach note: ${subject}.` : "Quick StormReach note.",
      "I can send a storm-response map plus geofence and postcard details.",
      "10-min call? 330-206-9639.",
      "Reply STOP to opt out.",
    ].join(" "),
  );
}

function limitSms(value: string) {
  const cleanValue = value.replace(/\s+/g, " ").trim();
  if (cleanValue.length <= 320) return cleanValue;
  const suffix = " Reply STOP to opt out.";
  return `${cleanValue.slice(0, 320 - suffix.length - 1).trimEnd()}${suffix}`;
}
