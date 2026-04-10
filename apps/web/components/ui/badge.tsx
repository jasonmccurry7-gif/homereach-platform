import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  color?: "amber" | "blue" | "green" | "red" | "gray";
  className?: string;
}

const colorMap = {
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  blue: "bg-blue-100 text-blue-800 border-blue-200",
  green: "bg-green-100 text-green-800 border-green-200",
  red: "bg-red-100 text-red-800 border-red-200",
  gray: "bg-gray-100 text-gray-700 border-gray-200",
};

export function Badge({ children, color = "gray", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        colorMap[color],
        className
      )}
    >
      {children}
    </span>
  );
}
