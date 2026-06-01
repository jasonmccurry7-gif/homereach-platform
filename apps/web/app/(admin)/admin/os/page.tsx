import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HomeReach OS Redirect | Admin",
  description: "Compatibility route for the canonical HomeReach admin command center.",
};

export default function AdminOSPage() {
  redirect("/admin");
}
