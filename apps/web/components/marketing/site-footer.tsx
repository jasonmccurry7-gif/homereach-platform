import Link from "next/link";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import { footerLinkGroups } from "@/components/marketing/navigation-config";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 lg:grid-cols-[1.2fr_2fr] lg:px-6">
        <div>
          <Link href="/" aria-label="HomeReach home">
            <HomeReachLogo tone="light" size="md" sublabel="Geographic Operations" />
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-6 text-slate-400">
            Geographic intelligence, campaign execution, property targeting, and
            purchasing intelligence for local businesses and campaign teams.
          </p>
          <p className="mt-6 text-xs text-slate-500">
            © {new Date().getFullYear()} HomeReach. All rights reserved.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {footerLinkGroups.map((group) => (
            <div key={group.title}>
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                {group.title}
              </h2>
              <div className="mt-4 grid gap-3">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm font-medium text-slate-400 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
