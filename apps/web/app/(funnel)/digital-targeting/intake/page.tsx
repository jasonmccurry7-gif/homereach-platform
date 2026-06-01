import type { Metadata } from "next";
import { DigitalTargetingIntakeClient } from "./digital-targeting-intake-client";

export const metadata: Metadata = {
  title: "Start Neighborhood Digital Targeting | HomeReach",
  description:
    "Submit a Neighborhood Digital Targeting campaign intake for jobsites, service areas, competitors, events, neighborhoods, or political geographies.",
};

export default function DigitalTargetingIntakePage() {
  return <DigitalTargetingIntakeClient />;
}
