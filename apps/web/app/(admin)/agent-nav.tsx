"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

// ─────────────────────────────────────────────────────────────────────────────
// AgentNav — slim sidebar shown to sales_agent role users
// Only exposes the execution dashboard — no admin tools
// ─────────────────────────────────────────────────────────────────────────────

export default function AgentNav() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-700">
        <span className="font-bold text-lg tracking-tight">HomeReach</span>
        <p className="text-xs text-gray-400 mt-0.5">Sales Agent Portal</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <Link
          href="/admin/agent-view"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/admin/agent-view"
              ? "bg-blue-600 text-white"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }`}
        >
          ⚡ My Dashboard
        </Link>
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-gray-700">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
