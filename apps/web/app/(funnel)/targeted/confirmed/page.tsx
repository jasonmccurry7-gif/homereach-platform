import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Campaign Confirmed! — HomeReach",
};

export default function TargetedConfirmedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          You're all set!
        </h1>
        <p className="mt-3 text-gray-500">
          Your payment is confirmed and your campaign is officially in the queue.
        </p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-left space-y-4">
          <h2 className="font-bold text-gray-900">What happens next</h2>
          {[
            { icon: "🎨", title: "Design preview in 2–3 days", body: "Our team will create a custom postcard for your business and send you a preview to approve." },
            { icon: "✅", title: "You approve the design", body: "We'll send the design to your email. One click to approve, or request a change." },
            { icon: "📬", title: "Mailed to 500 homes", body: "Once approved, we print, stamp, and deliver to homes around your business. Expect delivery in 10–14 days total." },
          ].map((step) => (
            <div key={step.title} className="flex gap-3">
              <div className="text-2xl leading-none mt-0.5">{step.icon}</div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{step.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Questions? Reply to the confirmation email or{" "}
          <a href="mailto:hello@homereach.com" className="text-blue-600 underline">
            contact us
          </a>.
        </p>

        <Link
          href="/"
          className="mt-6 inline-block text-sm text-gray-400 underline"
        >
          Return to HomeReach
        </Link>
      </div>
    </div>
  );
}
