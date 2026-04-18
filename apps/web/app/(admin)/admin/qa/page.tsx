// ─────────────────────────────────────────────────────────────────────────────
// /admin/qa — Sales Intelligence Q&A (Desktop Admin View)
//
// Mobile-first component that renders responsively at desktop widths too.
// This page is only reachable when ENABLE_QA_SYSTEM=true (enforced at
// route level by the API; also gated here server-side).
// ─────────────────────────────────────────────────────────────────────────────

import { notFound } from "next/navigation";
import { isQaEnabled } from "@/lib/qa/env";
import QaBoard from "@/components/qa/QaBoard";

export const dynamic = "force-dynamic";

export default async function QaAdminPage() {
  if (!isQaEnabled()) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold md:text-3xl">Sales Intelligence Q&amp;A</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Ask. Learn. Execute. Real-time support for every agent, every city.
          </p>
        </header>

        <QaBoard isAdminView={true} />
      </div>
    </div>
  );
}
