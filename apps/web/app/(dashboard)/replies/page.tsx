import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Replies — HomeReach" };

// ─────────────────────────────────────────────────────────────────────────────
// Replies Page
// Phase 4: Will display inbound SMS/email responses from mailer recipients.
// Campaigns are category-exclusive — every reply here is a warm lead.
// ─────────────────────────────────────────────────────────────────────────────

export default async function RepliesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Replies</h1>
        <p className="mt-1 text-sm text-gray-500">
          Inbound responses from your mailer — calls, texts, and form submissions.
        </p>
      </div>

      {/* Coming soon state */}
      <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
        <div className="mx-auto mb-4 text-5xl">💬</div>
        <h2 className="text-xl font-bold text-gray-900">Reply tracking coming soon</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
          Once your first mailer drops, inbound calls, text replies, and form
          submissions will appear here automatically.
        </p>
        <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-2xl">📱</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">QR scans</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Every scan tracked in real time
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-2xl">📞</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">Phone leads</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Calls routed through a tracked number
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-2xl">📋</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">Form fills</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Contact info captured and forwarded
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
