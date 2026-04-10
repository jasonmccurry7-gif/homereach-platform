// ─────────────────────────────────────────────────────────────────────────────
// Reviews Admin Dashboard — Server Component
// ─────────────────────────────────────────────────────────────────────────────

import { ReviewEngine } from "@/lib/review/review-engine";
import { ReviewsClient } from "./reviews-client";

export const metadata = {
  title: "Review Requests | HomeReach",
};

export default function ReviewsPage() {
  const requests = ReviewEngine.getAllRequests();
  const stats    = ReviewEngine.getStats();

  return <ReviewsClient requests={requests} stats={stats} />;
}
