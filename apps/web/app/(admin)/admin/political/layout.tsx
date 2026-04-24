import { notFound } from "next/navigation";
import { isPoliticalEnabled } from "@/lib/political/env";

// ─────────────────────────────────────────────────────────────────────────────
// Political Command Center — route-level flag gate
//
// If ENABLE_POLITICAL is not "true" at runtime, every route under
// /admin/political returns a real 404 (notFound() triggers the nearest
// not-found boundary, which is the platform 404 page).
//
// Admin/sales_agent role check is already enforced by the parent
// (admin)/layout.tsx → see apps/web/app/(admin)/layout.tsx — we don't need
// to re-do that work here.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export default function PoliticalLayout({ children }: { children: React.ReactNode }) {
  if (!isPoliticalEnabled()) notFound();
  return <>{children}</>;
}
