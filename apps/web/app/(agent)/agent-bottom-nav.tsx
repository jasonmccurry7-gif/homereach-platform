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
    <nav className="fixed bottom-0 left-0 right-0 w-full bg-gray-900 border-t border-gray-800 z-50 safe-area-pb">
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/agent" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} className={`flex flex-col items-center justify-center gap-1 text-xs transition-colors min-h-[44px] ${active ? "text-blue-400" : "text-gray-500 hover:text-gray-300"}`}>
              <span className="text-xl leading-none">{icon}</span>
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
