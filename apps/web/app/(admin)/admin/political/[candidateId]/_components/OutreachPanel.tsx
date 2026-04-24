"use client";

import { useMemo, useState, useTransition } from "react";
import {
  sendSmsAction,
  sendEmailAction,
  logCallAction,
  logFacebookAction,
} from "../actions";
import type { ContactRow, CandidateRow } from "@/lib/political/queries";
import type { ScriptRow, ScriptChannel } from "@/lib/political/scripts";

// ─────────────────────────────────────────────────────────────────────────────
// Outreach action-center panel — client component.
//
// One tab with a channel pill-selector inside:
//   • Call      → tel: link + manual "log call" form (outcome + notes)
//   • Text      → sendSms via server action
//   • Email     → sendEmail via server action
//   • Facebook  → open Messenger link + log the copy the rep sent manually
//
// Compliance:
//   - Compliance flags (do_not_*) are surfaced prominently on the contact
//     picker. The server action refuses opted-out sends and the UI reflects
//     that error verbatim.
//   - tel: link opens the device dialer; nothing calls server-side.
//   - Facebook opens the Messenger URL in a new tab; the rep sends manually.
//   - Every successful action reports an event id (from sales_events) so the
//     timeline can link back later.
// ─────────────────────────────────────────────────────────────────────────────

type Channel = "call" | "sms" | "email" | "facebook_dm";

const CHANNELS: ReadonlyArray<{ key: Channel; label: string }> = [
  { key: "call",        label: "Call" },
  { key: "sms",         label: "Text" },
  { key: "email",       label: "Email" },
  { key: "facebook_dm", label: "Facebook" },
];

interface OutreachPanelProps {
  candidate: CandidateRow;
  campaignId: string;
  campaignLabel: string;
  contacts: ContactRow[];
  scripts: ScriptRow[];
  repName: string;
}

