import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const accentClasses = {
  blue: {
    icon: "bg-blue-50 text-blue-700 ring-blue-100",
    line: "from-blue-500 to-cyan-400",
    cta: "text-blue-700",
  },
  red: {
    icon: "bg-red-50 text-red-700 ring-red-100",
    line: "from-red-500 to-rose-400",
    cta: "text-red-700",
  },
  green: {
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    line: "from-emerald-500 to-lime-400",
    cta: "text-emerald-700",
  },
  amber: {
    icon: "bg-amber-50 text-amber-700 ring-amber-100",
    line: "from-amber-500 to-orange-400",
    cta: "text-amber-700",
  },
  slate: {
    icon: "bg-slate-100 text-slate-700 ring-slate-200",
    line: "from-slate-500 to-slate-300",
    cta: "text-slate-800",
  },
} as const;

export type ProductAccent = keyof typeof accentClasses;

export function ProductCard({
  title,
  body,
  cta,
  href,
  icon: Icon,
  accent = "blue",
  meta,
}: {
  title: string;
  body: string;
  cta: string;
  href: string;
  icon: LucideIcon;
  accent?: ProductAccent;
  meta?: string;
}) {
  const classes = accentClasses[accent];

  return (
    <Link
      href={href}
      className="group relative flex min-h-[18rem] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-2xl hover:shadow-slate-950/10"
    >
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", classes.line)} />
      <div className="flex items-start justify-between gap-4">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1",
            classes.icon
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {meta ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            {meta}
          </span>
        ) : null}
      </div>
      <h3 className="mt-5 text-xl font-black tracking-tight text-slate-950">{title}</h3>
      <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{body}</p>
      <span
        className={cn(
          "mt-6 inline-flex items-center gap-2 text-sm font-black transition group-hover:gap-3",
          classes.cta
        )}
      >
        {cta}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}
