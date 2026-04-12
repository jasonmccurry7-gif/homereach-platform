import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Own Your Local Neighborhoods — HomeReach Targeted Campaigns",
  description:
    "Target 500 homes around your business with a dedicated postcard campaign. We handle design, printing, and delivery. Starting at $400/month.",
};

export default function TargetedLandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-200">
            Targeted Route Campaign
          </p>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
            Own Your Local<br />Neighborhoods
          </h1>
          <p className="mt-5 text-lg text-blue-100 sm:text-xl max-w-2xl mx-auto">
            Reach 500 homeowners right around your business with a custom postcard campaign.
            We handle everything — design, printing, postage, and delivery.
          </p>
          <p className="mt-3 text-2xl font-bold text-white">
            Starting at <span className="text-yellow-300">$400/month</span>
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/targeted/start"
              className="rounded-xl bg-white px-8 py-4 text-base font-bold text-blue-700 shadow-lg transition hover:shadow-xl hover:scale-105"
            >
              Get Started →
            </Link>
            <a
              href="sms:+1XXXXXXXXXX?body=Hi%2C%20I%27m%20interested%20in%20the%20Targeted%20Route%20Campaign"
              className="rounded-xl border-2 border-white px-8 py-4 text-base font-semibold text-white transition hover:bg-white/10"
            >
              💬 Text Us Instead
            </a>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
          How It Works
        </h2>
        <p className="mt-2 text-center text-gray-500">
          A few clicks. We do the rest.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Tell Us Where",
              body: "Enter your business address and describe the area you want to target. 'Street within 3 blocks of my shop' — that's all we need.",
            },
            {
              step: "2",
              title: "We Design & Mail",
              body: "Our team creates a custom postcard for your business. Once you approve it, we print, stamp, and deliver to ~500 homes.",
            },
            {
              step: "3",
              title: "Customers Find You",
              body: "Homeowners near you get your card. They call, text, or book. You grow. Simple.",
            },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-center">
              <div className="mx-auto mb-4 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-700">
                {item.step}
              </div>
              <h3 className="font-bold text-gray-900">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-500">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What's included ──────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-14">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Everything Is Included
          </h2>
          <ul className="mt-8 space-y-3">
            {[
              "✅ Custom postcard design by our team",
              "✅ Professional printing",
              "✅ Postage & delivery to ~500 homes",
              "✅ Target homes right around your business",
              "✅ No contracts — cancel anytime",
              "✅ Results in 10–14 days",
            ].map((f) => (
              <li key={f} className="flex items-center gap-3 text-base text-gray-700 font-medium">
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-xl px-6 py-16 text-center">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Simple pricing</p>
          <p className="mt-2 text-5xl font-extrabold text-gray-900">$400</p>
          <p className="mt-1 text-gray-500">/month · ~500 homes</p>

          <ul className="mt-6 space-y-2 text-left text-sm text-gray-600">
            <li>✓ Design included</li>
            <li>✓ Print + postage included</li>
            <li>✓ Delivery to 500 homes</li>
            <li>✓ No setup fee</li>
          </ul>

          <Link
            href="/targeted/start"
            className="mt-8 block rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow transition hover:bg-blue-700"
          >
            Start My Campaign →
          </Link>
          <p className="mt-3 text-xs text-gray-400">No contract. Pay month to month.</p>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="bg-blue-700 py-14 text-center text-white">
        <h2 className="text-2xl font-bold sm:text-3xl">
          Ready to reach your neighborhood?
        </h2>
        <p className="mt-2 text-blue-200">
          It takes 5 minutes to get started.
        </p>
        <Link
          href="/targeted/start"
          className="mt-6 inline-block rounded-xl bg-white px-8 py-4 text-base font-bold text-blue-700 shadow-lg transition hover:scale-105"
        >
          Get Started — $400/month →
        </Link>
      </section>
    </main>
  );
}
