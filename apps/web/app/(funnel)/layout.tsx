import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Funnel Layout
// Minimal chrome — logo + trust signals only. Remove distractions.
// No global nav, no footer links. Keep eyes on the funnel.
// ─────────────────────────────────────────────────────────────────────────────

export default function FunnelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">HomeReach</span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="hidden sm:flex items-center gap-1">
              <svg className="h-3.5 w-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
              </svg>
              Secure checkout
            </span>
            <span className="hidden sm:block">·</span>
            <span className="hidden sm:block">No contracts, cancel anytime</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main>{children}</main>

      {/* Minimal footer */}
      <footer className="mt-16 border-t border-gray-200 bg-white py-6">
        <div className="mx-auto max-w-5xl px-4 text-center text-xs text-gray-400">
          <p>© {new Date().getFullYear()} HomeReach. All rights reserved.</p>
          <p className="mt-1">
            Questions?{" "}
            <a href="mailto:hello@home-reach.com" className="hover:text-gray-600 underline">
              hello@home-reach.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
