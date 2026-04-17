"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/agent",          label: "Home",     icon: "🏠" },
  { href: "/agent/leads",    label: "Leads",    icon: "👥" },
  { href: "/agent/replies",  label: "Replies",  icon: "💬" },
  { href: "/agent/activity", label: "Activity", icon: "📊" },
  { href: "/agent/account",  label: "Account",  icon: "👤" },
];

export default function AgentBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-gray-900 border-t border-gray-800 z-50">
      <div className="grid grid-cols-5 h-14">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/agent" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} className={`flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${active ? "text-blue-400" : "text-gray-500 hover:text-gray-300"}`}>
              <span className="text-lg leading-none">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