export function OutreachPanel({
  candidate,
  campaignId,
  campaignLabel,
  contacts,
  scripts,
  repName,
}: OutreachPanelProps) {
  const [channel, setChannel] = useState<Channel>("call");
  const [contactId, setContactId] = useState<string>(contacts[0]?.id ?? "");
  const [scriptId, setScriptId] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [callOutcome, setCallOutcome] = useState<string>("");
  const [result, setResult] = useState<{ ok: true; msg: string } | { ok: false; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === contactId) ?? null,
    [contacts, contactId],
  );

  const channelScripts = useMemo(
    () => scripts.filter((s) => s.channel === channel),
    [scripts, channel],
  );

  // Template variables available for rendering — all operational, no voter fields.
  const variables = useMemo(
    () => ({
      candidate_name: candidate.candidateName,
      office: candidate.officeSought ?? "",
      district: candidate.geographyType === "district" ? candidate.geographyValue ?? "" : "",
      state: candidate.state,
      rep_name: repName,
    }),
    [candidate, repName],
  );

  function applyScript(id: string) {
    setScriptId(id);
    const script = channelScripts.find((s) => s.id === id);
    if (!script) return;
    setBody(renderTemplate(script.body, variables));
    if (script.subject) setSubject(renderTemplate(script.subject, variables));
  }

  // Reset content when changing channels
  function switchChannel(next: Channel) {
    setChannel(next);
    setScriptId("");
    setBody("");
    setSubject("");
    setCallOutcome("");
    setResult(null);
  }

  function complianceNote(): string | null {
    if (candidate.doNotContact) return "Candidate is marked do_not_contact — no outreach allowed.";
    if (channel === "email" && candidate.doNotEmail) return "Candidate is marked do_not_email.";
    if (channel === "sms" && candidate.doNotText) return "Candidate is marked do_not_text.";
    if (selectedContact?.doNotContact) return "Contact is marked do_not_contact.";
    if (channel === "email" && selectedContact?.doNotEmail) return "Contact is marked do_not_email.";
    if (channel === "sms" && selectedContact?.doNotText) return "Contact is marked do_not_text.";
    return null;
  }

  const blocked = complianceNote();

  function send() {
    setResult(null);
    const scriptSlug = scripts.find((s) => s.id === scriptId)?.slug ?? null;

    startTransition(async () => {
      try {
        if (channel === "sms") {
          const to = selectedContact?.phone ?? candidate.campaignPhone ?? "";
          if (!to) return setResult({ ok: false, msg: "No phone number on this contact or candidate." });
          const r = await sendSmsAction({
            campaignId,
            candidateId: candidate.id,
            contactId: contactId || null,
            to,
            body,
            scriptSlug,
          });
          if ("error" in r) return setResult({ ok: false, msg: r.error });
          setResult({ ok: true, msg: "Text sent." });
        } else if (channel === "email") {
          const to = selectedContact?.email ?? candidate.campaignEmail ?? "";
          if (!to) return setResult({ ok: false, msg: "No email on this contact or candidate." });
          const r = await sendEmailAction({
            campaignId,
            candidateId: candidate.id,
            contactId: contactId || null,
            to,
            subject: subject.trim() || "HomeReach",
            body,
            scriptSlug,
          });
          if ("error" in r) return setResult({ ok: false, msg: r.error });
          setResult({ ok: true, msg: "Email sent." });
        } else if (channel === "call") {
          const toPhone = selectedContact?.phone ?? candidate.campaignPhone ?? "";
          if (!toPhone) return setResult({ ok: false, msg: "No phone number to log." });
          if (!callOutcome.trim()) return setResult({ ok: false, msg: "Outcome notes are required." });
          const r = await logCallAction({
            campaignId,
            candidateId: candidate.id,
            contactId: contactId || null,
            toPhone,
            outcome: callOutcome.trim(),
            scriptSlug,
          });
          if ("error" in r) return setResult({ ok: false, msg: r.error });
          setResult({ ok: true, msg: "Call logged." });
          setCallOutcome("");
        } else {
          // facebook_dm
          const r = await logFacebookAction({
            campaignId,
            candidateId: candidate.id,
            contactId: contactId || null,
            messengerUrl: candidate.messengerUrl ?? candidate.facebookUrl ?? null,
            body,
            scriptSlug,
          });
          if ("error" in r) return setResult({ ok: false, msg: r.error });
          setResult({ ok: true, msg: "Facebook DM logged." });
        }
      } catch (err) {
        setResult({
          ok: false,
          msg: err instanceof Error ? err.message : "Unknown error.",
        });
      }
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-slate-900">Contact campaign</h3>
        <p className="text-xs text-slate-500">
          {campaignLabel} · {candidate.state}
        </p>
      </header>

      {/* Channel pills */}
      <div
        role="tablist"
        aria-label="Outreach channel"
        className="mt-3 inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-xs"
      >
        {CHANNELS.map((c) => {
          const isActive = c.key === channel;
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => switchChannel(c.key)}
              className={
                isActive
                  ? "rounded-md bg-white px-3 py-1.5 font-medium text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "rounded-md px-3 py-1.5 text-slate-600 hover:text-slate-900"
              }
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Contact + script pickers */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Contact</span>
          <select
            value={contactId}
            onChange={(e) => setContactId(e.currentTarget.value)}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">Candidate directly</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isPrimary ? " · primary" : ""}
                {c.role ? ` · ${c.role}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Script (optional)</span>
          <select
            value={scriptId}
            onChange={(e) => applyScript(e.currentTarget.value)}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">— pick a script to auto-fill —</option>
            {channelScripts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Compliance banner */}
      {blocked && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {blocked}
        </div>
      )}

      {/* Channel-specific form */}
      <div className="mt-4 space-y-3">
        {channel === "call" && (
          <CallForm
            candidate={candidate}
            selectedContact={selectedContact}
            scriptBody={body}
            setScriptBody={setBody}
            callOutcome={callOutcome}
            setCallOutcome={setCallOutcome}
          />
        )}
        {channel === "sms" && (
          <SmsForm
            candidate={candidate}
            selectedContact={selectedContact}
            body={body}
            setBody={setBody}
          />
        )}
        {channel === "email" && (
          <EmailForm
            candidate={candidate}
            selectedContact={selectedContact}
            subject={subject}
            setSubject={setSubject}
            body={body}
            setBody={setBody}
          />
        )}
        {channel === "facebook_dm" && (
          <FacebookForm
            candidate={candidate}
            body={body}
            setBody={setBody}
          />
        )}
      </div>

      {/* Action button */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={pending || Boolean(blocked)}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending
            ? "Working…"
            : channel === "call"
              ? "Log call"
              : channel === "facebook_dm"
                ? "Log Facebook DM"
                : channel === "sms"
                  ? "Send text"
                  : "Send email"}
        </button>

        {result && (
          <span
            className={
              result.ok
                ? "text-xs font-medium text-emerald-700"
                : "text-xs font-medium text-rose-700"
            }
          >
            {result.msg}
          </span>
        )}
      </div>

      <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-400">
        Calls are not tracked or recorded. All sends are logged to the activity
        timeline.
      </p>
    </div>
  );
}

// ── Channel-specific forms ───────────────────────────────────────────────────

function CallForm({
  candidate,
  selectedContact,
  scriptBody,
  setScriptBody,
  callOutcome,
  setCallOutcome,
}: {
  candidate: CandidateRow;
  selectedContact: ContactRow | null;
  scriptBody: string;
  setScriptBody: (v: string) => void;
  callOutcome: string;
  setCallOutcome: (v: string) => void;
}) {
  const phone = selectedContact?.phone ?? candidate.campaignPhone ?? "";
  const telHref = phone ? `tel:${phone.replace(/[^\d+*#]/g, "")}` : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm">
          <span className="text-slate-500">Dial:</span>{" "}
          <span className="font-medium text-slate-900">{phone || "—"}</span>
        </div>
        {telHref && (
          <a
            href={telHref}
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
          >
            Call now (tel:)
          </a>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Script reference (optional)</span>
        <textarea
          value={scriptBody}
          onChange={(e) => setScriptBody(e.currentTarget.value)}
          rows={4}
          placeholder="Pick a script above to auto-fill, or type your own reference notes."
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Outcome (required to log)</span>
        <textarea
          value={callOutcome}
          onChange={(e) => setCallOutcome(e.currentTarget.value)}
          rows={3}
          placeholder="e.g. Voicemail. Will call back Thursday afternoon."
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          required
        />
      </label>
    </>
  );
}

function SmsForm({
  candidate,
  selectedContact,
  body,
  setBody,
}: {
  candidate: CandidateRow;
  selectedContact: ContactRow | null;
  body: string;
  setBody: (v: string) => void;
}) {
  const to = selectedContact?.phone ?? candidate.campaignPhone ?? "";
  const chars = body.length;
  return (
    <>
      <div className="text-sm">
        <span className="text-slate-500">To:</span>{" "}
        <span className="font-medium text-slate-900">{to || "— missing phone —"}</span>
      </div>
      <label className="block">
        <span className="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
          <span>Message</span>
          <span className={chars > 160 ? "text-amber-700" : "text-slate-400"}>
            {chars}/160
          </span>
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          rows={4}
          placeholder="Pick a script above or type the SMS body."
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </label>
    </>
  );
}

function EmailForm({
  candidate,
  selectedContact,
  subject,
  setSubject,
  body,
  setBody,
}: {
  candidate: CandidateRow;
  selectedContact: ContactRow | null;
  subject: string;
  setSubject: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
}) {
  const to = selectedContact?.email ?? candidate.campaignEmail ?? "";
  return (
    <>
      <div className="text-sm">
        <span className="text-slate-500">To:</span>{" "}
        <span className="font-medium text-slate-900">{to || "— missing email —"}</span>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Subject</span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.currentTarget.value)}
          placeholder="Subject line"
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Body</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          rows={8}
          placeholder="Pick a script above or type the email."
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </label>
    </>
  );
}

function FacebookForm({
  candidate,
  body,
  setBody,
}: {
  candidate: CandidateRow;
  body: string;
  setBody: (v: string) => void;
}) {
  const url = candidate.messengerUrl ?? candidate.facebookUrl ?? null;

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(body);
    } catch {
      // clipboard permission denied
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
          >
            Open Messenger/Facebook →
          </a>
        ) : (
          <span className="text-xs text-slate-500">No Facebook or Messenger URL on record.</span>
        )}
        <button
          type="button"
          onClick={copyBody}
          disabled={!body.trim()}
          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          Copy message
        </button>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          rows={5}
          placeholder="Pick a script above. Log the message after you send it in Messenger."
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </label>
      <p className="text-xs text-slate-500">
        Messenger sends happen in Facebook&apos;s own UI. Logging records the
        copy you sent and the time — HomeReach never auto-sends Facebook
        messages.
      </p>
    </>
  );
}

// ── Tiny inline template renderer (client-side twin of server one) ──────────

function renderTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, key: string) => {
    const v = variables[key];
    if (v === undefined || v === null || v === "") return match;
    return String(v);
  });
}
