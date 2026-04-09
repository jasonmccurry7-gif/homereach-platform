import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Refer a Business — HomeReach" };

export default function ReferPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mb-4 text-5xl">🤝</div>
        <h1 className="text-2xl font-bold text-gray-900">Refer a Business</h1>
        <p className="mt-2 text-gray-500">
          Know a local business that should be on the next HomeReach mailer? Send them your link.
        </p>
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">Coming soon</p>
          <p className="text-sm text-gray-600">
            Referral tracking is being built. For now, share this link with any business that could benefit from HomeReach:
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700">
            home-reach.com/get-started
          </div>
        </div>
        <Link
          href="/dashboard"
          className="mt-6 inline-block text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
