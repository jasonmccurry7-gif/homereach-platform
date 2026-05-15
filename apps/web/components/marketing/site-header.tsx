import Link from "next/link";
import { Menu } from "lucide-react";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import { CtaButton } from "@/components/marketing/cta-button";
import { platformNavItems } from "@/components/marketing/navigation-config";
import { accountStartHref, PRODUCT_START_PATHS } from "@/lib/marketing/product-routes";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 text-white shadow-2xl shadow-slate-950/10 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <Link href="/" aria-label="HomeReach home">
          <HomeReachLogo tone="light" size="md" sublabel="Platform" />
        </Link>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
          >
            Login
          </Link>
          <CtaButton
            href={accountStartHref(PRODUCT_START_PATHS.sharedPostcards)}
            variant="primary"
            className="min-h-10 px-4 py-2"
          >
            Get Started
          </CtaButton>
        </div>

        <details className="group relative lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-lg border border-white/15 bg-white/10 px-3 text-white transition hover:bg-white/15 [&::-webkit-details-marker]:hidden">
            <Menu className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Open navigation</span>
          </summary>
          <div className="absolute right-0 mt-3 w-[min(88vw,22rem)] rounded-lg border border-white/[0.12] bg-slate-950/95 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
            <nav className="grid gap-1" aria-label="Mobile navigation">
              {platformNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                <Link
                  href="/login"
                  className="rounded-lg border border-white/15 px-3 py-2.5 text-center text-sm font-bold text-white"
                >
                  Login
                </Link>
                <Link
                  href={accountStartHref(PRODUCT_START_PATHS.sharedPostcards)}
                  className="rounded-lg bg-blue-600 px-3 py-2.5 text-center text-sm font-bold text-white"
                >
                  Get Started
                </Link>
              </div>
            </nav>
          </div>
        </details>
      </div>

      <nav
        className="mx-auto hidden max-w-[90rem] flex-wrap items-center gap-1 px-4 pb-3 lg:flex lg:px-6"
        aria-label="Platform navigation"
      >
        {platformNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-bold uppercase tracking-[0.06em] text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
