import Link from "next/link";
import { Menu } from "lucide-react";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import { CtaButton } from "@/components/marketing/cta-button";
import {
  digitalTargetingNavItems,
  growthNavItems,
  platformNavItems,
  targetedNavItems,
} from "@/components/marketing/navigation-config";
import { PRODUCT_START_PATHS } from "@/lib/marketing/product-routes";

type SiteHeaderVariant = "platform" | "targeted" | "growth" | "digital";

const headerConfigs = {
  platform: {
    sublabel: "Platform",
    navEyebrow: "Market Capture",
    navItems: platformNavItems,
    ctaHref: PRODUCT_START_PATHS.marketCapture,
    ctaLabel: "Start Campaign",
    ctaVariant: "primary" as const,
    mobilePrimaryLabel: "Start My Campaign",
    mobileSecondaryHref: "/#how-it-works",
    mobileSecondaryLabel: "See How It Works",
    mobileFinalLabel: "Start Campaign",
  },
  targeted: {
    sublabel: "Targeted Mail",
    navEyebrow: "Neighborhood Growth",
    navItems: targetedNavItems,
    ctaHref: PRODUCT_START_PATHS.targetedCampaigns,
    ctaLabel: "Build Territory Plan",
    ctaVariant: "primary" as const,
    mobilePrimaryLabel: "Build My Territory Plan",
    mobileSecondaryHref: "/targeted#packages",
    mobileSecondaryLabel: "See Packages",
    mobileFinalLabel: "Territory Plan",
  },
  digital: {
    sublabel: "Market Capture",
    navEyebrow: "Neighborhood Capture",
    navItems: digitalTargetingNavItems,
    ctaHref: PRODUCT_START_PATHS.marketCapture,
    ctaLabel: "Start Campaign",
    ctaVariant: "primary" as const,
    mobilePrimaryLabel: "Start My Campaign",
    mobileSecondaryHref: "/market-capture#how-it-works",
    mobileSecondaryLabel: "See How It Works",
    mobileFinalLabel: "Start Campaign",
  },
  growth: {
    sublabel: "AI Growth OS",
    navEyebrow: "Local Growth",
    navItems: growthNavItems,
    ctaHref: PRODUCT_START_PATHS.aiGrowthOs,
    ctaLabel: "Open Growth Center",
    ctaVariant: "primary" as const,
    mobilePrimaryLabel: "Open Growth Center",
    mobileSecondaryHref: "/local-visibility#visibility-scan",
    mobileSecondaryLabel: "Launch Visibility Scan",
    mobileFinalLabel: "Growth Center",
  },
} as const;

export function SiteHeader({ variant = "platform" }: { variant?: SiteHeaderVariant }) {
  const config = headerConfigs[variant];
  const mobilePrimaryClass = "bg-blue-600 hover:bg-blue-500";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 text-white shadow-2xl shadow-slate-950/10 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <Link href="/" aria-label="HomeReach home">
          <HomeReachLogo tone="light" size="md" sublabel={config.sublabel} />
        </Link>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
          >
            Login
          </Link>
          <CtaButton
            href={config.ctaHref}
            variant={config.ctaVariant}
            className="min-h-10 px-4 py-2"
          >
            {config.ctaLabel}
          </CtaButton>
        </div>

        <details className="group relative lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-bold text-white transition hover:bg-white/15 [&::-webkit-details-marker]:hidden">
            <Menu className="h-5 w-5" aria-hidden="true" />
            Menu
          </summary>
          <div className="fixed inset-x-3 top-[4.25rem] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-xl border border-white/[0.12] bg-slate-950/95 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
            <div className="grid gap-2 border-b border-white/10 pb-3">
              <Link
                href={config.ctaHref}
                className={`flex min-h-12 items-center justify-center rounded-lg px-3 py-2.5 text-center text-sm font-bold text-white transition ${mobilePrimaryClass}`}
              >
                {config.mobilePrimaryLabel}
              </Link>
              <Link
                href={config.mobileSecondaryHref}
                className="flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-3 py-2.5 text-center text-sm font-bold text-white"
              >
                {config.mobileSecondaryLabel}
              </Link>
            </div>

            <nav className="mt-3 grid gap-4" aria-label="Mobile navigation">
              <div>
                <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
                  {config.navEyebrow}
                </p>
                <div className="mt-2 grid gap-1">
                  {config.navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                <Link
                  href="/login"
                  className="flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-3 py-2.5 text-center text-sm font-bold text-white"
                >
                  Login
                </Link>
                <Link
                  href={config.ctaHref}
                  className={`flex min-h-11 items-center justify-center rounded-lg px-3 py-2.5 text-center text-sm font-bold text-white transition ${mobilePrimaryClass}`}
                >
                  {config.mobileFinalLabel}
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
        {config.navItems.map((item) => (
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
