import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  MailCheck,
  MapPinned,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Campaign Execution Queue | HomeReach",
};

const nextSteps = [
  {
    icon: Sparkles,
    title: "Campaign review starts",
    body: "HomeReach reviews the territory notes, offer, and selected package before production work moves forward.",
  },
  {
    icon: ShieldCheck,
    title: "Creative preview before mail",
    body: "You will receive a design preview to approve or revise before anything is printed or mailed.",
  },
  {
    icon: MapPinned,
    title: "Route and launch timing confirmed",
    body: "The mailing path, homeowner reach, and expected drop timing are checked against the approved campaign scope.",
  },
  {
    icon: MailCheck,
    title: "Execution queue advances",
    body: "After approval, HomeReach coordinates print, postage, and delivery so the campaign can get into market cleanly.",
  },
];

export default function TargetedConfirmedPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-2xl items-center">
        <div className="w-full rounded-lg border border-white/10 bg-white/[0.08] p-6 shadow-2xl shadow-blue-950/20 sm:p-8">
          <div className="text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20">
              <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
            </span>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-blue-100">
              Execution Queue Started
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Your neighborhood campaign is secured for review.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-300">
              If you just completed checkout, HomeReach will confirm the payment event and move the campaign through
              human review, creative approval, route confirmation, and launch preparation.
            </p>
          </div>

          <div className="mt-8 grid gap-3">
            {nextSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flex gap-3 rounded-lg border border-white/10 bg-white/10 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-200">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-black text-white">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{step.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 rounded-lg border border-blue-300/20 bg-blue-400/10 p-4">
            <div className="flex gap-3">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" aria-hidden="true" />
              <div>
                <p className="font-black text-blue-50">Watch your email for the next approval step.</p>
                <p className="mt-1 text-sm leading-6 text-blue-100">
                  Questions can be sent by replying to the confirmation email or contacting{" "}
                  <a href="mailto:hello@homereach.com" className="font-bold underline">
                    hello@homereach.com
                  </a>.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Return to HomeReach
            </Link>
            <Link
              href="/targeted/start"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
            >
              Plan Another Territory
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
