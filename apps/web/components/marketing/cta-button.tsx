import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-blue-600 text-white shadow-xl shadow-blue-950/20 hover:bg-blue-500 focus-visible:outline-blue-200",
  secondary:
    "border border-white/20 bg-white/10 text-white shadow-lg shadow-blue-950/10 hover:bg-white/15 focus-visible:outline-white",
  light:
    "border border-slate-200 bg-white text-slate-950 shadow-sm hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-blue-500",
  dark:
    "bg-slate-950 text-white shadow-xl shadow-slate-950/20 hover:bg-slate-800 focus-visible:outline-slate-400",
  green:
    "bg-emerald-600 text-white shadow-xl shadow-emerald-950/20 hover:bg-emerald-500 focus-visible:outline-emerald-200",
  red:
    "bg-red-600 text-white shadow-xl shadow-red-950/20 hover:bg-red-500 focus-visible:outline-red-200",
} as const;

export function CtaButton({
  href,
  children,
  className,
  variant = "primary",
  showArrow = true,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: keyof typeof variants;
  showArrow?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        variants[variant],
        className
      )}
    >
      {children}
      {showArrow ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
    </Link>
  );
}
