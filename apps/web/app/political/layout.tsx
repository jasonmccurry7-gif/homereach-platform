import { notFound } from "next/navigation";
import Link from "next/link";
import { Bot, LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { isPoliticalEnabled } from "@/lib/political/env";
import { createClient } from "@/lib/supabase/server";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import {
  PoliticalCommandNav,
  PoliticalFloatingAgentButton,
  PoliticalFlowStrip,
} from "./_components/PoliticalCommandNav";

export const dynamic = "force-dynamic";

const POLITICAL_PLAN_HREF = "/political/plan";
const POLITICAL_ACCOUNT_START_HREF = `/signup?redirect=${encodeURIComponent(POLITICAL_PLAN_HREF)}`;

export default async function PoliticalPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isPoliticalEnabled()) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSignedIn = Boolean(user);
  const startHref = isSignedIn ? POLITICAL_PLAN_HREF : POLITICAL_ACCOUNT_START_HREF;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <HomeReachLogo tone="light" size="sm" sublabel="Political Command" />
          </Link>

          <PoliticalCommandNav />

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/political/candidate-agent"
              aria-label="Chat with Campaign AI Agent"
              className="hidden items-center gap-2 rounded-lg border border-blue-300/25 bg-blue-500/10 px-3 py-2 text-sm font-bold text-blue-50 transition hover:bg-blue-500/20 md:inline-flex"
            >
              <Bot className="h-4 w-4" />
              <span className="hidden xl:inline">Chat with Campaign AI Agent</span>
              <span className="xl:hidden">AI Agent</span>
            </Link>
            <Link
              href={startHref}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500"
            >
              Start Campaign Mail Plan
            </Link>
            {isSignedIn ? (
              <form action={signOut}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-slate-300 transition hover:border-red-300/40 hover:bg-red-500/10 hover:text-red-100"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Login
              </Link>
            )}
          </div>
        </div>
        <PoliticalCommandNav mobile />
        <PoliticalFlowStrip />
      </header>

      <main>{children}</main>

      <footer className="border-t border-white/10 bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            HomeReach Campaign Mail. 13+ years of high-volume mail logistics.
            USPS expertise without USPS endorsement.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/political/data-sources" className="hover:text-white">
              Data Sources
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/" className="hover:text-white">
              Home
            </Link>
          </div>
        </div>
      </footer>
      <PoliticalFloatingAgentButton />
    </div>
  );
}
