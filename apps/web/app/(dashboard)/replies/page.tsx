import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Replies - HomeReach" };

export default async function RepliesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Customer response center
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Replies</h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-gray-500">
          Calls, texts, QR scans, and form submissions will collect here so warm
          opportunities are easier to spot and follow up.
        </p>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
          Current status
        </p>
        <h2 className="mt-2 text-xl font-bold text-blue-950">
          Reply tracking is being prepared for your campaign activity.
        </h2>
        <p className="mt-2 text-sm leading-6 text-blue-700">
          When response data is connected, this page will show who replied, how
          they came in, and what should happen next.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/campaign"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            View campaign
          </Link>
          <Link
            href="/settings"
            className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50"
          >
            Check contact info
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <ReplySignal
          title="QR scans"
          body="Shows interest from people who scanned the postcard."
        />
        <ReplySignal
          title="Phone leads"
          body="Keeps tracked calls visible with the campaign they came from."
        />
        <ReplySignal
          title="Form fills"
          body="Captures contact details so the next step is clear."
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-gray-900">
          How HomeReach will use this
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Capture", "Collect the response and connect it to the campaign."],
            ["Clarify", "Separate new interest from routine activity."],
            ["Follow up", "Make the next customer action easier to see."],
          ].map(([label, detail]) => (
            <div
              key={label}
              className="rounded-xl border border-gray-100 bg-gray-50 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                {label}
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-600">{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReplySignal({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-gray-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-gray-500">{body}</p>
      <span className="mt-4 inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
        Pending data
      </span>
    </div>
  );
}
