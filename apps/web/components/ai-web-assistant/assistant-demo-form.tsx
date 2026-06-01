"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Code2,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { AiWebAssistantProfile } from "@/lib/ai-web-assistant/sample-data";

type FormState = {
  businessName: string;
  contactName: string;
  email: string;
  websiteUrl: string;
  phone: string;
  category: string;
  serviceAreas: string;
  mainServices: string;
  hours: string;
  bookingPreference: string;
  contactPreference: string;
  preferredPlan: string;
  consent: boolean;
};

const initialState: FormState = {
  businessName: "",
  contactName: "",
  email: "",
  websiteUrl: "",
  phone: "",
  category: "Roofing",
  serviceAreas: "",
  mainServices: "",
  hours: "",
  bookingPreference: "",
  contactPreference: "",
  preferredPlan: "Starter Assistant",
  consent: false,
};

export function AssistantDemoForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [profile, setProfile] = useState<AiWebAssistantProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const hasPreview = Boolean(profile);
  const serviceCount = useMemo(
    () => form.mainServices.split(",").map((item) => item.trim()).filter(Boolean).length,
    [form.mainServices],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setWarning(null);
    setSaved(false);

    try {
      const response = await fetch("/api/ai-web-assistant/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Unable to generate the AI assistant demo.");
      }
      setProfile(result.profile);
      setWarning(result.persistenceWarning ?? null);
      setSaved(Boolean(result.persisted));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate the AI assistant demo.");
    } finally {
      setIsLoading(false);
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[0.92fr_1.08fr] lg:p-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Free AI Assistant Demo</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
          Build the first version of your 24/7 front desk.
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Enter a few business details and HomeReach will generate an assistant profile, greeting, basic FAQ,
          qualification flow, escalation rules, and approval-safe embed code.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <Field label="Business name" value={form.businessName} onChange={(value) => update("businessName", value)} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name" value={form.contactName} onChange={(value) => update("contactName", value)} required />
            <Field label="Email" value={form.email} onChange={(value) => update("email", value)} placeholder="owner@example.com" required type="email" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Website URL" value={form.websiteUrl} onChange={(value) => update("websiteUrl", value)} placeholder="https://example.com" />
            <Field label="Phone number" value={form.phone} onChange={(value) => update("phone", value)} placeholder="(330) 000-0000" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Business category</span>
              <select
                value={form.category}
                onChange={(event) => update("category", event.target.value)}
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {[
                  "Roofing",
                  "HVAC",
                  "Plumbing",
                  "Landscaping",
                  "Restaurants",
                  "Bakeries",
                  "Dentists",
                  "Med Spas",
                  "Auto Repair",
                  "Real Estate",
                  "Local Contractors",
                  "Political Campaigns",
                ].map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <Field label="Service areas" value={form.serviceAreas} onChange={(value) => update("serviceAreas", value)} placeholder="Akron, Canton, Medina" required />
          </div>
          <Field
            label="Main services"
            value={form.mainServices}
            onChange={(value) => update("mainServices", value)}
            placeholder="Roof repair, storm damage, inspections"
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hours" value={form.hours} onChange={(value) => update("hours", value)} placeholder="Mon-Fri 8-5, emergency calls after hours" />
            <Field label="Booking/contact preference" value={form.bookingPreference} onChange={(value) => update("bookingPreference", value)} placeholder="Request callback or booking link" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preferred handoff" value={form.contactPreference} onChange={(value) => update("contactPreference", value)} placeholder="Call owner for urgent leads, email normal requests" />
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Plan interest</span>
              <select
                value={form.preferredPlan}
                onChange={(event) => update("preferredPlan", event.target.value)}
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {["Starter Assistant", "Growth Assistant", "Revenue Assistant", "Not sure yet"].map((plan) => (
                  <option key={plan}>{plan}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(event) => update("consent", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              required
            />
            I agree that HomeReach can generate this AI assistant demo and contact me about setup. I understand live activation requires human approval.
          </label>

          {error && (
            <div className="flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {saved && (
            <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              Demo saved. HomeReach can now review the setup request and follow up.
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate AI Assistant Demo
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Assistant Preview</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">
              {profile?.assistantName ?? "Your AI Front Desk"}
            </h3>
          </div>
          <Bot className="h-6 w-6 text-blue-700" />
        </div>

        {!hasPreview ? (
          <div className="mt-5 grid gap-3">
            {[
              ["Answers questions", "Approved FAQs, hours, services, and areas."],
              ["Captures leads", "Name, phone, email, service need, and urgency."],
              ["Routes requests", "Urgent issues and owner handoffs stay visible."],
              ["Keeps control", "No outbound sends or public actions without approval."],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="font-black text-slate-950">{title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
              </div>
            ))}
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-black text-blue-950">{serviceCount || "Add"} service lines become lead questions.</p>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {warning && (
              <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {warning}
              </div>
            )}

            <PreviewCard icon={MessageSquareText} title="Greeting" body={profile!.greeting} />
            <PreviewCard icon={ShieldCheck} title="Safety rules" body={profile!.restrictedTopics.slice(0, 3).join(" ")} />

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-black text-slate-950">Lead qualification flow</p>
              <div className="mt-3 grid gap-2">
                {profile!.leadQualificationFlow.slice(0, 5).map((question) => (
                  <div key={question} className="flex gap-2 text-sm font-semibold leading-6 text-slate-700">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                    {question}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-blue-700" />
                <p className="text-sm font-black text-slate-950">Embed code</p>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs font-semibold leading-6 text-slate-100">
                {profile!.embedCode}
              </pre>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                Demo code is generated now. Live widget activation still requires domain approval and a production assistant key.
              </p>
            </div>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-black text-emerald-950">Test conversation preview</p>
              <div className="mt-3 grid gap-2">
                {profile!.previewConversation.map((line, index) => (
                  <div
                    key={`${line.speaker}-${index}`}
                    className={
                      line.speaker === "assistant"
                        ? "rounded-lg bg-white p-3 text-sm leading-6 text-slate-700"
                        : "ml-6 rounded-lg bg-emerald-600 p-3 text-sm font-semibold leading-6 text-white"
                    }
                  >
                    {line.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function PreviewCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Bot;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-700" />
        <p className="text-sm font-black text-slate-950">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}
