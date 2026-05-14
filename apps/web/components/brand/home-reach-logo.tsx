import { cn } from "@/lib/utils";

type LogoTone = "dark" | "light";
type LogoSize = "sm" | "md" | "lg";

const sizeClasses = {
  sm: {
    mark: "h-8 w-8 rounded-lg",
    word: "text-base",
    sub: "text-[9px]",
  },
  md: {
    mark: "h-10 w-10 rounded-xl",
    word: "text-lg",
    sub: "text-[10px]",
  },
  lg: {
    mark: "h-12 w-12 rounded-2xl",
    word: "text-2xl",
    sub: "text-xs",
  },
} satisfies Record<LogoSize, Record<string, string>>;

export function HomeReachMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: LogoSize;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#0f3b82_0%,#2563eb_46%,#0ea5e9_100%)] shadow-lg shadow-blue-950/20 ring-1 ring-white/20",
        sizeClasses[size].mark,
        className
      )}
      aria-hidden="true"
    >
      <svg
        className="h-[78%] w-[78%]"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8.5 30.5 17 22l7 5.6L38.5 13"
          stroke="white"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 35.5h24"
          stroke="white"
          strokeOpacity=".38"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M24 28.5V37"
          stroke="white"
          strokeOpacity=".34"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M18.5 20.5c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5c0 6.2-8.5 13.5-8.5 13.5s-8.5-7.3-8.5-13.5Z"
          fill="#020617"
          fillOpacity=".32"
          stroke="white"
          strokeWidth="2.5"
        />
        <circle cx="27" cy="20.5" r="2.6" fill="white" />
        <path
          d="M13.5 18.5h5M31 9.5h5M7.5 25.5h6"
          stroke="white"
          strokeOpacity=".34"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function HomeReachLogo({
  className,
  markClassName,
  size = "md",
  tone = "dark",
  showWordmark = true,
  sublabel,
}: {
  className?: string;
  markClassName?: string;
  size?: LogoSize;
  tone?: LogoTone;
  showWordmark?: boolean;
  sublabel?: string;
}) {
  const isLight = tone === "light";

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <HomeReachMark size={size} className={markClassName} />
      {showWordmark ? (
        <span className="min-w-0 leading-none">
          <span
            className={cn(
              "block font-black tracking-tight",
              sizeClasses[size].word,
              isLight ? "text-white" : "text-slate-950"
            )}
          >
            HomeReach
          </span>
          {sublabel ? (
            <span
              className={cn(
                "mt-1 block font-bold uppercase tracking-[0.18em]",
                sizeClasses[size].sub,
                isLight ? "text-blue-100/80" : "text-slate-500"
              )}
            >
              {sublabel}
            </span>
          ) : null}
        </span>
      ) : (
        <span className="sr-only">HomeReach</span>
      )}
    </span>
  );
}
