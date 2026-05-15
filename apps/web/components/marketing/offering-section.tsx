import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { CtaButton } from "@/components/marketing/cta-button";
import { cn } from "@/lib/utils";

const toneClasses = {
  blue: {
    eyebrow: "text-blue-600",
    icon: "bg-blue-600 text-white shadow-blue-950/20",
    button: "primary" as const,
  },
  red: {
    eyebrow: "text-red-600",
    icon: "bg-red-600 text-white shadow-red-950/20",
    button: "red" as const,
  },
  green: {
    eyebrow: "text-emerald-600",
    icon: "bg-emerald-600 text-white shadow-emerald-950/20",
    button: "green" as const,
  },
  slate: {
    eyebrow: "text-slate-700",
    icon: "bg-slate-950 text-white shadow-slate-950/20",
    button: "dark" as const,
  },
} as const;

export function OfferingSection({
  id,
  eyebrow,
  title,
  body,
  bullets,
  cta,
  href,
  icon: Icon,
  tone = "blue",
  reverse = false,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  cta: string;
  href: string;
  icon: LucideIcon;
  tone?: keyof typeof toneClasses;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  const classes = toneClasses[tone];

  return (
    <section id={id} className="scroll-mt-28 px-4 py-16 lg:px-6">
      <div
        className={cn(
          "mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-center",
          reverse && "lg:[&>*:first-child]:order-2"
        )}
      >
        <div>
          <div
            className={cn(
              "mb-5 flex h-12 w-12 items-center justify-center rounded-lg shadow-lg",
              classes.icon
            )}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className={cn("text-sm font-black uppercase tracking-[0.18em]", classes.eyebrow)}>
            {eyebrow}
          </p>
          <h2 className="mt-3 max-w-xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">{body}</p>
          <div className="mt-6 grid gap-3">
            {bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-3 text-sm font-semibold text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
          <CtaButton href={href} variant={classes.button} className="mt-8">
            {cta}
          </CtaButton>
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}
