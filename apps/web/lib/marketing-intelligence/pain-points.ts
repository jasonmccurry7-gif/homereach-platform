import type { DailyVideoVertical } from "@/lib/daily-content/types";

export type VerticalPainPointProfile = {
  vertical: DailyVideoVertical | "roofing" | "lawn_care" | "restaurants" | "general";
  label: string;
  painPoints: string[];
  winningAngles: string[];
  proofNeeded: string[];
};

export const VERTICAL_PAIN_POINT_LIBRARY: VerticalPainPointProfile[] = [
  {
    vertical: "procurement",
    label: "Supplyfy / Procurement",
    painPoints: [
      "Vendor overpricing",
      "Ingredient inflation",
      "Inventory waste",
      "Poor purchasing visibility",
      "Delivery fees hiding the real landed cost",
    ],
    winningAngles: [
      "Same items, lower total delivered cost",
      "Find the hidden cost leak before raising prices",
      "Protect margin without adding another owner task",
    ],
    proofNeeded: [
      "Current invoice or supplier quote",
      "Comparable unit size",
      "Delivery fee and minimum order note",
    ],
  },
  {
    vertical: "targeted_postcard",
    label: "HomeReach Targeted Mail",
    painPoints: [
      "Lead generation cost",
      "Route inefficiency",
      "Low marketing ROI",
      "Random service-area marketing",
      "Competitors getting remembered first",
    ],
    winningAngles: [
      "One completed job should produce the next neighborhood",
      "Stop marketing everywhere and build density near real work",
      "Turn visible local proof into a postcard route",
    ],
    proofNeeded: [
      "Recent job address or service area",
      "Trade/category",
      "Route or neighborhood map",
    ],
  },
  {
    vertical: "political",
    label: "Political Campaigns",
    painPoints: [
      "Low name recognition",
      "Wasted advertising spend",
      "Limited volunteer resources",
      "Compressed campaign timelines",
      "Weak geographic execution visibility",
    ],
    winningAngles: [
      "Mail strategy organized by geography, timing, and cost",
      "Show campaign command infrastructure, not print-vendor energy",
      "Make routes, phases, reach, and budget obvious",
    ],
    proofNeeded: [
      "Public race context",
      "District or county geography",
      "Campaign-provided goals",
    ],
  },
  {
    vertical: "roofing",
    label: "Roofing",
    painPoints: [
      "Storm competition",
      "High lead cost",
      "Route inefficiency",
      "Jobsite proof not turning into nearby leads",
    ],
    winningAngles: [
      "One roofing job should create five more nearby conversations",
      "Mail around completed work while neighbors still remember it",
    ],
    proofNeeded: ["Completed job location", "Service radius", "Before/after proof"],
  },
  {
    vertical: "lawn_care",
    label: "Lawn Care",
    painPoints: [
      "Route density",
      "Seasonal demand swings",
      "Driving too far between jobs",
      "Customer acquisition cost",
    ],
    winningAngles: [
      "More jobs nearby, less drive time",
      "Build density around the lawns already on the route",
    ],
    proofNeeded: ["Current route area", "Target neighborhoods", "Seasonal service offer"],
  },
  {
    vertical: "restaurants",
    label: "Restaurants",
    painPoints: [
      "Food costs",
      "Inventory waste",
      "Labor pressure",
      "Slow nights",
      "Low repeat visibility",
    ],
    winningAngles: [
      "Protect margin before chasing more volume",
      "Find supply savings owners can approve quickly",
    ],
    proofNeeded: ["Common supply list", "Monthly spend estimate", "Current vendor baseline"],
  },
];

export function painPointProfileForVertical(vertical: DailyVideoVertical | string) {
  return (
    VERTICAL_PAIN_POINT_LIBRARY.find((item) => item.vertical === vertical) ??
    VERTICAL_PAIN_POINT_LIBRARY.find((item) => item.vertical === "general") ??
    null
  );
}
