// ─────────────────────────────────────────────────────────────────────────────
// /agent/qa — Mobile-first rep view
//
// Same QaBoard component as /admin/qa, but rendered in agent mode
// (no admin controls, pinned "Use Now" CTAs).
// ─────────────────────────────────────────────────────────────────────────────

import { notFound } from "next/navigation";
import { isQaEnabled } from "@/lib/qa/env";
import QaBoard from "@/components/qa/QaBoard";

export const dynamic = "force-dynamic";

export default async function QaAgentPage() {
  if (!isQaEnabled()) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-2xl px-4 py-4">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Q&amp;A</h1>
          <a
            href="/agent"
            className="text-xs text-neutral-400 underline-offset-2 hover:underline"
          >
            back
          </a>
        </header>

        <QaBoard isAdminView={false} />
      </div>
    </div>
  );
}
